import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtureFiles, fixtureHash, getFixture, type FixtureId } from '@/fixtures';
import { ALL_SCENES, DEV_SCENES, DOMINANT_SHARE, HELDOUT_SCENES, ROOT_CAUSES, sceneTruth, taskPrompt, truthFor } from '@/fixtures/perf/mission';
import { UNIT_COST, profileScene, SUBSYSTEMS } from '@/fixtures/perf/profiler';
import { PHASER_PERFORMANCE_MISSION as M } from '@/content/missions/phaser-performance';
import { freezeRequirements } from '@/domain/loop/engine';
import { contentOf, SkillDraftSchema } from '@/domain/skills/model';
import { validateSkillContent } from '@/domain/skills/validate';

async function writePack(id: FixtureId): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), `forge-pack-${id}-`));
  for (const f of await fixtureFiles(id)) {
    mkdirSync(join(dir, f.path, '..'), { recursive: true });
    writeFileSync(join(dir, f.path), f.content);
  }
  return dir;
}

describe('Phaser Performance Investigator: ground truth', () => {
  it('is computed from counted work with a published rule, with safe margins around the 50% threshold', () => {
    for (const s of ALL_SCENES) {
      const t = sceneTruth(s);
      if (t.verdict === 'mixed') {
        expect(t.numbers.dominantShare, `${s.id} mixed must stay clearly below the threshold`).toBeLessThan(DOMINANT_SHARE - 0.1);
        expect(t.numbers.secondShare, s.id).toBeGreaterThan(0.2);
      } else {
        expect(t.numbers.dominantShare, `${s.id} dominant must clear the threshold by a margin`).toBeGreaterThan(DOMINANT_SHARE + 0.1);
      }
      const total = t.numbers.perFrame.reduce((a, r) => a + r.units, 0);
      expect(Math.abs(total - t.numbers.totalUnits)).toBeLessThan(0.2);
      expect(t.numbers.perFrame.reduce((a, r) => a + r.share, 0)).toBeGreaterThan(0.99);
    }
  });

  it('the evaluation set is spread: dev covers four different answers, held-out three more, and each answer is used', () => {
    const dev = DEV_SCENES.map((s) => sceneTruth(s).verdict);
    const held = HELDOUT_SCENES.map((s) => sceneTruth(s).verdict);
    expect(new Set(dev).size).toBe(4);
    expect(new Set(held).size).toBe(3);
    expect(held.some((h) => !dev.includes(h)), 'held-out contains bottlenecks the dev set never showed').toBe(true);
    for (const v of [...dev, ...held]) expect(ROOT_CAUSES.map((r) => r.value)).toContain(v);
  });

  it('each scene contains a red herring: the answer is not the subsystem the complaint or excerpt points at', () => {
    const suspect: Record<string, string> = { 'scene-1': 'collision', 'scene-2': 'textures', 'scene-3': 'collision', 'scene-5': 'textures', 'scene-6': 'allocation', 'scene-7': 'grid-fixed' };
    for (const [id, claimed] of Object.entries(suspect)) {
      const t = truthFor(id)!;
      expect(t.verdict, id).not.toBe(claimed);
      expect(SUBSYSTEMS).toContain(t.verdict);
    }
    // the "we added a grid" scene is still collision-bound because the grid degenerates to a naive loop
    expect(truthFor('scene-7')!.verdict).toBe('collision');
    const grid = profileScene(ALL_SCENES.find((s) => s.id === 'scene-7')!.config);
    const naive = profileScene({ ...ALL_SCENES.find((s) => s.id === 'scene-7')!.config, broadphase: 'naive' });
    expect(grid.perFrame.find((r) => r.subsystem === 'collision')!.count).toBeGreaterThan(0.8 * naive.perFrame.find((r) => r.subsystem === 'collision')!.count);
  });

  it('a well-sized grid really does cut collision work (the model is not rigged)', () => {
    const base = ALL_SCENES.find((s) => s.id === 'scene-7')!.config;
    const good = profileScene({ ...base, cellSize: 100 }).perFrame.find((r) => r.subsystem === 'collision')!.count;
    const bad = profileScene(base).perFrame.find((r) => r.subsystem === 'collision')!.count;
    expect(good).toBeLessThan(bad / 20);
  });

  it('is deterministic and the cost model is the published one', () => {
    for (const s of ALL_SCENES) expect(profileScene(s.config)).toEqual(profileScene(s.config));
    expect(UNIT_COST).toEqual({ allocation: 4, collision: 1, 'draw-calls': 30, 'display-list': 1.5, 'update-logic': 1 });
  });
});

describe('Phaser Performance Investigator: packs (what the learner runs in Claude Code)', () => {
  let logs: string[] = [];
  const origArgv = process.argv;
  beforeEach(() => {
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => void logs.push(a.join(' ')));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    process.argv = origArgv;
  });

  it('the pack CLI reproduces exactly what the in-app profiler computes, for every scene', async () => {
    for (const [pack, list] of [['phaser-perf-dev', DEV_SCENES], ['phaser-perf-heldout', HELDOUT_SCENES]] as const) {
      const dir = await writePack(pack);
      for (const s of list) {
        logs = [];
        process.argv = ['node', 'profile.ts', s.id];
        await import(/* @vite-ignore */ pathToFileURL(join(dir, 'profile.ts')).href + `?scene=${s.id}`);
        const p = profileScene(s.config);
        expect(logs[0], s.id).toBe(`scene,${s.id}`);
        const rows = logs.slice(2, 7).map((l) => l.split(','));
        expect(rows.map((r) => r[0]), s.id).toEqual([...SUBSYSTEMS]);
        p.perFrame.forEach((r, i) => {
          expect(Number(rows[i]![1]), `${s.id} ${r.subsystem} count`).toBe(r.count);
          expect(Number(rows[i]![3]), `${s.id} ${r.subsystem} share`).toBe(r.share);
        });
        expect(logs.some((l) => /not milliseconds or FPS/.test(l)), s.id).toBe(true);
      }
    }
  });

  it('packs contain no ground truth and make no FPS or frame-time claim', async () => {
    for (const id of ['phaser-perf-dev', 'phaser-perf-heldout'] as const) {
      const files = await fixtureFiles(id);
      const text = files.map((f) => f.content).join('\n');
      expect(text).not.toMatch(/"verdict"|"truth"|gradedTruth|ROOT_CAUSE_ANSWER/i);
      const scenes = JSON.parse(files.find((f) => f.path === 'cases.json')!.content) as Record<string, unknown>[];
      for (const s of scenes) expect(Object.keys(s).sort()).toEqual(['complaint', 'config', 'description', 'excerpt', 'id', 'title']);
      // every mention of FPS / frame time must be a disclaimer
      for (const line of text.split('\n').filter((l) => /\bfps\b|frame time|milliseconds|\d+\s?ms\b/i.test(l))) {
        expect(line, `unqualified performance claim: ${line}`).toMatch(/not|never|NOT|does not|nothing here|real|measure/i);
      }
      expect(text).not.toMatch(/\b\d{2,3}\s?(fps|FPS)\b/);
    }
  });

  it('dev and held-out packs are disjoint, hashed, and registered with a checklist', async () => {
    const dev = JSON.parse((await fixtureFiles('phaser-perf-dev')).find((f) => f.path === 'cases.json')!.content) as { id: string }[];
    const held = JSON.parse((await fixtureFiles('phaser-perf-heldout')).find((f) => f.path === 'cases.json')!.content) as { id: string }[];
    expect(dev.some((d) => held.some((h) => h.id === d.id))).toBe(false);
    const a = await fixtureHash('phaser-perf-dev');
    const b = await fixtureHash('phaser-perf-heldout');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(getFixture('phaser-perf-dev')!.checklist).toHaveLength(5);
  });
});

describe('Phaser Performance Investigator: mission definition', () => {
  it('is complete: problem, criteria, cases with prompts, checklist, how-tos, transfer prompt, labels', () => {
    expect(M.devCases).toHaveLength(4);
    expect(M.heldoutCases).toHaveLength(3);
    for (const c of [...M.devCases, ...M.heldoutCases]) {
      expect(c.prompt).toContain(M.verdictFormat);
      expect(c.prompt).toContain(c.id);
      expect(M.truth(c.id), c.id).toBeDefined();
    }
    expect(taskPrompt(DEV_SCENES[0]!)).toBe(M.devCases[0]!.prompt);
    expect(M.checklist.map((c) => c.id)).toEqual(['ran-profiler', 'cited-counts', 'dominant-not-loudest', 'units-not-fps', 'targeted-fix']);
    for (const arr of [M.baselineHowTo, M.skillHowTo, M.evidenceHowTo, M.successCriteria]) expect(arr.length).toBeGreaterThanOrEqual(4);
    expect(M.transferPrompt).toMatch(/real mid-range phone|real/i);
    expect(M.labels.truthLimitation).toMatch(/not frame time/i);
    expect(M.verdicts.map((v) => v.value)).toEqual(['allocation', 'collision', 'draw-calls', 'display-list', 'update-logic', 'mixed']);
  });

  it('the starter Skill is valid but deliberately imperfect (broad trigger, no evidence gate, no FPS rule)', () => {
    const draft = SkillDraftSchema.parse({ ...M.starter(), id: 'x', createdAt: 't', updatedAt: 't' });
    expect(freezeRequirements(draft).every((r) => r.ok)).toBe(true);
    expect(validateSkillContent(contentOf(draft)).errors).toBe(0);
    expect(contentOf(draft).description.toLowerCase()).not.toContain('not for');
    expect(contentOf(draft).instructions).not.toMatch(/profile\.ts|npx tsx/);
    expect(contentOf(draft).instructions).not.toMatch(/fps/i);
  });

  it('no ground truth leaks into mission-visible text (cases, starter, how-tos)', () => {
    // the answer-format line legitimately lists every option; strip it, then no `ROOT CAUSE: <answer>` may remain
    const visible = JSON.stringify([M.devCases, M.heldoutCases, M.starter(), M.baselineHowTo, M.skillHowTo]).split(M.verdictFormat).join('');
    for (const s of ALL_SCENES) {
      const t = sceneTruth(s);
      expect(visible).not.toContain(`ROOT CAUSE: ${t.verdict}`);
    }
  });
});

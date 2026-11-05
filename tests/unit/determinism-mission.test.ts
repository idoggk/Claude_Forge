import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtureFiles, fixtureHash, getFixture, type FixtureId } from '@/fixtures';
import { ALL_CHANGES, DEV_CHANGES, HELDOUT_CHANGES, VARIANTS, harnessFor, taskPrompt, truthFor, verdictOf } from '@/fixtures/determinism/mission';
import { ENVIRONMENTS, runHarness, script } from '@/fixtures/determinism/harness';
import { BASE, playGame, traceHash } from '@/fixtures/determinism/sim';
import { DETERMINISTIC_SIMULATION_MISSION as M } from '@/content/missions/deterministic-simulation';
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

describe('Deterministic Merge Simulation Reviewer: ground truth', () => {
  it('is computed by running the change under perturbed environments, with the published policy', () => {
    const expected: Record<string, string> = { 'det-1': 'reject', 'det-2': 'approve', 'det-3': 'revise', 'det-4': 'reject', 'det-5': 'reject', 'det-6': 'approve', 'det-7': 'revise' };
    for (const c of ALL_CHANGES) {
      const t = truthFor(c.id)!;
      expect(t.verdict, c.id).toBe(expected[c.id]);
      expect(t.numbers.envHashes, c.id).toHaveLength(ENVIRONMENTS);
      expect(t.summary.length, c.id).toBeGreaterThan(40);
    }
  });

  it('the spread covers all three outcomes in dev, and held-out contains mechanisms the dev set never showed', () => {
    const dev = DEV_CHANGES.map((c) => truthFor(c.id)!.verdict);
    expect(new Set(dev)).toEqual(new Set(['approve', 'revise', 'reject']));
    const rejectCauses = (list: typeof DEV_CHANGES) => list.filter((c) => truthFor(c.id)!.verdict === 'reject').map((c) => c.cause);
    expect(rejectCauses(DEV_CHANGES).join(' ')).toMatch(/Math\.random|clock/);
    expect(rejectCauses(HELDOUT_CHANGES).join(' ')).toMatch(/arrive|order/);
    expect(rejectCauses(DEV_CHANGES).join(' ')).not.toMatch(/arrive/);
  });

  it('the golden behaviour is deterministic and the harness itself is repeatable', () => {
    const base = runHarness(BASE);
    expect(new Set(base.envHashes).size).toBe(1);
    expect(base.envHashes[0]).toBe(base.golden);
    for (const c of ALL_CHANGES) expect(runHarness(VARIANTS[c.id]!)).toEqual(runHarness(VARIANTS[c.id]!));
  });

  it('nondeterministic variants fail for the reason their cause states (not by accident)', () => {
    // det-1 diverges immediately (global Math.random); det-4 needs a tie to occur; det-5 depends on arrival order
    expect(harnessFor('det-1')!.firstDivergence).not.toBeNull();
    expect(harnessFor('det-4')!.firstDivergence).not.toBeNull();
    const env = (id: string) => harnessFor(id)!.envHashes;
    expect(env('det-5')[0]).toBe(env('det-5')[3]); // environments 0 and 3 use the scripted order
    expect(env('det-5')[1]).not.toBe(env('det-5')[0]); // reversed arrival changes the result
  });

  it('the harness restores Math.random and Date.now even when a variant throws', () => {
    const realRandom = Math.random;
    const realNow = Date.now;
    const bad = { ...BASE, id: 'boom', perDrop: () => { throw new Error('boom'); } };
    expect(() => runHarness(bad)).toThrow('boom');
    expect(Math.random).toBe(realRandom);
    expect(Date.now).toBe(realNow);
  });

  it('scripts include simultaneous inputs, so arrival order can matter', () => {
    const moves = script(1);
    const ticks = new Map<number, number>();
    for (const m of moves) ticks.set(m.tick, (ticks.get(m.tick) ?? 0) + 1);
    expect([...ticks.values()].some((n) => n > 1)).toBe(true);
    expect(traceHash(playGame(BASE, 1, moves))).toBe(traceHash(playGame(BASE, 1, moves)));
  });

  it('verdictOf maps hashes to the three outcomes', () => {
    expect(verdictOf({ envHashes: ['a', 'b', 'a', 'a'], golden: 'a', firstDivergence: 3 })).toBe('reject');
    expect(verdictOf({ envHashes: ['b', 'b', 'b', 'b'], golden: 'a', firstDivergence: null })).toBe('revise');
    expect(verdictOf({ envHashes: ['a', 'a', 'a', 'a'], golden: 'a', firstDivergence: null })).toBe('approve');
  });
});

describe('Deterministic Merge Simulation Reviewer: packs', () => {
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

  it('the pack CLI prints exactly what the in-app harness computes, for every change', async () => {
    for (const [pack, list] of [['det-sim-dev', DEV_CHANGES], ['det-sim-heldout', HELDOUT_CHANGES]] as const) {
      const dir = await writePack(pack);
      for (const c of list) {
        logs = [];
        process.argv = ['node', 'check.ts', c.id];
        await import(/* @vite-ignore */ pathToFileURL(join(dir, 'check.ts')).href + `?change=${c.id}`);
        const r = harnessFor(c.id)!;
        expect(logs[0], c.id).toBe(`change,${c.id}`);
        expect(logs.slice(2, 2 + ENVIRONMENTS), c.id).toEqual(r.envHashes.map((h, i) => `${i},${h}`));
        expect(logs[2 + ENVIRONMENTS], c.id).toBe(`golden_hash,${r.golden}`);
        expect(logs[3 + ENVIRONMENTS], c.id).toBe(`first_divergence_event,${r.firstDivergence ?? 'none'}`);
      }
    }
  });

  it('packs print raw hashes only: no verdict, no cause, no truth - and no held-out code in the dev pack', async () => {
    for (const [pack, mine, theirs] of [['det-sim-dev', DEV_CHANGES, HELDOUT_CHANGES], ['det-sim-heldout', HELDOUT_CHANGES, DEV_CHANGES]] as const) {
      const files = await fixtureFiles(pack);
      const text = files.map((f) => f.content).join('\n');
      expect(text).not.toMatch(/"verdict"|"cause"|gradedTruth|ground truth is/i);
      for (const c of [...DEV_CHANGES, ...HELDOUT_CHANGES]) expect(text, c.id).not.toContain(c.cause);
      const cases = JSON.parse(files.find((f) => f.path === 'cases.json')!.content) as Record<string, unknown>[];
      for (const k of cases) expect(Object.keys(k).sort()).toEqual(['change', 'diff', 'id', 'rationale', 'title']);
      const variants = files.find((f) => f.path === 'variants.ts')!.content;
      for (const c of mine) expect(variants, c.id).toContain(`'${c.id}'`);
      for (const c of theirs) expect(variants, `${c.id} leaked into ${pack}`).not.toContain(`'${c.id}'`);
    }
  });

  it('packs are hashed, disjoint and registered with a checklist', async () => {
    const a = await fixtureHash('det-sim-dev');
    const b = await fixtureHash('det-sim-heldout');
    expect(a).not.toBe(b);
    expect(getFixture('det-sim-dev')!.checklist).toHaveLength(5);
    expect(getFixture('det-sim-heldout')!.checklist).toHaveLength(5);
  });
});

describe('Deterministic Merge Simulation Reviewer: mission definition', () => {
  it('is complete and prompts carry the answer format and case id', () => {
    expect(M.devCases).toHaveLength(4);
    expect(M.heldoutCases).toHaveLength(3);
    for (const c of [...M.devCases, ...M.heldoutCases]) {
      expect(c.prompt).toContain(M.verdictFormat);
      expect(c.prompt).toContain(c.id);
      expect(M.truth(c.id), c.id).toBeDefined();
    }
    expect(taskPrompt(DEV_CHANGES[0]!)).toBe(M.devCases[0]!.prompt);
    expect(M.checklist).toHaveLength(5);
    expect(M.labels.truthLimitation).toMatch(/does not prove determinism/i);
  });

  it('the starter is valid but deliberately imperfect', () => {
    const draft = SkillDraftSchema.parse({ ...M.starter(), id: 'x', createdAt: 't', updatedAt: 't' });
    expect(freezeRequirements(draft).every((r) => r.ok)).toBe(true);
    expect(validateSkillContent(contentOf(draft)).errors).toBe(0);
    expect(contentOf(draft).description.toLowerCase()).not.toContain('not for');
    expect(contentOf(draft).instructions).not.toMatch(/check\.ts|hash/i);
  });

  it('cases show the diff but never the verdict', () => {
    const visible = JSON.stringify([M.devCases, M.heldoutCases]).split(M.verdictFormat).join('');
    expect(visible).not.toMatch(/VERDICT: (approve|revise|reject)/);
    for (const c of M.devCases) expect(c.change).toContain('```diff');
  });
});

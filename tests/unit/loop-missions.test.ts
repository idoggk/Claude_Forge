import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForgeDB, setDbForTesting, getDb } from '@/persistence/db';
import * as loop from '@/persistence/loopRepo';
import { MISSIONS } from '@/content/missions';
import { computeSteps, matchStats } from '@/domain/loop/engine';
import { buildLoopReportMarkdown } from '@/domain/loop/report';
import { contentOf } from '@/domain/skills/model';
import { fixtureHash, getFixture, type FixtureId } from '@/fixtures';

let n = 0;
beforeEach(async () => {
  const db = new ForgeDB(`missions-${++n}-${Math.random().toString(36).slice(2)}`);
  setDbForTesting(db);
  await db.open();
});

const rec = (loopId: string, phase: 'dev' | 'heldout', condition: 'baseline' | 'v1' | 'v2', caseId: string, verdict: string) =>
  loop.recordCaseRun({ loopId, phase, condition, caseId, verdict, checklist: [], skillActivated: null, reworkRounds: null, interventions: null, runtimeSec: null, tokens: null, observations: '', evidenceText: '' });

describe('mission registry', () => {
  it('registers four missions with unique ids, registered fixtures and complete labels', async () => {
    expect(MISSIONS.map((m) => m.id)).toEqual(['economy-balance-reviewer', 'phaser-performance-investigator', 'deterministic-simulation-reviewer', 'multi-agent-integration-auditor']);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    for (const m of MISSIONS) {
      for (const id of [m.fixture.devId, m.fixture.heldoutId]) {
        expect(getFixture(id), `${m.id}: ${id}`).toBeDefined();
        expect(await fixtureHash(id as FixtureId)).toMatch(/^[0-9a-f]{64}$/);
        expect(getFixture(id)!.checklist.map((c) => c.id), `${m.id} fixture checklist matches mission`).toEqual(m.checklist.map((c) => c.id));
      }
      expect(m.devCases.length).toBeGreaterThanOrEqual(4);
      expect(m.heldoutCases.length).toBeGreaterThanOrEqual(3);
      expect(m.devCases.filter((c) => m.heldoutCases.some((h) => h.id === c.id))).toEqual([]);
      for (const c of [...m.devCases, ...m.heldoutCases]) {
        const t = m.truth(c.id)!;
        expect(m.verdicts.map((v) => v.value), `${m.id}/${c.id} truth is a legal answer`).toContain(t.verdict);
        expect(t.summary.length).toBeGreaterThan(20);
      }
      for (const k of Object.values(m.labels)) expect(k.length).toBeGreaterThan(3);
      expect(m.prerequisites.length).toBeGreaterThan(0);
      expect(m.transferPrompt.length).toBeGreaterThan(80);
    }
  });
});

describe.each(MISSIONS.map((m) => [m.id, m] as const))('full loop lifecycle: %s', (_id, M) => {
  const DEV = M.devCases.map((c) => c.id);
  const HELD = M.heldoutCases.map((c) => c.id);
  const truth = (id: string) => M.truth(id)!.verdict;
  const wrongFor = (id: string) => M.verdicts.find((v) => v.value !== truth(id))!.value;

  it('runs start to graduation, grades against this mission\'s own truth, and writes a report in its own words', async () => {
    const l = await loop.startLoop(M.id);
    await loop.createLoopSkill(l.id);
    for (const id of DEV) await rec(l.id, 'dev', 'baseline', id, wrongFor(id)); // a baseline that is always wrong
    await loop.freezeV1(l.id);
    for (const id of DEV) await rec(l.id, 'dev', 'v1', id, truth(id));
    await loop.gradeDevSet(l.id);
    let b = (await loop.loadLoop(l.id))!;
    const stats = matchStats(b.dev, DEV);
    expect(stats.find((s) => s.conditionId === l.conditionIds.baseline)!.matched).toBe(0);
    expect(stats.find((s) => s.conditionId === b.loop.conditionIds.v1)!.matched).toBe(DEV.length);

    await getDb().customSkills.put({ ...b.skill!, instructions: contentOf(b.skill!).instructions + '\n5. Always run the fixture\'s check script first and quote its output.' });
    await loop.saveImprovement(l.id, { patternIds: ['missing-verification'], hypothesis: 'Claude does not run the check script; requiring it first should raise accuracy.', expectedChange: 'More held-out answers match the ground truth' });
    for (const id of HELD) { await rec(l.id, 'heldout', 'v1', id, wrongFor(id)); await rec(l.id, 'heldout', 'v2', id, truth(id)); }
    await loop.revealHeldout(l.id);
    await loop.saveReflection(l.id, { lessons: 'Lessons: the check script output decided every case; opinions did not.', application: 'Application: I will require the same evidence gate for my real project reviews.' });
    await loop.graduateLoop(l.id);
    b = (await loop.loadLoop(l.id))!;
    expect(b.loop.status).toBe('graduated');
    expect(computeSteps(loop.toContext(b)).every((s) => s.status === 'done')).toBe(true);

    const md = buildLoopReportMarkdown(b);
    expect(md).toContain(M.title);
    expect(md).toContain(M.labels.truthLimitation);
    expect(md).toContain(`| ${M.labels.caseNoun.charAt(0).toUpperCase() + M.labels.caseNoun.slice(1)} | Ground truth |`);
    expect(md).toContain(`${M.labels.caseNounPlural}`);
    expect(md).not.toMatch(/undefined|NaN/);
    expect(md).toContain('tested on a synthetic fixture only');
  });

  it('a recorded answer that is not one of this mission\'s options still stores (self-reported) but never matches truth', async () => {
    const l = await loop.startLoop(M.id);
    await rec(l.id, 'dev', 'baseline', DEV[0]!, 'something-else');
    await loop.gradeDevSet(l.id);
    const run = (await loop.loadLoop(l.id))!.dev!.runs[0]!;
    expect(run.successMet).toBe(false);
    expect(run.gradedTruth).toBe(truth(DEV[0]!));
  });
});

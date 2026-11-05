import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForgeDB, setDbForTesting, getDb, DB_VERSION } from '@/persistence/db';
import * as loop from '@/persistence/loopRepo';
import { ECONOMY_BALANCE_MISSION as M } from '@/content/missions/economy-balance';
import { activeStep, computeSteps, coverage, failureSignals, freezeRequirements, gradeExperimentRuns, graduationRequirements, heldoutReady, improvementRequirements, matchStats, caseMatrix } from '@/domain/loop/engine';
import { buildLoopReportJson, buildLoopReportMarkdown, heldoutReading } from '@/domain/loop/report';
import { contentOf } from '@/domain/skills/model';
import { LoopRunSchema } from '@/domain/loop/model';
import { applyImport, exportAll, parseBackup, serializeBackup } from '@/persistence/backup';
import { ALL_PROPOSALS, truthFor } from '@/fixtures/economy/mission';

let n = 0;
beforeEach(async () => {
  const db = new ForgeDB(`loop-test-${++n}-${Math.random().toString(36).slice(2)}`);
  setDbForTesting(db);
  await db.open();
});

const DEV = M.devCases.map((c) => c.id);
const HELD = M.heldoutCases.map((c) => c.id);

const rec = (loopId: string, phase: 'dev' | 'heldout', condition: 'baseline' | 'v1' | 'v2', caseId: string, verdict: string, checklist: string[] | null = null, over: Partial<loop.CaseRunInput> = {}) =>
  loop.recordCaseRun({ loopId, phase, condition, caseId, verdict, checklist, skillActivated: null, reworkRounds: null, interventions: null, runtimeSec: null, tokens: null, observations: '', evidenceText: '', ...over });

const truthOf = (id: string) => M.truth(id)!.verdict;

async function toBuilt() {
  const l = await loop.startLoop(M.id);
  await loop.createLoopSkill(l.id);
  return l;
}

describe('mission content', () => {
  it('has distinct dev and held-out cases, and the truth function knows each', () => {
    expect(DEV.length).toBeGreaterThanOrEqual(4);
    expect(HELD.length).toBeGreaterThanOrEqual(3);
    expect(DEV.filter((d) => HELD.includes(d))).toEqual([]);
    for (const id of [...DEV, ...HELD]) expect(M.truth(id)).toBeDefined();
    expect(M.truth('nope')).toBeUndefined();
  });

  it('the starter Skill is valid but deliberately imperfect (broad trigger, no verification step)', async () => {
    const l = await toBuilt();
    const b = (await loop.loadLoop(l.id))!;
    const reqs = freezeRequirements(b.skill);
    expect(reqs.every((r) => r.ok)).toBe(true);
    expect(contentOf(b.skill!).description.toLowerCase()).not.toContain('not for');
  });
});

describe('loop lifecycle', () => {
  it('starts with a baseline experiment, baseline step active, and linked experiment metadata', async () => {
    const l = await loop.startLoop(M.id);
    const b = (await loop.loadLoop(l.id))!;
    expect(b.dev!.loopId).toBe(l.id);
    expect(b.dev!.phase).toBe('dev');
    expect(b.dev!.fixture.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(b.dev!.conditions.map((c) => c.kind)).toEqual(['no-skill']);
    const steps = computeSteps(loop.toContext(b));
    expect(steps.find((s) => s.id === 'mission')!.status).toBe('done');
    expect(activeStep(steps)).toBe('baseline');
    expect(steps.find((s) => s.id === 'test')!.status).toBe('locked');
  });

  it('refuses unknown missions', async () => {
    await expect(loop.startLoop('nope')).rejects.toThrow(/Unknown mission/);
  });

  it('cannot record Skill runs before v1 exists, and cannot record an unknown case', async () => {
    const l = await toBuilt();
    await expect(rec(l.id, 'dev', 'v1', DEV[0]!, 'approve')).rejects.toThrow(/does not exist yet/);
    await expect(rec(l.id, 'dev', 'baseline', 'bogus', 'approve')).rejects.toThrow(/Unknown case/);
    await expect(rec(l.id, 'heldout', 'v1', HELD[0]!, 'approve')).rejects.toThrow(/no experiment yet/);
  });

  it('step progression is derived from recorded data, not from clicks', async () => {
    const l = await toBuilt();
    for (const id of DEV.slice(0, DEV.length - 1)) await rec(l.id, 'dev', 'baseline', id, 'approve');
    let steps = computeSteps(loop.toContext((await loop.loadLoop(l.id))!));
    expect(activeStep(steps)).toBe('baseline');
    await rec(l.id, 'dev', 'baseline', DEV[DEV.length - 1]!, 'approve');
    steps = computeSteps(loop.toContext((await loop.loadLoop(l.id))!));
    expect(steps.find((s) => s.id === 'baseline')!.status).toBe('done');
    expect(activeStep(steps)).toBe('build');
    // an 'unclear' verdict is recorded (so the run counts) and is never treated as a match
    await rec(l.id, 'dev', 'baseline', DEV[0]!, 'unclear');
    const b = (await loop.loadLoop(l.id))!;
    expect(coverage(b.dev, l.conditionIds.baseline, DEV).missing).toEqual([]);
  });

  it('re-recording a run replaces it instead of duplicating', async () => {
    const l = await toBuilt();
    await rec(l.id, 'dev', 'baseline', DEV[0]!, 'approve');
    await rec(l.id, 'dev', 'baseline', DEV[0]!, 'reject', null, { evidenceText: 'second' });
    const b = (await loop.loadLoop(l.id))!;
    expect(b.dev!.runs.filter((r) => r.caseId === DEV[0])).toHaveLength(1);
    expect(b.dev!.runs[0]!.verdict).toBe('reject');
    expect(b.evidence).toHaveLength(1);
  });

  it('unknown metrics stay unknown (never 0) and known ones are marked self-reported', async () => {
    const l = await toBuilt();
    await rec(l.id, 'dev', 'baseline', DEV[0]!, 'approve', ['ran-sim'], { reworkRounds: 2 });
    const run = (await loop.loadLoop(l.id))!.dev!.runs[0]!;
    expect(run.metrics.reworkRounds).toEqual({ value: 2, provenance: 'self-reported' });
    expect('tokens' in run.metrics).toBe(false);
    expect('runtimeSec' in run.metrics).toBe(false);
    expect(run.seededFound).toEqual(['ran-sim']);
  });
});

describe('freezing v1', () => {
  it('freezes a snapshot, adds the v1 condition, and is not repeatable', async () => {
    const l = await toBuilt();
    await loop.freezeV1(l.id);
    const b = (await loop.loadLoop(l.id))!;
    expect(b.loop.v1).not.toBeNull();
    expect(b.dev!.conditions.map((c) => c.kind)).toEqual(['no-skill', 'skill']);
    expect(b.skill!.revisions.some((r) => r.id === b.loop.v1!.revisionId)).toBe(true);
    await expect(loop.freezeV1(l.id)).rejects.toThrow(/already frozen/);
  });

  it('refuses to freeze an invalid Skill or one without trigger scenarios on both sides', async () => {
    const l = await toBuilt();
    const b = (await loop.loadLoop(l.id))!;
    await getDb().customSkills.put({ ...b.skill!, scenarios: b.skill!.scenarios.filter((s) => s.expected === 'activate') });
    await expect(loop.freezeV1(l.id)).rejects.toThrow(/negative trigger scenarios/);
    await getDb().customSkills.put({ ...b.skill!, name: 'Bad Name!' });
    await expect(loop.freezeV1(l.id)).rejects.toThrow(/validation error/);
  });
});

/** Run the whole dev phase. `baselineV`/`v1V` map caseId → verdict. */
async function devPhase(baselineV: (id: string) => string, v1V: (id: string) => string, v1Checklist: string[] | null = null) {
  const l = await toBuilt();
  for (const id of DEV) await rec(l.id, 'dev', 'baseline', id, baselineV(id), []);
  await loop.freezeV1(l.id);
  for (const id of DEV) await rec(l.id, 'dev', 'v1', id, v1V(id), v1Checklist, { skillActivated: true });
  return l;
}

describe('evaluation and grading', () => {
  it('hides ground truth until graded, then grades by comparing the self-reported verdict with simulation truth', async () => {
    const l = await devPhase(() => 'approve', truthOf);
    let b = (await loop.loadLoop(l.id))!;
    expect(b.dev!.runs.every((r) => r.gradedTruth === null && r.successMet === null)).toBe(true);
    expect(caseMatrix(b.dev, M, M.devCases, false).every((r) => r.truth === null)).toBe(true);
    await loop.gradeDevSet(l.id);
    b = (await loop.loadLoop(l.id))!;
    expect(b.loop.devGradedAt).not.toBeNull();
    for (const r of b.dev!.runs) {
      expect(r.gradedTruth).toBe(truthOf(r.caseId!));
      expect(r.successMet).toBe(r.verdict === truthOf(r.caseId!));
    }
    const stats = matchStats(b.dev, DEV);
    const base = stats.find((s) => s.conditionId === l.conditionIds.baseline)!;
    const v1 = stats.find((s) => s.conditionId === b.loop.conditionIds.v1)!;
    expect(v1.matched).toBe(DEV.length);
    expect(base.matched).toBe(DEV.filter((id) => truthOf(id) === 'approve').length);
    expect(base.matched).toBeLessThan(DEV.length);
  });

  it('an unclear verdict is graded as a mismatch', async () => {
    const l = await toBuilt();
    await rec(l.id, 'dev', 'baseline', DEV[0]!, 'unclear');
    await loop.gradeDevSet(l.id);
    const run = (await loop.loadLoop(l.id))!.dev!.runs[0]!;
    expect(run.successMet).toBe(false);
    expect(run.gradedTruth).toBe(truthOf(DEV[0]!));
  });

  it('gradeExperimentRuns leaves runs without a verdict or caseId untouched', () => {
    const run = { id: 'r', conditionId: 'c', index: 1, recordedAt: '', testsPassed: null, testsTotal: null, testsProvenance: 'self-reported' as const, successMet: null, seededFound: null, caseId: null, verdict: null, gradedTruth: null, skillActivated: null, metrics: {}, rubric: {}, observations: '' };
    const out = gradeExperimentRuns({ runs: [run] } as never, M.truth);
    expect(out.runs[0]).toEqual(run);
  });

  it('suggests failure patterns only from the learner\'s own recorded data', async () => {
    // v1 runs recorded with only one checklist item met in every run and the Skill not activating once
    const l = await devPhase(() => 'approve', () => 'approve', ['ran-sim']);
    await rec(l.id, 'dev', 'v1', DEV[0]!, 'approve', ['ran-sim'], { skillActivated: false });
    const b = (await loop.loadLoop(l.id))!;
    const sig = failureSignals(loop.toContext(b));
    const ids = sig.map((s) => s.patternId);
    expect(ids).toContain('trigger-narrow');
    expect(ids).toContain('missing-verification');
    for (const s of sig) expect(s.evidence).toMatch(/\d/);
    // no recorded checklist at all -> no checklist-derived suggestions
    const empty = await toBuilt();
    expect(failureSignals(loop.toContext((await loop.loadLoop(empty.id))!))).toEqual([]);
  });
});

describe('improvement gate', () => {
  const input = { patternIds: ['missing-verification'], hypothesis: 'Requiring a simulation run before any verdict will raise verdict accuracy.', expectedChange: 'More verdicts match the simulation' };

  it('requires a pattern, a hypothesis, a measurable change, and an actual edit', async () => {
    const l = await devPhase(() => 'approve', truthOf);
    await loop.gradeDevSet(l.id);
    const b = (await loop.loadLoop(l.id))!;
    expect(improvementRequirements(b.loop, b.skill, { patternIds: [], hypothesis: 'x', expectedChange: '' }).filter((r) => !r.ok).map((r) => r.id)).toEqual(expect.arrayContaining(['pattern', 'hyp', 'exp', 'changed']));
    await expect(loop.saveImprovement(l.id, input)).rejects.toThrow(/differs from v1/);
  });

  it('after a real edit it snapshots v2, adds the v2 condition, and creates the held-out experiment with different fixture and hash', async () => {
    const l = await devPhase(() => 'approve', truthOf);
    await loop.gradeDevSet(l.id);
    let b = (await loop.loadLoop(l.id))!;
    const c = contentOf(b.skill!);
    await getDb().customSkills.put({ ...b.skill!, instructions: c.instructions + '\n5. Run the simulation first and quote its output before any verdict.' });
    await loop.saveImprovement(l.id, input);
    b = (await loop.loadLoop(l.id))!;
    expect(b.loop.improvement!.patternIds).toEqual(['missing-verification']);
    expect(b.dev!.conditions.map((x) => x.kind)).toEqual(['no-skill', 'skill', 'custom-revised']);
    expect(b.heldout!.phase).toBe('heldout');
    expect(b.heldout!.fixture.id).not.toBe(b.dev!.fixture.id);
    expect(b.heldout!.fixture.hash).not.toBe(b.dev!.fixture.hash);
    expect(b.heldout!.conditions).toHaveLength(2);
    const d = loop.v1v2Diff(b)!;
    expect(d.identical).toBe(false);
    expect(d.bodyAdded).toBeGreaterThan(0);
    await expect(loop.saveImprovement(l.id, input)).rejects.toThrow(/already saved/);
    // the frozen v1 snapshot is untouched by later edits
    const v1 = loop.revisionOf(b.skill, b.loop.v1!.revisionId)!;
    expect(v1.snapshot.instructions).toBe(c.instructions);
  });
});

async function fullLoop(heldV1: (id: string) => string, heldV2: (id: string) => string) {
  const l = await devPhase(() => 'approve', truthOf);
  await loop.gradeDevSet(l.id);
  const b = (await loop.loadLoop(l.id))!;
  await getDb().customSkills.put({ ...b.skill!, instructions: contentOf(b.skill!).instructions + '\n5. Run the simulation first and quote its output before any verdict.' });
  await loop.saveImprovement(l.id, { patternIds: ['missing-verification'], hypothesis: 'Requiring a simulation run before any verdict will raise verdict accuracy.', expectedChange: 'More verdicts match the simulation' });
  for (const id of HELD) {
    await rec(l.id, 'heldout', 'v1', id, heldV1(id));
    await rec(l.id, 'heldout', 'v2', id, heldV2(id));
  }
  return l;
}

describe('held-out test', () => {
  it('stays hidden and unreadable until every case is recorded for both conditions', async () => {
    const l = await devPhase(() => 'approve', truthOf);
    await loop.gradeDevSet(l.id);
    const b0 = (await loop.loadLoop(l.id))!;
    await getDb().customSkills.put({ ...b0.skill!, instructions: contentOf(b0.skill!).instructions + '\nMore.' });
    await loop.saveImprovement(l.id, { patternIds: ['missing-verification'], hypothesis: 'Requiring a simulation run before any verdict.', expectedChange: 'More matches' });
    await rec(l.id, 'heldout', 'v1', HELD[0]!, 'approve');
    await expect(loop.revealHeldout(l.id)).rejects.toThrow(/missing held-out cases/);
    const b = (await loop.loadLoop(l.id))!;
    expect(heldoutReady(loop.toContext(b)).ready).toBe(false);
    expect(b.heldout!.runs.every((r) => r.gradedTruth === null && r.successMet === null)).toBe(true);
    expect(caseMatrix(b.heldout, M, M.heldoutCases, false).every((r) => r.truth === null)).toBe(true);
  });

  it('reveal grades, locks the runs, and rejects later edits', async () => {
    const l = await fullLoop(() => 'approve', truthOf);
    await loop.revealHeldout(l.id);
    const b = (await loop.loadLoop(l.id))!;
    expect(b.loop.heldoutRevealedAt).not.toBeNull();
    expect(b.heldout!.runsLockedAt).not.toBeNull();
    const stats = matchStats(b.heldout, HELD);
    expect(stats.find((s) => s.conditionId === b.loop.heldoutConditionIds.v2)!.matched).toBe(HELD.length);
    await expect(rec(l.id, 'heldout', 'v2', HELD[0]!, 'reject')).rejects.toThrow(/locked/);
  });

  it('reports a regression honestly when v2 does worse than v1', async () => {
    const l = await fullLoop(truthOf, () => 'approve');
    await loop.revealHeldout(l.id);
    const b = (await loop.loadLoop(l.id))!;
    expect(heldoutReading(b).join(' ')).toMatch(/FEWER/);
  });

  it('never claims a general improvement even when v2 wins', async () => {
    const l = await fullLoop(() => 'approve', truthOf);
    await loop.revealHeldout(l.id);
    const text = heldoutReading((await loop.loadLoop(l.id))!).join(' ');
    expect(text).toMatch(/directional observation, not evidence of a general improvement/);
  });
});

describe('graduation and report', () => {
  it('requires reveal, validation and both reflections', async () => {
    const l = await fullLoop(() => 'approve', truthOf);
    let b = (await loop.loadLoop(l.id))!;
    expect(graduationRequirements(loop.toContext(b)).filter((r) => !r.ok).map((r) => r.id)).toEqual(expect.arrayContaining(['heldout', 'lessons', 'application']));
    await loop.revealHeldout(l.id);
    await expect(loop.graduateLoop(l.id)).rejects.toThrow(/Not ready/);
    await loop.saveReflection(l.id, { lessons: 'A broad trigger made the baseline look as good as the Skill on easy cases.', application: 'I will add a held-out set to every Skill I tune from now on.' });
    await loop.graduateLoop(l.id);
    b = (await loop.loadLoop(l.id))!;
    expect(b.loop.status).toBe('graduated');
    expect(b.loop.graduatedAt).not.toBeNull();
  });

  it('the report contains problem, both Skill versions, a diff, hypothesis, results, limitations and reflection - and stays honest', async () => {
    const l = await fullLoop(() => 'approve', truthOf);
    // report BEFORE reveal must not leak held-out truth
    let md = buildLoopReportMarkdown((await loop.loadLoop(l.id))!);
    expect(md).toContain('The held-out test was not completed');
    for (const id of HELD) expect(md).not.toContain(`| ${M.heldoutCases.find((c) => c.id === id)!.title} | ${truthOf(id)} |`);
    await loop.revealHeldout(l.id);
    await loop.saveReflection(l.id, { lessons: 'Lessons learned go here and are long enough.', application: 'Application to a real project goes here and is long enough.' });
    md = buildLoopReportMarkdown((await loop.loadLoop(l.id))!);
    for (const must of ['## 1. The problem', '## 3. Skill v1', '## 5. Hypothesis and revision', '```diff', 'Skill v2', '## 6. Held-out test', '## 7. Limitations', 'Lessons learned go here', 'Application to a real project', 'self-reported', 'tested on a synthetic fixture only', 'not "field-proven"']) expect(md).toContain(must);
    expect(md).not.toMatch(/\bNaN\b|undefined/);
    // metrics never recorded stay "unknown" (never 0)
    expect(md).not.toMatch(/Tokens used \| 0/);
    const json = JSON.parse(buildLoopReportJson((await loop.loadLoop(l.id))!));
    expect(json.format).toBe('claude-forge-skill-improvement-report');
    expect(json.skills.v1).toBeTruthy();
    expect(json.skills.v2).toBeTruthy();
    expect(json.diff.identical).toBe(false);
    expect(json.experiments).toHaveLength(2);
  });
});

describe('persistence safety', () => {
  it('loops survive a backup round-trip and a malformed loop is rejected', async () => {
    const l = await fullLoop(() => 'approve', truthOf);
    await loop.revealHeldout(l.id);
    const text = serializeBackup(await exportAll());
    const parsed = parseBackup(text);
    expect(parsed.preview.ok).toBe(true);
    expect(parsed.preview.counts.loops).toBe(1);
    const db2 = new ForgeDB(`loop-restore-${Math.random().toString(36).slice(2)}`);
    setDbForTesting(db2);
    await db2.open();
    await applyImport(parsed.valid!, 'replace');
    const b = (await loop.loadLoop(l.id))!;
    expect(b.loop.heldoutRevealedAt).not.toBeNull();
    expect(b.heldout!.runsLockedAt).not.toBeNull();

    const broken = JSON.parse(text);
    broken.data.loops[0].status = 'weird';
    const bad = parseBackup(JSON.stringify(broken));
    expect(bad.preview.ok).toBe(false);
    expect(bad.preview.invalid.some((i) => i.store === 'loops')).toBe(true);
    expect(bad.valid!.loops).toHaveLength(0);
    expect(LoopRunSchema.safeParse({ id: '' }).success).toBe(false);
  });

  it('upgrades a v2 database to v3: loops store appears, experiments/runs gain null loop fields, existing data is kept', async () => {
    const name = `loop-migrate-${Math.random().toString(36).slice(2)}`;
    const old = new Dexie(name);
    old.version(2).stores({
      profile: 'id', preferences: 'id', lessonProgress: 'lessonId', attempts: 'id, lessonId, stage, submittedAt, [lessonId+stage]', competencies: 'competencyId', reviews: 'lessonId, dueOn',
      annotations: 'entryId', arsenal: 'entryId, status', customSkills: 'id, updatedAt', experiments: 'id, updatedAt, status', evidence: 'id, experimentId', fieldEvidence: 'id, entryId, createdAt', meta: 'key',
    });
    await old.open();
    await old.table('experiments').put({
      id: 'e1', schemaVersion: 1, title: 'Old', problem: '', hypothesis: 'h', fixture: { id: 'custom', label: 'x', version: '', hash: null }, successCriteria: [], prompt: '', environment: {}, plannedMeasures: [], plannedRuns: 3, rubricLockedAt: null,
      conditions: [{ id: 'c1', label: 'A', kind: 'no-skill', skillName: '', skillVersion: '', difference: '' }],
      runs: [{ id: 'r1', conditionId: 'c1', index: 1, recordedAt: 't', testsPassed: 2, testsTotal: 4, testsProvenance: 'self-reported', successMet: true, seededFound: null, metrics: {}, rubric: {}, observations: 'kept' }],
      observations: '', conclusion: '', limitations: '', status: 'recording', synthetic: false, skillLinks: [], createdAt: 't', updatedAt: 't',
    });
    old.close();
    const db = new ForgeDB(name);
    setDbForTesting(db);
    await db.open();
    expect(db.verno).toBe(DB_VERSION);
    const e = (await db.experiments.get('e1'))! as unknown as Record<string, unknown> & { runs: Record<string, unknown>[] };
    expect(e.loopId).toBeNull();
    expect(e.phase).toBeNull();
    expect(e.runsLockedAt).toBeNull();
    expect(e.runs[0]).toMatchObject({ caseId: null, verdict: null, gradedTruth: null, skillActivated: null, observations: 'kept', testsPassed: 2, successMet: true });
    expect(await db.loops.count()).toBe(0);
  });
});

describe('truth is independent of the Skill', () => {
  it('truthFor matches the mission truth function for every case', () => {
    for (const p of ALL_PROPOSALS) expect(truthFor(p).verdict).toBe(M.truth(p.id)!.verdict);
  });
});

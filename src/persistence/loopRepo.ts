import { getDb } from './db';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';
import { ExperimentSchema, type Evidence, type Experiment, type Run, RunSchema } from '@/domain/experiments/model';
import { LoopRunSchema, type LoopRun } from '@/domain/loop/model';
import { contentOf, SkillDraftSchema, type SkillDraft } from '@/domain/skills/model';
import { diffSkills } from '@/domain/skills/diff';
import { freezeRequirements, gradeExperimentRuns, heldoutReady, improvementRequirements, graduationRequirements, type ImprovementInput, type LoopContext } from '@/domain/loop/engine';
import { getMission } from '@/content/missions';
import type { LoopMission } from '@/domain/loop/types';
import { fixtureHash, getFixture, type FixtureId } from '@/fixtures';
import { snapshotRevision } from './repo';

const mustMission = (id: string): LoopMission => {
  const m = getMission(id);
  if (!m) throw new Error(`Unknown mission ${id}`);
  return m;
};

export interface LoopBundle {
  loop: LoopRun;
  mission: LoopMission;
  skill: SkillDraft | null;
  dev: Experiment | null;
  heldout: Experiment | null;
  evidence: Evidence[];
}

export function toContext(b: LoopBundle): LoopContext {
  return { loop: b.loop, mission: b.mission, skill: b.skill, dev: b.dev, heldout: b.heldout };
}

export async function loadLoop(loopId: string): Promise<LoopBundle | null> {
  const db = getDb();
  const loop = await db.loops.get(loopId);
  if (!loop) return null;
  const mission = getMission(loop.missionId);
  if (!mission) return null;
  const [skill, dev, heldout, evidence] = await Promise.all([
    loop.skillId ? db.customSkills.get(loop.skillId) : undefined,
    db.experiments.get(loop.devExperimentId),
    loop.heldoutExperimentId ? db.experiments.get(loop.heldoutExperimentId) : undefined,
    db.evidence.filter((e) => e.experimentId === loop.devExperimentId || e.experimentId === loop.heldoutExperimentId).toArray(),
  ]);
  return { loop, mission, skill: skill ?? null, dev: dev ?? null, heldout: heldout ?? null, evidence };
}

async function saveLoop(loop: LoopRun): Promise<LoopRun> {
  const next = { ...loop, updatedAt: nowIso() };
  await getDb().loops.put(next);
  return next;
}

function baseExperiment(mission: LoopMission, phase: 'dev' | 'heldout', loopId: string, hash: string | null, conditions: Experiment['conditions']): Experiment {
  const now = nowIso();
  const fixtureId = phase === 'dev' ? mission.fixture.devId : mission.fixture.heldoutId;
  const fx = getFixture(fixtureId);
  return ExperimentSchema.parse({
    id: newId('exp'),
    title: `Loop: ${mission.title} - ${phase === 'dev' ? 'development set' : 'held-out set'}`,
    problem: mission.targetOutcome,
    hypothesis:
      phase === 'dev'
        ? 'Skill-assisted reviews will match the simulation ground truth more often than baseline reviews on the same proposals, and will more consistently run the simulation and reason from affordability.'
        : 'A revised Skill that fixes the failure patterns found on the development set will also help on proposals it was not tuned against.',
    fixture: { id: fixtureId, label: fx?.label ?? fixtureId, version: fx?.version ?? '1', hash },
    successCriteria: phase === 'dev' ? mission.successCriteria.slice(0, 2) : ['Held-out verdict match is at least as high as v1', 'No regression in checklist items'],
    prompt: 'Per-case prompts are listed in the Skill Improvement Loop and are identical for every condition. Every value is self-reported; the verdict match is graded by Forge against simulation ground truth.',
    plannedMeasures: ['successRate', 'seededIssuesFound', 'reworkRounds', 'interventions', 'runtimeSec', 'tokens'],
    plannedRuns: phase === 'dev' ? mission.devCases.length : mission.heldoutCases.length,
    conditions,
    runs: [],
    status: 'recording',
    loopId,
    phase,
    createdAt: now,
    updatedAt: now,
  });
}

/* ------------------------------------------------------------------ start */

export async function startLoop(missionId: string): Promise<LoopRun> {
  const mission = mustMission(missionId);
  const db = getDb();
  const hash = await fixtureHash(mission.fixture.devId as FixtureId);
  const loopId = newId('loop');
  const baselineId = newId('cond');
  const dev = baseExperiment(mission, 'dev', loopId, hash, [{ id: baselineId, label: 'A · Baseline', kind: 'no-skill', skillName: '', skillVersion: '', difference: 'Baseline: Claude Code without the Skill' }]);
  const now = nowIso();
  const loop = LoopRunSchema.parse({
    id: loopId,
    missionId: mission.id,
    missionVersion: mission.version,
    devExperimentId: dev.id,
    conditionIds: { baseline: baselineId, v1: null, v2: null },
    createdAt: now,
    updatedAt: now,
  });
  await db.transaction('rw', db.loops, db.experiments, async () => {
    await db.experiments.put(dev);
    await db.loops.put(loop);
  });
  return loop;
}

/**
 * Delete a loop record and its two experiments (with their evidence). The Skill draft and its revisions are the
 * learner's work and are KEPT.
 */
export async function deleteLoop(loopId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.loops, db.experiments, db.evidence], async () => {
    const loop = await db.loops.get(loopId);
    if (!loop) return;
    for (const expId of [loop.devExperimentId, loop.heldoutExperimentId]) {
      if (!expId) continue;
      const ev = await db.evidence.where('experimentId').equals(expId).primaryKeys();
      await db.evidence.bulkDelete(ev);
      await db.experiments.delete(expId);
    }
    await db.loops.delete(loopId);
  });
}

export async function abandonLoop(loopId: string): Promise<void> {
  const db = getDb();
  const loop = await db.loops.get(loopId);
  if (loop) await saveLoop({ ...loop, status: 'abandoned' });
}

/* ------------------------------------------------------------------ build */

export async function createLoopSkill(loopId: string): Promise<SkillDraft> {
  const db = getDb();
  return db.transaction('rw', db.loops, db.customSkills, async () => {
    const loop = await db.loops.get(loopId);
    if (!loop) throw new Error('Loop not found');
    if (loop.skillId) {
      const existing = await db.customSkills.get(loop.skillId);
      if (existing) return existing;
    }
    const mission = mustMission(loop.missionId);
    const now = nowIso();
    const draft = SkillDraftSchema.parse({ ...mission.starter(), id: newId('skill'), createdAt: now, updatedAt: now });
    await db.customSkills.put(draft);
    await db.loops.put({ ...loop, skillId: draft.id, updatedAt: now });
    return draft;
  });
}

export async function freezeV1(loopId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.loops, db.customSkills, db.experiments, async () => {
    const loop = await db.loops.get(loopId);
    if (!loop) throw new Error('Loop not found');
    if (loop.v1) throw new Error('v1 is already frozen');
    const skill = loop.skillId ? await db.customSkills.get(loop.skillId) : undefined;
    const reqs = freezeRequirements(skill ?? null);
    const unmet = reqs.filter((r) => !r.ok);
    if (unmet.length) throw new Error(`Not ready to freeze: ${unmet.map((u) => u.text).join('; ')}`);
    const label = 'v1 (loop baseline)';
    const rev = snapshotRevision(skill!, label);
    const savedSkill = { ...skill!, revisions: [...skill!.revisions, rev], updatedAt: nowIso() };
    await db.customSkills.put(savedSkill);
    const dev = (await db.experiments.get(loop.devExperimentId))!;
    const v1Cond = newId('cond');
    await db.experiments.put({
      ...dev,
      conditions: [...dev.conditions, { id: v1Cond, label: 'B · Skill v1', kind: 'skill', skillName: skill!.name, skillVersion: `${label} · ${rev.id.slice(-6)}`, difference: `${skill!.name} Skill v1 installed in the fixture's .claude/skills; nothing else differs` }],
      updatedAt: nowIso(),
    });
    await db.loops.put({ ...loop, conditionIds: { ...loop.conditionIds, v1: v1Cond }, v1: { revisionId: rev.id, label, frozenAt: nowIso() }, updatedAt: nowIso() });
  });
}

/* ------------------------------------------------------------------ runs */

export type ConditionKey = 'baseline' | 'v1' | 'v2';

export interface CaseRunInput {
  loopId: string;
  phase: 'dev' | 'heldout';
  condition: ConditionKey;
  caseId: string;
  verdict: string;
  /** Checklist item ids the answer satisfied. null = not assessed. */
  checklist: string[] | null;
  skillActivated: boolean | null;
  reworkRounds: number | null;
  interventions: number | null;
  runtimeSec: number | null;
  tokens: number | null;
  observations: string;
  evidenceText: string;
}

export async function recordCaseRun(input: CaseRunInput): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.loops, db.experiments, db.evidence, async () => {
    const loop = await db.loops.get(input.loopId);
    if (!loop) throw new Error('Loop not found');
    const mission = mustMission(loop.missionId);
    const expId = input.phase === 'dev' ? loop.devExperimentId : loop.heldoutExperimentId;
    if (!expId) throw new Error('This phase has no experiment yet');
    const exp = await db.experiments.get(expId);
    if (!exp) throw new Error('Experiment not found');
    if (exp.runsLockedAt) throw new Error('These runs are locked: the ground truth has been revealed, so results can no longer be edited.');
    const conditionId = input.phase === 'dev' ? loop.conditionIds[input.condition] : input.condition === 'v1' ? loop.heldoutConditionIds.v1 : input.condition === 'v2' ? loop.heldoutConditionIds.v2 : null;
    if (!conditionId) throw new Error('That condition does not exist yet. Finish the previous step first.');
    const cases = input.phase === 'dev' ? mission.devCases : mission.heldoutCases;
    const caseIndex = cases.findIndex((c) => c.id === input.caseId);
    if (caseIndex < 0) throw new Error(`Unknown case ${input.caseId}`);
    const existing = exp.runs.find((r) => r.conditionId === conditionId && r.caseId === input.caseId);
    const metrics: Run['metrics'] = {};
    const put = (k: string, v: number | null) => { if (v !== null) metrics[k] = { value: v, provenance: 'self-reported' }; };
    put('reworkRounds', input.reworkRounds);
    put('interventions', input.interventions);
    put('runtimeSec', input.runtimeSec);
    put('tokens', input.tokens);
    let run: Run = RunSchema.parse({
      id: existing?.id ?? newId('run'),
      conditionId,
      index: caseIndex + 1,
      recordedAt: existing?.recordedAt ?? nowIso(),
      caseId: input.caseId,
      verdict: input.verdict,
      seededFound: input.checklist,
      skillActivated: input.skillActivated,
      metrics,
      observations: input.observations.slice(0, 4000),
    });
    // Dev ground truth is visible after grading; keep grading consistent if the learner corrects a run later.
    if (input.phase === 'dev' && loop.devGradedAt) run = gradeExperimentRuns({ ...exp, runs: [run] }, mission.truth).runs[0]!;
    const runs = [...exp.runs.filter((r) => r.id !== run.id), run];
    await db.experiments.put({ ...exp, runs, rubricLockedAt: exp.rubricLockedAt ?? nowIso(), updatedAt: nowIso() });
    if (input.evidenceText.trim()) {
      const text = input.evidenceText.slice(0, 500_000);
      const old = await db.evidence.where('experimentId').equals(exp.id).filter((e) => e.runId === run.id && e.kind === 'pasted-output').toArray();
      for (const o of old) await db.evidence.delete(o.id);
      await db.evidence.put({ id: newId('ev'), experimentId: exp.id, runId: run.id, kind: 'pasted-output', name: `${input.caseId} · ${input.condition} final answer`, mime: 'text/plain', size: new TextEncoder().encode(text).length, text, provenance: 'self-reported', classification: null, meta: {}, addedAt: nowIso() });
    }
    await db.loops.put({ ...loop, updatedAt: nowIso() });
  });
}

/* --------------------------------------------------------------- evaluate */

export async function gradeDevSet(loopId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.loops, db.experiments, async () => {
    const loop = await db.loops.get(loopId);
    if (!loop) throw new Error('Loop not found');
    const mission = mustMission(loop.missionId);
    const dev = await db.experiments.get(loop.devExperimentId);
    if (!dev) throw new Error('Experiment not found');
    await db.experiments.put({ ...gradeExperimentRuns(dev, mission.truth), updatedAt: nowIso() });
    await db.loops.put({ ...loop, devGradedAt: loop.devGradedAt ?? nowIso(), updatedAt: nowIso() });
  });
}

/* ---------------------------------------------------------------- improve */

export async function saveImprovement(loopId: string, input: ImprovementInput): Promise<void> {
  const db = getDb();
  // Hashing uses WebCrypto (a non-Dexie promise); it must finish before the transaction opens.
  const pre = await db.loops.get(loopId);
  if (!pre) throw new Error('Loop not found');
  const heldHash = await fixtureHash(mustMission(pre.missionId).fixture.heldoutId as FixtureId);
  await db.transaction('rw', db.loops, db.customSkills, db.experiments, async () => {
    const loop = await db.loops.get(loopId);
    if (!loop) throw new Error('Loop not found');
    if (loop.improvement) throw new Error('The improvement is already saved');
    const mission = mustMission(loop.missionId);
    const skill = loop.skillId ? await db.customSkills.get(loop.skillId) : undefined;
    const reqs = improvementRequirements(loop, skill ?? null, input);
    const unmet = reqs.filter((r) => !r.ok);
    if (unmet.length) throw new Error(`Not ready: ${unmet.map((u) => u.text).join('; ')}`);
    const label = 'v2 (revision)';
    const rev = snapshotRevision(skill!, label);
    await db.customSkills.put({ ...skill!, revisions: [...skill!.revisions, rev], updatedAt: nowIso() });

    const dev = (await db.experiments.get(loop.devExperimentId))!;
    const v2Cond = newId('cond');
    await db.experiments.put({
      ...dev,
      conditions: [...dev.conditions, { id: v2Cond, label: 'C · Skill v2', kind: 'custom-revised', skillName: skill!.name, skillVersion: `${label} · ${rev.id.slice(-6)}`, difference: `Revised after observing: ${input.patternIds.join(', ')}. Hypothesis: ${input.hypothesis.slice(0, 200)}` }],
      updatedAt: nowIso(),
    });

    const hv1 = newId('cond');
    const hv2 = newId('cond');
    const held = baseExperiment(mission, 'heldout', loopId, heldHash, [
      { id: hv1, label: 'B · Skill v1', kind: 'skill', skillName: skill!.name, skillVersion: loop.v1?.label ?? 'v1', difference: 'Skill v1 (as frozen at the end of Build)' },
      { id: hv2, label: 'C · Skill v2', kind: 'custom-revised', skillName: skill!.name, skillVersion: label, difference: 'Skill v2: the only difference from v1 is your revision' },
    ]);
    await db.experiments.put(held);
    await db.loops.put({
      ...loop,
      conditionIds: { ...loop.conditionIds, v2: v2Cond },
      heldoutExperimentId: held.id,
      heldoutConditionIds: { v1: hv1, v2: hv2 },
      improvement: { patternIds: input.patternIds, hypothesis: input.hypothesis.trim(), expectedChange: input.expectedChange.trim(), v2RevisionId: rev.id, v2Label: label, savedAt: nowIso() },
      updatedAt: nowIso(),
    });
  });
}

/* --------------------------------------------------------------- held-out */

export async function revealHeldout(loopId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.loops, db.experiments, db.customSkills, db.evidence], async () => {
    const b = await loadLoopInTx(loopId);
    const ready = heldoutReady(toContext(b));
    if (!ready.ready) throw new Error(ready.missing.join('; '));
    if (!b.heldout) throw new Error('No held-out experiment');
    const graded = gradeExperimentRuns(b.heldout, b.mission.truth);
    await db.experiments.put({ ...graded, runsLockedAt: nowIso(), status: 'concluded', updatedAt: nowIso() });
    await db.loops.put({ ...b.loop, heldoutRevealedAt: nowIso(), updatedAt: nowIso() });
  });
}

async function loadLoopInTx(loopId: string): Promise<LoopBundle> {
  const b = await loadLoop(loopId);
  if (!b) throw new Error('Loop not found');
  return b;
}

/* -------------------------------------------------------------- graduate */

export async function saveReflection(loopId: string, input: { lessons: string; application: string }): Promise<void> {
  const loop = await getDb().loops.get(loopId);
  if (!loop) throw new Error('Loop not found');
  await saveLoop({ ...loop, reflection: { lessons: input.lessons.slice(0, 4000), application: input.application.slice(0, 4000), updatedAt: nowIso() } });
}

export async function graduateLoop(loopId: string): Promise<void> {
  const b = await loadLoopInTx(loopId);
  const unmet = graduationRequirements(toContext(b)).filter((r) => !r.ok);
  if (unmet.length) throw new Error(`Not ready to graduate: ${unmet.map((u) => u.text).join('; ')}`);
  await saveLoop({ ...b.loop, status: 'graduated', graduatedAt: nowIso() });
}

export function revisionOf(skill: SkillDraft | null, id: string | undefined) {
  return skill?.revisions.find((r) => r.id === id);
}

export function v1v2Diff(b: LoopBundle) {
  const v1 = revisionOf(b.skill, b.loop.v1?.revisionId);
  const v2 = revisionOf(b.skill, b.loop.improvement?.v2RevisionId);
  return v1 && v2 ? diffSkills(v1.snapshot, v2.snapshot) : null;
}

export { contentOf };

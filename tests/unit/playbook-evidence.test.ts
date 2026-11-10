import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForgeDB, setDbForTesting, DB_VERSION } from '@/persistence/db';
import * as repo from '@/persistence/repo';
import { applyImport, exportAll, parseBackup, serializeBackup } from '@/persistence/backup';
import { ExperimentSchema, type Experiment } from '@/domain/experiments/model';
import { DEMO_EXPERIMENT } from '@/domain/experiments/demo';
import { PlaybookSchema, type Playbook } from '@/domain/playbook/model';
import { fromTemplate, newPlaybook } from '@/domain/playbook/ops';
import {
  buildEvaluation, createEvidenceLink, effectiveStepStatus, experimentFingerprint, linkCurrency, playbookMaturity, reassessLink, reviewLink, snapshotExperiment,
  stepEvidence, stepFingerprint, suitability, withVerification,
} from '@/domain/playbook/evidence';
import { PLAYBOOK_TEMPLATES } from '@/content/playbook/seeds';
import { newId } from '@/lib/ids';
import { setClockOffsetDays } from '@/lib/clock';

const T0 = '2026-11-05T10:00:00.000Z';
const T1 = '2026-11-06T10:00:00.000Z';
let k = 0;
const sid = () => `st-${++k}`;

type RunSpec = { cond: string; i: number; rework: number | null };
function experiment(id: string, runs: RunSpec[], over: Partial<Record<string, unknown>> = {}): Experiment {
  return ExperimentSchema.parse({
    id, title: 'Gated workflow vs one prompt', experimentType: 'workflow', subject: 'Does the gate help?', hypothesis: 'The gated workflow needs fewer rework rounds.',
    fixture: { id: 'custom', label: 'twelve bugs from my repository history', version: '1', hash: null }, successCriteria: ['Fewer rework rounds'], plannedMeasures: ['reworkRounds'], plannedRuns: 3, rubricLockedAt: T0,
    conditions: [{ id: 'cA', label: 'Single prompt', kind: 'baseline', difference: '' }, { id: 'cB', label: 'Gated workflow', kind: 'workflow', difference: 'Same task, split into steps with a check after each.' }],
    runs: runs.map((r) => ({ id: `${r.cond}-${r.i}`, conditionId: r.cond, index: r.i, recordedAt: T0, metrics: r.rework === null ? {} : { reworkRounds: { value: r.rework, provenance: 'self-reported' } } })),
    limitations: 'One repository, one model.', createdAt: T0, updatedAt: T0, ...over,
  });
}
const goodRuns: RunSpec[] = [{ cond: 'cA', i: 1, rework: 3 }, { cond: 'cA', i: 2, rework: 4 }, { cond: 'cB', i: 1, rework: 1 }, { cond: 'cB', i: 2, rework: 2 }];
const exps = (...e: Experiment[]) => new Map(e.map((x) => [x.id, x]));
const seed = (): Playbook => fromTemplate('pb', PLAYBOOK_TEMPLATES[0]!, sid, T0);

function supportedLink(pb: Playbook, stepIdx: number, e: Experiment) {
  const link = createEvidenceLink({ id: `l${stepIdx}`, playbook: pb, step: pb.steps[stepIdx]!, experiment: e, now: T0 });
  return reviewLink(link, { criteria: 'The step\'s gate is met if rework rounds do not exceed the baseline.', status: 'supports', claimedOutcome: 'met', reviewerNote: 'Gated workflow needed fewer rounds in both runs.', limitations: 'Two runs per condition on one repository.' }, T0);
}

describe('fingerprints detect real changes and ignore irrelevant ones', () => {
  it('a step fingerprint changes with its instruction, gate, failure handling or links but not with status or notes', () => {
    const s = seed().steps[0]!;
    const f = stepFingerprint(s);
    expect(stepFingerprint({ ...s, instruction: s.instruction + ' Also do X.' })).not.toBe(f);
    expect(stepFingerprint({ ...s, verification: 'something else entirely' })).not.toBe(f);
    expect(stepFingerprint({ ...s, humanApproval: !s.humanApproval })).not.toBe(f);
    expect(stepFingerprint({ ...s, status: 'done', verifiedNote: 'ran it' })).toBe(f);
    expect(stepFingerprint({ ...s, title: `  ${s.title}  ` })).toBe(f);
  });

  it('an experiment fingerprint changes when a run is added or edited, not when free-text observations change', () => {
    const e = experiment('e1', goodRuns);
    const f = experimentFingerprint(e);
    expect(experimentFingerprint({ ...e, observations: 'I felt it went well', conclusion: 'works' })).toBe(f);
    expect(experimentFingerprint(experiment('e1', [...goodRuns, { cond: 'cB', i: 3, rework: 1 }]))).not.toBe(f);
    expect(experimentFingerprint(experiment('e1', goodRuns.map((r) => (r.cond === 'cA' && r.i === 1 ? { ...r, rework: 9 } : r))))).not.toBe(f);
  });
});

describe('linking proves nothing until you judge it against criteria', () => {
  it('a fresh link is unreviewed and records what it linked: playbook version, step fingerprint, experiment snapshot, provenance', () => {
    const pb = seed();
    const e = experiment('e1', goodRuns);
    const link = createEvidenceLink({ id: 'l1', playbook: pb, step: pb.steps[1]!, experiment: e, now: T0 });
    expect(link.status).toBe('unreviewed');
    expect(link.playbookContentVersion).toBe(1);
    expect(link.stepFingerprint).toBe(stepFingerprint(pb.steps[1]!));
    expect(link.snapshot.runsFingerprint).toBe(experimentFingerprint(e));
    expect(link.snapshot.hasBaseline).toBe(true);
    expect(link.snapshot.conditions.map((c) => c.runsWithData)).toEqual([2, 2]);
    expect(link.provenance).toBe('self-reported');
    expect(link.snapshot.measures[0]!.perCondition.every((p) => p.unknown === 0 && p.n === 2)).toBe(true);
    const ev = stepEvidence(pb.steps[1]!, [link], exps(e));
    expect(ev.state).toBe('unreviewed');
    expect(playbookMaturity({ ...pb, evidenceLinks: [link] }, exps(e)).state).toBe('ready-to-test');
  });

  it('unknown stays unknown in the snapshot and provenance reflects mixed and missing data', () => {
    const e = experiment('e2', [...goodRuns, { cond: 'cB', i: 3, rework: null }]);
    const snap = snapshotExperiment(e);
    expect(snap.measures[0]!.perCondition.find((p) => p.label === 'Gated workflow')!.unknown).toBe(1);
    expect(createEvidenceLink({ id: 'l', playbook: seed(), step: seed().steps[0]!, experiment: experiment('e3', []), now: T0 }).provenance).toBe('unknown');
  });

  it('supported needs: a current link, suitable evidence, written criteria, a recorded judgement with a note, and stated limitations', () => {
    const pb = seed();
    const e = experiment('e1', goodRuns);
    const link = supportedLink(pb, 1, e);
    expect(suitability(link).every((c) => c.ok)).toBe(true);
    expect(stepEvidence(pb.steps[1]!, [link], exps(e)).state).toBe('supported');
    for (const missing of ['criteria', 'reviewerNote', 'limitations'] as const) {
      const weak = { ...link, [missing]: '' };
      expect(stepEvidence(pb.steps[1]!, [weak], exps(e)).state, missing).toBe('partly-supported');
    }
  });

  it('the synthetic demonstration, a missing baseline, or one run per condition can never support a step', () => {
    const pb = seed();
    const demo = ExperimentSchema.parse({ ...DEMO_EXPERIMENT });
    expect(stepEvidence(pb.steps[1]!, [supportedLink(pb, 1, demo)], exps(demo)).state).toBe('partly-supported');
    const noBase = experiment('nb', goodRuns, { conditions: [{ id: 'cA', label: 'A', kind: 'prompt', difference: 'x variant' }, { id: 'cB', label: 'B', kind: 'workflow', difference: 'y variant' }] });
    expect(stepEvidence(pb.steps[1]!, [supportedLink(pb, 1, noBase)], exps(noBase)).state).toBe('partly-supported');
    const one = experiment('one', [{ cond: 'cA', i: 1, rework: 3 }, { cond: 'cB', i: 1, rework: 1 }]);
    expect(stepEvidence(pb.steps[1]!, [supportedLink(pb, 1, one)], exps(one)).state).toBe('partly-supported');
  });

  it('a contradicting judgement outranks a supporting one, and an inconclusive one supports nothing', () => {
    const pb = seed();
    const e = experiment('e1', goodRuns);
    const e2 = experiment('e2', goodRuns);
    const sup = supportedLink(pb, 1, e);
    const con = reviewLink(createEvidenceLink({ id: 'lc', playbook: pb, step: pb.steps[1]!, experiment: e2, now: T0 }), { status: 'contradicts', reviewerNote: 'Failed on the held-out cases.' }, T0);
    expect(stepEvidence(pb.steps[1]!, [sup, con], exps(e, e2)).state).toBe('contradicted');
    const inc = reviewLink(createEvidenceLink({ id: 'li', playbook: pb, step: pb.steps[1]!, experiment: e, now: T0 }), { status: 'inconclusive', reviewerNote: 'Ranges overlap completely.' }, T0);
    expect(stepEvidence(pb.steps[1]!, [inc], exps(e)).state).toBe('inconclusive');
  });
});

describe('stale evidence never silently verifies a changed step', () => {
  it('changing the step makes the link stale and the step "needs reassessment"; maturity drops', () => {
    const pb = seed();
    const e = experiment('e1', goodRuns);
    const link = supportedLink(pb, 1, e);
    const supported = { ...pb, evidenceLinks: [link] };
    expect(stepEvidence(supported.steps[1]!, supported.evidenceLinks, exps(e)).state).toBe('supported');
    const edited = { ...supported, steps: supported.steps.map((s, i) => (i === 1 ? { ...s, verification: 'A completely different gate that nobody tested.' } : s)) };
    expect(linkCurrency(link, edited.steps[1], e)).toBe('step-changed');
    expect(stepEvidence(edited.steps[1]!, edited.evidenceLinks, exps(e)).state).toBe('needs-reassessment');
    expect(playbookMaturity(edited, exps(e)).staleLinks).toBe(1);
  });

  it('adding or editing runs in the experiment turns the link stale; deleting the experiment makes it missing; removing the step is detected', () => {
    const pb = seed();
    const e = experiment('e1', goodRuns);
    const link = supportedLink(pb, 1, e);
    expect(linkCurrency(link, pb.steps[1], e)).toBe('current');
    expect(linkCurrency(link, pb.steps[1], experiment('e1', [...goodRuns, { cond: 'cA', i: 3, rework: 0 }]))).toBe('experiment-changed');
    expect(linkCurrency(link, pb.steps[1], undefined)).toBe('experiment-missing');
    expect(linkCurrency(link, undefined, e)).toBe('step-removed');
  });

  it('reassessing re-snapshots, blanks the judgement and keeps the old review in history', () => {
    const pb = seed();
    const e = experiment('e1', goodRuns);
    const link = supportedLink(pb, 1, e);
    const changed = experiment('e1', [...goodRuns, { cond: 'cB', i: 3, rework: 5 }]);
    const re = reassessLink(link, pb.steps[1]!, changed, 3, T1);
    expect(re.status).toBe('unreviewed');
    expect(re.reviewerNote).toBe('');
    expect(re.playbookContentVersion).toBe(3);
    expect(re.history).toHaveLength(1);
    expect(re.history[0]).toMatchObject({ status: 'supports', note: expect.stringMatching(/fewer rounds/) });
    expect(linkCurrency(re, pb.steps[1], changed)).toBe('current');
    expect(stepEvidence(pb.steps[1]!, [re], exps(changed)).state).toBe('unreviewed');
  });

  it('a step marked verified is outdated once its wording changes, and re-confirming records the new wording', () => {
    const s = withVerification({ ...seed().steps[0]!, verifiedNote: 'Ran it twice and saw the file validate.' }, T0);
    expect(effectiveStepStatus(s)).toBe('verified');
    const edited = { ...s, instruction: s.instruction + ' (now also reads two files)' };
    expect(effectiveStepStatus(edited)).toBe('verification-outdated');
    expect(effectiveStepStatus(withVerification(edited, T1))).toBe('verified');
  });
});

describe('maturity is a transparent description, not a score', () => {
  it('climbs draft -> ready to test -> partially evaluated -> evaluated on fixtures, and real-work reports are separate', () => {
    const e = experiment('e1', goodRuns);
    const empty = newPlaybook('pb2', { title: 'Sketch', goal: 'A sketch with nothing in it yet.' }, undefined, T0);
    expect(playbookMaturity(empty, exps(e)).state).toBe('draft');

    let pb = seed();
    expect(playbookMaturity(pb, exps(e)).state).toBe('ready-to-test');

    pb = { ...pb, evidenceLinks: [supportedLink(pb, 0, e)] };
    const partial = playbookMaturity(pb, exps(e));
    expect(partial.state).toBe('partially-evaluated');
    expect(partial.supportedSteps).toBe(1);

    pb = { ...pb, evidenceLinks: pb.steps.map((_, i) => supportedLink(pb, i, e)) };
    const full = playbookMaturity(pb, exps(e));
    expect(full.state).toBe('evaluated-on-fixtures');
    expect(full.supportedSteps).toBe(full.gatedSteps);

    const applied = playbookMaturity({ ...pb, observedResults: [{ id: 'o', at: T1, outcome: 'worked', text: 'Used it on the March release notes; two gates caught a missing PR.' }] }, exps(e));
    expect(applied.state).toBe('applied-to-real-work');
    expect(applied.reasons.join(' ')).toMatch(/self-reported/);
    // a real-work report with no fixture evidence does not claim fixture evaluation
    const onlyReal = playbookMaturity({ ...seed(), observedResults: [{ id: 'o', at: T1, outcome: 'partly', text: 'Tried it once on a real export; step three failed.' }] }, exps(e));
    expect(onlyReal.state).toBe('applied-to-real-work');
    expect(onlyReal.supportedSteps).toBe(0);
  });

  it('a contradicted step prevents "evaluated on fixtures"', () => {
    const e = experiment('e1', goodRuns);
    let pb = seed();
    const links = pb.steps.map((_, i) => supportedLink(pb, i, e));
    links[2] = { ...links[2]!, status: 'contradicts' };
    pb = { ...pb, evidenceLinks: links };
    const m = playbookMaturity(pb, exps(e));
    expect(m.state).not.toBe('evaluated-on-fixtures');
    expect(m.contradictedSteps).toBe(1);
  });
});

describe('the versioned evaluation summary', () => {
  it('separates observed results, interpretation, limitations and the next experiment, and says nothing was run', () => {
    const e = experiment('e1', goodRuns);
    const pb0 = seed();
    const pb = { ...pb0, contentVersion: 3, evidenceLinks: [supportedLink(pb0, 0, e)] };
    const ev = buildEvaluation(pb, exps(e), 'ev1', T1, 'after gate fix');
    expect(ev.playbookContentVersion).toBe(3);
    expect(ev.maturity).toBe('partially-evaluated');
    for (const h of ['## Observed evidence', '## Interpretation', '## Limitations', '## Next experiment']) expect(ev.markdown).toContain(h);
    expect(ev.markdown).toMatch(/Claude Forge ran nothing/);
    expect(ev.markdown).toMatch(/content version 3/);
    expect(ev.markdown).toMatch(/Criteria you wrote/);
    expect(ev.limitations.join(' ')).toMatch(/cannot verify any value/);
    expect(ev.limitations.join(' ')).toMatch(/No evidence is linked for/);
    expect(ev.markdown).toMatch(/Link or run an experiment for/);
    expect(ev.markdown).not.toMatch(/proves|guarantee|significant/i);
  });

  it('stale links are called out in the summary and never counted', () => {
    const e = experiment('e1', goodRuns);
    const pb0 = seed();
    const link = supportedLink(pb0, 0, e);
    const changed = experiment('e1', [...goodRuns, { cond: 'cA', i: 3, rework: 9 }]);
    const ev = buildEvaluation({ ...pb0, evidenceLinks: [link] }, exps(changed), 'ev2', T1);
    expect(ev.steps[0]!.state).toBe('needs-reassessment');
    expect(ev.markdown).toMatch(/Reassess the stale links/);
    expect(ev.maturity).toBe('ready-to-test');
  });
});

/* ----------------------------------------------------------------------- persistence */

let n = 0;
async function freshDb() {
  const db = new ForgeDB(`pe-${++n}-${Math.random().toString(36).slice(2)}`);
  setDbForTesting(db);
  await db.open();
  return db;
}
beforeEach(() => setClockOffsetDays(0));

describe('persistence: content versions, linking, and nothing here touches mastery', () => {
  it('the content version rises with content changes only, and linking evidence does not raise it', async () => {
    const db = await freshDb();
    const pb = seed();
    await repo.savePlaybook(pb);
    expect((await db.playbooks.get('pb'))!.contentVersion).toBe(1);
    await repo.savePlaybook({ ...(await db.playbooks.get('pb'))!, notes: 'Same content, new wording of notes? no - notes ARE content.' });
    expect((await db.playbooks.get('pb'))!.contentVersion).toBe(2);
    const e = experiment('e1', goodRuns);
    await db.experiments.put(e);
    const r = await repo.linkExperimentToStep('pb', (await db.playbooks.get('pb'))!.steps[0]!.id, 'e1');
    expect(r.ok).toBe(true);
    const after = (await db.playbooks.get('pb'))!;
    expect(after.contentVersion).toBe(2);
    expect(after.evidenceLinks).toHaveLength(1);
    expect(after.evidenceLinks[0]!.playbookContentVersion).toBe(2);
    // saving the same content again is not a new version
    await repo.savePlaybook(after);
    expect((await db.playbooks.get('pb'))!.contentVersion).toBe(2);
    // a step edit is
    await repo.savePlaybook({ ...after, steps: after.steps.map((s, i) => (i === 0 ? { ...s, instruction: s.instruction + ' Extra.' } : s)) });
    const edited = (await db.playbooks.get('pb'))!;
    expect(edited.contentVersion).toBe(3);
    const ex = new Map([['e1', e]]);
    expect(stepEvidence(edited.steps[0]!, edited.evidenceLinks, ex).state).toBe('needs-reassessment');
  });

  it('refuses duplicate and dangling links without throwing', async () => {
    const db = await freshDb();
    await repo.savePlaybook(seed());
    await db.experiments.put(experiment('e1', goodRuns));
    const stepId = (await db.playbooks.get('pb'))!.steps[0]!.id;
    expect((await repo.linkExperimentToStep('pb', stepId, 'e1')).ok).toBe(true);
    expect(await repo.linkExperimentToStep('pb', stepId, 'e1')).toMatchObject({ ok: false, reason: expect.stringMatching(/already linked/) });
    expect(await repo.linkExperimentToStep('pb', 'nope', 'e1')).toMatchObject({ ok: false });
    expect(await repo.linkExperimentToStep('nope', stepId, 'e1')).toMatchObject({ ok: false });
    expect(await repo.linkExperimentToStep('pb', stepId, 'missing')).toMatchObject({ ok: false });
  });

  it('marking a step verified records its wording; later edits make the saved verification outdated', async () => {
    const db = await freshDb();
    const pb = seed();
    await repo.savePlaybook({ ...pb, steps: pb.steps.map((s, i) => (i === 0 ? { ...s, status: 'verified', verifiedNote: 'Ran the script on last week\'s export and saw it validate.' } : s)) });
    const saved = (await db.playbooks.get('pb'))!;
    expect(saved.steps[0]!.verifiedFingerprint).toBe(stepFingerprint(saved.steps[0]!));
    expect(effectiveStepStatus(saved.steps[0]!)).toBe('verified');
    await repo.savePlaybook({ ...saved, steps: saved.steps.map((s, i) => (i === 0 ? { ...s, verification: 'Changed gate wording.' } : s)) });
    expect(effectiveStepStatus((await db.playbooks.get('pb'))!.steps[0]!)).toBe('verification-outdated');
    // un-verifying clears the stored fingerprint
    const cur = (await db.playbooks.get('pb'))!;
    await repo.savePlaybook({ ...cur, steps: cur.steps.map((s, i) => (i === 0 ? { ...s, status: 'done' } : s)) });
    expect((await db.playbooks.get('pb'))!.steps[0]!.verifiedFingerprint).toBeNull();
  });

  it('playbooks, links, evaluations and maturity never create competency evidence', async () => {
    const db = await freshDb();
    const e = experiment('e1', goodRuns);
    await db.experiments.put(e);
    const pb = seed();
    await repo.savePlaybook({ ...pb, evidenceLinks: pb.steps.map((_, i) => supportedLink(pb, i, e)), evaluations: [buildEvaluation({ ...pb, evidenceLinks: pb.steps.map((_, i) => supportedLink(pb, i, e)) }, exps(e), 'ev', T1)] });
    await repo.recomputeCompetencies('test');
    // recomputeCompetencies writes a record per competency; with no attempts/reviews/field evidence every one must stay at level 0
    const comps = await db.competencies.toArray();
    expect(comps.length).toBeGreaterThan(0);
    expect(comps.every((c) => c.level === 0)).toBe(true);
    expect(await db.attempts.count()).toBe(0);
    expect(await db.reviews.count()).toBe(0);
  });

  it('an evaluation summary round-trips through a backup, and an invalid link is reported, never silently dropped', async () => {
    const db = await freshDb();
    const e = experiment('e1', goodRuns);
    await db.experiments.put(e);
    const pb = seed();
    const withEvidence = { ...pb, evidenceLinks: [supportedLink(pb, 0, e)] };
    await repo.savePlaybook({ ...withEvidence, evaluations: [buildEvaluation(withEvidence, exps(e), 'ev', T1, 'v1')] });
    await repo.saveTransferTask({ ...(await import('@/domain/transfer/model')).newTransferTask('tt1', T0, { title: 'Try release-notes playbook on repo X' }) });
    const text = serializeBackup(await exportAll());
    const parsed = parseBackup(text);
    expect(parsed.preview.counts.playbooks).toBe(1);
    expect(parsed.preview.counts.transferTasks).toBe(1);
    const broken = JSON.parse(text);
    broken.data.playbooks[0].evidenceLinks[0].status = 'definitely-works';
    const bad = parseBackup(JSON.stringify(broken));
    expect(bad.preview.ok).toBe(false);
    expect(bad.preview.invalid.some((x) => x.store === 'playbooks')).toBe(true);
    const db2 = await freshDb();
    await applyImport(parsed.valid!, 'replace');
    const restored = PlaybookSchema.parse(await db2.playbooks.get('pb'));
    expect(restored.evidenceLinks[0]!.status).toBe('supports');
    expect(restored.evaluations[0]!.label).toBe('v1');
    expect(await db2.transferTasks.count()).toBe(1);
    void newId;
  });
});

describe('migration v5 -> v6: a real older database is upgraded without losing anything', () => {
  it('backfills evidence fields, keeps already-verified steps verified for their current wording, and adds the new store', async () => {
    const name = `pe-migrate-${Math.random().toString(36).slice(2)}`;
    const old = new Dexie(name);
    old.version(5).stores({
      profile: 'id', preferences: 'id', lessonProgress: 'lessonId', attempts: 'id, lessonId, stage, submittedAt, [lessonId+stage]', competencies: 'competencyId', reviews: 'lessonId, dueOn',
      annotations: 'entryId', arsenal: 'entryId, status', customSkills: 'id, updatedAt', experiments: 'id, updatedAt, status', evidence: 'id, experimentId', fieldEvidence: 'id, date, entryId, createdAt',
      loops: 'id, status, updatedAt', diagnostics: 'id, takenAt', goals: 'id, status, updatedAt', playbooks: 'id, updatedAt', activityRuns: 'id, activityId, takenAt', meta: 'key',
    });
    await old.open();
    const base = seed();
    // An R3-shaped playbook: no contentVersion / evidenceLinks / evaluations, steps without verifiedFingerprint.
    const { contentVersion: _a, evidenceLinks: _b, evaluations: _c, ...r3 } = { ...base, id: 'pb-old' } as Record<string, unknown>;
    const r3steps = (base.steps as Record<string, unknown>[]).map((s, i) => {
      const { verifiedFingerprint: _f, ...rest } = s;
      return i === 0 ? { ...rest, status: 'verified', verifiedNote: 'Saw it validate on my own export.', verifiedAt: T0 } : rest;
    });
    await old.table('playbooks').put({ ...r3, steps: r3steps });
    await old.table('goals').put({ id: 'g1', schemaVersion: 1, title: 'Keep me', why: '', capabilityIds: ['evaluation'], status: 'active', achievedNote: '', achievedAt: null, createdAt: T0, updatedAt: T0 });
    await old.table('experiments').put({ ...experiment('e-old', goodRuns) });
    old.close();

    const db = new ForgeDB(name);
    setDbForTesting(db);
    await db.open();
    expect(DB_VERSION).toBe(8);
    expect(db.verno).toBe(8);
    const pb = (await db.playbooks.get('pb-old'))!;
    expect(pb.contentVersion).toBe(1);
    expect(pb.evidenceLinks).toEqual([]);
    expect(pb.evaluations).toEqual([]);
    expect(pb.steps[0]!.status).toBe('verified');
    expect(pb.steps[0]!.verifiedFingerprint).toBe(stepFingerprint(pb.steps[0]!)); // still verified for its current wording
    expect(effectiveStepStatus(pb.steps[0]!)).toBe('verified');
    expect(pb.steps[1]!.verifiedFingerprint).toBeNull();
    expect(PlaybookSchema.safeParse(pb).success).toBe(true);
    expect((await db.goals.get('g1'))!.title).toBe('Keep me');
    expect((await db.experiments.get('e-old'))!.title).toBe('Gated workflow vs one prompt');
    expect(await db.transferTasks.count()).toBe(0);
  });
});

describe('review, reassess, unlink and evaluation summaries go through the repository', () => {
  it('a review cannot be recorded on stale evidence; reassessing keeps the old judgement in history and blanks the new one', async () => {
    const db = await freshDb();
    await repo.savePlaybook(seed());
    const e = experiment('e1', goodRuns);
    await db.experiments.put(e);
    const stepId = (await db.playbooks.get('pb'))!.steps[0]!.id;
    const linked = await repo.linkExperimentToStep('pb', stepId, 'e1');
    expect(linked.ok).toBe(true);
    const lid = linked.ok ? linked.link.id : '';
    const r1 = await repo.reviewEvidenceLink('pb', lid, { criteria: 'Rework rounds must not exceed the baseline.', status: 'supports', claimedOutcome: 'met', reviewerNote: 'Fewer rework rounds in both runs.', limitations: 'One repository.' });
    expect(r1.ok).toBe(true);
    expect((await db.playbooks.get('pb'))!.evidenceLinks[0]!.status).toBe('supports');
    // the experiment gains a run -> the link is stale -> judging it is refused
    await db.experiments.put(experiment('e1', [...goodRuns, { cond: 'cB', i: 3, rework: 5 }]));
    const refused = await repo.reviewEvidenceLink('pb', lid, { status: 'supports', reviewerNote: 'Still fine, I think.' });
    expect(refused).toMatchObject({ ok: false, reason: expect.stringMatching(/stale/i) });
    const re = await repo.reassessEvidenceLink('pb', lid);
    expect(re.ok).toBe(true);
    const link = (await db.playbooks.get('pb'))!.evidenceLinks[0]!;
    expect(link.status).toBe('unreviewed');
    expect(link.history).toHaveLength(1);
    expect(link.history[0]!.status).toBe('supports');
    expect(link.snapshot.conditions.map((c) => c.runsWithData)).toEqual([2, 3]);
    expect(linkCurrency(link, (await db.playbooks.get('pb'))!.steps[0], (await db.experiments.get('e1')))).toBe('current');
  });

  it('a stale link whose experiment was deleted stays stale and cannot be reassessed into currency', async () => {
    const db = await freshDb();
    await repo.savePlaybook(seed());
    await db.experiments.put(experiment('e1', goodRuns));
    const stepId = (await db.playbooks.get('pb'))!.steps[0]!.id;
    const linked = await repo.linkExperimentToStep('pb', stepId, 'e1');
    const lid = linked.ok ? linked.link.id : '';
    await db.experiments.delete('e1');
    await repo.reassessEvidenceLink('pb', lid);
    const pb = (await db.playbooks.get('pb'))!;
    expect(linkCurrency(pb.evidenceLinks[0]!, pb.steps[0], undefined)).toBe('experiment-missing');
    expect(stepEvidence(pb.steps[0]!, pb.evidenceLinks, new Map()).state).toBe('needs-reassessment');
    expect((await repo.unlinkEvidence('pb', lid)).ok).toBe(true);
    expect((await db.playbooks.get('pb'))!.evidenceLinks).toHaveLength(0);
    expect(await repo.unlinkEvidence('pb', lid)).toMatchObject({ ok: false });
  });

  it('saving an editor draft opened before a link was made cannot erase the link or the saved summaries', async () => {
    const db = await freshDb();
    const base = seed();
    await repo.savePlaybook(base);
    const staleDraft = (await db.playbooks.get('pb'))!; // opened with no evidence
    await db.experiments.put(experiment('e1', goodRuns));
    const stepId = staleDraft.steps[0]!.id;
    await repo.linkExperimentToStep('pb', stepId, 'e1');
    await repo.saveEvaluation('pb', 'first');
    await repo.savePlaybook({ ...staleDraft, notes: 'Edited while the evidence was being added.' });
    const after = (await db.playbooks.get('pb'))!;
    expect(after.notes).toMatch(/Edited/);
    expect(after.evidenceLinks).toHaveLength(1);
    expect(after.evaluations).toHaveLength(1);
  });

  it('evaluation summaries are versioned snapshots: they keep the version and maturity of their moment and never update themselves', async () => {
    const db = await freshDb();
    await repo.savePlaybook(seed());
    await db.experiments.put(experiment('e1', goodRuns));
    const stepId = (await db.playbooks.get('pb'))!.steps[0]!.id;
    await repo.linkExperimentToStep('pb', stepId, 'e1');
    const a = await repo.saveEvaluation('pb', 'before judging');
    expect(a.ok && a.evaluation.maturity).toBe('ready-to-test');
    expect(a.ok && a.evaluation.playbookContentVersion).toBe(1);
    expect(a.ok && a.evaluation.markdown).toMatch(/## Observed evidence/);
    expect(a.ok && a.evaluation.markdown).toMatch(/## Limitations/);
    expect(a.ok && a.evaluation.markdown).toMatch(/## Next experiment/);
    const cur = (await db.playbooks.get('pb'))!;
    await repo.savePlaybook({ ...cur, steps: cur.steps.map((st, i) => (i === 0 ? { ...st, instruction: st.instruction + ' Revised.' } : st)) });
    const b = await repo.saveEvaluation('pb', 'after editing the step');
    expect(b.ok && b.evaluation.playbookContentVersion).toBe(2);
    const pb = (await db.playbooks.get('pb'))!;
    expect(pb.evaluations.map((x) => x.label)).toEqual(['before judging', 'after editing the step']);
    expect(pb.evaluations[0]!.playbookContentVersion).toBe(1); // untouched by the later edit
    await repo.deleteEvaluation('pb', pb.evaluations[0]!.id);
    expect((await db.playbooks.get('pb'))!.evaluations).toHaveLength(1);
  });

  it('an imported playbook JSON arrives without evidence, evaluations or verified steps', async () => {
    const { exportPlaybookJson, parsePlaybookJson } = await import('@/domain/playbook/ops');
    const pb = seed();
    const link = supportedLink(pb, 0, experiment('e1', goodRuns));
    const withEvidence = { ...pb, evidenceLinks: [link], evaluations: [buildEvaluation({ ...pb, evidenceLinks: [link] }, exps(experiment('e1', goodRuns)), 'ev', T1)], steps: pb.steps.map((st) => withVerification({ ...st, verifiedNote: 'claimed by the author' }, T0)) };
    const r = parsePlaybookJson(exportPlaybookJson(withEvidence), 'pb-new', sid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.playbook.evidenceLinks).toEqual([]);
      expect(r.playbook.evaluations).toEqual([]);
      expect(r.playbook.steps.every((st) => st.status === 'planned' && st.verifiedFingerprint === null)).toBe(true);
    }
  });
});

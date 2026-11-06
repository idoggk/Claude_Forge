import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ForgeDB, setDbForTesting } from '@/persistence/db';
import { saveExperiment } from '@/persistence/repo';
import { ExperimentSchema, type Experiment } from '@/domain/experiments/model';
import {
  DEFAULT_CRITERIA, blindingCheck, createReview, customCriterion, disagreements, displayText, identityOf, leakTermsFor, lockEvaluation, lockProblems, outputCandidates, recordGuess, reveal,
  revealedScores, reviewMarkdown, seededOrder, setMasking, setReasoning, setRubric, setScore, startScoring, styleLeakNotes, type OutputCandidate,
} from '@/domain/blinded/review';
import type { BlindedReview } from '@/domain/blinded/schema';

const T = '2026-11-06T10:00:00.000Z';
const T2 = '2026-11-06T10:05:00.000Z';

function exp(over: Partial<Experiment> = {}): Experiment {
  return ExperimentSchema.parse({
    id: 'e1', title: 'Examples vs none', experimentType: 'prompt', hypothesis: 'Examples help.', problem: 'p', prompt: 'x',
    fixture: { id: 'custom', label: 'my diffs', version: '', hash: null }, successCriteria: ['house style'], plannedMeasures: ['reworkRounds'], plannedRuns: 3, rubricLockedAt: T,
    conditions: [{ id: 'cA', label: 'Current prompt', kind: 'baseline', difference: '' }, { id: 'cB', label: 'Revised prompt', kind: 'prompt', skillName: 'few-shot-examples', difference: 'Three examples added.' }],
    runs: [1, 2, 3].flatMap((i) => ['cA', 'cB'].map((c) => ({ id: `${c}-${i}`, conditionId: c, index: i, recordedAt: T, metrics: { reworkRounds: { value: c === 'cA' ? 3 : 1, provenance: 'self-reported' as const } } }))),
    createdAt: T, updatedAt: T, ...over,
  });
}
const outputs = (e: Experiment, extra: Partial<Record<string, string>> = {}): OutputCandidate[] => e.runs.map((r) => ({ evidenceId: `ev-${r.id}`, runId: r.id, conditionId: r.conditionId, conditionLabel: r.conditionId === 'cA' ? 'Current prompt' : 'Revised prompt', runIndex: r.index, name: 'Output', text: extra[r.id] ?? `Commit message number ${r.index}: fix rounding in invoice totals.` }));
const make = (e = exp(), seed = '1a2b3c4d', chosen = outputs(e)): BlindedReview => { const r = createReview(e, { id: 'br1', title: 'Check', chosen, criteria: DEFAULT_CRITERIA, seed, now: T }); if (!r.ok) throw new Error(r.reason); return r.value; };
const ok = <R>(r: { ok: true; value: R } | { ok: false; reason: string }): R => { if (!r.ok) throw new Error(r.reason); return r.value; };

function scoreAll(r0: BlindedReview, value = 2): BlindedReview {
  let r = ok(startScoring(r0, T));
  for (const it of r.items) { for (const c of r.rubric.criteria) r = ok(setScore(r, it.key, c.id, value, T)); r = ok(setReasoning(r, it.key, 'Reasonable and mostly accurate.', T)); }
  return r;
}

describe('setup: outputs, anonymous labels and a randomised order', () => {
  it('needs at least two outputs from at least two conditions', () => {
    const e = exp();
    const one = outputs(e).slice(0, 1);
    expect(createReview(e, { id: 'x', title: '', chosen: one, criteria: DEFAULT_CRITERIA, seed: 'aa', now: T })).toMatchObject({ ok: false });
    const sameCond = outputs(e).filter((o) => o.conditionId === 'cA');
    expect(createReview(e, { id: 'x', title: '', chosen: sameCond, criteria: DEFAULT_CRITERIA, seed: 'aa', now: T })).toMatchObject({ ok: false, reason: expect.stringMatching(/two conditions/) });
  });

  it('labels outputs "Output 1..n" in the shuffled presentation order, so a label says nothing about the source', () => {
    const r = make();
    expect(r.items.map((i) => i.key)).toEqual(r.items.map((_, k) => `Output ${k + 1}`));
    expect(r.items.map((i) => i.order)).toEqual(r.items.map((_, k) => k));
    expect(JSON.stringify(r.items.map((i) => i.key))).not.toMatch(/cA|cB|Current|Revised/);
  });

  it('the shuffle is deterministic for a seed (so a reopened review keeps its order) and differs across seeds', () => {
    expect(seededOrder(8, '1a2b3c4d')).toEqual(seededOrder(8, '1a2b3c4d'));
    expect(new Set(['00000001', '00000002', '00000003', '9f8e7d6c', 'deadbeef'].map((s) => seededOrder(8, s).join(','))).size).toBeGreaterThan(2);
    expect([...seededOrder(10, 'cafef00d')].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const a = make(exp(), '1a2b3c4d'), b = make(exp(), '1a2b3c4d');
    expect(a.items.map((i) => i.runId)).toEqual(b.items.map((i) => i.runId));
  });

  it('does not simply list one condition before the other', () => {
    const firsts = new Set(['11111111', '22222222', '33333333', '44444444', '55555555', '66666666', '77777777', '88888888'].map((s) => make(exp(), s).items[0]!.conditionId));
    expect(firsts.size).toBe(2);
  });

  it('outputs come from text evidence on runs, never from the learner\'s own notes', () => {
    const e = exp();
    const ev = [
      { id: 'e1', runId: 'cA-1', kind: 'pasted-output', name: 'out', text: 'the output' },
      { id: 'e2', runId: 'cB-1', kind: 'model-output', name: 'out', text: 'another' },
      { id: 'e3', runId: 'cB-1', kind: 'note', name: 'my notes', text: 'I think this one is better' },
      { id: 'e4', runId: null, kind: 'pasted-output', name: 'loose', text: 'not attached' },
      { id: 'e5', runId: 'cA-1', kind: 'prompt', name: 'p', text: 'the prompt' },
    ];
    expect(outputCandidates(e, ev).map((c) => c.evidenceId)).toEqual(['e1', 'e2']);
  });
});

describe('the rubric is fixed before any output is shown', () => {
  it('can change during setup, and never after scoring starts', () => {
    const r = make();
    const edited = ok(setRubric(r, DEFAULT_CRITERIA.slice(0, 2), T));
    expect(edited.rubric.criteria).toHaveLength(2);
    const s = ok(startScoring(edited, T));
    expect(s.rubric.lockedAt).toBe(T);
    expect(setRubric(s, DEFAULT_CRITERIA, T2)).toMatchObject({ ok: false, reason: expect.stringMatching(/locked/) });
    expect(setMasking(s, false, T2)).toMatchObject({ ok: false });
    expect(startScoring(s, T2)).toMatchObject({ ok: false });
  });

  it('a task-specific criterion must say what a 0 and a 3 look like before scoring', () => {
    expect(customCriterion('c1', 'Uses our house style', '', 'Follows it exactly')).toMatchObject({ ok: false });
    const c = customCriterion('c1', 'Uses our house style', 'Ignores the format', 'Matches it exactly');
    expect(c.ok && c.value.anchors[0]).toBe('Ignores the format');
    expect(c.ok && c.value.custom).toBe(true);
  });
});

describe('custom criteria made with real ids', () => {
  it('a task-specific criterion with an id from newId() is accepted and survives creation', async () => {
    const { newId } = await import('@/lib/ids');
    const c = customCriterion(newId('crit'), 'House style', 'Ignores the format', 'Matches it exactly');
    expect(c.ok).toBe(true);
    const e = exp();
    const r = createReview(e, { id: newId('br'), title: '', chosen: outputs(e), criteria: [...DEFAULT_CRITERIA, ...(c.ok ? [c.value] : [])], seed: '1a2b3c4d', now: T });
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.value.rubric.criteria).toHaveLength(4);
  });
});

describe('scoring, reasoning and locking', () => {
  it('scores only in the scoring state, only 0 to 3 or "not assessed", only for real outputs and criteria', () => {
    const r = make();
    expect(setScore(r, 'Output 1', 'correctness', 2, T)).toMatchObject({ ok: false }); // not started
    const s = ok(startScoring(r, T));
    expect(setScore(s, 'Output 1', 'correctness', 4, T)).toMatchObject({ ok: false });
    expect(setScore(s, 'Output 1', 'correctness', 1.5, T)).toMatchObject({ ok: false });
    expect(setScore(s, 'Output 99', 'correctness', 2, T)).toMatchObject({ ok: false });
    expect(setScore(s, 'Output 1', 'nope', 2, T)).toMatchObject({ ok: false });
    expect(ok(setScore(s, 'Output 1', 'correctness', null, T)).scores['Output 1']!.correctness).toBeNull();
  });

  it('cannot be locked until every criterion has a score or an explicit "not assessed" and every output has reasoning', () => {
    let s = ok(startScoring(make(), T));
    expect(lockProblems(s).length).toBe(s.items.length * 2);
    expect(lockEvaluation(s, T)).toMatchObject({ ok: false });
    s = scoreAll(make());
    expect(lockProblems(s)).toEqual([]);
    expect(ok(lockEvaluation(s, T2)).state).toBe('locked');
  });

  it('a locked evaluation cannot be edited', () => {
    const l = ok(lockEvaluation(scoreAll(make()), T2));
    expect(setScore(l, 'Output 1', 'correctness', 0, T2)).toMatchObject({ ok: false });
    expect(setReasoning(l, 'Output 1', 'changed my mind', T2)).toMatchObject({ ok: false });
    expect(setRubric(l, DEFAULT_CRITERIA, T2)).toMatchObject({ ok: false });
  });
});

describe('identity stays hidden until the evaluation is locked, guessed about and revealed', () => {
  it('identityOf is null in every state before the reveal, and the UI helper never leaks it', () => {
    const r0 = make();
    const s = scoreAll(make());
    const l = ok(lockEvaluation(s, T2));
    for (const r of [r0, s, l]) for (const it of r.items) expect(identityOf(r, it.key)).toBeNull();
  });

  it('guesses are recorded only after locking; the reveal needs a guess (or "can\'t tell") for every output', () => {
    const s = scoreAll(make());
    expect(recordGuess(s, 'Output 1', 'cA', T2)).toMatchObject({ ok: false });
    expect(reveal(s, T2)).toMatchObject({ ok: false });
    let l = ok(lockEvaluation(s, T2));
    expect(reveal(l, T2)).toMatchObject({ ok: false, reason: expect.stringMatching(/Output 1/) });
    expect(recordGuess(l, 'Output 1', 'cZ', T2)).toMatchObject({ ok: false });
    for (const it of l.items) l = ok(recordGuess(l, it.key, it.order % 2 ? 'cA' : 'unsure', T2));
    const r = ok(reveal(l, T2));
    expect(r.state).toBe('revealed');
    for (const it of r.items) expect(identityOf(r, it.key)).toBe(it.conditionId);
    expect(reveal(r, T2)).toMatchObject({ ok: false });
  });
});

describe('outputs that reveal their source are masked and documented', () => {
  it('detects a Skill name, version or long condition label, masks it for display, and leaves the stored text untouched', () => {
    const e = exp();
    const r = make(e, '1a2b3c4d', outputs(e, { 'cB-1': 'Using few-shot-examples, the message is: fix rounding.', 'cA-1': 'Plain: fix rounding.' }));
    const leaky = r.items.find((i) => i.runId === 'cB-1')!;
    expect(leaky.leakTerms).toEqual(['few-shot-examples']);
    expect(displayText(r, leaky)).toContain('▮▮▮');
    expect(displayText(r, leaky)).not.toMatch(/few-shot-examples/i);
    expect(leaky.text).toMatch(/few-shot-examples/);
    expect(r.exceptions.join(' ')).toMatch(/Output \d+ contained 1 term\(s\) that could reveal its source/);
    expect(r.exceptions.join(' ')).not.toMatch(/few-shot-examples/i); // says THAT a term was found, never what it was
    const unmasked = ok(setMasking(r, false, T));
    expect(displayText(unmasked, leaky)).toMatch(/few-shot-examples/);
  });

  it('ignores one-letter labels, which match ordinary words', () => {
    const e = exp({ conditions: [{ id: 'cA', label: 'A', kind: 'baseline', skillName: '', skillVersion: '', difference: '' }, { id: 'cB', label: 'B', kind: 'prompt', skillName: '', skillVersion: '', difference: 'x' }] });
    expect(leakTermsFor(e, 'cA', 'A plan for B and C')).toEqual([]);
  });

  it('discloses a large output-length difference between conditions as an exception', () => {
    expect(styleLeakNotes([{ conditionId: 'a', text: 'x'.repeat(100) }, { conditionId: 'b', text: 'x'.repeat(400) }]).join(' ')).toMatch(/length differs about twofold/);
    expect(styleLeakNotes([{ conditionId: 'a', text: 'x'.repeat(100) }, { conditionId: 'b', text: 'x'.repeat(120) }])).toEqual([]);
  });
});

describe('the reveal: scores per condition, a blinding check, and disagreement with the measurements', () => {
  function revealedWith(scoreFor: (cond: string) => number, guessRight: boolean): BlindedReview {
    let s = ok(startScoring(make(), T));
    for (const it of s.items) { for (const c of s.rubric.criteria) s = ok(setScore(s, it.key, c.id, scoreFor(it.conditionId), T)); s = ok(setReasoning(s, it.key, 'My reasoning for this one.', T)); }
    let l = ok(lockEvaluation(s, T2));
    for (const it of l.items) l = ok(recordGuess(l, it.key, guessRight ? it.conditionId : it.conditionId === 'cA' ? 'cB' : 'cA', T2));
    return ok(reveal(l, T2));
  }

  it('summarises per condition with n, range and mean', () => {
    const r = revealedWith((c) => (c === 'cA' ? 1 : 3), true);
    const sc = revealedScores(r, exp())!;
    expect(sc.map((s) => s.label)).toEqual(['Current prompt', 'Revised prompt']);
    expect(sc[0]!.perCriterion[0]).toMatchObject({ n: 3, mean: 1, min: 1, max: 1 });
    expect(sc[1]!.perCriterion[0]).toMatchObject({ mean: 3 });
    expect(revealedScores(make(), exp())).toBeNull(); // not before the reveal
  });

  it('says when guesses were so accurate the blinding probably failed, and when they cannot tell', () => {
    expect(blindingCheck(revealedWith(() => 2, true))).toMatchObject({ made: 6, correct: 6, verdict: 'likely-failed' });
    expect(blindingCheck(revealedWith(() => 2, false))).toMatchObject({ correct: 0, verdict: 'held-up' });
    expect(blindingCheck(make())).toBeNull();
  });

  it('flags where the blinded scores and the recorded measurements point different ways, without letting either override the other', () => {
    // the revised prompt scored HIGHER blind, and had FEWER rework rounds: they agree
    expect(disagreements(revealedWith((c) => (c === 'cB' ? 3 : 1), true), exp())).toEqual([]);
    // the baseline scored higher blind, but the revised prompt needed fewer corrections: they disagree
    const d = disagreements(revealedWith((c) => (c === 'cA' ? 3 : 1), true), exp());
    expect(d.join(' ')).toMatch(/Current prompt scored higher in the blinded review, but Revised prompt has the better recorded rework rounds/);
    expect(d.join(' ')).toMatch(/subjective judgement, not a measurement/);
  });
});

describe('export: condition names appear only after the reveal', () => {
  it('Markdown before the reveal contains no condition identity; after the reveal it does, with limitations', () => {
    const e = exp();
    const s = scoreAll(make());
    const before = reviewMarkdown(s, e);
    expect(before).not.toMatch(/Current prompt|Revised prompt|few-shot-examples/);
    expect(before).toMatch(/not part of this export until the review is revealed/);
    let l = ok(lockEvaluation(s, T2));
    for (const it of l.items) l = ok(recordGuess(l, it.key, 'unsure', T2));
    const after = reviewMarkdown(ok(reveal(l, T2)), e);
    expect(after).toMatch(/Current prompt/);
    for (const h of ['## Rubric (locked before scoring)', '## Outputs and scores', '## By condition (after the reveal)', '## Did the blinding hold?', '## Limitations']) expect(after).toContain(h);
    expect(after).toMatch(/Subjective scores are not objective correctness/);
  });
});

describe('persistence: a review survives being saved, reopened and exported, and older experiments still load', () => {
  it('round-trips through the database with its state, order, scores and rubric lock', async () => {
    const db = new ForgeDB(`blind-${Math.random().toString(36).slice(2)}`);
    setDbForTesting(db);
    await db.open();
    const e = exp();
    let r = scoreAll(make(e));
    r = ok(lockEvaluation(r, T2));
    await saveExperiment({ ...e, blindedReviews: [r] });
    const back = (await db.experiments.get('e1'))!;
    expect(ExperimentSchema.safeParse(back).success).toBe(true);
    const re = back.blindedReviews[0]!;
    expect(re.state).toBe('locked');
    expect(re.rubric.lockedAt).toBe(T);
    expect(re.items.map((i) => i.runId)).toEqual(r.items.map((i) => i.runId));
    expect(re.scores).toEqual(r.scores);
    expect(identityOf(re, 'Output 1')).toBeNull(); // still hidden after reopening
  });

  it('an experiment saved before blinded reviews existed parses with an empty list', () => {
    const old = JSON.parse(JSON.stringify(exp())) as Record<string, unknown>;
    delete old.blindedReviews;
    delete old.pilot;
    const p = ExperimentSchema.safeParse(old);
    expect(p.success).toBe(true);
    if (p.success) expect(p.data.blindedReviews).toEqual([]);
  });
});

describe('the JSON export hides identities until the reveal', () => {
  it('omits condition, run and evidence ids and leak terms before the reveal, and includes them after', async () => {
    const { reviewJson } = await import('@/domain/blinded/review');
    const s = scoreAll(make(exp(), '1a2b3c4d', outputs(exp(), { 'cB-1': 'Using few-shot-examples: fix rounding.' })));
    const before = reviewJson(s);
    expect(before.match(/conditionId|runId|evidenceId|leakTerms|"cA"|cB-|few-shot-examples/i)?.[0]).toBeUndefined();
    expect(before).toMatch(/Output 1/);
    let l = ok(lockEvaluation(s, T2));
    for (const it of l.items) l = ok(recordGuess(l, it.key, 'unsure', T2));
    expect(reviewJson(ok(reveal(l, T2)))).toMatch(/conditionId/);
  });
});

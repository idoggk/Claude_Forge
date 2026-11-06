import type { Experiment } from '@/domain/experiments/model';
import { isBaselineKind } from '@/domain/experiments/model';
import { compareExperiment } from '@/domain/experiments/compare';
import { BlindedReviewSchema, type BlindItem, type BlindedReview, type RubricCriterion } from './schema';

/* ------------------------------------------------------------------------------------------------- rubric */

export const DEFAULT_CRITERIA: RubricCriterion[] = [
  { id: 'correctness', label: 'Correctness', custom: false, anchors: ['Wrong, or contradicts what was asked.', 'Partly right; a significant error remains.', 'Right, with minor errors.', 'Right; you find no errors.'] },
  { id: 'completeness', label: 'Completeness', custom: false, anchors: ['Most required parts are missing.', 'Several required parts are missing.', 'Minor parts are missing.', 'Everything required is present.'] },
  { id: 'clarity', label: 'Clarity', custom: false, anchors: ['Hard to follow.', 'Understandable with effort.', 'Clear, with minor issues.', 'Clear and well organised.'] },
];

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string };
const fail = <T>(reason: string): Result<T> => ({ ok: false, reason });

/** Task-specific criteria must say what the best and worst look like BEFORE any output is shown. */
export function customCriterion(id: string, label: string, worst: string, best: string): Result<RubricCriterion> {
  if (label.trim().length < 3) return fail('Name the criterion.');
  if (worst.trim().length < 5 || best.trim().length < 5) return fail('Say what the worst (0) and best (3) look like, in a few words each.');
  return { ok: true, value: { id, label: label.trim().slice(0, 80), custom: true, anchors: [worst.trim().slice(0, 300), `Between the extremes, closer to the worst.`, `Between the extremes, closer to the best.`, best.trim().slice(0, 300)] } };
}

/* ------------------------------------------------------------------------------------------------- shuffle */

/** mulberry32: a small deterministic generator, so the order can be reproduced from the stored seed. */
function rng(seedHex: string): () => number {
  let a = Number.parseInt(seedHex.slice(0, 8).padEnd(8, '0'), 16) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function seededOrder(n: number, seedHex: string): number[] {
  const r = rng(seedHex);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j]!, idx[i]!]; }
  return idx;
}
export const newSeed = (): string => { const b = new Uint8Array(4); globalThis.crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };

/* ------------------------------------------------------------------------------------------------- outputs and leaks */

export interface OutputCandidate { evidenceId: string; runId: string; conditionId: string; conditionLabel: string; runIndex: number; name: string; text: string }
const OUTPUT_KINDS = new Set(['pasted-output', 'model-output', 'file']);

/** Outputs a learner may review: text evidence attached to a run, never the learner's own notes about it. */
export function outputCandidates(exp: Experiment, evidence: { id: string; runId: string | null; kind: string; name: string; text: string }[]): OutputCandidate[] {
  const out: OutputCandidate[] = [];
  for (const e of evidence) {
    if (!e.runId || !OUTPUT_KINDS.has(e.kind) || !e.text.trim()) continue;
    const run = exp.runs.find((r) => r.id === e.runId);
    const cond = run && exp.conditions.find((c) => c.id === run.conditionId);
    if (run && cond) out.push({ evidenceId: e.id, runId: run.id, conditionId: cond.id, conditionLabel: cond.label, runIndex: run.index, name: e.name, text: e.text });
  }
  return out.sort((a, b) => a.conditionLabel.localeCompare(b.conditionLabel) || a.runIndex - b.runIndex);
}

/** Terms that would reveal which condition produced an output. Short labels such as "A" are ignored: they match ordinary words. */
export function leakTermsFor(exp: Experiment, conditionId: string, text: string): string[] {
  const terms = new Set<string>();
  for (const c of exp.conditions) {
    const cands = [c.skillName, c.skillVersion, c.label].map((x) => x.trim()).filter((x) => x.length >= 4);
    for (const t of cands) if (text.toLowerCase().includes(t.toLowerCase())) terms.add(t);
  }
  void conditionId;
  return [...terms].slice(0, 20);
}

export function maskText(text: string, terms: string[]): string {
  let t = text;
  for (const term of terms) t = t.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '▮▮▮');
  return t;
}

/** A disclosure, not a fix: output length that differs a lot by condition can reveal the source by itself. */
export function styleLeakNotes(items: Pick<BlindItem, 'conditionId' | 'text'>[]): string[] {
  const byCond = new Map<string, number[]>();
  for (const i of items) byCond.set(i.conditionId, [...(byCond.get(i.conditionId) ?? []), i.text.length]);
  const means = [...byCond.values()].map((l) => l.reduce((a, b) => a + b, 0) / l.length);
  const notes: string[] = [];
  if (means.length >= 2 && Math.min(...means) > 0 && Math.max(...means) / Math.min(...means) >= 2) notes.push('Output length differs about twofold between conditions, so length alone may reveal the source.');
  return notes;
}

/* ------------------------------------------------------------------------------------------------- state machine */

export interface CreateInput { id: string; title: string; chosen: OutputCandidate[]; criteria: RubricCriterion[]; seed: string; now: string }

export function createReview(exp: Experiment, i: CreateInput): Result<BlindedReview> {
  if (exp.conditions.length < 2) return fail('The experiment needs at least two conditions.');
  const conds = new Set(i.chosen.map((c) => c.conditionId));
  if (i.chosen.length < 2) return fail('Choose at least two outputs.');
  if (conds.size < 2) return fail('Choose outputs from at least two conditions, or there is nothing to compare.');
  if (i.chosen.length > 60) return fail('Choose at most 60 outputs.');
  const order = seededOrder(i.chosen.length, i.seed);
  const items: BlindItem[] = i.chosen.map((c, k) => ({ key: '', order: order[k]!, runId: c.runId, conditionId: c.conditionId, evidenceId: c.evidenceId, text: c.text, leakTerms: leakTermsFor(exp, c.conditionId, c.text) }));
  // the key follows the shuffled position, so "Output 1" is the first thing shown and says nothing about the source
  items.sort((a, b) => a.order - b.order).forEach((it, idx) => { it.key = `Output ${idx + 1}`; it.order = idx; });
  const exceptions: string[] = [];
  // The note says THAT a term was found, never WHAT it was: naming it would give the source away before the reveal.
  for (const it of items) if (it.leakTerms.length) exceptions.push(`${it.key} contained ${it.leakTerms.length} term(s) that could reveal its source.`);
  exceptions.push(...styleLeakNotes(items));
  const r = BlindedReviewSchema.safeParse({ id: i.id, title: i.title.trim().slice(0, 160), state: 'setup', seed: i.seed, rubric: { criteria: i.criteria, lockedAt: null }, items, maskLeaks: true, exceptions, createdAt: i.now, updatedAt: i.now });
  if (!r.success) return fail(`The review could not be created: ${r.error.issues[0]?.message ?? 'invalid'}.`);
  return { ok: true, value: r.data };
}

const touch = (r: BlindedReview, now: string, patch: Partial<BlindedReview>): BlindedReview => ({ ...r, ...patch, updatedAt: now });

/** The rubric may only change during setup. */
export function setRubric(r: BlindedReview, criteria: RubricCriterion[], now: string): Result<BlindedReview> {
  if (r.state !== 'setup' || r.rubric.lockedAt) return fail('The rubric is locked. It was fixed before any output was shown so it cannot be bent to fit the outputs.');
  if (criteria.length < 1) return fail('Keep at least one criterion.');
  if (new Set(criteria.map((c) => c.id)).size !== criteria.length) return fail('Criterion ids must be unique.');
  return { ok: true, value: touch(r, now, { rubric: { criteria, lockedAt: null } }) };
}

export function setMasking(r: BlindedReview, mask: boolean, now: string): Result<BlindedReview> {
  if (r.state !== 'setup') return fail('Masking can only be chosen during setup.');
  return { ok: true, value: touch(r, now, { maskLeaks: mask }) };
}

/** Lock the rubric and begin scoring. After this the rubric cannot change. */
export function startScoring(r: BlindedReview, now: string): Result<BlindedReview> {
  if (r.state !== 'setup') return fail('Scoring has already started.');
  return { ok: true, value: touch(r, now, { state: 'scoring', startedAt: now, rubric: { ...r.rubric, lockedAt: now } }) };
}

export function setScore(r: BlindedReview, key: string, criterionId: string, value: number | null, now: string): Result<BlindedReview> {
  if (r.state !== 'scoring') return fail('Scores can only be entered while scoring.');
  if (!r.items.some((i) => i.key === key)) return fail('Unknown output.');
  if (!r.rubric.criteria.some((c) => c.id === criterionId)) return fail('Unknown criterion.');
  if (value !== null && (!Number.isInteger(value) || value < 0 || value > 3)) return fail('A score is 0, 1, 2 or 3.');
  return { ok: true, value: touch(r, now, { scores: { ...r.scores, [key]: { ...(r.scores[key] ?? {}), [criterionId]: value } } }) };
}

export function setReasoning(r: BlindedReview, key: string, text: string, now: string): Result<BlindedReview> {
  if (r.state !== 'scoring') return fail('Reasoning can only be written while scoring.');
  if (!r.items.some((i) => i.key === key)) return fail('Unknown output.');
  return { ok: true, value: touch(r, now, { reasoning: { ...r.reasoning, [key]: text.slice(0, 2000) } }) };
}

/** What stands between the learner and locking the evaluation. */
export function lockProblems(r: BlindedReview): string[] {
  const p: string[] = [];
  for (const it of r.items) {
    const sc = r.scores[it.key] ?? {};
    const missing = r.rubric.criteria.filter((c) => sc[c.id] === undefined);
    if (missing.length) p.push(`${it.key}: score or mark "not assessed" for ${missing.map((m) => m.label).join(', ')}.`);
    if ((r.reasoning[it.key] ?? '').trim().length < 10) p.push(`${it.key}: write a sentence of reasoning.`);
  }
  return p;
}

export function lockEvaluation(r: BlindedReview, now: string): Result<BlindedReview> {
  if (r.state !== 'scoring') return fail('Only a review that is being scored can be locked.');
  const problems = lockProblems(r);
  if (problems.length) return fail(problems[0]!);
  return { ok: true, value: touch(r, now, { state: 'locked', lockedAt: now }) };
}

export function recordGuess(r: BlindedReview, key: string, guess: string, now: string): Result<BlindedReview> {
  if (r.state !== 'locked') return fail('Guesses are recorded after the scores are locked and before the reveal.');
  if (!r.items.some((i) => i.key === key)) return fail('Unknown output.');
  if (guess !== 'unsure' && !r.items.some((i) => i.conditionId === guess)) return fail('Unknown condition.');
  return { ok: true, value: touch(r, now, { guesses: { ...r.guesses, [key]: guess } }) };
}

export function setBlindingNote(r: BlindedReview, text: string, now: string): Result<BlindedReview> {
  if (r.state === 'revealed') return fail('The reveal is final.');
  return { ok: true, value: touch(r, now, { blindingNote: text.slice(0, 1000) }) };
}

export function reveal(r: BlindedReview, now: string): Result<BlindedReview> {
  if (r.state !== 'locked') return fail('The identities can be revealed only after the scores are locked.');
  const unguessed = r.items.filter((i) => r.guesses[i.key] === undefined);
  if (unguessed.length) return fail(`Say which condition you think produced ${unguessed[0]!.key} (or "can't tell") before the reveal.`);
  return { ok: true, value: touch(r, now, { state: 'revealed', revealedAt: now }) };
}

/** The condition behind an output: available ONLY once revealed. Everything that displays identity must go through this. */
export function identityOf(r: BlindedReview, key: string): string | null {
  return r.state === 'revealed' ? r.items.find((i) => i.key === key)?.conditionId ?? null : null;
}

/** The text the learner reads: leak terms masked unless they chose otherwise. */
export function displayText(r: BlindedReview, item: BlindItem): string {
  return r.maskLeaks && item.leakTerms.length ? maskText(item.text, item.leakTerms) : item.text;
}

/* ------------------------------------------------------------------------------------------------- results */

export interface BlindingCheck { made: number; correct: number; unsure: number; chance: number; verdict: 'held-up' | 'cannot-tell' | 'likely-failed' }

/** Compare guesses with the truth. Descriptive only: with a handful of outputs it cannot confirm that blinding held. */
export function blindingCheck(r: BlindedReview): BlindingCheck | null {
  if (r.state !== 'revealed') return null;
  const conds = new Set(r.items.map((i) => i.conditionId)).size;
  const made = r.items.filter((i) => r.guesses[i.key] && r.guesses[i.key] !== 'unsure');
  const correct = made.filter((i) => r.guesses[i.key] === i.conditionId).length;
  const unsure = r.items.length - made.length;
  const chance = made.length / Math.max(conds, 2);
  const verdict: BlindingCheck['verdict'] = made.length >= 4 && correct / made.length >= 0.75 ? 'likely-failed' : made.length >= 4 && correct / made.length <= 0.6 ? 'held-up' : 'cannot-tell';
  return { made: made.length, correct, unsure, chance, verdict };
}

export interface ConditionScores { conditionId: string; label: string; outputs: number; perCriterion: { criterionId: string; label: string; n: number; mean: number | null; min: number | null; max: number | null }[] }

export function revealedScores(r: BlindedReview, exp: Experiment): ConditionScores[] | null {
  if (r.state !== 'revealed') return null;
  return exp.conditions.filter((c) => r.items.some((i) => i.conditionId === c.id)).map((c) => {
    const its = r.items.filter((i) => i.conditionId === c.id);
    return {
      conditionId: c.id, label: c.label, outputs: its.length,
      perCriterion: r.rubric.criteria.map((cr) => {
        const vals = its.map((i) => r.scores[i.key]?.[cr.id]).filter((v): v is number => typeof v === 'number');
        return { criterionId: cr.id, label: cr.label, n: vals.length, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null };
      }),
    };
  });
}

/** Where the blinded scores and the objective evidence point different ways. Both are shown; neither overrides the other. */
export function disagreements(r: BlindedReview, exp: Experiment): string[] {
  const sc = revealedScores(r, exp);
  if (!sc || sc.length < 2) return [];
  const mean = (s: ConditionScores) => { const v = s.perCriterion.map((p) => p.mean).filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const [x, y] = sc as [ConditionScores, ConditionScores];
  const mx = mean(x), my = mean(y);
  if (mx === null || my === null || Math.abs(mx - my) < 0.5) return [];
  const higher = mx > my ? x : y, lower = mx > my ? y : x;
  const c = compareExperiment(exp);
  const out: string[] = [];
  for (const row of c.rows) {
    if (row.kind === 'rubric') continue;
    const h = row.perCondition.find((p) => p.conditionId === higher.conditionId)?.stat.mean;
    const l = row.perCondition.find((p) => p.conditionId === lower.conditionId)?.stat.mean;
    if (h == null || l == null) continue;
    const hBetter = row.direction === 'higher' ? h > l : h < l;
    if (!hBetter && h !== l) out.push(`${row.label}: condition ${higher.label} scored higher in the blinded review, but ${lower.label} has the better recorded ${row.label.toLowerCase()}. The blinded scores are your subjective judgement, not a measurement.`);
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------- export */

const cell = (s: string) => s.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');

export function reviewMarkdown(r: BlindedReview, exp: Experiment): string {
  const L: string[] = [];
  L.push(`# Blinded review: ${r.title || exp.title}`, '');
  L.push(`> Written in Claude Forge. Scores are the reviewer's own subjective judgement against a rubric fixed before any output was shown. Claude Forge ran nothing and cannot verify the outputs. State: **${r.state}**.`, '');
  L.push('## Rubric (locked before scoring)', '', r.rubric.lockedAt ? `Locked ${r.rubric.lockedAt.slice(0, 16).replace('T', ' ')}.` : '_not yet locked_', '');
  for (const c of r.rubric.criteria) L.push(`- **${c.label}**: 0 = ${c.anchors[0]} · 3 = ${c.anchors[3]}`);
  L.push('', '## Outputs and scores', '');
  const reveal = r.state === 'revealed';
  L.push(`| Output | ${reveal ? 'Condition | ' : ''}${r.rubric.criteria.map((c) => cell(c.label)).join(' | ')} | Reasoning |`, `|---|${reveal ? '---|' : ''}${r.rubric.criteria.map(() => '---|').join('')}---|`);
  for (const it of [...r.items].sort((a, b) => a.order - b.order)) {
    const cond = exp.conditions.find((c) => c.id === it.conditionId)?.label ?? '?';
    L.push(`| ${it.key} | ${reveal ? `${cond} | ` : ''}${r.rubric.criteria.map((c) => { const v = r.scores[it.key]?.[c.id]; return v === null || v === undefined ? 'not assessed' : String(v); }).join(' | ')} | ${cell(r.reasoning[it.key] ?? '')} |`);
  }
  if (!reveal) { L.push('', '_Condition identities are not part of this export until the review is revealed._', ''); return L.join('\n') + '\n'; }
  const sc = revealedScores(r, exp)!;
  L.push('', '## By condition (after the reveal)', '', `| Condition | Outputs | ${r.rubric.criteria.map((c) => cell(c.label)).join(' | ')} |`, `|---|---|${r.rubric.criteria.map(() => '---|').join('')}`);
  for (const s of sc) L.push(`| ${cell(s.label)} | ${s.outputs} | ${s.perCriterion.map((p) => (p.mean === null ? 'unknown' : `${p.mean.toFixed(2)} [${p.min}–${p.max}] n=${p.n}`)).join(' | ')} |`);
  const bc = blindingCheck(r)!;
  L.push('', '## Did the blinding hold?', '', `You named a condition for ${bc.made} of ${r.items.length} outputs (${bc.unsure} marked can't tell) and were right for ${bc.correct}; chance alone would give about ${bc.chance.toFixed(1)}. ${bc.verdict === 'likely-failed' ? 'The outputs probably revealed their source, so treat the scores with extra caution.' : bc.verdict === 'held-up' ? 'Your guesses were close to chance. That is consistent with the blinding holding, though it cannot prove it.' : 'With this few outputs the guesses cannot tell whether the blinding held.'}`);
  if (r.blindingNote.trim()) L.push('', `Your note: ${r.blindingNote.trim()}`);
  if (r.exceptions.length) L.push('', '## Documented exceptions', '', ...r.exceptions.map((x) => `- ${x}${r.maskLeaks ? '' : ' (not masked)'}`), ...r.items.filter((i) => i.leakTerms.length).map((i) => `- ${i.key} contained: ${i.leakTerms.map((t) => `"${t}"`).join(', ')} (${r.maskLeaks ? 'masked in what the reviewer read' : 'shown to the reviewer'}).`));
  const dis = disagreements(r, exp);
  if (dis.length) L.push('', '## Where the blinded scores and the recorded measurements disagree', '', ...dis.map((x) => `- ${x}`));
  L.push('', '## Limitations', '', `- ${r.items.length} output(s): a handful of subjective scores supports a direction at most, never a general claim.`, '- The rubric and the scoring are yours; the same person designed the experiment and judged the outputs.', '- Subjective scores are not objective correctness. Compare them with the measured results in the experiment report.', '');
  return L.join('\n') + '\n';
}

export const isBaseline = (exp: Experiment, conditionId: string): boolean => { const c = exp.conditions.find((x) => x.id === conditionId); return Boolean(c && isBaselineKind(c.kind)); };

/** Structured export. Before the reveal it omits everything that could identify a condition (condition, run, evidence ids, leak terms). */
export function reviewJson(r: BlindedReview): string {
  const safe = r.state === 'revealed' ? r : { ...r, guesses: {}, items: r.items.map((i) => ({ key: i.key, order: i.order, text: displayText(r, i) })) };
  return JSON.stringify({ format: 'claude-forge-blinded-review', version: 1, note: 'Scores are the reviewer\'s subjective judgement against a rubric fixed before any output was shown.', review: safe }, null, 2) + '\n';
}

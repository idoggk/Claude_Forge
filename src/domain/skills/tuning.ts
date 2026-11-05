import type { LiveTest, Scenario, SkillDraft } from './model';
import { predictActivation, tokens, triggerFingerprint, type TriggerPrediction } from './trigger';

/**
 * Trigger tuning: what you EXPECTED to happen (your scenarios) against what you MANUALLY RECORDED happened in a real
 * Claude Code session (live tests). Forge never observes Claude. Every count here comes from rows you entered, an
 * untested scenario is "untested" (never counted as a pass or a miss), and an observation made against an older
 * description is flagged and excluded from the rates, because it tested different wording.
 */
export type Outcome = 'true-positive' | 'false-negative' | 'partial' | 'false-positive' | 'true-negative' | 'ambiguous-observed' | 'unknown-observed' | 'untested';

export interface TuningRow {
  scenario: Scenario;
  /** The most recent live test for this scenario, if any. */
  observation: LiveTest | null;
  observationCount: number;
  outcome: Outcome;
  /** Recorded against different trigger wording than the current description. */
  stale: boolean;
  /** Recorded before fingerprints existed: the wording it tested is unknown. */
  versionUnknown: boolean;
  /** Lexical-overlap heuristic only (NOT how Claude decides). */
  prediction: TriggerPrediction;
  suggestion: string | null;
}

export interface TuningSummary {
  rows: TuningRow[];
  counts: Record<Outcome, number>;
  /** TP / (TP + FP). null (unmeasured) unless a should-NOT scenario has a current observation. */
  precision: number | null;
  /** TP / (TP + FN + partial). null when no should-activate scenario has a current observation. */
  recall: number | null;
  counted: { positives: number; negatives: number };
  level: 'none' | 'anecdotal' | 'weak' | 'limited';
  headline: string;
  notes: string[];
}

const empty = (): Record<Outcome, number> => ({ 'true-positive': 0, 'false-negative': 0, partial: 0, 'false-positive': 0, 'true-negative': 0, 'ambiguous-observed': 0, 'unknown-observed': 0, untested: 0 });

function classify(expected: Scenario['expected'], observed: LiveTest['observed']): Outcome {
  if (observed === 'unknown') return 'unknown-observed';
  if (expected === 'ambiguous') return 'ambiguous-observed';
  if (expected === 'activate') return observed === 'activated' ? 'true-positive' : observed === 'partial' ? 'partial' : 'false-negative';
  return observed === 'activated' || observed === 'partial' ? 'false-positive' : 'true-negative';
}

function suggestionFor(outcome: Outcome, draft: SkillDraft, scenario: Scenario, p: TriggerPrediction): string | null {
  const desc = new Set(tokens(`${draft.description} ${draft.whenToUse}`));
  if (outcome === 'false-negative' || outcome === 'partial') {
    const missing = tokens(scenario.prompt).filter((t) => !desc.has(t)).slice(0, 6);
    const lead = outcome === 'partial' ? 'It only activated after rephrasing.' : 'It did not activate.';
    return `${lead} ${missing.length ? `Words in the prompt that your description never uses: ${missing.join(', ')}. If a user would really type them, consider naming the symptom in those words (heuristic - confirm with a live retest).` : 'The prompt shares its words with the description, so the cause is probably not vocabulary: check the description is specific about WHEN to use the Skill, then retest.'}`;
  }
  if (outcome === 'false-positive') {
    const hit = p.matched.slice(0, 6);
    return `It activated when it should not have. ${hit.length ? `Words this prompt shares with your description: ${hit.join(', ')}. ` : ''}Add a "Not for…" boundary that names this kind of request, or make the matching words more specific, then retest (heuristic).`;
  }
  return null;
}

export function analyzeTuning(draft: SkillDraft): TuningSummary {
  const fingerprint = triggerFingerprint(draft.description, draft.whenToUse);
  const rows: TuningRow[] = draft.scenarios.map((scenario) => {
    const obs = draft.liveTests.filter((t) => t.scenarioId === scenario.id).sort((a, b) => a.testedAt.localeCompare(b.testedAt) || a.id.localeCompare(b.id));
    const observation = obs[obs.length - 1] ?? null;
    const prediction = predictActivation(draft.description, draft.whenToUse, scenario.prompt);
    const versionUnknown = Boolean(observation && !observation.descriptionFingerprint);
    const stale = Boolean(observation && observation.descriptionFingerprint && observation.descriptionFingerprint !== fingerprint);
    const outcome: Outcome = observation ? classify(scenario.expected, observation.observed) : 'untested';
    return { scenario, observation, observationCount: obs.length, outcome, stale, versionUnknown, prediction, suggestion: stale ? null : suggestionFor(outcome, draft, scenario, prediction) };
  });

  // Rates use only CURRENT observations. A stale row tested different wording, so it stays visible but out of the maths.
  const counts = empty();
  for (const r of rows) counts[r.stale ? 'untested' : r.outcome]++;
  const tp = counts['true-positive'];
  const fn = counts['false-negative'];
  const partial = counts.partial;
  const fp = counts['false-positive'];
  const tn = counts['true-negative'];
  // Precision is only meaningful once at least one should-NOT scenario has been observed; otherwise it is unmeasured, not 1.
  const precision = fp + tn > 0 && tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn + partial > 0 ? tp / (tp + fn + partial) : null;
  const positives = tp + fn + partial;
  const negatives = fp + tn;

  const notes: string[] = [];
  const stale = rows.filter((r) => r.stale).length;
  const unknownVersion = rows.filter((r) => r.versionUnknown).length;
  if (stale > 0) notes.push(`${stale} observation(s) were recorded against an older description and are excluded from the rates. Retest them.`);
  if (unknownVersion > 0) notes.push(`${unknownVersion} observation(s) were recorded before Forge tracked the wording they tested; they are counted, but may describe an older description.`);
  const untested = rows.filter((r) => r.outcome === 'untested').length;
  if (untested > 0) notes.push(`${untested} scenario(s) have no live observation yet. They are not counted as passes or misses.`);
  if (rows.some((r) => r.observationCount > 1)) notes.push('Where a scenario has several observations only the most recent counts; earlier ones stay in the live-test list.');

  const n = positives + negatives;
  let level: TuningSummary['level'];
  let headline: string;
  if (n === 0) { level = 'none'; headline = 'No current live observations: nothing can be said about how this description triggers in real Claude Code sessions.'; }
  else if (n < 4) { level = 'anecdotal'; headline = `Anecdotal: ${n} current observation(s). Too few to read a rate - treat each row as a single data point.`; }
  else if (n < 8) { level = 'weak'; headline = `Weak: ${n} current observations (${positives} should-activate, ${negatives} should-not). Rates are rough.`; }
  else { level = 'limited'; headline = `Limited: ${n} current observations. A directional reading at most - LLM behaviour varies run to run.`; }
  if (negatives === 0 && n > 0) notes.push('You have no current observation for a should-NOT-activate scenario, so false positives are unmeasured (not zero).');
  if (positives === 0 && n > 0) notes.push('You have no current observation for a should-activate scenario, so misses are unmeasured (not zero).');

  return { rows, counts, precision, recall, counted: { positives, negatives }, level, headline, notes };
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  'true-positive': 'Activated as expected',
  'false-negative': 'Missed (did not activate)',
  partial: 'Only after rephrasing',
  'false-positive': 'Activated when it should not',
  'true-negative': 'Stayed quiet as expected',
  'ambiguous-observed': 'Ambiguous scenario observed',
  'unknown-observed': 'Observed: not sure',
  untested: 'Not tested yet',
};

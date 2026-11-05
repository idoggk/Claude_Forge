import type { ActivityRun } from '@/persistence/schemas';
import { OPPORTUNITY_SCENARIOS, type Scenario } from '@/content/finder/scenarios';

export const FINDER_ACTIVITY_ID = 'opportunity-finder';
export const FINDER_VERSION = 1;
export const RUN_SIZE = 6;

export interface ScenarioResult {
  scenarioId: string;
  chosen: string | null;
  score: 0 | 0.5 | 1;
  verdict: 'best' | 'defensible' | 'missed' | 'unanswered';
}

export function scoreScenario(s: Scenario, chosen: string | null | undefined): ScenarioResult {
  if (!chosen) return { scenarioId: s.id, chosen: null, score: 0, verdict: 'unanswered' };
  if (chosen === s.correct) return { scenarioId: s.id, chosen, score: 1, verdict: 'best' };
  if (s.defensible && chosen === s.defensible.id) return { scenarioId: s.id, chosen, score: 0.5, verdict: 'defensible' };
  return { scenarioId: s.id, chosen, score: 0, verdict: 'missed' };
}

export function scoreRun(scenarios: Scenario[], answers: Record<string, string | null | undefined>): { results: ScenarioResult[]; score: number } {
  const results = scenarios.map((s) => scoreScenario(s, answers[s.id]));
  const score = scenarios.length === 0 ? 0 : results.reduce((a, r) => a + r.score, 0) / scenarios.length;
  return { results, score: Math.round(score * 100) / 100 };
}

/**
 * Pick the scenarios for the next run, preferring ones never answered correctly. Deterministic given the history, so
 * "run again" shows different scenarios until the pool is exhausted, then cycles.
 */
export function pickScenarios(history: Pick<ActivityRun, 'results'>[], size = RUN_SIZE, pool: Scenario[] = OPPORTUNITY_SCENARIOS): Scenario[] {
  const best = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const run of history) for (const r of run.results) {
    best.set(r.itemId, Math.max(best.get(r.itemId) ?? 0, r.score));
    seen.set(r.itemId, (seen.get(r.itemId) ?? 0) + 1);
  }
  // Unseen first, then seen-but-not-mastered (lowest best score), then mastered; ties by least-seen, then pool order.
  const ranked = pool
    .map((s, i) => ({ s, i, seen: seen.get(s.id) ?? 0, best: best.get(s.id) ?? -1 }))
    .sort((a, b) => (a.seen === 0 ? -1 : 0) - (b.seen === 0 ? -1 : 0) || a.best - b.best || a.seen - b.seen || a.i - b.i);
  return ranked.slice(0, Math.min(size, pool.length)).map((x) => x.s).sort((a, b) => pool.indexOf(a) - pool.indexOf(b));
}

/** Themes missed in the most recent run, with the lesson that teaches each. Used by the recommender; never changes a level. */
export function practiceGapsFromRuns(runs: Pick<ActivityRun, 'activityId' | 'takenAt' | 'results'>[]): { lessonId: string; label: string }[] {
  const latest = runs.filter((r) => r.activityId === FINDER_ACTIVITY_ID).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
  if (!latest) return [];
  const out: { lessonId: string; label: string }[] = [];
  for (const r of latest.results) {
    if (r.score >= 1) continue;
    const s = OPPORTUNITY_SCENARIOS.find((x) => x.id === r.itemId);
    if (s) out.push({ lessonId: s.lessonId, label: s.theme });
  }
  return out;
}

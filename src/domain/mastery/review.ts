import { addDaysToKey, compareKeys } from '@/lib/clock';
import type { ReviewRecord } from '@/persistence/schemas';

/**
 * Spaced review policy (a simple, explicit ladder - NOT an optimized or
 * personalized algorithm):
 *
 *   box 0 -> 1 day · box 1 -> 3 days · box 2 -> 7 days · box 3 -> 14 days
 *
 * After a review session of a few fresh items:
 *  - PASS (score >= 0.8, no hints, not overconfident-wrong): move up one box (stay at 3, due in 14 days).
 *  - PARTIAL (0.5 <= score < 0.8, or passed but used hints / was overconfident): stay in the same box.
 *  - FAIL (score < 0.5): back to box 0 (due tomorrow) and count a lapse.
 * Dates are local calendar days (YYYY-MM-DD), so DST and timezone changes cannot shift due dates.
 */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14] as const;
export const REVIEW_SESSION_SIZE = 3;

export type ReviewOutcome = 'pass' | 'partial' | 'fail';

export function intervalForBox(box: number): number {
  return REVIEW_INTERVALS_DAYS[Math.max(0, Math.min(3, box))]!;
}

export function classifyReview(input: { score: number; hintsUsed: number; overconfidentMiss: boolean }): ReviewOutcome {
  if (input.score < 0.5) return 'fail';
  if (input.score >= 0.8 && input.hintsUsed === 0 && !input.overconfidentMiss) return 'pass';
  return 'partial';
}

export function initialReview(lessonId: string, todayKey: string, nowIso: string): ReviewRecord {
  return {
    lessonId,
    box: 0,
    dueOn: addDaysToKey(todayKey, intervalForBox(0)),
    lapses: 0,
    cycle: 0,
    lastReviewedAt: null,
    lastOutcome: null,
    createdAt: nowIso,
    history: [],
  };
}

export function applyReviewOutcome(rec: ReviewRecord, outcome: ReviewOutcome, todayKey: string, nowIso: string, note = ''): ReviewRecord {
  const fromBox = rec.box;
  let box = fromBox;
  let lapses = rec.lapses;
  if (outcome === 'pass') box = Math.min(3, fromBox + 1);
  else if (outcome === 'fail') {
    box = 0;
    lapses += 1;
  }
  return {
    ...rec,
    box,
    lapses,
    cycle: rec.cycle + 1,
    dueOn: addDaysToKey(todayKey, intervalForBox(box)),
    lastReviewedAt: nowIso,
    lastOutcome: outcome,
    history: [...rec.history, { at: nowIso, outcome, fromBox, toBox: box, note }].slice(-50),
  };
}

export function isDue(rec: ReviewRecord, todayKey: string): boolean {
  return compareKeys(rec.dueOn, todayKey) <= 0;
}

export function dueReviews(recs: ReviewRecord[], todayKey: string): ReviewRecord[] {
  return recs.filter((r) => isDue(r, todayKey)).sort((a, b) => compareKeys(a.dueOn, b.dueOn) || a.lessonId.localeCompare(b.lessonId));
}

/** Rotate through the lesson's review pool so each session shows different items. */
export function pickReviewItems<T>(pool: T[], cycle: number, size = REVIEW_SESSION_SIZE): T[] {
  if (pool.length === 0) return [];
  const n = Math.min(size, pool.length);
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(pool[(cycle * n + i) % pool.length]!);
  return out;
}

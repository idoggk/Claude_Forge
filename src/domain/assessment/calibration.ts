import type { Attempt } from '@/persistence/schemas';

/** Confidence labels shown before a calibrated assessment. */
export const CONFIDENCE_LEVELS = [
  { value: 1, label: 'Mostly guessing', predictedPct: 20 },
  { value: 2, label: 'Unsure', predictedPct: 40 },
  { value: 3, label: 'Fairly sure', predictedPct: 60 },
  { value: 4, label: 'Confident', predictedPct: 80 },
  { value: 5, label: 'Certain', predictedPct: 95 },
] as const;

export function predictedPctFor(confidence: number): number {
  return CONFIDENCE_LEVELS.find((c) => c.value === confidence)?.predictedPct ?? 60;
}

export type CalibrationVerdict = 'overconfident' | 'underconfident' | 'calibrated';

/** gap > 0 means the learner predicted more than they scored. A band of ±25 points is treated as calibrated. */
export function calibrationVerdict(predictedPct: number, actualPct: number): { gap: number; verdict: CalibrationVerdict } {
  const gap = Math.round(predictedPct - actualPct);
  if (gap >= 25) return { gap, verdict: 'overconfident' };
  if (gap <= -25) return { gap, verdict: 'underconfident' };
  return { gap, verdict: 'calibrated' };
}

export function calibrationMessage(verdict: CalibrationVerdict, gap: number): string {
  if (verdict === 'overconfident')
    return `You predicted about ${Math.abs(gap)} points higher than you scored. That is useful information, not a penalty: look at which questions felt easy but were missed - those are the concepts to revisit first.`;
  if (verdict === 'underconfident')
    return `You scored about ${Math.abs(gap)} points higher than you predicted. Your understanding is stronger than you give yourself credit for - trust what you can verify.`;
  return 'Your prediction was close to your result. Calibrated confidence is what lets you decide when to double-check Claude\'s output and when to move on.';
}

export interface CalibrationSummary {
  count: number;
  meanGap: number | null;
  overconfident: number;
  underconfident: number;
  calibrated: number;
  byConfidence: { confidence: number; attempts: number; meanActualPct: number }[];
}

export function summarizeCalibration(attempts: Attempt[]): CalibrationSummary {
  const rated = attempts.filter((a) => a.predictedPct !== null && a.stage !== 'practice');
  const counts = { overconfident: 0, underconfident: 0, calibrated: 0 };
  let sum = 0;
  const buckets = new Map<number, number[]>();
  for (const a of rated) {
    const actual = a.score * 100;
    const { gap, verdict } = calibrationVerdict(a.predictedPct as number, actual);
    counts[verdict]++;
    sum += gap;
    if (a.confidence !== null) buckets.set(a.confidence, [...(buckets.get(a.confidence) ?? []), actual]);
  }
  return {
    count: rated.length,
    meanGap: rated.length ? Math.round(sum / rated.length) : null,
    ...counts,
    byConfidence: [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([confidence, xs]) => ({ confidence, attempts: xs.length, meanActualPct: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) })),
  };
}

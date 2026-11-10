import type { Lesson } from '../curriculum/types';
import type { Attempt } from '@/persistence/schemas';
import type { Mission, MissionRun } from './model';
import { misconceptionsHit } from '../mastery/reviewPlan';
import { getMisconception } from '@/content/misconceptions';

/**
 * A small, local, descriptive report about the learning experience itself. It is computed on this device from records the
 * learner already has; nothing is sent anywhere, and nothing here measures attention, effort or educational effectiveness.
 * Engagement is not mastery: finishing a mission quickly is not proof of understanding. Every figure carries its sample size, and
 * under five observations it is shown as "too few to say".
 */
export const MIN_SAMPLE = 5;
export const STALE_DAYS = 7;

export interface Stat { n: number; value: number | null; enough: boolean }
export const stat = (hits: number, n: number): Stat => ({ n, value: n === 0 ? null : hits / n, enough: n >= MIN_SAMPLE });

export interface UnitQuality {
  unitId: string; title: string; kind: Mission['kind'];
  started: number; completed: number; inProgress: number; abandoned: number; resumed: number;
  completionRate: Stat;
  hintRuns: Stat;
  /** Step ids where unfinished runs currently sit, with counts. */
  stuckAt: { stepId: string; count: number }[];
  /** Steps (other than predictions) whose checked answers were mostly wrong. */
  confusingSteps: { stepId: string; correct: Stat }[];
}

export interface QualityReport {
  units: UnitQuality[];
  /** Beliefs the learner chose more than once. */
  repeatedMisconceptions: { id: string; belief: string; times: number }[];
  /** Assessment items missed in most attempts, with the sample size. */
  weakAssessmentItems: { lessonId: string; itemId: string; missed: Stat }[];
  returnsAfterBreak: number;
  totals: { runs: number; completed: number; hintRuns: number };
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86_400_000);

export function qualityReport(input: { units: Mission[]; runs: MissionRun[]; attempts: Attempt[]; lessons: Lesson[]; today: string }): QualityReport {
  const { units, runs, attempts, lessons, today } = input;
  const unitReports: UnitQuality[] = units.map((u) => {
    const mine = runs.filter((r) => r.missionId === u.id);
    const completed = mine.filter((r) => r.status === 'completed');
    const open = mine.filter((r) => r.status === 'in-progress');
    const abandoned = open.filter((r) => daysBetween(r.updatedAt, today) >= STALE_DAYS);
    const stuck = new Map<string, number>();
    for (const r of open) stuck.set(r.stepId, (stuck.get(r.stepId) ?? 0) + 1);
    const byStep = new Map<string, { right: number; n: number }>();
    // A prediction is made before the idea is taught, so most first answers are expected to be wrong. That is not confusion.
    const predictIds = new Set(u.steps.filter((st) => st.phase === 'predict').map((st) => st.id));
    for (const r of mine) for (const res of r.results) { if (predictIds.has(res.stepId)) continue; const x = byStep.get(res.stepId) ?? { right: 0, n: 0 }; x.n++; if (res.correct) x.right++; byStep.set(res.stepId, x); }
    return {
      unitId: u.id, title: u.title, kind: u.kind,
      started: mine.length, completed: completed.length, inProgress: open.length, abandoned: abandoned.length, resumed: mine.filter((r) => r.resumes > 0).length,
      completionRate: stat(completed.length, mine.length),
      hintRuns: stat(mine.filter((r) => r.hintsUsed > 0).length, mine.length),
      stuckAt: [...stuck].map(([stepId, count]) => ({ stepId, count })).sort((a, b) => b.count - a.count),
      confusingSteps: [...byStep].filter(([, x]) => x.n >= MIN_SAMPLE && x.right / x.n < 0.4).map(([stepId, x]) => ({ stepId, correct: stat(x.right, x.n) })),
    };
  });

  const counts = new Map<string, number>();
  for (const h of misconceptionsHit(attempts, lessons)) counts.set(h.id, (counts.get(h.id) ?? 0) + 1);
  const repeatedMisconceptions = [...counts].filter(([, n]) => n >= 2).map(([id, times]) => ({ id, belief: getMisconception(id)?.belief ?? id, times })).sort((a, b) => b.times - a.times);

  const byItem = new Map<string, { lessonId: string; miss: number; n: number }>();
  for (const a of attempts) if (a.stage === 'assessment') for (const r of a.results) { if (r.selfAssessed || !r.answered) continue; const k = `${a.lessonId}/${r.itemId}`; const x = byItem.get(k) ?? { lessonId: a.lessonId, miss: 0, n: 0 }; x.n++; if (!r.correct) x.miss++; byItem.set(k, x); }
  const weakAssessmentItems = [...byItem].filter(([, x]) => x.n >= MIN_SAMPLE && x.miss / x.n >= 0.6).map(([k, x]) => ({ lessonId: x.lessonId, itemId: k.split('/')[1]!, missed: stat(x.miss, x.n) }));

  const days = [...new Set(runs.map((r) => r.updatedAt.slice(0, 10)))].sort();
  let returns = 0;
  for (let i = 1; i < days.length; i++) if (daysBetween(days[i - 1]!, days[i]!) >= 3) returns++;

  return { units: unitReports, repeatedMisconceptions, weakAssessmentItems, returnsAfterBreak: returns, totals: { runs: runs.length, completed: runs.filter((r) => r.status === 'completed').length, hintRuns: runs.filter((r) => r.hintsUsed > 0).length } };
}

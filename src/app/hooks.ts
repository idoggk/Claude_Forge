import { getDb } from '@/persistence/db';
import { useLive } from '@/persistence/useLive';
import type { Attempt, CompetencyRecord, DiagnosticRecord, FieldEvidence, LessonProgress, ReviewRecord } from '@/persistence/schemas';

export interface LearningState {
  attempts: Attempt[];
  progress: LessonProgress[];
  reviews: ReviewRecord[];
  competencies: CompetencyRecord[];
  field: FieldEvidence[];
  diagnostics: DiagnosticRecord[];
}

/** One live subscription for everything the learning engine needs. */
export function useLearning() {
  return useLive<LearningState>(async () => {
    const db = getDb();
    const [attempts, progress, reviews, competencies, field, diagnostics] = await Promise.all([
      db.attempts.toArray(),
      db.lessonProgress.toArray(),
      db.reviews.toArray(),
      db.competencies.toArray(),
      db.fieldEvidence.toArray(),
      db.diagnostics.toArray(),
    ]);
    return { attempts, progress, reviews, competencies, field, diagnostics };
  });
}

export function useProfileLive() {
  return useLive(() => getDb().profile.get('me'));
}

export function useArsenal() {
  return useLive(() => getDb().arsenal.toArray());
}

export function useSkills() {
  return useLive(() => getDb().customSkills.orderBy('updatedAt').reverse().toArray());
}

export function useExperiments() {
  return useLive(() => getDb().experiments.orderBy('updatedAt').reverse().toArray());
}

export function useGoals() {
  return useLive(() => getDb().goals.orderBy('updatedAt').reverse().toArray());
}

export function usePlaybooks() {
  return useLive(() => getDb().playbooks.orderBy('updatedAt').reverse().toArray());
}

export function useActivityRuns() {
  return useLive(() => getDb().activityRuns.orderBy('takenAt').reverse().toArray());
}

export function useTransferTasks() {
  return useLive(() => getDb().transferTasks.orderBy('updatedAt').reverse().toArray());
}

export function useTakeaways() {
  return useLive(() => getDb().takeaways.orderBy('updatedAt').reverse().toArray());
}

export function useMissionRuns() {
  return useLive(() => getDb().missionRuns.orderBy('updatedAt').reverse().toArray());
}

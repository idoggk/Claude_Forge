import type { LearningGoal } from '@/domain/goals/model';
import { CAPABILITY_BY_ID } from './map';

/** Resolve active goals to the lessons that teach their capabilities, for the recommender. */
export function goalLessons(goals: LearningGoal[]): { lessonId: string; goalTitle: string; capabilityTitle: string }[] {
  const out: { lessonId: string; goalTitle: string; capabilityTitle: string }[] = [];
  for (const g of goals) {
    if (g.status !== 'active') continue;
    for (const id of g.capabilityIds) {
      const cap = CAPABILITY_BY_ID.get(id);
      if (!cap) continue;
      for (const lessonId of cap.lessons) out.push({ lessonId, goalTitle: g.title, capabilityTitle: cap.title });
    }
  }
  return out;
}

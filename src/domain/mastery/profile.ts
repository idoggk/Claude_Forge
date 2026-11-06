import type { CompetencyArea } from '@/domain/curriculum/competencies';
import type { CompetencyId, Lesson } from '@/domain/curriculum/types';
import type { CompetencyEvaluation } from './competency';
import { LEVEL_NAMES } from './competency';
import { lessonStatus } from './recommend';
import type { ActivityRun, Attempt, FieldEvidence, LessonProgress, ReviewRecord } from '@/persistence/schemas';
import { COMPETENCY_BY_ID } from '@/domain/curriculum/competencies';
import { compareKeys } from '@/lib/clock';

/**
 * The Personal AI Mastery Profile. It is a VIEW over evidence the app already holds - it adds no levels of its own.
 * An area with no lessons yet is "planned": shown, with no bar and no level. The area state is driven by its WEAKEST
 * competency, so one strong concept cannot hide a weak one. Practice runs (the Opportunity Finder) are counted as
 * practice, and never change a level.
 */
export type AreaState = 'planned' | 'not-started' | 'building' | 'independent' | 'field-proven';

export interface AreaProfile {
  area: CompetencyArea;
  state: AreaState;
  competencies: { id: CompetencyId; title: string; level: number; levelName: string; blockedReason: string | null }[];
  lessonsPassed: number;
  lessonsTotal: number;
  reviewsDue: number;
  fieldNotes: number;
  practiceRuns: number;
  /** One factual sentence about the evidence behind the state. */
  evidenceLine: string;
  /** Why the suggested next step is suggested, and where it goes. Null for planned areas and fully evidenced ones. */
  next: { text: string; to: string } | null;
}

export const STATE_LABEL: Record<AreaState, string> = {
  planned: 'Planned - no lessons yet',
  'not-started': 'Not started',
  building: 'Building',
  independent: 'Independent application',
  'field-proven': 'Field-proven',
};

export interface ProfileInput {
  areas: CompetencyArea[];
  lessons: Lesson[];
  evaluations: CompetencyEvaluation[];
  attempts: Attempt[];
  progress: LessonProgress[];
  reviews: ReviewRecord[];
  field: FieldEvidence[];
  activityRuns: Pick<ActivityRun, 'activityId' | 'results'>[];
  today: string;
}

export function buildMasteryProfile(i: ProfileInput): AreaProfile[] {
  const level = new Map(i.evaluations.map((e) => [e.competencyId, e]));
  return i.areas.map((area) => {
    if (area.competencyIds.length === 0) {
      return { area, state: 'planned', competencies: [], lessonsPassed: 0, lessonsTotal: 0, reviewsDue: 0, fieldNotes: 0, practiceRuns: 0, evidenceLine: area.plannedNote ?? 'No lessons exist for this area yet. Nothing is claimed.', next: null };
    }
    const comps = area.competencyIds.map((id) => {
      const e = level.get(id);
      const lv = e?.level ?? 0;
      return { id, title: COMPETENCY_BY_ID[id]?.title ?? id, level: lv, levelName: LEVEL_NAMES[lv] ?? 'Unseen', blockedReason: e?.blockedReason ?? null };
    });
    const lessons = i.lessons.filter((l) => l.competencies.some((c) => area.competencyIds.includes(c)));
    const passed = lessons.filter((l) => lessonStatus(l, i.attempts, i.progress) === 'passed');
    const dueIds = new Set(i.reviews.filter((r) => compareKeys(r.dueOn, i.today) <= 0).map((r) => r.lessonId));
    const reviewsDue = lessons.filter((l) => dueIds.has(l.id)).length;
    const fieldNotes = i.field.filter((f) => f.competencyIds.some((c) => area.competencyIds.includes(c as CompetencyId))).length;
    const practiceRuns = area.id === 'tool-selection' ? i.activityRuns.filter((r) => r.activityId === 'opportunity-finder').length : 0;
    const min = Math.min(...comps.map((c) => c.level));
    const max = Math.max(...comps.map((c) => c.level));
    const state: AreaState = min >= 4 ? 'field-proven' : min >= 3 ? 'independent' : max >= 1 ? 'building' : 'not-started';

    const weakest = [...comps].sort((a, b) => a.level - b.level)[0]!;
    const todo = lessons.filter((l) => lessonStatus(l, i.attempts, i.progress) !== 'passed' && l.competencies.includes(weakest.id)).sort((a, b) => a.order - b.order)[0]
      ?? lessons.filter((l) => lessonStatus(l, i.attempts, i.progress) !== 'passed').sort((a, b) => a.order - b.order)[0];
    let next: AreaProfile['next'] = null;
    if (reviewsDue > 0) {
      const l = lessons.find((x) => dueIds.has(x.id))!;
      next = { text: `A review is due on "${l.title}" - retrieval practice keeps the level you earned.`, to: `/academy/review/${l.id}` };
    } else if (todo) {
      next = { text: `Your weakest concept here is ${weakest.title} (${weakest.levelName}); "${todo.title}" builds it.`, to: `/academy/lesson/${todo.id}` };
    } else if (min < 4) {
      next = { text: 'All lessons here are passed. Level 4 needs real-work evidence you log yourself (it cannot be earned in the app).', to: '/growth' };
    }
    const evidenceLine = `${passed.length} of ${lessons.length} lesson${lessons.length === 1 ? '' : 's'} passed · ${reviewsDue} review${reviewsDue === 1 ? '' : 's'} due · ${fieldNotes} field note${fieldNotes === 1 ? '' : 's'}${practiceRuns ? ` · ${practiceRuns} practice run${practiceRuns === 1 ? '' : 's'} (do not change levels)` : ''}`;
    return { area, state, competencies: comps, lessonsPassed: passed.length, lessonsTotal: lessons.length, reviewsDue, fieldNotes, practiceRuns, evidenceLine, next };
  });
}

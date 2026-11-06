import type { Lesson } from '@/domain/curriculum/types';
import { TRACKS } from '@/domain/curriculum/competencies';
import type { Attempt, LessonProgress } from '@/persistence/schemas';
import { lessonStatus, prerequisitesMet } from './recommend';

/** What Home shows for one learning path. Every figure is a count of real lessons or real attempts, with its denominator. */
export interface PathStats {
  /** Lessons that exist today in this path. */
  total: number;
  passed: number;
  started: number;
  /** Topics in this path's tracks that have no lesson yet. They are PLANNED and never counted as available. */
  plannedTopics: number;
  /** The lesson to open: the first unpassed one whose prerequisites are met (a started one first), else the first unpassed. */
  next: Lesson | null;
}

export function pathStats(trackIds: string[], lessons: Lesson[], attempts: Attempt[], progress: LessonProgress[]): PathStats {
  const mine = lessons.filter((l) => trackIds.includes(l.track)).sort((a, b) => a.order - b.order);
  const status = (l: Lesson) => lessonStatus(l, attempts, progress);
  const passed = mine.filter((l) => status(l) === 'passed').length;
  const started = mine.filter((l) => ['in-progress', 'attempted'].includes(status(l))).length;
  const open = mine.filter((l) => status(l) !== 'passed');
  const ready = open.filter((l) => prerequisitesMet(l, lessons, attempts, progress).met);
  const next = ready.find((l) => ['in-progress', 'attempted'].includes(status(l))) ?? ready[0] ?? open[0] ?? null;
  const plannedTopics = TRACKS.filter((t) => trackIds.includes(t.id)).reduce((a, t) => a + t.topics.filter((x) => !x.lessonId).length, 0);
  return { total: mine.length, passed, started, plannedTopics, next };
}

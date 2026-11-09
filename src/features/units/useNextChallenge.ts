import { useMemo } from 'react';
import { useLearning, useMissionRuns } from '@/app/hooks';
import { LESSONS } from '@/content/lessons';
import { UNITS } from '@/content/units/registry';
import { isDue } from '@/domain/mastery/review';
import { lessonStatus } from '@/domain/mastery/recommend';
import { nextChallenge, pickMission, pickSpark, type Challenge } from '@/domain/missions/next';
import type { Mission } from '@/domain/missions/model';
import { useAdaptive } from '@/features/practice/useAdaptive';
import { todayKey } from '@/lib/clock';

export interface LearningNow { challenge: Challenge; dueReviews: number; spark: Mission | null; mission: Mission | null }

/** What to put in front of the learner right now, from their own records. Null while loading. */
export function useNextChallenge(options: { ignoreDue?: boolean } = {}): LearningNow | null {
  const { data: l } = useLearning();
  const { data: runs } = useMissionRuns();
  const suggestions = useAdaptive();
  return useMemo(() => {
    if (!l || !runs || !suggestions) return null;
    const today = todayKey();
    const dueReviews = options.ignoreDue ? 0 : l.reviews.filter((r) => isDue(r, today)).length;
    const passed = new Set(LESSONS.filter((x) => lessonStatus(x, l.attempts, l.progress) === 'passed').map((x) => x.id));
    const hasHistory = l.attempts.length > 0 || runs.length > 0 || l.reviews.length > 0 || l.progress.length > 0;
    const challenge = nextChallenge({ units: UNITS, runs, suggestions, dueReviews, passedLessonIds: passed, hasHistory });
    const focus = suggestions[0]?.competencies ?? [];
    return { challenge, dueReviews: l.reviews.filter((r) => isDue(r, today)).length, spark: pickSpark(UNITS, runs, focus), mission: pickMission(UNITS, runs, passed) };
  }, [l, runs, suggestions, options.ignoreDue]);
}

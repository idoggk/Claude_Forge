import { useMemo } from 'react';
import { useLearning, useTransferTasks } from '@/app/hooks';
import { LESSONS } from '@/content/lessons';
import { adaptiveSuggestions, type AdaptiveSuggestion } from '@/domain/mastery/adaptive';
import { misconceptionsHit } from '@/domain/mastery/reviewPlan';

/** The learner's next practice, from their own records. Null while loading. */
export function useAdaptive(): AdaptiveSuggestion[] | null {
  const { data: l } = useLearning();
  const { data: transfers } = useTransferTasks();
  return useMemo(() => {
    if (!l || !transfers) return null;
    return adaptiveSuggestions({ lessons: LESSONS, attempts: l.attempts, misconceptionHits: misconceptionsHit(l.attempts, LESSONS), completedTransfers: transfers.filter((t) => t.status === 'completed').length });
  }, [l, transfers]);
}

import { useMemo } from 'react';
import { useActivityRuns, useArsenal, useExperiments, useLearning, usePlaybooks, useTakeaways, useTransferTasks } from '@/app/hooks';
import { getDb } from '@/persistence/db';
import { useLive } from '@/persistence/useLive';
import { LESSONS } from '@/content/lessons';
import { lessonStatus } from '@/domain/mastery/recommend';
import type { PathwayEvidence } from '@/domain/mastery/pathways';
import { FINDER_ACTIVITY_ID } from '@/domain/finder/score';

export function usePathwayEvidence(): PathwayEvidence | null {
  const { data: l } = useLearning();
  const { data: runs } = useActivityRuns();
  const { data: exps } = useExperiments();
  const { data: transfers } = useTransferTasks();
  const { data: takeaways } = useTakeaways();
  const { data: playbooks } = usePlaybooks();
  const { data: arsenal } = useArsenal();
  const { data: loops } = useLive(() => getDb().loops.count());
  return useMemo(() => {
    if (!l || !runs || !exps || !transfers || !takeaways || !playbooks || !arsenal || loops === undefined) return null;
    const withRuns = exps.filter((e) => e.runs.length > 0);
    return {
      passedLessonIds: new Set(LESSONS.filter((x) => lessonStatus(x, l.attempts, l.progress) === 'passed').map((x) => x.id)),
      challengeIdsRun: new Set(runs.filter((r) => r.activityId.startsWith('challenge:')).map((r) => r.activityId.slice(10))),
      experimentsWithRuns: withRuns.length,
      pilotExperimentsWithRuns: withRuns.filter((e) => e.pilot).length,
      loops,
      arsenalEntries: arsenal.length,
      playbooks: playbooks.length,
      completedTransfers: transfers.filter((t) => t.status === 'completed').length,
      takeaways: takeaways.length,
      finderRuns: runs.filter((r) => r.activityId === FINDER_ACTIVITY_ID).length,
    };
  }, [l, runs, exps, transfers, takeaways, playbooks, arsenal, loops]);
}

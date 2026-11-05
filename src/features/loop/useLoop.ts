import { useLive } from '@/persistence/useLive';
import { getDb } from '@/persistence/db';
import { loadLoop, type LoopBundle } from '@/persistence/loopRepo';

export function useLoopBundle(loopId: string) {
  return useLive<LoopBundle | null>(() => loadLoop(loopId), [loopId]);
}

export function useLoops() {
  return useLive(() => getDb().loops.orderBy('updatedAt').reverse().toArray());
}

import type { Pathway, PathwayStep, StepTarget } from '@/content/pathways';

/** Records on this device that a pathway step can be matched against. */
export interface PathwayEvidence {
  passedLessonIds: ReadonlySet<string>;
  challengeIdsRun: ReadonlySet<string>;
  /** Experiments (any type) with at least one recorded run. */
  experimentsWithRuns: number;
  /** Of those, the ones started from the guided /pilot flow. */
  pilotExperimentsWithRuns: number;
  loops: number;
  arsenalEntries: number;
  playbooks: number;
  completedTransfers: number;
  takeaways: number;
  finderRuns: number;
}

export function stepHref(t: StepTarget): string {
  if (t.kind === 'lesson') return `/academy/lesson/${t.lessonId}`;
  if (t.kind === 'challenge') return `/challenges/${t.challengeId}`;
  return t.to;
}

/** A step is done only when the matching record exists. Visiting a page never marks anything done. */
export function stepDone(step: PathwayStep, ev: PathwayEvidence): boolean {
  const t = step.target;
  if (t.kind === 'lesson') return ev.passedLessonIds.has(t.lessonId);
  if (t.kind === 'challenge') return ev.challengeIdsRun.has(t.challengeId);
  switch (t.to) {
    case '/academy/opportunity-finder': return ev.finderRuns > 0;
    case '/pilot': return ev.pilotExperimentsWithRuns > 0;
    case '/battle-lab': return ev.experimentsWithRuns > 0;
    case '/loop': return ev.loops > 0;
    case '/discovery': return ev.arsenalEntries > 0;
    case '/playbooks': return ev.playbooks > 0;
    case '/transfer': return ev.completedTransfers > 0;
    case '/library/new': return ev.takeaways > 0;
    default: return false;
  }
}

export interface PathwayProgress { done: number; total: number; next: PathwayStep | null; steps: { step: PathwayStep; done: boolean }[] }
export function pathwayProgress(p: Pathway, ev: PathwayEvidence): PathwayProgress {
  const steps = p.steps.map((step) => ({ step, done: stepDone(step, ev) }));
  return { done: steps.filter((s) => s.done).length, total: steps.length, next: steps.find((s) => !s.done)?.step ?? null, steps };
}

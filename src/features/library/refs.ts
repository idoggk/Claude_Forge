import { useMemo } from 'react';
import { useArsenal, useExperiments, useGoals, usePlaybooks, useSkills, useTransferTasks } from '@/app/hooks';
import { CHALLENGES } from '@/content/challenges';
import { getEntry } from '@/content/catalog/entries';
import { LESSONS } from '@/content/lessons';
import { COMPETENCIES } from '@/domain/curriculum/competencies';
import type { ReferenceKind } from '@/domain/library/model';

export interface RefOption { id: string; label: string }

/** Everything a takeaway can point at, from this device's own data and the built-in content. Null while loading. */
export function useReferenceTargets(): Record<ReferenceKind, RefOption[]> | null {
  const { data: playbooks } = usePlaybooks();
  const { data: experiments } = useExperiments();
  const { data: goals } = useGoals();
  const { data: arsenal } = useArsenal();
  const { data: skills } = useSkills();
  const { data: transfers } = useTransferTasks();
  return useMemo(() => {
    if (!playbooks || !experiments || !goals || !arsenal || !skills || !transfers) return null;
    return {
      playbook: playbooks.map((p) => ({ id: p.id, label: p.title })),
      'lab-report': experiments.map((e) => ({ id: e.id, label: e.title })),
      goal: goals.map((g) => ({ id: g.id, label: g.title })),
      arsenal: arsenal.map((a) => ({ id: a.entryId, label: getEntry(a.entryId)?.displayName ?? skills.find((s) => `custom:${s.id}` === a.entryId)?.name ?? a.entryId })),
      competency: COMPETENCIES.map((c) => ({ id: c.id, label: c.title })),
      lesson: LESSONS.map((l) => ({ id: l.id, label: `Lesson ${l.order}: ${l.title}` })),
      challenge: CHALLENGES.map((c) => ({ id: c.id, label: c.title })),
      transfer: transfers.map((t) => ({ id: t.id, label: t.title })),
    };
  }, [playbooks, experiments, goals, arsenal, skills, transfers]);
}

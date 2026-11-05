import type { Item } from '../curriculum/types';

/** Misconception ids carried by the WRONG options the learner selected on a single/multi item. */
export function pickedMisconceptions(item: Item, answer: unknown): string[] {
  if (item.kind !== 'single' && item.kind !== 'multi') return [];
  const picked = new Set(Array.isArray(answer) ? (answer as unknown[]).filter((x): x is string => typeof x === 'string') : typeof answer === 'string' ? [answer] : []);
  const correct = new Set(item.kind === 'single' ? [item.correct] : item.correct);
  const ids: string[] = [];
  for (const o of item.options) if (picked.has(o.id) && !correct.has(o.id) && o.misconception && !ids.includes(o.misconception)) ids.push(o.misconception);
  return ids;
}

import type { Item } from '../curriculum/types';

/** Misconception ids carried by the WRONG options the learner selected on a single/multi item. */
export function pickedMisconceptions(item: Item, answer: unknown): string[] {
  if (item.kind === 'case') {
    const map = answer && typeof answer === 'object' && !Array.isArray(answer) ? (answer as Record<string, unknown>) : {};
    const out: string[] = [];
    for (const part of item.parts) for (const o of part.options) if (map[part.id] === o.id && o.id !== part.correct && o.misconception && !out.includes(o.misconception)) out.push(o.misconception);
    return out;
  }
  if (item.kind !== 'single' && item.kind !== 'multi') return [];
  const picked = new Set(Array.isArray(answer) ? (answer as unknown[]).filter((x): x is string => typeof x === 'string') : typeof answer === 'string' ? [answer] : []);
  const correct = new Set(item.kind === 'single' ? [item.correct] : item.correct);
  const ids: string[] = [];
  for (const o of item.options) if (picked.has(o.id) && !correct.has(o.id) && o.misconception && !ids.includes(o.misconception)) ids.push(o.misconception);
  return ids;
}

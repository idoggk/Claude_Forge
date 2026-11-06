import type { Item } from '@/domain/curriculum/types';

/** The answer a perfect learner would give. */
const natural = (groups: { anyOf: string[] }[]) => groups.map((g) => `we need ${g.anyOf[0]} here because it matters`).join(' and also ');

export function perfectAnswer(item: Item): unknown {
  switch (item.kind) {
    case 'single': return item.correct;
    case 'multi': return item.correct;
    case 'classify': return Object.fromEntries(item.entries.map((e) => [e.id, e.correct]));
    case 'order': return item.steps.map((s) => s.id);
    case 'numeric': return typeof item.answer === 'function' ? item.answer() : item.answer;
    case 'keywords': return natural(item.groups);
    case 'fields': return Object.fromEntries(item.fields.map((f) => [f.id, natural(f.groups)]));
    case 'flaglines': return item.targets.map((t) => t.line);
    case 'reflect': return Object.fromEntries(item.rubric.map((_, i) => [String(i), true]));
    case 'external': return undefined;
  }
}

export function perfectAnswers(items: Item[]): Record<string, unknown> {
  return Object.fromEntries(items.filter((i) => i.kind !== 'external').map((i) => [i.id, perfectAnswer(i)]));
}

/** A deliberately wrong answer for an item. */
export function wrongAnswer(item: Item): unknown {
  switch (item.kind) {
    case 'single': return item.options.find((o) => o.id !== item.correct)!.id;
    case 'multi': return [item.options.find((o) => !item.correct.includes(o.id))!.id];
    case 'classify': return Object.fromEntries(item.entries.map((e) => [e.id, item.categories.find((c) => c.id !== e.correct)!.id]));
    case 'order': return [...item.steps].reverse().map((s) => s.id);
    case 'numeric': return 987654;
    case 'keywords': return 'no idea';
    case 'fields': return Object.fromEntries(item.fields.map((f) => [f.id, 'no idea']));
    case 'flaglines': return [];
    default: return undefined;
  }
}

export function wrongAnswers(items: Item[]): Record<string, unknown> {
  return Object.fromEntries(items.filter((i) => i.kind !== 'external').map((i) => [i.id, wrongAnswer(i)]));
}

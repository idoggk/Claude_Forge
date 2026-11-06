/**
 * Learning-quality audit. Pure functions over the lesson content that measure the ways a multiple-choice or keyword
 * assessment can be passed WITHOUT understanding: the right option being the longest one, the right option sitting in
 * a predictable place, the answer being repeated in the question, weak distractors, "all of the above" shortcuts,
 * and written answers that a list of accepted words satisfies. The thresholds live in tests/unit/learning-quality.test.ts.
 */
import type { Item, Lesson, MultiItem, SingleItem } from './types';
import { LESSONS } from '@/content/lessons';

export interface AuditItem { lessonId: string; where: 'activity' | 'assessment' | 'review'; item: Item }

export function allItems(lessons: Lesson[] = LESSONS): AuditItem[] {
  return lessons.flatMap((l) => [
    ...l.activity.items.map((item) => ({ lessonId: l.id, where: 'activity' as const, item })),
    ...l.assessment.items.map((item) => ({ lessonId: l.id, where: 'assessment' as const, item })),
    ...l.reviewItems.map((item) => ({ lessonId: l.id, where: 'review' as const, item })),
  ]);
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
const STOP = new Set('a an the and or of to in on for is are be it its this that with as at by from not no do does can you your we they them their i if so but than then into over about which what when how why'.split(' '));
const content = (s: string) => words(s).filter((w) => !STOP.has(w) && w.length > 2);

export function choiceItems(items: AuditItem[]): (AuditItem & { item: SingleItem | MultiItem })[] {
  return items.filter((x): x is AuditItem & { item: SingleItem | MultiItem } => x.item.kind === 'single' || x.item.kind === 'multi');
}
const correctIds = (i: SingleItem | MultiItem) => (i.kind === 'single' ? [i.correct] : i.correct);

/** Share of single-answer items whose correct option is strictly the longest by at least 25%. A high share lets a learner pick by length. */
export function longestCorrectShare(items: AuditItem[]): { share: number; n: number; offenders: string[] } {
  const singles = choiceItems(items).filter((x) => x.item.kind === 'single' && x.item.options.length >= 3) as (AuditItem & { item: SingleItem })[];
  const offenders = singles.filter(({ item }) => {
    const c = item.options.find((o) => o.id === item.correct)!;
    const others = item.options.filter((o) => o.id !== item.correct);
    return others.every((o) => c.text.length >= o.text.length * 1.25);
  }).map((x) => `${x.lessonId}/${x.item.id}`);
  return { share: singles.length ? offenders.length / singles.length : 0, n: singles.length, offenders };
}

/** Distribution of the correct option's position across single-answer items with 4 options. */
export function correctPositionCounts(items: AuditItem[]): { counts: number[]; n: number } {
  const counts = [0, 0, 0, 0];
  let n = 0;
  for (const { item } of choiceItems(items)) {
    if (item.kind !== 'single' || item.options.length !== 4) continue;
    const idx = item.options.findIndex((o) => o.id === item.correct);
    if (idx >= 0) { counts[idx]!++; n++; }
  }
  return { counts, n };
}

/** Items whose correct option mostly repeats the prompt's own words, so the answer is visible in the question. */
export function answerEchoesPrompt(items: AuditItem[], threshold = 0.8): string[] {
  const out: string[] = [];
  for (const { lessonId, item } of choiceItems(items)) {
    const p = new Set(content(item.prompt));
    for (const o of item.options.filter((x) => correctIds(item).includes(x.id))) {
      const c = content(o.text);
      if (c.length >= 4 && c.filter((w) => p.has(w)).length / c.length >= threshold) out.push(`${lessonId}/${item.id}`);
    }
  }
  return [...new Set(out)];
}

/** Options such as "all of the above" or "none of the above" let a learner answer by elimination. */
export function shortcutOptions(items: AuditItem[]): string[] {
  return choiceItems(items).filter(({ item }) => item.options.some((o) => /\b(all|none) of the (above|options)\b|\bboth (a|b)\b/i.test(o.text))).map((x) => `${x.lessonId}/${x.item.id}`);
}

/** Distractors that carry no explanation, or that are far shorter than the right answer, are weak. */
export function weakDistractors(items: AuditItem[]): string[] {
  const out: string[] = [];
  for (const { lessonId, item } of choiceItems(items)) {
    const ids = correctIds(item);
    for (const o of item.options) if (!ids.includes(o.id) && o.why.trim().split(/\s+/).length < 4) out.push(`${lessonId}/${item.id}:${o.id}`);
  }
  return out;
}

/** Near-duplicate prompts within the whole curriculum (the same question asked twice reads as repetition, and review pools should be unseen). */
export function duplicatePrompts(items: AuditItem[], minOverlap = 0.85): [string, string][] {
  const seen = items.map((x) => ({ key: `${x.lessonId}/${x.item.id}`, set: new Set(content(x.item.prompt)) })).filter((x) => x.set.size >= 6);
  const out: [string, string][] = [];
  for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) {
    const a = seen[i]!, b = seen[j]!;
    const inter = [...a.set].filter((w) => b.set.has(w)).length;
    if (inter / Math.min(a.set.size, b.set.size) >= minOverlap) out.push([a.key, b.key]);
  }
  return out;
}

/** A review item must not repeat an assessment prompt of its own lesson: it is meant to be unseen. */
export function reviewRepeatsAssessment(lessons: Lesson[] = LESSONS): string[] {
  return lessons.flatMap((l) => {
    const a = l.assessment.items.map((i) => new Set(content(i.prompt)));
    return l.reviewItems.filter((r) => a.some((s) => { const rs = content(r.prompt); const hits = rs.filter((w) => s.has(w)).length; return rs.length >= 6 && hits / rs.length >= 0.9; })).map((r) => `${l.id}/${r.id}`);
  });
}

/** Written-answer items (keywords and fields) in the curriculum. */
export function writtenItems(items: AuditItem[]) { return items.filter((x) => x.item.kind === 'keywords' || x.item.kind === 'fields'); }

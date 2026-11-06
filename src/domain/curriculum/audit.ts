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
  // Items whose longest option is under 25 characters (case names, identifiers, numbers) have no room for a length cue and are skipped.
  const singles = (choiceItems(items).filter((x) => x.item.kind === 'single' && x.item.options.length >= 3) as (AuditItem & { item: SingleItem })[]).filter((x) => Math.max(...x.item.options.map((o) => o.text.length)) >= 25);
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


/* ------------------------------------------------------------------------------------------ Round 6 additions */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Two options of one item that say the same thing (identical after normalising, or 90% shared content words). */
/** Editorial exceptions: pairs that differ in meaning although their words normalise to the same text. Add a reason when you add one. */
export const DUPLICATE_CHOICE_EXCEPTIONS = new Set([
  'L05-first-custom-skill/l05-r4:a~b', // ~/.claude/skills (personal) versus .claude/skills (project): the leading ~/ is the whole point
]);

export function duplicateChoices(items: AuditItem[]): string[] {
  const out: string[] = [];
  for (const { lessonId, item } of choiceItems(items)) {
    const opts = item.options.map((o) => ({ id: o.id, n: norm(o.text), w: new Set(content(o.text)) }));
    for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) {
      const a = opts[i]!, b = opts[j]!;
      const inter = [...a.w].filter((w) => b.w.has(w)).length;
      const small = Math.min(a.w.size, b.w.size);
      if (a.n === b.n || (small >= 6 && inter / small >= 0.9)) {
        const id = `${lessonId}/${item.id}:${a.id}~${b.id}`;
        if (!DUPLICATE_CHOICE_EXCEPTIONS.has(id)) out.push(id);
      }
    }
  }
  return out;
}

const ABSOLUTE = /\b(always|never|only|all|every|entirely|completely|just|simply|guarantees?|proves?|nothing|no one)\b/i;
/** Share of wrong options that contain an absolute word, against the share of right options that do. A big gap lets a learner reject options by wording. */
export function absoluteWordCue(items: AuditItem[]): { wrong: number; right: number; nWrong: number; nRight: number } {
  let wrong = 0, right = 0, nWrong = 0, nRight = 0;
  for (const { item } of choiceItems(items)) for (const o of item.options) {
    const isRight = correctIds(item).includes(o.id);
    const has = ABSOLUTE.test(o.text);
    if (isRight) { nRight++; if (has) right++; } else { nWrong++; if (has) wrong++; }
  }
  return { wrong: nWrong ? wrong / nWrong : 0, right: nRight ? right / nRight : 0, nWrong, nRight };
}

/** The correct option of one assessment item largely restated in another item's prompt of the same lesson, so one question gives away another. */
export function answerRevealedElsewhere(lessons: Lesson[] = LESSONS, threshold = 0.8): string[] {
  const out: string[] = [];
  for (const l of lessons) for (const where of ['activity', 'assessment'] as const) {
    const items = where === 'activity' ? l.activity.items : l.assessment.items;
    for (const it of items) {
      if (it.kind !== 'single' && it.kind !== 'multi') continue;
      for (const o of it.options.filter((x) => correctIds(it).includes(x.id))) {
        const c = content(o.text);
        if (c.length < 6) continue;
        for (const other of items) {
          if (other.id === it.id) continue;
          const p = new Set(content(other.prompt));
          if (c.filter((w) => p.has(w)).length / c.length >= threshold) out.push(`${l.id}/${it.id} answer appears in ${other.id}`);
        }
      }
    }
  }
  return out;
}

/** Choice items with fewer than 3 options, or with an option whose text is empty or only punctuation. */
export function malformedChoices(items: AuditItem[]): string[] {
  return choiceItems(items).filter(({ item }) => item.options.length < 3 || item.options.some((o) => norm(o.text).length < 1)).map((x) => `${x.lessonId}/${x.item.id}`);
}

/** Wrong options with a feedback line that is not an explanation (under 4 words) or only repeats the option text. */
export function emptyFeedback(items: AuditItem[]): string[] {
  const out: string[] = [];
  for (const { lessonId, item } of choiceItems(items)) for (const o of item.options) {
    const why = norm(o.why);
    if (!why || why.split(' ').length < 2 || why === norm(o.text)) out.push(`${lessonId}/${item.id}:${o.id}`);
  }
  return out;
}

/** Lessons whose prerequisites or track topics point at a lesson that does not exist. */
export function brokenLessonLinks(lessons: Lesson[] = LESSONS): string[] {
  const ids = new Set(lessons.map((l) => l.id));
  return lessons.flatMap((l) => l.prerequisites.filter((p) => !ids.has(p)).map((p) => `${l.id} requires missing ${p}`));
}

/** Lessons that state no source at all (every factual claim should be traceable). */
export function lessonsWithoutSources(lessons: Lesson[] = LESSONS): string[] {
  return lessons.filter((l) => l.sources.length === 0).map((l) => l.id);
}

/** A readable before/after report for the content audit (used by `npm run audit:content`). */
export function auditReport(): string {
  const all = allItems();
  const long = longestCorrectShare(all);
  const cue = absoluteWordCue(all);
  const rows = [
    `items audited: ${all.length} (choice items: ${choiceItems(all).length}, written items: ${writtenItems(all).length})`,
    `length leak: ${long.offenders.length} of ${long.n} single-answer items (${(long.share * 100).toFixed(1)}%)`,
    `duplicate choices: ${duplicateChoices(all).length}`,
    `absolute-word cue: wrong ${(cue.wrong * 100).toFixed(0)}% vs right ${(cue.right * 100).toFixed(0)}%`,
    `answer revealed by another item: ${answerRevealedElsewhere().length}`,
    `weak distractor feedback (< 4 words): ${weakDistractors(all).length}`,
    `empty feedback: ${emptyFeedback(all).length}`,
    `malformed choices: ${malformedChoices(all).length}`,
    `near-duplicate prompts (parallel forms): ${duplicatePrompts(all).length}`,
    `review items repeating an assessment prompt: ${reviewRepeatsAssessment().length}`,
    `broken prerequisite links: ${brokenLessonLinks().length}`,
    `lessons without sources: ${lessonsWithoutSources().length}`,
  ];
  return rows.join('\n');
}

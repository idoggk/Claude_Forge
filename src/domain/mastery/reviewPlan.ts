import type { Item, Lesson } from '../curriculum/types';
import type { Attempt } from '@/persistence/schemas';
import { getMisconception } from '@/content/misconceptions';
import { pickedMisconceptions } from '../assessment/misconception';

/**
 * Deterministic review planning (no randomness, no AI). A review session is built from four rules:
 *
 *  1. MISTAKE-FOCUSED  - an item you missed last time comes back; and an item that tests a misconception you
 *                        actually fell for (a wrong option tagged with a misconception) comes back in a new context.
 *  2. DIFFICULTY       - the higher the Leitner box, the harder the target difficulty (1 recall, 2 apply, 3 judge).
 *  3. ROTATION         - items shown in the previous session are avoided, so the pool is walked, not repeated.
 *  4. INTERLEAVING     - one item from a DIFFERENT lesson you have already passed (the longest since it was last
 *                        practised) is mixed in, so you practise choosing the concept, not just applying it.
 *
 * Every selected item carries a plain-language reason that the Review page shows.
 */
export type PlanReason = 'misconception' | 'mistake' | 'interleaved' | 'progression' | 'rotation';

export interface PlannedItem {
  item: Item;
  lessonId: string;
  reason: PlanReason;
  note: string;
}

export const TARGET_DIFFICULTY_BY_BOX: Record<number, number[]> = { 0: [1, 2], 1: [2], 2: [2, 3], 3: [3] };
export const OWN_SLOTS = 3;

export interface PlanInput {
  lesson: Lesson;
  /** Every lesson, for interleaving. */
  lessons: Lesson[];
  box: number;
  cycle: number;
  attempts: Attempt[];
  /** Lessons whose current-version assessment has been passed. Interleaving only draws from these. */
  passedLessonIds: string[];
}

const diff = (it: Item): number => it.difficulty ?? 2;

function allItems(l: Lesson): Item[] {
  return [...l.activity.items, ...l.assessment.items, ...l.reviewItems];
}

/** Misconception ids the learner actually selected in a wrong answer, most recent first. */
export function misconceptionsHit(attempts: Attempt[], lessons: Lesson[]): { id: string; lessonId: string }[] {
  const byId = new Map<string, Item>();
  const lessonOf = new Map<string, string>();
  for (const l of lessons) for (const it of allItems(l)) { byId.set(it.id, it); lessonOf.set(it.id, l.id); }
  const out: { id: string; lessonId: string }[] = [];
  for (const a of [...attempts].sort((x, y) => y.submittedAt.localeCompare(x.submittedAt))) {
    for (const r of a.results) {
      if (r.correct || r.selfAssessed) continue;
      const item = byId.get(r.itemId);
      if (!item || (item.kind !== 'single' && item.kind !== 'multi')) continue;
      for (const id of pickedMisconceptions(item, a.answers[r.itemId])) if (getMisconception(id)) out.push({ id, lessonId: lessonOf.get(item.id)! });
    }
  }
  return out;
}

function testsMisconception(item: Item, id: string): boolean {
  return (item.kind === 'single' || item.kind === 'multi') && item.options.some((o) => o.misconception === id);
}

export function planReview(input: PlanInput): PlannedItem[] {
  const { lesson, lessons, box, cycle, attempts, passedLessonIds } = input;
  const pool = lesson.reviewItems;
  const targets = TARGET_DIFFICULTY_BY_BOX[Math.max(0, Math.min(3, box))] ?? [2];

  const reviews = attempts.filter((a) => a.stage === 'review' && a.lessonId === lesson.id && a.lessonVersion === lesson.version).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const lastSession = new Set((reviews[reviews.length - 1]?.results ?? []).map((r) => r.itemId));
  // last known result per pool item (only items answered in this lesson's review sessions)
  const last = new Map<string, boolean>();
  const lastAt = new Map<string, string>();
  for (const a of reviews) for (const r of a.results) { last.set(r.itemId, r.correct); lastAt.set(r.itemId, a.submittedAt); }
  const missedIds = [...last.entries()].filter(([, ok]) => !ok).map(([id]) => id).sort((a, b) => (lastAt.get(b) ?? '').localeCompare(lastAt.get(a) ?? '') || a.localeCompare(b));

  const chosen: PlannedItem[] = [];
  const has = (id: string) => chosen.some((c) => c.item.id === id);
  const own = (item: Item, reason: PlanReason, note: string) => chosen.push({ item, lessonId: lesson.id, reason, note });

  // 1a. misconception-focused: a pool item that tests a misconception this learner fell for (in THIS lesson's content)
  const hits = misconceptionsHit(attempts.filter((a) => a.lessonId === lesson.id), lessons);
  for (const h of hits) {
    if (chosen.length >= 1) break;
    const m = getMisconception(h.id);
    const item = pool.find((it) => !has(it.id) && !lastSession.has(it.id) && testsMisconception(it, h.id));
    if (item && m) own(item, 'misconception', `You chose an answer that reflects a common misconception (“${m.belief}”). This question tests it in a new setting.`);
  }
  // 1b. mistake-focused: an item missed in the previous reviews and not yet answered correctly since
  for (const id of missedIds) {
    if (chosen.length >= 2) break;
    const item = pool.find((it) => it.id === id);
    if (item && !has(id)) own(item, 'mistake', 'You missed this one in an earlier review, so it comes back.');
  }
  // 2+3. difficulty progression and rotation
  const rest = pool
    .map((it, idx) => ({ it, idx, dist: Math.min(...targets.map((t) => Math.abs(diff(it) - t))), recent: lastSession.has(it.id) ? 1 : 0, never: lastAt.has(it.id) ? 1 : 0, rot: (idx - cycle * OWN_SLOTS + pool.length * 10) % pool.length }))
    .filter((c) => !has(c.it.id))
    .sort((a, b) => a.recent - b.recent || a.dist - b.dist || a.never - b.never || a.rot - b.rot || a.it.id.localeCompare(b.it.id));
  for (const c of rest) {
    if (chosen.length >= OWN_SLOTS) break;
    own(c.it, c.dist === 0 ? 'progression' : 'rotation', c.dist === 0 ? `Difficulty ${diff(c.it)} matches where this review is in your schedule (box ${box + 1} of 4).` : 'Rotates the pool so you see questions you have not just answered.');
  }

  // 4. interleaving: one item from the passed lesson practised longest ago
  const lastPractised = (lid: string): string => {
    const xs = attempts.filter((a) => a.lessonId === lid && (a.stage === 'review' || a.stage === 'assessment')).map((a) => a.submittedAt);
    return xs.length ? xs.sort()[xs.length - 1]! : '';
  };
  const others = lessons.filter((l) => l.id !== lesson.id && passedLessonIds.includes(l.id) && l.reviewItems.length > 0).sort((a, b) => lastPractised(a.id).localeCompare(lastPractised(b.id)) || a.order - b.order);
  const other = others[0];
  if (other) {
    const shown = new Set(attempts.filter((a) => a.stage === 'review' && a.lessonId === other.id).flatMap((a) => a.results.map((r) => r.itemId)));
    const ranked = other.reviewItems
      .map((it, idx) => ({ it, idx, dist: Math.min(...targets.map((t) => Math.abs(diff(it) - t))), seen: shown.has(it.id) ? 1 : 0 }))
      .sort((a, b) => a.seen - b.seen || a.dist - b.dist || ((a.idx - cycle + 100 * other.reviewItems.length) % other.reviewItems.length) - ((b.idx - cycle + 100 * other.reviewItems.length) % other.reviewItems.length) || a.it.id.localeCompare(b.it.id));
    const pick = ranked[0];
    if (pick) chosen.splice(Math.min(1, chosen.length), 0, { item: pick.it, lessonId: other.id, reason: 'interleaved', note: `Mixed in from “${other.title}” so you practise choosing the right idea, not only applying the one you just revised.` });
  }
  return chosen;
}

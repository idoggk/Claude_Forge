import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForgeDB, getDb, setDbForTesting } from '@/persistence/db';
import * as repo from '@/persistence/repo';
import { LESSONS } from '@/content/lessons';
import { setClockOffsetDays, todayKey } from '@/lib/clock';
import { newId } from '@/lib/ids';
import { perfectAnswer, perfectAnswers, wrongAnswer } from './helpers';

let n = 0;
beforeEach(async () => {
  setClockOffsetDays(0);
  const db = new ForgeDB(`r5-${++n}-${Math.random().toString(36).slice(2)}`);
  setDbForTesting(db);
  await db.open();
});
const [L01, L02, L03] = LESSONS;
const pass = (l: (typeof LESSONS)[number]) => repo.submitAttempt({ attemptId: newId('att'), lesson: l, stage: 'assessment', startedAt: new Date().toISOString(), answers: perfectAnswers(l.assessment.items), hintsUsed: 0, confidence: 4 });

describe('five-minute review', () => {
  it('offers nothing when no review is due, and does not write anything', async () => {
    expect(await repo.startFiveMinuteReview(todayKey())).toBeNull();
    await pass(L01!);
    expect(await repo.startFiveMinuteReview(todayKey())).toBeNull(); // scheduled for tomorrow, not due today
    expect(await getDb().attempts.where('stage').equals('review').count()).toBe(0);
  });

  it('builds at most five questions from at most two due lessons, interleaved, each from that lesson\'s own review pool', async () => {
    await pass(L01!); await pass(L02!); await pass(L03!);
    setClockOffsetDays(2);
    const s = (await repo.startFiveMinuteReview(todayKey()))!;
    expect(s.items.length).toBeLessThanOrEqual(repo.FIVE_MINUTE_MAX_ITEMS);
    expect(s.items.length).toBeGreaterThanOrEqual(2);
    expect(s.lessonIds.length).toBeLessThanOrEqual(repo.FIVE_MINUTE_MAX_LESSONS);
    expect(s.remainingDue).toBeGreaterThanOrEqual(1); // the third lesson waits for another session
    for (const i of s.items) expect(LESSONS.find((l) => l.id === i.lessonId)!.reviewItems.some((x) => x.id === i.item.id)).toBe(true);
    // interleaved: the first two questions are from different lessons
    expect(s.items[0]!.lessonId).not.toBe(s.items[1]!.lessonId);
    expect(new Set(s.items.map((i) => i.item.id)).size).toBe(s.items.length); // no repeated question
    expect(s.items.every((i) => i.note.length > 5)).toBe(true); // each says why it was chosen
  });

  it('oldest due first: a lesson that became due earlier is included before a newer one', async () => {
    await pass(L01!);
    setClockOffsetDays(3);
    await pass(L02!);
    await pass(L03!);
    setClockOffsetDays(6);
    const s = (await repo.startFiveMinuteReview(todayKey()))!;
    expect(s.lessonIds).toContain(L01!.id);
  });

  it('finishing saves one ordinary review per lesson through the same scheduling rules, and perfect answers extend the interval', async () => {
    await pass(L01!); await pass(L02!);
    setClockOffsetDays(2);
    const s = (await repo.startFiveMinuteReview(todayKey()))!;
    const answers = Object.fromEntries(s.items.map((i) => [i.item.id, perfectAnswer(i.item)]));
    const out = await repo.submitFiveMinuteReview({ items: s.items, answers, hintsByLesson: {}, startedAt: new Date().toISOString() });
    expect(out.length).toBe(s.lessonIds.length);
    expect(out.every((o) => o.outcome === 'pass')).toBe(true);
    for (const o of out) expect(o.dueOn > todayKey()).toBe(true);
    const reviews = await getDb().attempts.where('stage').equals('review').toArray();
    expect(reviews.length).toBe(out.length);
    expect(reviews.every((a) => a.unseen && a.independent)).toBe(true);
    expect(await repo.startFiveMinuteReview(todayKey())).toBeNull(); // nothing left due
  });

  it('mistakes reset the schedule, and using a hint means the review is not independent and cannot advance a pass', async () => {
    await pass(L01!);
    setClockOffsetDays(2);
    const s = (await repo.startFiveMinuteReview(todayKey()))!;
    const wrong = Object.fromEntries(s.items.map((i) => [i.item.id, wrongAnswer(i.item)]));
    const bad = await repo.submitFiveMinuteReview({ items: s.items, answers: wrong, hintsByLesson: {}, startedAt: new Date().toISOString() });
    expect(bad[0]!.outcome).toBe('fail');
    setClockOffsetDays(5);
    const s2 = (await repo.startFiveMinuteReview(todayKey()))!;
    const good = Object.fromEntries(s2.items.map((i) => [i.item.id, perfectAnswer(i.item)]));
    const hinted = await repo.submitFiveMinuteReview({ items: s2.items, answers: good, hintsByLesson: { [L01!.id]: 2 }, startedAt: new Date().toISOString() });
    expect(hinted[0]!.outcome).not.toBe('pass');
    const last = (await getDb().attempts.where('stage').equals('review').toArray()).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).at(-1)!;
    expect(last.independent).toBe(false);
    expect(last.hintsUsed).toBe(2);
  });

  it('a session is bounded: it never exceeds five questions however much is due', async () => {
    for (const l of LESSONS.slice(0, 6)) await pass(l);
    setClockOffsetDays(30);
    const s = (await repo.startFiveMinuteReview(todayKey()))!;
    expect(s.items.length).toBeLessThanOrEqual(5);
    expect(s.remainingDue).toBeGreaterThan(0);
  });
});

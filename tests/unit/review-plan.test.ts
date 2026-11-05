import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForgeDB, setDbForTesting, getDb } from '@/persistence/db';
import * as repo from '@/persistence/repo';
import { LESSONS } from '@/content/lessons';
import { MISCONCEPTIONS } from '@/content/misconceptions';
import { planReview, misconceptionsHit, OWN_SLOTS } from '@/domain/mastery/reviewPlan';
import { setClockOffsetDays } from '@/lib/clock';
import { newId } from '@/lib/ids';
import { perfectAnswers, wrongAnswers, wrongAnswer } from './helpers';
import type { Attempt } from '@/persistence/schemas';

let n = 0;
beforeEach(async () => {
  setClockOffsetDays(0);
  const db = new ForgeDB(`plan-${++n}-${Math.random().toString(36).slice(2)}`);
  setDbForTesting(db);
  await db.open();
});

const L01 = LESSONS[0]!;
const L02 = LESSONS[1]!;
const pass = (l: (typeof LESSONS)[number]) =>
  repo.submitAttempt({ attemptId: newId('att'), lesson: l, stage: 'assessment', startedAt: new Date().toISOString(), answers: perfectAnswers(l.assessment.items), hintsUsed: 0, confidence: 4 });

describe('review pools', () => {
  it('every lesson has 8-10 review items with ids that are unique across the whole curriculum', () => {
    const ids = new Set<string>();
    for (const l of LESSONS) {
      expect(l.reviewItems.length, l.id).toBeGreaterThanOrEqual(8);
      expect(l.reviewItems.length, l.id).toBeLessThanOrEqual(10);
      for (const it of l.reviewItems) {
        expect(ids.has(it.id), it.id).toBe(false);
        ids.add(it.id);
        expect([1, 2, 3], `${it.id} difficulty`).toContain(it.difficulty);
      }
    }
  });

  it('each pool spans difficulty levels (recall, apply and judge items all exist)', () => {
    for (const l of LESSONS) {
      const levels = new Set(l.reviewItems.map((i) => i.difficulty));
      expect(levels.has(1), `${l.id} has recall items`).toBe(true);
      expect(levels.has(3), `${l.id} has judge items`).toBe(true);
    }
  });
});

describe('planReview', () => {
  const plan = (box: number, cycle: number, attempts: Attempt[] = [], passed: string[] = [L01.id]) => planReview({ lesson: L01, lessons: LESSONS, box, cycle, attempts, passedLessonIds: passed });

  it('is deterministic, duplicate-free and fills the own slots', () => {
    const a = plan(0, 0);
    expect(plan(0, 0).map((p) => p.item.id)).toEqual(a.map((p) => p.item.id));
    expect(a).toHaveLength(OWN_SLOTS);
    expect(new Set(a.map((p) => p.item.id)).size).toBe(a.length);
    for (const p of a) expect(p.note.length).toBeGreaterThan(10);
  });

  it('gets harder as the box rises (mean difficulty at box 3 exceeds box 0)', () => {
    const mean = (b: number) => { const p = plan(b, 0); return p.reduce((s, x) => s + (x.item.difficulty ?? 2), 0) / p.length; };
    expect(mean(3)).toBeGreaterThan(mean(0));
  });

  it('interleaves exactly one item from a DIFFERENT lesson, and only from lessons the learner passed', () => {
    const none = plan(1, 0, [], [L01.id]);
    expect(none.every((p) => p.lessonId === L01.id)).toBe(true);
    const mixed = plan(1, 0, [], [L01.id, L02.id]);
    expect(mixed).toHaveLength(OWN_SLOTS + 1);
    const inter = mixed.filter((p) => p.reason === 'interleaved');
    expect(inter).toHaveLength(1);
    expect(inter[0]!.lessonId).toBe(L02.id);
    expect(mixed[1]!.reason).toBe('interleaved'); // sits between own items, so concepts alternate
  });

  it('never repeats the previous session when the pool allows it (anti-memorisation by rotation)', () => {
    const history: Attempt[] = [];
    let prev = new Set<string>();
    for (let cycle = 0; cycle < 4; cycle++) {
      const p = plan(0, cycle, history);
      const ids = p.map((x) => x.item.id);
      for (const id of ids) expect(prev.has(id), `cycle ${cycle} repeats ${id}`).toBe(false);
      prev = new Set(ids);
      history.push(fakeReview(ids.map((id) => ({ id, correct: true })), cycle));
    }
  });
});

function fakeReview(results: { id: string; correct: boolean }[], i: number): Attempt {
  return {
    id: `rv-${i}`, lessonId: L01.id, lessonVersion: L01.version, stage: 'review', startedAt: '2026-01-01T00:00:00Z', submittedAt: `2026-01-0${i + 1}T00:00:00Z`, attemptNumber: i + 1, answers: {},
    results: results.map((r) => ({ itemId: r.id, kind: 'single' as const, concept: 'mechanism-selection', critical: false, correct: r.correct, score: r.correct ? 1 : 0, points: 1, selfAssessed: false, answered: true, feedback: '' })),
    score: 0.5, passed: false, criticalFailed: [], hintsUsed: 0, confidence: null, predictedPct: null, independent: true, unseen: true, conceptResults: {},
  };
}

describe('mistake-focused retrieval', () => {
  it('an item missed in the last review returns in the next session, with a reason', () => {
    const first = planReview({ lesson: L01, lessons: LESSONS, box: 1, cycle: 0, attempts: [], passedLessonIds: [L01.id] });
    const missed = first[0]!.item.id;
    const attempts = [fakeReview(first.map((p) => ({ id: p.item.id, correct: p.item.id !== missed })), 0)];
    const next = planReview({ lesson: L01, lessons: LESSONS, box: 1, cycle: 1, attempts, passedLessonIds: [L01.id] });
    const back = next.find((p) => p.item.id === missed);
    expect(back?.reason).toBe('mistake');
  });

  it('an item answered correctly after being missed is no longer treated as a mistake', () => {
    const first = planReview({ lesson: L01, lessons: LESSONS, box: 1, cycle: 0, attempts: [], passedLessonIds: [L01.id] });
    const id = first[0]!.item.id;
    const attempts = [fakeReview([{ id, correct: false }], 0), fakeReview([{ id, correct: true }], 1)];
    const next = planReview({ lesson: L01, lessons: LESSONS, box: 1, cycle: 2, attempts, passedLessonIds: [L01.id] });
    expect(next.find((p) => p.item.id === id)?.reason).not.toBe('mistake');
  });
});

describe('misconception-focused retrieval (through the real persistence layer)', () => {
  it('choosing a misconception-tagged wrong option schedules a question that tests it again', async () => {
    // L04 (skill security) has misconception-tagged options in its own assessment/practice material.
    const lesson = LESSONS.find((l) => l.id === 'L04-skill-autopsy')!;
    const tagged = lesson.assessment.items.find((i) => i.kind === 'single' && i.options.some((o) => o.misconception));
    expect(tagged, 'L04 assessment has a tagged option').toBeDefined();
    const answers = { ...perfectAnswers(lesson.assessment.items) };
    if (tagged && tagged.kind === 'single') answers[tagged.id] = tagged.options.find((o) => o.misconception)!.id;
    await repo.submitAttempt({ attemptId: newId('att'), lesson, stage: 'assessment', startedAt: new Date().toISOString(), answers, hintsUsed: 0, confidence: 4 });
    const attempts = await getDb().attempts.toArray();
    const hit = misconceptionsHit(attempts, LESSONS);
    expect(hit.length).toBeGreaterThan(0);
    expect(MISCONCEPTIONS[hit[0]!.id]).toBeDefined();
    const p = planReview({ lesson, lessons: LESSONS, box: 0, cycle: 0, attempts, passedLessonIds: [] });
    const m = p.find((x) => x.reason === 'misconception');
    expect(m, 'a misconception-focused slot').toBeDefined();
    expect(m!.item.kind === 'single' && m!.item.options.some((o) => o.misconception === hit[0]!.id)).toBe(true);
  });
});

describe('review sessions persist exactly the items shown', () => {
  it('submitReview grades the items it is told were shown and refuses ids outside any review pool', async () => {
    await pass(L01);
    setClockOffsetDays(2);
    const s = (await repo.startReview(L01.id))!;
    expect(s.plan).toHaveLength(s.items.length);
    const res = await repo.submitReview({ attemptId: newId('rv'), lessonId: L01.id, startedAt: new Date().toISOString(), answers: perfectAnswers(s.items), hintsUsed: 0, confidence: null, itemIds: s.items.map((i) => i.id) });
    expect(res!.outcome).toBe('pass');
    expect(res!.attempt.results.map((r) => r.itemId)).toEqual(s.items.map((i) => i.id));
    // a forged id (e.g. an assessment item, which would not be "unseen") is dropped, never graded
    const forged = await repo.submitReview({ attemptId: newId('rv'), lessonId: L01.id, startedAt: new Date().toISOString(), answers: {}, hintsUsed: 0, confidence: null, itemIds: [L01.assessment.items[0]!.id, 'nope'] });
    expect(forged).toBeNull();
  });

  it('an interleaved item counts for ITS concept in competency evidence', async () => {
    await pass(L01);
    await pass(L02);
    setClockOffsetDays(3);
    const s = (await repo.startReview(L01.id))!;
    const inter = s.plan.find((p) => p.reason === 'interleaved');
    expect(inter?.lessonId).toBe(L02.id);
    const res = await repo.submitReview({ attemptId: newId('rv'), lessonId: L01.id, startedAt: new Date().toISOString(), answers: perfectAnswers(s.items), hintsUsed: 0, confidence: null, itemIds: s.items.map((i) => i.id) });
    expect(res!.attempt.conceptResults['skill-anatomy']).toBeDefined();
  });

  it('wrong answers in a review stay failures even with the new planner', async () => {
    await pass(L01);
    setClockOffsetDays(2);
    const s = (await repo.startReview(L01.id))!;
    const res = await repo.submitReview({ attemptId: newId('rv'), lessonId: L01.id, startedAt: new Date().toISOString(), answers: wrongAnswers(s.items), hintsUsed: 0, confidence: 5, itemIds: s.items.map((i) => i.id) });
    expect(res!.outcome).toBe('fail');
    void wrongAnswer;
  });
});

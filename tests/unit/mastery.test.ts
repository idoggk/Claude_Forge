import { describe, expect, it } from 'vitest';
import { evaluateCompetencies, applyEvaluations } from '@/domain/mastery/competency';
import { applyReviewOutcome, classifyReview, dueReviews, initialReview, intervalForBox, pickReviewItems, REVIEW_INTERVALS_DAYS } from '@/domain/mastery/review';
import { lessonStatus, prerequisitesMet, recommend } from '@/domain/mastery/recommend';
import { addDaysToKey, compareKeys, daysBetweenKeys, dateKey, isDateKey } from '@/lib/clock';
import { LESSONS } from '@/content/lessons';
import type { Attempt, FieldEvidence, LessonProgress, ReviewRecord } from '@/persistence/schemas';

const L01 = LESSONS[0]!;
const L02 = LESSONS[1]!;
const T = (n: number) => `2026-11-0${n}T10:00:00.000Z`;

function attempt(over: Omit<Partial<Attempt>, 'criticalFailed' | 'score'> & { concept?: string; score?: number; criticalFailed?: boolean }): Attempt {
  const concept = over.concept ?? 'mechanism-selection';
  const score = over.score ?? 0.9;
  const base: Attempt = {
    id: over.id ?? Math.random().toString(36),
    lessonId: L01.id,
    lessonVersion: L01.version,
    stage: 'assessment',
    startedAt: T(1),
    submittedAt: over.submittedAt ?? T(1),
    attemptNumber: 1,
    answers: {},
    results: [],
    score,
    passed: score >= 0.75 && !over.criticalFailed,
    criticalFailed: over.criticalFailed ? ['x'] : [],
    hintsUsed: 0,
    confidence: null,
    predictedPct: null,
    independent: true,
    unseen: true,
    conceptResults: { [concept]: { score, items: 3, criticalFailed: over.criticalFailed ?? false } },
  };
  const { concept: _c, score: _s, criticalFailed: _cf, ...rest } = over;
  return { ...base, ...rest };
}
const level = (attempts: Attempt[], id = 'mechanism-selection', field: FieldEvidence[] = [], progress: LessonProgress[] = []) =>
  evaluateCompetencies(attempts, LESSONS, field, progress).find((e) => e.competencyId === id)!;

describe('competency levels', () => {
  it('starts at level 0 (unseen)', () => {
    expect(level([]).level).toBe(0);
  });

  it('level 1 from finishing the teaching segments or from any attempt', () => {
    const progress: LessonProgress[] = [{ lessonId: L01.id, lessonVersion: L01.version, stage: 'learn', segmentsSeen: L01.segments.map((s) => s.id), startedAt: T(1), updatedAt: T(1), completedAt: null, appliedNote: '' }];
    expect(level([], 'mechanism-selection', [], progress).level).toBe(1);
    expect(level([attempt({ score: 0.1, stage: 'practice', unseen: false })]).level).toBe(1);
  });

  it('level 2 from a guided practice attempt with a good concept score, but not from a poor one', () => {
    expect(level([attempt({ stage: 'practice', unseen: false, hintsUsed: 2, independent: false, score: 0.8 })]).level).toBe(2);
    expect(level([attempt({ stage: 'practice', unseen: false, score: 0.5 })]).level).toBe(1);
  });

  it('level 3 requires an UNSEEN, hint-free attempt at the independent mark', () => {
    expect(level([attempt({ score: 0.8 })]).level).toBe(3);
    expect(level([attempt({ score: 0.74 })]).level).toBe(2);
    // a retake has seen the questions: it can reach level 2 but never level 3
    expect(level([attempt({ score: 0.95, unseen: false, attemptNumber: 2 })]).level).toBe(2);
    // practice with perfect score is still guided
    expect(level([attempt({ score: 1, stage: 'practice', unseen: false })]).level).toBe(2);
    // an attempt that used hints is not independent
    expect(level([attempt({ score: 1, independent: false, hintsUsed: 1 })]).level).toBe(2);
  });

  it('a missed critical item caps the concept at level 2 no matter how high the score is', () => {
    const e = level([attempt({ score: 0.95, criticalFailed: true })]);
    expect(e.level).toBe(2);
    expect(e.blockedReason).toMatch(/critical/i);
  });

  it('level 3 can be re-earned by a later unseen review with no critical miss, and lost again if a later one misses it', () => {
    const first = attempt({ id: 'a', score: 0.9, criticalFailed: true, submittedAt: T(1) });
    const review = attempt({ id: 'b', stage: 'review', score: 0.9, submittedAt: T(2) });
    expect(level([first, review]).level).toBe(3);
    const later = attempt({ id: 'c', stage: 'review', score: 0.9, criticalFailed: true, submittedAt: T(3) });
    const e = level([first, review, later]);
    expect(e.level).toBe(2);
    expect(e.blockedReason).toMatch(/most recent/i);
  });

  it('level 4 requires level 3 AND self-reported field evidence tagged with the concept', () => {
    const field: FieldEvidence = { id: 'f', competencyIds: ['mechanism-selection'], title: 't', project: '', date: '2026-11-03', description: 'd', outcome: '', artifactNote: '', selfReported: true, createdAt: T(3) };
    expect(level([attempt({ score: 0.9 })], 'mechanism-selection', [field]).level).toBe(4);
    expect(level([attempt({ score: 0.5, stage: 'practice', unseen: false })], 'mechanism-selection', [field]).level).toBe(1);
    expect(level([attempt({ score: 0.9 })], 'mechanism-selection', []).level).toBe(3);
  });

  it('concepts are independent: high scores on one never lift another', () => {
    const a = attempt({ concept: 'trigger-design', score: 1, lessonId: 'L03-trigger-dojo' });
    expect(level([a], 'mechanism-selection').level).toBe(0);
  });

  it('content changes keep old evidence but do not count as current-version mastery', () => {
    const old = attempt({ lessonVersion: L01.version + 1, score: 1 }); // attempt recorded against a different version than the lesson now has
    const e = level([old]);
    expect(e.level).toBe(0);
    expect(e.staleLevel).toBe(3);
  });

  it('records history only when a level actually changes', () => {
    const evals1 = evaluateCompetencies([attempt({ score: 0.9 })], LESSONS, [], []);
    const r1 = applyEvaluations([], evals1, T(1), 'first');
    const mech = r1.find((r) => r.competencyId === 'mechanism-selection')!;
    expect(mech.history).toEqual([{ at: T(1), from: 0, to: 3, reason: 'first' }]);
    const r2 = applyEvaluations(r1, evals1, T(2), 'again');
    expect(r2.find((r) => r.competencyId === 'mechanism-selection')!.history).toHaveLength(1);
    expect(r2.find((r) => r.competencyId === 'mechanism-selection')!.updatedAt).toBe(T(1));
  });
});

describe('calendar-day helpers (timezone and DST safe)', () => {
  it('adds days across month, year and leap boundaries', () => {
    expect(addDaysToKey('2026-11-05', 1)).toBe('2026-11-06');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToKey('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDaysToKey('2026-03-08', 14)).toBe('2026-03-22'); // spans the US DST change; still exactly 14 calendar days
    expect(addDaysToKey('2026-10-25', 7)).toBe('2026-11-01'); // spans the EU DST change
  });
  it('compares and measures by calendar day', () => {
    expect(daysBetweenKeys('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetweenKeys('2026-11-05', '2026-11-05')).toBe(0);
    expect(compareKeys('2026-11-05', '2026-11-06')).toBe(-1);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-2-3')).toBe(false);
    expect(() => addDaysToKey('nope', 1)).toThrow();
  });
  it('formats a local date key from local components', () => {
    expect(dateKey(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05');
    expect(dateKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});

describe('spaced review scheduler', () => {
  const today = '2026-11-05';
  it('uses the documented 1/3/7/14 day ladder', () => {
    expect(REVIEW_INTERVALS_DAYS).toEqual([1, 3, 7, 14]);
    expect([0, 1, 2, 3].map(intervalForBox)).toEqual([1, 3, 7, 14]);
  });

  it('first review is due the next day', () => {
    const r = initialReview('L01', today, T(1));
    expect(r).toMatchObject({ box: 0, dueOn: '2026-11-06', lapses: 0 });
    expect(dueReviews([r], today)).toHaveLength(0);
    expect(dueReviews([r], '2026-11-06')).toHaveLength(1);
    expect(dueReviews([r], '2026-12-31')).toHaveLength(1);
  });

  it('passing climbs the ladder and tops out at 14 days', () => {
    let r = initialReview('L01', today, T(1));
    const seen: string[] = [];
    let day = today;
    for (let i = 0; i < 5; i++) {
      day = r.dueOn;
      r = applyReviewOutcome(r, 'pass', day, T(2));
      seen.push(`${r.box}:${r.dueOn}`);
    }
    expect(seen).toEqual(['1:2026-11-09', '2:2026-11-16', '3:2026-11-30', '3:2026-12-14', '3:2026-12-28']);
  });

  it('a partial result stays in the same box; a failure resets to box 0 and counts a lapse', () => {
    let r = initialReview('L01', today, T(1));
    r = applyReviewOutcome(r, 'pass', today, T(2));
    r = applyReviewOutcome(r, 'pass', today, T(2));
    expect(r.box).toBe(2);
    const partial = applyReviewOutcome(r, 'partial', today, T(3));
    expect(partial).toMatchObject({ box: 2, lapses: 0, dueOn: '2026-11-12' });
    const fail = applyReviewOutcome(r, 'fail', today, T(3));
    expect(fail).toMatchObject({ box: 0, lapses: 1, dueOn: '2026-11-06' });
    expect(fail.history.at(-1)).toMatchObject({ outcome: 'fail', fromBox: 2, toBox: 0 });
  });

  it('classifies outcomes using score, hints and overconfidence', () => {
    expect(classifyReview({ score: 1, hintsUsed: 0, overconfidentMiss: false })).toBe('pass');
    expect(classifyReview({ score: 0.8, hintsUsed: 0, overconfidentMiss: false })).toBe('pass');
    expect(classifyReview({ score: 1, hintsUsed: 1, overconfidentMiss: false })).toBe('partial');
    expect(classifyReview({ score: 0.9, hintsUsed: 0, overconfidentMiss: true })).toBe('partial');
    expect(classifyReview({ score: 0.6, hintsUsed: 0, overconfidentMiss: false })).toBe('partial');
    expect(classifyReview({ score: 0.49, hintsUsed: 0, overconfidentMiss: false })).toBe('fail');
  });

  it('sorts due reviews oldest first and rotates the question pool', () => {
    const a: ReviewRecord = { ...initialReview('B', '2026-11-01', T(1)) };
    const b: ReviewRecord = { ...initialReview('A', '2026-10-20', T(1)) };
    expect(dueReviews([a, b], '2026-11-10').map((r) => r.lessonId)).toEqual(['A', 'B']);
    const pool = ['q1', 'q2', 'q3', 'q4', 'q5'];
    expect(pickReviewItems(pool, 0)).toEqual(['q1', 'q2', 'q3']);
    expect(pickReviewItems(pool, 1)).toEqual(['q4', 'q5', 'q1']);
    expect(pickReviewItems(pool, 2)).toEqual(['q2', 'q3', 'q4']);
    expect(pickReviewItems([], 3)).toEqual([]);
  });
});

describe('recommendation engine (deterministic and explainable)', () => {
  const today = '2026-11-05';
  const base = { lessons: LESSONS, attempts: [] as Attempt[], progress: [] as LessonProgress[], reviews: [] as ReviewRecord[], profile: null, today };

  it('a first-time learner is sent to Lesson 1 with reasons', () => {
    const { primary } = recommend(base);
    expect(primary.lessonId).toBe(L01.id);
    expect(primary.reasons.length).toBeGreaterThan(0);
    expect(primary.reasons.join(' ')).toMatch(/No prerequisites/);
  });

  it('is deterministic', () => {
    expect(recommend(base)).toEqual(recommend(base));
  });

  it('a failed assessment turns into a retry recommendation that names the missed concept', () => {
    const failed = attempt({ score: 0.4, passed: false, stage: 'assessment' });
    const { primary } = recommend({ ...base, attempts: [failed] });
    expect(primary).toMatchObject({ kind: 'retry', lessonId: L01.id });
    expect(primary.reasons.join(' ')).toMatch(/missed: Mechanism selection/);
  });

  it('passing Lesson 1 unlocks dependents; lessons with unmet prerequisites are not first choice', () => {
    const passed = attempt({ score: 0.9, passed: true });
    const { primary } = recommend({ ...base, attempts: [passed] });
    expect(primary.lessonId).not.toBe(L01.id);
    const pre = prerequisitesMet(LESSONS.find((l) => l.id === 'L05-first-custom-skill')!, LESSONS, [passed], []);
    expect(pre.met).toBe(false);
    expect(lessonStatus(L01, [passed], [])).toBe('passed');
    expect(lessonStatus(L02, [passed], [])).toBe('not-started');
  });

  it('due reviews outrank new material and explain why', () => {
    const passed = attempt({ score: 0.9, passed: true });
    const review = { ...initialReview(L01.id, '2026-10-01', T(1)) };
    const { primary } = recommend({ ...base, attempts: [passed], reviews: [review] });
    expect(primary.kind).toBe('review');
    expect(primary.reasons.join(' ')).toMatch(/due/);
  });

  it('a review not yet due does not appear', () => {
    const passed = attempt({ score: 0.9, passed: true });
    const review = initialReview(L01.id, today, T(1));
    expect(recommend({ ...base, attempts: [passed], reviews: [review] }).primary.kind).not.toBe('review');
  });

  it('user interests and game relevance influence the order (and say so)', () => {
    const passed = attempt({ score: 0.9, passed: true });
    const { primary } = recommend({ ...base, attempts: [passed], profile: { interests: ['game-dev'] } });
    expect(['L06-merge-chain-failure', 'L07-economy-inflation']).toContain(primary.lessonId);
    expect(primary.reasons.join(' ')).toMatch(/game development/i);
  });

  it('reports completion when everything is passed', () => {
    const attempts = LESSONS.map((l) => attempt({ lessonId: l.id, lessonVersion: l.version, score: 0.95, passed: true }));
    expect(recommend({ ...base, attempts }).primary.kind).toBe('done');
  });
});

import { describe, expect, it } from 'vitest';
import { UNITS, SPARKS_ONLY, MISSIONS_ONLY } from '@/content/units/registry';
import { INTRO_SPARK_ID, nextChallenge, pickMission, pickSpark, unitPath } from '@/domain/missions/next';
import { newRun } from '@/domain/missions/engine';
import type { MissionRun } from '@/domain/missions/model';
import type { AdaptiveSuggestion } from '@/domain/mastery/adaptive';

const T = '2026-11-09T10:00:00.000Z';
const base = { units: UNITS, runs: [] as MissionRun[], suggestions: [] as AdaptiveSuggestion[], dueReviews: 0, passedLessonIds: new Set<string>(), hasHistory: false };
const done = (id: string, at = T): MissionRun => { const u = UNITS.find((x) => x.id === id)!; return { ...newRun(u, `r-${id}-${at}`, at), status: 'completed', completedAt: at }; };
const sug = (over: Partial<AdaptiveSuggestion> = {}): AdaptiveSuggestion => ({ tier: 'foundation', title: 'Review: X', to: '/academy/lesson/L12-context-engineering', competencies: ['context-engineering'], why: 'Because.', evidence: ['You were confident and wrong.'], improvement: 'Pass.', ...over });

describe('what to show first', () => {
  it('a first-time learner gets the intro spark: no history, no set-up', () => {
    const c = nextChallenge(base);
    expect(c).toMatchObject({ kind: 'intro', unitId: INTRO_SPARK_ID, to: `/spark/${INTRO_SPARK_ID}` });
    expect(c.minutes).toBeLessThanOrEqual(4);
  });
  it('an unfinished run comes first, with its saved place, ahead of reviews and suggestions', () => {
    const u = MISSIONS_ONLY[0]!;
    const c = nextChallenge({ ...base, hasHistory: true, dueReviews: 3, suggestions: [sug()], runs: [newRun(u, 'r1', T)] });
    expect(c).toMatchObject({ kind: 'continue', unitId: u.id });
  });
  it('an unfinished run on older content is not offered as "continue"', () => {
    const u = MISSIONS_ONLY[0]!;
    const stale = { ...newRun(u, 'r1', T), missionVersion: u.version + 1 };
    expect(nextChallenge({ ...base, hasHistory: true, runs: [stale] }).kind).not.toBe('continue');
  });
  it('due reviews come before new material, and say how many', () => {
    const c = nextChallenge({ ...base, hasHistory: true, dueReviews: 2 });
    expect(c).toMatchObject({ kind: 'review', to: '/review5', minutes: 5 });
    expect(c.why).toMatch(/2 reviews are due/);
  });
  it('practice the learner\'s own evidence calls for is matched to a spark on that competency when one exists, with the reason', () => {
    const c = nextChallenge({ ...base, hasHistory: true, suggestions: [sug()] });
    expect(c.kind).toBe('suggestion');
    expect(UNITS.find((u) => u.id === c.unitId)?.competencies).toContain('context-engineering');
    expect(c.why).toMatch(/confident and wrong/);
  });
  it('a suggestion with no matching unit falls back to the suggestion\'s own destination', () => {
    const c = nextChallenge({ ...base, hasHistory: true, suggestions: [sug({ tier: 'transfer', competencies: ['retrieval-design'], to: '/transfer', title: 'Apply it to a real task' })] });
    expect(c).toMatchObject({ kind: 'suggestion', to: '/transfer' });
  });
  it('with history and nothing pending it offers a spark not yet done, then a mission, then a repeat', () => {
    const doneAll = SPARKS_ONLY.map((s) => done(s.id));
    expect(nextChallenge({ ...base, hasHistory: true }).kind).toBe('spark');
    expect(nextChallenge({ ...base, hasHistory: true, runs: doneAll }).kind).toBe('mission');
    const everything = [...doneAll, ...MISSIONS_ONLY.map((m) => done(m.id))];
    expect(nextChallenge({ ...base, hasHistory: true, runs: everything }).kind).toBe('caught-up');
  });
  it('sparks rotate: a fresh one is preferred, and when all are done the one done longest ago comes back', () => {
    const [first, second] = SPARKS_ONLY;
    expect(pickSpark(UNITS, [done(first!.id)])?.id).not.toBe(first!.id);
    const all = SPARKS_ONLY.map((s, i) => done(s.id, `2026-11-0${(i % 9) + 1}T10:00:00.000Z`));
    expect(pickSpark(UNITS, all)?.id).toBe(first!.id);
    expect(second).toBeTruthy();
  });
  it('a mission for a lesson you have not passed comes before one you have', () => {
    const passed = new Set([MISSIONS_ONLY[0]!.lessonId!]);
    expect(pickMission(UNITS, [], passed)?.id).toBe(MISSIONS_ONLY[1]!.id);
    expect(pickMission(UNITS, [], passed, MISSIONS_ONLY[3]!.lessonId)?.id).toBe(MISSIONS_ONLY[3]!.id);
  });
  it('every result has a plain reason, a real route and an editorial time', () => {
    for (const c of [nextChallenge(base), nextChallenge({ ...base, hasHistory: true, dueReviews: 1 }), nextChallenge({ ...base, hasHistory: true })]) {
      expect(c.why.length).toBeGreaterThan(15);
      expect(c.to.startsWith('/')).toBe(true);
      expect(c.minutes).toBeGreaterThan(0);
    }
    expect(unitPath(UNITS.find((u) => u.kind === 'spark')!)).toMatch(/^\/spark\//);
  });
});

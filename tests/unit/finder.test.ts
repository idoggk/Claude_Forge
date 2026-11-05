import { describe, expect, it } from 'vitest';
import { APPROACHES, OPPORTUNITY_SCENARIOS } from '@/content/finder/scenarios';
import { LESSONS } from '@/content/lessons';
import { FINDER_ACTIVITY_ID, RUN_SIZE, pickScenarios, practiceGapsFromRuns, scoreRun, scoreScenario } from '@/domain/finder/score';
import { recommend } from '@/domain/mastery/recommend';
import { goalLessons } from '@/content/capability/goals';

const ids = new Set(APPROACHES.map((a) => a.id));
const lessonIds = new Set(LESSONS.map((l) => l.id));

describe('Opportunity Finder scenarios', () => {
  it('are well-formed and every answer, trap and lesson reference resolves', () => {
    expect(new Set(OPPORTUNITY_SCENARIOS.map((s) => s.id)).size).toBe(OPPORTUNITY_SCENARIOS.length);
    for (const s of OPPORTUNITY_SCENARIOS) {
      expect(ids.has(s.correct), s.id).toBe(true);
      expect(s.whyCorrect.length, s.id).toBeGreaterThan(40);
      expect(s.constraints.length, s.id).toBeGreaterThanOrEqual(2);
      expect(lessonIds.has(s.lessonId), s.id).toBe(true);
      for (const t of Object.keys(s.traps)) { expect(ids.has(t as never), `${s.id} trap ${t}`).toBe(true); expect(t).not.toBe(s.correct); }
      if (s.defensible) { expect(ids.has(s.defensible.id), s.id).toBe(true); expect(s.defensible.id).not.toBe(s.correct); }
    }
  });

  it('teach that the best answer is often NOT an agent: conventional software, a person and "do nothing" are all correct somewhere', () => {
    const correct = new Set(OPPORTUNITY_SCENARIOS.map((s) => s.correct));
    for (const c of ['software', 'human', 'none', 'prompt', 'workflow', 'guardrail', 'integration', 'skill', 'agent'] as const) expect(correct.has(c), c).toBe(true);
    const agents = OPPORTUNITY_SCENARIOS.filter((s) => s.correct === 'agent').length;
    expect(agents).toBeLessThanOrEqual(Math.ceil(OPPORTUNITY_SCENARIOS.length / 5));
  });

  it('contains no real company, person or credential', () => {
    expect(JSON.stringify(OPPORTUNITY_SCENARIOS)).not.toMatch(/sk-[a-z0-9]{6,}|@[a-z0-9-]+\.(com|org)|https?:\/\//i);
  });
});

describe('scoring', () => {
  const s = OPPORTUNITY_SCENARIOS.find((x) => x.defensible)!;
  it('best = 1, defensible = 0.5, wrong or blank = 0', () => {
    expect(scoreScenario(s, s.correct).score).toBe(1);
    expect(scoreScenario(s, s.defensible!.id).score).toBe(0.5);
    const wrong = APPROACHES.find((a) => a.id !== s.correct && a.id !== s.defensible!.id)!.id;
    expect(scoreScenario(s, wrong).verdict).toBe('missed');
    expect(scoreScenario(s, null).verdict).toBe('unanswered');
    expect(scoreScenario(s, undefined).score).toBe(0);
  });
  it('a run averages and never exceeds 1', () => {
    const run = OPPORTUNITY_SCENARIOS.slice(0, 4);
    const perfect = scoreRun(run, Object.fromEntries(run.map((x) => [x.id, x.correct])));
    expect(perfect.score).toBe(1);
    expect(scoreRun(run, {}).score).toBe(0);
    expect(scoreRun([], {}).score).toBe(0);
  });
});

describe('picking scenarios', () => {
  it('shows unseen scenarios first and cycles through the pool', () => {
    const first = pickScenarios([]);
    expect(first).toHaveLength(RUN_SIZE);
    const run1 = { results: first.map((x) => ({ itemId: x.id, concept: 'approach-selection', correct: true, score: 1 })) };
    const second = pickScenarios([run1]);
    expect(second.filter((x) => first.some((f) => f.id === x.id)).length).toBe(Math.max(0, RUN_SIZE - (OPPORTUNITY_SCENARIOS.length - first.length)));
    const run2 = { results: second.map((x) => ({ itemId: x.id, concept: 'approach-selection', correct: true, score: 1 })) };
    expect(pickScenarios([run1, run2])).toHaveLength(RUN_SIZE);
  });
  it('brings back scenarios you missed before ones you mastered', () => {
    const all = OPPORTUNITY_SCENARIOS;
    const history = [{ results: all.map((x, i) => ({ itemId: x.id, concept: 'approach-selection', correct: i !== 0, score: i === 0 ? 0 : 1 })) }];
    expect(pickScenarios(history, 3).map((x) => x.id)).toContain(all[0]!.id);
  });
});

describe('practice feeds recommendations (as a hint) but never marks anything passed', () => {
  const lesson = LESSONS.find((l) => l.id === 'L11-choose-ai-approach')!;
  const base = { lessons: [lesson], attempts: [], progress: [], reviews: [], profile: null, today: '2026-11-05' };
  it('missed themes become practice gaps for the latest run only', () => {
    const miss = OPPORTUNITY_SCENARIOS.find((x) => x.lessonId === lesson.id)!;
    const runs = [
      { activityId: FINDER_ACTIVITY_ID, takenAt: '2026-11-01T00:00:00Z', results: [{ itemId: miss.id, concept: 'approach-selection', correct: false, score: 0 }] },
      { activityId: FINDER_ACTIVITY_ID, takenAt: '2026-11-03T00:00:00Z', results: [{ itemId: miss.id, concept: 'approach-selection', correct: true, score: 1 }] },
    ];
    expect(practiceGapsFromRuns(runs)).toEqual([]);
    expect(practiceGapsFromRuns([runs[0]!])).toEqual([{ lessonId: lesson.id, label: miss.theme }]);
    expect(practiceGapsFromRuns([{ ...runs[0]!, activityId: 'other' }])).toEqual([]);
  });

  it('raises priority with a reason and leaves the lesson not-started', () => {
    const plain = recommend(base).primary;
    const hinted = recommend({ ...base, practiceGaps: [{ lessonId: lesson.id, label: 'A fixed rule over many files' }] }).primary;
    expect(hinted.score).toBeGreaterThan(plain.score);
    expect(hinted.reasons.join(' ')).toMatch(/never change your levels|do(es)? not change/i);
    expect(hinted.status).toBe('not-started');
  });

  it('a learning goal raises priority, names the goal and says it is not evidence', () => {
    const plain = recommend(base).primary;
    const goal = { id: 'g', schemaVersion: 1 as const, title: 'Choose better', why: '', capabilityIds: ['approach-selection'], status: 'active' as const, achievedNote: '', achievedAt: null, createdAt: 't', updatedAt: 't' };
    const steered = recommend({ ...base, goalLessons: goalLessons([goal]) }).primary;
    expect(steered.score).toBeGreaterThan(plain.score);
    expect(steered.reasons.join(' ')).toMatch(/Supports your goal "Choose better"/);
    expect(steered.reasons.join(' ')).toMatch(/only your assessments and field notes show what you can do/);
    expect(steered.status).toBe('not-started');
  });
});

import { describe, expect, it } from 'vitest';
import { UNITS } from '@/content/units/registry';
import { LESSONS } from '@/content/lessons';
import { newRun } from '@/domain/missions/engine';
import { MIN_SAMPLE, STALE_DAYS, qualityReport, stat } from '@/domain/missions/quality';
import type { MissionRun } from '@/domain/missions/model';

const U = UNITS.find((u) => u.kind === 'mission')!;
const D = (d: number) => `2026-11-${String(d).padStart(2, '0')}T10:00:00.000Z`;
const run = (id: string, over: Partial<MissionRun> = {}): MissionRun => ({ ...newRun(U, id, D(1)), ...over });
const report = (runs: MissionRun[], today = '2026-11-20') => qualityReport({ units: UNITS, runs, attempts: [], lessons: LESSONS, today });
const mine = (r: ReturnType<typeof report>) => r.units.find((u) => u.unitId === U.id)!;

describe('learning experience report (local, descriptive)', () => {
  it('counts started, completed, resumed and set-aside runs, with sample sizes', () => {
    const r = report([run('a', { status: 'completed', completedAt: D(2) }), run('b', { resumes: 2, updatedAt: D(18) }), run('c', { updatedAt: D(1) })]);
    const u = mine(r);
    expect(u).toMatchObject({ started: 3, completed: 1, inProgress: 2, abandoned: 1, resumed: 1 });
    expect(u.completionRate.n).toBe(3);
    expect(STALE_DAYS).toBe(7);
  });
  it('anything under five observations is labelled as too few to say', () => {
    expect(stat(2, 4).enough).toBe(false);
    expect(stat(2, MIN_SAMPLE).enough).toBe(true);
    expect(stat(0, 0).value).toBeNull();
    expect(mine(report([run('a')])).completionRate.enough).toBe(false);
  });
  it('shows where unfinished runs sit, and flags a step that most people answer wrongly only when the sample is big enough', () => {
    const stuck = report([run('a', { stepId: 'predict' }), run('b', { stepId: 'predict' }), run('c', { stepId: 'hook' })]);
    expect(mine(stuck).stuckAt[0]).toEqual({ stepId: 'predict', count: 2 });
    const practice = U.steps.find((st) => st.type === 'item' && st.phase === 'practice')!.id;
    const wrong = (id: string) => run(id, { results: [{ stepId: practice, correct: false, score: 0, hintsUsed: 0 }] });
    expect(mine(report([wrong('a'), wrong('b')])).confusingSteps).toEqual([]);
    expect(mine(report(['a', 'b', 'c', 'd', 'e'].map(wrong))).confusingSteps.map((c) => c.stepId)).toEqual([practice]);
  });
  it('a wrong prediction is expected, so a prediction step is never reported as confusing', () => {
    const predict = U.steps.find((st) => st.phase === 'predict')!.id;
    const wrong = (id: string) => run(id, { results: [{ stepId: predict, correct: false, score: 0, hintsUsed: 0 }] });
    expect(mine(report(['a', 'b', 'c', 'd', 'e', 'f'].map(wrong))).confusingSteps).toEqual([]);
  });
  it('hint reliance is counted per run', () => {
    expect(mine(report([run('a', { hintsUsed: 2 }), run('b')])).hintRuns.value).toBe(0.5);
  });
  it('a return after a break of three days or more is counted', () => {
    expect(report([run('a', { updatedAt: D(1) }), run('b', { updatedAt: D(2) }), run('c', { updatedAt: D(9) })]).returnsAfterBreak).toBe(1);
  });
  it('contains no timing: nothing in a run or in the report measures time spent', () => {
    expect(JSON.stringify(report([run('a')]))).not.toMatch(/duration|timeSpent|seconds|elapsed/i);
  });
  it('an empty history gives an empty report, not an error', () => {
    const r = report([]);
    expect(r.totals).toEqual({ runs: 0, completed: 0, hintRuns: 0 });
    expect(r.repeatedMisconceptions).toEqual([]);
  });
});

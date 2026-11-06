import { describe, expect, it } from 'vitest';
import { ExperimentSchema, type Experiment } from '@/domain/experiments/model';
import { PILOT_RUNS_PER_CONDITION, buildPilotExperiment, buildQuickRun, currentPilotStep, nextRunLabel, pilotComplete, pilotInputProblems, pilotReading, pilotSteps, runSheetMarkdown, suggestedRunOrder, type PilotInput } from '@/domain/pilot/pilot';
import { PILOT_STARTERS } from '@/content/pilot/starters';
import { LESSONS } from '@/content/lessons';
import { compareExperiment } from '@/domain/experiments/compare';

const T = '2026-11-06T10:00:00.000Z';
let n = 0;
const nid = (p: string) => `${p}_${++n}`;
const input = (over: Partial<PilotInput> = {}): PilotInput => ({
  starter: 'prompts', title: 'Examples in my commit prompt', problem: 'Write a commit message in my team style from a diff.', criteria: ['The message follows the house format and is accurate.'],
  baseline: 'My current one-line instruction, pasted exactly.', improved: 'The same instruction with three worked examples.', difference: 'Three worked examples added; nothing else changes.',
  hypothesis: 'Examples raise the share in house style; if they are copied literally I will drop them.', prompt: 'Diff: <paste the same diff>. Write the commit message.', technique: 'Few-shot examples', ...over,
});
const build = (over: Partial<PilotInput> = {}): Experiment => { const r = buildPilotExperiment(input(over), 'e1', nid, T); if (!r.ok) throw new Error(r.problems.join(' ')); return r.experiment; };

describe('starters', () => {
  it('offers the three starters, each with constants, per-run steps, what to save and what cannot be inferred', () => {
    expect(PILOT_STARTERS.map((s) => s.id)).toEqual(['skill', 'workflow', 'prompts']);
    for (const s of PILOT_STARTERS) {
      expect(s.keepConstant.length, s.id).toBeGreaterThanOrEqual(4);
      expect(s.baselineRun.length && s.improvedRun.length && s.save.length && s.cannotInfer.length, s.id).toBeGreaterThan(0);
      expect(s.measures.length, s.id).toBeGreaterThanOrEqual(2);
      for (const l of s.relatedLessons) expect(LESSONS.some((x) => x.id === l), `${s.id} -> ${l}`).toBe(true);
    }
    expect(PILOT_STARTERS.find((s) => s.id === 'skill')!.cannotInfer.join(' ')).toMatch(/does not prove it was invoked/);
  });
});

describe('creating the experiment reuses the Lab, with a baseline and exactly one stated difference', () => {
  it('builds an ordinary, valid experiment with two conditions and no runs', () => {
    const e = build();
    expect(ExperimentSchema.safeParse(e).success).toBe(true);
    expect(e.conditions.map((c) => c.kind)).toEqual(['baseline', 'prompt']);
    expect(e.runs).toEqual([]);
    expect(e.pilot).toMatchObject({ starter: 'prompts', technique: 'Few-shot examples' });
    expect(e.plannedRuns).toBe(PILOT_RUNS_PER_CONDITION);
    expect(e.status).toBe('draft');
  });
  it('the three starters map to skill / workflow / prompt experiments with a baseline each', () => {
    const kinds = PILOT_STARTERS.map((s) => build({ starter: s.id }).experimentType);
    expect(kinds).toEqual(['skill', 'workflow', 'prompt']);
    expect(build({ starter: 'skill' }).conditions[0]!.kind).toBe('no-skill');
  });
  it('refuses to create anything until the plan is written, and says what is missing', () => {
    const p = pilotInputProblems(input({ problem: 'x', criteria: [], hypothesis: '', difference: '', prompt: '' }));
    expect(p.length).toBeGreaterThanOrEqual(5);
    const r = buildPilotExperiment(input({ problem: '' }), 'e', nid, T);
    expect(r.ok).toBe(false);
  });
});

describe('the eight steps are derived from the stored experiment, not ticked by hand', () => {
  it('starts with steps 1-3 done, then needs runs, evidence, an evaluation with limits, a reflection and a next improvement', () => {
    const e = build();
    expect(pilotSteps(e).map((s) => s.done)).toEqual([true, true, true, false, false, false, false, false]);
    expect(currentPilotStep(e)!.id).toBe('run');
    expect(pilotComplete(e)).toBe(false);
  });

  it('a step is not done because text exists: short answers do not count', () => {
    const e = build();
    const short = { ...e, conclusion: 'ok', limitations: 'none', pilot: { ...e.pilot!, nextImprovement: 'x' } };
    expect(pilotSteps(short).filter((s) => ['evaluate', 'reflect', 'next'].includes(s.id)).every((s) => !s.done)).toBe(true);
  });

  it('completes only with three runs per condition that carry a measurement, written limits, a reflection and a next step', () => {
    let e = build();
    for (let i = 0; i < 3; i++) for (const c of e.conditions) e = { ...e, runs: [...e.runs, buildQuickRun(e, { conditionId: c.id, attempt: 'completed', success: c.label === 'A' ? 'no' : 'yes', reworkRounds: c.label === 'A' ? 3 : 1, effortMin: null, interventions: null, observations: '' }, nid('run'), `${T.slice(0, 19)}.${100 + e.runs.length}Z`)] };
    expect(pilotSteps(e).find((s) => s.id === 'evidence')!.done).toBe(true);
    expect(pilotComplete(e)).toBe(false);
    e = { ...e, limitations: 'One task, one model, scored by me.', conclusion: 'The examples helped on these three diffs, but two copied the example wording.', pilot: { ...e.pilot!, nextImprovement: 'Try different examples on new diffs.' } };
    expect(pilotComplete(e)).toBe(true);
  });

  it('two runs per condition is described as a weak reading, not as done', () => {
    let e = build();
    for (let i = 0; i < 2; i++) for (const c of e.conditions) e = { ...e, runs: [...e.runs, buildQuickRun(e, { conditionId: c.id, attempt: 'completed', success: 'yes', reworkRounds: 1, effortMin: null, interventions: null, observations: '' }, nid('run'), T)] };
    const s = pilotSteps(e).find((x) => x.id === 'evidence')!;
    expect(s.done).toBe(false);
    expect(s.detail).toMatch(/weak reading/);
  });
});

describe('run order and quick runs', () => {
  it('alternates the order (ABBA) so one condition does not always go first', () => {
    expect(suggestedRunOrder(['A', 'B'], 3)).toEqual(['A', 'B', 'B', 'A', 'A', 'B']);
    expect(suggestedRunOrder(['A'], 3)).toEqual([]);
  });
  it('suggests the next condition from what is recorded and stops when the plan is done', () => {
    let e = build();
    const seq: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const l = nextRunLabel(e);
      seq.push(l);
      if (!l) break;
      const c = e.conditions.find((x) => x.label === l)!;
      e = { ...e, runs: [...e.runs, buildQuickRun(e, { conditionId: c.id, attempt: 'completed', success: 'yes', reworkRounds: 0, effortMin: null, interventions: null, observations: '' }, nid('run'), `${T.slice(0, 19)}.${100 + i}Z`)] };
    }
    expect(seq).toEqual(['A', 'B', 'B', 'A', 'A', 'B', null]);
  });
  it('a quick run leaves blanks unknown (never zero) and keeps failed attempts', () => {
    const e = build();
    const r = buildQuickRun(e, { conditionId: e.conditions[0]!.id, attempt: 'failed', success: 'unknown', reworkRounds: null, effortMin: null, interventions: null, observations: 'It looped; I stopped it.' }, 'r1', T);
    expect(r.successMet).toBeNull();
    expect(r.metrics).toEqual({});
    expect(r.attempt).toBe('failed');
    const withZero = buildQuickRun(e, { conditionId: e.conditions[0]!.id, attempt: 'completed', success: 'no', reworkRounds: 0, effortMin: null, interventions: null, observations: '' }, 'r2', T);
    expect(withZero.metrics.reworkRounds?.value).toBe(0); // an entered zero is a zero
    expect(withZero.index).toBe(1);
  });
});

describe('the reading never calls an approach better', () => {
  it('reports ranges and counts, says when the sample is thin, and carries the Lab integrity notes', () => {
    let e = build();
    for (const c of e.conditions) e = { ...e, runs: [...e.runs, buildQuickRun(e, { conditionId: c.id, attempt: 'completed', success: c.label === 'A' ? 'no' : 'yes', reworkRounds: c.label === 'A' ? 3 : 1, effortMin: null, interventions: null, observations: '' }, nid('run'), T)] };
    const r = pilotReading(e);
    expect(r.enough).toBe(false);
    expect(r.headline).toMatch(/Anecdotal/);
    expect(JSON.stringify(r)).not.toMatch(/\bwinner\b|\bwins\b|\bproves?\b|statistically|(?:is|are) (?:clearly )?better than/i);
    expect(r.rows.some((x) => /Rework/.test(x.measure))).toBe(true);
    expect(compareExperiment(e).sufficiency.level).toBe('anecdotal');
  });
});

describe('the run sheet tells the learner what to copy, keep constant and save', () => {
  it('contains the exact prompt, the checks, the constants, both conditions, an alternating order and what cannot be inferred', () => {
    const md = runSheetMarkdown(build({ starter: 'skill', technique: 'my-debug-skill' }));
    expect(md).toContain('Diff: <paste the same diff>');
    expect(md).toContain('The message follows the house format');
    expect(md).toMatch(/Keep constant/);
    expect(md).toMatch(/Condition A/);
    expect(md).toMatch(/Condition B: my-debug-skill/);
    expect(md).toMatch(/A → B → B → A → A → B/);
    expect(md).toMatch(/does not prove it was invoked/);
    expect(md).toMatch(/Forge does not run Claude, install anything or read your project/);
  });
});

describe('Round 6: pilot feedback and the next-action line', () => {
  it('nextActionText names one concrete action for the first unfinished step', async () => {
    const { nextActionText } = await import('@/domain/pilot/pilot');
    const a = nextActionText(build());
    expect(a.text.length).toBeGreaterThan(20);
    expect(a.stepId).toBe('run');
    expect(a.text).toMatch(/Copy the prompt into your own Claude Code and run condition/);
  });

  it('feedback is optional, defaults safely, and older experiments without it still parse', async () => {
    const { PilotMetaSchema, PilotFeedbackSchema } = await import('@/domain/experiments/model');
    expect(PilotMetaSchema.parse({ starter: 'skill', startedAt: T }).feedback).toBeNull();
    const fb = PilotFeedbackSchema.parse({ savedAt: T });
    expect(fb.judgmentChanged).toBe('unsure');
    expect(fb.wouldRepeat).toBe('maybe');
    const e = build();
    const { feedback: _f, ...old } = e.pilot!;
    expect(ExperimentSchema.parse({ ...e, pilot: old }).pilot!.feedback).toBeNull();
  });

  it('feedback is never a measurement: it does not change the comparison or the pilot steps', () => {
    const e = build();
    const withFb = { ...e, pilot: { ...e.pilot!, feedback: { confusing: 'x', unnecessaryEffort: 'y', judgmentChanged: 'yes' as const, improve: 'z', wouldRepeat: 'yes' as const, savedAt: T } } };
    expect(JSON.stringify(compareExperiment(withFb))).toBe(JSON.stringify(compareExperiment(e)));
    expect(pilotSteps(withFb).map((s) => s.done)).toEqual(pilotSteps(e).map((s) => s.done));
  });
});

import { ExperimentSchema, RunSchema, isBaselineKind, type Experiment, type MetricId, type Run } from '@/domain/experiments/model';
import { compareExperiment } from '@/domain/experiments/compare';
import { getPilotStarter } from '@/content/pilot/starters';

/**
 * The guided first experiment is an ordinary AI Lab experiment with a little guidance state (`experiment.pilot`). Everything
 * below is derived from the stored experiment, so there is no second place where data can disagree with the Lab.
 */
export type PilotStarterId = 'skill' | 'workflow' | 'prompts';
export const PILOT_RUNS_PER_CONDITION = 3;

export interface PilotInput {
  starter: PilotStarterId;
  title: string;
  problem: string;
  criteria: string[];
  baseline: string;
  improved: string;
  difference: string;
  hypothesis: string;
  prompt: string;
  technique: string;
  skillVersion?: string;
  playbookId?: string | null;
  stepId?: string | null;
  env?: { model?: string; claudeCodeVersion?: string; settings?: string };
}

export function pilotInputProblems(i: PilotInput): string[] {
  const p: string[] = [];
  if (i.title.trim().length < 3) p.push('Give the experiment a short title.');
  if (i.problem.trim().length < 20) p.push('Describe the task in a sentence or two (at least 20 characters).');
  if (i.criteria.filter((c) => c.trim().length >= 5).length < 1) p.push('Write at least one yes/no check you will apply to every run.');
  if (i.baseline.trim().length < 10) p.push('Say what the baseline is (how you do it now).');
  if (i.improved.trim().length < 10) p.push('Say what the improved approach is.');
  if (i.difference.trim().length < 10) p.push('State the one difference between the two.');
  if (i.hypothesis.trim().length < 20) p.push('Write what you expect and what would change your mind (at least 20 characters).');
  if (i.prompt.trim().length < 10) p.push('Paste the exact prompt or input you will use in every run.');
  if (i.technique.trim().length < 2) p.push('Name the Skill, workflow or technique you are testing.');
  return p;
}

export function buildPilotExperiment(i: PilotInput, id: string, newId: (prefix: string) => string, now: string): { ok: true; experiment: Experiment } | { ok: false; problems: string[] } {
  const problems = pilotInputProblems(i);
  const st = getPilotStarter(i.starter);
  if (!st) problems.push('Unknown starter.');
  if (problems.length || !st) return { ok: false, problems };
  const experiment = ExperimentSchema.parse({
    id,
    title: i.title.trim().slice(0, 200),
    experimentType: st.experimentType,
    subject: i.problem.trim().slice(0, 400),
    problem: i.problem.trim(),
    hypothesis: i.hypothesis.trim(),
    fixture: { id: 'custom', label: 'My own task (the inputs and starting state described in the experiment)', version: '', hash: null },
    successCriteria: i.criteria.map((c) => c.trim()).filter(Boolean),
    prompt: i.prompt.trim(),
    environment: { claudeCodeVersion: i.env?.claudeCodeVersion ?? '', model: i.env?.model ?? '', settings: i.env?.settings ?? '', os: '', notes: '' },
    plannedMeasures: st.measures,
    plannedRuns: PILOT_RUNS_PER_CONDITION,
    conditions: [
      { id: newId('cond'), label: 'A', kind: st.baselineKind, skillName: '', skillVersion: '', difference: i.baseline.trim() },
      { id: newId('cond'), label: 'B', kind: st.improvedKind, skillName: i.technique.trim(), skillVersion: (i.skillVersion ?? '').trim(), difference: i.difference.trim() },
    ],
    runs: [],
    status: 'draft',
    pilot: { starter: i.starter, technique: i.technique.trim(), nextImprovement: '', playbookId: i.playbookId ?? null, stepId: i.stepId ?? null, startedAt: now },
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true, experiment };
}

/* ------------------------------------------------------------------------------------------------- the eight steps */

export interface PilotStep { id: string; n: number; title: string; done: boolean; detail: string }

const MIN_REFLECT = 30;
const MIN_NEXT = 15;

/** Per-condition counts used by several steps. */
export function runCounts(exp: Experiment): { label: string; recorded: number; withData: number }[] {
  const c = compareExperiment(exp);
  return c.runsPerCondition.map((r) => ({ label: r.label, recorded: r.recorded, withData: r.withData }));
}

export function pilotSteps(exp: Experiment): PilotStep[] {
  const [a, b] = exp.conditions;
  const counts = runCounts(exp);
  const anyRuns = exp.runs.length > 0;
  const enough = counts.length >= 2 && counts.every((c) => c.withData >= PILOT_RUNS_PER_CONDITION);
  const weak = counts.length >= 2 && counts.every((c) => c.withData >= 2);
  return [
    { id: 'problem', n: 1, title: 'Choose the problem', done: exp.problem.trim().length >= 20 && exp.successCriteria.length >= 1, detail: 'A real task and checks you can answer yes or no.' },
    { id: 'baseline', n: 2, title: 'Describe the baseline', done: Boolean(a && a.difference.trim().length >= 10), detail: 'How you do it today.' },
    { id: 'improved', n: 3, title: 'Describe the improved approach', done: Boolean(b && b.difference.trim().length >= 10 && exp.hypothesis.trim().length >= 20 && exp.prompt.trim().length >= 10), detail: 'One difference, and what you expect.' },
    { id: 'run', n: 4, title: 'Run it outside Forge', done: anyRuns, detail: 'In your own Claude Code. Forge runs nothing.' },
    { id: 'evidence', n: 5, title: 'Record the evidence', done: enough, detail: enough ? 'Three runs per condition with a measurement.' : weak ? 'Two runs per condition is a weak reading; three is the minimum for a direction.' : `Aim for ${PILOT_RUNS_PER_CONDITION} runs per condition.` },
    { id: 'evaluate', n: 6, title: 'Evaluate', done: enough && exp.limitations.trim().length >= 20, detail: 'Read the comparison, then write what it cannot show.' },
    { id: 'reflect', n: 7, title: 'Reflect', done: exp.conclusion.trim().length >= MIN_REFLECT, detail: 'What you conclude, in your own words.' },
    { id: 'next', n: 8, title: 'Plan the next improvement', done: (exp.pilot?.nextImprovement ?? '').trim().length >= MIN_NEXT, detail: 'One change to try next, or a decision to stop.' },
  ];
}

/**
 * One plain sentence about what to do right now, so the first experiment can be done without reading long documentation.
 * It names the single next action for the first step that is not done.
 */
export function nextActionText(exp: Experiment): { text: string; stepId: string } {
  const step = currentPilotStep(exp);
  const next = nextRunLabel(exp);
  if (!step) return { stepId: 'done', text: 'Every step is done. Save one takeaway from what you found, or take it to a real task.' };
  const text: Record<string, string> = {
    problem: 'Describe one real task and at least one check you can answer yes or no.',
    baseline: 'Write how you do this task today. That is condition A.',
    improved: 'Write the one thing you will change, what you expect, and the exact prompt you will use in every run.',
    run: next ? `Copy the prompt into your own Claude Code and run condition ${next}. Change nothing else between runs.` : 'Run the remaining conditions in your own Claude Code.',
    evidence: next ? `Record what happened in the run you just did. Next suggested run: condition ${next}.` : 'Record what happened in each run, including failed ones.',
    evaluate: 'Read the comparison, then write what this result cannot show.',
    reflect: 'Write what you conclude and how sure you are, in your own words.',
    next: 'Write one change to try next, or a decision to stop.',
  };
  return { stepId: step.id, text: text[step.id] ?? step.detail };
}

/** The first step that is not done; null when every step is done. */
export function currentPilotStep(exp: Experiment): PilotStep | null {
  return pilotSteps(exp).find((s) => !s.done) ?? null;
}

export const pilotComplete = (exp: Experiment): boolean => pilotSteps(exp).every((s) => s.done);

/* ------------------------------------------------------------------------------------------------- run order */

/**
 * ABBA counterbalancing: A B, B A, A B ... so neither condition always goes first (practice and fatigue effects land on both).
 * Deterministic, so reopening the page shows the same plan.
 */
export function suggestedRunOrder(labels: string[], perCondition: number): string[] {
  const [a, b] = labels;
  if (!a || !b) return [];
  const out: string[] = [];
  for (let k = 0; k < perCondition; k++) out.push(...(k % 2 === 0 ? [a, b] : [b, a]));
  return out;
}

/** The label of the condition to run next, following the ABBA plan; null when every planned run is recorded. */
export function nextRunLabel(exp: Experiment, perCondition = PILOT_RUNS_PER_CONDITION): string | null {
  const labels = exp.conditions.map((c) => c.label);
  const plan = suggestedRunOrder(labels, perCondition);
  const done = new Map(labels.map((l) => [l, 0]));
  for (const r of [...exp.runs].sort((x, y) => x.recordedAt.localeCompare(y.recordedAt))) {
    const l = exp.conditions.find((c) => c.id === r.conditionId)?.label;
    if (l) done.set(l, (done.get(l) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  for (const l of plan) {
    seen.set(l, (seen.get(l) ?? 0) + 1);
    if ((done.get(l) ?? 0) < (seen.get(l) ?? 0)) return l;
  }
  return null;
}

/* ------------------------------------------------------------------------------------------------- quick run */

export interface QuickRunInput {
  conditionId: string;
  attempt: Run['attempt'];
  success: 'yes' | 'no' | 'unknown';
  reworkRounds: number | null;
  effortMin: number | null;
  interventions: number | null;
  observations: string;
  context?: string;
  /** From an import the learner chose to apply. Marked user-imported. */
  tests?: { passed: number; total: number } | null;
  runtimeSec?: number | null;
}

/** Build a Run from the few fields the guided flow asks for. Anything left blank is unknown, never zero. */
export function buildQuickRun(exp: Experiment, i: QuickRunInput, id: string, now: string): Run {
  const index = exp.runs.filter((r) => r.conditionId === i.conditionId).length + 1;
  const metrics: Run['metrics'] = {};
  const put = (m: MetricId, v: number | null) => { if (v !== null && Number.isFinite(v) && v >= 0) metrics[m] = { value: v, provenance: 'self-reported' }; };
  put('reworkRounds', i.reworkRounds);
  put('developerEffortMin', i.effortMin);
  put('interventions', i.interventions);
  if (i.runtimeSec !== undefined && i.runtimeSec !== null && Number.isFinite(i.runtimeSec) && i.runtimeSec >= 0) metrics.runtimeSec = { value: i.runtimeSec, provenance: 'user-imported' };
  const cond = exp.conditions.find((c) => c.id === i.conditionId);
  return RunSchema.parse({
    id, conditionId: i.conditionId, index, recordedAt: now,
    successMet: i.success === 'unknown' ? null : i.success === 'yes',
    ...(i.tests ? { testsPassed: i.tests.passed, testsTotal: i.tests.total, testsProvenance: 'user-imported' } : {}),
    metrics, observations: i.observations.trim().slice(0, 4000), attempt: i.attempt,
    skillVersion: cond?.skillVersion ?? '', fixtureVersion: '', context: (i.context ?? '').slice(0, 300),
  });
}

/* ------------------------------------------------------------------------------------------------- reading the result */

export interface PilotReading {
  headline: string;
  rows: { measure: string; cells: { label: string; text: string }[]; reading: string }[];
  notes: string[];
  enough: boolean;
}

const f = (n: number | null) => (n === null ? 'unknown' : Number.isInteger(n) ? String(n) : n.toFixed(2));

/** A plain-language reading of the comparison for the first-experiment flow. It never says which approach is "better". */
export function pilotReading(exp: Experiment): PilotReading {
  const c = compareExperiment(exp);
  const rows = c.rows.filter((r) => r.kind !== 'rubric' && exp.plannedMeasures.includes(r.id)).map((r) => ({
    measure: r.label,
    cells: r.perCondition.map((p) => ({ label: p.label, text: p.stat.mean === null ? 'no value recorded' : `${f(p.stat.mean)} (range ${f(p.stat.min)} to ${f(p.stat.max)}, ${p.stat.n} run${p.stat.n === 1 ? '' : 's'})` })),
    reading: r.text,
  }));
  const notes = [...c.sufficiency.reasons, ...c.integrity.filter((n) => !/rubric|fixture hash/i.test(n))].slice(0, 8);
  return { headline: c.sufficiency.headline, rows, notes, enough: c.sufficiency.level === 'limited' };
}

/* ------------------------------------------------------------------------------------------------- run sheet */

/** What to copy into Claude Code and what to keep constant, as Markdown the learner can paste into their own notes. */
export function runSheetMarkdown(exp: Experiment): string {
  const st = exp.pilot ? getPilotStarter(exp.pilot.starter) : undefined;
  const [a, b] = exp.conditions;
  const L: string[] = [];
  L.push(`# Run sheet: ${exp.title}`, '', '> Forge does not run Claude, install anything or read your project. You run these in your own tools and record what happened.', '');
  L.push('## The task prompt (paste this exactly, in every run)', '', '```text', exp.prompt || '(not written yet)', '```', '');
  L.push('## Success checks (answer yes or no after each run)', '', ...(exp.successCriteria.length ? exp.successCriteria.map((c) => `- ${c}`) : ['- (none written)']), '');
  L.push('## Keep constant', '', ...(st?.keepConstant ?? ['The same prompt, starting state, model and settings in every run']).map((x) => `- ${x}`), '');
  if (a && b) {
    L.push(`## Condition ${a.label}: ${isBaselineKind(a.kind) ? 'baseline' : a.kind}`, '', `What it is: ${a.difference || '(not written)'}`, '', ...(st?.baselineRun ?? []).map((x) => `1. ${x}`), '');
    L.push(`## Condition ${b.label}: ${b.skillName || b.kind}`, '', `What differs: ${b.difference || '(not written)'}`, '', ...(st?.improvedRun ?? []).map((x) => `1. ${x}`), '');
  }
  const order = suggestedRunOrder(exp.conditions.map((c) => c.label), PILOT_RUNS_PER_CONDITION);
  L.push('## Suggested order', '', order.length ? order.join(' → ') : '(add two conditions)', '', 'Alternating the order keeps one condition from always going first.', '');
  L.push('## Save after every run', '', ...(st?.save ?? ['The output and your scoring']).map((x) => `- ${x}`), '');
  L.push('## This cannot show', '', ...(st?.cannotInfer ?? []).map((x) => `- ${x}`), '');
  return L.join('\n');
}

import type { SkillDraft } from '@/domain/skills/model';
import { contentOf } from '@/domain/skills/model';
import { designChecks, validateSkillContent } from '@/domain/skills/validate';
import { isBaselineKind, type Evidence, type Experiment } from '@/domain/experiments/model';
import { runMetric } from '@/domain/experiments/compare';
import type { Playbook } from '@/domain/playbook/model';
import type { ExternalResult, ExternalResults } from './grade';

/**
 * Verifies work done elsewhere in the app by reading SAVED records. Nothing here is self-reported:
 * if the data is not in IndexedDB the check fails. Pure functions, so they are unit-tested.
 */

interface Check {
  label: string;
  ok: boolean;
  note: string;
}

function summarize(checks: Check[]): ExternalResult {
  const passed = checks.filter((c) => c.ok).length;
  return { ok: passed === checks.length, progress: checks.length === 0 ? 0 : passed / checks.length, checks };
}

function skillChecks(s: SkillDraft, level: 'first' | 'capstone', experiments: Experiment[]): Check[] {
  const content = contentOf(s);
  const v = validateSkillContent(content);
  const ids = new Set(v.findings.map((f) => f.id));
  const pos = s.scenarios.filter((x) => x.expected === 'activate').length;
  const neg = s.scenarios.filter((x) => x.expected === 'not-activate').length;
  const amb = s.scenarios.filter((x) => x.expected === 'ambiguous').length;
  const base: Check[] = [
    { label: 'Passes validation with no errors', ok: v.errors === 0 && s.name.trim().length > 0, note: v.errors === 0 ? 'No validation errors.' : `${v.errors} validation error(s) remain.` },
    { label: 'Description contains a "use when…" trigger', ok: !ids.has('desc-no-trigger') && s.description.trim().length > 0, note: 'Claude matches requests against the description.' },
    { label: 'Has at least one positive and one negative scenario', ok: pos >= 1 && neg >= 1, note: `${pos} positive, ${neg} negative.` },
    { label: 'Exported as a ZIP at least once', ok: s.lastExportedAt !== null, note: s.lastExportedAt ? `Exported ${s.lastExportedAt.slice(0, 10)}.` : 'Use "Export ZIP" in the Workshop.' },
  ];
  if (level === 'first') return base;
  const liveRecorded = s.liveTests.filter((t) => t.observed !== 'unknown').length;
  const safetyWarnings = v.findings.filter((f) => f.id.startsWith('safety-') && f.severity !== 'info').length;
  const compared = experiments.some((e) => !e.synthetic && e.conditions.some((c) => c.skillName.trim() !== '' && c.skillName.trim() === s.name.trim()));
  return [
    ...base,
    { label: 'Description has a "not for…" boundary', ok: !ids.has('desc-no-negative'), note: 'Boundaries stop over-triggering.' },
    { label: 'At least 6 scenarios: 2+ positive, 2+ negative, 1+ ambiguous', ok: s.scenarios.length >= 6 && pos >= 2 && neg >= 2 && amb >= 1, note: `${s.scenarios.length} total (${pos}/${neg}/${amb}).` },
    { label: 'Uses a linked reference file (progressive disclosure)', ok: s.references.length >= 1 && !ids.has('ref-unused') && !ids.has('ref-missing'), note: `${s.references.length} supporting file(s).` },
    { label: 'No safety-class findings', ok: safetyWarnings === 0, note: safetyWarnings === 0 ? 'Clean (advisory only).' : `${safetyWarnings} safety finding(s) - review them.` },
    { label: 'At least 2 saved revision snapshots', ok: s.revisions.length >= 2, note: `${s.revisions.length} snapshot(s).` },
    { label: 'At least 1 live test recorded from real Claude Code use', ok: liveRecorded >= 1, note: `${liveRecorded} observation(s) with a result.` },
    { label: 'Compared in an AI Lab experiment (a condition names this Skill)', ok: compared, note: compared ? 'Linked experiment found.' : 'Create an experiment with a condition whose Skill name matches.' },
    ...(designChecks(content).some((f) => f.severity === 'warning') ? [] : []),
  ];
}

function best(results: ExternalResult[]): ExternalResult {
  return results.sort((a, b) => b.progress - a.progress)[0] ?? summarize([{ label: 'You have saved at least one Skill in the Workshop', ok: false, note: 'Nothing saved yet.' }]);
}

export function evaluateWorkshopSkill(level: 'first' | 'capstone', skills: SkillDraft[], experiments: Experiment[]): ExternalResult {
  if (skills.length === 0) return summarize([{ label: 'You have saved at least one Skill in the Workshop', ok: false, note: 'Nothing saved yet.' }]);
  return best(skills.map((s) => summarize(skillChecks(s, level, experiments))));
}

export function evaluateExperiment(experiments: Experiment[], evidence: Evidence[]): ExternalResult {
  const real = experiments.filter((e) => !e.synthetic);
  if (real.length === 0) return summarize([{ label: 'You have created an experiment (not the demo)', ok: false, note: 'Open the AI Lab and create one.' }]);
  const results = real.map((e) => {
    const perCond = e.conditions.map((c) => e.runs.filter((r) => r.conditionId === c.id));
    const known = (r: (typeof e.runs)[number]) => ['testsPassedRatio', 'successRate', 'seededIssuesFound', 'developerEffortMin', 'runtimeSec', 'tokens'].some((m) => runMetric(r, m as never, null) !== null);
    return summarize([
      { label: 'Hypothesis written', ok: e.hypothesis.trim().length > 0, note: 'Write it before the runs.' },
      { label: 'At least two conditions', ok: e.conditions.length >= 2, note: `${e.conditions.length} condition(s).` },
      { label: 'At least one run per condition', ok: e.conditions.length >= 2 && perCond.every((r) => r.length >= 1), note: perCond.map((r) => r.length).join(' / ') + ' run(s).' },
      { label: 'Every condition has at least one run with a known measurement', ok: e.conditions.length >= 2 && perCond.every((r) => r.some(known)), note: 'Unknown values do not count.' },
      { label: 'At least one evidence item attached (pasted output, file or test report)', ok: evidence.some((x) => x.experimentId === e.id), note: 'Evidence is stored with its provenance.' },
    ]);
  });
  return best(results);
}

/** Lesson 15: a playbook that actually specifies a reliable workflow. */
export function evaluatePlaybook(playbooks: Playbook[]): ExternalResult {
  const none = summarize([{ label: 'You have saved a playbook (Build -> Playbooks)', ok: false, note: 'Nothing saved yet.' }]);
  if (playbooks.length === 0) return none;
  const results = playbooks.map((p) => {
    const gated = p.steps.filter((s) => s.verification.trim().length >= 10).length;
    const handled = p.steps.filter((s) => s.failureHandling.trim().length >= 10).length;
    return summarize([
      { label: 'A title and a goal', ok: p.title.trim().length > 0 && p.goal.trim().length >= 15, note: 'State the goal in a sentence.' },
      { label: 'At least one input and one expected output', ok: p.inputs.some((i) => i.trim()) && p.outputs.some((o) => o.trim()), note: `${p.inputs.length} input(s), ${p.outputs.length} output(s).` },
      { label: 'At least four steps', ok: p.steps.length >= 4, note: `${p.steps.length} step(s).` },
      { label: 'Every step has a verification gate', ok: p.steps.length > 0 && gated === p.steps.length, note: `${gated} of ${p.steps.length} step(s) have a gate.` },
      { label: 'Failure handling on at least two steps', ok: handled >= 2, note: `${handled} step(s) say what to do when they fail.` },
      { label: 'At least one human approval point', ok: p.steps.some((s) => s.humanApproval), note: 'Mark the step where a person must decide.' },
      { label: 'Clear completion criteria', ok: p.completionCriteria.trim().length >= 20, note: 'Say how you will know it is finished.' },
    ]);
  });
  return best(results);
}

/** Lesson 16: an experiment with repeated runs per condition, written-down limits, and known measurements. */
export function evaluateRepeatedRuns(experiments: Experiment[]): ExternalResult {
  const real = experiments.filter((e) => !e.synthetic);
  if (real.length === 0) return summarize([{ label: 'You have created an experiment (not the demo)', ok: false, note: 'Open the AI Lab and create one.' }]);
  const known = (r: Experiment['runs'][number]) => ['testsPassedRatio', 'successRate', 'seededIssuesFound', 'developerEffortMin', 'runtimeSec', 'tokens', 'reworkRounds', 'interventions'].some((m) => runMetric(r, m as never, null) !== null);
  return best(
    real.map((e) => {
      const per = e.conditions.map((c) => e.runs.filter((r) => r.conditionId === c.id));
      return summarize([
        { label: 'A hypothesis written before the runs', ok: e.hypothesis.trim().length >= 15, note: 'Say what you expect and why.' },
        { label: 'A baseline condition', ok: e.conditions.some((c) => isBaselineKind(c.kind)), note: 'Without a baseline you cannot attribute a difference.' },
        { label: 'At least two runs per condition', ok: e.conditions.length >= 2 && per.every((r) => r.length >= 2), note: per.map((r) => r.length).join(' / ') + ' run(s).' },
        { label: 'Every condition has runs with a known measurement', ok: e.conditions.length >= 2 && per.every((r) => r.filter(known).length >= 2), note: 'Unknown values do not count as measurements.' },
        { label: 'Limitations written down', ok: e.limitations.trim().length >= 20, note: 'Say what this experiment cannot show.' },
      ]);
    }),
  );
}

/** Lesson 23: an AI Lab experiment that is built like an evaluation harness, not just a pair of anecdotes. */
export function evaluateEvaluationHarness(experiments: Experiment[]): ExternalResult {
  const real = experiments.filter((e) => !e.synthetic);
  if (real.length === 0) return summarize([{ label: 'You have created an experiment (not the demo)', ok: false, note: 'Open the AI Lab and create one.' }]);
  const known = (r: Experiment['runs'][number]) => ['testsPassedRatio', 'successRate', 'seededIssuesFound', 'developerEffortMin', 'runtimeSec', 'tokens', 'reworkRounds', 'interventions'].some((m) => runMetric(r, m as never, null) !== null);
  return best(
    real.map((e) => {
      const per = e.conditions.map((c) => e.runs.filter((r) => r.conditionId === c.id));
      return summarize([
        { label: 'A hypothesis written before the runs', ok: e.hypothesis.trim().length >= 15, note: 'Say what you expect and why.' },
        { label: 'Success criteria defined in advance', ok: e.successCriteria.some((c) => c.trim().length >= 5), note: 'List what counts as success before you look at results.' },
        { label: 'Measures planned in advance', ok: e.plannedMeasures.length >= 1, note: 'Choose the measures before the first run.' },
        { label: 'A baseline condition', ok: e.conditions.some((c) => isBaselineKind(c.kind)), note: 'Without a baseline you cannot attribute a difference.' },
        { label: 'The same cases for every condition (a fixture, hashed or described)', ok: Boolean(e.fixture.hash) || (e.fixture.id === 'custom' && e.fixture.label.trim().length >= 10), note: 'Identify the cases: a fixture with a hash, or a described custom fixture.' },
        { label: 'At least three runs per condition with a known measurement', ok: e.conditions.length >= 2 && per.every((r) => r.filter(known).length >= 3), note: `${per.map((r) => r.filter(known).length).join(' / ')} run(s) with data.` },
        { label: 'The rubric locked before recording', ok: Boolean(e.rubricLockedAt), note: 'Recording the first run locks the rubric; do not change criteria afterwards.' },
        { label: 'Limitations written down', ok: e.limitations.trim().length >= 20, note: 'Say what this evaluation cannot show.' },
      ]);
    }),
  );
}

export function evaluateExternal(skills: SkillDraft[], experiments: Experiment[], evidence: Evidence[], playbooks: Playbook[] = []): ExternalResults {
  return {
    'playbook-workflow': evaluatePlaybook(playbooks),
    'lab-repeated-runs': evaluateRepeatedRuns(experiments),
    'lab-evaluation-harness': evaluateEvaluationHarness(experiments),
    'workshop-first-skill': evaluateWorkshopSkill('first', skills, experiments),
    'workshop-capstone-skill': evaluateWorkshopSkill('capstone', skills, experiments),
    'battle-lab-experiment': evaluateExperiment(experiments, evidence),
  };
}

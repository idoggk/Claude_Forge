import type { SkillDraft } from '@/domain/skills/model';
import { contentOf } from '@/domain/skills/model';
import { designChecks, validateSkillContent } from '@/domain/skills/validate';
import type { Evidence, Experiment } from '@/domain/experiments/model';
import { runMetric } from '@/domain/experiments/compare';
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
    { label: 'Compared in a Battle Lab experiment (a condition names this Skill)', ok: compared, note: compared ? 'Linked experiment found.' : 'Create an experiment with a condition whose Skill name matches.' },
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
  if (real.length === 0) return summarize([{ label: 'You have created an experiment (not the demo)', ok: false, note: 'Open the Battle Lab and create one.' }]);
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

export function evaluateExternal(skills: SkillDraft[], experiments: Experiment[], evidence: Evidence[]): ExternalResults {
  return {
    'workshop-first-skill': evaluateWorkshopSkill('first', skills, experiments),
    'workshop-capstone-skill': evaluateWorkshopSkill('capstone', skills, experiments),
    'battle-lab-experiment': evaluateExperiment(experiments, evidence),
  };
}

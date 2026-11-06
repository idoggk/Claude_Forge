import type { Evidence, Experiment } from './model';
import { ATTEMPT_LABELS, CONDITION_KIND_LABELS, EXPERIMENT_TYPE_LABELS, METRICS, isBaselineKind } from './model';
import type { Comparison } from './compare';
import { compareExperiment } from './compare';
import { CLASSIFICATION_LABEL } from '@/domain/transcript/candidates';

export const EXPERIMENT_FORMAT = 'claude-forge-experiment';
export const EXPERIMENT_FORMAT_VERSION = 1;

export function exportExperimentJson(exp: Experiment, evidence: Evidence[], seededTotal: number | null = null): string {
  const comparison = compareExperiment(exp, seededTotal);
  return (
    JSON.stringify(
      {
        format: EXPERIMENT_FORMAT,
        version: EXPERIMENT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        notice: 'Recorded by the user in Claude Forge. Claude Forge does not run Claude; every metric is self-reported or user-imported.',
        experiment: exp,
        evidence,
        derivedComparison: comparison,
      },
      null,
      2,
    ) + '\n'
  );
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function buildExperimentReport(exp: Experiment, evidence: Evidence[], comparison: Comparison): string {
  const L: string[] = [];
  L.push(`# ${exp.title}`, '');
  if (exp.synthetic) L.push('> **SYNTHETIC DEMONSTRATION.** The data below is invented to explain methodology. No Claude execution occurred.', '');
  L.push('> Produced by Claude Forge from evidence the user recorded manually. Claude Forge did not run Claude and does not verify any value. Unknown values are shown as "unknown" and are never treated as zero.', '');
  L.push('## Question', '', exp.problem || '_not stated_', '', '## Hypothesis (written before the runs)', '', exp.hypothesis || '_not stated_', '');
  L.push('## Setup', '');
  L.push(`- Compares: ${EXPERIMENT_TYPE_LABELS[exp.experimentType]}${exp.subject ? ` - ${exp.subject}` : ''}`);
  L.push(`- Fixture: ${exp.fixture.label} (id \`${exp.fixture.id}\`, version ${exp.fixture.version || 'unknown'}, hash ${exp.fixture.hash ? '`' + exp.fixture.hash + '`' : 'not recorded'})`);
  L.push(`- Planned runs per condition: ${exp.plannedRuns}`);
  L.push(`- Environment: Claude Code ${exp.environment.claudeCodeVersion || 'version unknown'}, model ${exp.environment.model || 'unknown'}, OS ${exp.environment.os || 'unknown'}${exp.environment.settings ? ', settings: ' + exp.environment.settings : ''}`);
  if (exp.environment.notes) L.push(`- Environment notes: ${exp.environment.notes}`);
  L.push('', '**Success criteria**', '');
  if (exp.successCriteria.length) exp.successCriteria.forEach((c) => L.push(`- ${c}`));
  else L.push('- _none defined in advance_');
  L.push('', '**Prompt used for every condition**', '', '```text', exp.prompt || '(not recorded)', '```', '');
  L.push('## Conditions', '', '| Label | Kind | Name | Version | What differs |', '|---|---|---|---|---|');
  for (const c of exp.conditions) L.push(`| ${cell(c.label)} | ${CONDITION_KIND_LABELS[c.kind]} | ${cell(c.skillName) || '-'} | ${cell(c.skillVersion) || '-'} | ${cell(c.difference) || '-'} |`);
  // ---- Observed results: only what was recorded.
  L.push('', '## Observed results', '', '_Only what was recorded. Nothing in this section is an interpretation._', '');
  L.push('### Evidence sufficiency', '', `**${comparison.sufficiency.headline}**`, '');
  for (const r of comparison.sufficiency.reasons) L.push(`- ${r}`);
  L.push('', '### Attempts per condition', '', '| Condition | Attempts recorded | Failed (kept) | Abandoned (kept) | With a known measurement |', '|---|---|---|---|---|');
  for (const r of comparison.runsPerCondition) L.push(`| ${cell(r.label)} | ${r.recorded} | ${r.failed} | ${r.abandoned} | ${r.withData} |`);
  L.push('', '### Measured values', '');
  const header = ['Measure', ...exp.conditions.map((c) => c.label), 'Reading'];
  L.push(`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`);
  for (const row of comparison.rows) {
    const fmt = (s: { n: number; unknown: number; mean: number | null; min: number | null; max: number | null; sd: number | null }) =>
      s.mean === null ? `unknown${s.unknown ? ` (${s.unknown} missing)` : ''}` : `${row.unit === 'ratio' ? s.mean.toFixed(2) : Number(s.mean.toFixed(1))} [${s.min}–${s.max}] n=${s.n}${s.sd !== null ? `, sd ${row.unit === 'ratio' ? s.sd.toFixed(2) : Number(s.sd.toFixed(1))}` : ''}${s.unknown ? `, ${s.unknown} missing` : ''}`;
    L.push(`| ${cell(row.label)} | ${row.perCondition.map((c) => cell(fmt(c.stat))).join(' | ')} | ${cell(row.text)} |`);
  }
  L.push('', 'Format: mean [min–max] n=known values, sd = sample standard deviation from two values (a description of spread, not a test). No significance test was computed.');
  if (comparison.rubricTotal) {
    L.push('', `Rubric subtotal over criteria recorded for every condition (${comparison.rubricTotal.included.join(', ')}); excluded, not zeroed: ${comparison.rubricTotal.excluded.join(', ') || 'none'}.`, '');
    for (const t of comparison.rubricTotal.totals) L.push(`- ${t.label}: ${t.total.toFixed(2)} / ${t.max}`);
  }
  L.push('', '### Runs', '');
  for (const r of exp.runs) {
    const cond = exp.conditions.find((c) => c.id === r.conditionId);
    const parts: string[] = [];
    for (const m of METRICS) {
      const v = m.id === 'testsPassedRatio' ? (r.testsPassed !== null && r.testsTotal ? `${r.testsPassed}/${r.testsTotal} (${r.testsProvenance})` : null) : r.metrics[m.id]?.value;
      if (v !== null && v !== undefined) parts.push(`${m.label}: ${v}`);
    }
    const ctx = [r.attempt !== 'completed' ? ATTEMPT_LABELS[r.attempt] : '', r.skillVersion && `version ${r.skillVersion}`, r.fixtureVersion && `fixture v${r.fixtureVersion}`, r.context && `context: ${r.context}`].filter(Boolean).join('; ');
    L.push(`- **${cond?.label ?? '?'} · run ${r.index}**${ctx ? ` [${ctx}]` : ''} - ${parts.join('; ') || 'no measurements'}${r.observations ? ` - notes: ${r.observations}` : ''}`);
  }
  L.push('', '### What was observed (your notes)', '', exp.observations || '_none_', '');
  if (evidence.length) {
    L.push('### Attached evidence', '');
    for (const e of evidence) L.push(`- ${e.name} (${e.kind}, ${e.size} bytes, ${e.provenance === 'user-imported' ? 'user-imported: untrusted text you supplied' : 'self-reported'}${e.classification ? `, classified: ${CLASSIFICATION_LABEL[e.classification]}` : ''})`);
    L.push('');
  }
  // ---- Interpretation: what the figures suggest, kept apart from the figures.
  L.push('## Interpretation', '', '_What the recorded values suggest. This is reasoning, not data._', '');
  L.push(`- Computed reading: ${comparison.detail || comparison.sufficiency.headline}`);
  L.push(`- Your conclusion: ${exp.conclusion.trim() ? exp.conclusion.trim().replace(/\r?\n/g, ' ') : '_none written_'}`, '');
  // ---- Limitations: yours plus the ones the record itself shows.
  L.push('## Limitations', '', `- Stated by you: ${exp.limitations.trim() ? exp.limitations.trim().replace(/\r?\n/g, ' ') : '_none stated_'}`);
  for (const n of comparison.integrity) L.push(`- ${n}`);
  L.push('- Claude Forge ran nothing here; every figure is self-reported or user-imported and none can be verified by Forge.', '');
  L.push('## Next experiment', '', ...nextExperiment(exp, comparison).map((x) => `- ${x}`), '');
  return L.join('\n') + '\n';
}

/** Concrete follow-ups derived from what is weak in THIS record. Always ends with the held-out check and a stated stopping rule. */
export function nextExperiment(exp: Experiment, c: Comparison): string[] {
  const out: string[] = [];
  if (exp.conditions.length < 2) out.push('Add a second condition so there is something to compare.');
  if (exp.conditions.length >= 2 && !exp.conditions.some((x) => isBaselineKind(x.kind))) out.push('Add a baseline condition (the current way of doing it) so a difference can be attributed to what you changed.');
  const thin = c.runsPerCondition.filter((r) => r.withData < 3);
  if (thin.length) out.push(`Record more runs with a known measurement: ${thin.map((r) => `${r.label} has ${r.withData}, aim for at least ${Math.max(3, r.withData + 1)}`).join('; ')}.`);
  const gaps = c.rows.filter((r) => r.kind !== 'rubric' && exp.plannedMeasures.includes(r.id as never) && r.perCondition.some((p) => p.stat.n === 0));
  if (gaps.length) out.push(`Measure ${gaps.map((r) => r.label).join(', ')} for every condition, or remove it from the plan. A blank is unknown, not zero.`);
  if (c.integrity.some((n) => /version|context|fixture/i.test(n) && /differ|more than one/i.test(n))) out.push('Hold the Skill or workflow version, fixture version and execution context constant across runs, or split the runs into separate experiments.');
  if (c.runsPerCondition.some((r) => r.failed + r.abandoned > 0)) out.push('Find out why attempts failed or were abandoned before comparing the completed ones, and report the failure rate with the result.');
  if (c.rows.some((r) => r.assessment === 'overlap')) out.push('Where ranges overlap, either add runs or change exactly one thing; do not read a difference into overlapping ranges.');
  if (c.rows.some((r) => r.assessment === 'separated')) out.push('Where the ranges are separated, repeat the comparison on a fixture or task you have not used yet before trusting the direction.');
  out.push('Write down, before the next runs, what result would change your mind.');
  return out;
}

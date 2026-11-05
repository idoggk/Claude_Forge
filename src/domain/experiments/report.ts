import type { Evidence, Experiment } from './model';
import { CONDITION_KIND_LABELS, EXPERIMENT_TYPE_LABELS, METRICS } from './model';
import type { Comparison } from './compare';
import { compareExperiment } from './compare';

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
  L.push('', '## Evidence sufficiency', '', `**${comparison.sufficiency.headline}**`, '');
  for (const r of comparison.sufficiency.reasons) L.push(`- ${r}`);
  L.push('', '| Condition | Runs recorded | Runs with data |', '|---|---|---|');
  for (const r of comparison.runsPerCondition) L.push(`| ${cell(r.label)} | ${r.recorded} | ${r.withData} |`);
  L.push('', '## Results', '');
  const header = ['Measure', ...exp.conditions.map((c) => c.label), 'Reading'];
  L.push(`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`);
  for (const row of comparison.rows) {
    const fmt = (s: { n: number; unknown: number; mean: number | null; min: number | null; max: number | null }) =>
      s.mean === null ? `unknown${s.unknown ? ` (${s.unknown} missing)` : ''}` : `${row.unit === 'ratio' ? s.mean.toFixed(2) : Number(s.mean.toFixed(1))} [${s.min}–${s.max}] n=${s.n}${s.unknown ? `, ${s.unknown} missing` : ''}`;
    L.push(`| ${cell(row.label)} | ${row.perCondition.map((c) => cell(fmt(c.stat))).join(' | ')} | ${cell(row.text)} |`);
  }
  if (comparison.rubricTotal) {
    L.push('', `Rubric subtotal over criteria recorded for every condition (${comparison.rubricTotal.included.join(', ')}); excluded, not zeroed: ${comparison.rubricTotal.excluded.join(', ') || 'none'}.`, '');
    for (const t of comparison.rubricTotal.totals) L.push(`- ${t.label}: ${t.total.toFixed(2)} / ${t.max}`);
  }
  L.push('', '## Observations (what was recorded)', '', exp.observations || '_none_', '');
  L.push('## Conclusion (interpretation)', '', exp.conclusion || '_none_', '', '## Limitations', '', exp.limitations || '_none stated_', '');
  L.push('## Integrity notes', '');
  if (comparison.integrity.length) comparison.integrity.forEach((n) => L.push(`- ${n}`));
  else L.push('- none raised');
  L.push('', '## Runs', '');
  for (const r of exp.runs) {
    const cond = exp.conditions.find((c) => c.id === r.conditionId);
    const parts: string[] = [];
    for (const m of METRICS) {
      const v = m.id === 'testsPassedRatio' ? (r.testsPassed !== null && r.testsTotal ? `${r.testsPassed}/${r.testsTotal} (${r.testsProvenance})` : null) : r.metrics[m.id]?.value;
      if (v !== null && v !== undefined) parts.push(`${m.label}: ${v}`);
    }
    L.push(`- **${cond?.label ?? '?'} · run ${r.index}** - ${parts.join('; ') || 'no measurements'}${r.observations ? ` - notes: ${r.observations}` : ''}`);
  }
  if (evidence.length) {
    L.push('', '## Attached evidence', '');
    for (const e of evidence) L.push(`- ${e.name} (${e.kind}, ${e.size} bytes, ${e.provenance})`);
  }
  return L.join('\n') + '\n';
}

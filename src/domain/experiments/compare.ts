import type { Condition, CriterionId, Experiment, MetricId, Run } from './model';
import { CRITERION_IDS, METRICS, RUBRIC_CRITERIA } from './model';

/**
 * Comparison rules (honesty first):
 *  - Unknown is unknown. A missing value is NEVER coerced to 0 and never enters an average.
 *  - Every figure carries n (known values) and the count of unknowns.
 *  - We never output a single "winner score". We show per-measure ranges and say plainly when
 *    ranges overlap or when evidence is too thin to conclude.
 *  - All numbers here come from what the user recorded. Nothing is measured by Claude Forge.
 */

export interface Stat {
  n: number;
  unknown: number;
  mean: number | null;
  min: number | null;
  max: number | null;
}

export function stat(values: (number | null)[]): Stat {
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (known.length === 0) return { n: 0, unknown: values.length, mean: null, min: null, max: null };
  const sum = known.reduce((a, b) => a + b, 0);
  return { n: known.length, unknown: values.length - known.length, mean: sum / known.length, min: Math.min(...known), max: Math.max(...known) };
}

export function runMetric(run: Run, id: MetricId, seededTotal: number | null): number | null {
  switch (id) {
    case 'testsPassedRatio':
      if (run.testsPassed !== null && run.testsTotal !== null && run.testsTotal > 0) return Math.min(1, run.testsPassed / run.testsTotal);
      return run.metrics[id]?.value ?? null;
    case 'successRate':
      return run.successMet === null ? null : run.successMet ? 1 : 0;
    case 'seededIssuesFound':
      if (run.seededFound !== null && seededTotal && seededTotal > 0) return run.seededFound.length / seededTotal;
      return run.metrics[id]?.value ?? null;
    default:
      return run.metrics[id]?.value ?? null;
  }
}

export interface ConditionStat {
  conditionId: string;
  label: string;
  runs: number;
  stat: Stat;
}

export interface ComparisonRow {
  id: string;
  label: string;
  kind: 'objective' | 'measured' | 'rubric';
  direction: 'higher' | 'lower';
  unit: string;
  perCondition: ConditionStat[];
  assessment: 'no-data' | 'one-sided' | 'overlap' | 'separated';
  leaderConditionId: string | null;
  text: string;
}

export type SufficiencyLevel = 'none' | 'anecdotal' | 'weak' | 'limited';

export interface Comparison {
  rows: ComparisonRow[];
  rubricTotal: null | { included: CriterionId[]; excluded: CriterionId[]; totals: { conditionId: string; label: string; total: number; max: number }[] };
  sufficiency: { level: SufficiencyLevel; headline: string; reasons: string[] };
  integrity: string[];
  runsPerCondition: { conditionId: string; label: string; recorded: number; withData: number }[];
  /** Headline + detail. */
  summary: string;
  /** The part of the summary after the headline (may be empty). */
  detail: string;
}

const fmt = (n: number | null, unit: string): string => {
  if (n === null) return 'unknown';
  if (unit === 'ratio') return n.toFixed(2);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

function runHasData(run: Run, seededTotal: number | null): boolean {
  if (METRICS.some((m) => runMetric(run, m.id, seededTotal) !== null)) return true;
  return CRITERION_IDS.some((c) => run.rubric[c] !== null && run.rubric[c] !== undefined);
}

function assess(row: Pick<ComparisonRow, 'perCondition' | 'direction' | 'label'>): Pick<ComparisonRow, 'assessment' | 'leaderConditionId' | 'text'> {
  const withData = row.perCondition.filter((c) => c.stat.n > 0);
  if (withData.length === 0) return { assessment: 'no-data', leaderConditionId: null, text: 'No values recorded for any condition.' };
  if (withData.length < row.perCondition.length) {
    const missing = row.perCondition.filter((c) => c.stat.n === 0).map((c) => c.label).join(', ');
    return { assessment: 'one-sided', leaderConditionId: null, text: `Not comparable: no values recorded for ${missing}.` };
  }
  const sorted = [...withData].sort((a, b) => (row.direction === 'higher' ? (b.stat.mean as number) - (a.stat.mean as number) : (a.stat.mean as number) - (b.stat.mean as number)));
  const best = sorted[0]!;
  const others = sorted.slice(1);
  const separated = others.every((o) =>
    row.direction === 'higher' ? (best.stat.min as number) > (o.stat.max as number) : (best.stat.max as number) < (o.stat.min as number),
  );
  if (separated && others.length > 0) {
    return { assessment: 'separated', leaderConditionId: best.conditionId, text: `${best.label} is ${row.direction === 'higher' ? 'higher' : 'lower'} and the recorded ranges do not overlap - directional evidence only.` };
  }
  return { assessment: 'overlap', leaderConditionId: null, text: 'Ranges overlap: the difference could be run-to-run noise.' };
}

export function compareExperiment(exp: Experiment, seededTotal: number | null = null): Comparison {
  const conds: Condition[] = exp.conditions;
  const runsBy = (c: Condition) => exp.runs.filter((r) => r.conditionId === c.id);

  const rows: ComparisonRow[] = [];
  for (const m of METRICS) {
    const perCondition: ConditionStat[] = conds.map((c) => ({ conditionId: c.id, label: c.label, runs: runsBy(c).length, stat: stat(runsBy(c).map((r) => runMetric(r, m.id, seededTotal))) }));
    if (perCondition.every((c) => c.stat.n === 0) && !exp.plannedMeasures.includes(m.id)) continue;
    const a = assess({ perCondition, direction: m.direction, label: m.label });
    rows.push({ id: m.id, label: m.label, kind: m.kind === 'objective' ? 'objective' : 'measured', direction: m.direction, unit: m.unit, perCondition, ...a });
  }
  for (const crit of RUBRIC_CRITERIA) {
    const perCondition: ConditionStat[] = conds.map((c) => ({ conditionId: c.id, label: c.label, runs: runsBy(c).length, stat: stat(runsBy(c).map((r) => r.rubric[crit.id] ?? null)) }));
    if (perCondition.every((c) => c.stat.n === 0)) continue;
    const a = assess({ perCondition, direction: 'higher', label: crit.label });
    rows.push({ id: `rubric:${crit.id}`, label: `${crit.label} (rubric 0-3, self-assessed)`, kind: 'rubric', direction: 'higher', unit: 'level', perCondition, ...a });
  }

  // Rubric subtotal over criteria that EVERY condition has data for. Excluded criteria are listed, never zeroed.
  let rubricTotal: Comparison['rubricTotal'] = null;
  const rubricRows = rows.filter((r) => r.kind === 'rubric');
  if (rubricRows.length > 0 && conds.length >= 2) {
    const included = rubricRows.filter((r) => r.perCondition.every((c) => c.stat.n > 0)).map((r) => r.id.replace('rubric:', '') as CriterionId);
    const excluded = CRITERION_IDS.filter((c) => !included.includes(c));
    if (included.length >= 2) {
      rubricTotal = {
        included,
        excluded,
        totals: conds.map((c) => ({
          conditionId: c.id,
          label: c.label,
          total: included.reduce((acc, crit) => acc + (stat(runsBy(c).map((r) => r.rubric[crit] ?? null)).mean ?? 0), 0),
          max: included.length * 3,
        })),
      };
    }
  }

  const runsPerCondition = conds.map((c) => ({ conditionId: c.id, label: c.label, recorded: runsBy(c).length, withData: runsBy(c).filter((r) => runHasData(r, seededTotal)).length }));
  const minWithData = runsPerCondition.length ? Math.min(...runsPerCondition.map((r) => r.withData)) : 0;

  const reasons: string[] = [];
  let level: SufficiencyLevel;
  let headline: string;
  if (conds.length < 2) {
    level = 'none';
    headline = 'Add at least two conditions to compare.';
  } else if (minWithData === 0) {
    level = 'none';
    const empty = runsPerCondition.filter((r) => r.withData === 0).map((r) => r.label).join(', ');
    headline = `Insufficient evidence: no recorded data for ${empty}.`;
  } else if (minWithData === 1) {
    level = 'anecdotal';
    headline = 'Anecdotal: one run per condition is a single observation, not a comparison.';
    reasons.push('A single successful run cannot show that a Skill is better; LLM outputs vary from run to run.');
  } else if (minWithData === 2) {
    level = 'weak';
    headline = 'Weak: two runs per condition shows variability exists but cannot characterize it.';
  } else {
    level = 'limited';
    headline = 'Limited: three or more runs per condition support a directional reading at most.';
    reasons.push('Even with several runs, one fixture and self-reported measurements do not generalize to other tasks.');
  }

  const integrity: string[] = [];
  const hasBaseline = conds.some((c) => c.kind === 'no-skill');
  if (conds.length >= 2 && !hasBaseline) integrity.push('No "without a Skill" baseline: you cannot attribute differences to the Skill itself.');
  for (const c of conds) if (c.kind !== 'no-skill' && !c.difference.trim()) integrity.push(`Condition ${c.label} does not state what differs from the baseline. Experiments need exactly one explicit difference.`);
  const counts = runsPerCondition.map((r) => r.recorded);
  if (counts.length >= 2 && new Set(counts).size > 1) integrity.push(`Unequal number of runs across conditions (${runsPerCondition.map((r) => `${r.label}: ${r.recorded}`).join(', ')}).`);
  if (exp.runs.length > 0 && exp.runs.length < exp.plannedRuns * Math.max(conds.length, 1)) integrity.push(`Planned ${exp.plannedRuns} run(s) per condition but recorded ${exp.runs.length} in total.`);
  if (!exp.hypothesis.trim()) integrity.push('No hypothesis was written down before the runs; observations and conclusions are easier to bend without one.');
  if (exp.successCriteria.length === 0) integrity.push('No success criteria were defined in advance.');
  if (!exp.fixture.hash && exp.fixture.id !== 'custom') integrity.push('Fixture hash not recorded; you cannot show every condition used identical files.');
  if (!exp.rubricLockedAt && exp.runs.length > 0) integrity.push('The rubric was not locked before recording; changing criteria after seeing results invalidates the comparison.');
  if (exp.status === 'concluded' && !exp.limitations.trim()) integrity.push('Concluded without stating limitations.');
  const selfRep = exp.runs.filter((r) => r.testsProvenance === 'self-reported' && r.testsTotal !== null).length;
  if (selfRep > 0) integrity.push(`${selfRep} run(s) have test counts that are self-reported (not imported from a report file). Forge does not verify them.`);
  const totalCells = exp.runs.length * Math.max(exp.plannedMeasures.length, 1);
  if (totalCells > 0 && exp.plannedMeasures.length > 0) {
    const unknown = exp.runs.reduce((acc, r) => acc + exp.plannedMeasures.filter((m) => runMetric(r, m as MetricId, seededTotal) === null).length, 0);
    if (unknown > 0) integrity.push(`${unknown} of ${totalCells} planned measurements are missing (shown as "unknown", never as 0).`);
  }

  const sep = rows.filter((r) => r.assessment === 'separated');
  const overlap = rows.filter((r) => r.assessment === 'overlap');
  const bits: string[] = [];
  for (const r of sep.slice(0, 3)) {
    const lead = r.perCondition.find((c) => c.conditionId === r.leaderConditionId);
    if (lead) bits.push(`on ${r.label.replace(/ \(rubric.*$/, '')}, ${lead.label} led (mean ${fmt(lead.stat.mean, r.unit)}, n=${lead.stat.n}) with non-overlapping ranges`);
  }
  let detail: string;
  if (level === 'none') detail = '';
  else if (bits.length === 0) detail = overlap.length ? 'Ranges overlap on every comparable measure.' : 'No measure has data for every condition yet.';
  else detail = `In the recorded runs: ${bits.join('; ')}. This is observation, not proof of a general effect.`;
  const summary = detail ? `${headline} ${detail}` : headline;

  return { rows, rubricTotal, sufficiency: { level, headline, reasons }, integrity, runsPerCondition, summary, detail };
}

import { describe, expect, it } from 'vitest';
import { compareExperiment, stat, runMetric } from '@/domain/experiments/compare';
import { DEMO_EXPERIMENT } from '@/domain/experiments/demo';
import { ExperimentSchema, type Experiment, type Run } from '@/domain/experiments/model';
import { buildExperimentReport, exportExperimentJson } from '@/domain/experiments/report';
import { parseTestReport } from '@/domain/experiments/testReport';

const t = '2026-01-01T00:00:00.000Z';
function run(conditionId: string, index: number, over: Partial<Run> = {}): Run {
  return { id: `${conditionId}${index}`, conditionId, index, recordedAt: t, testsPassed: null, testsTotal: null, testsProvenance: 'self-reported', successMet: null, seededFound: null, caseId: null, verdict: null, gradedTruth: null, skillActivated: null, metrics: {}, rubric: {}, observations: '', ...over };
}
function exp(runs: Run[], over: Partial<Experiment> = {}): Experiment {
  return ExperimentSchema.parse({
    id: 'e1', title: 'T', hypothesis: 'h', problem: 'p', prompt: 'x',
    fixture: { id: 'merge-cascade', label: 'f', version: '1', hash: 'abc' },
    successCriteria: ['c'], plannedMeasures: ['testsPassedRatio', 'runtimeSec'], plannedRuns: 2, rubricLockedAt: t,
    conditions: [
      { id: 'a', label: 'A', kind: 'no-skill', difference: '' },
      { id: 'b', label: 'B', kind: 'skill', skillName: 's', difference: 'adds skill s' },
    ],
    runs, createdAt: t, updatedAt: t, ...over,
  });
}

describe('stat', () => {
  it('never treats unknown as zero', () => {
    const s = stat([4, null, 6]);
    expect(s).toEqual({ n: 2, unknown: 1, mean: 5, min: 4, max: 6 });
    expect(stat([null, null])).toEqual({ n: 0, unknown: 2, mean: null, min: null, max: null });
  });
});

describe('compareExperiment', () => {
  it('computes correct means and ranges from recorded evidence', () => {
    const e = exp([
      run('a', 1, { testsPassed: 6, testsTotal: 10 }), run('a', 2, { testsPassed: 7, testsTotal: 10 }),
      run('b', 1, { testsPassed: 9, testsTotal: 10 }), run('b', 2, { testsPassed: 10, testsTotal: 10 }),
    ]);
    const c = compareExperiment(e);
    const row = c.rows.find((r) => r.id === 'testsPassedRatio')!;
    const a = row.perCondition.find((x) => x.conditionId === 'a')!.stat;
    const b = row.perCondition.find((x) => x.conditionId === 'b')!.stat;
    expect(a.mean).toBeCloseTo(0.65, 5);
    expect(b.mean).toBeCloseTo(0.95, 5);
    expect(row.assessment).toBe('separated');
    expect(row.leaderConditionId).toBe('b');
    expect(c.sufficiency.level).toBe('weak');
  });

  it('keeps missing metrics unknown and says so instead of inventing numbers', () => {
    const e = exp([
      run('a', 1, { testsPassed: 5, testsTotal: 10, metrics: { runtimeSec: { value: 100, provenance: 'self-reported' } } }),
      run('a', 2, { testsPassed: 6, testsTotal: 10 }),
      run('b', 1, { testsPassed: 9, testsTotal: 10 }),
      run('b', 2, { testsPassed: 9, testsTotal: 10 }),
    ]);
    const c = compareExperiment(e);
    const rt = c.rows.find((r) => r.id === 'runtimeSec')!;
    expect(rt.perCondition.find((x) => x.conditionId === 'a')!.stat).toMatchObject({ n: 1, unknown: 1, mean: 100 });
    expect(rt.perCondition.find((x) => x.conditionId === 'b')!.stat).toMatchObject({ n: 0, unknown: 2, mean: null });
    expect(rt.assessment).toBe('one-sided');
    expect(rt.text).toMatch(/Not comparable/);
    expect(c.integrity.join(' ')).toMatch(/missing/);
  });

  it('keeps the headline separate from the detail so UIs do not repeat it', () => {
    const e = exp([run('a', 1, { testsPassed: 5, testsTotal: 10 }), run('a', 2, { testsPassed: 6, testsTotal: 10 }), run('b', 1, { testsPassed: 9, testsTotal: 10 }), run('b', 2, { testsPassed: 10, testsTotal: 10 })]);
    const c = compareExperiment(e);
    expect(c.summary).toBe(`${c.sufficiency.headline} ${c.detail}`);
    expect(c.detail).not.toContain(c.sufficiency.headline);
    expect(compareExperiment(exp([])).detail).toBe('');
  });

  it('a single run per condition is anecdotal, never a verdict', () => {
    const e = exp([run('a', 1, { testsPassed: 3, testsTotal: 10 }), run('b', 1, { testsPassed: 10, testsTotal: 10 })]);
    const c = compareExperiment(e);
    expect(c.sufficiency.level).toBe('anecdotal');
    expect(c.sufficiency.headline).toMatch(/Anecdotal/);
    expect(c.summary).not.toMatch(/better than|superior|wins/i);
  });

  it('no data for a condition means insufficient evidence', () => {
    const e = exp([run('a', 1, { testsPassed: 3, testsTotal: 10 })]);
    expect(compareExperiment(e).sufficiency.level).toBe('none');
  });

  it('overlapping ranges are called out as possible noise', () => {
    const e = exp([
      run('a', 1, { testsPassed: 5, testsTotal: 10 }), run('a', 2, { testsPassed: 9, testsTotal: 10 }),
      run('b', 1, { testsPassed: 6, testsTotal: 10 }), run('b', 2, { testsPassed: 10, testsTotal: 10 }),
    ]);
    const row = compareExperiment(e).rows.find((r) => r.id === 'testsPassedRatio')!;
    expect(row.assessment).toBe('overlap');
    expect(row.text).toMatch(/noise/);
  });

  it('respects direction: lower runtime is better', () => {
    const e = exp([
      run('a', 1, { metrics: { runtimeSec: { value: 200, provenance: 'self-reported' } } }), run('a', 2, { metrics: { runtimeSec: { value: 210, provenance: 'self-reported' } } }),
      run('b', 1, { metrics: { runtimeSec: { value: 100, provenance: 'self-reported' } } }), run('b', 2, { metrics: { runtimeSec: { value: 120, provenance: 'self-reported' } } }),
    ]);
    const row = compareExperiment(e).rows.find((r) => r.id === 'runtimeSec')!;
    expect(row.leaderConditionId).toBe('b');
  });

  it('rubric subtotal only includes criteria recorded for every condition and lists the excluded ones', () => {
    const e = exp([
      run('a', 1, { rubric: { correctness: 1, completeness: 2, maintainability: null, testEvidence: null } }),
      run('b', 1, { rubric: { correctness: 3, completeness: 3, maintainability: 2, testEvidence: null } }),
    ]);
    const rt = compareExperiment(e).rubricTotal!;
    expect(rt.included.sort()).toEqual(['completeness', 'correctness']);
    expect(rt.excluded.sort()).toEqual(['maintainability', 'testEvidence']);
    expect(rt.totals.find((x) => x.conditionId === 'a')!.total).toBe(3);
    expect(rt.totals.find((x) => x.conditionId === 'b')!.total).toBe(6);
  });

  it('flags missing baseline, undeclared differences and unlocked rubric', () => {
    const e = exp([run('a', 1, { testsPassed: 1, testsTotal: 2 }), run('b', 1, { testsPassed: 2, testsTotal: 2 })], {
      conditions: [
        { id: 'a', label: 'A', kind: 'skill', skillName: 's1', skillVersion: '', difference: '' },
        { id: 'b', label: 'B', kind: 'alternative', skillName: 's2', skillVersion: '', difference: '' },
      ],
      rubricLockedAt: null,
    });
    const notes = compareExperiment(e).integrity.join('\n');
    expect(notes).toMatch(/baseline/);
    expect(notes).toMatch(/does not state what differs/);
    expect(notes).toMatch(/rubric was not locked/);
  });

  it('derives seeded-issue ratios from ticked checklist items', () => {
    const r = run('a', 1, { seededFound: ['x', 'y'] });
    expect(runMetric(r, 'seededIssuesFound', 4)).toBe(0.5);
    expect(runMetric(r, 'seededIssuesFound', null)).toBeNull();
  });
});

describe('demo experiment', () => {
  it('is labelled synthetic everywhere and has unknowns left unknown', () => {
    expect(DEMO_EXPERIMENT.synthetic).toBe(true);
    expect(DEMO_EXPERIMENT.title).toMatch(/synthetic/i);
    const c = compareExperiment(DEMO_EXPERIMENT);
    const rt = c.rows.find((r) => r.id === 'runtimeSec')!;
    expect(rt.perCondition.find((x) => x.conditionId === 'demo-a')!.stat).toMatchObject({ n: 2, unknown: 1 });
    expect(c.sufficiency.level).toBe('limited');
    const md = buildExperimentReport(DEMO_EXPERIMENT, [], c);
    expect(md).toMatch(/SYNTHETIC DEMONSTRATION/);
    expect(md).toMatch(/No Claude execution occurred/);
  });
});

describe('export', () => {
  it('exports a versioned JSON record that re-validates against the schema', () => {
    const json = JSON.parse(exportExperimentJson(DEMO_EXPERIMENT, []));
    expect(json.format).toBe('claude-forge-experiment');
    expect(json.version).toBe(1);
    expect(ExperimentSchema.safeParse(json.experiment).success).toBe(true);
    expect(json.notice).toMatch(/self-reported/);
  });
});

describe('test report import', () => {
  it('reads vitest JSON counts as data', () => {
    const r = parseTestReport(JSON.stringify({ numPassedTests: 7, numFailedTests: 3, numTotalTests: 10 }));
    expect(r).toEqual({ ok: true, counts: { passed: 7, failed: 3, total: 10, format: 'vitest/jest JSON' } });
  });
  it('reads a generic report and rejects nonsense', () => {
    expect(parseTestReport('{"passed":2,"failed":1}')).toMatchObject({ ok: true, counts: { total: 3 } });
    expect(parseTestReport('not json')).toMatchObject({ ok: false });
    expect(parseTestReport('{"passed":-1,"failed":0}')).toMatchObject({ ok: false });
    expect(parseTestReport('{"passed":9,"failed":9,"total":10}')).toMatchObject({ ok: false });
    expect(parseTestReport('{"a":1}')).toMatchObject({ ok: false });
    expect(parseTestReport('x'.repeat(600 * 1024))).toMatchObject({ ok: false });
  });
});

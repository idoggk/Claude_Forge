import { describe, expect, it } from 'vitest';
import { SOURCE_REGISTRY } from '@/content/sources/registry';
import { CATALOG } from '@/content/catalog/entries';
import { LAB_TEMPLATES } from '@/content/lab/templates';
import { CRITERION_IDS, ExperimentSchema, METRIC_IDS, isBaselineKind, type ConditionKind } from '@/domain/experiments/model';
import { compareExperiment } from '@/domain/experiments/compare';
import { buildExperimentReport } from '@/domain/experiments/report';
import { evaluateRepeatedRuns } from '@/domain/assessment/external';
import { CAPABILITIES } from '@/content/capability/map';
import { gradeItem } from '@/domain/assessment/grade';
import { LESSONS } from '@/content/lessons';

const now = '2026-11-05T00:00:00.000Z';

describe('source registry (living-discovery data)', () => {
  it('lists every catalog source URL, and unreachable hosts are marked as such and never used by an entry', () => {
    const urls = new Set(SOURCE_REGISTRY.map((s) => s.url));
    for (const e of CATALOG) if (e.sourceUrl) expect(urls.has(e.sourceUrl), `${e.id} source is not in the registry`).toBe(true);
    const unreachable = SOURCE_REGISTRY.filter((s) => s.status === 'unreachable');
    expect(unreachable.length).toBeGreaterThanOrEqual(3);
    for (const s of unreachable) {
      expect(s.usedBy, s.id).toEqual([]);
      expect(s.note, s.id).toMatch(/No claim|nothing from it|Gemini|repository page was read instead|DNS/i);
      for (const e of CATALOG) expect(e.sourceUrl, `${e.id} uses unreachable ${s.url}`).not.toBe(s.url);
    }
  });
  it('each "read" source is used by a real catalog entry whose source matches', () => {
    for (const s of SOURCE_REGISTRY.filter((x) => x.status === 'read')) {
      expect(s.usedBy.length, s.id).toBeGreaterThan(0);
      for (const id of s.usedBy) expect(CATALOG.find((e) => e.id === id)?.sourceUrl, `${s.id} -> ${id}`).toBe(s.url);
    }
  });
});

describe('AI Lab templates', () => {
  it('describe a fair comparison, use valid measures, and contain no results', () => {
    for (const t of LAB_TEMPLATES) {
      expect(t.conditions.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.conditions.some((c) => isBaselineKind(c.kind)), `${t.id} has a baseline`).toBe(true);
      for (const c of t.conditions) if (!isBaselineKind(c.kind)) expect(c.difference.length, `${t.id}/${c.label} states its one difference`).toBeGreaterThan(10);
      for (const m of t.plannedMeasures) expect(METRIC_IDS, `${t.id} measure`).toContain(m);
      expect(t.plannedRuns, t.id).toBeGreaterThanOrEqual(3);
      expect(JSON.stringify(t)).not.toMatch(/"runs"|testsPassed\b|\d+ ?% better/);
    }
    expect(new Set(LAB_TEMPLATES.map((t) => t.experimentType)).size).toBeGreaterThanOrEqual(4);
  });
  it('every template id referenced by the capability map exists', () => {
    const ids = new Set(LAB_TEMPLATES.map((t) => t.id));
    for (const c of CAPABILITIES) for (const t of c.labTemplates) expect(ids.has(t), `${c.id} -> ${t}`).toBe(true);
  });
});

describe('non-Skill experiments (generalised AI Lab)', () => {
  type R = { id: string; conditionId: string; index: number; recordedAt: string; metrics: Record<string, unknown> };
  const mk = (kinds: [ConditionKind, ConditionKind], runs: R[] = []) => ExperimentSchema.parse({
    id: 'e1', title: 'Prompt A vs B', experimentType: 'prompt', subject: 'Does revised wording help?', hypothesis: 'Explicit acceptance criteria raise the checklist items met.',
    fixture: { id: 'custom', label: 'my task', version: '', hash: null }, plannedMeasures: ['reworkRounds', 'developerEffortMin'], plannedRuns: 3, rubricLockedAt: now,
    conditions: [{ id: 'c1', label: 'A', kind: kinds[0], difference: '' }, { id: 'c2', label: 'B', kind: kinds[1], difference: 'Only the wording changes.' }],
    runs, limitations: 'One task, one model, self-timed effort.', createdAt: now, updatedAt: now,
  });
  const run = (cond: string, i: number, rework: number | null): R => ({ id: `${cond}-${i}`, conditionId: cond, index: i, recordedAt: now, metrics: rework === null ? {} : { reworkRounds: { value: rework, provenance: 'self-reported' as const } } });

  it('accepts prompt/workflow/agent/tool/model conditions and treats a plain baseline as the baseline', () => {
    const e = mk(['baseline', 'prompt']);
    expect(e.experimentType).toBe('prompt');
    expect(isBaselineKind(e.conditions[0]!.kind)).toBe(true);
    const c = compareExperiment(e);
    expect(c.integrity.join(' ')).not.toMatch(/No "without a Skill" baseline/);
  });

  it('unknown stays unknown and overlapping ranges are not called a win', () => {
    const e = mk(['baseline', 'prompt'], [run('c1', 1, 2), run('c1', 2, 4), run('c1', 3, null), run('c2', 1, 1), run('c2', 2, 3), run('c2', 3, null)]);
    const c = compareExperiment(e);
    const row = c.rows.find((r) => r.id === 'reworkRounds')!;
    expect(row.assessment).toBe('overlap');
    expect(row.perCondition.every((p) => p.stat.unknown === 1 && p.stat.n === 2)).toBe(true);
    expect(c.integrity.join(' ')).toMatch(/missing/);
    const md = buildExperimentReport(e, [], c);
    expect(md).toMatch(/Compares: Prompts or specifications - Does revised wording help\?/);
    expect(md).toMatch(/Name \| Version/);
    expect(md).not.toMatch(/\bwinner\b/i);
  });

  it('the Lesson 16 check needs repeated runs, a baseline, known measurements and written limits', () => {
    const item = LESSONS.find((l) => l.id === 'L16-ai-evaluation')!.assessment.items.find((i) => i.kind === 'external')!;
    expect(evaluateRepeatedRuns([mk(['baseline', 'prompt'])]).ok).toBe(false);
    const good = mk(['baseline', 'prompt'], [run('c1', 1, 2), run('c1', 2, 3), run('c2', 1, 1), run('c2', 2, 2)]);
    expect(evaluateRepeatedRuns([good]).ok).toBe(true);
    expect(evaluateRepeatedRuns([{ ...good, limitations: '' }]).ok).toBe(false);
    const unknowns = mk(['baseline', 'prompt'], [run('c1', 1, 2), run('c1', 2, null), run('c2', 1, 1), run('c2', 2, null)]);
    expect(evaluateRepeatedRuns([unknowns]).ok, 'unknown values are not measurements').toBe(false);
    expect(gradeItem(item, undefined, {} as never).correct).toBe(false);
    void CRITERION_IDS;
  });
});

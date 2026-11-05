import { describe, expect, it } from 'vitest';
import { gradeAttempt, gradeItem, parseNumber, seededOrder } from '@/domain/assessment/grade';
import { calibrationVerdict, predictedPctFor, summarizeCalibration } from '@/domain/assessment/calibration';
import type { Item } from '@/domain/curriculum/types';
import type { Attempt } from '@/persistence/schemas';

const single: Item = { id: 's', kind: 'single', concept: 'mechanism-selection', prompt: 'p', explanation: 'e', options: [{ id: 'a', text: 'A', why: 'wa wa wa' }, { id: 'b', text: 'B', why: 'wb wb wb' }, { id: 'c', text: 'C', why: 'wc wc wc' }], correct: 'b' };
const multi: Item = { id: 'm', kind: 'multi', concept: 'mechanism-selection', prompt: 'p', explanation: 'e', options: [{ id: 'a', text: 'A', why: 'x' }, { id: 'b', text: 'B', why: 'x' }, { id: 'c', text: 'C', why: 'x' }, { id: 'd', text: 'D', why: 'x' }], correct: ['a', 'c'] };
const classify: Item = { id: 'c', kind: 'classify', concept: 'mechanism-selection', prompt: 'p', explanation: 'e', categories: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }], entries: [{ id: '1', text: 'one', correct: 'x', why: 'w' }, { id: '2', text: 'two', correct: 'y', why: 'w' }, { id: '3', text: 'three', correct: 'x', why: 'w' }, { id: '4', text: 'four', correct: 'y', why: 'w' }] };
const order: Item = { id: 'o', kind: 'order', concept: 'mechanism-selection', prompt: 'p', explanation: 'e', steps: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }, { id: 'c', text: 'c' }, { id: 'd', text: 'd' }] };
const numeric: Item = { id: 'n', kind: 'numeric', concept: 'economy-analysis', prompt: 'p', explanation: 'e', answer: 10, tolerance: 0.5, diagnose: (v) => (v === 5 ? 'half' : null) };
const keywords: Item = { id: 'k', kind: 'keywords', concept: 'mechanism-selection', prompt: 'p', explanation: 'e', groups: [{ label: 'g1', anyOf: ['every time', 'always'] }, { label: 'g2', anyOf: ['skip', 'judgment'] }] };
const flag: Item = { id: 'f', kind: 'flaglines', concept: 'skill-security', critical: true, prompt: 'p', explanation: 'e', filename: 'x', lines: ['a', 'b', 'c', 'd', 'e'], targets: [{ line: 2, severity: 'critical', why: 'w' }, { line: 4, severity: 'minor', why: 'w' }] };
const reflect: Item = { id: 'r', kind: 'reflect', concept: 'production-skills', prompt: 'p', explanation: 'e', rubric: ['one', 'two'] };

describe('gradeItem', () => {
  it('single choice', () => {
    expect(gradeItem(single, 'b')).toMatchObject({ correct: true, score: 1, answered: true });
    expect(gradeItem(single, 'a')).toMatchObject({ correct: false, score: 0, answered: true });
    expect(gradeItem(single, undefined)).toMatchObject({ correct: false, answered: false });
    expect(gradeItem(single, 42)).toMatchObject({ correct: false });
  });

  it('explains every option after grading', () => {
    const g = gradeItem(single, 'a');
    expect(g.details).toHaveLength(3);
    expect(g.details.find((d) => d.ok)?.note).toBe('wb wb wb');
    expect(g.details[0]!.label).toContain('▶');
  });

  it('multiple selection: exact match is correct, partial credit never goes negative', () => {
    expect(gradeItem(multi, ['c', 'a'])).toMatchObject({ correct: true, score: 1 });
    expect(gradeItem(multi, ['a'])).toMatchObject({ correct: false, score: 0.5 });
    expect(gradeItem(multi, ['a', 'b'])).toMatchObject({ correct: false, score: 0 });
    expect(gradeItem(multi, ['b', 'd'])).toMatchObject({ score: 0 });
    expect(gradeItem(multi, [])).toMatchObject({ correct: false, answered: false });
    expect(gradeItem(multi, ['a', 'c', 'b'])).toMatchObject({ correct: false });
  });

  it('classification gives partial credit per entry', () => {
    expect(gradeItem(classify, { 1: 'x', 2: 'y', 3: 'x', 4: 'y' })).toMatchObject({ correct: true, score: 1 });
    const g = gradeItem(classify, { 1: 'x', 2: 'x', 3: 'x' });
    expect(g.correct).toBe(false);
    expect(g.score).toBe(0.5);
    expect(g.details.filter((d) => d.ok)).toHaveLength(2);
    expect(gradeItem(classify, {})).toMatchObject({ answered: false, score: 0 });
  });

  it('ordering gives credit by pairwise order', () => {
    expect(gradeItem(order, ['a', 'b', 'c', 'd'])).toMatchObject({ correct: true, score: 1 });
    const swapped = gradeItem(order, ['b', 'a', 'c', 'd']);
    expect(swapped.correct).toBe(false);
    expect(swapped.score).toBeCloseTo(5 / 6, 3);
    expect(gradeItem(order, ['d', 'c', 'b', 'a']).score).toBe(0);
    expect(gradeItem(order, ['a', 'b'])).toMatchObject({ answered: false, correct: false });
    expect(gradeItem(order, ['a', 'a', 'b', 'c'])).toMatchObject({ answered: false });
  });

  it('numeric answers honour tolerance, parse formatting and give targeted diagnosis', () => {
    expect(gradeItem(numeric, '10.4').correct).toBe(true);
    expect(gradeItem(numeric, '1,0')).toMatchObject({ correct: false, answered: false }); // ambiguous decimal comma is rejected, not read as 10
    expect(parseNumber('1,5')).toBeNull();
    expect(parseNumber('12,345')).toBe(12345);
    expect(gradeItem(numeric, 10.6).correct).toBe(false);
    expect(gradeItem(numeric, 'ten').answered).toBe(false);
    expect(gradeItem(numeric, 5).details.map((d) => d.note).join(' ')).toContain('half');
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('50%')).toBe(50);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('1e3')).toBeNull();
    expect(parseNumber(NaN)).toBeNull();
  });

  it('keyword answers are deterministic and say what they checked', () => {
    expect(gradeItem(keywords, 'It runs EVERY TIME, but a Skill can skip')).toMatchObject({ correct: true });
    const partial = gradeItem(keywords, 'it always runs');
    expect(partial.correct).toBe(false);
    expect(partial.score).toBe(0.5);
    expect(partial.feedback).toMatch(/deterministic, narrow/);
    expect(gradeItem(keywords, '   ').answered).toBe(false);
  });

  it('flag-lines weights severity, penalises false positives, and ignores out-of-range input', () => {
    expect(gradeItem(flag, [2, 4])).toMatchObject({ correct: true, score: 1 });
    expect(gradeItem(flag, [2])).toMatchObject({ correct: true });
    expect(gradeItem(flag, [4])).toMatchObject({ correct: false });
    const fp = gradeItem(flag, [2, 4, 1, 3, 5]);
    expect(fp.correct).toBe(false);
    expect(fp.score).toBeCloseTo(1 * (1 - 0.12 * 3), 3);
    expect(gradeItem(flag, [99, -1, 2.5, 'x'])).toMatchObject({ answered: false, correct: false });
  });

  it('reflection is self-assessed and flagged as such', () => {
    const g = gradeItem(reflect, { 0: true });
    expect(g.selfAssessed).toBe(true);
    expect(g.feedback).toMatch(/Self-assessed/);
  });

  it('external items use verified results, not the learner\'s claim', () => {
    const ext: Item = { id: 'e', kind: 'external', concept: 'skill-authoring', check: 'workshop-first-skill', prompt: 'p', explanation: 'e' };
    expect(gradeItem(ext, true).correct).toBe(false);
    const ok = gradeItem(ext, undefined, { 'workshop-first-skill': { ok: true, progress: 1, checks: [{ label: 'x', ok: true, note: '' }] } });
    expect(ok.correct).toBe(true);
    const half = gradeItem(ext, undefined, { 'workshop-first-skill': { ok: false, progress: 0.5, checks: [] } });
    expect(half).toMatchObject({ correct: false, score: 0.5 });
  });
});

describe('gradeAttempt', () => {
  const items: Item[] = [single, { ...multi, critical: true }, classify, reflect];
  const perfect = { s: 'b', m: ['a', 'c'], c: { 1: 'x', 2: 'y', 3: 'x', 4: 'y' }, r: { 0: true, 1: true } };

  it('scores weighted points and excludes self-assessed items from the score', () => {
    const g = gradeAttempt(items, perfect, { passMark: 0.75 });
    expect(g.score).toBe(1);
    expect(g.passed).toBe(true);
    expect(g.selfAssessedCount).toBe(1);
    const noReflect = gradeAttempt(items, { ...perfect, r: undefined }, { passMark: 0.75 });
    expect(noReflect.score).toBe(1);
  });

  it('a missed critical item fails the attempt even when the score is high - safety checks are not compensated', () => {
    const g = gradeAttempt(items, { ...perfect, m: ['a'] }, { passMark: 0.5 });
    expect(g.score).toBeGreaterThan(0.8);
    expect(g.criticalFailed).toEqual(['m']);
    expect(g.passed).toBe(false);
    expect(g.conceptResults['mechanism-selection']!.criticalFailed).toBe(true);
  });

  it('computes per-concept results', () => {
    const g = gradeAttempt([single, numeric], { s: 'b', n: 1 }, { passMark: 0.5 });
    expect(g.conceptResults['mechanism-selection']).toMatchObject({ score: 1, items: 1, criticalFailed: false });
    expect(g.conceptResults['economy-analysis']).toMatchObject({ score: 0, items: 1 });
    expect(g.score).toBe(0.5);
  });

  it('respects item points', () => {
    const heavy: Item = { ...single, id: 'h', points: 3 };
    const g = gradeAttempt([heavy, numeric], { h: 'b', n: 0 }, { passMark: 0.5 });
    expect(g.score).toBe(0.75);
  });

  it('unanswered items are counted and an empty submission scores zero', () => {
    const g = gradeAttempt(items, {}, { passMark: 0.5 });
    expect(g.score).toBe(0);
    expect(g.unanswered).toBe(3);
    expect(g.passed).toBe(false);
  });
});

describe('seededOrder', () => {
  it('is deterministic, never returns the solved order, and keeps all items', () => {
    const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
    const one = seededOrder(steps, 'x');
    expect(seededOrder(steps, 'x')).toEqual(one);
    expect(one.map((s) => s.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) expect(seededOrder(steps, seed).map((s) => s.id)).not.toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('confidence calibration', () => {
  it('maps confidence to a predicted percentage and classifies the gap', () => {
    expect(predictedPctFor(5)).toBe(95);
    expect(predictedPctFor(1)).toBe(20);
    expect(calibrationVerdict(95, 40)).toEqual({ gap: 55, verdict: 'overconfident' });
    expect(calibrationVerdict(20, 90)).toEqual({ gap: -70, verdict: 'underconfident' });
    expect(calibrationVerdict(60, 70).verdict).toBe('calibrated');
    expect(calibrationVerdict(80, 55).verdict).toBe('overconfident');
    expect(calibrationVerdict(60, 35).verdict).toBe('overconfident');
    expect(calibrationVerdict(60, 36).verdict).toBe('calibrated');
  });

  it('summarizes history without counting practice attempts or attempts with no prediction', () => {
    const mk = (over: Partial<Attempt>): Attempt => ({ id: 'x', lessonId: 'l', lessonVersion: 1, stage: 'assessment', startedAt: '', submittedAt: '', attemptNumber: 1, answers: {}, results: [], score: 0.5, passed: false, criticalFailed: [], hintsUsed: 0, confidence: 4, predictedPct: 80, independent: true, unseen: true, conceptResults: {}, ...over });
    const s = summarizeCalibration([mk({}), mk({ score: 0.8, confidence: 4, predictedPct: 80 }), mk({ stage: 'practice' }), mk({ predictedPct: null, confidence: null })]);
    expect(s.count).toBe(2);
    expect(s.overconfident).toBe(1);
    expect(s.calibrated).toBe(1);
    expect(s.meanGap).toBe(15);
    expect(s.byConfidence).toEqual([{ confidence: 4, attempts: 2, meanActualPct: 65 }]);
  });
});

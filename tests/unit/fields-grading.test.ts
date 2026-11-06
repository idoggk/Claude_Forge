import { describe, expect, it } from 'vitest';
import { gradeItem } from '@/domain/assessment/grade';
import type { FieldsItem } from '@/domain/curriculum/types';

const item: FieldsItem = {
  id: 'f1', kind: 'fields', concept: 'workflow-design', prompt: 'Improve it.', explanation: 'A gate, a limit and an approval.', brief: 'A fragile workflow.',
  fields: [
    { id: 'gate', label: 'Gate', help: 'A check that can fail.', groups: [{ label: 'checkable', anyOf: ['count', 'schema'] }, { label: 'not the author', anyOf: ['script', 'independent'] }] },
    { id: 'limit', label: 'Limit', help: 'Bound retries.', groups: [{ label: 'a limit', anyOf: ['once', 'twice'] }, { label: 'then stop', anyOf: ['stop', 'escalate'] }] },
  ],
};

describe('fields item grading', () => {
  it('is correct only when every field contains every required idea', () => {
    const g = gradeItem(item, { gate: 'A script checks the count of reports', limit: 'Retry once, then stop and ask a person' });
    expect(g.correct).toBe(true);
    expect(g.score).toBe(1);
  });
  it('gives partial credit per idea but never marks a partly-correct answer correct', () => {
    const g = gradeItem(item, { gate: 'A script checks it', limit: 'Retry once, then stop' });
    expect(g.correct).toBe(false);
    expect(g.score).toBeGreaterThan(0);
    expect(g.score).toBeLessThan(1);
    expect(g.details!.find((d) => d.label === 'Gate')!.note).toMatch(/Not found/);
  });
  it('blank is never correct and is reported as unanswered; wrong types are tolerated', () => {
    expect(gradeItem(item, undefined)).toMatchObject({ correct: false, answered: false, score: 0 });
    expect(gradeItem(item, {})).toMatchObject({ correct: false, answered: false });
    expect(gradeItem(item, { gate: 42, limit: null })).toMatchObject({ correct: false, answered: false });
    expect(gradeItem(item, 'just text')).toMatchObject({ correct: false });
  });
  it('is case-insensitive, and pasting every keyword with no sense still shows the check is narrow by design', () => {
    expect(gradeItem(item, { gate: 'SCRIPT checks COUNT', limit: 'ONCE then STOP' }).correct).toBe(true);
    expect(gradeItem(item, { gate: 'x', limit: 'y' }).feedback).toMatch(/narrow|deterministic/i);
  });
});

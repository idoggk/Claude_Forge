import { describe, expect, it } from 'vitest';
import { BUDGET, contextEngine, readAll, toSetup, tokenCount } from '@/domain/challenges/context';

const GOOD = ['c-annual-new', 'c-monthly', 'c-process', 'say-unknown', 'order:newest-first'];

describe('Challenge D: prompt and context optimisation', () => {
  it('a minimal, current, consistent context with permission to say unknown passes within budget', () => {
    const r = contextEngine.run(GOOD);
    expect(r.passed).toBe(true);
    expect(tokenCount(toSetup(GOOD))).toBeLessThanOrEqual(BUDGET);
  });
  it('including everything fails: over budget and the conflicting and untrusted chunks mislead', () => {
    const all = ['c-annual-new', 'c-annual-old', 'c-monthly', 'c-process', 'c-inject', 'c-shipping', 'c-brand', 'c-history', 'say-unknown', 'data-not-orders', 'order:newest-first'];
    const r = contextEngine.run(all);
    expect(r.passed).toBe(false);
    expect(r.rows.some((x) => x.label === 'Over budget')).toBe(true);
  });
  it('without permission to say unknown the unanswerable question is guessed wrong', () => {
    const a = readAll(toSetup(['c-annual-new', 'c-monthly', 'c-process']));
    expect(a.find((x) => x.q.id === 'q4')!.correct).toBe(false);
  });
  it('the pasted note is obeyed unless context is treated as data', () => {
    const naive = readAll(toSetup(['c-annual-new', 'c-inject', 'order:newest-first']));
    expect(naive.find((x) => x.q.id === 'q1')!.given).toBe('90 days');
    const safe = readAll(toSetup(['c-annual-new', 'c-inject', 'order:newest-first', 'data-not-orders']));
    expect(safe.find((x) => x.q.id === 'q1')!.given).toBe('30 days');
  });
  it('a superseded chunk placed first gives the old answer', () => {
    const a = readAll(toSetup(['c-annual-new', 'c-annual-old', 'order:oldest-first']));
    expect(a.find((x) => x.q.id === 'q1')!.given).toBe('14 days');
  });
  it('an empty selection fails', () => { expect(contextEngine.run([]).passed).toBe(false); });
  it('states plainly that the reader is not a model', () => {
    expect(contextEngine.questions().find((q) => q.id === 'keyword')!.explain).toMatch(/not a model/);
  });
});

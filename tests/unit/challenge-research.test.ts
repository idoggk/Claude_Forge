import { describe, expect, it } from 'vitest';
import { CHECKS, ITEMS, MAX_CHECKS, researchEngine, runResearchLab } from '@/domain/challenges/research';

const REAL = ['quote-in-source', 'numbers-match', 'newer-source-exists', 'vendor-only-performance', 'scope-words'];

describe('Challenge B: research reliability', () => {
  it('the five targeted checks catch every injected flaw with no false alarm', () => {
    const o = runResearchLab(REAL);
    expect(o.missed).toEqual([]);
    expect(o.falseAlarms).toEqual([]);
    expect(o.coverage).toBe(1);
    expect(researchEngine.run(REAL).passed).toBe(true);
  });
  it('each real check fires on exactly the flaws of its own kind', () => {
    for (const id of REAL) {
      const o = runResearchLab([id]);
      expect(o.falseAlarms, id).toEqual([]);
      expect(o.caught.length, id).toBeGreaterThan(0);
    }
  });
  it('the broad checks raise false alarms on sound claims', () => {
    for (const id of ['max-age-12mo', 'no-vendor-sources', 'two-sources']) expect(runResearchLab([id]).falseAlarms.length, id).toBeGreaterThan(0);
  });
  it('selecting every check is not a passing strategy', () => {
    const all = CHECKS.map((c) => c.id);
    expect(all.length).toBeGreaterThan(MAX_CHECKS);
    expect(researchEngine.run(all).passed).toBe(false);
  });
  it('an empty selection fails and nothing is caught', () => {
    const r = researchEngine.run([]);
    expect(r.passed).toBe(false);
    expect(r.coverage).toBe(0);
  });
  it('has 7 claims per draft and a flaw of every kind', () => {
    expect(ITEMS).toHaveLength(21);
    expect(new Set(ITEMS.flatMap((i) => i.flaws.map((f) => f.kind))).size).toBe(5);
  });
  it('question answers are computed and consistent', () => {
    const qs = researchEngine.questions();
    expect(qs.find((q) => q.id === 'numbers')!.correct).toEqual(['number-drift']);
    expect(qs.find((q) => q.id === 'worst')!.correct.length).toBe(1);
  });
});

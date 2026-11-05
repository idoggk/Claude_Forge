import { describe, expect, it } from 'vitest';
import { ALL_PROPOSALS, DEV_PROPOSALS, DEV_TRUTH, HELDOUT_PROPOSALS, HELDOUT_TRUTH, AFFORDABILITY_BAND, RUNAWAY, evaluatePatch, evaluateProposal, applyPatch, LIVE_CONFIG } from '@/fixtures/economy/mission';
import { simulate } from '@/fixtures/economy/sim';

describe('Economy Balance Reviewer mission fixtures', () => {
  it('ground truth is computed from the simulator and has the intended spread', () => {
    expect(DEV_TRUTH.map((t) => [t.caseId, t.verdict])).toEqual([['dev-1', 'approve'], ['dev-2', 'reject'], ['dev-3', 'revise'], ['dev-4', 'approve']]);
    expect(HELDOUT_TRUTH.map((t) => [t.caseId, t.verdict])).toEqual([['held-1', 'reject'], ['held-2', 'approve'], ['held-3', 'revise']]);
  });

  it('every verdict has a safe margin from the decision thresholds (no borderline cases)', () => {
    for (const p of ALL_PROPOSALS) {
      const e = evaluateProposal(p);
      if (e.verdict === 'approve') {
        expect(e.minAffordability - AFFORDABILITY_BAND.low, p.id).toBeGreaterThan(0.05);
        expect(AFFORDABILITY_BAND.high - e.maxAffordability, p.id).toBeGreaterThan(0.05);
        expect(RUNAWAY.trend - e.trend, p.id).toBeGreaterThan(0.2);
      } else if (e.verdict === 'revise') {
        const below = AFFORDABILITY_BAND.low - e.minAffordability;
        expect(below, p.id).toBeGreaterThan(0.03);
        expect(RUNAWAY.absoluteMax - e.maxAffordability, p.id).toBeGreaterThan(0.05);
        expect(RUNAWAY.trend - e.trend, p.id).toBeGreaterThan(0.2);
      } else {
        expect(e.trend >= RUNAWAY.trend + 0.1 || e.maxAffordability > RUNAWAY.absoluteMax + 0.1, p.id).toBe(true);
      }
    }
  });

  it('the trap is real: an APPROVED proposal still has a hoard ratio above the 4 ceiling (surplus is not inflation)', () => {
    const d1 = evaluateProposal(DEV_PROPOSALS[0]!);
    expect(d1.verdict).toBe('approve');
    expect(d1.maxHoardRatio).toBeGreaterThan(4);
    expect(d1.reasons.join(' ')).toMatch(/stage-gate surplus/);
  });

  it('the misleading rationale of the "cut rewards" case produces a grind, not a fix', () => {
    const d3 = evaluateProposal(DEV_PROPOSALS[2]!);
    expect(d3.minAffordability).toBeLessThan(0.4);
    expect(d3.maxHoardRatio).toBeLessThan(2); // it does drain the stockpile, and breaks pacing doing it
  });

  it('the live configuration is itself healthy, so verdicts are about the proposed change', () => {
    expect(evaluatePatch({}).verdict).toBe('approve');
  });

  it('is deterministic and does not mutate the live configuration', () => {
    const before = JSON.stringify(LIVE_CONFIG);
    expect(evaluatePatch({ baseReward: 46 })).toEqual(evaluatePatch({ baseReward: 46 }));
    applyPatch(LIVE_CONFIG, { baseReward: 1 });
    expect(JSON.stringify(LIVE_CONFIG)).toBe(before);
    expect(simulate(LIVE_CONFIG)).toEqual(simulate(LIVE_CONFIG));
  });

  it('dev and held-out sets use different parameters (no leakage through reuse)', () => {
    const keys = (ps: typeof ALL_PROPOSALS) => new Set(ps.map((p) => JSON.stringify(Object.keys(p.patch).sort()) + JSON.stringify(p.patch)));
    const dev = keys(DEV_PROPOSALS);
    for (const k of keys(HELDOUT_PROPOSALS)) expect(dev.has(k)).toBe(false);
    const devParams = new Set(DEV_PROPOSALS.flatMap((p) => Object.keys(p.patch)));
    const heldParams = HELDOUT_PROPOSALS.flatMap((p) => Object.keys(p.patch));
    // held-out cases exercise levers the dev set never touches
    expect(heldParams.filter((k) => !devParams.has(k)).length).toBeGreaterThanOrEqual(2);
  });
});

import { describe, expect, it } from 'vitest';
import { CASES, BUGGY_RESOLVER, runSuite, scanSeeds, playSeeded } from '@/fixtures/merge-cascade/cases';
import { dropPiece as referenceDrop } from '@/fixtures/merge-cascade/board.reference';
import { CANDIDATES } from '@/fixtures/merge-cascade/candidates';
import { totalValue, pieceValue, emptyBoard } from '@/fixtures/merge-cascade/board';
import { parseBoard } from '@/fixtures/merge-cascade/cases';
import { REFERENCE_CONFIG } from '@/fixtures/economy/reference';
import {
  BUGGY_CONFIG,
  HEALTH_BAND,
  simulate,
  firstStageHoardAbove,
  upgradeCost,
  sinkCoverage,
  stagesGated,
} from '@/fixtures/economy/sim';
import {
  DIFF_LINES,
  DIFF_TARGETS,
  SEEDED_ISSUES,
  GATES,
  INTEGRATION_STEPS,
  VERDICTS,
  evidenceText,
} from '@/fixtures/review/handoff';

describe('Fixture 1 - merge cascade', () => {
  it('the seeded bug is real: the buggy implementation FAILS the reproducible cases', () => {
    const { results, failed } = runSuite(BUGGY_RESOLVER);
    const failing = results.filter((r) => !r.pass).map((r) => r.id);
    expect(failed).toBe(3);
    expect(failing).toEqual(['group-of-four', 'group-of-five-row', 'cascade-into-four']);
  });

  it('the reference fix passes every case, including edge cases', () => {
    const { results, failed } = runSuite(referenceDrop);
    expect(results.filter((r) => !r.pass)).toEqual([]);
    expect(failed).toBe(0);
    expect(results).toHaveLength(CASES.length);
  });

  it('buggy implementation passes the cases that do not hit the defect', () => {
    const { results } = runSuite(BUGGY_RESOLVER);
    for (const id of ['isolated-drop', 'simple-triple', 'cascade-clean', 'max-rank-no-merge', 'occupied-cell']) {
      expect(results.find((r) => r.id === id)?.pass, id).toBe(true);
    }
  });

  it('value is destroyed by the buggy group-of-four and conserved by the fix', () => {
    const before = parseBoard(['11...', '..1..', '.....', '.....', '.....']);
    const buggy = BUGGY_RESOLVER(before, { r: 0, c: 2 }, 1);
    const fixed = referenceDrop(before, { r: 0, c: 2 }, 1);
    const expected = totalValue(before) + pieceValue(1);
    expect(totalValue(fixed.board)).toBe(expected);
    expect(totalValue(buggy.board)).toBe(expected - pieceValue(1));
  });

  it('seeded playthroughs expose the bug in the buggy resolver and never in the reference', () => {
    const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
    const buggyFails = scanSeeds(BUGGY_RESOLVER, seeds);
    expect(buggyFails.length).toBeGreaterThanOrEqual(5);
    expect(buggyFails[0]!.messages.join(' ')).toContain('value-conservation');
    expect(scanSeeds(referenceDrop, seeds)).toEqual([]);
    // reproducibility: same seed, same failure
    const first = buggyFails[0]!;
    expect(playSeeded(BUGGY_RESOLVER, first.seed)).toEqual(first);
  });

  it('exactly one candidate patch is a real fix and the suite agrees', () => {
    const verdicts = CANDIDATES.map((c) => ({ id: c.id, suite: runSuite(c.resolver).failed === 0, seeds: scanSeeds(c.resolver, Array.from({ length: 40 }, (_, i) => i + 1)).length === 0 }));
    for (const c of CANDIDATES) {
      const v = verdicts.find((x) => x.id === c.id)!;
      expect(v.suite && v.seeds, `${c.id} correctness flag matches test outcome`).toBe(c.isCorrect);
    }
    expect(CANDIDATES.filter((c) => c.isCorrect)).toHaveLength(1);
  });

  it('special-casing four still fails the group-of-five case (fits the report, not the cause)', () => {
    const c = CANDIDATES.find((x) => x.id === 'special-case-four')!;
    const { results } = runSuite(c.resolver);
    expect(results.find((r) => r.id === 'group-of-four')?.pass).toBe(true);
    expect(results.find((r) => r.id === 'group-of-five-row')?.pass).toBe(false);
  });

  it('invalid drops throw instead of corrupting the board', () => {
    expect(() => referenceDrop(emptyBoard(), { r: 9, c: 0 }, 1)).toThrow(RangeError);
    expect(() => referenceDrop(emptyBoard(), { r: 0, c: 0 }, 0)).toThrow(RangeError);
  });
});

describe('Fixture 2 - economy inflation', () => {
  const buggy = simulate(BUGGY_CONFIG);
  const fixed = simulate(REFERENCE_CONFIG);

  it('is deterministic', () => {
    expect(simulate(BUGGY_CONFIG)).toEqual(buggy);
  });

  it('seeded imbalance: affordability (income relative to price) runs away in the buggy config', () => {
    const early = buggy.find((r) => r.stage === 10)!.affordability;
    const late = buggy.find((r) => r.stage === 60)!.affordability;
    expect(late).toBeGreaterThan(early * 2.5);
    expect(late).toBeGreaterThan(2);
    expect(firstStageHoardAbove(buggy, 5)).not.toBeNull();
    expect(firstStageHoardAbove(buggy, 5)!).toBeLessThan(40);
  });

  it('reference fix: affordability stays inside the health band from stage 10', () => {
    const [lo, hi] = HEALTH_BAND.affordability;
    for (const r of fixed.filter((x) => x.stage >= 10)) {
      expect(r.affordability).toBeGreaterThanOrEqual(lo);
      expect(r.affordability).toBeLessThanOrEqual(hi);
    }
  });

  it('reference fix keeps stockpiles bounded after stage 12 (gate-bound surplus, not runaway)', () => {
    for (const r of fixed.filter((x) => x.stage >= 12)) expect(r.hoardRatio).toBeLessThanOrEqual(HEALTH_BAND.maxHoardRatioAfterStage12);
  });

  it('configs are identical early: the early game is NOT the problem', () => {
    for (const s of [1, 2]) expect(buggy[s - 1]!.supply).toBe(fixed[s - 1]!.supply);
    // In stages 1-12 one stage of income never buys a full upgrade in either config.
    for (let s = 1; s <= 12; s++) {
      expect(buggy[s - 1]!.affordability, `buggy stage ${s}`).toBeLessThan(1);
      expect(fixed[s - 1]!.affordability, `fixed stage ${s}`).toBeLessThan(1);
    }
    expect(firstStageHoardAbove(buggy, 1.5, 1)).toBeGreaterThan(10);
  });

  it('a bigger balance alone is not inflation: the fixed config also accumulates surplus behind the gate', () => {
    expect(fixed[59]!.balance).toBeGreaterThan(fixed[19]!.balance);
    expect(fixed[59]!.affordability).toBeLessThan(0.8);
  });

  it('sinks are identical in rate in both configs, so they are not the cause of the divergence', () => {
    expect(BUGGY_CONFIG.repairRate).toBe(REFERENCE_CONFIG.repairRate);
    expect(sinkCoverage(buggy, 40, 60)).toBeLessThan(sinkCoverage(fixed, 40, 60));
    expect(stagesGated(buggy, 12, 60)).toBeGreaterThan(stagesGated(fixed, 12, 60));
  });

  it('upgrade costs grow geometrically', () => {
    expect(upgradeCost(BUGGY_CONFIG, 0)).toBe(60);
    expect(upgradeCost(BUGGY_CONFIG, 10)).toBe(243);
  });
});

describe('Fixture 3 - multi-agent review', () => {
  it('every seeded issue is backed by evidence that is really present in the fixture text', () => {
    for (const issue of SEEDED_ISSUES) {
      expect(issue.evidence.length).toBeGreaterThan(0);
      for (const ev of issue.evidence) {
        expect(evidenceText(ev.source), `${issue.id}: "${ev.contains}"`).toContain(ev.contains);
      }
    }
  });

  it('diff targets point at the lines that actually contain the planted problems', () => {
    expect(DIFF_LINES[1 - 1]).toContain('boardRules.ts');
    expect(DIFF_LINES[11 - 1]).toContain('Math.random()');
    expect(DIFF_LINES[19 - 1]).toContain('"chainRewardShards": 18');
    expect(DIFF_LINES[22 - 1]).toContain('it.skip');
    expect(DIFF_LINES[24 - 1]).toContain('it.skip');
    for (const t of DIFF_TARGETS) expect(t.line).toBeLessThanOrEqual(DIFF_LINES.length);
  });

  it('there are critical issues, plausible gates and a single correct verdict', () => {
    expect(SEEDED_ISSUES.filter((i) => i.severity === 'critical').length).toBeGreaterThanOrEqual(3);
    expect(GATES.filter((g) => g.required).length).toBeGreaterThanOrEqual(6);
    expect(GATES.filter((g) => !g.required).length).toBeGreaterThanOrEqual(3);
    expect(VERDICTS.filter((v) => v.correct)).toHaveLength(1);
    expect(INTEGRATION_STEPS.length).toBe(6);
  });
});

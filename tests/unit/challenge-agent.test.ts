import { describe, expect, it } from 'vitest';
import { GUARDRAILS, ITEMS, MAX_GUARDRAILS, agentEngine, contained, runAgentLab } from '@/domain/challenges/agent';

const REAL = ['repeat-guard', 'error-handling', 'claim-needs-evidence', 'path-allowlist', 'step-budget'];

describe('Challenge C: agent failure investigator', () => {
  it('the five targeted guardrails contain every fault without blocking a good run', () => {
    const o = runAgentLab(REAL);
    expect(o.missed).toEqual([]);
    expect(o.falseAlarms).toEqual([]);
    expect(agentEngine.run(REAL).passed).toBe(true);
  });
  it('each targeted guardrail fires only on its own fault', () => {
    for (const id of REAL) { const o = runAgentLab([id]); expect(o.falseAlarms, id).toEqual([]); expect(o.caught.length, id).toBeGreaterThan(0); }
  });
  it('over-broad guardrails block good runs', () => {
    for (const id of ['no-writes', 'step-budget-4', 'human-review-all']) expect(runAgentLab([id]).falseAlarms.length, id).toBeGreaterThan(0);
  });
  it('turning everything on is not passing, and the cap is enforced', () => {
    const all = GUARDRAILS.map((g) => g.id);
    expect(all.length).toBeGreaterThan(MAX_GUARDRAILS);
    expect(agentEngine.run(all).passed).toBe(false);
  });
  it('containment is reported per trace', () => {
    expect(Object.values(contained(REAL)).every(Boolean)).toBe(true);
    expect(Object.values(contained([])).some(Boolean)).toBe(false);
  });
  it('traces are deterministic and the clean runs have no recorded fault', () => {
    expect(ITEMS.map((i) => i.id)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']);
    expect(ITEMS.filter((i) => !i.flaws.length).map((i) => i.id)).toEqual(['T1', 'T6']);
  });
  it('question answers are computed', () => {
    const q = agentEngine.questions();
    expect(q.find((x) => x.id === 'common')!.correct).toEqual(['unverified-claim']);
  });
});

import { simulate, type EconomyConfig, type PowerCoupling, type StageRow } from './sim';
import { REFERENCE_CONFIG } from './reference';

/**
 * Economy Balance Reviewer mission - seeded evaluation cases.
 *
 * Every case is a PROPOSED CHANGE to the live "Shardfall" configuration (the healthy REFERENCE_CONFIG).
 * The simulator is the ground truth: the verdict for each case is COMPUTED from its output with the
 * published design targets below, never hand-labelled. All data is synthetic and fictional.
 *
 * Design targets (given to every condition, including the no-Skill baseline, so the comparison is fair):
 *  - From stage 10 on, income-to-price ("affordability") should stay inside the band 0.40-0.80.
 *  - RUNAWAY: affordability above 1.0 at any stage from 10, or growing >= 1.6x from stage 10 to stage 60  -> reject.
 *  - OUT OF BAND but not runaway (too grindy, or modestly too generous)                                   -> revise.
 *  - IN BAND for every stage from 10 and not runaway                                                      -> approve.
 *  - Raw balance and stockpile ("hoard ratio") are NOT verdict criteria: surplus held back by the stage gate is not inflation.
 */

export type Verdict = 'approve' | 'revise' | 'reject';

export type EconomyPatch = Partial<Omit<EconomyConfig, 'coupling'>> & { coupling?: PowerCoupling };

export interface Proposal {
  id: string;
  phase: 'dev' | 'heldout';
  title: string;
  /** What exactly changes (plain language + the parameter patch). */
  change: string;
  /** The proposer's argument. It may be wrong or misleading - that is part of the exercise. */
  rationale: string;
  patch: EconomyPatch;
}

export const AFFORDABILITY_BAND = { low: 0.4, high: 0.8 } as const;
export const RUNAWAY = { absoluteMax: 1.0, trend: 1.6 } as const;
export const FROM_STAGE = 10;

export const LIVE_CONFIG: EconomyConfig = { ...REFERENCE_CONFIG, name: 'Shardfall live configuration' };

export function applyPatch(base: EconomyConfig, patch: EconomyPatch): EconomyConfig {
  return { ...base, ...patch, coupling: patch.coupling ?? base.coupling };
}

export interface ProposalEvaluation {
  verdict: Verdict;
  minAffordability: number;
  maxAffordability: number;
  affordabilityStage10: number;
  affordabilityStage60: number;
  trend: number;
  maxHoardRatio: number;
  reasons: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function judge(rows: StageRow[]): ProposalEvaluation {
  const from = rows.filter((r) => r.stage >= FROM_STAGE);
  const aff = from.map((r) => r.affordability);
  const min = Math.min(...aff);
  const max = Math.max(...aff);
  const a10 = rows.find((r) => r.stage === FROM_STAGE)!.affordability;
  const a60 = rows[rows.length - 1]!.affordability;
  const trend = a60 / a10;
  const hoard = Math.max(...rows.filter((r) => r.stage >= 12).map((r) => r.hoardRatio));
  const reasons: string[] = [];
  let verdict: Verdict;
  if (max > RUNAWAY.absoluteMax || trend >= RUNAWAY.trend) {
    verdict = 'reject';
    reasons.push(`Runaway supply: affordability ${r2(a10)} at stage 10 → ${r2(a60)} at stage 60 (×${r2(trend)}; peak ${r2(max)}). Income is decoupling from price.`);
  } else if (min < AFFORDABILITY_BAND.low || max > AFFORDABILITY_BAND.high) {
    verdict = 'revise';
    reasons.push(
      min < AFFORDABILITY_BAND.low
        ? `Too grindy: affordability dips to ${r2(min)}, below the ${AFFORDABILITY_BAND.low} floor, so income no longer keeps up with price.`
        : `Too generous: affordability peaks at ${r2(max)}, above the ${AFFORDABILITY_BAND.high} ceiling, though it is not runaway.`,
    );
  } else {
    verdict = 'approve';
    reasons.push(`In band: affordability stays between ${r2(min)} and ${r2(max)} from stage ${FROM_STAGE} (target ${AFFORDABILITY_BAND.low}-${AFFORDABILITY_BAND.high}), trend ×${r2(trend)}.`);
  }
  if (hoard > 4) reasons.push(`Hoard ratio peaks at ${r2(hoard)}, but that is stage-gate surplus: it is not a verdict criterion unless affordability also runs away.`);
  return { verdict, minAffordability: r2(min), maxAffordability: r2(max), affordabilityStage10: r2(a10), affordabilityStage60: r2(a60), trend: r2(trend), maxHoardRatio: r2(hoard), reasons };
}

export function evaluatePatch(patch: EconomyPatch): ProposalEvaluation {
  return judge(simulate(applyPatch(LIVE_CONFIG, patch)));
}

export function evaluateProposal(p: Proposal): ProposalEvaluation {
  return evaluatePatch(p.patch);
}

export const DEV_PROPOSALS: Proposal[] = [
  {
    id: 'dev-1',
    phase: 'dev',
    title: 'First-clear bonus: +15% base reward',
    change: 'Raise baseReward from 40 to 46 (a 15% first-clear bonus on every stage).',
    rationale: 'Testers say early stages feel stingy. Warning: late-game stockpiles already look large, so this might make "inflation" worse.',
    patch: { baseReward: 46 },
  },
  {
    id: 'dev-2',
    phase: 'dev',
    title: 'Compounding power coupling (+6% per upgrade level)',
    change: 'Change the power multiplier from linear to compounding: coupling { mode: "compound", k: 0.06 }.',
    rationale: 'Each upgrade should feel meaningfully stronger, and stronger players should earn proportionally more.',
    patch: { coupling: { mode: 'compound', k: 0.06 } },
  },
  {
    id: 'dev-3',
    phase: 'dev',
    title: 'Cut all rewards by 30% to fight inflation',
    change: 'Lower baseReward from 40 to 28.',
    rationale: 'Players have huge stockpiles at stage 40+. That is inflation, so reduce income across the board.',
    patch: { baseReward: 28 },
  },
  {
    id: 'dev-4',
    phase: 'dev',
    title: 'Double the repair tax to drain stockpiles',
    change: 'Raise repairRate from 0.15 to 0.30.',
    rationale: 'A bigger sink should burn off the hoard that players accumulate behind the stage gate.',
    patch: { repairRate: 0.3 },
  },
];

export const HELDOUT_PROPOSALS: Proposal[] = [
  {
    id: 'held-1',
    phase: 'heldout',
    title: 'Cheaper upgrades: cost growth 1.15 → 1.12',
    change: 'Lower upgradeCostGrowth from 1.15 to 1.12 so the mid-game feels smoother.',
    rationale: 'Upgrade prices ramp too steeply for casual players; a gentler curve is more player-friendly.',
    patch: { upgradeCostGrowth: 1.12 },
  },
  {
    id: 'held-2',
    phase: 'heldout',
    title: 'Slightly faster reward growth: 1.04 → 1.043',
    change: 'Raise rewardGrowth from 1.04 to 1.043 per stage.',
    rationale: 'Late stages should feel a little more rewarding without a big jump.',
    patch: { rewardGrowth: 1.043 },
  },
  {
    id: 'held-3',
    phase: 'heldout',
    title: 'Steeper upgrade costs: 1.15 → 1.18',
    change: 'Raise upgradeCostGrowth from 1.15 to 1.18 so upgrades feel more meaningful.',
    rationale: 'Players blow through upgrades too quickly. Make each one cost more.',
    patch: { upgradeCostGrowth: 1.18 },
  },
];

export const ALL_PROPOSALS: Proposal[] = [...DEV_PROPOSALS, ...HELDOUT_PROPOSALS];

export function proposalById(id: string): Proposal | undefined {
  return ALL_PROPOSALS.find((p) => p.id === id);
}

export interface CaseTruth {
  caseId: string;
  verdict: Verdict;
  summary: string;
  numbers: ProposalEvaluation;
}

export function truthFor(p: Proposal): CaseTruth {
  const numbers = evaluateProposal(p);
  return { caseId: p.id, verdict: numbers.verdict, summary: numbers.reasons.join(' '), numbers };
}

export const DEV_TRUTH: CaseTruth[] = DEV_PROPOSALS.map(truthFor);
export const HELDOUT_TRUTH: CaseTruth[] = HELDOUT_PROPOSALS.map(truthFor);

export const REVIEW_CHECKLIST = [
  { id: 'ran-sim', text: 'Ran the simulation (or the provided script) for this proposal before recommending' },
  { id: 'cited-ratio', text: 'Based the verdict on affordability (income ÷ price) across stages, not on raw balance alone' },
  { id: 'surplus-vs-inflation', text: 'Explicitly separated stage-gate surplus from runaway supply' },
  { id: 'cites-numbers', text: 'Cited specific stage numbers or values that match the simulation output (no invented figures)' },
  { id: 'states-limits', text: 'Stated what the simulation does not show (synthetic data, one seed, one policy)' },
] as const;

/** The prompt used for EVERY condition (baseline and Skill-assisted) so the task text is identical. */
export function taskPrompt(p: Proposal): string {
  return [
    'Review a proposed change to the live economy of "Shardfall" (a fictional training game; this folder is the whole fixture).',
    '',
    `Proposal ${p.id}: ${p.title}`,
    `Change: ${p.change}`,
    `Proposer's rationale: ${p.rationale}`,
    '',
    'The design targets are in README.md. Decide whether the change should be approved, revised or rejected.',
    'Finish your answer with exactly one line of the form:',
    'VERDICT: approve    (or: VERDICT: revise / VERDICT: reject)',
  ].join('\n');
}

export const DESIGN_TARGETS_MD = `## Design targets (apply to every proposal)

- From **stage 10** on, the income-to-price ratio ("**affordability** = supply ÷ price of the next upgrade") should stay inside the band **0.40 – 0.80**.
- **Reject** a change that is *runaway*: affordability above **1.0** at any stage from 10, or growing **≥ 1.6×** between stage 10 and stage 60.
- **Revise** a change that leaves the band without running away (too grindy below 0.40, or modestly too generous above 0.80).
- **Approve** a change that keeps affordability inside the band from stage 10 and is not runaway.
- Raw **balance** and the **hoard ratio** (balance ÷ next price) are *not* verdict criteria on their own. Surplus held back by the stage gate is not inflation.

The live configuration is in \`live-config.ts\`. Run \`npx tsx run.ts <proposal-id>\` to simulate a proposal (or \`npx tsx run.ts live\` for the current economy).`;

import { mulberry32 } from './rng';

/**
 * EDUCATIONAL FIXTURE - a fictional progression economy ("Shardfall"), written
 * for Claude Forge. NOT telemetry from any real game. All numbers are
 * synthetic and deterministic (seeded RNG), so every learner sees identical data.
 *
 * Model per stage (1..stages), for a deterministic "average player" policy:
 *  1. Clear the stage, earning SUPPLY shards:
 *       base(stage) * (1 + noise) * powerMultiplier(level)
 *       base(stage) = baseReward * rewardGrowth^(stage-1)
 *  2. Pay the REPAIR SINK: repairRate * supply (a flat currency tax).
 *  3. Buy upgrades while affordable AND permitted by the progression GATE:
 *       cost(level) = round(upgradeBaseCost * upgradeCostGrowth^level)
 *       maxLevel(stage) = gateBaseLevel + floor(stage / gateStagesPerLevel)
 *
 * Seeded imbalance (see BUGGY_CONFIG): powerMultiplier COMPOUNDS with upgrade
 * level faster than upgrade cost grows - a positive feedback loop.
 */

export interface PowerCoupling {
  mode: 'linear' | 'compound';
  k: number;
}

export interface EconomyConfig {
  name: string;
  stages: number;
  seed: number;
  baseReward: number;
  rewardGrowth: number;
  noise: number;
  repairRate: number;
  upgradeBaseCost: number;
  upgradeCostGrowth: number;
  gateBaseLevel: number;
  gateStagesPerLevel: number;
  coupling: PowerCoupling;
}

export interface StageRow {
  stage: number;
  level: number;
  maxLevel: number;
  supply: number;
  repair: number;
  upgradeSpend: number;
  upgradesBought: number;
  balance: number;
  nextCost: number;
  /** supply / nextCost: how many "next upgrades" one stage of income pays for. */
  affordability: number;
  /** balance / nextCost: how many next-upgrades are sitting unspent. */
  hoardRatio: number;
  /** Player can afford the next upgrade but the gate forbids it. */
  gated: boolean;
}

export const BASE_CONFIG: EconomyConfig = {
  name: 'Shardfall v0.9 (as shipped to testers)',
  stages: 60,
  seed: 20260301,
  baseReward: 40,
  rewardGrowth: 1.04,
  noise: 0.1,
  repairRate: 0.15,
  upgradeBaseCost: 60,
  upgradeCostGrowth: 1.15,
  gateBaseLevel: 2,
  gateStagesPerLevel: 3,
  coupling: { mode: 'compound', k: 0.1 },
};

/** The seeded imbalance: reward power compounds 10% per upgrade level while costs grow 15%/level. */
export const BUGGY_CONFIG: EconomyConfig = { ...BASE_CONFIG };

export function upgradeCost(cfg: EconomyConfig, level: number): number {
  return Math.round(cfg.upgradeBaseCost * cfg.upgradeCostGrowth ** level);
}

export function maxLevelAt(cfg: EconomyConfig, stage: number): number {
  return cfg.gateBaseLevel + Math.floor(stage / cfg.gateStagesPerLevel);
}

export function powerMultiplier(cfg: EconomyConfig, level: number): number {
  return cfg.coupling.mode === 'compound' ? (1 + cfg.coupling.k) ** level : 1 + cfg.coupling.k * level;
}

export function simulate(cfg: EconomyConfig): StageRow[] {
  const rnd = mulberry32(cfg.seed);
  const rows: StageRow[] = [];
  let level = 0;
  let balance = 0;
  for (let stage = 1; stage <= cfg.stages; stage++) {
    const noise = 1 + (rnd() * 2 - 1) * cfg.noise;
    const supply = Math.round(cfg.baseReward * cfg.rewardGrowth ** (stage - 1) * noise * powerMultiplier(cfg, level));
    const repair = Math.round(cfg.repairRate * supply);
    balance += supply - repair;
    let upgradeSpend = 0;
    let bought = 0;
    const maxLevel = maxLevelAt(cfg, stage);
    while (level < maxLevel && balance >= upgradeCost(cfg, level)) {
      const cost = upgradeCost(cfg, level);
      balance -= cost;
      upgradeSpend += cost;
      level++;
      bought++;
    }
    const nextCost = upgradeCost(cfg, level);
    rows.push({
      stage,
      level,
      maxLevel,
      supply,
      repair,
      upgradeSpend,
      upgradesBought: bought,
      balance,
      nextCost,
      affordability: round2(supply / nextCost),
      hoardRatio: round2(balance / nextCost),
      gated: level >= maxLevel && balance >= nextCost,
    });
  }
  return rows;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** First stage (>= fromStage) where hoardRatio exceeds `threshold`, or null. */
export function firstStageHoardAbove(rows: StageRow[], threshold: number, fromStage = 1): number | null {
  return rows.find((r) => r.stage >= fromStage && r.hoardRatio > threshold)?.stage ?? null;
}

export function sumSupply(rows: StageRow[], from: number, to: number): number {
  return rows.filter((r) => r.stage >= from && r.stage <= to).reduce((a, r) => a + r.supply, 0);
}

export function upgradesInWindow(rows: StageRow[], from: number, to: number): number {
  return rows.filter((r) => r.stage >= from && r.stage <= to).reduce((a, r) => a + r.upgradesBought, 0);
}

/** Share of income that sinks (repair + upgrade spend) removed, over a window. */
export function sinkCoverage(rows: StageRow[], from: number, to: number): number {
  const w = rows.filter((r) => r.stage >= from && r.stage <= to);
  const supply = w.reduce((a, r) => a + r.supply, 0);
  const sunk = w.reduce((a, r) => a + r.repair + r.upgradeSpend, 0);
  return supply === 0 ? 0 : round2(sunk / supply);
}

export function stagesGated(rows: StageRow[], from: number, to: number): number {
  return rows.filter((r) => r.stage >= from && r.stage <= to && r.gated).length;
}

/**
 * Health band used by the fixture tests and the lesson. "Healthy" here means the price of the next
 * upgrade stays a roughly constant number of stages of income (affordability is flat), NOT that the
 * balance is small. A gate can legitimately hold some surplus; runaway affordability is the problem.
 */
export const HEALTH_BAND = { affordability: [0.4, 0.8], maxHoardRatioAfterStage12: 4 } as const;

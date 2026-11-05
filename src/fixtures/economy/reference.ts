import { BASE_CONFIG, type EconomyConfig } from './sim';

/** Reference fix: power grows linearly (+3% per level), so cost growth outpaces reward growth. */
export const REFERENCE_CONFIG: EconomyConfig = {
  ...BASE_CONFIG,
  name: 'Shardfall v0.9 + linear power coupling (reference fix)',
  coupling: { mode: 'linear', k: 0.03 },
};

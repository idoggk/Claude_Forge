import type { LoopMission } from '@/domain/loop/types';
import { ECONOMY_BALANCE_MISSION } from './economy-balance';
import { PHASER_PERFORMANCE_MISSION } from './phaser-performance';
import { DETERMINISTIC_SIMULATION_MISSION } from './deterministic-simulation';
import { INTEGRATION_AUDITOR_MISSION } from './integration-auditor';

export const MISSIONS: LoopMission[] = [ECONOMY_BALANCE_MISSION, PHASER_PERFORMANCE_MISSION, DETERMINISTIC_SIMULATION_MISSION, INTEGRATION_AUDITOR_MISSION];

export function getMission(id: string): LoopMission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

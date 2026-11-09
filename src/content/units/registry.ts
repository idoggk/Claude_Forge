import { COMPETENCY_BY_ID } from '@/domain/curriculum/competencies';
import { LESSONS } from '@/content/lessons';
import type { Mission } from '@/domain/missions/model';
import { validateMission } from '@/domain/missions/model';
import { MISSION_UNITS } from './missions';
import { SPARK_UNITS } from './sparks';

/** Guided missions and Quick Sparks, in one list. See domain/missions for the format and the validator. */
export const UNITS: Mission[] = [...MISSION_UNITS, ...SPARK_UNITS];
export const MISSIONS_ONLY = UNITS.filter((u) => u.kind === 'mission');
export const SPARKS_ONLY = UNITS.filter((u) => u.kind === 'spark');
export const getUnit = (id: string): Mission | undefined => UNITS.find((u) => u.id === id);
export const unitForLesson = (lessonId: string): Mission | undefined => MISSIONS_ONLY.find((m) => m.lessonId === lessonId);

export function validateAllUnits() {
  const ctx = { lessonIds: new Set(LESSONS.map((l) => l.id)), competencyIds: new Set(Object.keys(COMPETENCY_BY_ID)), missionIds: new Set(UNITS.map((u) => u.id)) };
  return UNITS.flatMap((u) => validateMission(u, ctx));
}

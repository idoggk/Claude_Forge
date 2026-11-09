import type { Mission, MissionRun } from './model';
import type { AdaptiveSuggestion } from '../mastery/adaptive';

/**
 * What to put in front of the learner first. A fixed rule over the learner's own records, not AI personalisation. Order:
 *  1. an unfinished mission or spark (finish what you started),
 *  2. reviews that are due (short, spaced),
 *  3. practice their own evidence calls for (a foundation review or a stretch), matched to a unit when one exists,
 *  4. a first spark for someone with no history,
 *  5. the next spark or mission they have not done.
 * Every result carries the reason in plain words. Minutes are editorial estimates.
 */
export type ChallengeKind = 'continue' | 'review' | 'suggestion' | 'intro' | 'spark' | 'mission' | 'caught-up';
export interface Challenge { kind: ChallengeKind; title: string; why: string; to: string; minutes: number; label: string; unitId?: string }

export const INTRO_SPARK_ID = 'spark-agent-permissions';

export interface NextInput {
  units: Mission[];
  runs: MissionRun[];
  suggestions: AdaptiveSuggestion[];
  dueReviews: number;
  /** Lessons whose current assessment is passed. */
  passedLessonIds: ReadonlySet<string>;
  /** Whether the learner has any attempt, run or review at all. */
  hasHistory: boolean;
}

export const unitPath = (u: Mission) => `/${u.kind === 'spark' ? 'spark' : 'mission'}/${u.id}`;
const completedIds = (runs: MissionRun[]) => new Set(runs.filter((r) => r.status === 'completed').map((r) => r.missionId));
const startedIds = (runs: MissionRun[]) => new Set(runs.map((r) => r.missionId));

export function pickSpark(units: Mission[], runs: MissionRun[], preferCompetencies: string[] = []): Mission | null {
  const sparks = units.filter((u) => u.kind === 'spark');
  const done = completedIds(runs);
  const fresh = sparks.filter((s) => !done.has(s.id));
  const pool = fresh.length ? fresh : sparks;
  const preferred = pool.find((s) => s.competencies.some((c) => preferCompetencies.includes(c)));
  if (preferred) return preferred;
  if (fresh.length) return fresh[0]!;
  // everything done: rotate to the one done longest ago
  const last = new Map<string, string>();
  for (const r of runs) if (r.status === 'completed' && r.kind === 'spark') last.set(r.missionId, (last.get(r.missionId) ?? '') < (r.completedAt ?? '') ? (r.completedAt ?? '') : last.get(r.missionId)!);
  return [...sparks].sort((a, b) => (last.get(a.id) ?? '').localeCompare(last.get(b.id) ?? ''))[0] ?? null;
}

export function pickMission(units: Mission[], runs: MissionRun[], passed: ReadonlySet<string>, preferLessonId?: string | null): Mission | null {
  const missions = units.filter((u) => u.kind === 'mission');
  const done = completedIds(runs);
  const prefer = preferLessonId ? missions.find((m) => m.lessonId === preferLessonId) : undefined;
  if (prefer) return prefer;
  return missions.find((m) => !done.has(m.id) && !passed.has(m.lessonId ?? '')) ?? missions.find((m) => !done.has(m.id)) ?? missions[0] ?? null;
}

export function nextChallenge(i: NextInput): Challenge {
  const unfinished = [...i.runs].filter((r) => r.status === 'in-progress').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (unfinished) {
    const u = i.units.find((x) => x.id === unfinished.missionId);
    if (u && u.version === unfinished.missionVersion) {
      return { kind: 'continue', title: `Continue: ${u.title}`, why: 'You started this and did not finish. Your place is saved.', to: unitPath(u), minutes: Math.max(1, Math.round(u.minutes / 2)), label: 'Continue', unitId: u.id };
    }
  }
  if (i.dueReviews > 0) {
    return { kind: 'review', title: 'Review for 5 minutes', why: `${i.dueReviews} review${i.dueReviews === 1 ? ' is' : 's are'} due. Short, spaced practice on fresh questions is what makes a passed assessment last.`, to: '/review5', minutes: 5, label: 'Start review' };
  }
  const s = i.suggestions[0];
  if (s) {
    const spark = pickSpark(i.units, i.runs, s.competencies);
    const match = spark && spark.competencies.some((c) => s.competencies.includes(c)) ? spark : null;
    if (match && (s.tier === 'foundation' || s.tier === 'standard')) {
      return { kind: 'suggestion', title: match.title, why: `${s.why} ${s.evidence[0] ?? ''}`.trim(), to: unitPath(match), minutes: match.minutes, label: 'Start', unitId: match.id };
    }
    return { kind: 'suggestion', title: s.title, why: `${s.why} ${s.evidence[0] ?? ''}`.trim(), to: s.to, minutes: 6, label: 'Open' };
  }
  if (!i.hasHistory) {
    const intro = i.units.find((u) => u.id === INTRO_SPARK_ID) ?? pickSpark(i.units, i.runs);
    if (intro) return { kind: 'intro', title: intro.title, why: 'A short problem to try first. No set-up, no account, nothing to read before you start.', to: unitPath(intro), minutes: intro.minutes, label: 'Try it', unitId: intro.id };
  }
  const spark = pickSpark(i.units, i.runs);
  const started = startedIds(i.runs);
  if (spark && !completedIds(i.runs).has(spark.id)) return { kind: 'spark', title: spark.title, why: started.size === 0 ? 'A short problem to try.' : 'A new short problem you have not tried yet.', to: unitPath(spark), minutes: spark.minutes, label: 'Start', unitId: spark.id };
  const mission = pickMission(i.units, i.runs, i.passedLessonIds);
  if (mission && !completedIds(i.runs).has(mission.id)) return { kind: 'mission', title: mission.title, why: 'A guided mission for a lesson you have not passed yet. It ends at that lesson\'s independent assessment.', to: unitPath(mission), minutes: mission.minutes, label: 'Start', unitId: mission.id };
  const again = pickSpark(i.units, i.runs);
  return { kind: 'caught-up', title: again ? `Again: ${again.title}` : 'You are caught up', why: 'You have tried every Quick Spark and mission. Revisiting one after a break is how it sticks.', to: again ? unitPath(again) : '/academy', minutes: again?.minutes ?? 5, label: again ? 'Try again' : 'Browse', unitId: again?.id };
}

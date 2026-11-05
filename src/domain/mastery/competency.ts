import type { Lesson, CompetencyId } from '../curriculum/types';
import { COMPETENCIES } from '../curriculum/competencies';
import type { Attempt, CompetencyRecord, FieldEvidence, LessonProgress } from '@/persistence/schemas';

/**
 * Competency levels:
 *  0 Unseen · 1 Recognizes · 2 Guided application · 3 Independent application · 4 Field-proven
 *
 * Rules (all evaluated on evidence for the CURRENT lesson version only):
 *  L1  The learner has completed the teaching segments or made any graded attempt touching the concept.
 *  L2  Concept score >= GUIDED_MARK on any practice/assessment/review attempt.
 *  L3  Concept score >= INDEPENDENT_MARK on an UNSEEN, hint-free attempt (first assessment attempt on this
 *      lesson version, or a spaced-review item from the separate review pool) AND no critical item for the
 *      concept was missed, AND the most recent unseen attempt for that concept did not miss a critical item.
 *  L4  L3 plus at least one self-reported field-evidence record (real work) tagged with the concept.
 *
 * A missed critical item can never be offset by high scores elsewhere: it caps the concept at level 2.
 */
export const GUIDED_MARK = 0.7;
export const INDEPENDENT_MARK = 0.75;

export const LEVEL_NAMES = ['Unseen', 'Recognizes', 'Guided application', 'Independent application', 'Field-proven'] as const;

export interface CompetencyEvaluation {
  competencyId: CompetencyId;
  level: number;
  /** Best level evidenced on any lesson version, including superseded content. */
  staleLevel: number;
  blockedReason: string | null;
  evidence: { attemptId: string; lessonId: string; stage: Attempt['stage']; score: number; note: string }[];
  fieldEvidenceIds: string[];
}

function levelFromAttempts(
  concept: CompetencyId,
  attempts: Attempt[],
  fieldEvidence: FieldEvidence[],
  progress: LessonProgress[],
  lessonsForConcept: Lesson[],
  versionFilter: (a: Attempt) => boolean,
): { level: number; blockedReason: string | null; evidence: CompetencyEvaluation['evidence']; fieldIds: string[] } {
  const sorted = attempts.filter(versionFilter).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const evidence: CompetencyEvaluation['evidence'] = [];
  let level = 0;
  let blockedReason: string | null = null;

  const completedTeaching = lessonsForConcept.some((l) =>
    progress.some((p) => p.lessonId === l.id && p.lessonVersion === l.version && p.segmentsSeen.length >= l.segments.length),
  );
  if (completedTeaching) level = 1;

  const touching = sorted.filter((a) => a.conceptResults[concept]);
  if (touching.length > 0) level = Math.max(level, 1);

  for (const a of touching) {
    const c = a.conceptResults[concept]!;
    if (c.score >= GUIDED_MARK) {
      level = Math.max(level, 2);
      evidence.push({ attemptId: a.id, lessonId: a.lessonId, stage: a.stage, score: c.score, note: 'Concept score met the guided threshold.' });
    }
  }

  const unseen = touching.filter((a) => a.unseen && a.independent && a.stage !== 'practice');
  const qualifying = unseen.filter((a) => a.conceptResults[concept]!.score >= INDEPENDENT_MARK && !a.conceptResults[concept]!.criticalFailed);
  const latestUnseen = unseen[unseen.length - 1];
  if (qualifying.length > 0) {
    if (latestUnseen && latestUnseen.conceptResults[concept]!.criticalFailed) {
      blockedReason = 'A mandatory (critical) check was missed in your most recent independent attempt. Pass it again in a review to restore level 3.';
    } else {
      level = Math.max(level, 3);
      const q = qualifying[qualifying.length - 1]!;
      evidence.push({ attemptId: q.id, lessonId: q.lessonId, stage: q.stage, score: q.conceptResults[concept]!.score, note: 'Unseen, hint-free attempt with no critical misses.' });
    }
  } else if (unseen.some((a) => a.conceptResults[concept]!.criticalFailed)) {
    blockedReason = 'Capped at level 2: a mandatory (critical) check for this concept was missed. High scores elsewhere do not compensate - retry it in review.';
  }

  const fieldIds = fieldEvidence.filter((f) => f.competencyIds.includes(concept)).map((f) => f.id);
  if (level >= 3 && fieldIds.length > 0) level = 4;
  return { level, blockedReason, evidence, fieldIds };
}

export function evaluateCompetencies(
  attempts: Attempt[],
  lessons: Lesson[],
  fieldEvidence: FieldEvidence[],
  progress: LessonProgress[] = [],
): CompetencyEvaluation[] {
  const versionOf = new Map(lessons.map((l) => [l.id, l.version]));
  return COMPETENCIES.map((comp) => {
    const lessonsForConcept = lessons.filter((l) => l.competencies.includes(comp.id));
    const current = levelFromAttempts(comp.id, attempts, fieldEvidence, progress, lessonsForConcept, (a) => versionOf.get(a.lessonId) === a.lessonVersion);
    const any = levelFromAttempts(comp.id, attempts, fieldEvidence, [], lessonsForConcept, () => true);
    return {
      competencyId: comp.id,
      level: current.level,
      staleLevel: Math.max(any.level, current.level),
      blockedReason: current.blockedReason,
      evidence: current.evidence,
      fieldEvidenceIds: current.fieldIds,
    };
  });
}

/** Merge fresh evaluations into stored records, appending history only when a level actually changes. */
export function applyEvaluations(
  existing: CompetencyRecord[],
  evals: CompetencyEvaluation[],
  nowIso: string,
  reason: string,
): CompetencyRecord[] {
  const byId = new Map(existing.map((r) => [r.competencyId, r]));
  return evals.map((e) => {
    const prev = byId.get(e.competencyId);
    const from = prev?.level ?? 0;
    const history = [...(prev?.history ?? [])];
    if (from !== e.level) history.push({ at: nowIso, from, to: e.level, reason });
    return {
      competencyId: e.competencyId,
      level: e.level,
      staleLevel: e.staleLevel,
      blockedReason: e.blockedReason,
      updatedAt: prev && from === e.level && prev.blockedReason === e.blockedReason ? prev.updatedAt : nowIso,
      history,
    };
  });
}

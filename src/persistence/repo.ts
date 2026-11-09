import { getDb } from './db';
import type { Lesson, Item } from '@/domain/curriculum/types';
import { LESSONS } from '@/content/lessons';
import { gradeAttempt, type AttemptGrade } from '@/domain/assessment/grade';
import { evaluateExternal } from '@/domain/assessment/external';
import { predictedPctFor, calibrationVerdict } from '@/domain/assessment/calibration';
import { applyEvaluations, evaluateCompetencies } from '@/domain/mastery/competency';
import { applyReviewOutcome, classifyReview, initialReview, isDue } from '@/domain/mastery/review';
import { planReview, type PlannedItem } from '@/domain/mastery/reviewPlan';
import { lessonStatus } from '@/domain/mastery/recommend';
import { nowIso, todayKey } from '@/lib/clock';
import type {
  Annotation,
  ArsenalRecord,
  ArsenalStatus,
  Attempt,
  CompetencyRecord,
  FieldEvidence,
  LessonProgress,
  Preferences,
  Profile,
  ReviewRecord,
} from './schemas';
import { DiagnosticRecordSchema, FieldEvidenceSchema, type DiagnosticRecord } from './schemas';
import { DIAGNOSTIC } from '@/content/diagnostic';
import { gradeDiagnostic } from '@/domain/mastery/diagnostic';
import type { SkillDraft, SkillContent, Revision } from '@/domain/skills/model';
import { contentOf } from '@/domain/skills/model';
import type { Evidence, Experiment } from '@/domain/experiments/model';
import { newId } from '@/lib/ids';
import { LearningGoalSchema, MAX_ACTIVE_GOALS, type LearningGoal } from '@/domain/goals/model';
import { PlaybookSchema, type EvidenceLink, type Playbook, type PlaybookContent, type PlaybookEvaluation } from '@/domain/playbook/model';
import { buildEvaluation, createEvidenceLink, linkCurrency, playbookContentFingerprint, reassessLink, reviewLink, stepFingerprint } from '@/domain/playbook/evidence';
import { TransferTaskSchema, completionProblems, type TransferTask } from '@/domain/transfer/model';
import { MissionRunSchema, type MissionRun } from '@/domain/missions/model';
import { TakeawaySchema, confidenceProblems, type EvidenceContext, type Takeaway } from '@/domain/library/model';
import { ActivityRunSchema, type ActivityRun } from './schemas';

/* ---------------------------------- profile & prefs ---------------------------------- */

export async function getProfile(): Promise<Profile | undefined> {
  return getDb().profile.get('me');
}

export async function saveProfile(patch: Partial<Omit<Profile, 'id' | 'createdAt'>>): Promise<Profile> {
  const db = getDb();
  const existing = await db.profile.get('me');
  const next: Profile = {
    id: 'me',
    displayName: '',
    interests: [],
    dailyMinutes: 20,
    onboardedAt: null,
    createdAt: nowIso(),
    ...existing,
    ...patch,
  };
  await db.profile.put(next);
  return next;
}

export async function getPreferences(): Promise<Preferences> {
  return (await getDb().preferences.get('prefs')) ?? { id: 'prefs', theme: 'dark', motion: 'system' };
}

export async function savePreferences(patch: Partial<Omit<Preferences, 'id'>>): Promise<Preferences> {
  const next = { ...(await getPreferences()), ...patch };
  await getDb().preferences.put(next);
  return next;
}

/* ---------------------------------- lesson progress ---------------------------------- */

export async function touchLesson(lesson: Lesson, patch: Partial<Pick<LessonProgress, 'stage' | 'appliedNote'>> & { segmentSeen?: string } = {}): Promise<LessonProgress> {
  const db = getDb();
  return db.transaction('rw', db.lessonProgress, async () => {
    const now = nowIso();
    const existing = await db.lessonProgress.get(lesson.id);
    // Progress made on an older lesson version is kept in attempts; the progress row restarts on a new version.
    const base: LessonProgress =
      existing && existing.lessonVersion === lesson.version
        ? existing
        : { lessonId: lesson.id, lessonVersion: lesson.version, stage: 'learn', segmentsSeen: [], startedAt: now, updatedAt: now, completedAt: null, appliedNote: '' };
    const seen = patch.segmentSeen && !base.segmentsSeen.includes(patch.segmentSeen) ? [...base.segmentsSeen, patch.segmentSeen] : base.segmentsSeen;
    const next: LessonProgress = { ...base, segmentsSeen: seen, stage: patch.stage ?? base.stage, appliedNote: patch.appliedNote ?? base.appliedNote, updatedAt: now };
    await db.lessonProgress.put(next);
    return next;
  });
}

/* ------------------------------------ attempts ------------------------------------ */

export interface SubmitInput {
  /** Created when the exercise screen opens; resubmitting the same ID can never create a second attempt. */
  attemptId: string;
  lesson: Lesson;
  stage: 'practice' | 'assessment';
  startedAt: string;
  answers: Record<string, unknown>;
  hintsUsed: number;
  confidence: number | null;
}

export interface SubmitResult {
  attempt: Attempt;
  grade: AttemptGrade | null;
  created: boolean;
  levelsBefore: Record<string, number>;
  levelsAfter: Record<string, number>;
  calibration: { gap: number; verdict: ReturnType<typeof calibrationVerdict>['verdict'] } | null;
}

const PRACTICE_MARK = 0.7;

export async function loadExternalInputs() {
  const db = getDb();
  const [skills, experiments, evidence, playbooks] = await Promise.all([db.customSkills.toArray(), db.experiments.toArray(), db.evidence.toArray(), db.playbooks.toArray()]);
  return { skills, experiments, evidence, playbooks };
}

async function recomputeCompetenciesTx(reason: string): Promise<{ before: Record<string, number>; after: Record<string, number> }> {
  const db = getDb();
  const [attempts, field, progress, existing] = await Promise.all([db.attempts.toArray(), db.fieldEvidence.toArray(), db.lessonProgress.toArray(), db.competencies.toArray()]);
  const evals = evaluateCompetencies(attempts, LESSONS, field, progress);
  const records = applyEvaluations(existing, evals, nowIso(), reason);
  await db.competencies.bulkPut(records);
  return {
    before: Object.fromEntries(existing.map((r) => [r.competencyId, r.level])),
    after: Object.fromEntries(records.map((r) => [r.competencyId, r.level])),
  };
}

export async function recomputeCompetencies(reason: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.attempts, db.fieldEvidence, db.lessonProgress, db.competencies, async () => {
    await recomputeCompetenciesTx(reason);
  });
}

export async function submitAttempt(input: SubmitInput): Promise<SubmitResult> {
  const db = getDb();
  return db.transaction('rw', [db.attempts, db.lessonProgress, db.competencies, db.reviews, db.customSkills, db.experiments, db.evidence, db.fieldEvidence, db.playbooks], async () => {
    const dupe = await db.attempts.get(input.attemptId);
    if (dupe) {
      const cur = Object.fromEntries((await db.competencies.toArray()).map((r) => [r.competencyId, r.level]));
      return { attempt: dupe, grade: null, created: false, levelsBefore: cur, levelsAfter: cur, calibration: null };
    }
    const { lesson, stage } = input;
    const items: Item[] = stage === 'practice' ? lesson.activity.items : lesson.assessment.items;
    const passMark = stage === 'practice' ? PRACTICE_MARK : lesson.assessment.passMark;
    const external = evaluateExternal(await db.customSkills.toArray(), await db.experiments.toArray(), await db.evidence.toArray(), await db.playbooks.toArray());
    const grade = gradeAttempt(items, input.answers, { passMark, external });
    const prior = await db.attempts.where('[lessonId+stage]').equals([lesson.id, stage]).filter((a) => a.lessonVersion === lesson.version).count();
    const attemptNumber = prior + 1;
    const hints = stage === 'assessment' ? 0 : Math.max(0, Math.floor(input.hintsUsed));
    const predictedPct = input.confidence !== null ? predictedPctFor(input.confidence) : null;
    const attempt: Attempt = {
      id: input.attemptId,
      lessonId: lesson.id,
      lessonVersion: lesson.version,
      stage,
      startedAt: input.startedAt,
      submittedAt: nowIso(),
      attemptNumber,
      answers: input.answers,
      results: grade.results.map((r) => ({ itemId: r.itemId, kind: r.kind, concept: r.concept, critical: r.critical, correct: r.correct, score: r.score, points: r.points, selfAssessed: r.selfAssessed, answered: r.answered, feedback: r.feedback })),
      score: grade.score,
      passed: grade.passed,
      criticalFailed: grade.criticalFailed,
      hintsUsed: hints,
      confidence: input.confidence,
      predictedPct,
      independent: hints === 0,
      unseen: stage === 'assessment' && attemptNumber === 1,
      conceptResults: grade.conceptResults,
    };
    await db.attempts.add(attempt);
    await touchLessonInTx(lesson, stage === 'assessment' ? { stage: 'apply' } : { stage: 'assess' });
    const levels = await recomputeCompetenciesTx(`${stage === 'assessment' ? 'Assessment' : 'Practice'} on ${lesson.title}`);
    if (stage === 'assessment' && !(await db.reviews.get(lesson.id))) await db.reviews.put(initialReview(lesson.id, todayKey(), nowIso()));
    if (stage === 'assessment' && grade.passed) {
      const p = await db.lessonProgress.get(lesson.id);
      if (p && !p.completedAt) await db.lessonProgress.put({ ...p, completedAt: nowIso() });
    }
    const calibration = predictedPct !== null && stage !== 'practice' ? calibrationVerdict(predictedPct, grade.score * 100) : null;
    return { attempt, grade, created: true, levelsBefore: levels.before, levelsAfter: levels.after, calibration };
  });
}

async function touchLessonInTx(lesson: Lesson, patch: { stage: LessonProgress['stage'] }) {
  const db = getDb();
  const now = nowIso();
  const existing = await db.lessonProgress.get(lesson.id);
  const base: LessonProgress =
    existing && existing.lessonVersion === lesson.version
      ? existing
      : { lessonId: lesson.id, lessonVersion: lesson.version, stage: 'learn', segmentsSeen: [], startedAt: now, updatedAt: now, completedAt: null, appliedNote: '' };
  const order = ['learn', 'practice', 'assess', 'apply'] as const;
  const stage = order.indexOf(patch.stage) > order.indexOf(base.stage) ? patch.stage : base.stage;
  await db.lessonProgress.put({ ...base, stage, updatedAt: now });
}

export interface ReviewSession {
  lessonId: string;
  items: Item[];
  cycle: number;
  /** Why each item was chosen (mistake-focused, interleaved, difficulty, rotation). */
  plan: PlannedItem[];
}

async function planFor(lesson: Lesson, rec: ReviewRecord): Promise<PlannedItem[]> {
  const db = getDb();
  const [attempts, progress] = await Promise.all([db.attempts.toArray(), db.lessonProgress.toArray()]);
  const passedLessonIds = LESSONS.filter((l) => lessonStatus(l, attempts, progress) === 'passed').map((l) => l.id);
  return planReview({ lesson, lessons: LESSONS, box: rec.box, cycle: rec.cycle, attempts, passedLessonIds });
}

export async function startReview(lessonId: string): Promise<ReviewSession | null> {
  const lesson = LESSONS.find((l) => l.id === lessonId);
  const rec = await getDb().reviews.get(lessonId);
  if (!lesson || !rec) return null;
  const plan = await planFor(lesson, rec);
  return { lessonId, cycle: rec.cycle, items: plan.map((p) => p.item), plan };
}

export interface ReviewResult {
  attempt: Attempt;
  outcome: 'pass' | 'partial' | 'fail';
  review: ReviewRecord;
  created: boolean;
}

export async function submitReview(input: { attemptId: string; lessonId: string; startedAt: string; answers: Record<string, unknown>; hintsUsed: number; confidence: number | null; /** The exact items shown (from startReview). Omit to re-derive them from the current state. */ itemIds?: string[] }): Promise<ReviewResult | null> {
  const db = getDb();
  const lesson = LESSONS.find((l) => l.id === input.lessonId);
  if (!lesson) return null;
  return db.transaction('rw', [db.attempts, db.lessonProgress, db.competencies, db.reviews, db.fieldEvidence], async () => {
    const dupe = await db.attempts.get(input.attemptId);
    const rec = await db.reviews.get(lesson.id);
    if (!rec) return null;
    if (dupe) return { attempt: dupe, outcome: rec.lastOutcome ?? 'partial', review: rec, created: false };
    const items = input.itemIds ? resolveReviewItems(input.itemIds) : (await planFor(lesson, rec)).map((p) => p.item);
    if (items.length === 0) return null;
    const grade = gradeAttempt(items, input.answers, { passMark: 0.8 });
    const predictedPct = input.confidence !== null ? predictedPctFor(input.confidence) : null;
    const verdict = predictedPct !== null ? calibrationVerdict(predictedPct, grade.score * 100).verdict : 'calibrated';
    const prior = await db.attempts.where('[lessonId+stage]').equals([lesson.id, 'review']).filter((a) => a.lessonVersion === lesson.version).count();
    const hints = Math.max(0, Math.floor(input.hintsUsed));
    const attempt: Attempt = {
      id: input.attemptId,
      lessonId: lesson.id,
      lessonVersion: lesson.version,
      stage: 'review',
      startedAt: input.startedAt,
      submittedAt: nowIso(),
      attemptNumber: prior + 1,
      answers: input.answers,
      results: grade.results.map((r) => ({ itemId: r.itemId, kind: r.kind, concept: r.concept, critical: r.critical, correct: r.correct, score: r.score, points: r.points, selfAssessed: r.selfAssessed, answered: r.answered, feedback: r.feedback })),
      score: grade.score,
      passed: grade.passed,
      criticalFailed: grade.criticalFailed,
      hintsUsed: hints,
      confidence: input.confidence,
      predictedPct,
      independent: hints === 0,
      unseen: true,
      conceptResults: grade.conceptResults,
    };
    await db.attempts.add(attempt);
    const outcome = classifyReview({ score: grade.score, hintsUsed: hints, overconfidentMiss: verdict === 'overconfident' && grade.score < 0.8 });
    const review = applyReviewOutcome(rec, outcome, todayKey(), nowIso(), `score ${Math.round(grade.score * 100)}%${hints ? `, ${hints} hint(s)` : ''}${verdict === 'overconfident' ? ', overconfident' : ''}`);
    await db.reviews.put(review);
    await recomputeCompetenciesTx(`Review of ${lesson.title}`);
    return { attempt, outcome, review, created: true };
  });
}

/** Resolve the items a review session showed. Only items from some lesson's separate review pool are accepted. */
function resolveReviewItems(ids: string[]): Item[] {
  const pool = new Map(LESSONS.flatMap((l) => l.reviewItems).map((i) => [i.id, i] as const));
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const id of ids.slice(0, 8)) {
    const it = pool.get(id);
    if (it && !seen.has(id)) { seen.add(id); out.push(it); }
  }
  return out;
}

/* ------------------------------------------- diagnostic ------------------------------------------- */

/**
 * Save a placement diagnostic. Deliberately touches NOTHING except the `diagnostics` store: it cannot create an
 * attempt, a review, or a competency change, so a diagnostic can never award mastery.
 */
export async function submitDiagnostic(input: { id: string; answers: Record<string, unknown> }): Promise<{ record: DiagnosticRecord; created: boolean }> {
  const db = getDb();
  const existing = await db.diagnostics.get(input.id);
  if (existing) return { record: existing, created: false };
  const out = gradeDiagnostic(input.answers);
  const record = DiagnosticRecordSchema.parse({ id: input.id, diagnosticId: DIAGNOSTIC.id, diagnosticVersion: DIAGNOSTIC.version, takenAt: nowIso(), answers: input.answers, ...out });
  await db.diagnostics.add(record);
  return { record, created: true };
}

/* -------------------------------------- field evidence -------------------------------------- */

export async function addFieldEvidence(input: Omit<FieldEvidence, 'id' | 'createdAt' | 'selfReported'>): Promise<FieldEvidence> {
  const rec = FieldEvidenceSchema.parse({ ...input, id: newId('field'), createdAt: nowIso(), selfReported: true });
  const db = getDb();
  await db.transaction('rw', [db.fieldEvidence, db.attempts, db.lessonProgress, db.competencies], async () => {
    await db.fieldEvidence.add(rec);
    await recomputeCompetenciesTx(`Field evidence: ${rec.title}`);
  });
  return rec;
}

export async function deleteFieldEvidence(id: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.fieldEvidence, db.attempts, db.lessonProgress, db.competencies], async () => {
    await db.fieldEvidence.delete(id);
    await recomputeCompetenciesTx('Field evidence removed');
  });
}

/* ------------------------------------ arsenal & notes ------------------------------------ */

export async function setArsenalStatus(entryId: string, status: ArsenalStatus): Promise<ArsenalRecord> {
  const db = getDb();
  return db.transaction('rw', db.arsenal, async () => {
    const now = nowIso();
    const prev = await db.arsenal.get(entryId);
    const rec: ArsenalRecord = prev
      ? { ...prev, status, updatedAt: now, history: [...prev.history, { at: now, from: prev.status, to: status }].slice(-50) }
      : {
          entryId, status, inspected: false, approved: false, declaredInstalled: false, observedUsefulness: null, rejectionReason: '', securityConcerns: '', nextPractice: '',
          experimentIds: [], lastEvaluatedAt: null, addedAt: now, updatedAt: now, history: [{ at: now, from: null, to: status }],
        };
    await db.arsenal.put(rec);
    return rec;
  });
}

export async function patchArsenal(entryId: string, patch: Partial<Omit<ArsenalRecord, 'entryId' | 'addedAt' | 'history'>>): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.arsenal, async () => {
    const prev = await db.arsenal.get(entryId);
    if (!prev) throw new Error('Add the item to your Arsenal first.');
    await db.arsenal.put({ ...prev, ...patch, updatedAt: nowIso() });
  });
}

export async function removeFromArsenal(entryId: string): Promise<void> {
  await getDb().arsenal.delete(entryId);
}

export async function saveAnnotation(entryId: string, patch: Partial<Omit<Annotation, 'entryId' | 'updatedAt'>>): Promise<Annotation> {
  const db = getDb();
  return db.transaction('rw', db.annotations, async () => {
    const prev = await db.annotations.get(entryId);
    const next: Annotation = { entryId, notes: '', personalRelevance: null, candidate: null, ...prev, ...patch, updatedAt: nowIso() };
    await db.annotations.put(next);
    return next;
  });
}

export async function deleteAnnotation(entryId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.annotations, db.arsenal], async () => {
    await db.annotations.delete(entryId);
    await db.arsenal.delete(entryId);
  });
}

/* ------------------------------------ custom skills ------------------------------------ */

export async function saveSkill(draft: SkillDraft): Promise<SkillDraft> {
  const next = { ...draft, updatedAt: nowIso() };
  await getDb().customSkills.put(next);
  return next;
}

export async function deleteSkill(id: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.customSkills, db.arsenal], async () => {
    await db.customSkills.delete(id);
    await db.arsenal.delete(`custom:${id}`);
  });
}

export function snapshotRevision(draft: SkillDraft, label: string): Revision {
  return { id: newId('rev'), savedAt: nowIso(), label: label.slice(0, 120) || 'Snapshot', snapshot: contentOf(draft) };
}

export function restoreRevision(draft: SkillDraft, rev: Revision): SkillDraft {
  const c: SkillContent = rev.snapshot;
  return { ...draft, ...c, updatedAt: nowIso() };
}

/* ------------------------------------- experiments ------------------------------------- */

export async function saveExperiment(exp: Experiment): Promise<Experiment> {
  const next = { ...exp, updatedAt: nowIso() };
  await getDb().experiments.put(next);
  return next;
}

export async function deleteExperiment(id: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.experiments, db.evidence], async () => {
    await db.experiments.delete(id);
    await db.evidence.where('experimentId').equals(id).delete();
  });
}

export async function addEvidence(ev: Evidence): Promise<void> {
  await getDb().evidence.put(ev);
}

export async function deleteEvidence(id: string): Promise<void> {
  await getDb().evidence.delete(id);
}

/* ------------------------------------------ goals ------------------------------------------ */

export class GoalLimitError extends Error {}

/** Create or update a learning goal. Goals steer recommendations; they are never evidence of skill. */
export async function saveGoal(input: { id?: string; title: string; why?: string; capabilityIds: string[] }): Promise<LearningGoal> {
  const db = getDb();
  const now = nowIso();
  return db.transaction('rw', db.goals, async () => {
    const existing = input.id ? await db.goals.get(input.id) : undefined;
    if (!existing) {
      const active = await db.goals.where('status').equals('active').count();
      if (active >= MAX_ACTIVE_GOALS) throw new GoalLimitError(`You can keep ${MAX_ACTIVE_GOALS} active goals at a time. Archive or complete one first.`);
    }
    const next = LearningGoalSchema.parse({
      ...(existing ?? { id: input.id ?? newId('goal'), status: 'active', achievedNote: '', achievedAt: null, createdAt: now }),
      title: input.title.trim(),
      why: input.why ?? existing?.why ?? '',
      capabilityIds: input.capabilityIds,
      updatedAt: now,
    });
    await db.goals.put(next);
    return next;
  });
}

/** Declare a goal achieved (with a note in your own words), archived, or active again. Forge never decides this for you. */
export async function setGoalStatus(id: string, status: LearningGoal['status'], achievedNote = ''): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.goals, async () => {
    const g = await db.goals.get(id);
    if (!g) return;
    if (status === 'active' && g.status !== 'active') {
      const active = await db.goals.where('status').equals('active').count();
      if (active >= MAX_ACTIVE_GOALS) throw new GoalLimitError(`You can keep ${MAX_ACTIVE_GOALS} active goals at a time.`);
    }
    const now = nowIso();
    await db.goals.put({ ...g, status, achievedNote: status === 'achieved' ? achievedNote.trim() : g.achievedNote, achievedAt: status === 'achieved' ? now : null, updatedAt: now });
  });
}

export async function deleteGoal(id: string): Promise<void> {
  await getDb().goals.delete(id);
}

/* ---------------------------------------- playbooks ---------------------------------------- */

const MAX_REVISIONS = 30;
const contentOfPlaybook = (p: PlaybookContent): PlaybookContent => ({
  title: p.title, goal: p.goal, prerequisites: p.prerequisites, inputs: p.inputs, outputs: p.outputs, completionCriteria: p.completionCriteria, steps: p.steps, notes: p.notes, capabilityIds: p.capabilityIds,
});

/** Save a playbook. When `revisionLabel` is given, the PREVIOUS saved content is kept as a version-history entry. */
export async function savePlaybook(pb: Playbook, revisionLabel?: string): Promise<Playbook> {
  const db = getDb();
  const now = nowIso();
  return db.transaction('rw', db.playbooks, async () => {
    const prev = await db.playbooks.get(pb.id);
    let revisions = pb.revisions;
    if (revisionLabel && prev) {
      revisions = [...prev.revisions, { id: newId('rev'), savedAt: now, label: revisionLabel.slice(0, 120), snapshot: contentOfPlaybook(prev) }].slice(-MAX_REVISIONS);
    }
    // The content version rises only when the playbook's CONTENT changes (not when evidence or reviews change), so
    // evidence can say which version it was linked at.
    const pv = prev?.contentVersion ?? pb.contentVersion ?? 1;
    const contentVersion = prev && playbookContentFingerprint(prev) !== playbookContentFingerprint(pb) ? pv + 1 : pv;
    // A step marked verified records the wording it was verified against; later edits invalidate it.
    const steps = pb.steps.map((st) => (st.status === 'verified' && !st.verifiedFingerprint ? { ...st, verifiedFingerprint: stepFingerprint(st) } : st.status !== 'verified' && st.verifiedFingerprint ? { ...st, verifiedFingerprint: null } : st));
    // Evidence links and evaluation summaries change only through the dedicated functions below, so an editor draft
    // that was opened before a link was made can never overwrite it.
    const evidenceLinks = prev ? prev.evidenceLinks : pb.evidenceLinks;
    const evaluations = prev ? prev.evaluations : pb.evaluations;
    const next = PlaybookSchema.parse({ ...pb, steps, contentVersion, revisions, evidenceLinks, evaluations, updatedAt: now });
    await db.playbooks.put(next);
    return next;
  });
}

export async function deletePlaybook(id: string): Promise<void> {
  await getDb().playbooks.delete(id);
}


/**
 * Link an AI Lab experiment to a playbook step (used when an experiment is created FROM a step). The link starts
 * unreviewed: it proves nothing until the learner writes criteria and a judgement. Reads and writes only Dexie tables.
 */
export async function linkExperimentToStep(playbookId: string, stepId: string, experimentId: string, seededTotal: number | null = null): Promise<EvidenceLinkResult> {
  const db = getDb();
  return db.transaction('rw', [db.playbooks, db.experiments], async () => {
    const pb = await db.playbooks.get(playbookId);
    const step = pb?.steps.find((x) => x.id === stepId);
    const exp = await db.experiments.get(experimentId);
    if (!pb || !step || !exp) return { ok: false as const, reason: !pb ? 'The playbook no longer exists.' : !step ? 'The step no longer exists.' : 'The experiment no longer exists.' };
    if (pb.evidenceLinks.some((l) => l.stepId === stepId && l.experimentId === experimentId)) return { ok: false as const, reason: 'That experiment is already linked to this step.' };
    if (pb.evidenceLinks.length >= 200) return { ok: false as const, reason: 'This playbook already has the maximum number of evidence links.' };
    const link = createEvidenceLink({ id: newId('evl'), playbook: pb, step, experiment: exp, now: nowIso(), seededTotal });
    const next = PlaybookSchema.parse({ ...pb, evidenceLinks: [...pb.evidenceLinks, link], updatedAt: nowIso() });
    await db.playbooks.put(next);
    return { ok: true as const, link };
  });
}
export type EvidenceLinkResult = { ok: true; link: import('@/domain/playbook/model').EvidenceLink } | { ok: false; reason: string };

/** Mutate ONE link inside a playbook, atomically. Evidence changes never touch the playbook's content or its content version. */
async function updateLink(playbookId: string, linkId: string, fn: (link: EvidenceLink, pb: Playbook, exp: Experiment | undefined) => EvidenceLink | null | string): Promise<{ ok: true; playbook: Playbook } | { ok: false; reason: string }> {
  const db = getDb();
  return db.transaction('rw', [db.playbooks, db.experiments], async () => {
    const pb = await db.playbooks.get(playbookId);
    const link = pb?.evidenceLinks.find((l) => l.id === linkId);
    if (!pb || !link) return { ok: false as const, reason: 'That evidence link no longer exists.' };
    const exp = await db.experiments.get(link.experimentId);
    const changed = fn(link, pb, exp);
    if (typeof changed === 'string') return { ok: false as const, reason: changed };
    const evidenceLinks = changed === null ? pb.evidenceLinks.filter((l) => l.id !== linkId) : pb.evidenceLinks.map((l) => (l.id === linkId ? changed : l));
    const next = PlaybookSchema.parse({ ...pb, evidenceLinks, updatedAt: nowIso() });
    await db.playbooks.put(next);
    return { ok: true as const, playbook: next };
  });
}

/** Record the learner's own criteria and judgement. Nothing here is computed from the experiment. */
export function reviewEvidenceLink(playbookId: string, linkId: string, patch: Parameters<typeof reviewLink>[1]) {
  return updateLink(playbookId, linkId, (link, pb, exp) => {
    // A stale link cannot be judged: the learner must reassess it first, so a judgement is always about the CURRENT step and experiment.
    if (linkCurrency(link, pb.steps.find((st) => st.id === link.stepId), exp) !== 'current') return 'This evidence is stale. Reassess it against the current step and experiment before judging it.';
    return reviewLink(link, patch, nowIso());
  });
}

/** Re-snapshot a stale link against the step and experiment as they are now. The old judgement moves to history; the new one starts blank. */
export function reassessEvidenceLink(playbookId: string, linkId: string, seededTotal: number | null = null) {
  return updateLink(playbookId, linkId, (link, pb, exp) => {
    const step = pb.steps.find((s) => s.id === link.stepId);
    if (!step || !exp) return link; // nothing to reassess against: stays stale
    return reassessLink(link, step, exp, pb.contentVersion, nowIso(), seededTotal);
  });
}

export function unlinkEvidence(playbookId: string, linkId: string) {
  return updateLink(playbookId, linkId, () => null);
}

/** Save a versioned evaluation summary of the playbook's evidence as it stands now. Older summaries are kept. */
export async function saveEvaluation(playbookId: string, label = ''): Promise<{ ok: true; evaluation: PlaybookEvaluation } | { ok: false; reason: string }> {
  const db = getDb();
  return db.transaction('rw', [db.playbooks, db.experiments], async () => {
    const pb = await db.playbooks.get(playbookId);
    if (!pb) return { ok: false as const, reason: 'The playbook no longer exists.' };
    const exps = await db.experiments.bulkGet([...new Set(pb.evidenceLinks.map((l) => l.experimentId))]);
    const map = new Map(exps.filter((e): e is Experiment => Boolean(e)).map((e) => [e.id, e]));
    const evaluation = buildEvaluation(pb, map, newId('pev'), nowIso(), label.trim());
    const next = PlaybookSchema.parse({ ...pb, evaluations: [...pb.evaluations, evaluation].slice(-20), updatedAt: nowIso() });
    await db.playbooks.put(next);
    return { ok: true as const, evaluation };
  });
}

export async function deleteEvaluation(playbookId: string, evaluationId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.playbooks, async () => {
    const pb = await db.playbooks.get(playbookId);
    if (!pb) return;
    await db.playbooks.put({ ...pb, evaluations: pb.evaluations.filter((e) => e.id !== evaluationId), updatedAt: nowIso() });
  });
}

/* ------------------------------------------- transfer tasks ------------------------------------------- */

export async function saveTransferTask(t: TransferTask): Promise<TransferTask> {
  const now = nowIso();
  const next = TransferTaskSchema.parse({ ...t, updatedAt: now });
  await getDb().transferTasks.put(next);
  return next;
}

export async function deleteTransferTask(id: string): Promise<void> {
  await getDb().transferTasks.delete(id);
}

/**
 * Add a real-work result to a playbook's observed results (self-reported). This is the only way a transfer task touches a
 * playbook; it does not change the playbook's content or version, and does not verify any step.
 */
export async function recordPlaybookRealWorldResult(playbookId: string, outcome: 'worked' | 'partly' | 'failed' | 'unknown', text: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = getDb();
  return db.transaction('rw', db.playbooks, async () => {
    const pb = await db.playbooks.get(playbookId);
    if (!pb) return { ok: false as const, reason: 'The playbook no longer exists.' };
    const next = PlaybookSchema.parse({ ...pb, observedResults: [...pb.observedResults, { id: newId('obs'), at: nowIso(), outcome, text: text.trim().slice(0, 2000) }].slice(-50), updatedAt: nowIso() });
    await db.playbooks.put(next);
    return { ok: true as const };
  });
}

/** Mark complete only when observations, evidence and a reflection exist. Returns the problems when it cannot. */
export async function completeTransferTask(id: string): Promise<{ ok: true } | { ok: false; problems: string[] }> {
  const db = getDb();
  return db.transaction('rw', db.transferTasks, async () => {
    const t = await db.transferTasks.get(id);
    if (!t) return { ok: false as const, problems: ['The task no longer exists.'] };
    const problems = completionProblems(t);
    if (problems.length) return { ok: false as const, problems };
    const now = nowIso();
    await db.transferTasks.put({ ...t, status: 'completed', completedAt: now, updatedAt: now });
    return { ok: true as const };
  });
}

/* ------------------------------------- activity runs ------------------------------------- */

/** Record a standalone practice run (for example the Opportunity Finder). Never changes a competency level by itself. */
export async function recordActivityRun(run: Omit<ActivityRun, 'takenAt'>): Promise<ActivityRun> {
  const rec = ActivityRunSchema.parse({ ...run, takenAt: nowIso() });
  await getDb().activityRuns.put(rec);
  return rec;
}

/* ---------------------------------------- takeaways (library) ---------------------------------------- */

export async function evidenceContext(): Promise<EvidenceContext> {
  const db = getDb();
  const [transfers, experiments, runs] = await Promise.all([db.transferTasks.toArray(), db.experiments.toArray(), db.activityRuns.toArray()]);
  return {
    completedTransferIds: new Set(transfers.filter((t) => t.status === 'completed').map((t) => t.id)),
    experimentIds: new Set(experiments.map((e) => e.id)),
    // A challenge counts as evidence only once you have actually saved a run of it.
    challengeIds: new Set(runs.filter((r) => r.activityId.startsWith('challenge:')).map((r) => r.activityId.slice('challenge:'.length))),
  };
}

/**
 * Save a takeaway. Its confidence level is never changed by Forge: a new level must be the one you chose, and it is
 * accepted only if its references support it. Each change is appended to the takeaway's history.
 */
export async function saveTakeaway(t: Takeaway): Promise<{ ok: true; takeaway: Takeaway } | { ok: false; problems: string[] }> {
  const db = getDb();
  const ctx = await evidenceContext();
  return db.transaction('rw', db.takeaways, async () => {
    const parsed = TakeawaySchema.safeParse(t);
    if (!parsed.success) return { ok: false as const, problems: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'takeaway'}: ${i.message}`) };
    const next = parsed.data;
    const prev = await db.takeaways.get(next.id);
    const rank = (c: Takeaway['confidence']) => ['hypothesis', 'anecdotal', 'evaluated-on-fixtures', 'applied-to-real-work'].indexOf(c);
    const changed = !prev || prev.confidence !== next.confidence;
    const lowered = !!prev && rank(next.confidence) < rank(prev.confidence); // lowering a claim is always allowed
    const rejustified = !!prev && (prev.confidenceNote !== next.confidenceNote || prev.references.length !== next.references.length);
    const problems = !lowered && (changed || rejustified) ? confidenceProblems(next, ctx) : [];
    if (problems.length) return { ok: false as const, problems };
    const now = nowIso();
    const history = !prev ? [{ at: now, from: null, to: next.confidence, note: next.confidenceNote || 'Created' }] : changed ? [...prev.history, { at: now, from: prev.confidence, to: next.confidence, note: next.confidenceNote }].slice(-50) : prev.history;
    const saved = TakeawaySchema.parse({ ...next, history, createdAt: prev?.createdAt ?? next.createdAt, updatedAt: now });
    await db.takeaways.put(saved);
    return { ok: true as const, takeaway: saved };
  });
}

export async function deleteTakeaway(id: string): Promise<void> {
  await getDb().takeaways.delete(id);
}

/* ------------------------------------------ reset ------------------------------------------ */

export async function resetEverything(): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}

export type { CompetencyRecord };

/* --------------------------------------- guided missions and Quick Sparks --------------------------------------- */

/** Save a mission run. It is practice: it never writes an attempt and never changes a competency level. */
export async function saveMissionRun(run: MissionRun): Promise<MissionRun> {
  const parsed = MissionRunSchema.parse(run);
  await getDb().missionRuns.put(parsed);
  return parsed;
}

/** The newest unfinished run of a mission, if any. */
export async function activeMissionRun(missionId: string): Promise<MissionRun | undefined> {
  const rows = await getDb().missionRuns.where('missionId').equals(missionId).toArray();
  return rows.filter((r) => r.status === 'in-progress').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export async function deleteMissionRun(id: string): Promise<void> {
  await getDb().missionRuns.delete(id);
}


/* ------------------------------------------ five-minute review ------------------------------------------ */

export interface FiveMinuteItem { lessonId: string; lessonTitle: string; item: Item; reason: PlannedItem['reason']; note: string }
export interface FiveMinuteSession {
  /** At most five questions, interleaved across at most two due lessons. */
  items: FiveMinuteItem[];
  lessonIds: string[];
  /** Due reviews beyond this session. */
  remainingDue: number;
}
export const FIVE_MINUTE_MAX_ITEMS = 5;
export const FIVE_MINUTE_MAX_LESSONS = 2;

/**
 * A short session built from the learner's own due reviews: oldest due first, at most two lessons so each gets enough questions
 * to be meaningful, planned by the same review planner as a full review (mistakes and misconceptions first, difficulty by
 * schedule box), then interleaved so the lessons alternate. Returns null when nothing is due. It reads only.
 */
export async function startFiveMinuteReview(today: string): Promise<FiveMinuteSession | null> {
  const db = getDb();
  const due = (await db.reviews.toArray()).filter((r) => isDue(r, today)).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  if (due.length === 0) return null;
  const chosen = due.slice(0, FIVE_MINUTE_MAX_LESSONS);
  const perLesson: FiveMinuteItem[][] = [];
  for (const rec of chosen) {
    const lesson = LESSONS.find((l) => l.id === rec.lessonId);
    if (!lesson) continue;
    const plan = await planFor(lesson, rec);
    // only items from this lesson's own plan: keep the interleaved guest item out, because grading is per lesson
    const own = plan.filter((p) => p.lessonId === lesson.id);
    perLesson.push(own.map((p) => ({ lessonId: lesson.id, lessonTitle: lesson.title, item: p.item, reason: p.reason, note: p.note })));
  }
  const cap = chosen.length === 1 ? FIVE_MINUTE_MAX_ITEMS : Math.ceil(FIVE_MINUTE_MAX_ITEMS / 2);
  const trimmed = perLesson.map((l, i) => l.slice(0, i === 0 ? cap : FIVE_MINUTE_MAX_ITEMS - Math.min(cap, perLesson[0]!.length)));
  const items: FiveMinuteItem[] = [];
  for (let k = 0; items.length < FIVE_MINUTE_MAX_ITEMS; k++) {
    let added = false;
    for (const l of trimmed) if (l[k] && items.length < FIVE_MINUTE_MAX_ITEMS) { items.push(l[k]!); added = true; }
    if (!added) break;
  }
  if (items.length === 0) return null;
  return { items, lessonIds: [...new Set(items.map((i) => i.lessonId))], remainingDue: due.length - [...new Set(items.map((i) => i.lessonId))].length };
}

/** Save a finished five-minute session: one ordinary review per lesson, through the same scheduling and mastery rules. */
export async function submitFiveMinuteReview(input: { items: FiveMinuteItem[]; answers: Record<string, unknown>; hintsByLesson: Record<string, number>; startedAt: string }): Promise<{ lessonId: string; outcome: ReviewResult['outcome']; dueOn: string; score: number }[]> {
  const out: { lessonId: string; outcome: ReviewResult['outcome']; dueOn: string; score: number }[] = [];
  const lessonIds = [...new Set(input.items.map((i) => i.lessonId))];
  for (const lessonId of lessonIds) {
    const mine = input.items.filter((i) => i.lessonId === lessonId);
    const answers = Object.fromEntries(mine.map((i) => [i.item.id, input.answers[i.item.id]]));
    const res = await submitReview({ attemptId: newIdForReview(lessonId), lessonId, startedAt: input.startedAt, answers, hintsUsed: input.hintsByLesson[lessonId] ?? 0, confidence: null, itemIds: mine.map((i) => i.item.id) });
    if (res) out.push({ lessonId, outcome: res.outcome, dueOn: res.review.dueOn, score: res.attempt.score });
  }
  return out;
}
const newIdForReview = (lessonId: string) => newId(`att_${lessonId.slice(0, 3).toLowerCase()}`);

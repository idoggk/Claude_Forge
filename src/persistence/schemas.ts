import { z } from 'zod';
import { SkillDraftSchema } from '@/domain/skills/model';
import { ExperimentSchema, EvidenceSchema } from '@/domain/experiments/model';

const iso = z.string().min(1);

export const InterestSchema = z.enum(['game-dev', 'security', 'authoring', 'experiments', 'orchestration', 'foundations', 'ai-judgment', 'context', 'automation']);

export const ProfileSchema = z.object({
  id: z.literal('me'),
  displayName: z.string().max(80).default(''),
  interests: z.array(InterestSchema).default([]),
  dailyMinutes: z.number().int().min(5).max(240).default(20),
  onboardedAt: z.string().nullable().default(null),
  createdAt: iso,
});
export type Profile = z.infer<typeof ProfileSchema>;

export const PreferencesSchema = z.object({
  id: z.literal('prefs'),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  motion: z.enum(['system', 'reduce', 'full']).default('system'),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const LessonProgressSchema = z.object({
  lessonId: z.string().min(1),
  lessonVersion: z.number().int().min(1),
  stage: z.enum(['learn', 'practice', 'assess', 'apply']),
  segmentsSeen: z.array(z.string()).default([]),
  startedAt: iso,
  updatedAt: iso,
  completedAt: z.string().nullable().default(null),
  appliedNote: z.string().max(4000).default(''),
});
export type LessonProgress = z.infer<typeof LessonProgressSchema>;

export const ItemResultSchema = z.object({
  itemId: z.string(),
  kind: z.string(),
  concept: z.string(),
  critical: z.boolean(),
  correct: z.boolean(),
  score: z.number().min(0).max(1),
  points: z.number().min(0),
  selfAssessed: z.boolean(),
  answered: z.boolean(),
  feedback: z.string(),
});
export type StoredItemResult = z.infer<typeof ItemResultSchema>;

export const ConceptResultSchema = z.object({
  score: z.number().min(0).max(1),
  items: z.number().int().min(0),
  criticalFailed: z.boolean(),
});

export const AttemptSchema = z.object({
  id: z.string().min(1),
  lessonId: z.string().min(1),
  lessonVersion: z.number().int().min(1),
  stage: z.enum(['practice', 'assessment', 'review']),
  startedAt: iso,
  submittedAt: iso,
  attemptNumber: z.number().int().min(1),
  answers: z.record(z.string(), z.unknown()).default({}),
  results: z.array(ItemResultSchema).default([]),
  score: z.number().min(0).max(1),
  passed: z.boolean(),
  criticalFailed: z.array(z.string()).default([]),
  hintsUsed: z.number().int().min(0).default(0),
  confidence: z.number().int().min(1).max(5).nullable().default(null),
  predictedPct: z.number().min(0).max(100).nullable().default(null),
  /** No hints were used. */
  independent: z.boolean().default(false),
  /** Items were not seen before: first assessment attempt on this version, or a review pool item. */
  unseen: z.boolean().default(false),
  conceptResults: z.record(z.string(), ConceptResultSchema).default({}),
});
export type Attempt = z.infer<typeof AttemptSchema>;

export const CompetencyRecordSchema = z.object({
  competencyId: z.string().min(1),
  level: z.number().int().min(0).max(4),
  /** Highest level evidenced on any lesson version, including superseded content. */
  staleLevel: z.number().int().min(0).max(4).default(0),
  blockedReason: z.string().nullable().default(null),
  updatedAt: iso,
  history: z
    .array(z.object({ at: iso, from: z.number().int(), to: z.number().int(), reason: z.string() }))
    .default([]),
});
export type CompetencyRecord = z.infer<typeof CompetencyRecordSchema>;

export const ReviewRecordSchema = z.object({
  lessonId: z.string().min(1),
  box: z.number().int().min(0).max(3),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lapses: z.number().int().min(0).default(0),
  cycle: z.number().int().min(0).default(0),
  lastReviewedAt: z.string().nullable().default(null),
  lastOutcome: z.enum(['pass', 'partial', 'fail']).nullable().default(null),
  createdAt: iso,
  history: z
    .array(z.object({ at: iso, outcome: z.enum(['pass', 'partial', 'fail']), fromBox: z.number().int(), toBox: z.number().int(), note: z.string() }))
    .default([]),
});
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

export const AnnotationSchema = z.object({
  entryId: z.string().min(1),
  notes: z.string().max(6000).default(''),
  personalRelevance: z.number().int().min(0).max(3).nullable().default(null),
  /** Present for catalog candidates the user added. Everything here is local and unverified. */
  candidate: z
    .object({ name: z.string().max(120), url: z.string().max(500), type: z.string().max(40), publisher: z.string().max(120).default('') })
    .nullable()
    .default(null),
  updatedAt: iso,
});
export type Annotation = z.infer<typeof AnnotationSchema>;

export const ARSENAL_STATUSES = ['interested', 'evaluating', 'using', 'practicing', 'mastered', 'rejected', 'archived'] as const;
export const ArsenalStatusSchema = z.enum(ARSENAL_STATUSES);
export type ArsenalStatus = z.infer<typeof ArsenalStatusSchema>;

export const ArsenalSchema = z.object({
  entryId: z.string().min(1),
  status: ArsenalStatusSchema,
  /** User-declared flags. None of these is verified by the app. */
  inspected: z.boolean().default(false),
  approved: z.boolean().default(false),
  declaredInstalled: z.boolean().default(false),
  observedUsefulness: z.number().int().min(1).max(5).nullable().default(null),
  rejectionReason: z.string().max(2000).default(''),
  securityConcerns: z.string().max(2000).default(''),
  nextPractice: z.string().max(1000).default(''),
  experimentIds: z.array(z.string()).default([]),
  lastEvaluatedAt: z.string().nullable().default(null),
  addedAt: iso,
  updatedAt: iso,
  history: z.array(z.object({ at: iso, from: z.string().nullable(), to: z.string() })).default([]),
});
export type ArsenalRecord = z.infer<typeof ArsenalSchema>;

export const FieldEvidenceSchema = z.object({
  id: z.string().min(1),
  competencyIds: z.array(z.string()).min(1),
  title: z.string().min(1).max(200),
  project: z.string().max(200).default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(4000),
  outcome: z.string().max(2000).default(''),
  artifactNote: z.string().max(1000).default(''),
  selfReported: z.literal(true).default(true),
  createdAt: iso,
});
export type FieldEvidence = z.infer<typeof FieldEvidenceSchema>;

export const MetaSchema = z.object({ key: z.string().min(1), value: z.unknown() });
export type MetaRecord = z.infer<typeof MetaSchema>;

export { SkillDraftSchema, ExperimentSchema, EvidenceSchema };

/**
 * A taken placement diagnostic. It is a hint about where to start and is stored separately from attempts so it can
 * never raise a competency level. Retaking appends a new record; history is kept.
 */
export const DiagnosticRecordSchema = z.object({
  id: z.string().min(1),
  diagnosticId: z.string().min(1),
  diagnosticVersion: z.number().int().min(1),
  takenAt: z.string(),
  answers: z.record(z.string(), z.unknown()).default({}),
  /** Per-question result as graded at the time. */
  results: z.array(z.object({ itemId: z.string(), concept: z.string(), correct: z.boolean(), answered: z.boolean() })).default([]),
  /** Concepts answered wrongly or not at all (candidates to look at first). */
  gaps: z.array(z.string()).default([]),
  /** Concepts answered correctly (a hint only - one question per concept). */
  solid: z.array(z.string()).default([]),
  /** Misconception ids the learner's wrong answers reflected. */
  misconceptions: z.array(z.string()).default([]),
});
export type DiagnosticRecord = z.infer<typeof DiagnosticRecordSchema>;

/**
 * A recorded run of a standalone practice activity (for example the Opportunity Finder). Activity runs are practice
 * evidence: they feed recommendations and the mastery profile, but never raise a competency level by themselves.
 */
export const ActivityRunSchema = z.object({
  id: z.string().min(1),
  activityId: z.string().min(1),
  activityVersion: z.number().int().min(1),
  takenAt: z.string(),
  answers: z.record(z.string(), z.unknown()).default({}),
  results: z.array(z.object({ itemId: z.string(), concept: z.string(), correct: z.boolean(), score: z.number().min(0).max(1) })).default([]),
  score: z.number().min(0).max(1),
});
export type ActivityRun = z.infer<typeof ActivityRunSchema>;

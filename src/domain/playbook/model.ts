import { z } from 'zod';

/**
 * An AI Workflow Playbook: a documented, repeatable procedure that may involve several tools, Skills and human
 * decisions. Round 3 playbooks are documentation: Forge never executes them. A step is only "verified" when the
 * learner has written down what verified it.
 */
export const STEP_STATUSES = ['planned', 'in-progress', 'done', 'verified'] as const;
export const StepStatusSchema = z.enum(STEP_STATUSES);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const StepLinkSchema = z.object({
  kind: z.enum(['skill', 'catalog', 'text']),
  /** customSkills id, catalog entry id, or null for free text. */
  ref: z.string().max(80).nullable().default(null),
  label: z.string().max(120),
});
export type StepLink = z.infer<typeof StepLinkSchema>;

export const StepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  instruction: z.string().max(2000).default(''),
  links: z.array(StepLinkSchema).max(6).default([]),
  prompt: z.string().max(4000).default(''),
  /** The gate: what must be true, and how you will check it, before the next step. */
  verification: z.string().max(1500).default(''),
  failureHandling: z.string().max(1500).default(''),
  humanApproval: z.boolean().default(false),
  status: StepStatusSchema.default('planned'),
  /** What actually verified the step (only meaningful when status is "verified"). */
  verifiedNote: z.string().max(1500).default(''),
  verifiedAt: z.string().nullable().default(null),
  /** The step's content fingerprint at the moment it was marked verified. If the step changes afterwards the verification no longer applies. */
  verifiedFingerprint: z.string().nullable().default(null),
});
export type Step = z.infer<typeof StepSchema>;

const ContentShape = {
  title: z.string().min(1).max(120),
  goal: z.string().max(1000).default(''),
  prerequisites: z.array(z.string().max(200)).max(20).default([]),
  /** What the workflow needs to start (files, tickets, decisions). */
  inputs: z.array(z.string().max(200)).max(20).default([]),
  /** What it must produce. */
  outputs: z.array(z.string().max(200)).max(20).default([]),
  /** How you will know it is finished, in checkable terms. */
  completionCriteria: z.string().max(1500).default(''),
  steps: z.array(StepSchema).max(40).default([]),
  notes: z.string().max(4000).default(''),
  capabilityIds: z.array(z.string().max(60)).max(12).default([]),
};
export const PlaybookContentSchema = z.object(ContentShape);
export type PlaybookContent = z.infer<typeof PlaybookContentSchema>;

export const ObservedResultSchema = z.object({
  id: z.string().min(1),
  at: z.string(),
  outcome: z.enum(['worked', 'partly', 'failed', 'unknown']),
  /** What happened when you used this playbook on real work (self-reported). */
  text: z.string().max(2000),
});
export type ObservedResult = z.infer<typeof ObservedResultSchema>;

export const PlaybookRevisionSchema = z.object({ id: z.string().min(1), savedAt: z.string(), label: z.string().max(120), snapshot: PlaybookContentSchema });


/**
 * A link between ONE playbook step and ONE AI Lab experiment, with the learner's own review. Linking does not verify
 * anything: a step is only supported when the link is current, the evidence is suitable, explicit criteria are written
 * and the learner has recorded a supporting judgement with a note. Stale links (step or experiment changed since)
 * never count until reassessed.
 */
export const ClaimedOutcomeSchema = z.enum(['met', 'partly-met', 'not-met', 'inconclusive']);
export const ReviewStatusSchema = z.enum(['unreviewed', 'supports', 'partially-supports', 'contradicts', 'inconclusive']);
export const EvidenceProvenanceSchema = z.enum(['self-reported', 'user-imported', 'mixed', 'unknown']);

export const ExperimentSnapshotSchema = z.object({
  experimentTitle: z.string().max(200),
  experimentType: z.string().max(40),
  experimentStatus: z.string().max(20),
  experimentUpdatedAt: z.string(),
  synthetic: z.boolean(),
  fixture: z.object({ id: z.string().max(80), label: z.string().max(200), version: z.string().max(40).default(''), hash: z.string().max(100).nullable().default(null) }),
  /** Hash of everything in the experiment that can change what it shows (conditions and runs). Used to detect later edits. */
  runsFingerprint: z.string().max(40),
  conditions: z.array(z.object({ id: z.string(), label: z.string().max(40), kind: z.string().max(30), runs: z.number().int().min(0), runsWithData: z.number().int().min(0) })).max(6),
  hasBaseline: z.boolean(),
  sufficiency: z.enum(['none', 'anecdotal', 'weak', 'limited']),
  /** Descriptive per-measure figures at the time of linking. Unknown stays null. */
  measures: z.array(z.object({ id: z.string().max(40), label: z.string().max(120), perCondition: z.array(z.object({ label: z.string().max(40), n: z.number().int().min(0), unknown: z.number().int().min(0), mean: z.number().nullable(), min: z.number().nullable(), max: z.number().nullable() })).max(6) })).max(12),
});
export type ExperimentSnapshot = z.infer<typeof ExperimentSnapshotSchema>;

export const ReviewRecordSchema = z.object({
  at: z.string(),
  claimedOutcome: ClaimedOutcomeSchema,
  status: ReviewStatusSchema,
  note: z.string().max(2000).default(''),
  criteria: z.string().max(1500).default(''),
  stepFingerprint: z.string().max(40),
  runsFingerprint: z.string().max(40),
});
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

export const EvidenceLinkSchema = z.object({
  id: z.string().min(1),
  playbookId: z.string().min(1),
  stepId: z.string().min(1),
  experimentId: z.string().min(1),
  linkedAt: z.string(),
  /** The playbook content version when the link was made or last reassessed. */
  playbookContentVersion: z.number().int().min(1),
  stepFingerprint: z.string().max(40),
  snapshot: ExperimentSnapshotSchema,
  provenance: EvidenceProvenanceSchema,
  /** What would have to be true for this evidence to count as meeting the step's gate. Written BEFORE judging. */
  criteria: z.string().max(1500).default(''),
  claimedOutcome: ClaimedOutcomeSchema.default('inconclusive'),
  status: ReviewStatusSchema.default('unreviewed'),
  reviewerNote: z.string().max(2000).default(''),
  limitations: z.string().max(2000).default(''),
  reviewedAt: z.string().nullable().default(null),
  /** Earlier reviews, kept when a link is reassessed after the step or experiment changed. */
  history: z.array(ReviewRecordSchema).max(10).default([]),
});
export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;

export const MATURITY_STATES = ['draft', 'ready-to-test', 'partially-evaluated', 'evaluated-on-fixtures', 'applied-to-real-work'] as const;
export const MaturitySchema = z.enum(MATURITY_STATES);
export type Maturity = z.infer<typeof MaturitySchema>;

/** A saved, versioned evaluation summary. It records what the evidence showed AT THAT PLAYBOOK VERSION; it never updates itself. */
export const PlaybookEvaluationSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  label: z.string().max(120).default(''),
  playbookContentVersion: z.number().int().min(1),
  maturity: MaturitySchema,
  steps: z.array(z.object({
    stepId: z.string(),
    title: z.string().max(120),
    state: z.string().max(40),
    links: z.number().int().min(0),
    currentSupporting: z.number().int().min(0),
    note: z.string().max(500).default(''),
  })).max(40),
  limitations: z.array(z.string().max(500)).max(40),
  markdown: z.string().max(60_000),
});
export type PlaybookEvaluation = z.infer<typeof PlaybookEvaluationSchema>;

export const PlaybookSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1).default(1),
  ...ContentShape,
  origin: z.object({ kind: z.enum(['blank', 'template', 'imported', 'duplicate']), templateId: z.string().max(80).nullable().default(null) }).default({ kind: 'blank', templateId: null }),
  revisions: z.array(PlaybookRevisionSchema).max(30).default([]),
  /** Increases whenever the playbook's content changes (not when evidence or reviews change). Evidence records the version it was linked at. */
  contentVersion: z.number().int().min(1).default(1),
  evidenceLinks: z.array(EvidenceLinkSchema).max(200).default([]),
  evaluations: z.array(PlaybookEvaluationSchema).max(20).default([]),
  observedResults: z.array(ObservedResultSchema).max(50).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Playbook = z.infer<typeof PlaybookSchema>;

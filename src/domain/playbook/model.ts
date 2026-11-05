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

export const PlaybookSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1).default(1),
  ...ContentShape,
  origin: z.object({ kind: z.enum(['blank', 'template', 'imported', 'duplicate']), templateId: z.string().max(80).nullable().default(null) }).default({ kind: 'blank', templateId: null }),
  revisions: z.array(PlaybookRevisionSchema).max(30).default([]),
  observedResults: z.array(ObservedResultSchema).max(50).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Playbook = z.infer<typeof PlaybookSchema>;

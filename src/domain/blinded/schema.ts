import { z } from 'zod';

/**
 * A blinded review of outputs from two or more conditions of ONE experiment. It lives inside the experiment record (no
 * separate database) and follows a one-way state machine:
 *   setup -> scoring -> locked -> revealed
 * Identities are mapped to each output at creation, but the interface never shows them before `revealed`. They are stored on
 * this device, so the hiding is a discipline of the interface, not a security boundary: the owner of the browser could look.
 */
export const BLIND_STATES = ['setup', 'scoring', 'locked', 'revealed'] as const;
export const BlindStateSchema = z.enum(BLIND_STATES);

export const RubricCriterionSchema = z.object({
  /** Room for ids made by newId() (a prefix plus a UUID). */
  id: z.string().min(1).max(80),
  label: z.string().min(2).max(80),
  /** What a 0, 1, 2 and 3 look like, written before any output is shown. */
  anchors: z.tuple([z.string().max(300), z.string().max(300), z.string().max(300), z.string().max(300)]),
  custom: z.boolean().default(false),
});
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const BlindItemSchema = z.object({
  /** The anonymous label the learner sees, such as "Output 3". */
  key: z.string().min(1).max(20),
  /** Position in the shuffled presentation order (0-based). */
  order: z.number().int().min(0),
  runId: z.string().min(1).max(100),
  conditionId: z.string().min(1).max(100),
  evidenceId: z.string().max(100).nullable().default(null),
  /** The original output text, snapshotted when the review was set up. The evidence record itself is never changed. */
  text: z.string().max(600_000),
  /** Words that would reveal the source (a condition label, Skill name or version). */
  leakTerms: z.array(z.string().max(120)).max(20).default([]),
});
export type BlindItem = z.infer<typeof BlindItemSchema>;

export const BlindedReviewSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(160).default(''),
  state: BlindStateSchema.default('setup'),
  /** Hex seed used for the shuffle, kept so the order is reproducible when the review is reopened. */
  seed: z.string().max(40),
  rubric: z.object({ criteria: z.array(RubricCriterionSchema).min(1).max(8), lockedAt: z.string().nullable().default(null) }),
  items: z.array(BlindItemSchema).max(60).default([]),
  /** Show leak terms as ▮▮▮ in the text the learner reads. Display only: the stored text is untouched. */
  maskLeaks: z.boolean().default(true),
  scores: z.record(z.string(), z.record(z.string(), z.number().int().min(0).max(3).nullable())).default({}),
  reasoning: z.record(z.string(), z.string().max(2000)).default({}),
  /** The learner's guess of the source condition, recorded after locking and before the reveal. */
  guesses: z.record(z.string(), z.string().max(100)).default({}),
  blindingNote: z.string().max(1000).default(''),
  /** Documented departures from clean blinding (leaks that were masked, length differences, ...). */
  exceptions: z.array(z.string().max(300)).max(20).default([]),
  startedAt: z.string().nullable().default(null),
  lockedAt: z.string().nullable().default(null),
  revealedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BlindedReview = z.infer<typeof BlindedReviewSchema>;

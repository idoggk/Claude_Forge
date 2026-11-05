import { z } from 'zod';

export const LoopStatusSchema = z.enum(['active', 'graduated', 'abandoned']);

export const LoopRunSchema = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  missionVersion: z.number().int().min(1),
  status: LoopStatusSchema.default('active'),
  /** The Workshop draft being improved. */
  skillId: z.string().nullable().default(null),
  devExperimentId: z.string().min(1),
  heldoutExperimentId: z.string().nullable().default(null),
  conditionIds: z
    .object({ baseline: z.string(), v1: z.string().nullable().default(null), v2: z.string().nullable().default(null) })
    .default({ baseline: '', v1: null, v2: null }),
  heldoutConditionIds: z.object({ v1: z.string().nullable().default(null), v2: z.string().nullable().default(null) }).default({ v1: null, v2: null }),
  /** Frozen snapshot of the Skill at the end of Build. The baseline for the improvement. */
  v1: z.object({ revisionId: z.string(), label: z.string(), frozenAt: z.string() }).nullable().default(null),
  improvement: z
    .object({
      patternIds: z.array(z.string()).min(1),
      hypothesis: z.string().min(10),
      expectedChange: z.string().min(5),
      v2RevisionId: z.string(),
      v2Label: z.string(),
      savedAt: z.string(),
    })
    .nullable()
    .default(null),
  devGradedAt: z.string().nullable().default(null),
  heldoutRevealedAt: z.string().nullable().default(null),
  reflection: z.object({ lessons: z.string().max(4000).default(''), application: z.string().max(4000).default(''), updatedAt: z.string().nullable().default(null) }).default({ lessons: '', application: '', updatedAt: null }),
  graduatedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LoopRun = z.infer<typeof LoopRunSchema>;

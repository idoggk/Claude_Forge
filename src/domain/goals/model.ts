import { z } from 'zod';

/**
 * A personal learning goal tied to capabilities in the capability map. Goals steer recommendations; they never
 * count as evidence of skill. "Achieved" is something the learner declares, with a note, not something Forge awards.
 */
export const GoalStatusSchema = z.enum(['active', 'achieved', 'archived']);

export const LearningGoalSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1).default(1),
  title: z.string().min(1).max(120),
  why: z.string().max(500).default(''),
  capabilityIds: z.array(z.string().min(1).max(60)).min(1).max(6),
  status: GoalStatusSchema.default('active'),
  /** What you did with this capability in a real project, in your words (self-reported). */
  achievedNote: z.string().max(1000).default(''),
  achievedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LearningGoal = z.infer<typeof LearningGoalSchema>;
export const MAX_ACTIVE_GOALS = 5;

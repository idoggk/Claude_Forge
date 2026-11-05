import { z } from 'zod';

export const InvocationSchema = z.enum(['auto-and-manual', 'manual-only', 'auto-only']);
export type Invocation = z.infer<typeof InvocationSchema>;

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().max(600),
  /** What the AUTHOR intends: should a good description make Claude load this Skill for this request? */
  expected: z.enum(['activate', 'not-activate', 'ambiguous']),
  note: z.string().max(600).default(''),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const LiveTestSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().nullable(),
  prompt: z.string().max(600),
  testedAt: z.string(),
  claudeCodeVersion: z.string().max(60).default(''),
  /** User-entered observation from a real Claude Code session. Never produced by this app. */
  observed: z.enum(['activated', 'not-activated', 'partial', 'unknown']),
  /** Short fingerprint of the description + when_to_use that was live when this was recorded ('' = recorded before this field existed). */
  descriptionFingerprint: z.string().max(16).default(''),
  notes: z.string().max(2000).default(''),
});
export type LiveTest = z.infer<typeof LiveTestSchema>;

export const ResourceSchema = z.object({
  path: z.string().max(200),
  content: z.string().max(200_000),
});
export type Resource = z.infer<typeof ResourceSchema>;

export const SkillContentSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(5000),
  whenToUse: z.string().max(3000).default(''),
  instructions: z.string().max(200_000),
  invocation: InvocationSchema.default('auto-and-manual'),
  allowedTools: z.string().max(500).default(''),
  argumentHint: z.string().max(200).default(''),
  context: z.enum(['', 'fork']).default(''),
  agent: z.string().max(100).default(''),
  model: z.string().max(100).default(''),
  paths: z.string().max(500).default(''),
  license: z.string().max(100).default(''),
  compatibility: z.string().max(1000).default(''),
  metadata: z.array(z.object({ key: z.string().max(100), value: z.string().max(500) })).max(30).default([]),
  useCases: z.array(z.string().max(400)).max(30).default([]),
  nonUseCases: z.array(z.string().max(400)).max(30).default([]),
  references: z.array(ResourceSchema).max(30).default([]),
  scenarios: z.array(ScenarioSchema).max(60).default([]),
});
export type SkillContent = z.infer<typeof SkillContentSchema>;

export const RevisionSchema = z.object({
  id: z.string().min(1),
  savedAt: z.string(),
  label: z.string().max(120),
  snapshot: SkillContentSchema,
});
export type Revision = z.infer<typeof RevisionSchema>;

export const SkillDraftSchema = SkillContentSchema.extend({
  id: z.string().min(1),
  liveTests: z.array(LiveTestSchema).max(200).default([]),
  revisions: z.array(RevisionSchema).max(50).default([]),
  /** Set when the user exports a ZIP, so lessons can verify "authoring and export". */
  lastExportedAt: z.string().nullable().default(null),
  lastExportedName: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SkillDraft = z.infer<typeof SkillDraftSchema>;

export function emptyContent(): SkillContent {
  return SkillContentSchema.parse({ name: '', description: '', instructions: '' });
}

export function contentOf(d: SkillDraft | SkillContent): SkillContent {
  return SkillContentSchema.parse({
    name: d.name,
    description: d.description,
    whenToUse: d.whenToUse,
    instructions: d.instructions,
    invocation: d.invocation,
    allowedTools: d.allowedTools,
    argumentHint: d.argumentHint,
    context: d.context,
    agent: d.agent,
    model: d.model,
    paths: d.paths,
    license: d.license,
    compatibility: d.compatibility,
    metadata: d.metadata,
    useCases: d.useCases,
    nonUseCases: d.nonUseCases,
    references: d.references,
    scenarios: d.scenarios,
  });
}

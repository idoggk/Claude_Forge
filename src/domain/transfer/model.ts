import { z } from 'zod';

/**
 * A transfer task: taking something learned (a lesson, a Skill, a playbook) to REAL work, with a plan, verification
 * criteria, your observations and your reflection. It is a record you write. Forge never reads your project, never
 * runs anything, and never marks a task complete because a plan exists: completion needs observations, evidence and a
 * reflection, all in your own words.
 */
export const TRANSFER_KINDS = ['prompt-technique', 'skill', 'automation', 'agent-workflow', 'research-procedure', 'game-dev-workflow', 'other'] as const;
export const TransferKindSchema = z.enum(TRANSFER_KINDS);
export type TransferKind = z.infer<typeof TransferKindSchema>;
export const TRANSFER_KIND_LABELS: Record<TransferKind, string> = {
  'prompt-technique': 'A prompt engineering technique',
  skill: 'A Skill',
  automation: 'An automation',
  'agent-workflow': 'An agent workflow',
  'research-procedure': 'A research procedure',
  'game-dev-workflow': 'A game-development workflow',
  other: 'Something else',
};

export const TransferSourceSchema = z.object({
  kind: z.enum(['lesson', 'skill', 'playbook', 'none']).default('none'),
  /** Lesson id, custom Skill id or playbook id. */
  id: z.string().max(80).nullable().default(null),
  label: z.string().max(200).default(''),
});

export const TransferEvidenceSchema = z.object({
  id: z.string().min(1),
  at: z.string(),
  text: z.string().min(1).max(2000),
  /** Where it came from, as you describe it (a commit, a PR, a measurement, a screenshot you keep elsewhere). Not uploaded. */
  provenance: z.enum(['self-reported', 'user-imported', 'file-note']).default('self-reported'),
});
export type TransferEvidence = z.infer<typeof TransferEvidenceSchema>;

export const TRANSFER_STATUSES = ['planned', 'in-progress', 'completed', 'abandoned'] as const;

export const TransferTaskSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1).default(1),
  title: z.string().min(1).max(160),
  kind: TransferKindSchema.default('other'),
  source: TransferSourceSchema.default({ kind: 'none', id: null, label: '' }),
  targetProject: z.string().max(200).default(''),
  problem: z.string().max(3000).default(''),
  currentWorkflow: z.string().max(3000).default(''),
  proposedWorkflow: z.string().max(3000).default(''),
  expectedBenefit: z.string().max(2000).default(''),
  verificationCriteria: z.string().max(2000).default(''),
  risks: z.string().max(2000).default(''),
  observations: z.string().max(6000).default(''),
  evidence: z.array(TransferEvidenceSchema).max(50).default([]),
  reflection: z.string().max(4000).default(''),
  nextImprovement: z.string().max(2000).default(''),
  status: z.enum(TRANSFER_STATUSES).default('planned'),
  completedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TransferTask = z.infer<typeof TransferTaskSchema>;

/** What must exist before a task may be marked complete. A generated or written plan alone is never enough. */
export function completionProblems(t: TransferTask): string[] {
  const p: string[] = [];
  if (t.verificationCriteria.trim().length < 15) p.push('Write the verification criteria: how would you know it worked?');
  if (t.observations.trim().length < 30) p.push('Record what actually happened when you tried it (at least a couple of sentences).');
  if (t.evidence.length < 1) p.push('Add at least one piece of evidence (a commit, a measurement, a before/after note).');
  if (t.reflection.trim().length < 30) p.push('Write a reflection: what you learned and what you would change.');
  return p;
}

export function newTransferTask(id: string, now: string, init: Partial<Pick<TransferTask, 'title' | 'kind' | 'source' | 'problem' | 'proposedWorkflow'>> = {}): TransferTask {
  return TransferTaskSchema.parse({ id, title: init.title?.trim() || 'Untitled transfer task', kind: init.kind, source: init.source, problem: init.problem, proposedWorkflow: init.proposedWorkflow, createdAt: now, updatedAt: now });
}

export function transferTaskToMarkdown(t: TransferTask, now = new Date().toISOString()): string {
  const L: string[] = [];
  L.push(`# Transfer task: ${t.title}`, '');
  L.push(`> Written by the learner in Claude Forge on ${t.updatedAt.slice(0, 10)}; exported ${now.slice(0, 10)}. Claude Forge did not read the target project, run anything, or verify any statement below. Evidence entries are the author's own descriptions.`, '');
  L.push(`- **Status:** ${t.status}${t.completedAt ? ` (completed ${t.completedAt.slice(0, 10)}, self-declared)` : ''}`);
  L.push(`- **Applying:** ${TRANSFER_KIND_LABELS[t.kind]}${t.source.label ? ` - from ${t.source.kind}: ${t.source.label}` : ''}`);
  L.push(`- **Target project:** ${t.targetProject || '_not stated_'}`, '');
  const sec = (h: string, v: string) => { L.push(`## ${h}`, '', v.trim() || '_not written_', ''); };
  sec('Problem', t.problem);
  sec('Current workflow', t.currentWorkflow);
  sec('Proposed improved workflow', t.proposedWorkflow);
  sec('Expected benefit', t.expectedBenefit);
  sec('Verification criteria', t.verificationCriteria);
  sec('Risks', t.risks);
  sec('Observations', t.observations);
  L.push('## Evidence (author-described)', '');
  if (t.evidence.length) t.evidence.forEach((e) => L.push(`- ${e.at.slice(0, 10)} [${e.provenance}] ${e.text.replace(/\r?\n/g, ' ')}`));
  else L.push('_none recorded_');
  L.push('');
  sec('Reflection', t.reflection);
  sec('Next improvement', t.nextImprovement);
  return L.join('\n');
}

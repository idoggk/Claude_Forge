import { z } from 'zod';

/**
 * A takeaway: one thing you learned about working with AI, with the evidence behind it and an honest label for how
 * far that evidence goes. The label is never raised automatically. You raise it yourself, and Forge refuses unless
 * the references on the takeaway can plausibly support the new level.
 */
export const CONFIDENCE_LEVELS = ['hypothesis', 'anecdotal', 'evaluated-on-fixtures', 'applied-to-real-work'] as const;
export const ConfidenceSchema = z.enum(CONFIDENCE_LEVELS);
export type Confidence = z.infer<typeof ConfidenceSchema>;
export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  hypothesis: 'Hypothesis',
  anecdotal: 'Anecdotal',
  'evaluated-on-fixtures': 'Evaluated on fixtures',
  'applied-to-real-work': 'Applied to real work',
};
export const CONFIDENCE_MEANING: Record<Confidence, string> = {
  hypothesis: 'An idea or something you read. No test of your own yet.',
  anecdotal: 'You saw it happen once or twice in your own work. Not measured.',
  'evaluated-on-fixtures': 'Tested on a fixed set of cases (a Lab experiment or a challenge). The cases may not look like your real work.',
  'applied-to-real-work': 'Used on a real task of yours and written up as a completed transfer task.',
};

export const REFERENCE_KINDS = ['playbook', 'lab-report', 'goal', 'arsenal', 'competency', 'lesson', 'challenge', 'transfer'] as const;
export const ReferenceKindSchema = z.enum(REFERENCE_KINDS);
export type ReferenceKind = z.infer<typeof ReferenceKindSchema>;
export const REFERENCE_LABELS: Record<ReferenceKind, string> = {
  playbook: 'Playbook',
  'lab-report': 'Lab report (experiment)',
  goal: 'Learning goal',
  arsenal: 'Arsenal entry',
  competency: 'Growth: competency',
  lesson: 'Lesson',
  challenge: 'Challenge',
  transfer: 'Transfer task',
};

export const ReferenceSchema = z.object({ kind: ReferenceKindSchema, id: z.string().min(1).max(120), label: z.string().max(200).default('') });
export type Reference = z.infer<typeof ReferenceSchema>;

export const ConfidenceChangeSchema = z.object({ at: z.string(), from: ConfidenceSchema.nullable(), to: ConfidenceSchema, note: z.string().max(600).default('') });

export const TakeawaySchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1).default(1),
  title: z.string().min(1).max(160),
  statement: z.string().min(1).max(1500),
  confidence: ConfidenceSchema.default('hypothesis'),
  /** Why this confidence level, in your words. Required above "hypothesis". */
  confidenceNote: z.string().max(600).default(''),
  references: z.array(ReferenceSchema).max(30).default([]),
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
  history: z.array(ConfidenceChangeSchema).max(50).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Takeaway = z.infer<typeof TakeawaySchema>;

/** What the references must be able to show for a level. Lookups are passed in so this stays pure. */
export interface EvidenceContext { completedTransferIds: ReadonlySet<string>; experimentIds: ReadonlySet<string>; challengeIds: ReadonlySet<string> }

export function confidenceProblems(t: Pick<Takeaway, 'confidence' | 'confidenceNote' | 'references'>, ctx: EvidenceContext): string[] {
  const out: string[] = [];
  const level = t.confidence;
  if (level !== 'hypothesis' && t.confidenceNote.trim().length < 10) out.push('Say in your own words why this level is right (at least a sentence).');
  if (level === 'evaluated-on-fixtures') {
    const ok = t.references.some((r) => (r.kind === 'lab-report' && ctx.experimentIds.has(r.id)) || (r.kind === 'challenge' && ctx.challengeIds.has(r.id)));
    if (!ok) out.push('Evaluated on fixtures needs a reference to a Lab report or a challenge that exists.');
  }
  if (level === 'applied-to-real-work') {
    const ok = t.references.some((r) => r.kind === 'transfer' && ctx.completedTransferIds.has(r.id));
    if (!ok) out.push('Applied to real work needs a reference to a transfer task you have completed.');
  }
  return out;
}

/** The levels that this takeaway could honestly be raised to right now. Informational only. */
export function reachableLevels(t: Pick<Takeaway, 'confidenceNote' | 'references'>, ctx: EvidenceContext): Confidence[] {
  return CONFIDENCE_LEVELS.filter((level) => confidenceProblems({ ...t, confidence: level, confidenceNote: level === 'hypothesis' ? '' : 'x'.repeat(10) }, ctx).length === 0);
}

export function emptyTakeaway(id: string, now: string): Takeaway {
  return { id, schemaVersion: 1, title: '', statement: '', confidence: 'hypothesis', confidenceNote: '', references: [], tags: [], history: [{ at: now, from: null, to: 'hypothesis', note: 'Created' }], createdAt: now, updatedAt: now };
}

const HEADER = 'Takeaways exported from Claude Forge. Each one carries the confidence level its author gave it and the references behind it. A label is the author\'s own claim, supported only as far as its references go; nothing here was verified by Forge.';

export function takeawaysMarkdown(items: Takeaway[]): string {
  const lines = ['# My AI takeaways', '', `> ${HEADER}`, ''];
  const order = [...CONFIDENCE_LEVELS].reverse();
  for (const level of order) {
    const mine = items.filter((t) => t.confidence === level);
    if (!mine.length) continue;
    lines.push(`## ${CONFIDENCE_LABELS[level]} (${mine.length})`, '', `_${CONFIDENCE_MEANING[level]}_`, '');
    for (const t of mine) {
      lines.push(`### ${t.title}`, '', t.statement, '');
      if (t.confidenceNote) lines.push(`**Why this level:** ${t.confidenceNote}`, '');
      if (t.references.length) { lines.push('**References:**'); for (const r of t.references) lines.push(`- ${REFERENCE_LABELS[r.kind]}: ${r.label || r.id}`); lines.push(''); }
      if (t.tags.length) lines.push(`Tags: ${t.tags.join(', ')}`, '');
    }
  }
  if (!items.length) lines.push('_No takeaways yet._', '');
  return lines.join('\n');
}

export function takeawaysJson(items: Takeaway[], exportedAt: string): string {
  return JSON.stringify({ format: 'claude-forge-takeaways', version: 1, exportedAt, notice: HEADER, takeaways: items }, null, 2);
}

/** Where a reference leads in the app. Every kind resolves to a page that exists. */
export function referenceHref(r: Pick<Reference, 'kind' | 'id'>): string {
  const id = encodeURIComponent(r.id);
  switch (r.kind) {
    case 'playbook': return `/playbooks/${id}`;
    case 'lab-report': return `/battle-lab/${id}`;
    case 'goal': return '/explore';
    case 'arsenal': return '/arsenal';
    case 'competency': return '/growth';
    case 'lesson': return `/academy/lesson/${id}`;
    case 'challenge': return `/challenges/${id}`;
    case 'transfer': return `/transfer/${id}`;
  }
}

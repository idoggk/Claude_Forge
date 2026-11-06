import { PlaybookContentSchema, PlaybookSchema, type Playbook, type PlaybookContent, type Step } from './model';
import { evaluatePlaybook } from '@/domain/assessment/external';

export const PLAYBOOK_FORMAT = 'claude-forge-playbook';
export const PLAYBOOK_FORMAT_VERSION = 1;

const nowIso = () => new Date().toISOString();

export function blankStep(id: string): Step {
  return { id, title: 'New step', instruction: '', links: [], prompt: '', verification: '', failureHandling: '', humanApproval: false, status: 'planned', verifiedNote: '', verifiedAt: null, verifiedFingerprint: null };
}

export function newPlaybook(id: string, content?: Partial<PlaybookContent>, origin: Playbook['origin'] = { kind: 'blank', templateId: null }, now = nowIso()): Playbook {
  return PlaybookSchema.parse({
    id,
    title: 'Untitled playbook',
    ...content,
    origin,
    revisions: [],
    observedResults: [],
    createdAt: now,
    updatedAt: now,
  });
}

/** Copy a template into a playbook the learner owns. Every step starts "planned": a seeded design is not verified work. */
export function fromTemplate(id: string, t: PlaybookContent & { templateId: string }, newStepId: () => string, now = nowIso()): Playbook {
  const { templateId, ...content } = t as PlaybookContent & { templateId: string; description?: string; area?: string };
  const clean = PlaybookContentSchema.parse({
    ...content,
    steps: content.steps.map((s) => ({ ...s, id: newStepId(), status: 'planned', verifiedNote: '', verifiedAt: null, verifiedFingerprint: null })),
  });
  return newPlaybook(id, clean, { kind: 'template', templateId }, now);
}

export function duplicatePlaybook(source: Playbook, id: string, newStepId: () => string, now = nowIso()): Playbook {
  const content = PlaybookContentSchema.parse({
    ...source,
    title: `${source.title} (copy)`.slice(0, 120),
    steps: source.steps.map((s) => ({ ...s, id: newStepId(), status: 'planned', verifiedNote: '', verifiedAt: null, verifiedFingerprint: null })),
  });
  return newPlaybook(id, content, { kind: 'duplicate', templateId: source.origin.templateId }, now);
}

/**
 * A step can only be "verified" with a note saying what verified it. Returns the first problem, or null.
 */
export function stepProblem(s: Step): string | null {
  if (s.status === 'verified' && s.verifiedNote.trim().length < 10) return `Step "${s.title}": to mark a step verified, write what verified it (at least a sentence).`;
  return null;
}

export function playbookProblems(p: Playbook): string[] {
  const out: string[] = [];
  if (!p.title.trim()) out.push('Give the playbook a title.');
  for (const s of p.steps) {
    const m = stepProblem(s);
    if (m) out.push(m);
  }
  return out;
}

export function counts(p: Pick<Playbook, 'steps'>): { planned: number; inProgress: number; done: number; verified: number; total: number } {
  const c = { planned: 0, inProgress: 0, done: 0, verified: 0, total: p.steps.length };
  for (const s of p.steps) {
    if (s.status === 'planned') c.planned++;
    else if (s.status === 'in-progress') c.inProgress++;
    else if (s.status === 'done') c.done++;
    else c.verified++;
  }
  return c;
}

/** The same reliability checklist the lesson uses, shown while editing. */
export function reliabilityChecklist(p: Playbook) {
  return evaluatePlaybook([p]);
}

/* --------------------------------------------- export --------------------------------------------- */

export function exportPlaybookJson(p: Playbook, now = nowIso()): string {
  return (
    JSON.stringify(
      {
        format: PLAYBOOK_FORMAT,
        version: PLAYBOOK_FORMAT_VERSION,
        exportedAt: now,
        notice: 'A workflow DESIGN written in Claude Forge. Claude Forge never runs it. Step statuses are the author\'s own declarations.',
        playbook: p,
      },
      null,
      2,
    ) + '\n'
  );
}

const cell = (s: string) => s.replace(/\r?\n/g, ' ');

export function exportPlaybookMarkdown(p: Playbook, now = nowIso()): string {
  const L: string[] = [];
  L.push(`# ${p.title}`, '');
  L.push(`> A workflow design written in Claude Forge on ${p.updatedAt.slice(0, 10)}; exported ${now.slice(0, 10)}. It was not executed by Claude Forge. Step statuses are the author's own declarations.`, '');
  L.push('## Goal', '', p.goal || '_not stated_', '');
  const list = (title: string, xs: string[]) => { L.push(`## ${title}`, ''); if (xs.length) xs.forEach((x) => L.push(`- ${x}`)); else L.push('_none_'); L.push(''); };
  list('Prerequisites', p.prerequisites);
  list('Inputs', p.inputs);
  list('Outputs', p.outputs);
  L.push('## Completion criteria', '', p.completionCriteria || '_not stated_', '');
  L.push('## Steps', '');
  p.steps.forEach((s, i) => {
    L.push(`### ${i + 1}. ${s.title}${s.humanApproval ? ' (human approval)' : ''}`, '');
    L.push(`- **Status:** ${s.status}${s.status === 'verified' ? ` - ${cell(s.verifiedNote)}` : ''}`);
    if (s.instruction) L.push(`- **What happens:** ${cell(s.instruction)}`);
    L.push(`- **Verification gate:** ${s.verification ? cell(s.verification) : '_none defined_'}`);
    L.push(`- **If it fails:** ${s.failureHandling ? cell(s.failureHandling) : '_not defined_'}`);
    if (s.links.length) L.push(`- **Uses:** ${s.links.map((l) => l.label).join(', ')}`);
    if (s.prompt) L.push('', '```text', s.prompt, '```');
    L.push('');
  });
  if (p.notes) L.push('## Notes', '', p.notes, '');
  if (p.observedResults.length) {
    L.push('## Observed results (self-reported)', '');
    p.observedResults.forEach((r) => L.push(`- ${r.at.slice(0, 10)} - ${r.outcome}: ${cell(r.text)}`));
    L.push('');
  }
  return L.join('\n');
}

/* --------------------------------------------- import --------------------------------------------- */

export type PlaybookImport = { ok: true; playbook: Playbook; warnings: string[] } | { ok: false; error: string };

/**
 * Validate an exported playbook. Imported work is NOT the importer's verified work: statuses are reset to "planned",
 * observed results and version history are dropped, and the origin is recorded as imported.
 */
export function parsePlaybookJson(text: string, newId: string, newStepId: () => string, now = nowIso()): PlaybookImport {
  if (text.length > 1_000_000) return { ok: false, error: 'That file is larger than a playbook should be.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Unexpected file contents.' };
  const r = raw as Record<string, unknown>;
  if (r.format !== PLAYBOOK_FORMAT) return { ok: false, error: 'That is not a Claude Forge playbook export.' };
  if (typeof r.version !== 'number' || r.version > PLAYBOOK_FORMAT_VERSION) return { ok: false, error: 'That playbook comes from a newer version of Claude Forge.' };
  const parsed = PlaybookContentSchema.safeParse(r.playbook);
  if (!parsed.success) return { ok: false, error: `The playbook failed validation: ${parsed.error.issues[0]?.path.join('.') || 'content'} - ${parsed.error.issues[0]?.message ?? 'invalid'}.` };
  const warnings: string[] = [];
  const claimed = parsed.data.steps.filter((s) => s.status === 'verified' || s.status === 'done').length;
  if (claimed > 0) warnings.push(`${claimed} step(s) were marked done or verified by the author. They are reset to "planned": that work is not yours until you do it.`);
  const content = { ...parsed.data, steps: parsed.data.steps.map((s) => ({ ...s, id: newStepId(), status: 'planned' as const, verifiedNote: '', verifiedAt: null, verifiedFingerprint: null })) };
  return { ok: true, playbook: newPlaybook(newId, content, { kind: 'imported', templateId: null }, now), warnings };
}

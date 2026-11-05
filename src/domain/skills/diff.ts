import type { SkillContent } from './model';
import { generateSkillMd } from './generate';
import { frontmatterObject } from './generate';

/** Line-based diff (longest common subsequence). Inputs are bounded by SKILL.md limits, so O(n*m) is fine. */
export interface DiffLine {
  kind: 'same' | 'add' | 'remove';
  text: string;
  /** 1-based line numbers in the old / new text (null where the line does not exist). */
  oldLine: number | null;
  newLine: number | null;
}

const MAX_DIFF_LINES = 4000;

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.replace(/\r\n?/g, '\n').split('\n').slice(0, MAX_DIFF_LINES);
  const b = newText.replace(/\r\n?/g, '\n').split('\n').slice(0, MAX_DIFF_LINES);
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i]!, oldLine: i + 1, newLine: j + 1 }); i++; j++; }
    else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) { out.push({ kind: 'remove', text: a[i]!, oldLine: i + 1, newLine: null }); i++; }
    else { out.push({ kind: 'add', text: b[j]!, oldLine: null, newLine: j + 1 }); j++; }
  }
  while (i < n) { out.push({ kind: 'remove', text: a[i]!, oldLine: i + 1, newLine: null }); i++; }
  while (j < m) { out.push({ kind: 'add', text: b[j]!, oldLine: null, newLine: j + 1 }); j++; }
  return out;
}

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export interface ResourceChange {
  path: string;
  change: 'added' | 'removed' | 'modified';
}

export interface SkillDiff {
  identical: boolean;
  /** Frontmatter fields whose generated value changed (name, description, allowed-tools, ...). */
  metadata: FieldChange[];
  /** Specifically the trigger text: description + when_to_use. */
  triggerChanged: boolean;
  /** Diff of the instruction body only (frontmatter excluded). */
  body: DiffLine[];
  bodyAdded: number;
  bodyRemoved: number;
  resources: ResourceChange[];
  scenarios: { added: number; removed: number };
}

const show = (v: unknown): string => (v === undefined || v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v));

function bodyOf(md: string): string {
  const m = /^---\n[\s\S]*?\n---\n\n?/.exec(md);
  return m ? md.slice(m[0].length) : md;
}

export function diffSkills(before: SkillContent, after: SkillContent): SkillDiff {
  const fa = frontmatterObject(before);
  const fb = frontmatterObject(after);
  const keys = [...new Set([...Object.keys(fa), ...Object.keys(fb)])];
  const metadata: FieldChange[] = keys.filter((k) => show(fa[k]) !== show(fb[k])).map((k) => ({ field: k, before: show(fa[k]), after: show(fb[k]) }));
  const body = diffLines(bodyOf(generateSkillMd(before)), bodyOf(generateSkillMd(after)));
  const ra = new Map(before.references.map((r) => [r.path, r.content]));
  const rb = new Map(after.references.map((r) => [r.path, r.content]));
  const resources: ResourceChange[] = [];
  for (const [p, c] of rb) {
    if (!ra.has(p)) resources.push({ path: p, change: 'added' });
    else if (ra.get(p) !== c) resources.push({ path: p, change: 'modified' });
  }
  for (const p of ra.keys()) if (!rb.has(p)) resources.push({ path: p, change: 'removed' });
  const sa = new Set(before.scenarios.map((s) => `${s.expected}|${s.prompt}`));
  const sb = new Set(after.scenarios.map((s) => `${s.expected}|${s.prompt}`));
  const bodyAdded = body.filter((l) => l.kind === 'add').length;
  const bodyRemoved = body.filter((l) => l.kind === 'remove').length;
  const triggerChanged = metadata.some((m) => m.field === 'description' || m.field === 'when_to_use');
  return {
    identical: metadata.length === 0 && bodyAdded === 0 && bodyRemoved === 0 && resources.length === 0,
    metadata,
    triggerChanged,
    body,
    bodyAdded,
    bodyRemoved,
    resources,
    scenarios: { added: [...sb].filter((x) => !sa.has(x)).length, removed: [...sa].filter((x) => !sb.has(x)).length },
  };
}

export function diffSummary(d: SkillDiff): string {
  if (d.identical) return 'No changes to the generated SKILL.md or supporting files.';
  const bits: string[] = [];
  if (d.bodyAdded || d.bodyRemoved) bits.push(`instructions +${d.bodyAdded}/−${d.bodyRemoved} lines`);
  if (d.metadata.length) bits.push(`metadata: ${d.metadata.map((m) => m.field).join(', ')}`);
  if (d.triggerChanged) bits.push('trigger description changed');
  if (d.resources.length) bits.push(`resources: ${d.resources.map((r) => `${r.change} ${r.path}`).join(', ')}`);
  if (d.scenarios.added || d.scenarios.removed) bits.push(`scenarios +${d.scenarios.added}/−${d.scenarios.removed}`);
  return bits.join(' · ');
}

export type CollapsedLine = DiffLine | { kind: 'gap'; hidden: number };

/** Keep every changed line plus `context` unchanged lines around it; collapse the rest into gap markers. */
export function collapseContext(lines: DiffLine[], context = 2): CollapsedLine[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.kind === 'same') return;
    for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++) keep[j] = true;
  });
  const out: CollapsedLine[] = [];
  let hidden = 0;
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (hidden) { out.push({ kind: 'gap', hidden }); hidden = 0; }
      out.push(l);
    } else hidden++;
  });
  if (hidden) out.push({ kind: 'gap', hidden });
  return out;
}

import { stringify } from 'yaml';
import type { SkillContent } from './model';

/** Normalise to LF and strip a leading BOM so output is stable across platforms. */
export function normalizeText(s: string): string {
  return s.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

export function frontmatterObject(c: SkillContent): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  fm.name = c.name.trim();
  fm.description = c.description.trim().replace(/\s*\n\s*/g, ' ');
  if (c.whenToUse.trim()) fm.when_to_use = c.whenToUse.trim().replace(/\s*\n\s*/g, ' ');
  if (c.argumentHint.trim()) fm['argument-hint'] = c.argumentHint.trim();
  if (c.invocation === 'manual-only') fm['disable-model-invocation'] = true;
  if (c.invocation === 'auto-only') fm['user-invocable'] = false;
  if (c.allowedTools.trim()) fm['allowed-tools'] = c.allowedTools.trim();
  if (c.context === 'fork') fm.context = 'fork';
  if (c.agent.trim()) fm.agent = c.agent.trim();
  if (c.model.trim()) fm.model = c.model.trim();
  if (c.paths.trim()) fm.paths = c.paths.trim();
  if (c.license.trim()) fm.license = c.license.trim();
  if (c.compatibility.trim()) fm.compatibility = c.compatibility.trim();
  const meta = c.metadata.filter((m) => m.key.trim());
  if (meta.length) fm.metadata = Object.fromEntries(meta.map((m) => [m.key.trim(), m.value]));
  return fm;
}

function bullets(items: string[]): string {
  return items
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `- ${s}`)
    .join('\n');
}

/** Body = the author's instructions + generated sections for use cases, non-use cases and unreferenced resources. */
export function generateBody(c: SkillContent): string {
  const parts: string[] = [normalizeText(c.instructions).trim()];
  const uses = bullets(c.useCases);
  const nots = bullets(c.nonUseCases);
  if (uses) parts.push(`## When to use\n\n${uses}`);
  if (nots) parts.push(`## When not to use\n\n${nots}`);
  const body0 = parts.join('\n\n');
  const unreferenced = c.references.filter((r) => r.path && !body0.includes(r.path));
  if (unreferenced.length) {
    parts.push(`## Additional resources\n\n${unreferenced.map((r) => `- [${r.path}](${r.path})`).join('\n')}`);
  }
  return parts.filter(Boolean).join('\n\n');
}

export function generateSkillMd(c: SkillContent): string {
  const yaml = stringify(frontmatterObject(c), { lineWidth: 0, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN' }).trimEnd();
  return `---\n${yaml}\n---\n\n${generateBody(c)}\n`;
}

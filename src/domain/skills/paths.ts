/**
 * Path rules for files bundled inside an exported Skill directory.
 * The goal is that a ZIP built from these paths can only ever create files
 * inside the Skill's own folder: no traversal, no absolute paths, no hidden
 * files, no platform-reserved names.
 */
export const ALLOWED_EXTENSIONS = ['md', 'txt', 'json', 'yaml', 'yml', 'csv', 'toml', 'py', 'js', 'mjs', 'ts', 'sh'] as const;
export const SCRIPT_EXTENSIONS = ['py', 'js', 'mjs', 'ts', 'sh'] as const;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export interface PathCheck {
  ok: boolean;
  reason?: string;
}

export function validateResourcePath(path: string): PathCheck {
  if (typeof path !== 'string' || path.length === 0) return { ok: false, reason: 'Path is empty.' };
  if (path.length > 120) return { ok: false, reason: 'Path is longer than 120 characters.' };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) return { ok: false, reason: 'Path contains control characters.' };
  if (path.includes('\\')) return { ok: false, reason: 'Use forward slashes only; backslashes are not allowed.' };
  if (path.startsWith('/')) return { ok: false, reason: 'Absolute paths are not allowed.' };
  if (/^[A-Za-z]:/.test(path)) return { ok: false, reason: 'Drive-letter paths are not allowed.' };
  if (path.startsWith('~')) return { ok: false, reason: 'Home-directory paths are not allowed.' };
  if (/%2e|%2f|%5c/i.test(path)) return { ok: false, reason: 'Encoded path characters are not allowed.' };
  const segments = path.split('/');
  if (segments.length > 4) return { ok: false, reason: 'Nest files at most 3 folders deep.' };
  for (const seg of segments) {
    if (seg === '') return { ok: false, reason: 'Path has an empty segment (double or trailing slash).' };
    if (seg === '.' || seg === '..') return { ok: false, reason: 'Path traversal ("." or "..") is not allowed.' };
    if (seg.startsWith('.')) return { ok: false, reason: 'Hidden files and folders (leading ".") are not allowed.' };
    if (!/^[A-Za-z0-9._-]+$/.test(seg)) return { ok: false, reason: 'Use only letters, digits, ".", "_" and "-" in file and folder names.' };
    if (seg.length > 64) return { ok: false, reason: 'A path segment is longer than 64 characters.' };
    if (/[. ]$/.test(seg)) return { ok: false, reason: 'Names must not end with a dot.' };
    if (WINDOWS_RESERVED.test(seg)) return { ok: false, reason: `"${seg}" is a reserved name on Windows.` };
  }
  if (path.toLowerCase() === 'skill.md') return { ok: false, reason: 'SKILL.md is generated for you; do not add it as a supporting file.' };
  const ext = segments[segments.length - 1]!.split('.').pop()!.toLowerCase();
  if (!segments[segments.length - 1]!.includes('.') || !(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return { ok: false, reason: `Only text files are supported: .${ALLOWED_EXTENSIONS.join(', .')}.` };
  }
  return { ok: true };
}

export function isScriptPath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return (SCRIPT_EXTENSIONS as readonly string[]).includes(ext);
}

/** Skill names double as folder names, so they follow the same safe-character rules. */
export const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SKILL_NAME_MAX = 64;

export function isValidSkillName(name: string): boolean {
  return name.length >= 1 && name.length <= SKILL_NAME_MAX && SKILL_NAME_RE.test(name) && !WINDOWS_RESERVED.test(name);
}

export function slugifySkillName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SKILL_NAME_MAX)
    .replace(/-+$/g, '');
}

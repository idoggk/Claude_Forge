/**
 * Frontmatter fields, split by who understands them.
 * Source: Claude Code Skills docs (code.claude.com/docs/en/skills), frontmatter reference,
 * checked 2026-11-05. The portable set is the Agent Skills spec fields that the docs list as
 * the only ones accepted outside Claude Code (claude.ai uploads, Skills API).
 */
export const PORTABLE_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'] as const;

export const CLAUDE_CODE_FIELDS = [
  'when_to_use',
  'argument-hint',
  'arguments',
  'disable-model-invocation',
  'user-invocable',
  'disallowed-tools',
  'model',
  'effort',
  'context',
  'agent',
  'background',
  'hooks',
  'paths',
  'shell',
] as const;

export const KNOWN_FIELDS: readonly string[] = [...PORTABLE_FIELDS, ...CLAUDE_CODE_FIELDS];

export function fieldKind(field: string): 'portable' | 'claude-code' | 'unknown' {
  if ((PORTABLE_FIELDS as readonly string[]).includes(field)) return 'portable';
  if ((CLAUDE_CODE_FIELDS as readonly string[]).includes(field)) return 'claude-code';
  return 'unknown';
}

/** Combined description + when_to_use is truncated in Claude Code's skill listing at this length. */
export const LISTING_CAP = 1536;
/** Agent Skills spec limit for `description` (portable). Not re-verified live this session. */
export const PORTABLE_DESCRIPTION_MAX = 1024;
export const COMPATIBILITY_MAX = 500;
export const BODY_LINE_ADVICE = 500;

import type { Option } from '@/domain/curriculum/types';

/** Option constructor: id, text, and WHY it is right or wrong (shown after grading). */
export const o = (id: string, text: string, why: string, misconception?: string): Option => (misconception ? { id, text, why, misconception } : { id, text, why });

export const DOCS = {
  skills: { label: 'Claude Code docs - Skills', url: 'https://code.claude.com/docs/en/skills' },
  plugins: { label: 'Claude Code docs - Plugins overview', url: 'https://code.claude.com/docs/en/plugins' },
  installPlugins: { label: 'Claude Code docs - Install and manage plugins', url: 'https://code.claude.com/docs/en/discover-plugins' },
  marketplaces: { label: 'Claude Code docs - Create a marketplace', url: 'https://code.claude.com/docs/en/plugin-marketplaces' },
  subagents: { label: 'Claude Code docs - Subagents', url: 'https://code.claude.com/docs/en/sub-agents' },
  hooks: { label: 'Claude Code docs - Hooks guide', url: 'https://code.claude.com/docs/en/hooks-guide' },
  memory: { label: 'Claude Code docs - How Claude remembers your project', url: 'https://code.claude.com/docs/en/memory' },
} as const;

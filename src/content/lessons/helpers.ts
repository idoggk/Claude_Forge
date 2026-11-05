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
  mcp: { label: 'Claude Code docs - Connect Claude Code to tools via MCP', url: 'https://code.claude.com/docs/en/mcp' },
  permissions: { label: 'Claude Code docs - Configure permissions', url: 'https://code.claude.com/docs/en/permissions' },
  workflows: { label: 'Claude Code docs - Common workflows', url: 'https://code.claude.com/docs/en/common-workflows' },
} as const;

/** Anthropic engineering articles read for Round 3 (dates are the publication dates shown on each page). */
export const ARTICLES = {
  buildingAgents: { label: 'Anthropic - Building effective agents (Dec 19, 2024)', url: 'https://www.anthropic.com/engineering/building-effective-agents' },
  contextEngineering: { label: 'Anthropic - Effective context engineering for AI agents (Sep 29, 2025)', url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents' },
  multiAgent: { label: 'Anthropic - How we built our multi-agent research system (Jun 13, 2025)', url: 'https://www.anthropic.com/engineering/multi-agent-research-system' },
  writingTools: { label: 'Anthropic - Writing effective tools for agents (Sep 11, 2025)', url: 'https://www.anthropic.com/engineering/writing-tools-for-agents' },
  evals: { label: 'Anthropic - Demystifying evals for AI agents (Jan 9, 2026)', url: 'https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents' },
} as const;

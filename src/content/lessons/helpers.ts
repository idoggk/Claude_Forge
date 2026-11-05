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
  toolUse: { label: 'Claude API docs - Tool use with Claude', url: 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview' },
  handleToolCalls: { label: 'Claude API docs - Handle tool calls', url: 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls' },
  structuredOutputs: { label: 'Claude API docs - Structured outputs', url: 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs' },
  mitigateInjection: { label: 'Claude API docs - Mitigate jailbreaks and prompt injections', url: 'https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks' },
  promptingPractices: { label: 'Claude API docs - Prompting best practices', url: 'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices' },
  developTests: { label: 'Claude API docs - Create strong empirical evaluations', url: 'https://platform.claude.com/docs/en/test-and-evaluate/develop-tests' },
} as const;

/** Third-party documentation read after four hosts were allowed on 2026-11-05 (see the source registry). Not Anthropic sources. */
export const THIRD_PARTY = {
  owaspLlm01: { label: 'OWASP Gen AI Security Project - LLM01:2025 Prompt Injection', url: 'https://genai.owasp.org/llmrisk/llm01-prompt-injection/' },
  mcpSecurity: { label: 'Model Context Protocol - Security best practices', url: 'https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices' },
  geminiStructured: { label: 'Gemini API docs - Structured outputs', url: 'https://ai.google.dev/gemini-api/docs/structured-output' },
  geminiFunctionCalling: { label: 'Gemini API docs - Function calling', url: 'https://ai.google.dev/gemini-api/docs/function-calling' },
} as const;

/** Anthropic engineering articles read for Round 3 (dates are the publication dates shown on each page). */
export const ARTICLES = {
  buildingAgents: { label: 'Anthropic - Building effective agents (Dec 19, 2024)', url: 'https://www.anthropic.com/engineering/building-effective-agents' },
  contextEngineering: { label: 'Anthropic - Effective context engineering for AI agents (Sep 29, 2025)', url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents' },
  multiAgent: { label: 'Anthropic - How we built our multi-agent research system (Jun 13, 2025)', url: 'https://www.anthropic.com/engineering/multi-agent-research-system' },
  writingTools: { label: 'Anthropic - Writing effective tools for agents (Sep 11, 2025)', url: 'https://www.anthropic.com/engineering/writing-tools-for-agents' },
  evals: { label: 'Anthropic - Demystifying evals for AI agents (Jan 9, 2026)', url: 'https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents' },
  contextualRetrieval: { label: 'Anthropic - Introducing Contextual Retrieval', url: 'https://www.anthropic.com/news/contextual-retrieval' },
  longRunningHarness: { label: 'Anthropic - Effective harnesses for long-running agents (Nov 26, 2025)', url: 'https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents' },
} as const;

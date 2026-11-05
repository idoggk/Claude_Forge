import type { Competency, CompetencyId, Track } from './types';

export const COMPETENCIES: Competency[] = [
  { id: 'mechanism-selection', title: 'Mechanism selection', summary: 'Choose between Skills, subagents, hooks, MCP, plugins, CLAUDE.md and ordinary code.', outcomes: [1, 2], safetyCritical: false },
  { id: 'skill-anatomy', title: 'Skill anatomy', summary: 'Read and explain SKILL.md structure, portable vs Claude Code-specific fields, progressive disclosure.', outcomes: [1, 6], safetyCritical: false },
  { id: 'trigger-design', title: 'Trigger design', summary: 'Write descriptions that activate for the right requests and stay quiet for the wrong ones.', outcomes: [6, 7], safetyCritical: false },
  { id: 'skill-security', title: 'Skill security review', summary: 'Inspect third-party Skills for unsafe instructions, scripts and permissions before trusting them.', outcomes: [3, 4, 5], safetyCritical: true },
  { id: 'skill-authoring', title: 'Skill authoring', summary: 'Write, validate and export a correct custom Skill.', outcomes: [6, 7], safetyCritical: false },
  { id: 'systematic-debugging', title: 'Systematic debugging', summary: 'Use invariants and minimal reproductions to find root causes in game logic.', outcomes: [9], safetyCritical: false },
  { id: 'economy-analysis', title: 'Economy analysis', summary: 'Separate currency supply, sinks, bottlenecks and pacing when reading simulation data.', outcomes: [9, 10], safetyCritical: false },
  { id: 'experiment-design', title: 'Experiment design', summary: 'Compare workflows with controlled, honestly-reported evidence.', outcomes: [8, 10], safetyCritical: true },
  { id: 'multi-agent-review', title: 'Multi-agent judgment', summary: 'Decide which approvals and validation gates a Builder/Reviewer/Integrator handoff needs.', outcomes: [2, 9], safetyCritical: false },
  { id: 'production-skills', title: 'Production Skill engineering', summary: 'Combine design, safety, tests and evidence into a Skill you would keep in your arsenal.', outcomes: [6, 8, 11, 12], safetyCritical: false },
];

export const COMPETENCY_BY_ID: Record<CompetencyId, Competency> = Object.fromEntries(
  COMPETENCIES.map((c) => [c.id, c]),
) as Record<CompetencyId, Competency>;

export const TRACKS: Track[] = [
  {
    id: 'A',
    title: 'Claude Code Foundations',
    summary: 'Customization surfaces, Skills architecture, invocation and how Skills differ from the alternatives.',
    plannedTopics: ['Instruction hierarchy deep-dive (CLAUDE.md, rules, Skills precedence)', 'Context-cost budgeting for Skill descriptions'],
  },
  {
    id: 'B',
    title: 'Discovery and Security',
    summary: 'Evaluate sources, inspect Skills and make evidence-based install decisions.',
    plannedTopics: ['Prompt-injection hunt in third-party Skills', 'Permission and allowed-tools auditing', 'Dependency pinning for MCP servers'],
  },
  {
    id: 'C',
    title: 'Custom Skill Engineering',
    summary: 'SKILL.md, trigger descriptions, progressive disclosure, testing and iteration with evidence.',
    plannedTopics: ['Bundled scripts and safe execution patterns', 'Description tuning with should-trigger / should-not-trigger sets'],
  },
  {
    id: 'D',
    title: 'Game Development',
    summary: 'Debugging, economy analysis and deterministic testing, using One More Merge-inspired fixtures.',
    plannedTopics: ['Phaser scene/performance investigation', 'Game architecture review', 'Automated review of balance changes'],
  },
  {
    id: 'E',
    title: 'Advanced Orchestration',
    summary: 'Delegation, reviewer responsibilities, integration gates and failure handling.',
    plannedTopics: ['Git worktree isolation workflows', 'Hooks as enforcement gates', 'Recovering from multi-agent merge failures'],
  },
];

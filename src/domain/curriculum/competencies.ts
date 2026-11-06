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
  // Round 3: broader AI mastery
  { id: 'approach-selection', title: 'Choosing the right AI approach', summary: 'Choose between a plain prompt, a workflow, a Skill, an agent, an MCP tool, a hook, a script, conventional software or a human-only process - and defend the simplest option that works.', outcomes: [], safetyCritical: false },
  { id: 'context-engineering', title: 'Context engineering', summary: 'Turn a vague AI task into one with the context, constraints, scope, acceptance criteria and verification an AI needs to succeed.', outcomes: [], safetyCritical: false },
  { id: 'agent-failure-analysis', title: 'Agent failure analysis', summary: 'Read an agent trace, name the real failure causes and pick proportionate controls.', outcomes: [], safetyCritical: false },
  { id: 'mcp-integration', title: 'MCP and integration judgment', summary: 'Decide when MCP, a direct API, a script, a built-in tool or no integration fits, with permission and credential reasoning.', outcomes: [], safetyCritical: true },
  { id: 'workflow-design', title: 'Reliable workflow design', summary: 'Specify inputs, outputs, verification, failure handling, approval points and completion criteria so an AI workflow can be repeated.', outcomes: [], safetyCritical: false },
  { id: 'efficient-ai-development', title: 'Efficient AI-assisted development', summary: 'Decompose tasks, manage context, verify independently, delegate and parallelise only where it pays.', outcomes: [], safetyCritical: false },
  { id: 'tool-evaluation', title: 'AI tool evaluation', summary: 'Separate evidence from claims, read permissions, judge maintenance and choose or reject a tool.', outcomes: [], safetyCritical: true },
  // Round 4: advanced AI engineering (not part of the placement diagnostic, which probes the foundations)
  { id: 'structured-tool-contracts', title: 'Structured outputs and tool contracts', summary: 'Design schemas and tool contracts, validate at the boundary, handle failures, and tell a valid shape from a reliable action.', outcomes: [], safetyCritical: false, advanced: true },
  { id: 'few-shot-design', title: 'Designing examples (few-shot)', summary: 'Choose representative, boundary and negative examples, avoid overfitting to them, and test on withheld cases.', outcomes: [], safetyCritical: false, advanced: true },
  { id: 'prompt-injection-defense', title: 'Prompt injection and trust boundaries', summary: 'Separate instructions from data, find the attacker-controlled surface, and apply least privilege and human approval.', outcomes: [], safetyCritical: true, advanced: true },
  { id: 'retrieval-design', title: 'Retrieval and evidence selection', summary: 'Understand chunking, lexical and semantic search, relevance, staleness and attribution; select evidence and reject the rest.', outcomes: [], safetyCritical: false, advanced: true },
  { id: 'eval-harness-design', title: 'Evaluation harness design', summary: 'Plan datasets, graders, held-out data and regression tests; detect leakage and invalid comparisons.', outcomes: [], safetyCritical: true, advanced: true },
  { id: 'long-running-context', title: 'Context for long-running agents', summary: 'Decide what to preserve, discard, summarise, revalidate and delegate across sessions, with verification checkpoints.', outcomes: [], safetyCritical: false, advanced: true },
  // Round 6: permissions and deterministic gates
  { id: 'agent-permissions', title: 'Agent permissions and least privilege', summary: 'Grant an agent only the read, write, execute and send access its task needs, place human approvals before irreversible actions, and handle credentials safely.', outcomes: [], safetyCritical: true, advanced: true },
  { id: 'deterministic-gates', title: 'Hooks, guardrails and deterministic gates', summary: 'Tell a procedure from a policy, choose between a Skill, project instructions, a hook, a permission rule and a CI check, and design a gate that holds.', outcomes: [], safetyCritical: false, advanced: true },
  { id: 'research-reliability', title: 'Research reliability', summary: 'Trace a claim to its source, judge the strength and kind of evidence, handle conflicting sources, and separate what is supported, inferred and unchecked.', outcomes: [], safetyCritical: false, advanced: true },
  { id: 'workflow-architecture', title: 'AI workflow architecture', summary: 'Break a task into steps, choose the plainest design that works, and add checkpoints, bounded retries, approvals, monitoring, cost limits and an owner.', outcomes: [], safetyCritical: false, advanced: true },
];

export const COMPETENCY_BY_ID: Record<CompetencyId, Competency> = Object.fromEntries(
  COMPETENCIES.map((c) => [c.id, c]),
) as Record<CompetencyId, Competency>;

/**
 * The thirteen areas of the Personal AI Mastery Profile. An area with no competencies yet is PLANNED: it is shown so
 * the learner can see the whole map, with no progress bar and no invented level.
 */
export interface CompetencyArea {
  id: string;
  title: string;
  summary: string;
  competencyIds: CompetencyId[];
  /** Shown when the area has no lessons yet. */
  plannedNote?: string;
}

export const COMPETENCY_AREAS: CompetencyArea[] = [
  { id: 'ai-fundamentals', title: 'AI fundamentals', summary: 'How models, tokens, context and tool calling work, and where they fail.', competencyIds: [], plannedNote: 'Track 1 lessons are planned. Lesson 11 teaches the judgment these fundamentals support.' },
  { id: 'prompting', title: 'Prompting', summary: 'Specifying tasks, examples, structured outputs and iteration.', competencyIds: ['few-shot-design', 'structured-tool-contracts'] },
  { id: 'context-engineering', title: 'Context engineering', summary: 'Giving AI the right information, limits and checks.', competencyIds: ['context-engineering', 'long-running-context'] },
  { id: 'tool-selection', title: 'Tool selection', summary: 'Choosing the right mechanism, approach and tool - and rejecting unsupported claims.', competencyIds: ['approach-selection', 'mechanism-selection', 'tool-evaluation'] },
  { id: 'ai-coding', title: 'AI coding', summary: 'Claude Code mechanics, Skills and efficient AI-assisted development.', competencyIds: ['skill-anatomy', 'trigger-design', 'skill-authoring', 'production-skills', 'efficient-ai-development'] },
  { id: 'agents', title: 'Agents', summary: 'Multi-agent judgment and understanding why agents fail.', competencyIds: ['multi-agent-review', 'agent-failure-analysis', 'long-running-context', 'agent-permissions', 'deterministic-gates'] },
  { id: 'mcp', title: 'MCP and integrations', summary: 'Connecting AI to external systems safely.', competencyIds: ['mcp-integration', 'structured-tool-contracts'] },
  { id: 'automation', title: 'Automation', summary: 'Reliable, repeatable AI workflows.', competencyIds: ['workflow-design', 'workflow-architecture'] },
  { id: 'research', title: 'Research', summary: 'Sourcing, verifying and synthesising with AI.', competencyIds: ['retrieval-design', 'research-reliability'] },
  { id: 'evaluation', title: 'Evaluation', summary: 'Comparing approaches with honest evidence.', competencyIds: ['experiment-design', 'eval-harness-design'] },
  { id: 'security', title: 'Security', summary: 'Inspecting third-party Skills and integrations before trusting them.', competencyIds: ['skill-security', 'prompt-injection-defense', 'agent-permissions'] },
  { id: 'game-development', title: 'Game development', summary: 'Debugging and economy analysis on One More Merge-style fixtures.', competencyIds: ['systematic-debugging', 'economy-analysis'] },
  { id: 'ai-system-design', title: 'AI system design', summary: 'RAG, memory, evaluation harnesses and AI application architecture.', competencyIds: ['retrieval-design', 'eval-harness-design'] },
];

export const TRACKS: Track[] = [
  {
    id: 'fundamentals', order: 1, title: 'AI Fundamentals and Mental Models',
    summary: 'How modern AI systems work at a practical engineering level, and when not to use them.',
    outcome: 'Reason about what an AI system can and cannot reliably do, and pick the simplest approach that works.',
    topics: [
      { title: 'Choosing the right AI approach (prompt, workflow, Skill, agent, tool, script, software, human)', lessonId: 'L11-choose-ai-approach' },
      { title: 'When not to use AI', lessonId: 'L11-choose-ai-approach' },
      { title: 'Large language models, tokens and context windows' },
      { title: 'Training versus inference; reasoning' },
      { title: 'Capabilities, limitations and hallucinations' },
      { title: 'Tool calling, grounding and retrieval', lessonId: 'L19-structured-outputs-tool-calling' },
      { title: 'Structured outputs', lessonId: 'L19-structured-outputs-tool-calling' },
      { title: 'Cost, latency and quality tradeoffs' },
    ],
  },
  {
    id: 'prompting', order: 2, title: 'Prompting and Context Engineering',
    summary: 'Advanced interaction with AI: specifications, context, acceptance criteria and verification.',
    outcome: 'Turn a vague request into a task an AI can succeed at, and judge a prompt by its outcomes.',
    topics: [
      { title: 'Task specifications, context, scope and acceptance criteria', lessonId: 'L12-context-engineering' },
      { title: 'Asking for verification', lessonId: 'L12-context-engineering' },
      { title: 'Persistent project instructions (CLAUDE.md)', lessonId: 'L12-context-engineering' },
      { title: 'Few-shot examples', lessonId: 'L20-few-shot-prompting' },
      { title: 'Decomposing complex problems', lessonId: 'L17-efficient-ai-development' },
      { title: 'Managing long contexts; compression and summaries', lessonId: 'L24-long-running-agent-context' },
      { title: 'Prompt injection awareness', lessonId: 'L21-prompt-injection-trust-boundaries' },
      { title: 'Evaluating prompt effectiveness', lessonId: 'L16-ai-evaluation' },
    ],
  },
  {
    id: 'claude-code', order: 3, title: 'Claude Code and AI Coding Mastery',
    summary: 'The mechanisms of Claude Code, how to combine them, and how to work efficiently.',
    outcome: 'Pick the right Claude Code mechanism, write and test a Skill, and run development work efficiently.',
    topics: [
      { title: 'Skills: choose, read, trigger, write and test', lessonId: 'L02-inside-skill-md' },
      { title: 'Skill or tool? Mechanism selection', lessonId: 'L01-skill-or-tool' },
      { title: 'Trigger design and testing', lessonId: 'L03-trigger-dojo' },
      { title: 'Your first custom Skill', lessonId: 'L05-first-custom-skill' },
      { title: 'A production-ready Skill', lessonId: 'L10-forge-production-skill' },
      { title: 'Efficient AI-assisted development', lessonId: 'L17-efficient-ai-development' },
      { title: 'Subagents, plugins, hooks and permissions in depth', lessonId: 'L26-hooks-guardrails-deterministic-gates' },
      { title: 'Git worktrees and parallel development' },
      { title: 'Session recovery and long-running tasks' },
    ],
  },
  {
    id: 'agents', order: 4, title: 'AI Agents and Orchestration',
    summary: 'Agent engineering beyond a single Skill: loops, delegation, review, guardrails and failure handling.',
    outcome: 'Decide whether a task needs an agent at all, and design the controls when it does.',
    topics: [
      { title: 'Why agents fail, and the controls that help', lessonId: 'L13-why-agents-fail' },
      { title: 'Reviewer / Builder / Integrator patterns', lessonId: 'L09-reviewer-vs-builder' },
      { title: 'Agents versus workflows', lessonId: 'L11-choose-ai-approach' },
      { title: 'Planning, delegation and supervisor/worker patterns' },
      { title: 'Agent memory, state and checkpointing', lessonId: 'L24-long-running-agent-context' },
      { title: 'Human approval gates and sandboxing', lessonId: 'L25-agent-permissions-least-privilege' },
      { title: 'Agent evaluation and observability' },
    ],
  },
  {
    id: 'mcp-tools', order: 5, title: 'MCP, Tools and Integrations',
    summary: 'How AI connects to external systems, and when it should not.',
    outcome: 'Choose between MCP, a direct API, a script or a built-in tool, and reason about permissions and credentials.',
    topics: [
      { title: 'MCP or not? Integration choice, permissions and credentials', lessonId: 'L14-mcp-or-not' },
      { title: 'Tool permissions and untrusted tool output', lessonId: 'L14-mcp-or-not' },
      { title: 'Tool schemas and tool-call reliability', lessonId: 'L19-structured-outputs-tool-calling' },
      { title: 'Authentication and OAuth basics' },
      { title: 'Building and testing a small MCP server' },
    ],
  },
  {
    id: 'automation', order: 6, title: 'AI Automation and Productivity',
    summary: 'Turning AI into a reliable productivity multiplier: what to automate, partly automate, or keep manual.',
    outcome: 'Specify a reusable workflow with verification, failure handling and approval points.',
    topics: [
      { title: 'Building a reliable AI workflow', lessonId: 'L15-reliable-ai-workflow' },
      { title: 'Spotting AI opportunities (and when the answer is no AI)', lessonId: 'L11-choose-ai-approach' },
      { title: 'Scheduled and event-driven workflows' },
      { title: 'Personal knowledge systems and document processing' },
      { title: 'Cost versus value; maintenance of automations', lessonId: 'L28-ai-workflow-architecture' },
    ],
  },
  {
    id: 'engineering', order: 7, title: 'AI-Assisted Software Engineering',
    summary: 'Practical AI workflows for planning, building, testing, reviewing and releasing software.',
    outcome: 'Run real engineering tasks with measurable acceptance criteria and independent verification.',
    topics: [
      { title: 'Task decomposition, verification and delegation', lessonId: 'L17-efficient-ai-development' },
      { title: 'Reliable workflows for repeatable engineering tasks', lessonId: 'L15-reliable-ai-workflow' },
      { title: 'Architecture design and feature planning', lessonId: 'L28-ai-workflow-architecture' },
      { title: 'Refactoring, testing and debugging at scale' },
      { title: 'Security reviews, CI/CD and release engineering' },
      { title: 'Legacy code comprehension and migration planning' },
    ],
  },
  {
    id: 'game-dev', order: 8, title: 'AI for Game Development',
    summary: 'A major specialisation: debugging, economies and deterministic systems on One More Merge-style fixtures.',
    outcome: 'Use AI on game problems with simulations, invariants and measured evidence.',
    topics: [
      { title: 'Debugging a merge-chain failure with invariants', lessonId: 'L06-merge-chain-failure' },
      { title: 'Game economy inflation and balancing', lessonId: 'L07-economy-inflation' },
      { title: 'Improvement-loop missions: economy review, Phaser performance, determinism, integration' },
      { title: 'Automated playtesting and enemy AI' },
      { title: 'Level design and progression systems' },
      { title: 'Mobile UX, game UI and asset pipelines' },
      { title: 'Save systems and live operations' },
    ],
  },
  {
    id: 'research', order: 9, title: 'AI Research and Knowledge Work',
    summary: 'Researching effectively with AI: sources, citations, contradictions and uncertainty.',
    outcome: 'Reject unsupported conclusions and keep claims tied to sources.',
    topics: [
      { title: 'Evaluating evidence and unsupported claims in a tool pitch', lessonId: 'L18-evaluate-an-ai-tool' },
      { title: 'Source credibility and primary versus secondary sources', lessonId: 'L27-research-reliability' },
      { title: 'Citation verification and fabricated citations', lessonId: 'L27-research-reliability' },
      { title: 'Evidence extraction, synthesis and reproducibility', lessonId: 'L27-research-reliability' },
    ],
  },
  {
    id: 'ecosystem', order: 10, title: 'AI Models and Ecosystem Intelligence',
    summary: 'Understanding and comparing AI products without assuming which is best.',
    outcome: 'Judge a tool by evidence, permissions and maintenance, and keep vendor claims apart from independent findings.',
    topics: [
      { title: 'Discovering and evaluating an AI tool', lessonId: 'L18-evaluate-an-ai-tool' },
      { title: 'Vendor claims versus independent evaluation versus your own experiments', lessonId: 'L16-ai-evaluation' },
      { title: 'Comparing models and coding agents' },
      { title: 'Open-weight and local models' },
      { title: 'Benchmark interpretation and model routing' },
    ],
  },
  {
    id: 'safety-eval', order: 11, title: 'AI Safety, Reliability and Evaluation',
    summary: 'Prompt injection, permissions, supply chain, evaluation and reliability, through inert examples.',
    outcome: 'Evaluate AI approaches with baselines, hidden cases and honest uncertainty, and inspect before trusting.',
    topics: [
      { title: 'AI evaluation fundamentals: baselines, controls, variance, evidence quality', lessonId: 'L16-ai-evaluation' },
      { title: 'AI Lab experiments', lessonId: 'L08-battle-lab' },
      { title: 'Inspecting a third-party Skill', lessonId: 'L04-skill-autopsy' },
      { title: 'Why agents fail; guardrails', lessonId: 'L13-why-agents-fail' },
      { title: 'Prompt injection and data exfiltration', lessonId: 'L21-prompt-injection-trust-boundaries' },
      { title: 'Sandboxing and permission design', lessonId: 'L25-agent-permissions-least-privilege' },
      { title: 'Regression tests for AI behaviour', lessonId: 'L23-evaluation-harnesses' },
    ],
  },
  {
    id: 'advanced', order: 12, title: 'Advanced AI Systems',
    summary: 'RAG, embeddings, memory, evaluation harnesses, local inference and AI application architecture.',
    outcome: 'Know the prerequisites and trade-offs before building an AI system, without assuming you must build one.',
    topics: [
      { title: 'Evaluation harness concepts', lessonId: 'L23-evaluation-harnesses' },
      { title: 'RAG, embeddings and vector search', lessonId: 'L22-retrieval-augmented-generation' },
      { title: 'Memory architectures and agent state' },
      { title: 'Model serving, local inference and caching' },
      { title: 'Fine-tuning and distillation concepts' },
    ],
  },
];

export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t])) as Record<string, Track>;

import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS } from './helpers';

export const L01: Lesson = {
  id: 'L01-skill-or-tool',
  version: 1,
  track: 'A',
  order: 1,
  title: 'Skill or Tool?',
  subtitle: 'Choose the right Claude Code mechanism before you build anything',
  prerequisites: [],
  competencies: ['mechanism-selection'],
  effortMinutes: 12,
  gameRelevance: 1,
  interestTags: ['foundations', 'orchestration'],
  problem:
    'You have a recurring need - "never let a cascade change ship without the determinism sim", "investigate merge bugs the same way every time" - and Claude Code offers at least seven places to put it. Pick the wrong one and the rule is silently skipped, the context fills with noise, or you wrote a Skill for something that should have been a script.',
  whyItMatters:
    'Every later lesson assumes you can say why a Skill is (or is not) the right tool. The choice decides whether behaviour is guaranteed or merely encouraged, what it costs in context every turn, and who can share it.',
  objectives: [
    'Explain what each mechanism is for: CLAUDE.md, Skills, subagents, hooks, MCP, plugins and ordinary code.',
    'Decide using three questions: must it happen every time, does it need judgment, does it need an outside system?',
    'Predict the context cost of each mechanism.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Seven places a behaviour can live',
      body: `| Mechanism | What it is | Who decides it runs |
|---|---|---|
| **CLAUDE.md** | Persistent instructions loaded at the start of every session | Always loaded; Claude treats it as context, not enforcement |
| **Skill** | A folder with a \`SKILL.md\` Claude loads when relevant (or you invoke with \`/name\`) | Claude, from the description - or you |
| **Subagent** | A specialist with its own context window, tools and permissions; returns a summary | Claude delegates, or you ask |
| **Hook** | A command Claude Code runs at a lifecycle event (before/after a tool, session start, ...) | The harness - **every time the event fires** |
| **MCP server** | A tool server that gives Claude new capabilities (browser, database, files) | Claude calls its tools |
| **Plugin** | A package that bundles skills, agents, hooks and MCP servers | Installation - then each component works as above |
| **Regular code** | A script, test or CI job | You, CI or a hook |

*Sources: Claude Code docs on memory, skills, sub-agents, hooks and plugins.*`,
    },
    {
      id: 's2',
      title: 'Three questions that decide it',
      body: `1. **Must it happen every single time?** Use a **hook** (or CI). The docs are explicit: if Claude skips a rule that must always hold, "move the rule into a hook" - Claude Code runs a hook every time its event occurs, whether or not Claude is following your Skill.
2. **Is it knowledge or a procedure Claude should apply with judgment?** Use a **Skill**. If it is short and relevant to *every* task, **CLAUDE.md** is simpler (the docs suggest keeping each file under about 200 lines).
3. **Does it need something Claude cannot do alone?** An external system or capability → **MCP**. Verbose, self-contained work that would flood the conversation → **subagent**. A deterministic calculation → **code**, which a Skill or hook may call.

Packaging is a separate question: use a **plugin** when you want several of these shipped as one unit.`,
    },
    {
      id: 's3',
      title: 'What each choice costs in context',
      body: `- **CLAUDE.md** loads at launch in full - every line costs context every session.
- **Skills**: the *description* is always in context (unless \`disable-model-invocation: true\`); the full body loads only when the Skill is used. Each listing entry is capped at 1,536 characters, and the whole listing has a budget that scales with the context window.
- **Plugins**: an enabled plugin puts the names and descriptions of its model-invocable Skills and agents in context on **every turn**, even in sessions that never use them.
- **Subagents** keep their own verbose work out of your main context; only a summary returns.

So a Skill is cheap when idle - but not free - and a bundle of 30 Skills is 30 descriptions.`,
    },
    {
      id: 's4',
      title: 'Rules that must hold do not belong in a Skill',
      body: `A Skill is *guidance*. The docs list why Claude may stop following one: its content was added once and not re-read, the conversation was compacted, or the wording was too narrow. For "never edit \`generated/\`" or "always run the sim before a commit", Claude's compliance is not the right place to put the guarantee.

**Pattern:** put the *judgment* in a Skill ("how to investigate a cascade bug") and the *guarantee* in a hook or CI ("block the commit unless the determinism sim passed").`,
    },
  ],
  activity: {
    title: 'Sort real One More Merge tasks',
    intro: 'Open the map, then place each task where it belongs. Hints are available; they are recorded and keep this attempt "guided".',
    widget: 'mechanism-map',
    items: [
      {
        id: 'l01-p1',
        kind: 'classify',
        concept: 'mechanism-selection',
        prompt: 'Place each need into the mechanism that fits best.',
        categories: [
          { id: 'skill', label: 'Skill' },
          { id: 'claude-md', label: 'CLAUDE.md' },
          { id: 'hook', label: 'Hook' },
          { id: 'mcp', label: 'MCP server' },
          { id: 'subagent', label: 'Subagent' },
          { id: 'plugin', label: 'Plugin' },
          { id: 'code', label: 'Regular code' },
        ],
        entries: [
          { id: 'e1', text: 'Every edit under src/core must run a typecheck and block on failure', correct: 'hook', why: 'A guarantee that must hold every time → the harness runs it, not Claude\'s judgment.' },
          { id: 'e2', text: 'When a merge or cascade bug is reported, investigate invariant-first with a seeded reproduction', correct: 'skill', why: 'A procedure Claude should apply with judgment when a certain kind of request appears.' },
          { id: 'e3', text: 'The project uses pnpm, and tests run with `pnpm test`', correct: 'claude-md', why: 'Short, relevant to almost every task, no triggering needed.' },
          { id: 'e4', text: 'Claude must click through the running game menu in a real browser', correct: 'mcp', why: 'A new capability (browser control) that Claude cannot do with built-in tools alone.' },
          { id: 'e5', text: 'Search the whole repo for every use of Math.random and report a summary only', correct: 'subagent', why: 'Verbose, self-contained search work: keep it out of the main context; take a summary back.' },
          { id: 'e6', text: 'Share my debugging Skill, review agent and hook config with the team in one install', correct: 'plugin', why: 'Packaging several components as one unit is exactly what a plugin is for.' },
          { id: 'e7', text: 'Run a 200-seed determinism simulation and print a pass/fail table', correct: 'code', why: 'Deterministic computation. A Skill or hook can *call* it, but the work is a script.' },
        ],
        hints: ['Ask first: must this happen every single time, with no judgment involved?', 'A capability Claude lacks (browser, database) is MCP; work you can script deterministically is code.'],
        explanation: 'Most real setups combine several: judgment in a Skill, guarantees in hooks/CI, computation in code, shared via a plugin.',
      },
      {
        id: 'l01-p2',
        kind: 'single',
        concept: 'mechanism-selection',
        prompt: 'Your Skill says "Always run the determinism sim before committing". In long sessions Claude sometimes skips it. What is the best fix?',
        options: [
          o('a', 'Add more capital letters and "IMPORTANT" to the Skill', 'Emphasis may help a little, but a Skill is still guidance that can be skipped or compacted away.'),
          o('b', 'Keep the Skill for how to interpret the sim, and enforce "sim must pass before commit" with a hook or CI check', 'Correct: judgment stays in the Skill, the guarantee moves to something that runs every time.'),
          o('c', 'Move the sentence into CLAUDE.md', 'CLAUDE.md is also context, not enforcement - the docs say to use a PreToolUse-style hook to block actions regardless of what Claude decides.'),
          o('d', 'Turn the Skill into a plugin', 'Packaging does not change whether the rule is enforced.'),
        ],
        correct: 'b',
        hints: ['Which mechanism runs "every time its event occurs"?'],
        explanation: 'The docs recommend a hook for "a rule that must hold every time", and note a Skill can also carry hooks in its frontmatter.',
      },
      {
        id: 'l01-p3',
        kind: 'multi',
        concept: 'mechanism-selection',
        prompt: 'Which statements about context cost are true? Select all.',
        options: [
          o('a', 'A Skill\'s description is in context every turn unless model invocation is disabled', 'True - that is how Claude knows the Skill exists.'),
          o('b', 'A Skill\'s full SKILL.md body loads only when the Skill is used', 'True - progressive disclosure.'),
          o('c', 'An enabled plugin costs nothing in sessions where none of its Skills are used', 'False - the names and descriptions of its model-invocable Skills and agents are in context every turn.'),
          o('d', 'CLAUDE.md content is loaded at launch', 'True for the files above the working directory; subdirectory files load on demand.'),
        ],
        correct: ['a', 'b', 'd'],
        explanation: 'Idle cost is low for a single Skill but adds up across bundles.',
      },
    ],
  },
  assessment: {
    title: 'Mechanism selection check',
    intro: 'Unseen scenarios. No hints. Your confidence is recorded before you start.',
    passMark: 0.75,
    items: [
      {
        id: 'l01-a1',
        kind: 'single',
        concept: 'mechanism-selection',
        prompt: 'Rule: "Any change to balance/economy.json must be blocked unless the economy simulation has been re-run." Which mechanism should enforce it?',
        options: [
          o('a', 'A Skill describing the rule in detail', 'A Skill can be skipped; this is a must-always-hold rule.'),
          o('b', 'A hook (or CI check) that blocks the change unless the simulation result is present', 'Correct: deterministic enforcement at the event.'),
          o('c', 'A subagent that reviews balance files', 'Useful for review, but still dependent on being invoked.'),
          o('d', 'An MCP server for the spreadsheet', 'MCP adds capabilities; it does not enforce a gate.'),
        ],
        correct: 'b',
        explanation: 'Enforcement belongs where it cannot be skipped.',
      },
      {
        id: 'l01-a2',
        kind: 'classify',
        concept: 'mechanism-selection',
        prompt: 'Classify each need.',
        categories: [
          { id: 'skill', label: 'Skill' },
          { id: 'claude-md', label: 'CLAUDE.md' },
          { id: 'hook', label: 'Hook' },
          { id: 'mcp', label: 'MCP server' },
          { id: 'subagent', label: 'Subagent' },
          { id: 'code', label: 'Regular code' },
        ],
        entries: [
          { id: 'x1', text: 'After every file write, run the formatter automatically', correct: 'hook', why: 'The docs\' own example: a PostToolUse hook that formats edited files.' },
          { id: 'x2', text: 'Explain how to read a balance simulation: supply, sinks, bottlenecks, pacing', correct: 'skill', why: 'Reusable knowledge applied with judgment when balance questions come up.' },
          { id: 'x3', text: 'Query the live analytics database for yesterday\'s progression funnel', correct: 'mcp', why: 'An external system Claude cannot reach on its own.' },
          { id: 'x4', text: 'Compute the SHA-256 of every fixture file and write a manifest', correct: 'code', why: 'Pure deterministic computation.' },
          { id: 'x5', text: 'Our branches are named feat/<area>-<topic>', correct: 'claude-md', why: 'A short convention relevant to many tasks.' },
          { id: 'x6', text: 'Read 40 files to trace a state-machine bug and return only the findings', correct: 'subagent', why: 'The verbose exploration stays out of the main context.' },
        ],
        explanation: 'Use the three questions: every time? judgment? outside capability?',
      },
      {
        id: 'l01-a3',
        kind: 'keywords',
        concept: 'mechanism-selection',
        prompt: 'In one sentence: why is a hook more reliable than a Skill for "never edit generated files"?',
        groups: [
          { label: 'Runs every time / deterministic', anyOf: ['every time', 'always runs', 'deterministic', 'guaranteed', 'regardless', 'each time', 'without fail'] },
          { label: 'A Skill depends on Claude following it', anyOf: ['claude may', 'claude can skip', 'skip', 'judgment', 'judgement', 'decide', 'guidance', 'not enforced', 'ignore'] },
        ],
        placeholder: 'A hook ... whereas a Skill ...',
        explanation: 'Reference answer: a hook is executed by the harness every time its event fires, whereas a Skill is guidance that Claude may skip or lose after compaction. (This check only looks for those two ideas; compare with the reference.)',
      },
      {
        id: 'l01-a4',
        kind: 'multi',
        concept: 'mechanism-selection',
        prompt: 'Which are good reasons to choose a subagent? Select all.',
        options: [
          o('a', 'The task produces huge intermediate output you do not want in the main conversation', 'Yes - only a summary returns.'),
          o('b', 'You want to restrict the tools available for the task', 'Yes - subagents can have their own tool allowlist.'),
          o('c', 'You need a rule enforced on every file edit', 'No - that is a hook.'),
          o('d', 'You want to share a command with the team', 'No - sharing is a plugin or committed file question.'),
        ],
        correct: ['a', 'b'],
        explanation: 'Subagents isolate context and permissions.',
      },
      {
        id: 'l01-a5',
        kind: 'single',
        concept: 'mechanism-selection',
        prompt: 'You install a 30-Skill plugin and notice Claude\'s context fills faster even in sessions where none of its Skills run. What explains this?',
        options: [
          o('a', 'Plugins load every SKILL.md body at startup', 'No - bodies load only when a Skill is used.'),
          o('b', 'Every model-invocable Skill and agent\'s name and description is in context on every turn', 'Correct per the plugin docs.'),
          o('c', 'MCP servers inside the plugin always run the model', 'Not what the docs describe.'),
          o('d', 'Nothing - plugins never affect context', 'The docs say they do.'),
        ],
        correct: 'b',
        explanation: 'Check the plugin\'s footprint before installing (Context cost in /plugin; `claude plugin details`).',
      },
    ],
  },
  failureModes: [
    'Writing a Skill for something that must be guaranteed (it will be skipped sooner or later).',
    'Putting a long process into CLAUDE.md, paying its context cost in every session.',
    'Installing a large plugin bundle for one useful Skill.',
    'Reaching for MCP when a script would do.',
  ],
  application: {
    title: 'Audit your own setup',
    body: 'List the instructions you currently repeat to Claude when working on One More Merge. Put each in a mechanism. Pick the one rule you would be most upset to see skipped and decide whether it deserves a hook.',
    fieldPrompt: 'Log it under Growth → Field evidence if you actually move a rule from CLAUDE.md or a prompt into a hook, Skill or CI check on a real project.',
  },
  reviewItems: [
    {
      id: 'l01-r1',
      kind: 'single',
      concept: 'mechanism-selection',
      prompt: 'Which mechanism packages a Skill, a subagent and a hook together so a teammate can install them in one step?',
      options: [o('a', 'Plugin', 'Correct.'), o('b', 'CLAUDE.md', 'Instructions only.'), o('c', 'MCP server', 'Provides tools, not packaging.'), o('d', 'Regular code', 'Not a Claude Code packaging unit.')],
      correct: 'a',
      explanation: 'A plugin is a directory of skills, agents, hooks and MCP servers installed as one unit.',
    },
    {
      id: 'l01-r2',
      kind: 'single',
      concept: 'mechanism-selection',
      prompt: 'Claude keeps forgetting to run a style check after edits. The check is a deterministic command. Best mechanism?',
      options: [o('a', 'Hook on file edits', 'Correct - runs every time.'), o('b', 'Longer Skill description', 'Does not guarantee.'), o('c', 'Subagent', 'Not needed for a single command.'), o('d', 'MCP', 'No outside capability needed.')],
      correct: 'a',
      explanation: 'Deterministic + every time = hook.',
    },
    {
      id: 'l01-r3',
      kind: 'multi',
      concept: 'mechanism-selection',
      prompt: 'Select the mechanisms whose behaviour is NOT guaranteed - they rely on Claude following context.',
      options: [o('a', 'CLAUDE.md', 'Context, not enforcement.'), o('b', 'Skill', 'Guidance that Claude may skip, or lose after compaction.'), o('c', 'Hook', 'Run by the harness.'), o('d', 'CI check', 'CI executes it regardless of what Claude does, so it does not depend on Claude following context.')],
      correct: ['a', 'b'],
      explanation: 'Guidance vs enforcement.',
    },
  ],
  sources: [
    { ...DOCS.memory, supports: 'CLAUDE.md is context, not enforcement; size guidance; locations.' },
    { ...DOCS.skills, supports: 'Skill description always in context; body loads on use; hooks for rules that must hold.' },
    { ...DOCS.subagents, supports: 'Own context window, tools and permissions; summary returned.' },
    { ...DOCS.hooks, supports: 'Hooks are shell commands run at lifecycle events.' },
    { ...DOCS.plugins, supports: 'Plugin contents and always-on description cost.' },
  ],
};

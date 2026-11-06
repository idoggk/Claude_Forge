import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES } from './helpers';

const LADDER = [
  { id: 'human', label: 'Human-only process' },
  { id: 'software', label: 'Script or conventional software' },
  { id: 'prompt', label: 'Simple AI prompt' },
  { id: 'workflow', label: 'Structured workflow (fixed steps, AI at some of them)' },
  { id: 'skill', label: 'Skill (reusable procedure loaded when relevant)' },
  { id: 'hook', label: 'Hook (deterministic enforcement at an event)' },
  { id: 'tool', label: 'MCP tool or direct API (gives AI a capability)' },
  { id: 'agent', label: 'Agent (AI directs its own steps)' },
];

export const L11: Lesson = {
  id: 'L11-choose-ai-approach',
  version: 3,
  track: 'fundamentals',
  alsoIn: ['agents', 'automation'],
  order: 11,
  title: 'How to Choose the Right AI Approach',
  subtitle: 'Prompt, workflow, Skill, agent, tool, hook, script, software - or nothing. Choose the simplest thing that works.',
  prerequisites: [],
  competencies: ['approach-selection'],
  effortMinutes: 25,
  gameRelevance: 1,
  interestTags: ['ai-judgment', 'foundations', 'automation'],
  problem: 'Every task now looks like an AI task. A teammate wants an agent to rename files, another builds a Skill for a one-off question, a third asks a chat model to do arithmetic on a telemetry export. All of it "works" - at a cost nobody measured, with failures nobody can predict.',
  whyItMatters: 'The most valuable AI skill is not writing clever prompts; it is knowing which tool a problem deserves. Over-building is expensive and fragile, under-building wastes the capability. Judgment here pays off on every task you ever give an AI.',
  objectives: [
    'Place a task on the approach ladder, from "human only" to "agent", and defend the choice.',
    'Separate work that needs judgment from work that is a fixed rule and belongs in ordinary software or a hook.',
    'Recognise when the right answer is conventional programming - or doing nothing.',
    'State what extra cost and risk each step up the ladder adds.',
  ],
  segments: [
    {
      id: 's1',
      title: 'The approach ladder',
      prediction: {
        prompt: 'A nightly job must rename 4,000 level files by a fixed pattern. Before you read on: which approach fits best?',
        options: [
          o('a', 'A short script, checked with a diff', 'The rule is fixed and checkable. Ordinary software is cheaper, faster and verifiable.'),
          o('b', 'An autonomous agent that decides how to rename each file', 'The steps are predictable, so autonomy only adds cost and error risk.', 'agents-always-better'),
          o('c', 'A Skill describing the naming pattern', 'A Skill guides judgment; the rename itself is still a mechanical job.'),
        ],
        correct: 'a',
      },
      body: `Think of eight rungs. **Climb only as far as the problem needs.**

${LADDER.map((r, i) => `${i + 1}. **${r.label}**`).join('\n')}

- *Human-only* when the decision is about taste, values or accountability.
- *Software* when the rule is fixed and you can check the output mechanically.
- *A prompt* when you need language or judgment once, and you will read the result.
- *A workflow* when the steps are known in advance but some need an AI.
- *A Skill* when the same judgment procedure repeats and should load only when relevant.
- *A hook* when a rule must hold every single time. Claude Code runs hooks as shell commands at fixed points, so "certain actions always happen rather than relying on the LLM to choose to run them".
- *A tool (MCP or a direct API)* when the AI needs a capability it does not have, such as reading a system.
- *An agent* when the number and order of steps cannot be predicted in advance.

Each rung up adds cost, latency, variance and something new to verify. That is the price of flexibility.`,
    },
    {
      id: 's2',
      title: 'Seven questions that place a task on the ladder',
      body: `1. **Is the rule fixed and the output checkable?** Then write software or a hook. Do not ask a model to do arithmetic, parsing or renaming.
2. **Is judgment or language involved?** If yes, an AI can help. If no, it is not an AI task.
3. **Will I read and verify the result myself?** A one-off with a human check can be a plain prompt.
4. **Does it repeat?** Repetition justifies the effort of a Skill or a workflow.
5. **Does the AI need something it cannot reach?** That is a tool question, not a prompt question.
6. **Can the steps be written down in advance?** If yes, a workflow beats an agent. If the next step depends on what is found, an agent may be justified.
7. **What does an error cost, and who catches it?** Costly, hard-to-reverse errors need a human approval step whatever the rung.

Then ask the question most people skip: **is it worth doing at all?** Sometimes the honest answer is "do nothing".`,
    },
    {
      id: 's3',
      title: 'Workflows versus agents',
      body: `Anthropic's engineering write-up on building agents draws a clear line: **workflows** are systems where "LLMs and tools are orchestrated through predefined code paths", while **agents** are systems where the model "dynamically directs its own processes and tool usage".

Its advice is the heart of this lesson: "find the simplest solution possible, and only increasing complexity when needed", and "consider adding complexity *only* when it demonstrably improves outcomes". Often "optimizing single LLM calls with retrieval and in-context examples is enough". Agents trade latency and cost for flexibility, and their autonomy can compound errors.

So the question is never "can an agent do this?" It is "does an agent beat the simpler option *on this task*, by something I can measure?" Lesson 16 shows how to measure it.`,
    },
    {
      id: 's4',
      title: 'Worked example: six real tasks',
      body: `| Task | Approach | Why |
|---|---|---|
| Convert 300 level files with a fixed mapping | **Script** | Fixed rule, checkable with a diff and a schema check. |
| "Why does this stack trace mention the resolver?" | **Prompt** | One-off judgment you will read yourself. |
| Review every economy change against the same checklist with a simulation run | **Skill** | The same procedure repeats and loads only when relevant. |
| "Never edit anything under /generated" | **Hook** | A rule that must hold every time, enforced as code. |
| Let Claude read tickets in your tracker | **Tool** (MCP or API) | A missing capability, not a missing instruction. |
| Choose the art direction for the fire world | **Human** | Taste and accountability. |

Note what is *not* here: an agent. None of these six needed one. An agent earns its place when, say, you migrate a codebase file by file and each next step depends on what the last one found.`,
    },
  ],
  activity: {
    title: 'Place each task on the ladder',
    intro: 'Guided practice. Every task below is invented. Where more than one approach could work, choose the SIMPLEST that does the job.',
    items: [
      {
        id: 'l11-p1',
        kind: 'classify',
        concept: 'approach-selection',
        prompt: 'Match each task to the simplest approach that fits.',
        categories: LADDER.map((r) => ({ id: r.id, label: r.label })),
        entries: [
          { id: 'e1', text: 'Rename 4,000 files by a fixed pattern', correct: 'software', why: 'A fixed rule you can check with a diff: ordinary software.' },
          { id: 'e2', text: 'Explain one stack trace and suggest where to look', correct: 'prompt', why: 'One-off judgment that you will read and verify yourself.' },
          { id: 'e3', text: 'Decide the art direction for the fire world', correct: 'human', why: 'Taste and accountability stay with a person.' },
          { id: 'e4', text: 'Review every economy change against the same checklist, with a simulation run', correct: 'skill', why: 'A repeated judgment procedure that should load only when relevant.' },
          { id: 'e5', text: 'Never allow edits under /generated, with no exceptions', correct: 'hook', why: 'A rule that must always hold is enforced as code, not asked politely.' },
          { id: 'e6', text: 'Let Claude read and comment on tickets in your issue tracker', correct: 'tool', why: 'It lacks the capability to reach the tracker: a tool question.' },
          { id: 'e7', text: 'Migrate a codebase where each file needs different handling and each next step depends on what was just found', correct: 'agent', why: 'The steps cannot be written in advance: this is where an agent can earn its cost.' },
          { id: 'e8', text: 'Every Friday: collect merged PR titles, draft release notes, run a coverage check, then ask a person to approve', correct: 'workflow', why: 'Known steps in a fixed order, with AI at one of them and a human gate at the end.' },
        ],
        hints: ['Ask first: is the rule fixed and checkable? Then: do the steps vary unpredictably?'],
        explanation: 'Only one of eight tasks needed an agent. Most work sits lower on the ladder.',
      },
      {
        id: 'l11-p2',
        kind: 'single',
        concept: 'approach-selection',
        prompt: 'Decision battle. Constraint: you need the answer in five minutes and you will verify it yourself. Question: which of the 12 enemy types in a CSV you already have open has the highest base reward?',
        options: [
          o('a', 'Sort the column in your spreadsheet (or paste the CSV into a prompt and check the top row yourself)', 'Correct: a trivial, checkable lookup. Nothing more is justified.'),
          o('b', 'Build an agent that explores the whole repository to find the data and reports back with the answer', 'Slower and costlier than the data already in front of you.', 'agents-always-better'),
          o('c', 'Write a Skill so that this question can be answered automatically whenever someone asks it again', 'You asked once. Build a Skill only when a judgment procedure repeats.'),
        ],
        correct: 'a',
        explanation: 'Match the effort to the question.',
      },
      {
        id: 'l11-p3',
        kind: 'multi',
        concept: 'approach-selection',
        prompt: 'Which signals genuinely justify moving up to an agent? Select all.',
        options: [
          o('a', 'The steps cannot be predicted in advance; the next step depends on what is found', 'Correct: that is what an agent is for.'),
          o('b', 'You can verify the outcome independently, not just read the agent\'s summary', 'Correct: autonomy without verification compounds errors.'),
          o('c', 'The value of success justifies the extra cost and latency', 'Correct: agents trade latency and cost for flexibility.'),
          o('d', 'Other developers are using agents', 'Popularity is not a property of your task.', 'agents-always-better'),
          o('e', 'You would rather not write the code', 'Avoiding effort is not a reason; a script may be less effort than supervising an agent.'),
        ],
        correct: ['a', 'b', 'c'],
        hints: ['Look for properties of the TASK, not of the tool.'],
        explanation: 'Unpredictable steps, verifiable outcome and a value that pays for the cost.',
      },
      {
        id: 'l11-p4',
        kind: 'keywords',
        concept: 'approach-selection',
        prompt: 'In one or two sentences: why should "never edit files under /generated" be a hook rather than a line in CLAUDE.md?',
        groups: [
          { label: 'It must hold every time / deterministic', anyOf: ['always', 'every time', 'guarantee', 'deterministic', 'no exceptions', 'enforce'] },
          { label: 'CLAUDE.md is context, not enforcement', anyOf: ['context', 'guidance', 'not enforced', 'can be ignored', 'suggestion', 'instructions'] },
        ],
        placeholder: 'Because a hook runs as code…',
        explanation: 'Claude Code\'s memory docs say CLAUDE.md content is treated as context, not enforced configuration; to block an action regardless of what Claude decides, use a hook.',
      },
      {
        id: 'l11-p5',
        kind: 'single',
        concept: 'approach-selection',
        prompt: 'A designer suggests using AI to regenerate the 40 loading-screen tips. The current list is fine and nobody has complained. What is the best response?',
        options: [
          o('a', 'Do nothing: there is no problem to solve, so any AI approach is cost with no benefit', 'Correct: sometimes the right answer is not to build anything.'),
          o('b', 'Build an agent that rewrites a few tips every night and queues the best ones for review', 'Creates ongoing cost and review work for no demonstrated need.', 'agents-always-better'),
          o('c', 'Write a Skill for loading-screen tips so that future tip changes follow a consistent process', 'Reusable machinery for a problem that does not exist.'),
        ],
        correct: 'a',
        hints: ['Ask what problem would be solved, and how you would know.'],
        explanation: 'Value first, mechanism second.',
      },
    ],
  },
  assessment: {
    title: 'Choose the approach',
    intro: 'New scenarios, no hints. Choose the simplest approach that solves the problem. Some of the best answers involve no AI at all.',
    passMark: 0.75,
    items: [
      {
        id: 'l11-a1',
        kind: 'classify',
        concept: 'approach-selection',
        prompt: 'Place each situation on the ladder.',
        categories: LADDER.map((r) => ({ id: r.id, label: r.label })),
        entries: [
          { id: 'b1', text: 'Block any commit that contains the text "TODO(secret)"', correct: 'hook', why: 'A mechanical rule that must always hold: a deterministic enforcement point.' },
          { id: 'b2', text: 'Draft three alternative names for a new currency', correct: 'prompt', why: 'Creative language work you will judge yourself.' },
          { id: 'b3', text: 'Compute the 95th-percentile session length from a weekly telemetry export', correct: 'software', why: 'Arithmetic on structured data: use code, not a language model.' },
          { id: 'b4', text: 'Investigate an unfamiliar bug where you do not know which files matter and each step depends on what the last one showed', correct: 'agent', why: 'Unpredictable, adaptive exploration is the agent case.' },
          { id: 'b5', text: 'Agree the team\'s monetisation principles', correct: 'human', why: 'A values decision with accountability.' },
          { id: 'b6', text: 'Give Claude read access to your crash-reporting dashboard', correct: 'tool', why: 'A capability gap, closed by a tool or API integration.' },
          { id: 'b7', text: 'Apply the same six-step review every time a pull request touches the economy', correct: 'skill', why: 'A repeated judgment procedure that should load on demand.' },
        ],
        explanation: 'Seven tasks, seven different rungs - and only one agent.',
      },
      {
        id: 'l11-a2',
        kind: 'single',
        concept: 'approach-selection',
        critical: true,
        points: 2,
        prompt: 'A colleague says: "Agents are the most capable option, so we should default to an agent for everything." What is the soundest response?',
        options: [
          o('a', 'Default to the simplest approach that works and add complexity only when it demonstrably improves outcomes', 'Correct: this is the guidance in Anthropic\'s agent-building write-up.'),
          o('b', 'Agree: capability matters more than cost, so the most capable option should be the default for every task', 'Ignores latency, cost, variance and compounding errors.', 'agents-always-better'),
          o('c', 'Agree, but only for tasks longer than one hour, where an agent\'s extra autonomy starts to pay for itself', 'Duration is not the criterion; predictability and verifiability are.', 'agents-always-better'),
          o('d', 'Reject all AI automation until the technology is more reliable, and revisit the question in a year', 'An overcorrection: automation is valuable where it fits.'),
        ],
        correct: 'a',
        explanation: 'Complexity is a cost to be justified.',
      },
      {
        id: 'l11-a3',
        kind: 'single',
        concept: 'approach-selection',
        prompt: 'Decision battle. Constraints: runs 200 times a day, cost must stay low, output is a JSON file that a schema can validate. Approach A: an agent decides how to produce the file each time. Approach B: a script plus one AI call for the single field that needs language, then schema validation. Which is better?',
        options: [
          o('a', 'B: fixed steps, AI only where language is needed, validated mechanically', 'Correct: predictable, cheap, and the outcome is checked by code.'),
          o('b', 'A: an agent is more flexible, so it can handle the cases a fixed script would not anticipate', 'Flexibility you do not need is cost and variance you do pay.', 'agents-always-better'),
          o('c', 'Neither: a task that runs 200 times a day and touches a schema should be done by a person', 'A repeated, checkable task is a good fit for automation.'),
        ],
        correct: 'a',
        explanation: 'A workflow beats an agent when the steps are known.',
      },
      {
        id: 'l11-a4',
        kind: 'multi',
        concept: 'approach-selection',
        prompt: 'Compared with a script, what does an agent ADD? Select all that apply.',
        options: [
          o('a', 'More variance between runs', 'Correct: the model chooses steps, so runs differ.'),
          o('b', 'More cost and latency per task', 'Correct: multiple model calls and tool uses.'),
          o('c', 'More things you must verify', 'Correct: you check the outcome, and the path taken.'),
          o('d', 'Guaranteed correctness', 'Autonomy does not guarantee correctness; errors can compound.'),
          o('e', 'Fewer permissions to manage', 'Agents usually need more tool access, not less.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Flexibility is paid for in variance, cost and verification effort.',
      },
      {
        id: 'l11-a5',
        kind: 'single',
        concept: 'approach-selection',
        prompt: 'Your team has never had a bug caused by inconsistent level-file naming, and nobody asked for tooling. Someone proposes an AI naming assistant. What should you do?',
        options: [
          o('a', 'Do nothing: no problem has been shown, so there is nothing to justify the cost', 'Correct: the best AI project is sometimes none.'),
          o('b', 'Build it anyway so it is ready the moment naming inconsistencies start to cause problems', 'Speculative machinery with running costs and no proof of value.'),
          o('c', 'Make it an agent that learns the team\'s naming style over time and corrects files as it goes', 'Adds the most complexity to the least necessary task.', 'agents-always-better'),
        ],
        correct: 'a',
        explanation: 'Not building is a legitimate outcome.',
      },
      {
        id: 'l11-a6',
        kind: 'reflect',
        concept: 'approach-selection',
        prompt: 'Self-assessment (recorded, not scored). Tick what you can now do without looking back.',
        rubric: [
          'Name the rung for a task and give one reason it is not a rung lower',
          'Say what an agent adds in cost, variance and verification',
          'Give an example where the right answer is ordinary software, and one where it is doing nothing',
        ],
        explanation: 'Honest self-assessment helps you choose what to review.',
      },
    ],
  },
  failureModes: [
    'Reaching for an agent because it sounds more capable than the task requires.',
    'Using a language model for arithmetic, parsing or renaming that code does exactly.',
    'Building a Skill or workflow for something done once.',
    'Putting a must-always-hold rule in a prompt instead of enforcing it as code.',
    'Never asking whether the task is worth doing at all.',
  ],
  application: {
    title: 'Put ten real tasks on the ladder',
    body: 'List ten tasks from your last two weeks of One More Merge work. Place each on the ladder before you look back at how you actually did it. Then find the two where you used the most complex approach and ask: would one rung lower have done it? Practical takeaway: for each, write the one-line reason the simpler rung would or would not have worked.',
    fieldPrompt: 'Log it under Growth → Field evidence when you simplify a real setup (for example replace an agent step with a script) or decide against building something.',
  },
  reviewItems: [
    { id: 'l11-r1', kind: 'single', concept: 'approach-selection', difficulty: 1, prompt: 'Which rung is for a rule that must hold every single time?', options: [o('a', 'A hook (or other deterministic code)', 'Correct: it is enforced as code, not requested.'), o('b', 'A longer, more detailed prompt that states the rule clearly and repeats it at the end of the prompt', 'A prompt is a request, not enforcement.'), o('c', 'An agent that is given the rule as one of its goals and checks it at each step before continuing', 'An agent may choose differently on another run.', 'agents-always-better')], correct: 'a', explanation: 'Deterministic rule, deterministic enforcement.' },
    { id: 'l11-r2', kind: 'single', concept: 'approach-selection', difficulty: 1, prompt: 'What is the difference between a workflow and an agent?', options: [o('a', 'A workflow follows predefined code paths; an agent directs its own steps', 'Correct, per Anthropic\'s definitions.'), o('b', 'A workflow never uses AI, whereas an agent always uses it at every step it takes to finish a task', 'Workflows can call AI at some steps.'), o('c', 'An agent is always cheaper than a workflow, because it only takes the steps that the task needs', 'Agents usually cost more, not less.', 'agents-always-better')], correct: 'a', explanation: 'Who decides the next step?' },
    { id: 'l11-r3', kind: 'single', concept: 'approach-selection', difficulty: 2, prompt: 'You need a one-off summary of a stack trace and you will read it yourself. Which approach is best?', options: [o('a', 'A plain prompt', 'Correct: one-off judgment with a human check.'), o('b', 'A new Skill', 'Build reusable machinery only for repeated work.'), o('c', 'A multi-agent system', 'Far more than the task needs.', 'agents-always-better')], correct: 'a', explanation: 'Low rung for a low-stakes one-off.' },
    { id: 'l11-r4', kind: 'multi', concept: 'approach-selection', difficulty: 2, prompt: 'Select the tasks that are best handled by ordinary software rather than a language model.', options: [o('a', 'Sorting a CSV by a column', 'Correct: fixed and checkable.'), o('b', 'Computing a percentile from telemetry', 'Correct: fixed rules belong in code.'), o('c', 'Choosing a tone for the game\'s tutorial text', 'Judgment about language: a fit for AI plus a human reader.'), o('d', 'Validating JSON against a schema', 'Correct: fixed rules belong in code.')], correct: ['a', 'b', 'd'], explanation: 'Fixed rules belong in code.' },
    { id: 'l11-r5', kind: 'single', concept: 'approach-selection', difficulty: 2, prompt: 'The same six-step judgment review repeats every week and should load only when relevant. Which fits?', options: [o('a', 'A Skill', 'Correct: reusable procedure loaded on demand.'), o('b', 'A hook', 'Hooks enforce mechanical rules; this needs judgment.'), o('c', 'Doing it by hand each time', 'Ignores that the procedure repeats.')], correct: 'a', explanation: 'Repetition plus judgment: a Skill.' },
    { id: 'l11-r6', kind: 'single', concept: 'approach-selection', difficulty: 3, prompt: 'A proposal says "use an agent" for a job whose steps are all known in advance and checkable. What is the strongest objection?', options: [o('a', 'A workflow with fixed steps does the same job with less cost and variance and is easier to verify', 'Correct: when the steps are predictable, autonomy adds nothing but risk.'), o('b', 'Agents cannot use tools, so the job\'s known steps could not be carried out by an agent at all', 'They can; that is not the issue.'), o('c', 'Agents are banned on the team, and a proposal to use one has to be rejected before it is discussed', 'No such rule: the point is fit, not prohibition.', 'agents-always-better')], correct: 'a', explanation: 'Predictable steps favour workflows.' },
    { id: 'l11-r7', kind: 'single', concept: 'approach-selection', difficulty: 3, prompt: 'Which situation is the strongest candidate for an agent?', options: [o('a', 'Migrating a large codebase file by file where each next step depends on what was just found', 'Correct: adaptive and unpredictable, with outcomes you can verify by tests.'), o('b', 'Converting 300 files with a fixed mapping, where the rule is the same for each file and is known', 'Predictable: use a script.', 'agents-always-better'), o('c', 'Sorting a spreadsheet by one column, which a spreadsheet application can do with no model at all', 'A spreadsheet does this.', 'agents-always-better')], correct: 'a', explanation: 'Adaptive exploration with verifiable outcomes.' },
    { id: 'l11-r8', kind: 'single', concept: 'approach-selection', difficulty: 3, prompt: 'Which question best tests whether an AI approach is worth its complexity?', options: [o('a', 'Does it demonstrably improve outcomes over the simpler option on this task?', 'Correct: measure it against the baseline.'), o('b', 'Is it newer than the alternative, so that it benefits from the most recent improvements in the field?', 'Novelty is not a benefit.'), o('c', 'Does it sound more advanced than the alternative', 'Impressiveness is not evidence.', 'agents-always-better')], correct: 'a', explanation: 'Complexity needs evidence.' },
  ],
  sources: [
    { ...ARTICLES.buildingAgents, supports: 'Definitions of workflows and agents; the "find the simplest solution possible" guidance; agents trade latency and cost for flexibility.' },
    { ...DOCS.hooks, supports: 'Hooks give deterministic control: certain actions always happen.' },
    { ...DOCS.memory, supports: 'CLAUDE.md is treated as context, not enforced configuration; use a hook to block an action regardless.' },
  ],
};

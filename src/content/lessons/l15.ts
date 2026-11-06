import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES } from './helpers';

const CONTROLS = [
  { id: 'gate', label: 'A verification gate' },
  { id: 'limit', label: 'A retry limit, then stop' },
  { id: 'human', label: 'A human approval' },
  { id: 'log', label: 'A log of what happened' },
];

/** A fabricated workflow draft. Nothing here is a real process. */
const WF_A = [
  'Goal: Summarise this week\'s player-support tickets and tell the team.',
  'Input: all tickets (whatever the export contains).',
  'Step 1: Claude reads the ticket export.',
  'Step 2: Claude writes a summary and decides whether it is accurate.',
  'Step 3: Claude emails the summary to the whole player mailing list.',
  'On any error: retry until it works.',
  'Done when: Claude says it is done.',
];
const WF_A_TARGETS = [
  { line: 2, severity: 'major' as const, why: 'The input is undefined: "whatever the export contains" cannot be validated, so a malformed or partial export flows straight through.' },
  { line: 4, severity: 'major' as const, why: 'The same step that wrote the summary judges it. That is not an independent check; use a deterministic gate (for example: every ticket id appears once) and, where judgment is needed, a separate reviewer.' },
  { line: 5, severity: 'critical' as const, why: 'An external, irreversible send with no human approval - and to the wrong audience: the goal says "the team", the step mails every player.' },
  { line: 6, severity: 'major' as const, why: 'Unbounded retry. A permanent failure becomes an endless loop of cost. Bound the retries, then stop and report.' },
  { line: 7, severity: 'major' as const, why: '"Claude says it is done" is the model\'s claim, not an observable completion criterion.' },
];

const WF_B = [
  'Goal: Turn merged pull requests into draft release notes for review.',
  'Input: merged PR titles and labels since the last tag, as JSON validated against a schema.',
  'Step 1: A script lists the merged PRs and stops with an error if the list is empty.',
  'Step 2: Claude drafts notes grouped by label.',
  'Step 3: A script checks that every PR number appears exactly once. If not, re-run Step 2 once, then stop and ask a person.',
  'Step 4: Claude publishes the notes to the public site and tags the release.',
  'Step 5: A person reviews the published notes.',
  'Done when: the notes are on the site and the checker reported no missing PRs.',
];
const WF_B_TARGETS = [
  { line: 6, severity: 'critical' as const, why: 'A public, hard-to-undo action happens before any person has looked at the draft. The goal even says "for review".' },
  { line: 7, severity: 'major' as const, why: 'The review comes after publication, so it cannot prevent anything. Move the approval before the irreversible step.' },
];

export const L15: Lesson = {
  id: 'L15-reliable-ai-workflow',
  version: 2,
  track: 'automation',
  alsoIn: ['engineering'],
  order: 15,
  title: 'Build a Reliable AI Workflow',
  subtitle: 'Inputs, outputs, verification gates, failure handling and human approval - designed in, not hoped for',
  prerequisites: ['L11-choose-ai-approach', 'L12-context-engineering'],
  competencies: ['workflow-design'],
  effortMinutes: 35,
  gameRelevance: 1,
  interestTags: ['automation', 'ai-judgment', 'security'],
  problem: 'A teammate builds a Friday workflow: Claude reads the week\'s support tickets, writes a summary and emails it. It worked the first three times. On the fourth run the export was truncated, the summary silently left out half the tickets, and it went to a mailing list nobody meant to include.',
  whyItMatters: 'A workflow that worked once is a demonstration. A workflow you can leave alone has defined inputs and outputs, checks that do not depend on the model\'s say-so, a limit on retries, a human where a mistake is costly, and a way to tell afterwards what happened.',
  objectives: [
    'Describe a workflow with defined inputs, outputs, ordered steps and an observable definition of done.',
    'Put a verification gate after each step that can fail, and prefer gates that do not rely on the model checking itself.',
    'Decide how each step fails: bounded retry, fallback, or stop and escalate.',
    'Place human approval before steps that are external, irreversible or costly, and keep a record of what ran.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Worked once is not reliable',
      prediction: {
        prompt: 'A workflow gave a correct result on its first run. What does that tell you about running it every week unattended?',
        options: [
          o('a', 'Very little: one success shows it can work, not that it keeps working when inputs vary or something fails', 'Reliability comes from design and repeated evidence.'),
          o('b', 'That it is reliable, because the result was correct', 'One correct run is one observation.', 'works-once-reliable'),
          o('c', 'That it will keep working as long as the prompt is long enough', 'Length is not a check.', 'works-once-reliable'),
        ],
        correct: 'a',
      },
      body: `Anthropic's guide to building effective agents separates **workflows** - "LLMs and tools are orchestrated through predefined code paths" - from **agents**, where the model directs its own process. Most repeatable work should start as a workflow: the path is known, so you can put checks on it.

The same guide describes patterns you can combine: **prompt chaining** (a fixed sequence of steps, with programmatic checks - "gates" - between them), **routing**, **parallelization**, **orchestrator-workers** and **evaluator-optimizer**. The patterns are not the lesson. The lesson is what makes *any* of them safe to leave running.`,
    },
    {
      id: 's2',
      title: 'The anatomy of a reliable workflow',
      body: `| Part | The question it answers | A weak version | A strong version |
|---|---|---|---|
| **Inputs** | What exactly goes in, and is it valid? | "whatever the export has" | A named file, validated against a schema; stop if empty |
| **Outputs** | What exactly comes out? | "a summary" | A file in a defined format, with every input id accounted for |
| **Steps** | What happens, in what order? | "Claude handles it" | Numbered steps, each with one job |
| **Gate** | How do we know the step worked? | The model says it looks right | A script, test or count that can fail |
| **Failure handling** | What if it did not? | "retry until it works" | One bounded retry, then stop and report |
| **Human approval** | Who decides before it is too late? | After publication | Before any external or irreversible step |
| **Done** | How do we know it is finished? | "Claude says so" | Something observable: the file exists, the checks passed, a person approved |

Use ordinary code for anything with a right answer you can compute. Keep the model for the steps that need language and judgment.`,
    },
    {
      id: 's3',
      title: 'Gates that can fail',
      body: `A gate is only useful if it can say no. Ranked from strongest to weakest:

1. **Deterministic checks** - a schema, a test suite, a count, a diff that must touch only certain paths. They do not get tired or flattered.
2. **An independent reviewer** - a separate session or agent working from the evidence, not from the author's summary (see the Reviewer / Builder / Integrator lesson).
3. **The author checking its own work** - better than nothing, and the weakest of the three. Never the only gate for something costly.

Claude Code hooks are a way to make a check *always* happen: they run shell commands at defined points rather than relying on the model to remember. The hooks guide and the common-workflows page are linked in Sources.`,
    },
    {
      id: 's4',
      title: 'Failure, approval and a paper trail',
      body: `**Failure handling.** Decide in advance what each failure does: *retry once with new information*, *fall back to a simpler path*, or *stop and tell a person*. Never "retry until it works" - a permanent fault becomes an endless bill.

**Human approval.** Put a person before every step that is **external** (sent, published, charged), **irreversible** (deleted, merged to a protected branch) or **costly if wrong**. Approval *after* the action is a report, not a control.

**A paper trail.** Keep a log of the inputs, the step outcomes and the gate results. Without one, "why did it differ this week?" has no answer.

**Planned versus verified.** A workflow *design* is a plan. Forge's Playbook stores your design and never runs it; mark a step "verified" only when you have actually seen it work, with a note on how.`,
    },
    {
      id: 's5',
      title: 'Worked example: repairing the Friday workflow',
      body: `Original: *read tickets → write summary → email everyone → retry until it works → done when Claude says so.*

Repaired:
1. **Input:** the export file, validated (non-empty, expected columns). **Stop** if not.
2. **Step 1** (script): count the tickets and list their ids.
3. **Step 2** (Claude): draft the summary, citing ticket ids.
4. **Gate** (script): every id from Step 1 is cited at least once. **On failure:** re-run Step 2 once with the missing ids, then **stop and ask a person**.
5. **Human approval:** a person reads the draft and approves *before* anything is sent. The send goes to the team list only.
6. **Log:** inputs, counts, gate result, who approved.
7. **Done when:** the gate passed, a person approved, and the send is logged.`,
    },
  ],
  activity: {
    title: 'Fix a fragile workflow',
    intro: 'Guided practice with a fabricated workflow. Nothing runs; you are reading and designing.',
    items: [
      {
        id: 'l15-p1',
        kind: 'order',
        concept: 'workflow-design',
        prompt: 'Put the design steps in the order a careful person would do them.',
        steps: [
          { id: 'n1', text: 'State the goal and what "done" looks like in observable terms', why: 'Everything else is measured against it.' },
          { id: 'n2', text: 'Define the inputs and outputs, including how to validate the input', why: 'Garbage in is the most common failure.' },
          { id: 'n3', text: 'Break the work into steps with one job each; use code where the answer is computable', why: 'Small steps can be checked individually.' },
          { id: 'n4', text: 'Give every step that can fail a gate that is able to say no', why: 'A check that cannot fail is decoration.' },
          { id: 'n5', text: 'Decide how each step fails: bounded retry, fallback, or stop and escalate', why: 'Do it before the failure happens.' },
          { id: 'n6', text: 'Place human approval before external or irreversible steps, and add logging', why: 'Approval has to come before the action.' },
          { id: 'n7', text: 'Run it repeatedly on varied inputs and record what actually happens', why: 'The design is only a plan until you have seen it work.' },
        ],
        explanation: 'Goal, inputs and outputs, steps, gates, failure handling, approval and logging - then evidence.',
      },
      {
        id: 'l15-p2',
        kind: 'flaglines',
        concept: 'workflow-design',
        filename: 'friday-summary.workflow.txt',
        lines: WF_A,
        prompt: 'Flag the lines that make this workflow unreliable or unsafe.',
        targets: WF_A_TARGETS,
        hints: ['Look at: the input, who checks the summary, the send, the error rule and the definition of done.'],
        explanation: 'Five weaknesses; the send is the critical one: it is external, irreversible, unapproved and aimed at the wrong audience.',
      },
      {
        id: 'l15-p3',
        kind: 'classify',
        concept: 'workflow-design',
        prompt: 'Which control addresses each risk?',
        categories: CONTROLS,
        entries: [
          { id: 'e1', text: 'The summary might silently omit some of the tickets', correct: 'gate', why: 'A check that every id is accounted for can fail.' },
          { id: 'e2', text: 'A malformed file makes a step fail every time, and it keeps retrying for hours', correct: 'limit', why: 'Bound the retries, then stop and report.' },
          { id: 'e3', text: 'The step sends a message to customers that cannot be recalled', correct: 'human', why: 'A person must decide before an irreversible send.' },
          { id: 'e4', text: 'Next week nobody can tell why this week\'s output differed', correct: 'log', why: 'Inputs and outcomes must be recorded.' },
          { id: 'e5', text: 'The drafting step returned text in the wrong format', correct: 'gate', why: 'A format check fails the step immediately.' },
        ],
        explanation: 'Match the control to the failure.',
      },
      {
        id: 'l15-p4',
        kind: 'single',
        concept: 'workflow-design',
        prompt: 'A step\'s gate is "ask Claude whether its own output looks correct". What is the main weakness?',
        options: [
          o('a', 'The author is judging its own work; it can pass output that a deterministic check or an independent reviewer would reject', 'Correct: it is the weakest kind of gate and should not be the only one for anything costly.'),
          o('b', 'It is too slow', 'Speed is not the concern.'),
          o('c', 'Models cannot read their own output', 'They can; the problem is independence, not ability.'),
        ],
        correct: 'a',
        explanation: 'Prefer gates that do not depend on the model\'s own opinion.',
      },
    ],
  },
  assessment: {
    title: 'Design for reliability',
    intro: 'A new workflow, no hints. The approval and the "worked once" questions are mandatory checks. The last item checks your saved Playbook.',
    passMark: 0.8,
    items: [
      {
        id: 'l15-a1',
        kind: 'fields',
        concept: 'workflow-design',
        points: 3,
        prompt: 'Improve this workflow. Answer each part concretely.',
        brief: `**Workflow:** every night, Claude reads the day's crash reports (a JSON export), writes a one-page triage, and posts it to the whole studio's chat channel. If anything goes wrong it tries again until it works. It is finished when Claude says the triage is posted.`,
        fields: [
          {
            id: 'gate',
            label: 'A verification gate after the triage is written',
            help: 'A check that can fail, and who or what runs it.',
            groups: [
              { label: 'a concrete, checkable condition', anyOf: ['count', 'schema', 'every report', 'every crash', 'each report', 'id', 'ids', 'matches', 'compare', 'total', 'all reports'] },
              { label: 'run by something other than the writing step', anyOf: ['script', 'independent', 'separate', 'reviewer', 'tool', 'automated', 'test', 'code', 'validator'] },
            ],
            placeholder: 'e.g. a script checks ...',
          },
          {
            id: 'failure',
            label: 'What happens when the gate fails',
            help: 'Replace "try again until it works".',
            groups: [
              { label: 'a limit on retries', anyOf: ['once', 'twice', 'two attempts', 'three', 'limit', 'at most', 'bounded', 'no more than', 'max'] },
              { label: 'then stop or escalate', anyOf: ['stop', 'escalate', 'ask a person', 'alert', 'halt', 'notify', 'report it', 'human'] },
            ],
            placeholder: 'e.g. retry once, then ...',
          },
          {
            id: 'approval',
            label: 'Where a person decides, and why there',
            help: 'Think about who sees the post and whether it can be undone.',
            groups: [
              { label: 'before the post', anyOf: ['before', 'prior to', 'first review', 'approve', 'approval', 'sign off', 'sign-off', 'reviews it'] },
              { label: 'because it is visible or hard to undo', anyOf: ['whole studio', 'everyone', 'public', 'visible', 'cannot be undone', 'irreversible', 'seen by', 'external', 'embarrass'] },
            ],
            placeholder: 'e.g. a lead approves the draft before ...',
          },
          {
            id: 'done',
            label: 'An observable definition of done',
            help: 'Something other than "Claude says so".',
            groups: [
              { label: 'something you can observe', anyOf: ['posted', 'exists', 'file', 'report', 'logged', 'log', 'published', 'delivered', 'message appears'] },
              { label: 'confirmed by a check or a person', anyOf: ['check passed', 'checks pass', 'gate passed', 'verified', 'confirmed', 'approved', 'script', 'passed'] },
            ],
            placeholder: 'e.g. done when ...',
          },
        ],
        explanation: 'A gate that can fail, bounded retries then stop, approval before the post, and a done condition anyone can observe.',
      },
      {
        id: 'l15-a2',
        kind: 'flaglines',
        concept: 'workflow-design',
        filename: 'release-notes.workflow.txt',
        lines: WF_B,
        prompt: 'Flag only the lines that carry a real reliability or safety problem. Several lines here are good design.',
        targets: WF_B_TARGETS,
        explanation: 'The validated input, the script gates and the bounded retry are good; publishing before approval, and reviewing afterwards, are the problems.',
      },
      {
        id: 'l15-a3',
        kind: 'single',
        concept: 'workflow-design',
        critical: true,
        points: 2,
        prompt: 'A new AI workflow produced a correct result the first time you ran it. Which is the sound conclusion?',
        options: [
          o('a', 'You have one observation; it needs defined inputs and outputs, checks that can fail, failure handling and repeated runs before you can rely on it', 'Correct: reliability is designed and then evidenced.'),
          o('b', 'It is reliable, because the result was correct', 'One run cannot show consistency.', 'works-once-reliable'),
          o('c', 'It is reliable if the prompt is detailed', 'A detailed prompt is not a check.', 'works-once-reliable'),
          o('d', 'It is reliable once it has run without any error message', 'No error is not the same as a correct result.', 'works-once-reliable'),
        ],
        correct: 'a',
        explanation: 'One success is an anecdote.',
      },
      {
        id: 'l15-a4',
        kind: 'single',
        concept: 'workflow-design',
        critical: true,
        points: 2,
        prompt: 'A workflow step will delete 400 old build artifacts from shared storage. Where does the human approval belong?',
        options: [
          o('a', 'Before the delete, showing the list of what will be removed', 'Correct: approval must precede an irreversible action.'),
          o('b', 'After the delete, as a report to check', 'After the fact it is a report, not a control.'),
          o('c', 'Nowhere - the model checked its own list', 'A self-check is not a substitute for a decision on an irreversible action.'),
          o('d', 'Only if the delete fails', 'It is the successful delete that cannot be undone.'),
        ],
        correct: 'a',
        explanation: 'Approve before the irreversible step.',
      },
      {
        id: 'l15-a5',
        kind: 'multi',
        concept: 'workflow-design',
        prompt: 'Which of these are verification gates that can actually fail independently of the drafting step? Select all.',
        options: [
          o('a', 'A script that confirms every input id appears in the output', 'A deterministic check.'),
          o('b', 'A test suite that must pass before the change is accepted', 'A deterministic check.'),
          o('c', 'A separate reviewer session working from the evidence', 'Independent of the author.'),
          o('d', 'The drafting step stating that its output looks good', 'The author vouching for itself.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Deterministic and independent checks count; self-assessment alone does not.',
      },
      {
        id: 'l15-a6',
        kind: 'classify',
        concept: 'workflow-design',
        prompt: 'Which control addresses each risk?',
        categories: CONTROLS,
        entries: [
          { id: 'b1', text: 'The model drops three records and the summary still reads well', correct: 'gate', why: 'A count or id check catches silent omission.' },
          { id: 'b2', text: 'A step posts to a public channel and cannot be unposted', correct: 'human', why: 'Approval before an external, irreversible action.' },
          { id: 'b3', text: 'The upstream API is down for two days and the job keeps calling it', correct: 'limit', why: 'Bounded retries, then stop and report.' },
          { id: 'b4', text: 'You need to find which input produced last Tuesday\'s odd output', correct: 'log', why: 'A record of inputs and outcomes.' },
        ],
        explanation: 'One control per failure.',
      },
      {
        id: 'l15-a7',
        kind: 'external',
        concept: 'workflow-design',
        check: 'playbook-workflow',
        points: 3,
        prompt: 'Save a real workflow in Build → Playbooks: a goal, inputs and outputs, at least four steps each with a verification gate, failure handling on two steps, one human approval point and completion criteria. The checklist verifies your saved design (it does not run it).',
        explanation: 'A playbook is a design. Mark steps "verified" only after you have seen them work.',
      },
      {
        id: 'l15-a8',
        kind: 'reflect',
        concept: 'workflow-design',
        prompt: 'Self-assessment (recorded, not scored).',
        rubric: [
          'I can name the input, output, gate, failure rule, approval and done condition of a workflow',
          'I prefer gates that can fail independently of the model that did the work',
          'I put human approval before external or irreversible steps, not after',
        ],
        explanation: 'Reliability is designed in.',
      },
    ],
  },
  failureModes: [
    'Treating one successful run as proof.',
    'A step that grades its own output as the only check.',
    '"Retry until it works" with no limit.',
    'Human approval placed after the irreversible step.',
    'Defining "done" as the model saying so.',
    'No log, so a surprising result cannot be traced.',
  ],
  application: {
    title: 'Harden one repeatable task',
    body: 'Pick a task you already repeat with AI help (a weekly summary, release notes, a triage pass). Write it as a playbook: input, output, steps, one gate per step that can fail, how each failure is handled, the approval point and the done condition. Then run it on three different inputs and record what actually happened. Practical takeaway: mark a step verified only when you have seen it pass, and keep the run notes.',
    fieldPrompt: 'Log it under Growth → Field evidence when a workflow you hardened catches a real failure that would have gone through unnoticed.',
  },
  reviewItems: [
    { id: 'l15-r1', kind: 'single', concept: 'workflow-design', difficulty: 1, prompt: 'What separates a workflow from an agent, in Anthropic\'s building-effective-agents guide?', options: [o('a', 'A workflow follows predefined code paths; an agent directs its own process', 'Correct: it matches the practice taught in this lesson.'), o('b', 'A workflow never uses a model', 'Workflows orchestrate models and tools.'), o('c', 'An agent is always more reliable', 'Autonomy trades predictability for flexibility.', 'agents-always-better')], correct: 'a', explanation: 'Predefined path versus self-directed.' },
    { id: 'l15-r2', kind: 'single', concept: 'workflow-design', difficulty: 1, prompt: 'Where does human approval belong relative to an irreversible step?', options: [o('a', 'Before it', 'Correct: it matches the practice taught in this lesson.'), o('b', 'After it', 'Then it is a report, not a control.'), o('c', 'Nowhere, if tests pass', 'Tests do not decide irreversible actions.')], correct: 'a', explanation: 'Approval has to come before the irreversible step.' },
    { id: 'l15-r3', kind: 'single', concept: 'workflow-design', difficulty: 2, prompt: 'A job retries a failing API call forever. What is the right fix?', options: [o('a', 'Bound the retries, then stop and report', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Retry faster', 'Makes it worse.'), o('c', 'Hide the error', 'You lose the signal.')], correct: 'a', explanation: 'A permanent fault needs a stop.' },
    { id: 'l15-r4', kind: 'multi', concept: 'workflow-design', difficulty: 2, prompt: 'Select the parts every reliable workflow needs defined.', options: [o('a', 'Inputs and how they are validated', 'Correct: it matches the practice taught in this lesson.'), o('b', 'A gate after each step that can fail', 'Correct: it matches the practice taught in this lesson.'), o('c', 'An observable definition of done', 'Correct: it matches the practice taught in this lesson.'), o('d', 'The longest possible prompt', 'Not a workflow property.', 'longer-prompt-better')], correct: ['a', 'b', 'c'], explanation: 'Inputs, gates, done.' },
    { id: 'l15-r5', kind: 'single', concept: 'workflow-design', difficulty: 2, prompt: 'Which done condition is best?', options: [o('a', 'The checks passed, a person approved, and the send is in the log', 'Correct: observable and independent.'), o('b', 'Claude says it finished', 'The model\'s claim.', 'confident-trace-success'), o('c', 'No error appeared', 'Absence of an error is not a result.')], correct: 'a', explanation: 'Observable evidence.' },
    { id: 'l15-r6', kind: 'single', concept: 'workflow-design', difficulty: 3, prompt: 'A step has a deterministic count check and also a model self-review. Which is the stronger gate?', options: [o('a', 'The count check; the self-review can supplement it but should not replace it', 'Correct: it matches the practice taught in this lesson.'), o('b', 'The self-review', 'The author cannot be independent.', 'self-review-independent'), o('c', 'Both are equal', 'A check that can fail beats an opinion.')], correct: 'a', explanation: 'Deterministic first.' },
    { id: 'l15-r7', kind: 'single', concept: 'workflow-design', difficulty: 3, prompt: 'A workflow succeeded three times. Which addition best raises your confidence in it?', options: [o('a', 'Repeated runs on varied inputs, including a malformed one, with the results recorded', 'Correct: reliability needs evidence under variation.'), o('b', 'A longer prompt', 'Not evidence.', 'works-once-reliable'), o('c', 'A bigger model', 'The same gates are still needed.', 'works-once-reliable')], correct: 'a', explanation: 'Vary the inputs and record.' },
    { id: 'l15-r8', kind: 'single', concept: 'workflow-design', difficulty: 3, prompt: 'In Forge\'s Playbook, when should a step be marked "verified"?', options: [o('a', 'Only after you have seen it work, with a note on how', 'Correct: a design is a plan until observed.'), o('b', 'As soon as you write it', 'Writing is planning.', 'marking-is-mastery'), o('c', 'When the playbook is exported', 'Exporting changes nothing about the step.')], correct: 'a', explanation: 'Planned versus verified.' },
  ],
  sources: [
    { ...ARTICLES.buildingAgents, supports: 'Workflows versus agents, the five workflow patterns, and programmatic gates between prompt-chain steps.' },
    { ...DOCS.hooks, supports: 'Running checks at defined points with hooks so they happen deterministically.' },
    { ...DOCS.workflows, supports: 'Common repeatable workflows in Claude Code.' },
  ],
};

import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES } from './helpers';

const MODES = [
  { id: 'sequential', label: 'One session, in order' },
  { id: 'parallel', label: 'Parallel sessions or agents' },
  { id: 'explore', label: 'Delegate read-only exploration' },
  { id: 'manual', label: 'Just do it by hand' },
];

/** A fabricated session log. Nothing here is a real transcript. */
const LOG_A = [
  'You: Build the whole inventory system - crafting, trading and save/load.',
  'Claude: [writes about 2,400 lines across 19 files]',
  'You: Does it work?',
  'Claude: Yes, everything is implemented and working.',
  'You: [commits all 19 files as one commit]',
  'You: [opens three sessions, all asked to edit inventory.ts]',
  'You: [asks an unrelated UI question in the same long session]',
];
const LOG_A_TARGETS = [
  { line: 1, severity: 'major' as const, why: 'No decomposition and no acceptance criteria: one huge request produces one huge, unreviewable result.' },
  { line: 4, severity: 'critical' as const, why: '"Everything is implemented and working" is a claim. Nothing was run; ask for the tests and read the output.' },
  { line: 5, severity: 'minor' as const, why: 'One giant commit leaves no checkpoint to return to if the next step goes wrong.' },
  { line: 6, severity: 'major' as const, why: 'Three agents editing the same file guarantees conflicts and re-work. Parallel needs independent work.' },
  { line: 7, severity: 'minor' as const, why: 'An unrelated question fills a long session with context that competes with the task. Start a fresh session.' },
];

const LOG_B = [
  'You: We need save/load for the game. Plan first; do not write code yet.',
  'Claude: [proposes four slices: schema, writer, reader, migration]',
  'You: Start with the schema and a failing round-trip test.',
  'Claude: [writes schema and one test; runs it; shows the failure]',
  'You: Now make it pass. Then show me the diff.',
  'Claude: [implements the writer; test passes; shows a 40-line diff]',
  'You: Next, the reader. Claude: Done, all tests pass.',
  'You: [commits the slice, then starts the next one]',
];
const LOG_B_TARGETS = [
  { line: 7, severity: 'major' as const, why: '"All tests pass" arrives with no test output shown and no diff review, unlike the earlier slices. Ask to see the run.' },
];

export const L17: Lesson = {
  id: 'L17-efficient-ai-development',
  version: 2,
  track: 'engineering',
  alsoIn: ['claude-code'],
  order: 17,
  title: 'Efficient AI-Assisted Development',
  subtitle: 'Decompose, verify and delegate - and know when parallel work, a fresh session or doing it by hand is faster',
  prerequisites: ['L12-context-engineering'],
  competencies: ['efficient-ai-development'],
  effortMinutes: 30,
  gameRelevance: 2,
  interestTags: ['foundations', 'ai-judgment', 'orchestration'],
  problem: 'You ask Claude for an entire inventory system in one message. Twenty minutes later there are nineteen changed files, a claim that "everything works", and no idea which part is wrong. You open three more sessions to speed things up, and they all edit the same file.',
  whyItMatters: 'AI makes producing code cheap and checking it expensive. Speed comes from keeping the work in pieces small enough to verify, saving parallelism for work that is really independent, and spending your attention where mistakes cost most.',
  objectives: [
    'Decompose a feature into slices small enough to verify, each with an acceptance check.',
    'Verify AI output with a run and a diff, not with the AI\'s own report.',
    'Choose between one session, parallel sessions, delegated exploration and doing it by hand.',
    'Keep context useful: fresh sessions for unrelated work, and checkpoints you can return to.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Cheap to generate, costly to check',
      prediction: {
        prompt: 'You can run three AI sessions at once. When does running them in parallel actually save time?',
        options: [
          o('a', 'When the tasks are independent - separate files, separate checks - so each result can be verified and merged on its own', 'Independence is the precondition.'),
          o('b', 'Always: three sessions are three times as fast', 'Parallel work needs coordination and review, and shared files conflict.', 'parallel-always-faster'),
          o('c', 'When all three work on the same function so the best answer wins', 'That multiplies review work and conflicts.', 'parallel-always-faster'),
        ],
        correct: 'a',
      },
      body: `Generating a change takes seconds. **Understanding and verifying it** takes your time, and that is the scarce resource. Efficient AI-assisted development is mostly about reducing review cost per unit of progress: smaller changes, clearer acceptance checks, and fewer things to read twice.

Anthropic's guide to context engineering makes the same point from the model's side: the aim is the *smallest set of high-signal information* that gets the result you want, and long sessions full of unrelated history compete with the task at hand.`,
    },
    {
      id: 's2',
      title: 'Decompose into verifiable slices',
      body: `A good slice is small enough that you can read its diff in a few minutes and has **a check that can fail**.

1. **Outcome and acceptance** - what must be true when this slice is done, observed how?
2. **Explore first, in plan mode if you like** - have Claude read the relevant code and propose slices *before* it changes anything. Claude Code's common-workflows page describes Plan Mode for this.
3. **Test first where you can** - a failing test is an acceptance criterion the model cannot argue with.
4. **One slice at a time** - implement, run, read the diff.
5. **Checkpoint** - commit a working slice so the next mistake is cheap to undo.

If a slice keeps failing, it is usually too big or its acceptance check is vague. Cut it again.`,
    },
    {
      id: 's3',
      title: 'Verify with a run, not a report',
      body: `"All tests pass" from the model is a **claim**. The evidence is the test command's actual output, in the transcript, that you or a script can read.

- Ask for the run and read the result, or run it yourself.
- Read the **diff**, not the summary: does it touch only what the slice needed?
- Check **negative cases**: ask what would make the new test fail, and whether it would.
- Treat a surprisingly clean result as a reason to look closer, not a reason to relax.

Verification you cannot see is not verification.`,
    },
    {
      id: 's4',
      title: 'Parallel, delegated or by hand',
      body: `| Situation | Prefer | Why |
|---|---|---|
| Each step needs the previous result | **One session, in order** | Nothing to parallelise |
| Two modules, separate files, separate tests | **Parallel sessions** (for example, separate git worktrees) | Independent work can be verified and merged separately |
| "Where does the save logic live?" in an unfamiliar codebase | **Delegate read-only exploration** to a subagent | The exploration noise stays out of your main context; you get a summary back |
| A one-line rename in one file | **By hand** | Explaining it costs more than doing it |
| Three agents refactoring the same function | **Do not** | Guaranteed conflicts |

The Claude Code docs describe running parallel sessions with git worktrees, and subagents that work in their own context. Parallelism adds **coordination and review cost**; it pays off only when the work really is independent.`,
    },
    {
      id: 's5',
      title: 'Keep context useful, keep checkpoints',
      body: `- **Start fresh for unrelated work.** A long session accumulates history that competes with the current task; \`/clear\` between unrelated tasks (or a new session) resets it.
- **Put durable facts in CLAUDE.md**, not in a prompt you will retype: conventions, how to run the tests, what never to touch.
- **Commit working slices.** A checkpoint turns "it broke everything" into a one-command undo.
- **Know what you are spending.** Cost and time depend on your plan and usage; do not guess at figures - read them from a real usage report when they matter.
- **Spend your attention where mistakes cost most:** the data model, security boundaries and irreversible steps - not formatting.`,
    },
    {
      id: 's6',
      title: 'Worked example: slicing a leaderboard',
      body: `*Task: store the top 10 scores locally, show them on the title screen, and let the settings menu clear them.* One request would produce one large change to review. Sliced:

1. **Slice 1 - the data rule.** A pure function \`insertScore(list, score)\` that keeps the ten highest, sorted. *Acceptance:* a failing test first (eleven scores in, the lowest dropped, ties stable), then the implementation; the real test output is read. Commit.
2. **Slice 2 - persistence.** Save and load the list. *Acceptance:* a round-trip test, plus "corrupt stored data loads as an empty list". Commit.
3. **Slice 3 - the title-screen view.** Read-only list. Verify by running the game and looking, not by trusting a description. Commit.
4. **Slice 4 - clear from settings.** Includes a confirm step (a person decides before data is deleted). Commit.

Slices 3 and 4 touch different files and could run in parallel *after* slice 2 - the dependency, not the number of agents, decides. A one-line typo fix found on the way is done by hand.`,
    },
  ],
  activity: {
    title: 'Slice it, verify it, pick the mode',
    intro: 'Guided practice with fabricated sessions. Nothing runs.',
    items: [
      {
        id: 'l17-p1',
        kind: 'classify',
        concept: 'efficient-ai-development',
        prompt: 'Choose the most efficient way to work on each task.',
        categories: MODES,
        entries: [
          { id: 'e1', text: 'Two independent modules, each with its own tests and no shared files', correct: 'parallel', why: 'Independent work can be verified and merged separately.' },
          { id: 'e2', text: 'Each step needs the output of the previous one', correct: 'sequential', why: 'Sequential by nature.' },
          { id: 'e3', text: 'Find where the save logic lives in an unfamiliar codebase', correct: 'explore', why: 'Read-only exploration can be delegated; the noise stays out of your context.' },
          { id: 'e4', text: 'Rename one variable in one file', correct: 'manual', why: 'Explaining costs more than doing.' },
        ],
        explanation: 'Match the mode to the dependency structure.',
      },
      {
        id: 'l17-p2',
        kind: 'order',
        concept: 'efficient-ai-development',
        prompt: 'Order one slice of AI-assisted work.',
        steps: [
          { id: 'o1', text: 'State the outcome and how you will observe it', why: 'An acceptance check up front.' },
          { id: 'o2', text: 'Have Claude read the code and propose slices before changing anything', why: 'Explore and plan first.' },
          { id: 'o3', text: 'Write (or have Claude write) a failing test for the slice', why: 'A check that can fail.' },
          { id: 'o4', text: 'Implement just that slice and run the test', why: 'Small and verifiable.' },
          { id: 'o5', text: 'Read the diff and the real test output', why: 'Evidence, not the report.' },
          { id: 'o6', text: 'Commit the working slice as a checkpoint', why: 'Cheap undo for the next step.' },
        ],
        explanation: 'Accept, plan, test, implement, verify, checkpoint.',
      },
      {
        id: 'l17-p3',
        kind: 'flaglines',
        concept: 'efficient-ai-development',
        filename: 'session-log-a.txt',
        lines: LOG_A,
        prompt: 'Flag the lines that waste time or hide risk.',
        targets: LOG_A_TARGETS,
        hints: ['Look at the size of the request, what was checked, what was committed and how the parallel work was arranged.'],
        explanation: 'The unverified "everything works" is the critical one; the rest are avoidable cost.',
      },
      {
        id: 'l17-p4',
        kind: 'single',
        concept: 'efficient-ai-development',
        prompt: 'A change touches 19 files and the model says it all works. What is the efficient next move?',
        options: [
          o('a', 'Have it run the tests, read the output and diff, and re-split the work into smaller slices if it fails', 'Correct: verify with evidence and keep slices small.'),
          o('b', 'Accept it - the model sounded sure', 'Confidence is not evidence.', 'confident-trace-success'),
          o('c', 'Ask it three times whether it is sure', 'The same author vouching again.'),
        ],
        correct: 'a',
        explanation: 'Evidence and smaller slices.',
      },
    ],
  },
  assessment: {
    title: 'Work efficiently',
    intro: 'A new feature and a new session log, no hints. The parallel-work and "it says it works" questions are mandatory checks.',
    passMark: 0.8,
    items: [
      {
        id: 'l17-a1',
        kind: 'fields',
        concept: 'efficient-ai-development',
        points: 3,
        prompt: 'Decompose this task into a first slice you can verify. Answer each part concretely.',
        brief: `**Task:** "Add a leaderboard to the game: store the top 10 scores locally, show them on the title screen, and clear them from the settings menu."`,
        fields: [
          {
            id: 'slice',
            label: 'The first, smallest slice',
            help: 'Pick one piece you could finish and check on its own.',
            groups: [
              { label: 'a single small piece', anyOf: ['storage', 'store', 'data model', 'schema', 'save the scores', 'record a score', 'sorting', 'top 10 list', 'first slice', 'just the', 'only the'] },
            ],
            placeholder: 'e.g. just the ... , without the UI',
          },
          {
            id: 'accept',
            label: 'How you will know that slice is done',
            help: 'An acceptance check that can fail.',
            groups: [
              { label: 'a check that can fail', anyOf: ['test', 'tests', 'assert', 'check', 'expected', 'unit test', 'should return', 'fails if'] },
              { label: 'a concrete behaviour', anyOf: ['top 10', 'ten', 'sorted', 'highest', 'order', 'drops', 'keeps only', 'persist', 'reload', 'survives'] },
            ],
            placeholder: 'e.g. a test that ...',
          },
          {
            id: 'verify',
            label: 'How you verify the AI\'s result',
            help: 'Evidence you read yourself.',
            groups: [
              { label: 'run it', anyOf: ['run the test', 'run the tests', 'run it', 'test output', 'see it pass', 'see it fail', 'execute'] },
              { label: 'read the change', anyOf: ['diff', 'read the change', 'review the change', 'read the code', 'review the code', 'inspect'] },
            ],
            placeholder: 'e.g. I run ... and read ...',
          },
          {
            id: 'checkpoint',
            label: 'What you do before the next slice',
            help: 'Make the next mistake cheap.',
            groups: [
              { label: 'a checkpoint', anyOf: ['commit', 'checkpoint', 'save point', 'branch', 'snapshot', 'git add', 'tag it'] },
            ],
            placeholder: 'e.g. ...',
          },
        ],
        explanation: 'One small slice, an acceptance check that can fail, a run plus a diff, and a checkpoint.',
      },
      {
        id: 'l17-a2',
        kind: 'classify',
        concept: 'efficient-ai-development',
        prompt: 'Choose the most efficient way to work on each task.',
        categories: MODES,
        entries: [
          { id: 'b1', text: 'Update the audio code and, separately, the localisation tables; no shared files, separate tests', correct: 'parallel', why: 'Independent and separately checkable.' },
          { id: 'b2', text: 'Implement a parser, then the transformer that consumes its output, then the writer', correct: 'sequential', why: 'Each step depends on the last.' },
          { id: 'b3', text: 'Learn how the existing quest system loads data before planning a change', correct: 'explore', why: 'Delegate the reading; keep the summary.' },
          { id: 'b4', text: 'Fix a typo in a comment', correct: 'manual', why: 'Faster by hand than explaining.' },
        ],
        explanation: 'Mode follows dependency.',
      },
      {
        id: 'l17-a3',
        kind: 'flaglines',
        concept: 'efficient-ai-development',
        filename: 'session-log-b.txt',
        lines: LOG_B,
        prompt: 'Flag only the lines that carry a real efficiency or verification problem. Most of this session is good practice.',
        targets: LOG_B_TARGETS,
        explanation: 'Planning first, a failing test, a diff review and a commit per slice are all good; the unverified "all tests pass" on the reader slice is the slip.',
      },
      {
        id: 'l17-a4',
        kind: 'single',
        concept: 'efficient-ai-development',
        critical: true,
        points: 2,
        prompt: 'You want to refactor one core function quickly. Which plan is most likely to save time?',
        options: [
          o('a', 'One session refactors it in small verified steps, with the tests run after each', 'Correct: the work is a single dependent unit.'),
          o('b', 'Three agents each refactor it in parallel, then you pick the best', 'Three conflicting versions to review and no way to merge them.', 'parallel-always-faster'),
          o('c', 'Three agents each refactor a third of the same function', 'They will conflict and break each other.', 'parallel-always-faster'),
          o('d', 'Split it across five agents so it is five times faster', 'More agents on dependent work add coordination, not speed.', 'parallel-always-faster'),
        ],
        correct: 'a',
        explanation: 'Parallel needs independence.',
      },
      {
        id: 'l17-a5',
        kind: 'single',
        concept: 'efficient-ai-development',
        critical: true,
        points: 2,
        prompt: 'The model finishes a change and reports "all tests pass". What do you do before accepting it?',
        options: [
          o('a', 'Look for the actual test run and its output in the transcript (or run the tests yourself) and read the diff', 'Correct: the evidence, not the narration.'),
          o('b', 'Accept it because the message was confident', 'Confidence is not evidence.', 'confident-trace-success'),
          o('c', 'Accept it because the message was long and detailed', 'Length is not evidence.', 'confident-trace-success'),
          o('d', 'Ask the model to confirm again', 'The same author vouching for itself.', 'confident-trace-success'),
        ],
        correct: 'a',
        explanation: 'Verify with a run.',
      },
      {
        id: 'l17-a6',
        kind: 'multi',
        concept: 'efficient-ai-development',
        prompt: 'Which habits keep an AI session efficient? Select all.',
        options: [
          o('a', 'Start a fresh session for an unrelated task', 'Old history competes with the new task.'),
          o('b', 'Commit each working slice', 'A cheap undo.'),
          o('c', 'Put durable conventions in CLAUDE.md instead of retyping them', 'Persistent context, loaded when needed.'),
          o('d', 'Keep one conversation going for everything so nothing is lost', 'A long mixed history is noise for the current task.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Fresh context, checkpoints and persistent instructions.',
      },
      {
        id: 'l17-a7',
        kind: 'single',
        concept: 'efficient-ai-development',
        prompt: 'A one-line off-by-one fix in a function you are already looking at. What is the efficient move?',
        options: [
          o('a', 'Make the change yourself and run the relevant test', 'Correct: explaining would take longer than fixing.'),
          o('b', 'Plan it with Claude, write a spec and run three agents', 'Overhead out of proportion to the change.'),
          o('c', 'Start a new session to describe the whole module first', 'Overhead out of proportion to the change.'),
        ],
        correct: 'a',
        explanation: 'Doing it by hand is sometimes the efficient AI-era choice.',
      },
      {
        id: 'l17-a8',
        kind: 'reflect',
        concept: 'efficient-ai-development',
        prompt: 'Self-assessment (recorded, not scored).',
        rubric: [
          'I can break a feature into slices that each have a check that can fail',
          'I verify with a real run and a diff before accepting AI output',
          'I choose parallel work only when the pieces are really independent',
        ],
        explanation: 'Efficiency is smaller, checked steps.',
      },
    ],
  },
  failureModes: [
    'One enormous request with no acceptance criteria.',
    'Accepting "it works" without seeing a run.',
    'Parallel sessions editing the same files.',
    'One long session carrying unrelated history.',
    'No checkpoints, so a bad step is expensive to undo.',
    'Using AI for a change faster done by hand.',
  ],
  application: {
    title: 'Slice your next real task',
    body: 'Take the next real change you would hand to Claude. Write the outcome and acceptance check first, ask for a plan and a list of slices, then do only the first slice: failing test, implementation, real test output, diff, commit. Note where you were tempted to skip a step. Practical takeaway: keep the slice list and compare how long the sliced approach took against what you would have expected from one big request.',
    fieldPrompt: 'Log it under Growth → Field evidence when slicing and verifying caught a defect that a single big request would have buried.',
  },
  reviewItems: [
    { id: 'l17-r1', kind: 'single', concept: 'efficient-ai-development', difficulty: 1, prompt: 'What is a good property of a slice of AI-assisted work?', options: [o('a', 'Small enough to review, with a check that can fail', 'Correct: it matches the practice taught in this lesson.'), o('b', 'As large as possible', 'Large changes are hard to verify.'), o('c', 'Free of tests', 'Tests are the acceptance check.')], correct: 'a', explanation: 'Small and checkable.' },
    { id: 'l17-r2', kind: 'single', concept: 'efficient-ai-development', difficulty: 1, prompt: 'When is it best to start a fresh session?', options: [o('a', 'When you switch to an unrelated task', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Never', 'Long mixed history competes with the task.'), o('c', 'Only after a failure', 'Context hygiene is not only for failures.')], correct: 'a', explanation: 'Reset context for unrelated work.' },
    { id: 'l17-r3', kind: 'single', concept: 'efficient-ai-development', difficulty: 2, prompt: 'Which pair of tasks is the best fit for parallel sessions?', options: [o('a', 'Two modules with separate files and separate tests', 'Correct: independent.'), o('b', 'Two agents editing the same function', 'Parallel edits to the same function collide.', 'parallel-always-faster'), o('c', 'Two steps where the second needs the first\'s output', 'A dependent step has to wait for the first.', 'parallel-always-faster')], correct: 'a', explanation: 'Independence is the precondition for parallel work.' },
    { id: 'l17-r4', kind: 'multi', concept: 'efficient-ai-development', difficulty: 2, prompt: 'Select the evidence that a change works.', options: [o('a', 'The test command\'s real output', 'Correct: it matches the practice taught in this lesson.'), o('b', 'The diff, read by you', 'Correct: it matches the practice taught in this lesson.'), o('c', 'A new failing-then-passing test', 'Correct: it matches the practice taught in this lesson.'), o('d', 'The model saying "done"', 'That is the model\'s own claim, not observable evidence.', 'confident-trace-success')], correct: ['a', 'b', 'c'], explanation: 'Observable evidence.' },
    { id: 'l17-r5', kind: 'single', concept: 'efficient-ai-development', difficulty: 2, prompt: 'Why commit after each working slice?', options: [o('a', 'It gives you a cheap undo if the next slice goes wrong', 'Correct: it matches the practice taught in this lesson.'), o('b', 'To make the history longer', 'Not the point.'), o('c', 'Because the model requires it', 'It does not.')], correct: 'a', explanation: 'Commit working slices so the next mistake is cheap to undo.' },
    { id: 'l17-r6', kind: 'single', concept: 'efficient-ai-development', difficulty: 3, prompt: 'A slice keeps failing on the third attempt. What is the best response?', options: [o('a', 'Cut it smaller or sharpen its acceptance check', 'Correct: the slice is probably too big or vague.'), o('b', 'Ask for the same thing in capital letters', 'Emphasis adds no information.', 'longer-prompt-better'), o('c', 'Add more agents', 'More agents on a vague slice add noise.', 'parallel-always-faster')], correct: 'a', explanation: 'Repeated failure is a sizing or specification signal.' },
    { id: 'l17-r7', kind: 'single', concept: 'efficient-ai-development', difficulty: 3, prompt: 'Where should you spend the most careful review attention?', options: [o('a', 'Data models, security boundaries and irreversible steps', 'Correct: where mistakes cost most.'), o('b', 'Whitespace', 'Low cost if wrong.'), o('c', 'Everything equally', 'Attention is finite.')], correct: 'a', explanation: 'Weight review by consequence.' },
    { id: 'l17-r8', kind: 'single', concept: 'efficient-ai-development', difficulty: 3, prompt: 'Someone says "AI made us 40% faster" with no measurements. How do you treat it?', options: [o('a', 'As an unsupported claim; ask how it was measured and consider a small experiment of your own', 'Correct: it matches the practice taught in this lesson.'), o('b', 'As established fact', 'A specific number is not a method.', 'vendor-claim-is-evidence'), o('c', 'As proof if many people say it', 'Repetition is not measurement.', 'vendor-claim-is-evidence')], correct: 'a', explanation: 'Numbers need methods.' },
  ],
  sources: [
    { ...DOCS.workflows, supports: 'Plan Mode, parallel sessions with git worktrees, and common development workflows in Claude Code.' },
    { ...DOCS.subagents, supports: 'Delegating focused work to subagents that run in their own context.' },
    { ...ARTICLES.contextEngineering, supports: 'Using the smallest set of high-signal context, and why long mixed histories compete with the task.' },
    { ...DOCS.memory, supports: 'Putting durable project instructions in CLAUDE.md.' },
  ],
};

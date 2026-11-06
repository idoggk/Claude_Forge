import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES } from './helpers';

const ELEMENTS = [
  { id: 'context', label: 'Context' },
  { id: 'constraints', label: 'Constraints' },
  { id: 'scope', label: 'Scope' },
  { id: 'acceptance', label: 'Acceptance criteria' },
  { id: 'verification', label: 'Verification' },
  { id: 'noise', label: 'Noise (leave it out)' },
];

export const L12: Lesson = {
  id: 'L12-context-engineering',
  version: 2,
  track: 'prompting',
  alsoIn: ['claude-code'],
  order: 12,
  title: 'Context Engineering Masterclass',
  subtitle: 'Turn "fix it and make it better" into a task an AI can actually succeed at',
  prerequisites: [],
  competencies: ['context-engineering'],
  effortMinutes: 30,
  gameRelevance: 1,
  interestTags: ['context', 'foundations', 'ai-judgment'],
  problem: 'You ask an AI coding assistant to "fix the merge bug and make it better". Sometimes it patches the symptom, sometimes it rewrites half the resolver, once it deleted a failing test. The model is not erratic - the task is under-specified, so every run fills the gaps differently.',
  whyItMatters: 'Most disappointing AI results are specification failures, not model failures. If you can state context, constraints, scope, acceptance criteria and verification, you get repeatable results - and you can tell when the AI is wrong.',
  objectives: [
    'Rewrite a vague task with explicit context, constraints, scope, acceptance criteria and a verification step.',
    'Explain why more context is not automatically better, and what to leave out.',
    'Decide what belongs in this task prompt, in persistent project instructions, or in a hook.',
    'Judge a prompt by the outcomes it produces, not by how impressive it sounds.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Context engineering, not magic words',
      prediction: {
        prompt: 'Before you read on: does adding more and more information to a prompt always improve the result?',
        options: [
          o('a', 'No - context is a finite resource, and irrelevant detail can crowd out the relevant detail', 'Right: the goal is the best set of information, not the largest.'),
          o('b', 'Yes - more context can only help', 'Irrelevant context competes with the context that matters.', 'longer-prompt-better'),
          o('c', 'Only if it is written in capital letters', 'Emphasis is not information.'),
        ],
        correct: 'a',
      },
      body: `Anthropic's engineering team describes **context engineering** as "the set of strategies for curating and maintaining the optimal set of tokens (information) during LLM inference" - a natural progression from prompt engineering, which focuses on writing the instructions themselves.

Two ideas matter here. **Context is finite**: the article treats context as a resource with diminishing returns, an "attention budget" that each new token depletes. And **context rot**: as the context window grows, the model's ability to recall information from it can decline.

So the aim is not a longer prompt. It is the *smallest set of high-signal information that makes the task achievable* - and nothing that competes with it.`,
    },
    {
      id: 's2',
      title: 'Five parts of a task an AI can succeed at',
      body: `1. **Context** - what exists and what is wrong. The symptom, where it shows up, how to reproduce it. *"Pieces vanish after a chain of merges; \`npm run sim -- --seed 7\` reproduces it."*
2. **Constraints** - what must not change. *"Do not change the public merge API. Do not delete, skip or weaken existing tests."*
3. **Scope** - what is in and out. *"Only the merge resolver. No refactoring, no unrelated files."*
4. **Acceptance criteria** - checkable conditions for "done". *"All tests pass; total board value is conserved on seeds 1-40."*
5. **Verification** - how the AI must prove it. *"Run the tests and the simulation and paste the output before saying it is fixed."*

Each part closes a gap the model would otherwise fill by guessing. Acceptance criteria and verification are the two most often missing - and the two that let *you* tell whether the AI succeeded.`,
    },
    {
      id: 's3',
      title: 'Persistent instructions: context, not enforcement',
      body: `Each Claude Code session starts with a fresh context window. Two mechanisms carry knowledge across sessions: **CLAUDE.md** files you write, and **auto memory** Claude writes itself. Both are loaded at the start of every conversation.

The memory docs make the key point: Claude "treats them as context, not enforced configuration. To block an action regardless of what Claude decides, use a PreToolUse hook instead. The more specific and concise your instructions, the more consistently Claude follows them."

So sort every instruction by what it needs:
- **This task only** → put it in the task prompt (the five parts).
- **True for the whole project, every session** → CLAUDE.md, kept short and specific.
- **Must hold every time, no exceptions** → a hook, because guidance can be ignored.`,
    },
    {
      id: 's4',
      title: 'Worked example: before and after',
      body: `**Before**

> Fix the merge bug and make it better.

**After**

> **Context:** In One More Merge, pieces sometimes vanish after a chain of merges. \`npm run sim -- --seed 7\` reproduces it.
> **Constraints:** Keep the public \`dropPiece\` API. Do not delete, skip or weaken tests.
> **Scope:** Only the merge resolver. No refactoring or unrelated edits.
> **Done when:** \`npm test\` passes and total board value is conserved on seeds 1-40.
> **Verify:** Run both checks and paste the output. If anything fails, say so instead of claiming success.

Notice what the rewrite does *not* do: it does not explain the history of the game, restate coding style rules already in CLAUDE.md, or tell the model to "be careful". Everything in it earns its place.`,
    },
    {
      id: 's5',
      title: 'Judge a prompt by its outcomes',
      body: `A prompt is good if it produces correct, repeatable results - not if it sounds impressive. To find out, run it more than once against the same task and compare *outcomes*: do the tests pass, is the scope respected, how much rework did you do? One good run proves little because outputs vary between runs.

That is an experiment, and the AI Lab is built for it: Lesson 16 shows how to compare two versions of a prompt fairly.`,
    },
  ],
  activity: {
    title: 'Improve a poorly specified task',
    intro: 'Guided practice. Use the five fields. Each field is checked deterministically for the ideas it needs; read the model answer afterwards.',
    items: [
      {
        id: 'l12-p1',
        kind: 'fields',
        concept: 'context-engineering',
        brief: '**Task given to an AI coding assistant:** "Fix the merge bug and make it better."\n\n*Background:* In One More Merge, the merge board sometimes loses a piece after a chain of merges. There is a test suite (`npm test`) and a seeded simulator (`npm run sim -- --seed 7`).',
        prompt: 'Rewrite the task so an AI can succeed at it. Fill all five fields.',
        fields: [
          { id: 'context', label: 'Context', help: 'What is wrong, where, and how can it be reproduced?', groups: [{ label: 'names the symptom', anyOf: ['vanish', 'lose', 'loses', 'lost', 'missing piece', 'chain merge', 'cascade'] }, { label: 'says how to reproduce', anyOf: ['seed', 'npm test', 'reproduce', 'simulation', 'sim'] }], placeholder: 'Pieces vanish after…, reproduce with…' },
          { id: 'constraints', label: 'Constraints', help: 'What must NOT change?', groups: [{ label: 'protects existing behaviour or the API', anyOf: ['do not change', 'must not change', "don't change", 'without changing', 'keep the', 'preserve', 'public api'] }, { label: 'protects the tests', anyOf: ['do not delete', "don't delete", 'do not skip', 'no skipped', 'without skipping', 'do not weaken', 'existing tests'] }], placeholder: 'Do not…' },
          { id: 'scope', label: 'Scope', help: 'What is in scope - and what is explicitly out?', groups: [{ label: 'limits the change', anyOf: ['only', 'just the', 'limit', 'smallest', 'minimal', 'single'] }, { label: 'names what is out of scope', anyOf: ['no refactor', 'do not refactor', 'not refactor', 'unrelated', 'out of scope', 'do not touch', "don't touch"] }], placeholder: 'Only…, not…' },
          { id: 'acceptance', label: 'Acceptance criteria', help: 'Checkable conditions for "done".', groups: [{ label: 'a pass condition', anyOf: ['all tests pass', 'tests pass', 'test passes', 'zero failures', 'no failing'] }, { label: 'a specific measurable condition', anyOf: ['conserv', 'every seed', 'all seeds', 'seeds 1', 'total value', 'no piece'] }], placeholder: 'Done when…' },
          { id: 'verification', label: 'Verification', help: 'How must the AI prove it worked?', groups: [{ label: 'run the checks', anyOf: ['run', 'execute'] }, { label: 'show the evidence', anyOf: ['output', 'paste', 'show', 'quote', 'report', 'evidence'] }], placeholder: 'Run … and show …' },
        ],
        hints: ['Acceptance criteria answer "how will I know it is done?"; verification answers "how will it prove it?"'],
        explanation: 'A strong rewrite names the symptom and how to reproduce it; protects the API and tests; limits the scope; defines done with a checkable condition; and demands evidence.',
      },
      {
        id: 'l12-p2',
        kind: 'classify',
        concept: 'context-engineering',
        prompt: 'Which part of the task does each statement belong to - or is it noise?',
        categories: ELEMENTS.map((e) => ({ id: e.id, label: e.label })),
        entries: [
          { id: 'e1', text: 'The bug appears after three or more chained merges', correct: 'context', why: 'It describes the situation and symptom.' },
          { id: 'e2', text: 'Do not delete or skip any existing test', correct: 'constraints', why: 'It says what must not change.' },
          { id: 'e3', text: 'Only touch the merge resolver; no refactoring', correct: 'scope', why: 'It fixes the boundary of the work.' },
          { id: 'e4', text: 'Done when npm test passes and total value is conserved on seeds 1-40', correct: 'acceptance', why: 'A checkable condition for completion.' },
          { id: 'e5', text: 'Run both checks and paste the output before claiming success', correct: 'verification', why: 'It forces evidence.' },
          { id: 'e6', text: 'The game was started three years ago by a small team who love puzzles', correct: 'noise', why: 'True, but it does not help fix this bug and competes for attention.' },
          { id: 'e7', text: 'Be extremely careful and think really hard', correct: 'noise', why: 'It adds no information about what success is.' },
        ],
        hints: ['Ask: does this help the AI do the task, or help me check it?'],
        explanation: 'Every sentence should either set up the task or make the result checkable. The rest is noise.',
      },
      {
        id: 'l12-p3',
        kind: 'single',
        concept: 'context-engineering',
        prompt: 'Your task prompt is vague and results vary run to run. Which change helps most?',
        options: [
          o('a', 'Add the missing context, constraints, scope, acceptance criteria and a verification step', 'Correct: close the gaps the model is guessing at.'),
          o('b', 'Paste the whole repository history "so nothing is missing"', 'Irrelevant context competes with relevant context.', 'longer-prompt-better'),
          o('c', 'Tell it to "try harder" and repeat the request in capitals', 'Adds no information.', 'longer-prompt-better'),
        ],
        correct: 'a',
        explanation: 'Specific information beats volume.',
      },
      {
        id: 'l12-p4',
        kind: 'classify',
        concept: 'context-engineering',
        prompt: 'Where should each instruction live?',
        categories: [
          { id: 'task', label: 'This task prompt' },
          { id: 'claudemd', label: 'CLAUDE.md (every session)' },
          { id: 'hook', label: 'A hook (enforce it)' },
        ],
        entries: [
          { id: 'w1', text: 'Fix the vanishing-piece bug on seed 7', correct: 'task', why: 'A one-off goal.' },
          { id: 'w2', text: 'This project uses TypeScript strict mode and Vitest', correct: 'claudemd', why: 'True for the whole project, every session; keep it short.' },
          { id: 'w3', text: 'Never edit files under /generated, with no exceptions', correct: 'hook', why: 'It must hold every time. CLAUDE.md is context, not enforcement.' },
          { id: 'w4', text: 'Run npm test before committing', correct: 'claudemd', why: 'A standing project convention (add a hook if it must be guaranteed).' },
          { id: 'w5', text: 'Only change the resolver for this bug', correct: 'task', why: 'Scope belongs to this task.' },
        ],
        explanation: 'Task-specific → prompt. Always-true → CLAUDE.md. Must-hold → hook.',
      },
    ],
  },
  assessment: {
    title: 'Engineer the context',
    intro: 'A new vague task, no hints. The fields are checked for the ideas they need; the self-assessment at the end is yours to judge.',
    passMark: 0.75,
    items: [
      {
        id: 'l12-a1',
        kind: 'fields',
        concept: 'context-engineering',
        brief: '**Task given to an AI assistant:** "Make the daily reward better."\n\n*Background:* The shop screen grants a daily gem reward. Players say it feels stingy. The reward table is in `rewards.ts`; there are unit tests (`npm test`) and an economy simulation (`npm run econ -- --days 30`) that prints average gems earned per day.',
        prompt: 'Rewrite the task. Fill all five fields.',
        fields: [
          { id: 'context', label: 'Context', help: 'What is the situation and how can the current behaviour be seen?', groups: [{ label: 'names the problem', anyOf: ['stingy', 'too low', 'feels low', 'players say', 'daily reward'] }, { label: 'points to where / how to see it', anyOf: ['rewards.ts', 'econ', 'simulation', 'npm run', 'reward table'] }] },
          { id: 'constraints', label: 'Constraints', help: 'What must not change?', groups: [{ label: 'protects another system', anyOf: ['do not change', 'must not change', "don't change", 'without changing', 'keep the', 'preserve'] }, { label: 'protects balance or tests', anyOf: ['existing tests', 'do not skip', 'do not delete', 'do not weaken', 'upgrade cost', 'balance'] }] },
          { id: 'scope', label: 'Scope', help: 'In and out of scope.', groups: [{ label: 'limits the change', anyOf: ['only', 'just the', 'limit', 'smallest', 'minimal', 'single'] }, { label: 'names what is out', anyOf: ['no refactor', 'do not refactor', 'unrelated', 'out of scope', 'do not touch', "don't touch"] }] },
          { id: 'acceptance', label: 'Acceptance criteria', help: 'Checkable conditions for done.', groups: [{ label: 'a number or range to hit', anyOf: ['at least', 'no more than', 'between', 'average', '%', 'per day'] }, { label: 'tests still pass', anyOf: ['tests pass', 'all tests pass', 'test passes', 'zero failures'] }] },
          { id: 'verification', label: 'Verification', help: 'How must the AI prove it?', groups: [{ label: 'run the checks', anyOf: ['run', 'execute'] }, { label: 'show the evidence', anyOf: ['output', 'paste', 'show', 'quote', 'report', 'evidence'] }] },
        ],
        explanation: 'A strong answer states the observed problem, protects other systems, limits the change, sets a measurable target (for example an average gems-per-day range) and demands the simulation output.',
      },
      {
        id: 'l12-a2',
        kind: 'classify',
        concept: 'context-engineering',
        prompt: 'Sort these statements from a different task brief.',
        categories: ELEMENTS.map((e) => ({ id: e.id, label: e.label })),
        entries: [
          { id: 'f1', text: 'The shop crashes when a player opens it with zero gems', correct: 'context', why: 'The symptom and situation.' },
          { id: 'f2', text: 'Do not change the save-file format', correct: 'constraints', why: 'What must not change.' },
          { id: 'f3', text: 'Limit the fix to shop.ts; do not touch the currency module', correct: 'scope', why: 'The boundary of the work.' },
          { id: 'f4', text: 'Done when opening the shop with 0 gems shows an empty state and the test suite passes', correct: 'acceptance', why: 'A checkable end condition.' },
          { id: 'f5', text: 'Reproduce the crash first, then show the passing run', correct: 'verification', why: 'Demands evidence before and after.' },
          { id: 'f6', text: 'This is a really important task for the team', correct: 'noise', why: 'No information that helps do or check the task.' },
        ],
        explanation: 'Information that sets up the task or makes it checkable stays; the rest goes.',
      },
      {
        id: 'l12-a3',
        kind: 'single',
        concept: 'context-engineering',
        prompt: 'Which description of context is closest to how Anthropic\'s engineers describe it?',
        options: [
          o('a', 'A finite resource: aim for the smallest set of high-signal information that makes the task achievable', 'Correct: context is an attention budget with diminishing returns.'),
          o('b', 'A bucket: the more you add, the better the answer', 'Ignores that long contexts can degrade recall of any one fact.', 'longer-prompt-better'),
          o('c', 'A set of magic phrases that unlock better behaviour', 'Context engineering is about information, not incantations.'),
          o('d', 'Only the system prompt', 'Context includes everything passed to the model, not just the prompt.'),
        ],
        correct: 'a',
        explanation: 'Curate; do not pile on.',
      },
      {
        id: 'l12-a4',
        kind: 'classify',
        concept: 'context-engineering',
        prompt: 'Where should each instruction live?',
        categories: [
          { id: 'task', label: 'This task prompt' },
          { id: 'claudemd', label: 'CLAUDE.md (every session)' },
          { id: 'hook', label: 'A hook (enforce it)' },
        ],
        entries: [
          { id: 'x1', text: 'Add a regression test for the crash on empty-gems', correct: 'task', why: 'A one-off request.' },
          { id: 'x2', text: 'Commit messages follow Conventional Commits', correct: 'claudemd', why: 'A standing convention for the project.' },
          { id: 'x3', text: 'Block any command that force-pushes to main', correct: 'hook', why: 'Must hold regardless of what the model decides.' },
          { id: 'x4', text: 'The economy simulation lives in /sim and is run with npm run econ', correct: 'claudemd', why: 'Stable project knowledge every session needs.' },
        ],
        explanation: 'Match the mechanism to how strongly the rule must hold.',
      },
      {
        id: 'l12-a5',
        kind: 'multi',
        concept: 'context-engineering',
        prompt: 'Which statements about CLAUDE.md are true? Select all.',
        options: [
          o('a', 'It is loaded at the start of every session', 'Correct per the memory docs.'),
          o('b', 'Claude treats it as context, not enforced configuration', 'Correct per the memory docs.'),
          o('c', 'More specific and concise instructions are followed more consistently', 'Correct per the memory docs.'),
          o('d', 'It guarantees Claude will never take a forbidden action', 'It does not; use a hook to block an action regardless.'),
          o('e', 'Longer is always better', 'Specific and concise tends to work better.', 'longer-prompt-better'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'CLAUDE.md shapes behaviour; hooks enforce it.',
      },
      {
        id: 'l12-a6',
        kind: 'reflect',
        concept: 'context-engineering',
        prompt: 'Self-assessment of your rewrite in the first item (recorded, not scored). The keyword check cannot judge these qualities, so you must.',
        rubric: [
          'A new teammate reading only my brief would know when to stop',
          'Every sentence either sets up the task or makes the result checkable',
          'I could tell from the output alone whether the AI succeeded',
          'I left out background that does not change what the AI should do',
        ],
        explanation: 'Quality of wording is judged by outcomes - test it on a real task.',
      },
    ],
  },
  failureModes: [
    'Writing a long brief that buries the one constraint that mattered.',
    'Omitting acceptance criteria, so "done" is whatever the model decides.',
    'Asking for work without demanding evidence that it worked.',
    'Putting must-always-hold rules in CLAUDE.md and expecting enforcement.',
    'Judging a prompt by one lucky run.',
  ],
  application: {
    title: 'Rewrite your next real task',
    body: 'Before you give your next real task to an AI assistant, write the five parts first. Run it, then run a deliberately vaguer version on the same task and compare outcomes: tests passing, scope respected, rework needed. Practical takeaway: keep the five-part template as a note you paste and fill in.',
    fieldPrompt: 'Log it under Growth → Field evidence after a real task where the five-part brief changed the result - or record the comparison as a prompt experiment in the AI Lab.',
  },
  reviewItems: [
    { id: 'l12-r1', kind: 'single', concept: 'context-engineering', difficulty: 1, prompt: 'Which part of a task brief says "how will I know it is done?"', options: [o('a', 'Acceptance criteria', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Context', 'Context describes the situation.'), o('c', 'Noise', 'Noise helps with nothing.')], correct: 'a', explanation: 'Checkable conditions for done.' },
    { id: 'l12-r2', kind: 'single', concept: 'context-engineering', difficulty: 1, prompt: 'What does "context rot" describe?', options: [o('a', 'Recall of information declining as the context window grows', 'Correct, as described in Anthropic\'s article.'), o('b', 'Files becoming corrupted on disk', 'Not what the term means.'), o('c', 'A prompt being too short', 'The opposite concern.', 'longer-prompt-better')], correct: 'a', explanation: 'More tokens can mean worse recall of any one of them.' },
    { id: 'l12-r3', kind: 'single', concept: 'context-engineering', difficulty: 2, prompt: 'Why demand a verification step in the brief?', options: [o('a', 'So the AI must produce evidence you can check instead of claiming success', 'Correct: it matches the practice taught in this lesson.'), o('b', 'To make the prompt longer', 'Length is not a goal.', 'longer-prompt-better'), o('c', 'Because models cannot run commands', 'Many can; the point is evidence.')], correct: 'a', explanation: 'Evidence over assertion.' },
    { id: 'l12-r4', kind: 'multi', concept: 'context-engineering', difficulty: 2, prompt: 'Select the constraints worth stating for a bug-fix task.', options: [o('a', 'Do not delete, skip or weaken tests', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Keep the public API unchanged', 'Correct: it matches the practice taught in this lesson.'), o('c', 'The game is fun', 'Not a constraint.'), o('d', 'Do not touch unrelated files', 'Correct: it matches the practice taught in this lesson.')], correct: ['a', 'b', 'd'], explanation: 'Constraints protect what must not change.' },
    { id: 'l12-r5', kind: 'single', concept: 'context-engineering', difficulty: 2, prompt: 'A rule must hold with no exceptions. Where should it live?', options: [o('a', 'A hook that enforces it', 'Correct: CLAUDE.md is context, not enforcement.'), o('b', 'A longer CLAUDE.md', 'Guidance can be ignored.'), o('c', 'The first line of every prompt', 'Still a request.')], correct: 'a', explanation: 'Enforce what must hold.' },
    { id: 'l12-r6', kind: 'single', concept: 'context-engineering', difficulty: 3, prompt: 'Two prompts for the same task: A is two screens long; B is eight specific lines. In three runs A passes the tests once and B three times. What does this show?', options: [o('a', 'A directional hint that B is better on this task - with three runs it is not proof', 'Correct: report it honestly as small-sample evidence.'), o('b', 'B is proven better for all tasks', 'Three runs on one task prove nothing general.'), o('c', 'Nothing at all', 'It is weak evidence, not no evidence.')], correct: 'a', explanation: 'Judge by outcomes, with honest uncertainty.' },
    { id: 'l12-r7', kind: 'single', concept: 'context-engineering', difficulty: 3, prompt: 'Which sentence should you cut from a task brief?', options: [o('a', '"The team founded this studio three years ago and we really care about this."', 'Correct: true, but it does not change what the AI should do.'), o('b', '"Keep the save format unchanged."', 'A constraint: keep it.'), o('c', '"Done when all seeds 1-40 conserve value."', 'Acceptance criteria: keep it.')], correct: 'a', explanation: 'Every line should earn its place.' },
    { id: 'l12-r8', kind: 'single', concept: 'context-engineering', difficulty: 3, prompt: 'The same task keeps producing different scopes of change. Which fix targets the cause?', options: [o('a', 'State the scope explicitly, including what is out of scope', 'Correct: the gap the model is guessing at.'), o('b', 'Add emphasis such as "VERY IMPORTANT"', 'Emphasis is not information.', 'longer-prompt-better'), o('c', 'Switch tools', 'The brief is the problem.')], correct: 'a', explanation: 'Close the gap.' },
  ],
  sources: [
    { ...ARTICLES.contextEngineering, supports: 'Definition of context engineering, finite attention budget, context rot, and curating high-signal information.' },
    { ...DOCS.memory, supports: 'CLAUDE.md and auto memory are loaded each session as context, not enforced configuration; use hooks to block actions; specific and concise works better.' },
    { ...DOCS.workflows, supports: 'Prompt patterns: be specific, give a reproduction command, and verify with tests.' },
  ],
};

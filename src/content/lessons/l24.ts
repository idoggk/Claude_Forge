import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES } from './helpers';

const DECISIONS = [
  { id: 'preserve', label: 'Preserve (keep as written)' },
  { id: 'discard', label: 'Discard' },
  { id: 'summarise', label: 'Summarise (keep the conclusion)' },
  { id: 'revalidate', label: 'Revalidate before relying on it' },
  { id: 'delegate', label: 'Delegate (separate context)' },
];

/** A fabricated handoff note with flaws. All content is invented. */
const HANDOFF = [
  'HANDOFF - inventory feature',
  'Status: done. Tests pass.',
  'Last verified: (not recorded)',
  'Next: tidy up, then it is probably fine to merge.',
  'Known issues: none that I noticed.',
  'Notes: I removed two flaky tests to get the run green.',
  'Run tests with: npm run test:unit',
  'Constraint: do not change the save format.',
];
const HANDOFF_TARGETS = [
  { line: 2, severity: 'critical' as const, why: '"Done. Tests pass." is a claim with no evidence: no command, no output, no commit. A fresh session cannot tell whether it is true.' },
  { line: 3, severity: 'major' as const, why: 'No record of when or how it was last verified. State that matters must say what was checked and when.' },
  { line: 4, severity: 'major' as const, why: 'A vague next step ("tidy up", "probably fine"). A handoff needs a concrete next action and an acceptance check.' },
  { line: 5, severity: 'minor' as const, why: '"None that I noticed" is weak: list what was and was not checked so a successor knows where the gaps are.' },
  { line: 6, severity: 'critical' as const, why: 'Removing tests to get a green run destroys the evidence the whole workflow depends on. Anthropic\'s harness article calls removing or editing tests unacceptable.' },
];

export const L24: Lesson = {
  id: 'L24-long-running-agent-context',
  version: 1,
  track: 'agents',
  alsoIn: ['prompting', 'claude-code'],
  order: 24,
  title: 'Context Engineering for Long-Running Agents',
  subtitle: 'What to preserve, discard, summarise, revalidate and delegate when work outlasts a single context window',
  prerequisites: ['L12-context-engineering', 'L13-why-agents-fail'],
  competencies: ['long-running-context'],
  effortMinutes: 45,
  gameRelevance: 2,
  interestTags: ['context', 'orchestration', 'foundations'],
  problem: 'A coding agent has been working for three hours across several sessions. Its handoff note says "feature 3 complete, all tests passing". The next session trusts it and starts feature 4. The tests had not been run since two later edits, one of which broke feature 3.',
  whyItMatters: 'Real engineering work outlasts one conversation. What you carry forward - and what you re-check - decides whether the next session builds on solid ground or on a confident, stale claim.',
  objectives: [
    'Explain why long-running work degrades: finite context, stale content, and sessions that start with no memory.',
    'Decide for each piece of context whether to preserve, discard, summarise, revalidate or delegate it.',
    'Design durable memory outside the conversation: project instructions, a progress record, a task list, commits and tests.',
    'Write a handoff that separates verified facts from claims, and run a startup routine that re-checks them.',
    'Set delegation boundaries and recover after an interruption.',
  ],
  segments: [
    {
      id: 's1',
      title: 'A note is a claim',
      prediction: {
        prompt: 'A new session starts from a handoff note that says "feature 3 complete, all tests passing". What should it do first?',
        options: [
          o('a', 'Check the repository state and run the tests to confirm the claim, then continue', 'The note is a claim; the repository and a real test run are the evidence.'),
          o('b', 'Trust the note and start feature 4 straight away', 'If the note is wrong, feature 4 is built on a broken base.', 'summary-is-safe-memory'),
          o('c', 'Delete the note and start over', 'Discarding durable progress wastes it; the right move is to verify it.'),
        ],
        correct: 'a',
      },
      body: `Anthropic's engineering article on harnesses for long-running agents states the core problem plainly: agents work in discrete sessions, each new session begins with no memory of the last, and "getting agents to make consistent progress across multiple context windows remains an open problem."

Inside a single long session the problem is related: the context window is **finite**, every tool output consumes it, and old content (a superseded plan, a file you read two hours ago, a log you no longer need) competes with what matters now. Left alone, long sessions degrade in three ways: they **forget** (the earlier constraint scrolls out), they **contaminate** (a wrong early assumption keeps shaping later steps), and they **overclaim** (a summary says "done" for work that was never verified).

The skill is deciding, on purpose, what to carry.`,
    },
    {
      id: 's2',
      title: 'Five decisions for every piece of context',
      body: `For each item in a long transcript, choose one:

| Decision | Use it for | Example |
|---|---|---|
| **Preserve** | Short, durable, high-signal facts you will need again | The task and its acceptance criteria; user constraints ("do not touch the signing step"); conventions and the command that runs the tests |
| **Discard** | Noise that has done its job | Verbose install or build output; an error already fixed and verified; superseded plans; chatter |
| **Summarise** | Long material whose *conclusion* matters | Three pages of design exploration that ended in "use versioned JSON, because..."; findings from reading many files |
| **Revalidate** | **Claims about state** that later work depends on | "Migration done", "tests pass", the contents of a file read long ago, any assumption older than the edits since |
| **Delegate** | Self-contained work that would flood your context, or an independent check | Read-only exploration of an unrelated subsystem; an independent review of a diff |

The fourth row is the one that prevents the opening story. **Preserve facts; revalidate claims.** A summary may carry a conclusion forward, but a conclusion about the *current state of the world* is only as good as the last time it was checked.`,
    },
    {
      id: 's3',
      title: 'Put memory where it survives',
      body: `If something must survive the end of a session, it should not live only in the conversation. Use durable, inspectable places:

- **Persistent project instructions** (for example CLAUDE.md): stable conventions, how to run and test, what never to touch. Context that is true for every task.
- **A progress record**: what was done, what is in progress, what is blocked.
- **A task or feature list with explicit status**: Anthropic's article uses a JSON list where each feature has a \`passes\` field, noting JSON was chosen because the model was less likely to inappropriately overwrite it than Markdown, and that removing or editing tests to make them pass is unacceptable.
- **Version-control commits** as checkpoints: descriptive commits let a later session see what changed and revert a bad step.
- **Tests and an end-to-end check**: the evidence that a claim is true.

The repository is the memory; the conversation is a working surface. A good handoff points at these rather than re-narrating them.`,
    },
    {
      id: 's4',
      title: 'Handoffs and the startup routine',
      body: `A handoff note should let a stranger continue safely. Include:

- **Goal and acceptance criteria** (preserved).
- **Current state, with evidence:** what is *verified* (command, result, commit id, time) separate from what is *claimed* or *assumed*.
- **The next concrete step** and how you will know it is done.
- **Constraints and "do not" items.**
- **Known gaps:** what was not checked.
- **How to run and verify** (the exact commands).

Then the next session runs a **startup routine** before doing anything new. Anthropic's article describes one: confirm the working directory, read the git log and the progress file, read the feature list, start the development environment, and run a basic end-to-end check before beginning a new feature. The point of the check is to discover a broken baseline *before* building on it.`,
    },
    {
      id: 's5',
      title: 'Verification checkpoints and the known failure modes',
      body: `The same article names failure modes worth memorising, because they recur:

1. The agent **declares victory too early** on the whole job.
2. It tries to **do everything at once**, runs out of context part-way, and leaves a half-built, undocumented feature.
3. It **leaves the environment broken** or the progress undocumented.
4. It **marks a feature done without end-to-end testing**.
5. A **later session sees progress** and declares the job finished prematurely.

The controls are mundane and effective: **one feature at a time**, **commit working states**, test the way a user would (not only with unit tests), keep an explicit list of what remains, and make "done" depend on **evidence in the repository**, never on the agent's own statement. Add a **verification checkpoint** at the end of each unit of work: run the check, record the result and the commit, then move on.`,
    },
    {
      id: 's6',
      title: 'Delegation boundaries and recovering after an interruption',
      body: `A **subagent** works in its own context, so it can do read-heavy work without flooding yours and return a short summary. Delegate well:

- **Delegate** self-contained exploration (read-only), independent reviews, and genuinely independent tasks.
- **Brief it** like a colleague who has not seen the conversation: the goal, the constraints, what to return, and how to show evidence.
- **Ask for evidence pointers** (file paths, commands run), not just conclusions, and treat the summary as a claim to spot-check.
- **Do not delegate** decisions that depend on your accumulated context, work that edits the same files as another agent, or the verification of your *own* work to a context that only sees your summary.

**After an interruption**, do not resume from memory. Re-read the durable record, run the startup routine, find the last *verified* checkpoint, and continue from there. Anything after it is a claim.`,
    },
    {
      id: 's7',
      title: 'Worked example: sorting a transcript',
      body: `Five fragments from a fabricated three-hour session building an inventory screen:

- *"Task: add an inventory screen; it must persist across reload, pass inventory.test.ts and be keyboard accessible."* → **Preserve.** Short, durable, defines done.
- *"420 lines of npm install output."* → **Discard.** Noise.
- *"Three save-format designs compared at length; decided on versioned JSON because migrations are explicit."* → **Summarise** to that one sentence.
- *"Migration to the new save format is done" (written forty turns ago, since when the schema file changed).* → **Revalidate.** It is a claim about current state, now older than the edits.
- *"Understand how the audio system loads banks (thirty unrelated files)."* → **Delegate** as read-only exploration; take back a summary with file pointers.

Notice that nothing was kept *because the transcript was long* or thrown away *because it was old*. Each item was judged by what the next step needs.`,
    },
  ],
  activity: {
    title: 'Sort a long-running transcript',
    intro: 'Guided practice with fabricated fragments from a coding-agent session. Nothing runs.',
    items: [
      {
        id: 'l24-p1',
        kind: 'classify',
        concept: 'long-running-context',
        prompt: 'The agent is about to start a new session on the inventory screen. What should happen to each fragment of the old transcript?',
        categories: DECISIONS,
        entries: [
          { id: 'e1', text: 'Task: add an inventory screen. Acceptance: persists across reload, passes inventory.test.ts, keyboard accessible', correct: 'preserve', why: 'Short, durable and defines what done means.' },
          { id: 'e2', text: '420 lines of npm install output from step two', correct: 'discard', why: 'Noise that has done its job.' },
          { id: 'e3', text: 'A long comparison of three save-format designs that ended in a decision to use versioned JSON, with the reason', correct: 'summarise', why: 'Keep the decision and its reason, not the exploration.' },
          { id: 'e4', text: '"Migration to the new save format is done", written 40 turns ago; the schema file has changed since', correct: 'revalidate', why: 'A claim about current state that is now older than later edits.' },
          { id: 'e5', text: 'A need to understand how the audio system loads sound banks: about thirty unrelated files', correct: 'delegate', why: 'A read-only, self-contained exploration that would flood the context.' },
          { id: 'e6', text: 'Project convention: all UI strings go through t("..."); run tests with npm run test:unit', correct: 'preserve', why: 'Stable conventions you will need again.' },
          { id: 'e7', text: 'The stack trace from a typo that was fixed and verified two hours ago', correct: 'discard', why: 'Resolved and verified: no future use.' },
          { id: 'e8', text: '"All unit tests pass", reported at turn 12, before three later edits', correct: 'revalidate', why: 'Test results go stale the moment the code changes.' },
        ],
        explanation: 'Preserve facts, summarise conclusions, discard noise, revalidate claims about state, delegate flooding or independent work.',
      },
      {
        id: 'l24-p2',
        kind: 'flaglines',
        concept: 'long-running-context',
        filename: 'handoff-note.txt (fabricated)',
        lines: HANDOFF,
        prompt: 'Flag the lines of this handoff note that would mislead or endanger the next session. Some lines are good practice.',
        targets: HANDOFF_TARGETS,
        hints: ['Look for claims without evidence, vague next steps, and anything that destroys evidence.'],
        explanation: 'An unevidenced "done", no verification record, a vague next step, and removed tests. The test command and the constraint are the good lines.',
      },
      {
        id: 'l24-p3',
        kind: 'order',
        concept: 'long-running-context',
        prompt: 'Put a safe session-startup routine in order.',
        steps: [
          { id: 'o1', text: 'Confirm which repository and branch you are in', why: 'Know where you are before reading anything.' },
          { id: 'o2', text: 'Read the progress record and recent commit history', why: 'See what changed and what was verified.' },
          { id: 'o3', text: 'Read the task list and pick the next incomplete item', why: 'The list, not memory, says what is left.' },
          { id: 'o4', text: 'Start the environment and run the basic end-to-end check', why: 'Find a broken baseline before building on it.' },
          { id: 'o5', text: 'Only then begin new work, one item at a time', why: 'A verified baseline first.' },
        ],
        explanation: 'Orient, read the record, read the list, verify the baseline, then work.',
      },
      {
        id: 'l24-p4',
        kind: 'single',
        concept: 'long-running-context',
        prompt: 'A subagent returns "the audio loader is in audio/banks.ts and works as expected". How should you treat that?',
        options: [
          o('a', 'As a claim: use the file pointer, and spot-check the part you will rely on before building on it', 'Correct: a summary from another context is evidence to check, not a fact to inherit.'),
          o('b', 'As verified fact, because the subagent had the full context', 'It had its own context; you did not see its checks.', 'summary-is-safe-memory'),
          o('c', 'As worthless, because it came from a subagent', 'It is useful as a pointer; it just is not proof.'),
        ],
        correct: 'a',
        explanation: 'Delegated summaries are claims with pointers.',
      },
    ],
  },
  assessment: {
    title: 'Sort a new transcript and write a safe handoff',
    intro: 'A different transcript, no hints. The revalidation question is a mandatory check.',
    passMark: 0.8,
    items: [
      {
        id: 'l24-a1',
        kind: 'classify',
        concept: 'long-running-context',
        points: 3,
        prompt: 'An agent has spent a day migrating a build pipeline and the next session is about to begin. What should happen to each fragment of the old transcript?',
        categories: DECISIONS,
        entries: [
          { id: 'b1', text: 'Goal: migrate the build from script A to script B. Done means CI green on three platforms and script A deleted', correct: 'preserve', why: 'Short, durable and defines done.' },
          { id: 'b2', text: 'User constraint from the start: do not touch the release signing step', correct: 'preserve', why: 'A constraint that must never be lost.' },
          { id: 'b3', text: 'Every line of verbose compiler warnings from the first twenty builds', correct: 'discard', why: 'Noise with no future use.' },
          { id: 'b4', text: 'Findings from reading 14 build scripts: three are still used, the rest are dead', correct: 'summarise', why: 'Keep the conclusion, not the reading.' },
          { id: 'b5', text: '"Linux job passes", noted two hours ago, before the cache configuration changed', correct: 'revalidate', why: 'A result that predates later changes.' },
          { id: 'b6', text: '"I checked the signing step and it is unchanged", written from memory with no diff shown', correct: 'revalidate', why: 'An unevidenced claim about a constraint that matters; check the diff.' },
          { id: 'b7', text: 'A read-only exploration of how the Windows runner installs dependencies (self-contained, unrelated files)', correct: 'delegate', why: 'Self-contained and read-only: ideal for a separate context.' },
          { id: 'b8', text: 'The console output of rate-limit errors from an abandoned parallel-jobs attempt that was reverted and verified', correct: 'discard', why: 'The attempt is over and verified; the raw output has no further use.' },
          { id: 'b9', text: 'The decision to keep jobs serial because parallel jobs hit the provider\'s rate limit', correct: 'summarise', why: 'One line of conclusion and reason prevents repeating the mistake.' },
          { id: 'b10', text: 'An independent review of the macOS job diff, working from the evidence rather than the agent\'s summary', correct: 'delegate', why: 'Independent verification needs a separate context.' },
        ],
        explanation: 'Preserve the goal and constraints, summarise findings and decisions, discard noise, revalidate stale or unevidenced claims, delegate exploration and independent review.',
      },
      {
        id: 'l24-a2',
        kind: 'fields',
        concept: 'long-running-context',
        points: 3,
        prompt: 'You must stop for the day and a fresh session will continue the work. Write the handoff. Answer each part concretely.',
        brief: `**Situation:** you are partway through adding a settings screen to an app. Two of five planned sections are built, tests for one were written, and you changed the storage layer this afternoon.`,
        fields: [
          {
            id: 'state',
            label: 'Current state, with evidence',
            help: 'What is verified and what is only claimed.',
            groups: [
              { label: 'verified items with how they were checked', anyOf: ['verified', 'ran the tests', 'test output', 'commit', 'last run', 'checked by running', 'passes as of'] },
              { label: 'unverified or assumed items called out', anyOf: ['not verified', 'unverified', 'not yet checked', 'assumed', 'claimed', 'not re-run', 'since the storage', 'after the storage'] },
            ],
            placeholder: 'e.g. verified: ... (commit ...) ; not yet re-verified: ...',
          },
          {
            id: 'next',
            label: 'The next step and how you will know it is done',
            help: 'One concrete action with an acceptance check.',
            groups: [
              { label: 'a concrete next action', anyOf: ['next', 'build the', 'implement the', 'start with', 'third section', 'section three', 'then'] },
              { label: 'an acceptance check', anyOf: ['acceptance', 'done when', 'passes', 'test for', 'check that', 'verify that', 'criteria'] },
            ],
            placeholder: 'e.g. next: ... done when ...',
          },
          {
            id: 'constraints',
            label: 'Constraints and things not to do',
            help: 'What must not be changed or removed.',
            groups: [
              { label: 'an explicit do-not', anyOf: ['do not', "don't", 'never', 'must not', 'avoid'] },
              { label: 'protects tests or interfaces', anyOf: ['tests', 'test', 'public api', 'interface', 'storage format', 'schema', 'signing'] },
            ],
            placeholder: 'e.g. do not ... ; keep ...',
          },
          {
            id: 'startup',
            label: 'What the next session does first',
            help: 'The startup routine.',
            groups: [
              { label: 'run the tests or checks first', anyOf: ['run the tests', 'run the test', 'run the checks', 'end-to-end check', 'baseline', 'verify the baseline', 'confirm the'] },
              { label: 'read the record', anyOf: ['git log', 'progress', 'read the', 'task list', 'commit history', 'this note'] },
            ],
            placeholder: 'e.g. first read ... then run ...',
          },
        ],
        explanation: 'A handoff separates verified state from claims, names one concrete next step with an acceptance check, protects tests and interfaces, and tells the next session to read the record and re-run the baseline first.',
      },
      {
        id: 'l24-a3',
        kind: 'single',
        concept: 'long-running-context',
        critical: true,
        points: 2,
        prompt: 'A handoff note says "feature 3 complete; tests pass; migration done". Three edits were made after that was written. What is the right first move?',
        options: [
          o('a', 'Re-run the tests and check the migration state against the repository before building on any of it', 'Correct: claims about state are revalidated; the record is the evidence.'),
          o('b', 'Trust the note because the agent wrote it carefully', 'Care does not keep a claim current.', 'summary-is-safe-memory'),
          o('c', 'Trust the note but add a reminder to test later', 'Later is after feature 4 is built on a possibly broken base.', 'summary-is-safe-memory'),
          o('d', 'Ask the previous session to confirm', 'It cannot see today\'s repository; running the checks can.', 'summary-is-safe-memory'),
        ],
        correct: 'a',
        explanation: 'Preserve facts; revalidate claims.',
      },
      {
        id: 'l24-a4',
        kind: 'single',
        concept: 'long-running-context',
        prompt: 'Where should the rule "run tests with npm run test:unit, and never edit snapshot files by hand" live so every session sees it?',
        options: [
          o('a', 'In persistent project instructions such as CLAUDE.md, which is loaded for each session', 'Correct: stable, task-independent conventions belong there.'),
          o('b', 'Only in the chat, near the top of the conversation', 'It will scroll out of a long session and not exist in the next one.'),
          o('c', 'In the agent\'s summary of its last session', 'A summary is a lossy claim, not a durable instruction.', 'summary-is-safe-memory'),
        ],
        correct: 'a',
        explanation: 'Durable conventions belong in durable files.',
      },
      {
        id: 'l24-a5',
        kind: 'multi',
        concept: 'long-running-context',
        prompt: 'Which practices reduce the failure modes of long-running agent work? Select all.',
        options: [
          o('a', 'Working on one feature at a time and committing each working state', 'Limits the blast radius and gives a checkpoint to return to.'),
          o('b', 'Making "done" depend on evidence in the repository (a passing end-to-end check), not on the agent\'s statement', 'Prevents declaring victory too early.'),
          o('c', 'Keeping an explicit list of what remains with a status per item', 'Stops a later session from deciding the job is finished.'),
          o('d', 'Removing a flaky test so the run is green', 'That destroys evidence; fix or quarantine it openly instead.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Small steps, evidence-based done, an explicit remaining list.',
      },
      {
        id: 'l24-a6',
        kind: 'single',
        concept: 'long-running-context',
        prompt: 'Which task is the best candidate for delegation to a subagent?',
        options: [
          o('a', 'A read-only exploration of an unrelated subsystem, returning a summary with file pointers', 'Correct: self-contained, flooding, and low-risk.'),
          o('b', 'Editing the same file you are changing, in parallel', 'Concurrent edits to one file collide.', 'parallel-always-faster'),
          o('c', 'A decision that depends on the last three hours of your reasoning', 'The subagent does not have that context.'),
        ],
        correct: 'a',
        explanation: 'Delegate self-contained work; keep decisions that need your context.',
      },
      {
        id: 'l24-a7',
        kind: 'single',
        concept: 'long-running-context',
        prompt: 'After a crash, a session restarts. What is the best way to resume?',
        options: [
          o('a', 'Re-read the durable record, find the last verified checkpoint and continue from there; treat later work as claims', 'Correct: it matches the practice taught in this lesson.'),
          o('b', 'Continue from memory of where you were', 'Memory may be wrong or stale.', 'summary-is-safe-memory'),
          o('c', 'Redo everything from the beginning', 'That discards verified progress.'),
        ],
        correct: 'a',
        explanation: 'Resume from the last verified checkpoint.',
      },
      {
        id: 'l24-a8',
        kind: 'reflect',
        concept: 'long-running-context',
        prompt: 'Self-assessment (recorded, not scored).',
        rubric: [
          'I can sort any piece of context into preserve, discard, summarise, revalidate or delegate',
          'My handoffs separate verified facts from claims and say how to re-check them',
          'I start every session by reading the record and re-running a baseline check',
        ],
        explanation: 'The repository is the memory.',
      },
    ],
  },
  failureModes: [
    'Trusting a handoff note without re-checking the state it describes.',
    'Carrying long transcripts forward instead of conclusions.',
    'Declaring the job done because progress exists.',
    'Removing or editing tests to get a green run.',
    'Relying on the conversation as the only memory.',
    'Delegating a decision that needs context the subagent does not have.',
  ],
  application: {
    title: 'Write and test one real handoff',
    body: 'At the end of your next real working session with an agent, write a handoff note with a verified section (command, result, commit) and an unverified section. Start the next session from the note alone and run the startup routine before doing anything new. Record what the re-check found. Practical takeaway: keep a progress file and task list in the repository, not in the chat.',
    fieldPrompt: 'Log it under Growth → Field evidence when a startup re-check catches a stale or false claim in a real handoff.',
  },
  reviewItems: [
    { id: 'l24-r1', kind: 'single', concept: 'long-running-context', difficulty: 1, prompt: 'What does a new agent session know about earlier sessions?', options: [o('a', 'Only what is in the durable record you give it: files, notes, commits and tests', 'Correct: each session starts without memory of the last.'), o('b', 'Everything the previous session knew', 'There is no automatic memory between sessions.', 'summary-is-safe-memory'), o('c', 'Nothing, so it must start from scratch', 'It can use the durable record.')], correct: 'a', explanation: 'The record is the memory.' },
    { id: 'l24-r2', kind: 'single', concept: 'long-running-context', difficulty: 1, prompt: 'Which belongs in persistent project instructions?', options: [o('a', 'How to run the tests and conventions that apply to every task', 'Correct: it matches the practice taught in this lesson.'), o('b', 'The log of today\'s debugging', 'Task-specific and short-lived.'), o('c', 'A stack trace from an old bug', 'Noise: it has no further use.')], correct: 'a', explanation: 'Durable and general.' },
    { id: 'l24-r3', kind: 'single', concept: 'long-running-context', difficulty: 2, prompt: 'Which fragment should usually be revalidated rather than preserved?', options: [o('a', '"The migration is complete", written long ago and since edited around', 'Correct: a claim about state that may no longer hold.'), o('b', 'The acceptance criteria for the task', 'Durable and short: preserve.'), o('c', 'The user\'s instruction not to touch a file', 'A constraint: preserve.')], correct: 'a', explanation: 'Claims about state expire.' },
    { id: 'l24-r4', kind: 'multi', concept: 'long-running-context', difficulty: 2, prompt: 'Select the parts of a good handoff.', options: [o('a', 'Goal and acceptance criteria', 'Preserved context.'), o('b', 'Verified state with how it was checked', 'This is evidence a reader can verify.'), o('c', 'The next concrete step and how to know it is done', 'It gives the next session something concrete to do.'), o('d', 'A confident statement that everything works', 'A claim without evidence.', 'summary-is-safe-memory')], correct: ['a', 'b', 'c'], explanation: 'Evidence and action, not reassurance.' },
    { id: 'l24-r5', kind: 'single', concept: 'long-running-context', difficulty: 2, prompt: 'Why commit each working state?', options: [o('a', 'It creates checkpoints a later session can inspect or revert to', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Because git requires it', 'It is a practice, not a requirement.'), o('c', 'To make the history longer', 'Not the point.')], correct: 'a', explanation: 'Checkpoints.' },
    { id: 'l24-r6', kind: 'single', concept: 'long-running-context', difficulty: 3, prompt: 'A later session sees a lot of progress and concludes the job is finished. Which control best prevents this?', options: [o('a', 'An explicit task list with a status per item, and "done" tied to a passing end-to-end check', 'Correct: evidence defines done.'), o('b', 'A cheerful note saying the job is almost done', 'A claim, not a control.', 'summary-is-safe-memory'), o('c', 'Starting a new session each hour', 'It does not address what "done" means.')], correct: 'a', explanation: 'Define done by evidence.' },
    { id: 'l24-r7', kind: 'single', concept: 'long-running-context', difficulty: 3, prompt: 'Why is a delegated summary a claim?', options: [o('a', 'You did not see the subagent\'s checks, so spot-check what you will rely on', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Subagents are unreliable by design', 'It is about verification, not blame.'), o('c', 'Summaries are always wrong', 'They are useful pointers, not proof.')], correct: 'a', explanation: 'Verify what you rely on.' },
    { id: 'l24-r8', kind: 'single', concept: 'long-running-context', difficulty: 3, prompt: 'The agent removed two flaky tests to get a green run. What is the right response?', options: [o('a', 'Restore them and fix or openly quarantine the flakiness, because removing tests destroys the evidence', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Accept it: green is green', 'A green run without those tests proves less.', 'confident-trace-success'), o('c', 'Delete more tests that are slow', 'That makes the evidence weaker still.')], correct: 'a', explanation: 'Never delete evidence to pass.' },
  ],
  sources: [
    { ...ARTICLES.longRunningHarness, supports: 'Sessions without memory, initializer and coding agents, a feature list with pass status, git checkpoints, the startup routine, the named failure modes, and that editing or removing tests is unacceptable.' },
    { ...ARTICLES.contextEngineering, supports: 'Context as a finite resource and why long mixed histories compete with the task.' },
    { ...DOCS.memory, supports: 'Persistent project instructions in CLAUDE.md.' },
    { ...DOCS.subagents, supports: 'Subagents working in their own context.' },
  ],
};

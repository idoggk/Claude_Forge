import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES } from './helpers';

const FAMILIES = [
  { id: 'ambiguous', label: 'Ambiguous task' },
  { id: 'permission', label: 'Missing tool permission' },
  { id: 'stale', label: 'Stale context' },
  { id: 'assumption', label: 'Incorrect assumption' },
  { id: 'verification', label: 'Weak verification' },
  { id: 'delegation', label: 'Unnecessary delegation' },
];

/** A fabricated agent run. Every line is invented for training. */
export const TRACE_A = [
  '[00:00] TASK: "Fix the resolver and get it merged."',
  '[00:01] agent: plan -> read resolver, fix, run tests, merge',
  '[00:03] tool:read src/resolver.ts -> ok',
  '[00:04] tool:read docs/rules.md -> ok (file last modified 14 months ago)',
  '[00:06] agent: assume merge groups are always straight rows of three',
  '[00:08] tool:edit src/resolver.ts -> ok (replaced the group finder)',
  '[00:09] tool:bash "npm test" -> PERMISSION DENIED (bash is not allowed)',
  '[00:10] agent: tests could not run, but the change is small so they should pass',
  '[00:12] subagent:spawn "tidy variable names" (scope: whole repository)',
  '[00:15] subagent: renamed 212 identifiers across 40 files -> ok',
  '[00:16] tool:git commit -m "Fix resolver" -> ok',
  '[00:17] agent: All tests pass. Merge ready.',
];
const TRACE_A_TARGETS = [
  { line: 1, severity: 'major' as const, why: 'Ambiguous task: "fix" and "get it merged" have no acceptance criteria, so success is whatever the agent decides.' },
  { line: 4, severity: 'major' as const, why: 'Stale context: the rules document is 14 months old and is treated as current without checking the code.' },
  { line: 5, severity: 'critical' as const, why: 'Incorrect assumption: the group finder is rewritten for straight rows only, with no check against what the game actually allows.' },
  { line: 7, severity: 'major' as const, why: 'Missing tool permission: the one command that would verify the work was denied, and nobody resolved it.' },
  { line: 8, severity: 'critical' as const, why: 'Weak verification: "should pass" is a guess presented as a plan to continue.' },
  { line: 9, severity: 'major' as const, why: 'Unnecessary delegation: a whole-repository renaming subagent that nobody asked for, with unbounded scope.' },
  { line: 12, severity: 'critical' as const, why: 'A success claim with no evidence: the tests never ran, so "All tests pass" is false.' },
];

export const TRACE_B = [
  '[00:00] TASK: "Export last month\'s player stats so the designers can use them."',
  '[00:01] agent: plan -> query analytics, write CSV, email designers',
  '[00:02] tool:db.query "SELECT * FROM players" -> ok (480,112 rows)',
  '[00:04] agent: the stats schema probably has the same columns as last quarter',
  '[00:05] tool:write exports/stats.csv -> ok (includes email, birthdate, device_id)',
  '[00:07] subagent:spawn "format spreadsheet nicely" (scope: stats.csv)',
  '[00:09] subagent: applied 14 conditional-format rules -> ok',
  '[00:10] tool:email.send to designers@studio.example -> ok (attached stats.csv)',
  '[00:11] tool:db.query "SELECT count(*) FROM sessions WHERE month = last" -> timeout',
  '[00:12] agent: query timed out; session counts are likely similar to the totals above',
  '[00:13] agent: Export complete and verified.',
];
const TRACE_B_TARGETS = [
  { line: 1, severity: 'major' as const, why: 'Ambiguous task: "player stats" and "can use" define neither the fields, the audience nor what done looks like.' },
  { line: 3, severity: 'major' as const, why: 'Over-broad access: SELECT * pulls every column, including personal data nobody needs.' },
  { line: 4, severity: 'critical' as const, why: 'Incorrect assumption: the schema is assumed from last quarter instead of being read.' },
  { line: 5, severity: 'critical' as const, why: 'Unsafe output: personal fields (email, birthdate, device id) are written to a shared file.' },
  { line: 8, severity: 'critical' as const, why: 'No approval gate before an irreversible external action: personal data was emailed out.' },
  { line: 10, severity: 'major' as const, why: 'Weak verification: a timed-out check is replaced by a guess.' },
  { line: 11, severity: 'critical' as const, why: 'A completion claim with no evidence: the one verification step failed and nothing was verified.' },
];

export const L13: Lesson = {
  id: 'L13-why-agents-fail',
  version: 2,
  track: 'agents',
  alsoIn: ['safety-eval'],
  order: 13,
  title: 'Why AI Agents Fail',
  subtitle: 'Read an agent trace, name the real failure causes and choose proportionate controls',
  prerequisites: ['L11-choose-ai-approach'],
  competencies: ['agent-failure-analysis'],
  effortMinutes: 30,
  gameRelevance: 2,
  interestTags: ['orchestration', 'ai-judgment', 'security'],
  problem: 'An agent finishes, says "Merge ready", and the merge breaks the board. Nothing in its final message was a lie - it was a summary of a run in which the tests never executed, the rules document was a year old, and a subagent rewrote 212 identifiers nobody mentioned.',
  whyItMatters: 'Agents fail quietly and fluently. The skill that protects you is not distrust but diagnosis: reading the trace, naming which failure family it is, and adding the smallest control that would have caught it.',
  objectives: [
    'Identify ambiguous tasks, missing permissions, stale context, wrong assumptions, weak verification and unnecessary delegation in an agent trace.',
    'Explain why a long chain of mostly-reliable steps is often unreliable overall.',
    'Choose proportionate controls: approval gates, least-privilege permissions, verification, checkpoints.',
    'Decide when delegating to more agents makes a task worse, not better.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Autonomy compounds errors',
      prediction: {
        prompt: 'An agent task has ten steps and each step is 95% likely to go right. Roughly how likely is it that EVERY step goes right?',
        options: [
          o('a', 'About 60%', 'Correct: 0.95 to the power 10 is about 0.60. Small per-step risks add up.'),
          o('b', 'About 95%', 'That is the chance for one step. Independent risks multiply.'),
          o('c', 'About 30%', 'Too pessimistic: 0.95^10 is about 60%, which is still alarming.'),
        ],
        correct: 'a',
      },
      body: `Anthropic's agent-building guide defines **agents** as systems where the model "dynamically directs its own processes and tool usage". That flexibility comes with a cost it states plainly: agents trade latency and cost for performance, and **their autonomy can compound errors**, which is why it recommends extensive testing in sandboxes and appropriate guardrails.

Compounding is arithmetic, not pessimism. If each of ten steps is 95% reliable, the chance that all ten are right is 0.95¹⁰ ≈ 60%. The longer the chain and the less each step is checked, the less the final summary can be trusted.`,
    },
    {
      id: 's2',
      title: 'Six failure families',
      body: `| Family | What you see in the trace | The control that helps |
|---|---|---|
| **Ambiguous task** | Vague verbs ("fix", "improve"), no definition of done | Context, scope and acceptance criteria (Lesson 12) |
| **Missing tool permission** | A needed command is denied and the agent carries on | Grant the narrowest permission that is needed, or stop and ask |
| **Stale context** | A document, summary or memory is old and is trusted as current | Re-read the source of truth; ground claims in the current files |
| **Incorrect assumption** | "Probably", "should", "assume" before acting | Make the agent check the assumption (read the code, run the query) |
| **Weak verification** | "It should pass", or a claim of success with no test output | Independent verification of the OUTCOME, not the narration |
| **Unnecessary delegation** | A subagent spawned for work that did not need one, with a broad scope | Keep simple work in the main agent; bound any subagent's task and tools |

A single run often contains several of these, one feeding the next.`,
    },
    {
      id: 's3',
      title: 'Reading a trace: evidence, not narration',
      body: `The final message of an agent is a *claim*. The trace is the *evidence*. When you audit a run:

1. Find the command that would prove the claim. Is it in the trace? Did it run? Did it pass?
2. Look for hedges before actions: "probably", "should", "assume", "likely". Each one is an unverified step.
3. Look for tool results the agent ignored: a denied permission, a timeout, an empty result.
4. Look for work you did not ask for: spawned helpers, files touched outside the scope.
5. Check what the agent trusted without reading: an old document, a summary, memory.

Notice the pattern: nothing here asks you to judge the agent's *tone*. A confident summary and a correct one look the same.`,
    },
    {
      id: 's3b',
      title: 'Worked example: auditing one short run',
      body: `A fabricated five-line trace, read the way the checklist above asks:

\`\`\`text
1  agent: Plan: the crash is probably in the save writer.
2  agent: [edits save_writer.ts]
3  tool: test run -> TIMEOUT after 120s (no output)
4  agent: Tests should pass now.
5  agent: Done - fixed the crash and all tests pass.
\`\`\`

- **The claim** (line 5) needs a passing test run. The only run (line 3) *timed out*. The claim is unsupported.
- **The hedges** ("probably", "should") mark two unverified steps: the cause was assumed, and the fix was assumed to work.
- **The ignored result** is the timeout: the agent replaced an actual check with a prediction.
- **A proportionate control:** make "the test command exits 0, shown in the trace" the condition for saying done - and have a person look at the diff before merge. Not "ban agents".`,
    },
    {
      id: 's4',
      title: 'Controls in proportion',
      body: `Match the control to the risk, and keep it as light as it can be:

- **Least-privilege permissions.** Claude Code's permission system lets you allow, ask or deny tool use by rule, and file edits and shell commands ask by default in Manual mode. Grant what the task needs, not everything.
- **Human approval before irreversible or external actions** - sending data out, deleting, merging, deploying.
- **Independent verification.** The agent that did the work should not be the only check on it (Lesson 9). Prefer a test run you can see, or a separate reviewer.
- **Checkpoints and resumability.** Anthropic's multi-agent research write-up stresses that agents are stateful and errors compound, so build resumable execution, retries and checkpoints rather than restarting from scratch.
- **Simplicity.** Do not add subagents by default. The same write-up says multi-agent systems fit breadth-first, heavily parallel, high-value tasks, and that most coding tasks - which need shared context and have many dependencies - are a poorer fit. It also reports that agents use roughly four times and multi-agent systems roughly fifteen times the tokens of a chat, in the authors' own measurements.

Over-control is a failure too: an approval for every file read trains people to click "yes" without looking.`,
    },
  ],
  activity: {
    title: 'Run an agent autopsy',
    intro: 'The run below is fabricated for training. Flag the lines where the run actually went wrong, then name the failure family and the control.',
    items: [
      {
        id: 'l13-p1',
        kind: 'flaglines',
        concept: 'agent-failure-analysis',
        filename: 'agent-run-14.log',
        lines: TRACE_A,
        prompt: 'Flag the lines that show a real failure (not just ordinary activity).',
        targets: TRACE_A_TARGETS,
        hints: ['Look for: a vague task, an old document trusted as current, "assume", a denied command, "should pass", a spawned subagent, and a success claim.'],
        explanation: 'Seven lines carry the failures; the rest of the run is ordinary.',
      },
      {
        id: 'l13-p2',
        kind: 'classify',
        concept: 'agent-failure-analysis',
        prompt: 'Name the failure family for each observation.',
        categories: FAMILIES.map((f) => ({ id: f.id, label: f.label })),
        entries: [
          { id: 'c1', text: 'The task said "improve performance" and the agent changed a dozen unrelated files', correct: 'ambiguous', why: 'No scope or definition of done, so the agent chose its own.' },
          { id: 'c2', text: 'A test command was denied and the agent wrote "tests should pass"', correct: 'permission', why: 'The missing permission was never resolved - and it also hid a verification failure.' },
          { id: 'c3', text: 'The agent followed a design doc from last year that no longer matches the code', correct: 'stale', why: 'It trusted old context instead of the current source.' },
          { id: 'c4', text: 'Before editing, the agent wrote "assume the schema has not changed"', correct: 'assumption', why: 'An unchecked assumption acted on as fact.' },
          { id: 'c5', text: 'The final message said "verified" but no check appears anywhere in the trace', correct: 'verification', why: 'Narration instead of evidence.' },
          { id: 'c6', text: 'A subagent was spawned to rename variables across the whole repository', correct: 'delegation', why: 'Work nobody needed, with unbounded scope.' },
        ],
        hints: ['Ask what the agent should have had, done or checked.'],
        explanation: 'Naming the family tells you which control to add.',
      },
      {
        id: 'l13-p3',
        kind: 'numeric',
        concept: 'agent-failure-analysis',
        prompt: 'A run has 10 independent steps, each 95% reliable. What is the chance that all ten succeed, as a percentage? (Round to the nearest whole number.)',
        answer: 60,
        tolerance: 1,
        unit: '%',
        diagnose: (value) => (Math.abs(value - 95) <= 1 ? 'That is the chance for ONE step. Independent steps multiply: 0.95 × 0.95 × … ten times.' : null),
        hints: ['Multiply 0.95 by itself ten times.'],
        explanation: '0.95¹⁰ ≈ 0.599.',
      },
      {
        id: 'l13-p4',
        kind: 'single',
        concept: 'agent-failure-analysis',
        prompt: 'An agent ends with "All tests pass." What do you check first?',
        options: [
          o('a', 'Whether the trace shows the test command actually running, and its output', 'Correct: verify the outcome, not the narration.'),
          o('b', 'Whether the message sounds confident and gives a clear, specific summary of what was tested', 'Confidence is not evidence.', 'confident-trace-success'),
          o('c', 'Whether the message is detailed, with test names and counts that look like real output', 'A detailed claim is still a claim.', 'confident-trace-success'),
        ],
        correct: 'a',
        explanation: 'The trace is the evidence.',
      },
      {
        id: 'l13-p5',
        kind: 'multi',
        concept: 'agent-failure-analysis',
        prompt: 'Which controls would have caught the failures in the run above? Select all that apply.',
        options: [
          o('a', 'Acceptance criteria and scope in the task', 'Correct: each failure has a small, specific control.'),
          o('b', 'Resolving the denied test permission before continuing', 'Correct: each failure has a small, specific control.'),
          o('c', 'Requiring visible test output before a success claim', 'Correct: each failure has a small, specific control.'),
          o('d', 'Bounding or removing the whole-repository subagent', 'Correct: each failure has a small, specific control.'),
          o('e', 'Adding five more agents to double-check', 'More agents add cost and more places to fail; the fix is verification, not volume.', 'agents-always-better'),
        ],
        correct: ['a', 'b', 'c', 'd'],
        explanation: 'Each failure has a small, specific control.',
      },
    ],
  },
  assessment: {
    title: 'Diagnose the run',
    intro: 'A different fabricated run. No hints. Spot the failures, name the families and choose proportionate controls.',
    passMark: 0.75,
    items: [
      {
        id: 'l13-a1',
        kind: 'flaglines',
        concept: 'agent-failure-analysis',
        filename: 'agent-run-31.log',
        lines: TRACE_B,
        prompt: 'Flag the lines that show a real failure.',
        targets: TRACE_B_TARGETS,
        explanation: 'Seven failures, including personal data written to a shared file and emailed out with no approval.',
      },
      {
        id: 'l13-a2',
        kind: 'classify',
        concept: 'agent-failure-analysis',
        prompt: 'Name the failure family for each observation in this second run.',
        categories: FAMILIES.map((f) => ({ id: f.id, label: f.label })),
        entries: [
          { id: 'd1', text: 'The task was "export the player stats so designers can use them"', correct: 'ambiguous', why: 'No fields, audience or definition of done.' },
          { id: 'd2', text: '"The schema probably has the same columns as last quarter"', correct: 'assumption', why: '"Probably" before acting: an unchecked assumption.' },
          { id: 'd3', text: 'A subagent was spawned to format a spreadsheet nobody asked to be formatted', correct: 'delegation', why: 'Unrequested work with its own cost.' },
          { id: 'd4', text: 'The verification query timed out and the agent guessed the answer', correct: 'verification', why: 'The one check failed and was replaced by a guess.' },
          { id: 'd5', text: 'A rules file from the last release was used for column meanings', correct: 'stale', why: 'Old context trusted as current.' },
          { id: 'd6', text: 'The write step was denied access to the exports folder and the agent continued as if it had succeeded', correct: 'permission', why: 'A denied tool result that was ignored.' },
        ],
        explanation: 'Six observations, six families.',
      },
      {
        id: 'l13-a3',
        kind: 'numeric',
        concept: 'agent-failure-analysis',
        prompt: 'A run has 8 independent steps, each 90% reliable. What is the chance that all eight succeed, as a percentage? (Round to the nearest whole number.)',
        answer: 43,
        tolerance: 1,
        unit: '%',
        explanation: '0.9⁸ ≈ 0.43.',
      },
      {
        id: 'l13-a4',
        kind: 'single',
        concept: 'agent-failure-analysis',
        critical: true,
        points: 2,
        prompt: 'The agent reports "Export complete and verified", but the only verification query in the trace timed out. How do you treat the claim?',
        options: [
          o('a', 'As unverified: the evidence for it failed, so run a real check before relying on it', 'Correct: the trace, not the narration, is the evidence.'),
          o('b', 'As verified, since the agent explicitly reported the export as complete and verified in its summary', 'A claim contradicted by the trace is not verification.', 'confident-trace-success'),
          o('c', 'As verified if the export file exists, because a file on disk shows the export ran to the end', 'A file existing does not show its contents are right.', 'confident-trace-success'),
          o('d', 'As a reason to stop using agents for exports, since this one claimed a check it did not complete', 'An overreaction: the fix is verification and approval gates.'),
        ],
        correct: 'a',
        explanation: 'Treat unverified claims as unverified.',
      },
      {
        id: 'l13-a5',
        kind: 'multi',
        concept: 'agent-failure-analysis',
        prompt: 'An agent will query a database and email results to colleagues. Which controls are proportionate? Select all.',
        options: [
          o('a', 'A read-only database credential limited to the needed columns', 'Least privilege limits the damage.'),
          o('b', 'A human approval step before anything is sent outside the team', 'Sending data out is irreversible.'),
          o('c', 'A verification step that checks the output against the request before sending', 'Independent check of the outcome.'),
          o('d', 'Run unattended with every permission enabled so it is never blocked', 'Removes the controls that catch mistakes.'),
          o('e', 'Ban the agent from reading any data at all', 'Overcorrection: it could not do the job.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Least privilege, an approval gate and verification - in proportion.',
      },
      {
        id: 'l13-a6',
        kind: 'single',
        concept: 'agent-failure-analysis',
        prompt: 'A team wants to add three more subagents to a coding task that edits one shared module. According to the authors of Anthropic\'s multi-agent research write-up, which statement fits?',
        options: [
          o('a', 'Tasks that need shared context and have many dependencies, which they say describes most coding tasks, are a poorer fit for multi-agent designs', 'Correct: that is the authors\' stated view.'),
          o('b', 'Multi-agent designs are always faster for coding tasks, because separate subagents can edit different parts of the codebase in parallel and combine results', 'The authors say the opposite for most coding tasks.', 'agents-always-better'),
          o('c', 'Subagents share the main conversation\'s full history, so adding more of them adds context and capacity without losing anything that the main agent knows', 'Subagents start with a fresh context and do not see your conversation history.'),
          o('d', 'Subagents use no extra tokens, because they reuse the context that the main agent has already paid for and only add the cost of their own instructions', 'Each subagent spends its own tokens.'),
        ],
        correct: 'a',
        explanation: 'More agents is not automatically better.',
      },
      {
        id: 'l13-a7',
        kind: 'reflect',
        concept: 'agent-failure-analysis',
        prompt: 'Self-assessment (recorded, not scored).',
        rubric: [
          'I can name the failure family for a symptom in a trace',
          'I look for the evidence behind a success claim before believing it',
          'I can pick the smallest control that would have caught a failure',
        ],
        explanation: 'Diagnosis comes before more machinery.',
      },
    ],
  },
  failureModes: [
    'Believing the final message instead of reading the trace.',
    'Ignoring denied permissions and timeouts that the agent ignored too.',
    'Letting "probably" and "should" stand in for a check.',
    'Adding subagents to a task that needs shared context.',
    'Adding so many approvals that people stop reading them.',
  ],
  application: {
    title: 'Autopsy one real run',
    body: 'Take a real agent run from this month that went wrong or needed rework. Open its transcript and find the first line where it went wrong. Label the failure family, then write the single control that would have caught it. Practical takeaway: the cheapest control is usually a sharper task or a visible verification step, not another agent.',
    fieldPrompt: 'Log it under Growth → Field evidence when you add a control (an acceptance criterion, a hook, a narrower permission) that prevents a real failure.',
  },
  reviewItems: [
    { id: 'l13-r1', kind: 'single', concept: 'agent-failure-analysis', difficulty: 1, prompt: 'Why can autonomy make errors worse?', options: [o('a', 'Small per-step risks compound over many unchecked steps', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Agents cannot read files, so they work from guesses and each wrong guess leads to a worse next step', 'Agents can read files; that is what they are for.'), o('c', 'Agents never use tools, so every action they take is a model\'s estimate that is not checked', 'Tool use is the point of an agent.')], correct: 'a', explanation: 'Risks multiply across steps.' },
    { id: 'l13-r2', kind: 'single', concept: 'agent-failure-analysis', difficulty: 1, prompt: 'Which is the stronger evidence that tests passed?', options: [o('a', 'The test command and its output in the trace', 'Correct: it matches the practice taught in this lesson.'), o('b', 'A confident final summary that lists which tests were run and says that every one of them passed', 'A claim, not evidence.', 'confident-trace-success'), o('c', 'The agent saying "verified" next to each step in its own report of what it did in the session', 'The agent writing \'verified\' is still a claim; only the test command and its output are evidence.', 'confident-trace-success')], correct: 'a', explanation: 'Outcome over narration.' },
    { id: 'l13-r3', kind: 'single', concept: 'agent-failure-analysis', difficulty: 2, prompt: 'A trace says "assume the config has not changed". What is this?', options: [o('a', 'An incorrect-assumption risk: an unchecked belief acted on as fact', 'Correct: it matches the practice taught in this lesson.'), o('b', 'A verified step, because the agent stated its assumption openly and recorded it in the trace', 'Assuming is the opposite of checking.', 'confident-trace-success'), o('c', 'A permissions problem, because the agent was not allowed to read the config file to check it', 'Nothing was denied here; the agent chose to assume instead of checking, which is an assumption risk.')], correct: 'a', explanation: 'Make the agent check it.' },
    { id: 'l13-r4', kind: 'multi', concept: 'agent-failure-analysis', difficulty: 2, prompt: 'Select the signs of weak verification in a trace.', options: [o('a', '"They should pass"', 'Correct: evidence or it did not happen.'), o('b', 'A success claim with no check in the trace', 'Correct: it matches the practice taught in this lesson.'), o('c', 'A timed-out check replaced by an estimate', 'Correct: it matches the practice taught in this lesson.'), o('d', 'A test run with 214 passes shown', 'A test run showing 214 passes is evidence of verification, not a sign that verification was weak.')], correct: ['a', 'b', 'c'], explanation: 'Evidence or it did not happen.' },
    { id: 'l13-r5', kind: 'single', concept: 'agent-failure-analysis', difficulty: 2, prompt: 'A needed command is denied and the agent proceeds anyway. What is the right control?', options: [o('a', 'Resolve the permission (grant the narrow need) or stop and ask before continuing', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Turn off all permission checks for the session, so that no needed command is ever refused again', 'Removes the safety net for everything.'), o('c', 'Ignore the denial and carry on with the remaining steps', 'That is the failure.', 'confident-trace-success')], correct: 'a', explanation: 'Least privilege, and do not ignore denials.' },
    { id: 'l13-r6', kind: 'single', concept: 'agent-failure-analysis', difficulty: 3, prompt: 'Three subagents are proposed for edits to one shared function. What is the strongest objection?', options: [o('a', 'They share dependencies and files, so parallel work will collide and each spends its own tokens', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Subagents cannot edit files, so the three of them could only report on the shared function', 'Subagents can edit files; the problem is collisions on shared code.'), o('c', 'Three is an unlucky number of agents, because an odd count cannot split the work evenly between them', 'The objection is about shared files and duplicated cost, not numerology.', 'agents-always-better')], correct: 'a', explanation: 'Shared context favours one agent.' },
    { id: 'l13-r7', kind: 'single', concept: 'agent-failure-analysis', difficulty: 3, prompt: 'Which action should always have a human approval gate?', options: [o('a', 'Sending personal data outside the team', 'Correct: irreversible and external.'), o('b', 'Reading a source file in the repository', 'Low risk and reversible.'), o('c', 'Printing a log line to the terminal', 'Harmless: it changes nothing and exposes nothing.')], correct: 'a', explanation: 'Gate the irreversible.' },
    { id: 'l13-r8', kind: 'single', concept: 'agent-failure-analysis', difficulty: 3, prompt: 'A run fails after step 7 of 10. Which design helps most?', options: [o('a', 'Checkpoints so it can resume from step 7 instead of restarting', 'Correct: stateful agents need resumable execution.'), o('b', 'Always restart from step 1 so that every run begins from the same known and clean starting state', 'Wastes work and may repeat side effects.'), o('c', 'Skip the remaining steps and report success', 'That is the failure.', 'confident-trace-success')], correct: 'a', explanation: 'Resumability limits the cost of failure.' },
  ],
  sources: [
    { ...ARTICLES.buildingAgents, supports: 'Agents defined; autonomy can compound errors; extensive sandbox testing and guardrails recommended.' },
    { ...ARTICLES.multiAgent, supports: 'Stateful agents and compounding errors; resumable execution, retries and checkpoints; when multi-agent designs fit or do not; token multipliers as measured by the authors.' },
    { ...DOCS.subagents, supports: 'Subagents start with a fresh context, spend their own tokens, and have independent tool and permission settings.' },
    { ...DOCS.permissions, supports: 'Allow, ask and deny rules; which tool types ask for approval in Manual mode.' },
  ],
};

import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES } from './helpers';

/** All file names, commands and teams below are invented. Nothing here runs. */
const HOOK_REFERENCE = JSON.stringify(
  {
    name: 'block-unchecked-economy-edits',
    event: 'PreToolUse',
    matcher: 'edits to balance/economy.json',
    check: 'Run the economy simulation script and require that its result file is newer than the edit',
    on_pass: 'allow the edit',
    on_fail: 'block the edit',
    failure_mode: 'closed',
    message: 'Blocked: run the economy simulation first (npm run sim:economy), then retry.',
    test_cases: [
      { case: 'simulation result is newer than the edit', expect: 'allow' },
      { case: 'no simulation result exists', expect: 'block' },
      { case: 'the check script crashes', expect: 'block' },
    ],
  },
  null,
  2,
);

const parse = (s: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export const L26: Lesson = {
  id: 'L26-hooks-guardrails-deterministic-gates',
  version: 1,
  track: 'claude-code',
  alsoIn: ['safety-eval', 'agents'],
  order: 26,
  title: 'Hooks, Guardrails and Deterministic Gates',
  subtitle: 'Choose between a Skill, project instructions, a hook, a permission rule and a CI check, and design a gate that holds',
  prerequisites: ['L01-skill-or-tool', 'L25-agent-permissions-least-privilege'],
  competencies: ['deterministic-gates'],
  effortMinutes: 45,
  gameRelevance: 2,
  interestTags: ['automation', 'security', 'orchestration'],
  problem: 'A team writes "always run the checks before committing" in a Skill, in project instructions and in a reminder at the top of every prompt. In long sessions the step is still sometimes skipped. A bad commit gets through on a busy Friday, and everyone agrees that the rule was clear.',
  whyItMatters: 'Some rules must hold every time, not most of the time. Knowing which rules belong in guidance and which belong in something that runs without asking the model is the difference between a reminder and a guarantee.',
  objectives: [
    'Tell a procedure (judgment, guidance) from a policy (must hold every time) and place each in the right mechanism.',
    'Explain what a hook is, when it runs, and what it can and cannot guarantee.',
    'Choose among a Skill, project instructions, a hook, a permission rule, a CI check and a plain script for a given requirement.',
    'Design a gate that is deterministic, fast, clear when it fails, and tested, and decide whether it fails open or closed.',
    'Review a hook as code that runs with your permissions, and spot an unsafe one.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Procedure versus policy',
      prediction: {
        prompt: 'The rule "tests must pass before a commit" is written in a Skill, but in long sessions Claude sometimes skips it. What is the best fix?',
        options: [
          o('a', 'Keep the Skill for how to read the results, and enforce "tests must pass" with a hook or a CI check', 'Judgment stays in guidance; the guarantee moves to something that runs every time.'),
          o('b', 'Make the sentence in the Skill louder, with capitals and the word IMPORTANT at the start of the line', 'Emphasis may help a little, but guidance can still be skipped or compacted away.'),
          o('c', 'Move the same sentence into the project instructions file so that it is loaded at the start of every session', 'Project instructions are also context. They are loaded reliably, but following them is still not enforced.'),
        ],
        correct: 'a',
      },
      body: `Two kinds of rule are easy to confuse.

A **procedure** is guidance for judgment: how to investigate a failing test, what a good summary looks like, which files to read first. It belongs in a Skill or in project instructions, because it needs a model that understands the situation.

A **policy** is a rule that must hold **every time**: the tests ran, the file outside the folder was not touched, the secret was not printed. A model can forget, skip or be talked out of a policy. Writing it more firmly changes the odds, not the nature of the rule.

The test is simple. Ask: "If this were skipped once, would that be unacceptable?" If yes, it is a policy, and it needs something that does not depend on the model choosing to comply.`,
    },
    {
      id: 's2',
      title: 'What a hook is',
      body: `A **hook** is a command you configure to run at a defined point in Claude Code's lifecycle: before a tool call, after one, when a prompt is submitted, when Claude finishes responding, when a session starts. It runs as ordinary code, outside the model, **every time** that point is reached.

That is its whole value: it is deterministic. A pre-tool hook can inspect what is about to happen and refuse it. A post-tool hook can run a formatter or a check on what just changed. A stop hook can verify the work before Claude is allowed to say it is done.

What a hook cannot do is judge. It checks what you told it to check. A hook that verifies "a test file changed" does not verify that the tests are good. The Claude Code hooks documentation describes the events and the exact way a hook signals a block; read the current guide for the details rather than trusting memory, because they are the kind of fact that changes.`,
    },
    {
      id: 's3',
      title: 'Choosing the mechanism',
      body: `Match the requirement to the mechanism, not the other way round:

| The requirement is… | Use | Because |
|---|---|---|
| How to approach or judge something | **Skill** | It needs understanding, and it can be skipped without disaster |
| A convention that applies to every task | **Project instructions** | Stable and loaded each session, but still guidance |
| A rule that must hold at the moment of an action | **Hook** | Runs every time at that point and can refuse |
| A limit on what the agent can touch at all | **Permission rule** | A capability that is not granted cannot be used |
| A check the whole team needs, regardless of tool | **CI check** | Runs on every change from every author, before merge |
| Fixed steps that never vary | **A script or workflow** | No judgment is needed, so use ordinary code |

Layers combine. A hook gives immediate feedback in the editor; the same check in CI catches what a hook cannot see, such as a change made by someone not using the agent.`,
    },
    {
      id: 's4',
      title: 'Designing a gate that holds',
      body: `A good gate has six properties:

1. **Deterministic.** The same input gives the same answer. No model call inside the check.
2. **Fast.** A slow gate gets disabled. Keep it to seconds.
3. **Clear when it fails.** The message says what is wrong and what to do next. Claude and a person can both act on it.
4. **Narrow.** It matches the action it guards, not every action. Over-blocking trains people to bypass it.
5. **Tested.** It has cases that must pass and cases that must block, including the case where the check itself breaks.
6. **Explicit about failure.** Decide whether it fails **closed** (block when unsure) or **open** (allow when unsure). A protective gate on something irreversible should fail closed; a convenience check can fail open. Say which, and why.

A gate that can be silently bypassed is a suggestion. Decide who may bypass it and leave a record when they do.`,
    },
    {
      id: 's5',
      title: 'Hooks are code you run',
      body: `A hook runs with **your** permissions on **your** machine. Treat it as code, because it is.

- **Read before you adopt.** A hook copied from a repository or a post can do anything a script can do. Read it as text first, as you would an install script.
- **Never trust the content it receives.** Hook input can include file names and text that came from untrusted places. A script that pastes that text into a shell command without quoting it can be made to run something else.
- **Keep it small and narrow.** A hook that does one check is easy to review; one that does ten is not.
- **Do not make it a second agent.** A hook that calls a model to decide has lost the property you wanted.

A hook that blocks is only as trustworthy as the person who last edited it. Review changes to hooks the way you review changes to a deployment script.`,
    },
  ],
  activity: {
    title: 'Put each rule in the right place',
    intro: 'Guided practice with invented requirements for an invented team. Nothing runs.',
    items: [
      {
        id: 'l26-p1',
        kind: 'classify',
        concept: 'deterministic-gates',
        prompt: 'Where should each requirement live?',
        categories: [
          { id: 'skill', label: 'Skill (guidance)' },
          { id: 'hook', label: 'Hook (enforced at the action)' },
          { id: 'ci', label: 'CI check (every change, before merge)' },
          { id: 'permission', label: 'Permission rule (capability)' },
        ],
        entries: [
          { id: 'e1', text: 'How to read a failing balance simulation and decide whether the economy is inflating', correct: 'skill', why: 'Interpreting a result needs judgment, which is what a Skill is for.' },
          { id: 'e2', text: 'The agent must never write outside the docs/summaries folder', correct: 'permission', why: 'It is a limit on what the agent can touch, so do not grant the capability at all.' },
          { id: 'e3', text: 'An edit to balance/economy.json must be refused unless the simulation has just been run', correct: 'hook', why: 'A rule that must hold at the moment of the edit, enforced without asking the model.' },
          { id: 'e4', text: 'No pull request from any contributor may merge with a failing typecheck', correct: 'ci', why: 'It must apply to every author and tool, including people who never use the agent.' },
          { id: 'e5', text: 'Prefer small, reviewable commits and describe the reason for each in the message', correct: 'skill', why: 'A working practice with room for judgment, and skipping it once is not a disaster.' },
          { id: 'e6', text: 'The agent must not read the credentials folder under any circumstances', correct: 'permission', why: 'Deny the capability instead of asking the model to promise not to use it.' },
        ],
        explanation: 'Judgment goes in guidance, must-hold rules go where they are enforced, and capability limits go in permissions.',
      },
      {
        id: 'l26-p2',
        kind: 'single',
        concept: 'deterministic-gates',
        prompt: 'A pre-edit gate protects a production configuration file. Its check script crashes with an error. What should the gate do?',
        options: [
          o('a', 'Block the edit and report that the check could not run, because an unverified change to production is the risk', 'A protective gate on something critical fails closed: when it cannot check, it does not allow.'),
          o('b', 'Allow the edit so that work is not held up by a broken script, and log a warning for someone to read later', 'Failing open on a protective gate means the gate disappears exactly when it breaks.'),
          o('c', 'Ask the model whether the edit looks safe and allow it if the model says that it does', 'Asking the model removes the determinism that made this a gate in the first place.'),
          o('d', 'Retry the check script three times in a row and allow the edit if any one of the attempts happens to pass', 'A check that passes only sometimes is a coin flip, and retrying hides the real failure.'),
        ],
        correct: 'a',
        hints: ['Ask what is worse here: a blocked edit, or an unchecked one.'],
        explanation: 'Decide fail-open or fail-closed on purpose, and for protective gates choose closed.',
      },
      {
        id: 'l26-p3',
        kind: 'case',
        format: 'diagnosis',
        concept: 'deterministic-gates',
        prompt: 'Diagnose this hook script.',
        situation: 'A team added a pre-commit hook that is supposed to refuse commits containing a secret. It has been "passing" for weeks, but a token reached the repository. The script is shown as inert text. Names are invented.',
        artifact: [
          '#!/bin/sh',
          'FILE=$1',
          'result=$(grep -c "SECRET" $FILE)',
          'if [ "$result" -gt 0 ]; then echo "found a secret"; fi',
          'exit 0',
        ],
        parts: [
          {
            id: 'failure',
            label: 'Why did a token get through?',
            options: [
              o('a', 'The script reports a problem but always exits with success, so the commit is never actually refused', 'The last line returns success regardless of what the check found.'),
              o('b', 'The script reads files too slowly, so the commit finished before the search had completed', 'The script is synchronous; speed is not what lets a commit through.'),
              o('c', 'The hook runs only when the model decides that a secret might be present in the changes', 'A hook runs every time its event occurs; it does not depend on the model\'s decision.'),
            ],
            correct: 'a',
          },
          {
            id: 'cause',
            label: 'Which weaknesses does the check itself have?',
            options: [
              o('a', 'It only looks for the literal word SECRET, and it does not quote the file name, so odd names break it', 'The pattern would miss real tokens, and the unquoted variable breaks on spaces or special characters.'),
              o('b', 'It checks too many files at once, which makes the output too long for anyone to read properly', 'It receives one file name; output length is not the problem.'),
              o('c', 'It uses a shell script rather than a model, and shell scripts cannot be trusted to inspect text', 'Deterministic scripts are exactly what a gate should be; the flaws here are in this script.'),
            ],
            correct: 'a',
          },
          {
            id: 'principle',
            label: 'Which principle does it break?',
            options: [
              o('a', 'A gate must refuse when its check fails, and it needs tests that show it blocks as well as allows', 'A gate that never blocks is a report, and no test would have shown that it cannot.'),
              o('b', 'A gate should be as long and detailed as possible so that it covers every kind of secret in existence', 'Narrow and tested beats long and untested.'),
              o('c', 'A gate should ask a person to approve every commit so that nothing is ever allowed automatically', 'Gating everything trains reflex approval and is slower than a rule that can decide.'),
            ],
            correct: 'a',
          },
          {
            id: 'fix',
            label: 'What is the safest correction?',
            options: [
              o('a', 'Make it exit with a blocking status when a match is found, quote the file name, use a real secret pattern and add a test case that must block', 'The gate now refuses, handles odd names, looks for the right thing and is tested.'),
              o('b', 'Keep the script as it is and add a sentence to the project instructions asking everyone to look for secrets', 'A request to look is guidance, and the broken gate would still show a pass.'),
              o('c', 'Replace the script with a model call that reads the diff and says whether a secret appears to be present', 'The result would no longer be deterministic, and it would still need a decision about blocking.'),
            ],
            correct: 'a',
          },
        ],
        hints: ['Read the last line first.'],
        explanation: 'A gate must be able to say no. Test it with a case that must be blocked.',
      },
    ],
  },
  assessment: {
    title: 'Independent check: gates and mechanisms',
    intro: 'New situations. Choose from the requirements and constraints given.',
    passMark: 0.7,
    items: [
      {
        id: 'l26-a1',
        kind: 'case',
        format: 'scenario',
        concept: 'deterministic-gates',
        critical: true,
        points: 2,
        prompt: 'Choose the mechanism for each requirement.',
        situation: 'A five-person team uses Claude Code on a shared repository. Their pipeline runs on every pull request. Three rules need an owner.',
        constraints: [
          'Contributors include people who edit by hand and never use the agent.',
          'Rule 1: every change must pass the linter before it can merge.',
          'Rule 2: the agent must never edit files under migrations/ without a person seeing the change first.',
          'Rule 3: how to write a good commit message for this team.',
        ],
        parts: [
          {
            id: 'rule1',
            label: 'Rule 1 (linter before merge) belongs in…',
            options: [
              o('a', 'A CI check, because it must apply to every author, including people who never use the agent', 'CI runs on every change from every contributor before merge.'),
              o('b', 'A Skill that tells the agent to run the linter, because the agent writes most of the changes', 'A Skill is guidance and does nothing for changes made by hand.'),
              o('c', 'The project instructions, so that every session begins by reading that the linter must be run', 'Instructions are still guidance, and hand edits would never see them.'),
            ],
            correct: 'a',
          },
          {
            id: 'rule2',
            label: 'Rule 2 (migrations need a person) belongs in…',
            options: [
              o('a', 'A hook or permission setting that requires approval before the agent edits that folder', 'It is a rule about the agent\'s action at the moment of editing, so enforce it there.'),
              o('b', 'A sentence in the commit-message Skill telling the agent to be careful when it works on migrations', 'Being careful is guidance and would not stop an edit.'),
              o('c', 'A CI check that runs after the pull request is opened and warns when migration files have changed', 'CI runs after the edit; the rule asks a person to see the change before the agent makes it.'),
            ],
            correct: 'a',
          },
          {
            id: 'rule3',
            label: 'Rule 3 (good commit messages) belongs in…',
            options: [
              o('a', 'A Skill or the project instructions, because it is a matter of judgment and skipping it once is not a disaster', 'Judgment and style are what guidance is for.'),
              o('b', 'A hook that rejects any commit message the model scores below a threshold for clarity and tone', 'Scoring by a model is not deterministic, and over-blocking a style rule would be disproportionate.'),
              o('c', 'A permission rule that denies the agent the capability to write commit messages that are too short', 'A permission controls what the agent can touch, not how well it writes.'),
            ],
            correct: 'a',
          },
        ],
        explanation: 'The constraint that some contributors never use the agent decides Rule 1: only CI sees every change. Rule 2 is about the agent\'s own action. Rule 3 is judgment.',
      },
      {
        id: 'l26-a2',
        kind: 'case',
        format: 'scenario',
        concept: 'deterministic-gates',
        points: 2,
        prompt: 'The same rules, a different team.',
        situation: 'A solo developer uses Claude Code on a personal project with no CI and no collaborators. The same three rules apply.',
        constraints: [
          'There is no CI service, and setting one up is not worth it for this project.',
          'The only contributor is the developer, who works with the agent.',
          'Rule 1: nothing may be committed with a failing linter.',
          'Rule 2: the agent must not edit migrations/ without being shown the change first.',
        ],
        parts: [
          {
            id: 'rule1',
            label: 'Where should Rule 1 (no commit with a failing linter) live now?',
            options: [
              o('a', 'In a hook that runs the linter before a commit and refuses it, since there is no CI to do it', 'With no CI, the enforcement point available is at the action itself.'),
              o('b', 'In a CI check, as before, and set up a hosted pipeline for this one project to run it', 'The constraints say that a pipeline is not worth the cost here.'),
              o('c', 'In a Skill, because the developer is the only author and will remember to follow it in each session', 'A Skill can be skipped, and "will remember" is not enforcement.'),
            ],
            correct: 'a',
          },
          {
            id: 'rule2',
            label: 'Where should Rule 2 (migrations need a person) live?',
            options: [
              o('a', 'In the same kind of approval rule as before, requiring the developer to approve edits to that folder', 'The rule is about the agent\'s action, which has not changed.'),
              o('b', 'Nowhere, because the developer is the only contributor and can notice a migration edit afterwards', 'After the fact it is a report; the rule asks to see the change first.'),
              o('c', 'In a CI check, because migrations are important enough to deserve a pipeline of their own', 'There is no CI, and a check after the edit does not meet the rule.'),
            ],
            correct: 'a',
          },
          {
            id: 'redundancy',
            label: 'What is the honest limit of this setup?',
            options: [
              o('a', 'Anything done outside the agent, such as by hand in another editor, is not covered by the hook', 'A hook guards the agent\'s lifecycle; it cannot see changes made elsewhere.'),
              o('b', 'Hooks cannot run a linter, so the rule would need to be left to the developer\'s memory', 'A hook can run a command such as a linter; that is a normal use.'),
              o('c', 'Nothing: a hook covers every change to the repository, whoever or whatever makes the change', 'A hook is tied to the tool\'s lifecycle, not to the repository.'),
            ],
            correct: 'a',
          },
        ],
        explanation: 'Remove the CI and the right place for Rule 1 flips from CI to a hook; the limit is that a hook only guards the agent\'s actions.',
      },
      {
        id: 'l26-a3',
        kind: 'case',
        format: 'diagnosis',
        concept: 'deterministic-gates',
        critical: true,
        prompt: 'Diagnose this gate.',
        situation: 'A hook is meant to refuse edits to files whose names are passed to it. Its script is shown as inert text. A contributor has noticed that a crafted file name makes it run an extra command. Names are invented.',
        artifact: [
          '#!/bin/sh',
          '# pre-edit gate: refuse edits to protected files',
          'eval "check_protected $1"',
          'status=$?',
          'if [ $status -ne 0 ]; then',
          '  echo "check failed, allowing edit anyway"',
          'fi',
          'exit 0',
        ],
        parts: [
          {
            id: 'failure',
            label: 'What is wrong with how it handles its input?',
            options: [
              o('a', 'It passes the file name straight into a shell evaluation, so a crafted name can run other commands', 'Using eval on text that came from outside lets that text become code.'),
              o('b', 'It reads only the first file name, so edits to more than one file at a time are never checked', 'The flaw that matters here is what happens to the name, not how many are read.'),
              o('c', 'It uses a variable called status, which can clash with the name of a variable inside the editor', 'The variable name is not the problem; the evaluation of untrusted text is.'),
            ],
            correct: 'a',
          },
          {
            id: 'failure-mode',
            label: 'What is wrong with how it handles failure?',
            options: [
              o('a', 'When the check fails, it prints a message and still exits with success, so the edit is allowed', 'It fails open on a protective gate: the failure is reported but never enforced.'),
              o('b', 'It prints the failure message to the screen when it should write it to a log file that nobody reads', 'Where the message goes is secondary to the fact that the edit is allowed.'),
              o('c', 'It fails closed, which means that a broken check blocks all work until somebody repairs the script', 'It does the opposite: it allows the edit whatever the check says.'),
            ],
            correct: 'a',
          },
          {
            id: 'principle',
            label: 'Which principles apply?',
            options: [
              o('a', 'A hook is code that handles untrusted input, and a protective gate should fail closed and be tested', 'Both flaws come from treating the gate as a convenience instead of as code that guards something.'),
              o('b', 'A hook should never contain conditions, because any branch in a gate is a place where mistakes can hide', 'Gates need conditions to decide; the issue is how these are written.'),
              o('c', 'A hook should be written in a language that the model understands best so that it can edit it quickly', 'The script is meant to run without the model, and ease of model editing is not a safety property.'),
            ],
            correct: 'a',
          },
          {
            id: 'fix',
            label: 'What is the safest correction?',
            options: [
              o('a', 'Call the check with the name as a quoted argument, never evaluate it, and exit with a blocking status when the check fails or cannot run', 'The input can no longer become code, and the gate refuses both on failure and on error.'),
              o('b', 'Keep the evaluation but strip a list of dangerous characters from the name first, and keep allowing on failure', 'A blocklist of characters is easy to get wrong, and the gate would still allow on failure.'),
              o('c', 'Remove the hook and rely on the model to avoid editing protected files, since it has been told which ones they are', 'This replaces a gate with a request, and the whole point was that the rule must hold.'),
            ],
            correct: 'a',
          },
        ],
        explanation: 'Two separate flaws: unsafe handling of untrusted input and failing open. Fix both, and test with a case that must block.',
      },
      {
        id: 'l26-a4',
        kind: 'construct',
        format: 'json',
        concept: 'deterministic-gates',
        points: 2,
        prompt: 'Write the specification for a gate.',
        brief: `Specify a hook as JSON for this rule: **an edit to \`balance/economy.json\` must be blocked unless the economy simulation has been run since the last change.** It is a design sketch for review, not Claude Code's settings format.

Include: a \`name\`; the \`event\` it runs on (before the edit); a \`matcher\` that is narrow; the \`check\` in plain words; what happens \`on_pass\` and \`on_fail\`; a \`failure_mode\` of \`"closed"\` or \`"open"\`; a clear \`message\` that says what to do next; and a \`test_cases\` list that includes a case that must **block** and a case where the check itself **crashes**.`,
        placeholder: '{\n  "name": "..."\n}',
        checks: [
          { id: 'json', label: 'It is valid JSON with a name', why: 'Give the specification a "name" string so that it can be referred to and reviewed.', test: (d) => str(parse(d)?.name).length > 2 },
          { id: 'event', label: 'It runs before the action, not after', why: 'A gate that must prevent an edit has to run before it: use a pre-action event such as PreToolUse.', test: (d) => /pre/i.test(str(parse(d)?.event)) },
          { id: 'matcher', label: 'The matcher is narrow, not everything', why: 'Match the one file or action that is guarded; a matcher of "*" blocks too much and trains people to bypass it.', test: (d) => { const m = str(parse(d)?.matcher).trim(); return m.length > 3 && !['*', '**', 'all', 'everything'].includes(m.toLowerCase()); } },
          { id: 'closed', label: 'It fails closed', why: 'This guards an unverified edit to important data, so when the check cannot run it should block: set failure_mode to "closed".', test: (d) => str(parse(d)?.failure_mode).toLowerCase() === 'closed' },
          { id: 'onfail', label: 'It blocks on failure', why: 'on_fail must say that the edit is blocked or refused; a message alone does not enforce anything.', test: (d) => /block|refus|den/i.test(str(parse(d)?.on_fail)) },
          { id: 'message', label: 'The message says what to do next', why: 'A failure message should name the next step, for example the command to run, so the agent and the person can act.', test: (d) => str(parse(d)?.message).length > 20 && /run|retry|npm|then/i.test(str(parse(d)?.message)) },
          { id: 'tests', label: 'It includes a case that must block and a case where the check crashes', why: 'List test cases: one that must be blocked, and one where the check itself fails, which must also block.', test: (d) => { const t = parse(d)?.test_cases; if (!Array.isArray(t)) return false; const text = JSON.stringify(t).toLowerCase(); return /block/.test(text) && /crash|error|fail|cannot|broken/.test(text) && t.length >= 3; } },
        ],
        rubric: [
          'Is every property of a good gate (deterministic, fast, clear, narrow, tested, explicit about failure) visible in your specification?',
          'Could the check be run without a model, in a few seconds?',
          'Would a person who never saw this rule understand why an edit was blocked from the message alone?',
          'What would you do if the gate turned out to block valid work often?',
        ],
        reference: HOOK_REFERENCE,
        explanation: 'A gate specification is useful when it names the point it runs, the narrow thing it guards, what it does on failure and on error, and how it is tested.',
      },
      {
        id: 'l26-a5',
        kind: 'multi',
        concept: 'deterministic-gates',
        prompt: 'Select the properties of a well-designed gate.',
        options: [
          o('a', 'It gives the same answer for the same input and makes no model call inside the check', 'Determinism is what makes it a gate instead of another opinion.'),
          o('b', 'It reports a clear reason and a next step when it blocks something', 'A person and the agent can both act on a message that says what to do.'),
          o('c', 'It matches every tool call, so that nothing can ever slip past without being inspected', 'An over-broad gate blocks valid work and teaches people to bypass it.'),
          o('d', 'It has test cases that must be allowed and cases that must be blocked, including a broken check', 'A gate that has never been shown to block is not known to work.'),
          o('e', 'It runs for as long as it needs, even minutes, so that its answer is as thorough as possible', 'A slow gate is disabled or worked around; keep it to seconds.'),
        ],
        correct: ['a', 'b', 'd'],
        explanation: 'Deterministic, clear and tested. Not over-broad, and not slow.',
      },
      {
        id: 'l26-a6',
        kind: 'single',
        concept: 'deterministic-gates',
        prompt: 'A coworker suggests asking the model to review every proposed edit and block the risky ones. As a gate, what is the main weakness?',
        options: [
          o('a', 'The decision is no longer deterministic or independent, so it can be wrong in the same way as the agent', 'A model gate shares the model\'s blind spots and can be talked around.'),
          o('b', 'Models cannot read file edits, so the review would have to be done on a summary that the agent wrote', 'Models can read edits; the issue is the quality and independence of the judgment.'),
          o('c', 'It would cost too much to run on every edit, which is the only reason that model gates are discouraged', 'Cost is one concern but not the main weakness of the design.'),
          o('d', 'Model reviews always block too many edits, which slows the agent down more than any other kind of gate', 'A model reviewer can also allow bad edits; blocking too much is not its defining flaw.'),
        ],
        correct: 'a',
        explanation: 'A model reviewer can add useful signal, but it is not a gate that must hold every time.',
      },
      {
        id: 'l26-a7',
        kind: 'classify',
        concept: 'deterministic-gates',
        prompt: 'Sort each statement about a hook.',
        categories: [
          { id: 'true', label: 'True' },
          { id: 'false', label: 'False' },
        ],
        entries: [
          { id: 'e1', text: 'A hook runs every time its event occurs, whether or not the model remembers the rule', correct: 'true', why: 'That is the property that makes a hook enforceable.' },
          { id: 'e2', text: 'A hook that checks that a test file changed proves that the tests are good', correct: 'false', why: 'It checks only what it was written to check.' },
          { id: 'e3', text: 'A hook copied from the internet should be read as code before it is adopted', correct: 'true', why: 'It runs with your permissions, like any script.' },
          { id: 'e4', text: 'A hook guarantees that nobody can change the repository without passing it', correct: 'false', why: 'It guards the tool\'s lifecycle; changes made elsewhere do not pass through it.' },
          { id: 'e5', text: 'A protective hook on irreversible actions should usually fail closed', correct: 'true', why: 'When the check cannot run, allowing is the riskier outcome.' },
          { id: 'e6', text: 'A hook is the best place for guidance about writing clear commit messages', correct: 'false', why: 'That is judgment, which suits a Skill or project instructions.' },
        ],
        explanation: 'Hooks are deterministic code at the action. They guard the agent\'s lifecycle, not the whole repository, and they only check what you told them to check.',
      },
    ],
  },
  failureModes: [
    'Writing a must-hold rule only as guidance and trusting the model to comply every time.',
    'A gate that reports a problem but always lets the action through.',
    'A hook that evaluates or interpolates untrusted text into a shell command.',
    'A protective gate that fails open when its own check breaks.',
    'An over-broad matcher that blocks valid work until people bypass the gate.',
    'Treating a hook as a repository-wide guarantee when it only guards the agent\'s actions.',
  ],
  application: {
    title: 'Turn one repeated reminder into a gate',
    body: 'Find a rule you keep restating in prompts or instructions ("always run X before Y"). Decide whether it is a policy. If it is, write the gate specification (event, narrow matcher, deterministic check, failure mode, message, tests), implement the smallest version that you can verify, and see it block something it should block.',
    fieldPrompt: 'Log it under Growth → Field evidence when a gate you built really blocked a case that guidance had let through.',
  },
  reviewItems: [
    { id: 'l26-r1', kind: 'single', concept: 'deterministic-gates', difficulty: 1, prompt: 'What is the main advantage of a hook over a sentence in a Skill?', options: [o('a', 'It runs at its point every time, without depending on the model remembering the rule', 'Determinism: the check runs whether or not the model would have followed the guidance.'), o('b', 'It lets the model use more context, because hooks are loaded before any of the instructions in the session', 'A hook is not a way to load context.'), o('c', 'It can judge whether code is of good quality, which a Skill is unable to do for a project of any size', 'A hook checks only what it is told to check; judging quality is not its strength.'), o('d', 'It makes the model write code faster by skipping the steps that a Skill would otherwise have asked for', 'A hook adds a check; it does not speed up the model.')], correct: 'a', explanation: 'A hook is enforcement; a Skill is guidance.' },
    { id: 'l26-r2', kind: 'single', concept: 'deterministic-gates', difficulty: 1, prompt: 'Which requirement is a policy rather than a procedure?', options: [o('a', 'Secrets must never be printed to the terminal, whatever the task is', 'It must hold every time, so it needs enforcement and not a reminder.'), o('b', 'Prefer descriptive names for new functions and keep each one short enough to read at a glance', 'A matter of style and judgment, where an occasional lapse is acceptable.'), o('c', 'Explain a bug before fixing it, in a paragraph that a teammate could read and challenge', 'A working practice that benefits from judgment and has no single mechanical test.'), o('d', 'Start each session by reading the notes from the previous one and summarising what changed since', 'A useful routine, though skipping it once is not unacceptable.')], correct: 'a', explanation: 'If skipping it once is unacceptable, it is a policy.' },
    { id: 'l26-r3', kind: 'single', concept: 'deterministic-gates', difficulty: 2, prompt: 'Why should a gate on an irreversible action usually fail closed?', options: [o('a', 'If it cannot tell whether the action is safe, allowing it risks an unrecoverable mistake', 'When unsure about something that cannot be undone, blocking is the safer error.'), o('b', 'Failing closed is faster, because a blocked action does not need to wait for the check script to finish', 'Speed has nothing to do with whether a gate fails open or closed.'), o('c', 'Failing open is not possible in Claude Code, so every hook is required to block when its check breaks', 'A hook can be written to allow on failure; that is a design choice you must make deliberately.'), o('d', 'A closed gate cannot be bypassed by anyone, which makes it the only kind that is ever worth building', 'A closed gate can still be bypassed by someone with the rights to change it.')], correct: 'a', explanation: 'Choose the failure mode deliberately; for irreversible actions, closed.' },
    { id: 'l26-r4', kind: 'multi', concept: 'deterministic-gates', difficulty: 2, prompt: 'Select the situations in which a CI check is a better home for a rule than a hook.', options: [o('a', 'The rule must apply to changes written by people who do not use the agent', 'CI sees every change, from every author.'), o('b', 'The rule must be checked once more at merge time, whatever happened on the author\'s machine', 'A merge-time check catches what a local hook missed or what was bypassed.'), o('c', 'The rule is about what the agent may do at the moment it edits a particular file on one machine', 'That is the agent\'s own action, which a hook sits next to and CI does not.'), o('d', 'The team wants one shared record of the result for every change, visible to all reviewers', 'A CI run produces a shared, inspectable result.')], correct: ['a', 'b', 'd'], explanation: 'CI is the team-wide, merge-time, shared-record layer. A hook is the action-time layer.' },
    { id: 'l26-r5', kind: 'single', concept: 'deterministic-gates', difficulty: 2, prompt: 'A hook script builds a shell command by pasting in a file name taken from the tool call. What is the risk?', options: [o('a', 'A crafted file name could contain extra commands that the shell would then run', 'Untrusted text must be passed as a quoted argument, never evaluated.'), o('b', 'Long file names make the command slower, which could cause the hook to time out and block valid work', 'Speed is not the risk; the risk is that text becomes code.'), o('c', 'The shell cannot read file names that contain spaces, so those edits would be allowed without being checked', 'Spaces cause bugs, but the serious flaw is the evaluation of text from outside.'), o('d', 'Nothing, because a file name that arrives from a tool call has already been checked by the model', 'The model does not sanitise names, and the name may have come from untrusted content.')], correct: 'a', explanation: 'A hook is code that handles untrusted input.' },
    { id: 'l26-r6', kind: 'single', concept: 'deterministic-gates', difficulty: 3, prompt: 'A gate blocks valid work often, and people start bypassing it. What is the best response?', options: [o('a', 'Narrow its matcher and fix its false positives, so that it blocks what it should and little else', 'A gate that is trusted stays on; narrowing it keeps the protection and removes the friction.'), o('b', 'Make the gate stricter, so that it blocks even more cases and people learn to avoid the actions it guards', 'More blocking makes bypassing more attractive, not less.'), o('c', 'Remove the gate and rely on guidance in the project instructions, which people are more likely to follow', 'This gives up the guarantee because the gate was annoying.'), o('d', 'Allow anyone to disable it permanently on their own machine, since they know their own work best', 'An open bypass makes the gate a suggestion; bypass should be deliberate and recorded.')], correct: 'a', explanation: 'Over-blocking is a design flaw. Fix it, do not abandon the gate.' },
    { id: 'l26-r7', kind: 'single', concept: 'deterministic-gates', difficulty: 3, prompt: 'Why is a test that only shows a gate allowing valid input not enough?', options: [o('a', 'A gate that never blocks would pass it too; you need a case that must be blocked, and one where the check breaks', 'Only blocking cases show that the gate can say no.'), o('b', 'Valid input is rarely seen in practice, so the gate would almost never meet it when the team uses the project', 'Valid input is the common case; the problem is what the test fails to cover.'), o('c', 'Tests for gates are not possible, because a gate depends on the live state of the machine on which it runs', 'A gate can be tested with inputs and fixtures like any other code.'), o('d', 'A test that passes proves the gate is slow, because every passing run has to wait for the full check to complete', 'Passing a test says nothing about speed.')], correct: 'a', explanation: 'Test the gate by trying to get past it.' },
    { id: 'l26-r8', kind: 'single', concept: 'deterministic-gates', difficulty: 3, prompt: 'Which statement about hooks is the most accurate?', options: [o('a', 'They guard the agent\'s lifecycle deterministically, but only against what they were written to check', 'Enforceable and limited: both halves matter.'), o('b', 'They guarantee that no bad change can ever reach the repository, from any tool or any person', 'A hook cannot see changes made outside the agent\'s lifecycle.'), o('c', 'They are only a convenience for formatting code and should not be used to enforce any real rule', 'Pre-action hooks can refuse actions, which is an enforcement use.'), o('d', 'They run in a sandbox that cannot affect your machine, so they never need to be read before they are adopted', 'Hooks run with your permissions and must be reviewed like any script.')], correct: 'a', explanation: 'Deterministic, narrow in what they check, and code you must trust.' },
  ],
  sources: [
    { ...DOCS.hooks, supports: 'What hooks are, when they run in the lifecycle, and how a hook allows or blocks an action.' },
    { ...DOCS.skills, supports: 'Skills as guidance that Claude may load, in contrast to enforcement.' },
    { ...DOCS.permissions, supports: 'Permission rules as a way to limit what Claude can touch.' },
    { ...DOCS.memory, supports: 'Project instructions as loaded context rather than enforcement.' },
    { ...ARTICLES.buildingAgents, supports: 'Preferring simple, checkable steps and adding autonomy only where it earns its place.' },
  ],
};

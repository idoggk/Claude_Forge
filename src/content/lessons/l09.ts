import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS } from './helpers';
import { DIFF_LINES, DIFF_TARGETS, SEEDED_ISSUES, DISTRACTOR_ISSUES, GATES, INTEGRATION_STEPS, VERDICTS } from '@/fixtures/review/handoff';

export const L09: Lesson = {
  id: 'L09-reviewer-vs-builder',
  version: 1,
  track: 'E',
  order: 9,
  title: 'Reviewer vs Builder',
  subtitle: 'Judge a multi-agent handoff: what was claimed, what was verified, what must gate the merge',
  prerequisites: ['L01-skill-or-tool', 'L06-merge-chain-failure'],
  competencies: ['multi-agent-review'],
  effortMinutes: 20,
  gameRelevance: 2,
  interestTags: ['orchestration', 'game-dev'],
  problem: 'Parallel agents each report success, a reviewer says "LGTM", CI is green - and the merge breaks determinism. Everyone was honest; nobody checked the same thing.',
  whyItMatters: 'Multi-agent workflows multiply output faster than they multiply verification. The Integrator role is where claims meet evidence.',
  objectives: [
    'Separate Builder claims from evidence in a handoff.',
    'Check that an approval\'s scope matches the change\'s scope.',
    'Choose the validation gates a change actually needs - and the ones it does not.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Three roles, three jobs',
      body: `- **Builder** produces the change and states what it claims.
- **Reviewer** verifies *independently*. A Builder reviewing its own work is a check on diligence, not on blind spots.
- **Integrator** owns the merge decision: do the claims have evidence, do the approvals cover the diff, does it merge cleanly with everything else on main?

Claude Code supports this shape with subagents (own context window, tools and permissions) and \`isolation: worktree\`, which runs a subagent in a temporary git worktree branched from your default branch.`,
    },
    {
      id: 's2',
      title: 'Claims need evidence; approvals need scope',
      body: `For each Builder claim ask: **where is the evidence?**
- "All tests pass" → were any skipped or removed? Which tests cover the new behaviour?
- "~40% faster" → baseline, method, numbers, benchmark in CI?
- "Deterministic" → does the determinism test run, and does any new code call an unseeded RNG?
- "Only touches X" → does the diff agree?

An approval covers **what was reviewed**. "Opened 2 of 5 files" is an approval of 2 files.`,
    },
    {
      id: 's3',
      title: 'Gates: deterministic vs judgment',
      body: `Put rules that must always hold in **CI or hooks** (Lesson 1): typecheck, no skipped tests, determinism simulation. Keep **human or agent judgment** for what cannot be mechanical: design review, risk assessment.

Choose gates **in proportion to the change**. A core-rules change needs the determinism and economy simulations; it does not need a manual playtest of six worlds, a bundle-size audit or an art review. Over-gating is a failure mode too: people route around it.`,
    },
    {
      id: 's4',
      title: 'When two Builders touch one file',
      body: `Evidence gathered on a stale base does not transfer to the merged code. When main moved and touched the same function, the fix is procedural: **rebase, resolve, then re-run every gate**, and re-review the resolved code. Never force-push over a shared branch to "tidy up".

On failure the Integrator **returns the change to the Builder with specific required changes** - not "fix later".`,
    },
  ],
  activity: {
    title: 'Run the integration review',
    intro: 'Read the fabricated handoff RB-17. Everything here is invented for training: no real repository or agent output.',
    widget: 'review-board',
    items: [
      {
        id: 'l09-p1',
        kind: 'flaglines',
        concept: 'multi-agent-review',
        filename: 'handoff-RB-17.diff',
        lines: DIFF_LINES,
        prompt: 'Flag the diff lines that carry a problem.',
        targets: DIFF_TARGETS,
        hints: ['Look for: a shared core file, anything random, a changed constant, and disabled tests.'],
        explanation: 'Lines 22 and 24 are skipped tests; line 11 breaks determinism.',
      },
      {
        id: 'l09-p2',
        kind: 'multi',
        concept: 'multi-agent-review',
        prompt: 'Which issues are real, evidence-backed defects in this handoff? Select all.',
        options: [
          ...SEEDED_ISSUES.map((i) => o(i.id, i.text, i.why)),
          ...DISTRACTOR_ISSUES.map((d) => o(d.id, d.text, `Not a blocking defect. ${d.why}`)),
        ],
        correct: SEEDED_ISSUES.map((i) => i.id),
        hints: ['Each real issue contradicts a Builder claim or an approval\'s scope. Style nits do not.'],
        explanation: 'Seven real issues, four distractors. Precision matters as much as recall.',
      },
      {
        id: 'l09-p3',
        kind: 'multi',
        concept: 'multi-agent-review',
        prompt: 'Which gates are REQUIRED before this change can merge? Select all.',
        options: GATES.map((g) => o(g.id, g.text, `${g.required ? 'Required. ' : 'Not required. '}${g.why}`)),
        correct: GATES.filter((g) => g.required).map((g) => g.id),
        hints: ['Match each gate to a seeded issue; reject gates that have no matching risk.'],
        explanation: 'Eight proportionate gates; four disproportionate ones.',
      },
      {
        id: 'l09-p4',
        kind: 'order',
        concept: 'multi-agent-review',
        prompt: 'Order the path from this handoff to a safe merge.',
        steps: INTEGRATION_STEPS,
        hints: ['Fix the cause, rebase, re-run everything, review the result, merge, smoke check.'],
        explanation: 'Evidence must come from the merged shape of the code.',
      },
      {
        id: 'l09-p5',
        kind: 'single',
        concept: 'multi-agent-review',
        prompt: 'What is the Integrator\'s verdict?',
        options: VERDICTS.map((v) => o(v.id, v.text, v.why)),
        correct: VERDICTS.find((v) => v.correct)!.id,
        explanation: 'Three critical issues and an approval that did not cover the core file.',
      },
    ],
  },
  assessment: {
    title: 'Handoff judgment check',
    intro:
      '**Handoff RB-22 (fictional) - spawn-rate tweak.** Builder: "I self-reviewed, so a second reviewer is unnecessary. I added 3 tests (happy path only). Benchmark attached: 41 ms → 29 ms per 1,000 spawns, 20 runs on one machine, method described. I force-pushed to the shared integration branch to tidy history. package-lock.json shows a 400-line change though I changed no dependencies." Reviewer: "Approved - read 1 of the 4 changed files." No hints.',
    passMark: 0.75,
    items: [
      {
        id: 'l09-a1',
        kind: 'classify',
        concept: 'multi-agent-review',
        prompt: 'Classify each finding in RB-22.',
        categories: [
          { id: 'blocker', label: 'Blocker' },
          { id: 'required', label: 'Required fix' },
          { id: 'acceptable', label: 'Acceptable' },
        ],
        entries: [
          { id: 'b1', text: 'The Builder self-reviewed and declined independent review', correct: 'blocker', why: 'A Builder cannot be the independent check on its own work.' },
          { id: 'b2', text: 'Force-push over the shared integration branch', correct: 'blocker', why: 'Rewrites shared history; others\' work may be lost. Must be restored first.' },
          { id: 'b3', text: 'A 400-line package-lock.json change with no declared dependency change', correct: 'required', why: 'Unreported change; needs explanation and a dependency audit.' },
          { id: 'b4', text: 'Tests added cover only the happy path, not chained spawns', correct: 'required', why: 'The risky behaviour is untested.' },
          { id: 'b5', text: 'Benchmark attached with before/after numbers, 20 runs and a described method', correct: 'acceptable', why: 'The claim has evidence; checking the method is a reviewer task, not a blocker.' },
          { id: 'b6', text: 'The Reviewer read only 1 of 4 changed files before approving', correct: 'blocker', why: 'The approval covers one file; it cannot gate the change.' },
        ],
        explanation: 'Blockers stop the merge; required fixes must be done before it; acceptable items need no action.',
      },
      {
        id: 'l09-a2',
        kind: 'multi',
        concept: 'multi-agent-review',
        prompt: 'Which gates does RB-22 need before merge? Select all.',
        options: [
          o('a', 'Independent review covering all four changed files', 'Required: the existing approval covers one.'),
          o('b', 'An explanation and dependency audit of the package-lock.json change', 'Required: unreported change.'),
          o('c', 'A test that covers chained spawns', 'Required: the risky case is untested.'),
          o('d', 'Restore the shared branch history, then re-run checks on the restored base', 'Required: force-push damage first.'),
          o('e', 'Re-run the benchmark on three other machines', 'Not required: disproportionate; evidence and method were provided.'),
          o('f', 'Manual playtest of every world', 'Not required: disproportionate.'),
        ],
        correct: ['a', 'b', 'c', 'd'],
        explanation: 'Proportionate gates follow the findings.',
      },
      {
        id: 'l09-a3',
        kind: 'single',
        concept: 'multi-agent-review',
        prompt: 'The Integrator\'s verdict on RB-22?',
        options: [
          o('a', 'Merge: tests pass and a benchmark is attached', 'Ignores the blockers.'),
          o('b', 'Do not merge: restore the branch, get independent review of all files, explain the lockfile change and add the chained-spawn test', 'Correct.'),
          o('c', 'Merge now, fix the lockfile later', 'Defers a required fix on unknown content.'),
          o('d', 'Reject permanently', 'Disproportionate; the change is salvageable.'),
        ],
        correct: 'b',
        explanation: 'Return with specific required changes.',
      },
      {
        id: 'l09-a4',
        kind: 'single',
        concept: 'multi-agent-review',
        critical: true,
        points: 2,
        prompt: 'A Reviewer approves after reading 1 of 4 changed files. What does the approval cover?',
        options: [
          o('a', 'The whole change, because Reviewers are trusted', 'Approval scope is what was reviewed.'),
          o('b', 'Only the file that was read', 'Correct.'),
          o('c', 'The whole change if CI is green', 'CI does not widen a review.'),
          o('d', 'Nothing - approvals are invalid unless two people sign', 'Overcorrection.'),
        ],
        correct: 'b',
        explanation: 'Approval scope must match change scope.',
      },
      {
        id: 'l09-a5',
        kind: 'single',
        concept: 'multi-agent-review',
        prompt: 'Which of these should be enforced by CI or a hook rather than a Skill?',
        options: [
          o('a', 'Block the merge when any test was skipped or removed', 'Correct: mechanical, must always hold.'),
          o('b', 'Judge whether the design is easy to maintain', 'Judgment - suits a Reviewer.'),
          o('c', 'Decide which gates are proportionate', 'Judgment - suits the Integrator.'),
          o('d', 'Explain the change to teammates', 'A writing task.'),
        ],
        correct: 'a',
        explanation: 'Deterministic rule → deterministic enforcement (Lesson 1).',
      },
    ],
  },
  failureModes: [
    'Treating "approved" as covering files nobody opened.',
    'Trusting green CI that includes skipped tests.',
    'Merging evidence gathered on a stale base.',
    'Over-gating until people route around the process.',
  ],
  application: {
    title: 'Write your Integrator checklist',
    body: 'Write the gates your One More Merge repository needs for a core-rules change, split into mechanical (CI/hook) and judgment (review). Practical takeaway: the first gate to automate is "no skipped or removed tests".',
    fieldPrompt: 'Log it under Growth → Field evidence when you add a real gate or hook, or catch a real defect with the Claim → Evidence → Scope check.',
  },
  reviewItems: [
    {
      id: 'l09-r1',
      kind: 'single',
      concept: 'multi-agent-review',
      prompt: 'Who owns the final merge decision in the Builder/Reviewer/Integrator model?',
      options: [o('a', 'The Integrator', 'Correct.'), o('b', 'The Builder', 'The Builder is the party being checked.'), o('c', 'Whoever commits last', 'Committing last is not a role; ownership is assigned, not accidental.'), o('d', 'The Reviewer alone', 'Reviewers verify; they do not integrate.')],
      correct: 'a',
      explanation: 'Integrator = claims meet evidence.',
    },
    {
      id: 'l09-r2',
      kind: 'single',
      concept: 'multi-agent-review',
      prompt: 'Two Builders edited the same function and main has moved. What must happen after resolving the conflict?',
      options: [o('a', 'Re-run all gates and re-review the resolved code', 'Correct.'), o('b', 'Nothing - earlier results still apply', 'They were on a different base.'), o('c', 'Only re-run typecheck', 'Typecheck alone would not catch skipped tests or a determinism regression.'), o('d', 'Force-push', 'Never over a shared branch.')],
      correct: 'a',
      explanation: 'Evidence does not transfer across bases.',
    },
    {
      id: 'l09-r3',
      kind: 'multi',
      concept: 'multi-agent-review',
      prompt: 'Select the disproportionate gates for a one-line copy change.',
      options: [o('a', 'Full six-world manual playtest', 'Disproportionate.'), o('b', 'Typecheck', 'Cheap and standard.'), o('c', 'Bundle-size audit', 'No assets or deps changed.'), o('d', 'Existing test suite', 'Running the existing suite is a normal gate, not a disproportionate one.')],
      correct: ['a', 'c'],
      explanation: 'Proportionality.',
    },
  ],
  sources: [{ ...DOCS.subagents, supports: 'Own context windows, tool restrictions, isolation: worktree.' }, { ...DOCS.hooks, supports: 'Deterministic enforcement at lifecycle events.' }],
};

import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS } from './helpers';

/** Description used by the Trigger Dojo widget and the practice items. Author-written teaching sample. */
export const DOJO_DESCRIPTION =
  'Debugs merge-board cascade failures in a puzzle game: pieces that vanish, scores that differ after chain merges, seeded simulations that diverge. Use when investigating merge or cascade bugs. Not for general refactoring, UI styling or balance tuning.';

export const L03: Lesson = {
  id: 'L03-trigger-dojo',
  version: 1,
  track: 'C',
  order: 3,
  title: 'Trigger Dojo',
  subtitle: 'Write descriptions that fire for the right requests - and stay quiet for the wrong ones',
  prerequisites: ['L02-inside-skill-md'],
  competencies: ['trigger-design'],
  effortMinutes: 14,
  gameRelevance: 2,
  interestTags: ['authoring', 'game-dev'],
  problem: 'A Skill that never activates is dead weight; one that activates on everything pollutes context and hijacks unrelated work. Both come from the same place: the description.',
  whyItMatters: 'Claude decides whether to load a Skill by matching your request against its description. Trigger design is the highest-leverage part of authoring - and the part you can design on paper before you ever run Claude.',
  objectives: [
    'Write a description with a concrete "use when" trigger and a "not for" boundary.',
    'Build positive, negative and ambiguous test prompts, especially near-misses.',
    'State what an offline check can and cannot tell you about real activation.',
  ],
  segments: [
    {
      id: 's1',
      title: 'How activation actually works',
      body: `- **Automatic:** Claude loads a Skill when the request matches its \`description\` (plus \`when_to_use\`). The description is always in context; the body is not.
- **Manual:** you type \`/skill-name\`. \`disable-model-invocation: true\` makes a Skill manual-only; \`user-invocable: false\` makes it Claude-only.
- **Path-scoped:** a \`paths\` glob restricts automatic loading to matching files.

Because the description is the *only* thing used to decide, it must carry the trigger.`,
    },
    {
      id: 's2',
      title: 'Anatomy of a description that triggers well',
      body: `1. **What it does**, in concrete verbs and the symptoms a user would actually describe ("pieces that vanish", not "improves game quality").
2. **When to use it:** "Use when …" with the words users type.
3. **When not to use it:** "Not for …" - the boundary that stops over-triggering on neighbouring tasks.
4. **Third person** ("Debugs …"), key trigger first (long entries are truncated at 1,536 characters), square brackets instead of angle brackets.

Compare: *"Helps with merges."* vs *"Debugs merge-board cascade failures: pieces that vanish … Use when investigating merge or cascade bugs. Not for general refactoring."*`,
    },
    {
      id: 's3',
      title: 'Three kinds of test prompt',
      body: `- **Positive:** should load the Skill, including *paraphrases* that avoid your exact keywords ("pieces vanish when I drop a fourth one" - no word "cascade").
- **Negative:** should not load it. The valuable ones are **near-misses**: same domain, different job ("rename the variables in the board file").
- **Ambiguous:** reasonable people disagree ("something is wrong with the board"). Decide what you *want*, then adjust the description to produce it.

Write at least two of each of the first two and one ambiguous before you trust a description.`,
    },
    {
      id: 's4',
      title: 'What an offline check cannot prove',
      body: `Forge's Trigger Dojo shows a **lexical overlap meter**: shared content words between a prompt and your description. That is a useful drafting aid and deliberately simple. It is **not** a model of Claude: Claude reads semantically, may activate when words differ, or stay quiet when they match.

Only a **live test** shows real behaviour. The docs' troubleshooting order for a Skill that does not trigger: check the description has natural keywords → confirm it appears in "What skills are available?" → rephrase the request → invoke \`/skill-name\` directly → check the name was not refused (\`claude --debug\`). For plugin Skills, \`claude plugin eval\` can measure trigger rate with a \`tool_used: Skill\` grader.`,
    },
  ],
  activity: {
    title: 'Predict, then compare with the designer\'s labels',
    intro: 'Use the overlap meter to explore the sample description, then label eight prompts the way the *designer* intends. Labels are the designer\'s intent, not a measurement of Claude.',
    widget: 'trigger-dojo',
    items: [
      {
        id: 'l03-p1',
        kind: 'classify',
        concept: 'trigger-design',
        prompt: 'For the sample description, label each prompt: should it ACTIVATE the Skill, NOT activate it, or is it AMBIGUOUS?',
        categories: [
          { id: 'activate', label: 'Should activate' },
          { id: 'not-activate', label: 'Should not' },
          { id: 'ambiguous', label: 'Ambiguous' },
        ],
        entries: [
          { id: 'q1', text: 'My merge cascade loses a piece after a chain of merges', correct: 'activate', why: 'Exactly the symptom the description names.' },
          { id: 'q2', text: 'Seed 7 diverges from the expected score after chain merges', correct: 'activate', why: '"seeded simulations that diverge" and "scores that differ after chain merges".' },
          { id: 'q3', text: 'Pieces vanish when I drop a fourth piece next to a group', correct: 'activate', why: 'A paraphrase with no "cascade" keyword - a good positive test of the symptom wording.' },
          { id: 'q4', text: 'Rename the variables in the board file to be clearer', correct: 'not-activate', why: 'A near-miss: same files, but the description excludes general refactoring.' },
          { id: 'q5', text: 'Make the shop screen buttons larger on mobile', correct: 'not-activate', why: 'UI styling is explicitly excluded.' },
          { id: 'q6', text: 'Why are players swimming in shards by stage 40?', correct: 'not-activate', why: 'Balance tuning is excluded - that is a different Skill.' },
          { id: 'q7', text: 'Something is wrong with the board', correct: 'ambiguous', why: 'Too vague to say. Decide whether you want activation on vague board complaints.' },
          { id: 'q8', text: 'Add a new merge rank above rank 6', correct: 'ambiguous', why: 'It touches merge rules but it is a feature, not a failure investigation.' },
        ],
        hints: ['Look for the symptoms named in the description, then the exclusions after "Not for".'],
        explanation: 'Notice how the paraphrase (q3) and the vague complaint (q7) are exactly where wording-based checks and real activation can disagree.',
      },
      {
        id: 'l03-p2',
        kind: 'single',
        concept: 'trigger-design',
        prompt: 'Which rewrite of "Helps with merges." is the strongest description?',
        options: [
          o('a', 'Debugs merge-board cascade failures: pieces that vanish, scores that differ after chain merges. Use when investigating merge or cascade bugs. Not for refactoring or UI work.', 'Concrete symptoms, a "use when" trigger, a boundary, third person.'),
          o('b', 'A powerful all-in-one assistant for anything related to the board, merges, UI, balance and testing.', 'Over-broad: will fire on neighbouring tasks and hijack other Skills.'),
          o('c', 'I can help you debug merges whenever you need me.', 'First person, no trigger, no symptoms.'),
          o('d', 'merge-debug', 'Too short to match anything.'),
        ],
        correct: 'a',
        hints: ['Count how many of: concrete symptoms, "use when", "not for", third person each option has.'],
        explanation: 'Specificity beats breadth.',
      },
      {
        id: 'l03-p3',
        kind: 'multi',
        concept: 'trigger-design',
        prompt: 'Which edits make a Skill LESS likely to over-trigger? Select all.',
        options: [
          o('a', 'Add a "Not for …" exclusion naming the neighbouring tasks', 'Yes - a boundary is the most direct fix.'),
          o('b', 'Replace generic verbs ("helps with") with concrete symptoms', 'Yes - specific language matches fewer unrelated requests.'),
          o('c', 'Add every synonym for "game" and "bug"', 'No - widening vocabulary widens triggering.'),
          o('d', 'Set disable-model-invocation: true when you want it manual-only', 'Yes - it removes the Skill from automatic matching entirely (and from the always-on listing).'),
          o('e', 'Make the description much longer', 'No - length is not specificity, and long entries are truncated.'),
        ],
        correct: ['a', 'b', 'd'],
        explanation: 'The docs\' advice for a Skill that triggers too often: make the description more specific, or make it manual-only.',
      },
    ],
  },
  assessment: {
    title: 'Trigger design check',
    intro: 'A different description, unseen prompts, no hints.',
    passMark: 0.75,
    items: [
      {
        id: 'l03-a1',
        kind: 'classify',
        concept: 'trigger-design',
        prompt:
          'Description under test: "Drafts release notes from merged pull requests. Use when the user asks for release notes, a changelog entry or a summary of what shipped. Not for commit messages or PR descriptions." Label each prompt.',
        categories: [
          { id: 'activate', label: 'Should activate' },
          { id: 'not-activate', label: 'Should not' },
          { id: 'ambiguous', label: 'Ambiguous' },
        ],
        entries: [
          { id: 'y1', text: 'Write the changelog entry for version 0.9', correct: 'activate', why: 'Named directly: "changelog entry".' },
          { id: 'y2', text: 'Summarize what shipped this sprint from the merged PRs', correct: 'activate', why: '"a summary of what shipped" from merged pull requests.' },
          { id: 'y3', text: 'Write a commit message for this diff', correct: 'not-activate', why: 'Explicitly excluded.' },
          { id: 'y4', text: 'Improve this PR description', correct: 'not-activate', why: 'Explicitly excluded - a near-miss in the same domain.' },
          { id: 'y5', text: 'Tell me about the project\'s history', correct: 'ambiguous', why: 'Related to shipped work but not a request for release notes.' },
          { id: 'y6', text: 'Document the new combo system for players', correct: 'ambiguous', why: 'Might be release-note-ish or player docs; the description does not decide.' },
        ],
        explanation: 'Near-misses (y3, y4) are the prompts that reveal over-triggering.',
      },
      {
        id: 'l03-a2',
        kind: 'single',
        concept: 'trigger-design',
        prompt: 'Your lexical-overlap meter says "likely" for a prompt. What does that prove about real activation?',
        options: [
          o('a', 'Claude will definitely load the Skill', 'Overlap is wording, not Claude\'s decision.'),
          o('b', 'Nothing about real activation - it only means the wording overlaps; a live test is required', 'Correct.'),
          o('c', 'The Skill is well designed', 'Overlap says nothing about design quality.'),
          o('d', 'Claude will load it at least half the time', 'There is no such probability.'),
        ],
        correct: 'b',
        explanation: 'Offline heuristics are a drafting aid; only live tests show behaviour.',
      },
      {
        id: 'l03-a3',
        kind: 'order',
        concept: 'trigger-design',
        prompt: 'Order the documented troubleshooting steps for "my Skill is not triggering".',
        steps: [
          { id: 't1', text: 'Check the description includes keywords users would naturally say', why: 'The cheapest check first.' },
          { id: 't2', text: 'Verify the Skill appears when you ask "What skills are available?"', why: 'Confirms it loaded at all.' },
          { id: 't3', text: 'Try rephrasing the request to match the description more closely', why: 'Tests whether wording is the issue.' },
          { id: 't4', text: 'Invoke it directly with /skill-name', why: 'Separates "loaded but not matched" from "not loaded".' },
          { id: 't5', text: 'If /skill-name is not recognized, check whether Claude Code refused the name (claude --debug)', why: 'Name or frontmatter errors.' },
        ],
        explanation: 'This is the order given in the Skills documentation\'s troubleshooting section.',
      },
      {
        id: 'l03-a4',
        kind: 'multi',
        concept: 'trigger-design',
        prompt: 'Which belong in a MANUAL live-test checklist for a Skill\'s triggering? Select all.',
        options: [
          o('a', 'Each positive and negative prompt typed into a fresh session', 'Yes - fresh context avoids carry-over.'),
          o('b', 'Checking the transcript for a Skill tool call naming the Skill', 'Yes - that is the observable evidence.'),
          o('c', 'Recording what actually happened, including surprises', 'Yes - observations, not assumptions.'),
          o('d', 'Assuming the overlap meter\'s prediction and ticking "passed"', 'No - that substitutes a heuristic for evidence.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Live tests are manual in Forge: it cannot run Claude.',
      },
      {
        id: 'l03-a5',
        kind: 'single',
        concept: 'trigger-design',
        prompt: 'Which test prompt is the most informative NEGATIVE for a merge-debugging Skill?',
        options: [
          o('a', 'What is the capital of France?', 'Too easy - nothing nearby would ever match.'),
          o('b', 'Rename the variables in board.ts to be clearer', 'A near-miss: same code area, different job.'),
          o('c', 'Write a haiku', 'Too far from the domain.'),
          o('d', 'Debug the merge cascade', 'That is a positive.'),
        ],
        correct: 'b',
        explanation: 'Near-misses discover over-triggering that obvious negatives cannot.',
      },
    ],
  },
  failureModes: [
    'Descriptions that restate the Skill name instead of naming symptoms.',
    'No "not for" boundary, so the Skill fires on neighbouring tasks.',
    'Testing only obvious positives and obvious negatives.',
    'Treating an offline overlap score as proof.',
  ],
  application: {
    title: 'Write scenarios for a Skill you actually want',
    body: 'Pick one repeated task in One More Merge. Write its description, then 3 positive (one paraphrase), 3 negative (two near-misses) and 1 ambiguous prompt in the Workshop. Run them in a fresh Claude Code session and record what happened.',
    fieldPrompt: 'Log it under Growth → Field evidence when you have live-tested a description against real prompts and changed it based on what you saw.',
  },
  reviewItems: [
    {
      id: 'l03-r1',
      kind: 'single',
      concept: 'trigger-design',
      prompt: 'Which description part prevents a Skill from firing on neighbouring tasks?',
      options: [o('a', 'A "Not for …" boundary', 'Correct.'), o('b', 'A longer first sentence', 'Length is not a boundary.'), o('c', 'More synonyms', 'Widens triggering.'), o('d', 'A catchy name', 'The description does the matching.')],
      correct: 'a',
      explanation: 'Boundaries reduce over-triggering.',
    },
    {
      id: 'l03-r2',
      kind: 'single',
      concept: 'trigger-design',
      prompt: 'Why include a paraphrase among your positive test prompts?',
      options: [o('a', 'To check the description works without the exact keywords', 'Correct.'), o('b', 'To make the test longer', 'Test length is not a goal; coverage of the wording users might really use is.'), o('c', 'Because the docs require it', 'Not a requirement.'), o('d', 'To reduce tokens', 'Token use is unrelated to why you test paraphrases.')],
      correct: 'a',
      explanation: 'Users rarely repeat your exact words.',
    },
    {
      id: 'l03-r3',
      kind: 'multi',
      concept: 'trigger-design',
      prompt: 'Select the ways to make a Skill manual-only or Claude-only.',
      options: [o('a', 'disable-model-invocation: true → manual-only', 'Correct.'), o('b', 'user-invocable: false → Claude-only', 'Correct.'), o('c', 'context: fork → manual-only', 'Runs in a subagent; unrelated.'), o('d', 'license: MIT → Claude-only', 'A licence field has no effect on who can invoke the Skill.')],
      correct: ['a', 'b'],
      explanation: 'These are the two invocation switches.',
    },
  ],
  sources: [{ ...DOCS.skills, supports: 'Invocation modes, description guidance, troubleshooting order, claude plugin eval trigger measurement.' }],
};

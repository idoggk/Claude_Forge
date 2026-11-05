import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS } from './helpers';
import { DEMO_EXPERIMENT } from '@/domain/experiments/demo';
import { compareExperiment } from '@/domain/experiments/compare';

const demoCmp = compareExperiment(DEMO_EXPERIMENT);
const testsRow = demoCmp.rows.find((r) => r.id === 'testsPassedRatio')!;
const meanB = testsRow.perCondition.find((c) => c.conditionId === 'demo-b')!.stat.mean ?? 0;

export const L08: Lesson = {
  id: 'L08-battle-lab',
  version: 1,
  track: 'safety-eval',
  alsoIn: ['claude-code'],
  order: 8,
  title: 'The AI Lab',
  subtitle: 'Compare workflows with controlled, honestly-reported experiments',
  prerequisites: ['L05-first-custom-skill'],
  competencies: ['experiment-design'],
  effortMinutes: 20,
  gameRelevance: 2,
  interestTags: ['experiments', 'authoring'],
  problem: '"This Skill feels better" is how people end up with a drawer full of Skills that cost context and change nothing. LLM output varies from run to run, so one lucky run proves nothing.',
  whyItMatters: 'The goal of the whole course is to replace impressions with evidence. The AI Lab gives you the structure; you supply honest data.',
  objectives: [
    'Design a comparison with exactly one stated difference, a fixed fixture, prompt and rubric.',
    'Record evidence with its provenance, and keep missing data as unknown.',
    'Read results with sample size and overlapping ranges in mind, and separate observations from conclusions.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Why impressions mislead',
      body: `- **Variance:** the same prompt can give different results on different runs. One run per condition is an anecdote.
- **Cherry-picking:** remembering the best run of the Skill and the worst run of the baseline.
- **Moving goalposts:** deciding what "better" means *after* you see the output.
- **Hidden differences:** a different prompt, model setting or fixture between conditions.

Claude Code's own tooling targets the same problems: the skill-creator plugin benchmarks with-skill vs without-skill (pass rate, time, tokens) and does blind A/B between versions; \`claude plugin eval\` runs prompts with and without a plugin. Forge teaches the method; it does not run Claude for you.`,
    },
    {
      id: 's2',
      title: 'Design before you run',
      body: `Write down, **before the first run**:
1. **Hypothesis** - what you expect and what would change your mind.
2. **Success criteria** - observable ("all tests pass", "no test file edited").
3. **One difference** between conditions - e.g. "Skill X enabled", nothing else.
4. **Fixed inputs** - fixture (version + hash), prompt, rubric, model/settings if known.
5. **Run count** - at least 3 per condition; more is better.

Forge locks the rubric when you record the first run so you cannot quietly change it.`,
    },
    {
      id: 's3',
      title: 'Evidence, provenance and unknowns',
      body: `Every value is **self-reported** (you typed it) or **user-imported** (you uploaded a file, such as a test report). Forge does not verify either. Prefer objective measures (tests passed, a seeded checklist) over subjective rubric scores, and keep them separate.

**Unknown is not zero.** If you did not time a run, leave runtime blank: it is excluded from the average and counted as *missing*. Averaging a missing value as 0 would make that condition look faster.`,
    },
    {
      id: 's4',
      title: 'Reading results',
      body: `Show **n**, the **range** and the unknowns - not just a mean. If the ranges of two conditions overlap, the difference may be noise. Write **observations** (what you recorded) separately from **conclusions** (what you infer), and list **limitations**.

A single fixture, three runs and self-reported counts can support "directionally better on this fixture", never "this Skill is better".`,
    },
  ],
  activity: {
    title: 'Read a synthetic experiment, then record a real one',
    intro: 'The demonstration below uses invented data to teach method; no Claude execution occurred. Then create your own experiment in the AI Lab.',
    widget: 'experiment-demo',
    items: [
      {
        id: 'l08-p1',
        kind: 'classify',
        concept: 'experiment-design',
        prompt: 'For the SYNTHETIC demo experiment, classify each statement.',
        categories: [
          { id: 'supported', label: 'Supported by the recorded data' },
          { id: 'overreach', label: 'Overreach' },
          { id: 'unknown', label: 'Cannot say (data missing)' },
        ],
        entries: [
          { id: 'd1', text: 'B passed the full test suite in 2 of 3 runs; A in 1 of 3', correct: 'supported', why: 'Counted directly from the recorded runs.' },
          { id: 'd2', text: 'The debugging Skill makes Claude better at debugging', correct: 'overreach', why: 'One synthetic fixture, three runs, self-reported counts: far too little for a general claim.' },
          { id: 'd3', text: 'A\'s average runtime across its 3 runs was 105 seconds', correct: 'overreach', why: 'That averages a missing value as zero: (140 + 0 + 175) / 3. Only 2 of A\'s runs were timed; the mean of known values is 157.5 s.' },
          { id: 'd4', text: 'On the runs where it was timed, B was slower than A', correct: 'supported', why: 'B: 180-205 s, A: 140-175 s; the recorded ranges do not overlap.' },
          { id: 'd5', text: 'B used less developer effort than A in run 3', correct: 'unknown', why: 'B\'s run-3 effort was not recorded.' },
          { id: 'd6', text: 'The Skill will also help on the economy fixture', correct: 'overreach', why: 'Nothing was tested on that fixture.' },
        ],
        hints: ['Ask for each: is it directly counted in the data, does it generalize beyond the data, or is a number missing?'],
        explanation: 'Separate what was observed from what is inferred - and from what is simply not known.',
      },
      {
        id: 'l08-p2',
        kind: 'single',
        concept: 'experiment-design',
        prompt: 'You forgot to time one run. How should the report treat its runtime?',
        options: [
          o('a', 'As 0 seconds, so the condition looks fast', 'This invents a value and biases the mean.', 'unknown-is-zero'),
          o('b', 'As the average of the other runs', 'This also invents data.'),
          o('c', 'As unknown: excluded from the mean and counted as missing', 'Correct.'),
          o('d', 'Delete the whole run', 'The run still has other valid evidence.'),
        ],
        correct: 'c',
        explanation: 'Forge never silently converts unknown to zero.',
      },
      {
        id: 'l08-p3',
        kind: 'multi',
        concept: 'experiment-design',
        prompt: 'Which of these make a comparison UNFAIR? Select all.',
        options: [
          o('a', 'Condition B\'s prompt has an extra sentence of hints', 'Another difference besides the Skill.'),
          o('b', 'Both conditions use the same fixture files (same hash) and prompt', 'This is what you want.'),
          o('c', 'A used the fixture v1 and B used a slightly edited copy', 'Different inputs.'),
          o('d', 'A has 5 runs and B has 2', 'Unequal evidence; B\'s range is much less certain.'),
          o('e', 'The rubric was rewritten after seeing the results', 'Moving goalposts.'),
        ],
        correct: ['a', 'c', 'd', 'e'],
        explanation: 'Controlled means one stated difference and everything else fixed.',
      },
      {
        id: 'l08-p4',
        kind: 'external',
        concept: 'experiment-design',
        check: 'battle-lab-experiment',
        points: 3,
        prompt: 'Record a real experiment in the AI Lab: a hypothesis, two conditions, at least one run each with at least one measurement, and one evidence item. The checklist verifies your saved data.',
        explanation: 'You may use made-up-free data from real runs, or - while learning the tool - runs you actually perform by hand in Claude Code. Do not enter invented numbers.',
      },
    ],
  },
  assessment: {
    title: 'Experiment design check',
    intro: 'Honesty items are mandatory. No hints.',
    passMark: 0.8,
    items: [
      {
        id: 'l08-a1',
        kind: 'single',
        concept: 'experiment-design',
        critical: true,
        points: 2,
        prompt: 'One run each: the run with the Skill passed all tests; the run without failed. What can you conclude?',
        options: [
          o('a', 'The Skill works', 'A single run per condition cannot separate the Skill from run-to-run variation.', 'one-run-proof'),
          o('b', 'It is an anecdote: record it, but run more before claiming anything', 'Correct.'),
          o('c', 'The Skill is 100% effective', 'One pass is not a rate.'),
          o('d', 'The baseline is broken', 'Nothing supports that either.'),
        ],
        correct: 'b',
        explanation: 'A single successful run does not imply superiority.',
      },
      {
        id: 'l08-a2',
        kind: 'single',
        concept: 'experiment-design',
        critical: true,
        points: 2,
        prompt: 'Condition A has runtimes 120 s, (not timed), 180 s. What is a valid way to report it?',
        options: [
          o('a', 'Mean 100 s (treating the missing run as 0)', 'Counting the missing run as 0 drags the mean down and makes the condition look faster than it was.'),
          o('b', 'Mean 150 s over the 2 timed runs, with 1 run marked unknown', 'Correct.'),
          o('c', 'Mean 150 s with no mention of the missing run', 'Hides the gap.'),
          o('d', 'Do not report runtime at all', 'The known values are still useful, when labelled.'),
        ],
        correct: 'b',
        explanation: 'Report n and the unknowns.',
      },
      {
        id: 'l08-a3',
        kind: 'numeric',
        concept: 'experiment-design',
        prompt: 'In the synthetic demo, what is condition B\'s mean tests-passed ratio? (Two decimals; ±0.01.)',
        answer: () => Math.round(meanB * 100) / 100,
        tolerance: 0.01,
        explanation: 'B: 10/10, 10/10, 9/10 → mean 0.97 over 3 known runs.',
      },
      {
        id: 'l08-a4',
        kind: 'multi',
        concept: 'experiment-design',
        prompt: 'Which practices make an experiment controlled? Select all.',
        options: [
          o('a', 'Writing the hypothesis and success criteria before the runs', 'Prevents moving goalposts.'),
          o('b', 'Recording the fixture version and hash', 'Shows the inputs were identical.'),
          o('c', 'Reporting only the best run of each condition', 'Cherry-picking.'),
          o('d', 'Changing exactly one thing between conditions', 'The core of a controlled comparison.'),
          o('e', 'Running each condition several times', 'Reveals variance.'),
        ],
        correct: ['a', 'b', 'd', 'e'],
        explanation: 'Control, repeat, disclose.',
      },
      {
        id: 'l08-a5',
        kind: 'order',
        concept: 'experiment-design',
        prompt: 'Order the experiment workflow.',
        steps: [
          { id: 'e1', text: 'Write the hypothesis and success criteria' },
          { id: 'e2', text: 'Fix the fixture (version + hash), prompt and rubric' },
          { id: 'e3', text: 'Run each condition several times and record evidence, including what is missing' },
          { id: 'e4', text: 'Compare ranges and sample sizes' },
          { id: 'e5', text: 'Write observations (what happened), then a conclusion and limitations' },
        ],
        explanation: 'Plan → control → record → compare → interpret.',
      },
      {
        id: 'l08-a6',
        kind: 'single',
        concept: 'experiment-design',
        critical: true,
        points: 2,
        prompt: 'The AI Lab shows "tests passed 9/10" for a run. Where did that number come from?',
        options: [
          o('a', 'Claude Forge ran the tests and measured it', 'Forge never runs Claude or your tests.'),
          o('b', 'You typed it (self-reported) or imported it from a report file you uploaded - Forge does not verify either', 'Correct.'),
          o('c', 'Claude reported it automatically', 'Forge has no connection to Claude.'),
          o('d', 'It is estimated from the other runs', 'Forge never estimates.'),
        ],
        correct: 'b',
        explanation: 'Provenance is shown next to every value for this reason.',
      },
    ],
  },
  failureModes: [
    'Reading one run as a result.',
    'Comparing different prompts or fixtures and attributing the difference to the Skill.',
    'Silently averaging missing values as zero.',
    'Writing the conclusion first and the hypothesis afterwards.',
  ],
  application: {
    title: 'Run the Skill you built',
    body: 'Take your Lesson 5 Skill and compare it with no Skill on the merge-cascade fixture pack, three runs each, in your own Claude Code. Record tests passed and your effort, and write the limitations honestly.',
    fieldPrompt: 'Log it under Growth → Field evidence once you have run a real experiment and acted on the result (kept, revised or rejected the Skill).',
  },
  reviewItems: [
    {
      id: 'l08-r1',
      kind: 'single',
      concept: 'experiment-design',
      critical: true,
      prompt: 'Two conditions\' result ranges overlap. What should the report say?',
      options: [o('a', 'The difference may be run-to-run noise', 'Correct.'), o('b', 'The higher mean wins', 'Ignores overlap.'), o('c', 'Both are identical', 'Not shown either.'), o('d', 'The data is invalid', 'Overlap is normal.')],
      correct: 'a',
      explanation: 'Overlap is the cue for caution.',
    },
    {
      id: 'l08-r2',
      kind: 'multi',
      concept: 'experiment-design',
      prompt: 'Select the measures that are objective rather than judged.',
      options: [o('a', 'Tests passed / total', 'Directly counted, so objective.'), o('b', 'Rubric score for maintainability', 'Subjective, self-assessed.'), o('c', 'Seeded issues found from a fixed checklist', 'Counted against a fixed list.'), o('d', 'Your gut feeling', 'A feeling is a judgement, not a measurement.')],
      correct: ['a', 'c'],
      explanation: 'Keep objective and subjective measures separate.',
    },
    {
      id: 'l08-r3',
      kind: 'single',
      concept: 'experiment-design',
      prompt: 'Why lock the rubric before recording runs?',
      options: [o('a', 'So criteria cannot be adjusted after seeing results', 'Correct.'), o('b', 'To save storage', 'Storage is not the reason.'), o('c', 'Because browsers require it', 'Browsers do not require it; it is an experimental discipline.'), o('d', 'To make scores higher', 'Locking the rubric prevents changes; it does not alter scores.')],
      correct: 'a',
      explanation: 'Pre-commitment protects against motivated reasoning.',
    },
  ],
  sources: [{ ...DOCS.skills, supports: 'skill-creator benchmark/blind A/B modes; claude plugin eval; skillOverrides baseline comparisons.' }],
};

import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS } from './helpers';
import { DEMO_EXPERIMENT } from '@/domain/experiments/demo';
import { compareExperiment } from '@/domain/experiments/compare';

const demoCmp = compareExperiment(DEMO_EXPERIMENT);
const testsRow = demoCmp.rows.find((r) => r.id === 'testsPassedRatio')!;
const meanB = testsRow.perCondition.find((c) => c.conditionId === 'demo-b')!.stat.mean ?? 0;

export const L08: Lesson = {
  id: 'L08-battle-lab',
  version: 2,
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
          o('a', 'As 0 seconds, so that the run is still counted in the mean and the report covers all runs', 'This invents a value and biases the mean.', 'unknown-is-zero'),
          o('b', 'As the average of the other runs, which keeps the mean unchanged and the sample complete', 'This also invents data.'),
          o('c', 'As unknown: excluded from the mean and counted as missing', 'Correct: forge never silently converts unknown to zero.'),
          o('d', 'Delete the whole run from the experiment', 'The run still has other valid evidence.'),
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
          o('c', 'A used the fixture v1 and B used a slightly edited copy', 'Correct: controlled means one stated difference and everything else fixed.'),
          o('d', 'A has 5 runs and B has 2', 'Unequal evidence; B\'s range is much less certain.'),
          o('e', 'The rubric was rewritten after seeing the results', 'Correct: controlled means one stated difference and everything else fixed.'),
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
          o('a', 'The Skill works, because the run with it passed and the run without it did not', 'One run per condition cannot separate the Skill from luck; this is a lead, not a result.', 'one-run-proof'),
          o('b', 'It is an anecdote: record it, but run more before claiming anything', 'Correct: record it as an anecdote and run more, since two runs cannot support a claim.'),
          o('c', 'The Skill is 100% effective, because it passed every test in the run where it was used', 'One passing run is 100% of one run. It says nothing about the next run.'),
          o('d', 'The baseline is broken, since a correct setup would not have failed the tests so completely', 'A single failure is expected sometimes; it is no sign the baseline is wrong.'),
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
          o('a', 'Mean 100 s, counting the run that was not timed as 0 seconds', 'Counting the missing run as 0 drags the mean down and makes the condition look faster than it was.'),
          o('b', 'Mean 150 s over the 2 timed runs, with 1 run marked unknown', 'Correct: report the mean of the timed runs and say plainly that one run is unknown.'),
          o('c', 'Mean 150 s over two runs, and say nothing about the run with no timing', 'The number is right but hiding the gap hides that the sample is smaller than it looks.'),
          o('d', 'Do not report runtime at all, since one of the three values is missing', 'The two known values are still useful when they are labelled as such.'),
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
          o('c', 'Reporting only the best run of each condition', 'Reporting only the best run of each condition is cherry-picking and defeats the purpose of a controlled experiment.'),
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
          o('a', 'Claude Forge ran the tests itself and measured the result, so the number is a verified measurement', 'Forge never runs your tests; it only stores what you tell it.'),
          o('b', 'You typed it (self-reported) or imported it from a report file you uploaded - Forge does not verify either', 'Correct: the figure is self-reported or imported from a file you supplied, and Forge verifies neither.'),
          o('c', 'Claude reported it automatically to Forge when the run finished, so it came from the model', 'Forge has no connection to Claude; nothing is sent to it automatically.'),
          o('d', 'It is estimated by Forge from the other runs in the same condition, then rounded to a whole number', 'Forge does not estimate missing values. Unknown stays unknown.'),
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
      options: [o('a', 'The difference may be run-to-run noise', 'Correct: overlap is the cue for caution.'), o('b', 'The condition with the higher mean wins', 'The higher mean ignores that the ranges overlap, so the difference may be noise.'), o('c', 'Both conditions are identical', 'Overlap does not show the conditions are identical either; it shows that no difference has been demonstrated.'), o('d', 'The data is invalid, because overlapping ranges mean that the runs were not recorded consistently', 'Overlap is normal with few runs and does not mean the data was recorded inconsistently.')],
      correct: 'a',
      explanation: 'Overlap is the cue for caution.',
    },
    {
      id: 'l08-r2',
      kind: 'multi',
      concept: 'experiment-design',
      prompt: 'Select the measures that are objective rather than judged.',
      options: [o('a', 'Tests passed / total', 'Directly counted, so objective.'), o('b', 'Rubric score for maintainability', 'A maintainability rubric score is a judgement you make, so it is subjective and self-assessed.'), o('c', 'Seeded issues found from a fixed checklist', 'Counted against a fixed list.'), o('d', 'Your gut feeling', 'A feeling is a judgement, not a measurement.')],
      correct: ['a', 'c'],
      explanation: 'Keep objective and subjective measures separate.',
    },
    {
      id: 'l08-r3',
      kind: 'single',
      concept: 'experiment-design',
      prompt: 'Why lock the rubric before recording runs?',
      options: [o('a', 'So criteria cannot be adjusted after seeing results', 'Correct: pre-commitment protects against motivated reasoning.'), o('b', 'To save storage, because a locked rubric is stored once and not rewritten for each run recorded', 'Storage is not the reason.'), o('c', 'Because browsers require a stored object to be frozen before more records can be added to it', 'Browsers do not require it; it is an experimental discipline.'), o('d', 'To make the scores higher, since a rubric that is fixed in advance is easier for runs to satisfy', 'Locking the rubric prevents changes; it does not alter scores.')],
      correct: 'a',
      explanation: 'Pre-commitment protects against motivated reasoning.',
    },
  ],
  sources: [{ ...DOCS.skills, supports: 'skill-creator benchmark/blind A/B modes; claude plugin eval; skillOverrides baseline comparisons.' }],
};

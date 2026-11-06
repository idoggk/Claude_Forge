import type { Lesson } from '@/domain/curriculum/types';
import { o, ARTICLES } from './helpers';

const EVIDENCE = [
  { id: 'anecdote', label: 'Anecdote' },
  { id: 'directional', label: 'Directional evidence' },
  { id: 'claim', label: 'Unsupported claim' },
];

/** A fabricated experiment report. Every number and name is invented. */
const REPORT = [
  'Experiment: Does prompt B improve code reviews?',
  'Runs: prompt A ran once; prompt B ran once.',
  'Result: B found 4 of 6 seeded bugs, A found 3 of 6.',
  'Tokens: B used about 2,000 fewer tokens (estimated).',
  'Cases: we kept editing prompt B until it found all four bugs in the test file.',
  'Conclusion: prompt B is 33% better and should be the default.',
  'Limitations: none noted.',
];
const REPORT_TARGETS = [
  { line: 2, severity: 'major' as const, why: 'One run per condition is a single observation each; LLM output varies from run to run.' },
  { line: 4, severity: 'major' as const, why: 'An estimated token count is not a measurement. Record a figure from a real usage report or leave it unknown.' },
  { line: 5, severity: 'critical' as const, why: 'Prompt B was tuned on the very cases it was then scored on, so the result shows fit, not generalisation. Use cases the prompt was never shaped on.' },
  { line: 6, severity: 'critical' as const, why: '"33% better" is a conclusion the data cannot support: one run each, tuned cases, an estimated measure. It is an anecdote presented as a finding.' },
  { line: 7, severity: 'minor' as const, why: 'Every experiment has limitations; "none" means they have not been looked for.' },
];

export const L16: Lesson = {
  id: 'L16-ai-evaluation',
  version: 2,
  track: 'safety-eval',
  alsoIn: ['research'],
  order: 16,
  title: 'AI Evaluation Fundamentals',
  subtitle: 'Baselines, controls, variance and evidence quality - how to tell whether a prompt, Skill, tool or model is actually better',
  prerequisites: ['L11-choose-ai-approach'],
  competencies: ['experiment-design'],
  effortMinutes: 35,
  gameRelevance: 1,
  interestTags: ['experiments', 'ai-judgment', 'foundations'],
  problem: 'A colleague changes one line in the team\'s review prompt, runs it once, sees a better answer and announces "prompt B is 33% better - make it the default". Nobody records what the old prompt did, on which files, or how many times.',
  whyItMatters: 'AI output varies from run to run, impressive demos are easy to produce, and every vendor has a benchmark. Without a fair comparison you cannot know whether a change helped, hurt or did nothing - and you will keep adopting and abandoning things on feeling.',
  objectives: [
    'Design a fair comparison: a question, a baseline, one stated difference, the same cases, and measures chosen in advance.',
    'Explain why repeated runs matter, and read overlapping results as "no evidence of a difference".',
    'Keep unknowns unknown and keep tuning cases separate from held-out cases.',
    'Grade the strength of evidence: anecdote, directional evidence or unsupported claim.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Output varies, so one run is not a result',
      prediction: {
        prompt: 'Prompt A passed 8 of 10 runs. Prompt B passed 9 of 10 runs on the same cases. How much does that tell you?',
        options: [
          o('a', 'Very little: with so few runs a one-run difference is easily noise; treat the ranges as overlapping and gather more', 'Small samples cannot separate a real difference from variation.'),
          o('b', 'B is better: it won', 'A one-run gap in ten could be chance.', 'one-run-proof'),
          o('c', 'B is 12.5% better', 'A precise-looking figure does not make a noisy difference real.', 'one-run-proof'),
        ],
        correct: 'a',
      },
      body: `Language models do not return the same output every time, and tasks differ in difficulty. So "it worked when I tried it" is an **anecdote**. Anthropic's guide to evaluating agents describes running multiple **trials** of a task because of this non-determinism, then looking at how results are distributed rather than at one lucky or unlucky run.

An evaluation has a few moving parts you should be able to name:
- a **task** - a defined input with a way to judge the result,
- a **grader** - code that checks the outcome, a model that judges it, or a human,
- a **trial** - one run of one task,
- the **outcome** - what actually changed or was produced, which may differ from what the model *said* it did.`,
    },
    {
      id: 's2',
      title: 'A fair comparison',
      body: `A comparison is fair when **exactly one thing differs** and everything else is held still.

1. **Question and hypothesis** - written *before* the runs. "Adding line X makes reviews find more of the seeded defects."
2. **Baseline** - the same task *without* the change. Without it you cannot attribute any difference to the change.
3. **One stated difference** - one line, one Skill, one model. If two things change you cannot say which mattered.
4. **Same cases** - identical files, environment and prompt otherwise.
5. **Measures chosen in advance** - and a rubric locked before you look at results. Changing criteria after seeing the data makes the comparison worthless.
6. **Repeat** - several runs per condition.

Use a code-based grader where an answer can be checked mechanically (tests pass, defect found: yes/no). Use human judgment, clearly labelled as subjective, where it cannot.`,
    },
    {
      id: 's3',
      title: 'Reading results honestly',
      body: `- **Show the range, not just the average.** If the ranges for two conditions overlap, the difference could be run-to-run noise.
- **Unknown is unknown.** A value you did not measure is not zero and is not the average of the others. Count it as missing.
- **Never estimate a measurement you could have recorded.** Read token counts from a real usage report or leave them blank.
- **Do not grade on what you tuned on.** If you improved the prompt after studying four failing cases, those four cases now show *fit*. Evidence of improvement needs **held-out** cases you never looked at.
- **State the limits.** One fixture, one model, self-scored results: say what this cannot show.

Forge's AI Lab is built around exactly these rules: no winner score, ranges shown, unknowns never zeroed.`,
    },
    {
      id: 's4',
      title: 'Where claims come from',
      body: `Not every number deserves the same trust:

| Source | What it can tell you | Watch for |
|---|---|---|
| **Vendor claim** ("10x faster") | A hypothesis worth testing | No method, no baseline, a favourable task |
| **Public benchmark** | How a model did on that benchmark | May not resemble your work; may be tuned for |
| **Independent evaluation** | A method someone else can inspect | Different task, different setup |
| **Your own experiment** | Whether it helps *your* task | Small samples; your own biases |

None of these is proof. A vendor number is a reason to run your own small experiment; your small experiment is a reason to repeat it before you rely on it.`,
    },
    {
      id: 's5',
      title: 'Worked example: testing the "think step by step" claim',
      body: `*Claim: adding "think step by step" to the review prompt finds more bugs.*

- **Hypothesis (written first):** the line increases the share of seeded defects found.
- **Baseline:** the same review prompt without the line.
- **Fixed:** six files with a known list of seeded defects, same model, same instructions otherwise.
- **Measure:** seeded defects found out of the checklist (a mechanical yes/no per defect) - chosen in advance.
- **Runs:** five per condition, in the same environment.
- **Record:** every run, including the ones with missing data, shown as unknown.
- **Held out:** a second set of files the prompt was never edited against.
- **Report:** ranges per condition, whether they overlap, and the limitations (one task type, one model).

If the ranges overlap, the honest conclusion is "no evidence of a difference in these runs" - which is a perfectly good result.`,
    },
  ],
  activity: {
    title: 'Read results and judge evidence',
    intro: 'Guided practice with invented numbers. The skill is in the reading, not the arithmetic.',
    items: [
      {
        id: 'l16-p1',
        kind: 'numeric',
        concept: 'experiment-design',
        prompt: 'Prompt A passed 6 of 10 runs; prompt B passed 8 of 10. How many percentage points higher is B\'s pass rate?',
        answer: 20,
        tolerance: 0,
        unit: 'percentage points',
        hints: ['Convert each to a percentage first.'],
        explanation: 'The gap is 20 points - but with ten runs per condition, the ranges still need checking before you read anything into it.',
      },
      {
        id: 'l16-p2',
        kind: 'classify',
        concept: 'experiment-design',
        prompt: 'How strong is each piece of evidence?',
        categories: EVIDENCE,
        entries: [
          { id: 'e1', text: 'One run each: the new prompt passed and the old one failed', correct: 'anecdote', why: 'One observation per condition.' },
          { id: 'e2', text: 'Five runs per condition on six fixed cases, with a baseline; the ranges do not overlap', correct: 'directional', why: 'A fair design and repeated runs - still limited to this task.' },
          { id: 'e3', text: 'A README says "10x faster than alternatives" and gives no method', correct: 'claim', why: 'No method, no baseline: nothing to check.' },
          { id: 'e4', text: 'A teammate says the new prompt "feels sharper"', correct: 'anecdote', why: 'An impression, not a measurement.' },
        ],
        explanation: 'Directional is the ceiling for small self-run experiments.',
      },
      {
        id: 'l16-p3',
        kind: 'order',
        concept: 'experiment-design',
        prompt: 'Put the steps of a fair comparison in order.',
        steps: [
          { id: 'o1', text: 'Write the question and a hypothesis', why: 'Before you see any result.' },
          { id: 'o2', text: 'Choose the baseline and state the one difference', why: 'So you can attribute the effect.' },
          { id: 'o3', text: 'Fix the cases and choose the measures and rubric', why: 'Lock them before recording.' },
          { id: 'o4', text: 'Run several times per condition and record everything, including missing values', why: 'Variation and unknowns are data.' },
          { id: 'o5', text: 'Compare ranges, not just averages, and test on held-out cases', why: 'Guard against noise and tuning.' },
          { id: 'o6', text: 'Write the conclusion and the limitations', why: 'Say what this cannot show.' },
        ],
        explanation: 'Hypothesis, baseline, locked cases, repeats, honest reading, limits.',
      },
      {
        id: 'l16-p4',
        kind: 'multi',
        concept: 'experiment-design',
        prompt: 'Which of these make a comparison unfair? Select all.',
        options: [
          o('a', 'Condition B was tested on different files than condition A', 'The cases must be identical.'),
          o('b', 'Two things changed at once: a new prompt line and a different model', 'You cannot say which mattered.'),
          o('c', 'The rubric was edited after seeing the results', 'Criteria must be locked first.'),
          o('d', 'Both conditions used the same files and environment', 'That is what a fair test needs.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Identical cases, one difference, locked criteria.',
      },
    ],
  },
  assessment: {
    title: 'Evaluate honestly',
    intro: 'A new claim, new numbers and a new report, no hints. The small-sample, unknown-value and held-out questions are mandatory checks. The last item checks a real experiment saved in the AI Lab.',
    passMark: 0.8,
    items: [
      {
        id: 'l16-a1',
        kind: 'fields',
        concept: 'experiment-design',
        points: 3,
        prompt: 'Design a fair test for this claim. Answer each part concretely.',
        brief: `**Claim:** "If I add a CLAUDE.md that lists our naming conventions, Claude's code changes will need fewer review comments."`,
        fields: [
          {
            id: 'baseline',
            label: 'Baseline and the one difference',
            help: 'What do you compare against, and what is the single thing that changes?',
            groups: [
              { label: 'a no-change baseline', anyOf: ['without', 'no claude.md', 'baseline', 'control', 'same task with no', 'before adding'] },
              { label: 'one stated difference', anyOf: ['only difference', 'one difference', 'the claude.md', 'the file', 'single change', 'only thing', 'one thing'] },
            ],
            placeholder: 'e.g. baseline is ... ; the only difference is ...',
          },
          {
            id: 'fixed',
            label: 'What you hold the same',
            help: 'So the cases are comparable.',
            groups: [
              { label: 'the same tasks or files', anyOf: ['same task', 'same tasks', 'same files', 'same repo', 'identical', 'same fixture', 'same cases', 'same prompts'] },
              { label: 'the same model or environment', anyOf: ['same model', 'same version', 'same settings', 'same environment', 'same setup', 'same tool'] },
            ],
            placeholder: 'e.g. the same five tasks and ...',
          },
          {
            id: 'repeat',
            label: 'How many runs, and what you do with them',
            help: 'One run is not a result.',
            groups: [
              { label: 'several runs per condition', anyOf: ['several runs', 'multiple runs', 'repeat', 'five runs', '5 runs', 'three runs', '3 runs', 'each condition', 'per condition', 'times each', 'ten runs', '10 runs'] },
              { label: 'compare ranges or spread', anyOf: ['range', 'ranges', 'overlap', 'spread', 'variance', 'variation', 'noise'] },
            ],
            placeholder: 'e.g. run each condition ... and compare ...',
          },
          {
            id: 'measure',
            label: 'A measure chosen in advance',
            help: 'Something countable, decided before the runs.',
            groups: [
              { label: 'a countable measure', anyOf: ['count', 'number of', 'comments', 'checklist', 'rate', 'ratio', 'percentage', 'tests', 'defects', 'violations'] },
              { label: 'decided before running', anyOf: ['in advance', 'beforehand', 'before the runs', 'before running', 'before i start', 'locked', 'ahead of time', 'decide first', 'pre-register'] },
            ],
            placeholder: 'e.g. count naming-convention comments, decided ...',
          },
          {
            id: 'limits',
            label: 'What the result could not show',
            help: 'Name a limitation.',
            groups: [
              { label: 'a named limit', anyOf: ['only one', 'one repo', 'one project', 'one model', 'small sample', 'few runs', 'may not generalise', 'may not generalize', 'self-scored', 'subjective', 'cannot show', 'does not show', 'limited to'] },
            ],
            placeholder: 'e.g. this only covers ...',
          },
        ],
        explanation: 'A baseline, one difference, the same cases, repeated runs compared by range, a measure fixed in advance, and a stated limit.',
      },
      {
        id: 'l16-a2',
        kind: 'flaglines',
        concept: 'experiment-design',
        filename: 'prompt-experiment-report.txt',
        lines: REPORT,
        prompt: 'Flag the lines where this report claims more than its evidence supports. Some lines are fine.',
        targets: REPORT_TARGETS,
        explanation: 'One run each, an estimated measure, tuning on the test cases and an unsupported percentage conclusion are the problems.',
      },
      {
        id: 'l16-a3',
        kind: 'single',
        concept: 'experiment-design',
        critical: true,
        points: 2,
        prompt: 'Prompt A passed 18 of 20 runs; prompt B passed 19 of 20. Someone proposes making B the default because "it is better". What is the sound response?',
        options: [
          o('a', 'A one-run gap in twenty is within what noise can produce; say there is no evidence of a difference yet and gather more runs or more varied cases', 'Correct: overlapping results are not evidence.'),
          o('b', 'Make B the default: it won', 'A small gap can be chance.', 'one-run-proof'),
          o('c', 'B is 5% better, so adopt it', 'A precise-looking figure does not make the difference real.', 'one-run-proof'),
          o('d', 'A is broken because it failed twice', 'Two failures in twenty is normal variation.', 'one-run-proof'),
        ],
        correct: 'a',
        explanation: 'Do not read signal into small gaps.',
      },
      {
        id: 'l16-a4',
        kind: 'single',
        concept: 'experiment-design',
        critical: true,
        points: 2,
        prompt: 'You improved a prompt after studying the four cases it failed. It now passes all four. What is the strongest next step?',
        options: [
          o('a', 'Test it on new cases you never looked at, scored against answers you had not seen', 'Correct: that tests generalisation.'),
          o('b', 'Re-run the same four cases five more times', 'More runs on tuned cases still show fit, not generalisation.', 'tuned-set-proves-it'),
          o('c', 'Declare it improved: it passes everything', 'It passes what you tuned it on.', 'tuned-set-proves-it'),
          o('d', 'Add those four answers into the prompt', 'That memorises the cases.', 'tuned-set-proves-it'),
        ],
        correct: 'a',
        explanation: 'Held-out beats tuned.',
      },
      {
        id: 'l16-a5',
        kind: 'single',
        concept: 'experiment-design',
        prompt: 'You did not record the runtime for two of six runs. How should the report treat those values?',
        options: [
          o('a', 'As unknown: left out of the average and counted as missing', 'Correct: never invent a value.'),
          o('b', 'As zero seconds', 'It drags the average down with a number you made up.', 'unknown-is-zero'),
          o('c', 'As the mean of the other four', 'That also invents data.', 'unknown-is-zero'),
          o('d', 'Delete the two runs', 'They still carry other valid measurements.'),
        ],
        correct: 'a',
        explanation: 'Unknown stays unknown.',
      },
      {
        id: 'l16-a6',
        kind: 'classify',
        concept: 'experiment-design',
        prompt: 'How strong is each piece of evidence?',
        categories: EVIDENCE,
        entries: [
          { id: 'b1', text: 'A tool\'s website says "reduces bugs by 70%" with no method or link', correct: 'claim', why: 'Nothing to inspect.' },
          { id: 'b2', text: 'You ran the old and new prompt once each and the new one looked better', correct: 'anecdote', why: 'One observation per condition.' },
          { id: 'b3', text: 'Ten runs per condition on the same eight cases, baseline included, ranges separate', correct: 'directional', why: 'Fair design and repetition; limited to this task.' },
          { id: 'b4', text: 'A colleague is sure the new setup is faster', correct: 'anecdote', why: 'Conviction is not measurement.' },
        ],
        explanation: 'Grade evidence by its method.',
      },
      {
        id: 'l16-a7',
        kind: 'external',
        concept: 'experiment-design',
        check: 'lab-repeated-runs',
        points: 3,
        prompt: 'Record a real experiment in the AI Lab: a hypothesis, a baseline, at least two runs per condition with a real measurement each, and limitations written down. The checklist verifies what you saved. Do not enter invented numbers.',
        explanation: 'Run it by hand, record honestly, and leave unknowns unknown.',
      },
      {
        id: 'l16-a8',
        kind: 'reflect',
        concept: 'experiment-design',
        prompt: 'Self-assessment (recorded, not scored).',
        rubric: [
          'I can name the baseline and the one difference in a comparison',
          'I treat overlapping ranges as "no evidence of a difference"',
          'I separate cases I tuned on from cases I tested on, and I leave unknowns unknown',
        ],
        explanation: 'Honest evaluation is a habit.',
      },
    ],
  },
  failureModes: [
    'Announcing a winner from one run each.',
    'No baseline, so any improvement is unattributable.',
    'Changing two things at once.',
    'Scoring on the cases you tuned against.',
    'Estimating or zeroing a measurement you did not record.',
    'Reading a vendor benchmark as proof for your task.',
  ],
  application: {
    title: 'Test one belief you hold',
    body: 'Choose one belief about your AI setup ("this prompt line helps", "this Skill saves time"). Write the hypothesis, baseline and measure first. Run each condition at least three times on the same case, record every run - including what you did not measure - and write down the limitations. Practical takeaway: if the ranges overlap, write "no evidence of a difference" and keep the result.',
    fieldPrompt: 'Log it under Growth → Field evidence when an experiment changes (or confirms) a decision you would otherwise have made on a hunch.',
  },
  reviewItems: [
    { id: 'l16-r1', kind: 'single', concept: 'experiment-design', difficulty: 1, prompt: 'Why run a comparison several times per condition?', options: [o('a', 'Model output varies, so one run cannot show a difference from noise', 'Correct: it matches the practice taught in this lesson.'), o('b', 'To make the report longer', 'Not the reason.'), o('c', 'Because the first run is always wrong', 'The first run is not special; variation affects every run.')], correct: 'a', explanation: 'Output varies from run to run, so repeat each condition.' },
    { id: 'l16-r2', kind: 'single', concept: 'experiment-design', difficulty: 1, prompt: 'What does a baseline let you do?', options: [o('a', 'Attribute a difference to the change', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Skip repeated runs', 'A baseline does not replace repeated runs.'), o('c', 'Avoid writing a hypothesis', 'You still write the hypothesis before the runs.')], correct: 'a', explanation: 'Without a baseline nothing is attributable.' },
    { id: 'l16-r3', kind: 'single', concept: 'experiment-design', difficulty: 2, prompt: 'Two conditions\' ranges overlap. What is the sound reading?', options: [o('a', 'The difference could be run-to-run noise; no evidence of a difference yet', 'Correct: it matches the practice taught in this lesson.'), o('b', 'The higher mean wins', 'Means hide the spread.', 'one-run-proof'), o('c', 'The experiment failed', 'A null result is a result.')], correct: 'a', explanation: 'Overlap is not evidence.' },
    { id: 'l16-r4', kind: 'multi', concept: 'experiment-design', difficulty: 2, prompt: 'Select the things to fix before the runs begin.', options: [o('a', 'The cases or files', 'Correct: it matches the practice taught in this lesson.'), o('b', 'The measures and rubric', 'Correct: it matches the practice taught in this lesson.'), o('c', 'The hypothesis', 'Correct: it matches the practice taught in this lesson.'), o('d', 'The conclusion', 'You do not know it yet.')], correct: ['a', 'b', 'c'], explanation: 'Lock inputs and criteria first.' },
    { id: 'l16-r5', kind: 'single', concept: 'experiment-design', difficulty: 2, prompt: 'A missing measurement should appear in the report as:', options: [o('a', 'Unknown, excluded from the mean and counted as missing', 'Correct: it matches the practice taught in this lesson.'), o('b', '0', 'Invents a value.', 'unknown-is-zero'), o('c', 'The average of the others', 'Invents a value.', 'unknown-is-zero')], correct: 'a', explanation: 'Never silently zero.' },
    { id: 'l16-r6', kind: 'single', concept: 'experiment-design', difficulty: 3, prompt: 'Which evidence is strongest that a revised prompt generalises?', options: [o('a', 'Better results on new cases it was never tuned on, scored against hidden answers', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Better results on the cases it was tuned on', 'Fit, not generalisation.', 'tuned-set-proves-it'), o('c', 'The author is confident', 'Confidence is not evidence.', 'confidence-is-evidence')], correct: 'a', explanation: 'Held-out cases.' },
    { id: 'l16-r7', kind: 'single', concept: 'experiment-design', difficulty: 3, prompt: 'A vendor reports a large improvement from their own benchmark with a published method. How do you treat it?', options: [o('a', 'As a hypothesis worth testing on your own task, not as proof it helps you', 'Correct: it matches the practice taught in this lesson.'), o('b', 'As proof, because a method was published', 'It may not resemble your work.', 'vendor-claim-is-evidence'), o('c', 'As worthless', 'A method is something you can inspect and replicate.')], correct: 'a', explanation: 'Test it yourself.' },
    { id: 'l16-r8', kind: 'single', concept: 'experiment-design', difficulty: 3, prompt: 'Which is the best grader for "the generated function passes the unit tests"?', options: [o('a', 'A code-based grader that runs the tests', 'Correct: mechanical, repeatable and independent.'), o('b', 'Asking the model whether it passes', 'The author vouching for itself.', 'self-review-independent'), o('c', 'A human skimming the code', 'Slower and less reliable than running the tests.')], correct: 'a', explanation: 'Use code graders where an answer can be checked.' },
  ],
  sources: [
    { ...ARTICLES.evals, supports: 'Evaluation vocabulary (tasks, trials, graders, outcomes) and why multiple trials matter given non-determinism.' },
    { ...ARTICLES.multiAgent, supports: 'Evaluating early with small realistic case sets and keeping human review alongside automated grading.' },
    { ...ARTICLES.buildingAgents, supports: 'Starting simple and measuring whether added complexity improves results.' },
  ],
};

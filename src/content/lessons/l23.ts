import type { Lesson } from '@/domain/curriculum/types';
import { o, ARTICLES, DOCS } from './helpers';

const THREATS = [
  { id: 'leakage', label: 'Leakage between prompt and test' },
  { id: 'tuning', label: 'Tuning on the test cases' },
  { id: 'grader', label: 'Grader bias or self-grading' },
  { id: 'sample', label: 'Too few runs or cases' },
  { id: 'unequal', label: 'Unequal conditions' },
];

/** A fabricated comparison plan with several invalidating flaws. All content is invented. */
const PLAN = [
  'Goal: show that Workflow B beats Workflow A at fixing bugs.',
  'Tasks for A: six bugs picked at random from the backlog.',
  'Tasks for B: the six bugs Workflow B was designed around.',
  'Grader: the same model that wrote each fix says whether it is correct.',
  'Runs: one per task.',
  'Workflow B\'s prompt was edited until all six of its tasks passed.',
  'Failed runs were dropped from the table; only successes are shown.',
  'Result: B 6 of 6, A 3 of 6, so B is twice as good.',
];
const PLAN_TARGETS = [
  { line: 3, severity: 'critical' as const, why: 'The two conditions get different tasks, and B\'s tasks are the ones it was built for. Any difference could come from the tasks, not the workflow.' },
  { line: 4, severity: 'major' as const, why: 'The author grades its own work. Prefer a deterministic grader (the repository\'s tests) and audit any model grader against human judgement.' },
  { line: 5, severity: 'major' as const, why: 'One run per task cannot separate a real effect from run-to-run variation.' },
  { line: 6, severity: 'critical' as const, why: 'B was tuned until it passed these exact tasks, so its score measures fit, not generalisation. Use withheld cases.' },
  { line: 7, severity: 'critical' as const, why: 'Dropping failed runs is survivorship bias: the table can only look good. Keep and report every attempt.' },
  { line: 8, severity: 'major' as const, why: '"Twice as good" is an unsupported conclusion from an invalid comparison; 6 of 6 versus 3 of 6 describes six hand-picked cases, not the workflows.' },
];

const REPORT_2 = [
  'Experiment: does adding a CLAUDE.md reduce review comments?',
  'Condition A (no CLAUDE.md): run on Monday with the older model version.',
  'Condition B (with CLAUDE.md): run on Friday, after a model update.',
  'Both conditions: three tasks, one run each.',
  'Measure: review comments counted by the person who wrote the CLAUDE.md, who knew which run was which.',
  'Tasks T1 and T2 are also quoted in the CLAUDE.md as examples.',
  'Result: B had fewer comments (4 versus 9), so the CLAUDE.md works.',
];
const REPORT_2_TARGETS = [
  { line: 3, severity: 'critical' as const, why: 'The model version changed between the conditions, so CLAUDE.md is not the only difference. Hold everything else fixed.' },
  { line: 4, severity: 'major' as const, why: 'Three tasks and one run each is too little to separate an effect from variation.' },
  { line: 5, severity: 'major' as const, why: 'The person with a stake in the result counted unblinded. Use a deterministic count or blind the review.' },
  { line: 6, severity: 'critical' as const, why: 'Two of the three tasks appear in the instructions being tested: leakage, so those tasks cannot show generalisation.' },
  { line: 7, severity: 'critical' as const, why: 'The conclusion cannot be drawn from a confounded, leaked, unblinded comparison with three single runs.' },
];

export const L23: Lesson = {
  id: 'L23-evaluation-harnesses',
  version: 1,
  track: 'safety-eval',
  alsoIn: ['advanced', 'engineering'],
  order: 23,
  title: 'Designing AI Evaluation Harnesses',
  subtitle: 'Datasets, graders, held-out data and regression tests - and how to spot an invalid comparison',
  prerequisites: ['L16-ai-evaluation'],
  competencies: ['eval-harness-design'],
  effortMinutes: 45,
  gameRelevance: 1,
  interestTags: ['experiments', 'ai-judgment', 'automation'],
  problem: 'A team announces that their new coding workflow "is twice as good". The evidence: six hand-picked bugs the workflow was built around, one run each, graded by the model that wrote the fixes, with the failed runs left out of the table.',
  whyItMatters: 'Once AI work is part of your engineering, you will change prompts, Skills, tools and models constantly. A small, honest evaluation harness turns "it feels better" into evidence you can re-run, and catches regressions you would otherwise ship.',
  objectives: [
    'Name the parts of an evaluation harness: cases, graders, conditions, trials, held-out data and a record of provenance.',
    'Choose graders: deterministic first, rubric and human review where needed, model graders only after auditing them.',
    'Detect invalid comparisons: leakage, tuning on the test set, unequal conditions, self-grading, survivorship and tiny samples.',
    'Plan a small, honest evaluation of an AI coding workflow and run it in the AI Lab.',
    'Use the same harness as a regression test when something changes.',
  ],
  segments: [
    {
      id: 's1',
      title: 'What makes a comparison valid',
      prediction: {
        prompt: 'Workflow B, tested on the six bugs it was designed around, fixes all six. Workflow A, tested on six random backlog bugs, fixes three. What can you conclude about which workflow is better?',
        options: [
          o('a', 'Almost nothing: the conditions got different tasks, and B was built around its own, so the comparison is invalid', 'Fairness needs the same cases, and B\'s tasks are not independent of B.'),
          o('b', 'B is better: 6 of 6 beats 3 of 6', 'The numbers compare different tasks, one of which B was designed around.', 'one-run-proof'),
          o('c', 'B is probably twice as good', 'A ratio of two non-comparable scores is not an effect size.', 'one-run-proof'),
        ],
        correct: 'a',
      },
      body: `You met the basics in the evaluation fundamentals lesson: a baseline, one stated difference, the same cases, repeated runs and honest reporting. A **harness** is those ideas made repeatable, so you can run them again next month on a new prompt, Skill or model.

Anthropic's guidance on evaluations says to design evals that mirror your real task distribution (including edge cases), to automate grading where possible, and its engineering article on agent evals describes the building blocks this lesson uses: **tasks** (a defined input with a way to judge the result), **trials** (runs of a task, repeated because outputs vary), **graders** (code, a model or a person) and **outcomes** (what actually changed, which can differ from what the agent *said*).`,
    },
    {
      id: 's2',
      title: 'Cases: the golden set',
      body: `Your dataset is a set of **golden cases**: inputs with a known acceptable outcome. Build it deliberately:

- **Mirror reality.** Draw cases from your real work (past bugs, real tickets, actual review comments), not from tasks that happen to be easy to grade.
- **Include edge cases and ambiguous cases**, because that is where changes show up. Label ambiguous ones honestly rather than forcing an answer.
- **Sample, do not cherry-pick.** If you cannot test everything, choose by a rule you write down (random, or stratified by difficulty), *before* you look at results.
- **Split.** Keep a **development** set you may look at and tune on, and a **held-out** set you do not touch until you are ready to judge.
- **Version it.** Record which cases, which version, and where each came from (provenance). A result without its dataset version cannot be reproduced.
- **Small and good beats large and sloppy** for a personal harness: ten to thirty well-chosen cases, re-run often, are worth more than hundreds you never maintain. Anthropic's own guidance prefers more automatically graded questions to fewer hand-graded ones - *when the signal is real*.`,
    },
    {
      id: 's3',
      title: 'Graders: deterministic first',
      body: `A grader turns an output (or better, an **outcome**) into a score.

1. **Deterministic graders** - run the test suite, compare to an expected value, validate a schema, check a diff stays inside allowed paths. Cheap, repeatable, impossible to flatter. Use them wherever an answer can be checked mechanically.
2. **Rubrics** - a written scale (for example 0-3 per criterion) applied by a person. Necessary for qualities tests cannot see; subjective, so **lock the rubric before recording** and label it self-assessed. Where you can, **blind** the review so the reviewer does not know which condition produced which output.
3. **Model graders** - scalable, with their own biases and blind spots. Anthropic's example code comments that it is generally best practice to evaluate with a *different* model from the one that generated the output. **Audit** a model grader against cases you have labelled yourself, report its agreement, and call its scores model-graded.

Never let the generating run grade itself, and never treat what an agent *claims* ("all tests pass") as the outcome: run the check.`,
    },
    {
      id: 's4',
      title: 'Threats to validity',
      body: `| Threat | What it looks like | Guard |
|---|---|---|
| **Leakage / contamination** | Test cases appear in the prompt, the instructions, the Skill or (for public benchmarks) possibly the model's training data | Keep test cases out of everything you tune; prefer your own private cases; freeze the held-out set |
| **Tuning on the test set** | You edit until the tested cases pass | Tune on development cases only; judge on held-out |
| **Unequal conditions** | Different tasks, repos, model versions, tools, days | Change exactly one thing; same cases, same environment, same period |
| **Grader bias / self-grading** | The author or the same model judges | Deterministic graders; blind review; audited model graders |
| **Small samples and variance** | One run each, three tasks | Repeated trials; show ranges and counts; claim only what they support |
| **Survivorship** | Failed runs dropped, only wins shown | Record every attempt, including failures and unknowns |
| **Moving target** | Rubric or measures changed after seeing results | Lock them first |
| **Irreproducibility** | No versions, no notes | Record fixture, workflow, model and tool versions and the date |

**Benchmark leakage** deserves a word: a public benchmark may overlap with what a model has seen, and a benchmark score may not resemble your tasks. Treat vendor benchmark numbers as a lead (see the tool-evaluation lesson) and rely on your own private, held-out cases for decisions.`,
    },
    {
      id: 's5',
      title: 'Variability, sampling and honest reporting',
      body: `Language-model outputs vary run to run, so each case needs **several trials**. Then report what the data shows, descriptively:

- **Counts and sample sizes** ("passed 11 of 15 trials across 5 cases"), not a lone percentage.
- **Ranges or spread** across trials per condition, and whether ranges overlap.
- **Unknowns as unknown**, failures as failures, nothing dropped.
- **Per-case results**, because an average can hide that a change fixed four cases and broke two others - exactly what a regression test is for.
- A plain **limitations** statement: which tasks, which model, which environment, how many runs.

Do not claim statistical significance from a handful of trials. A sound conclusion from small data sounds like "in these cases, B passed more often and the ranges did not overlap; a larger set is needed before generalising."`,
    },
    {
      id: 's6',
      title: 'Regression tests for AI behaviour',
      body: `A harness is most valuable *after* the first comparison. Treat your golden set as a **regression suite**:

- Re-run it whenever you change a **prompt, Skill, CLAUDE.md, tool, model or settings**.
- Compare **per-case**, not only in aggregate: which cases flipped?
- **Pin versions** so a change in one place is visible.
- Add a case whenever a real failure reaches you, so it can never silently return.
- Keep it fast and cheap enough that you actually run it.

This is the AI Lab's job in Forge: it keeps conditions, fixtures (with hashes), repeated runs and a locked rubric, shows ranges instead of a winner, and keeps unknown as unknown. It runs nothing for you; you supply the results.`,
    },
    {
      id: 's7',
      title: 'Worked example: bug-fix workflow versus plain prompting',
      body: `*Question: does a "reproduce, then fix, then add a regression test" workflow beat a plain prompt for fixing bugs in my repository?*

- **Cases:** twelve bugs from my repository's history, each with a failing test that reproduces it; sampled by rule (every third closed bug), recorded with commit ids. Eight **development**, four **held-out**.
- **Conditions:** A = plain prompt; B = the workflow. Same repository snapshot, same model and settings, same week. *One difference:* the workflow.
- **Graders:** deterministic - the repository's test suite passes, and the diff touches only allowed paths. A short rubric for maintainability, locked before recording and **blinded** by hiding the condition.
- **Trials:** three per case per condition. Every run is recorded, failures and unknowns included.
- **Report:** per-case table, counts, ranges per condition, the held-out cases shown separately, and limitations ("one repository, one model, twelve cases").
- **Next experiment:** if ranges overlap, add cases; if B wins on development but not held-out, suspect tuning.

The lesson's last task asks you to build a small version of this in the AI Lab.`,
    },
  ],
  activity: {
    title: 'Spot the invalid comparison',
    intro: 'Guided practice with fabricated plans. The skill is in the reading.',
    items: [
      {
        id: 'l23-p1',
        kind: 'flaglines',
        concept: 'eval-harness-design',
        filename: 'comparison-plan-a.txt (fabricated)',
        lines: PLAN,
        prompt: 'Flag the lines that make this comparison invalid or its conclusion unsupported.',
        targets: PLAN_TARGETS,
        hints: ['Compare the tasks given to each condition, who grades, how many runs there are, what was tuned and what was left out.'],
        explanation: 'Different tasks, self-grading, one run, tuning on the test tasks, dropped failures and an overreaching conclusion.',
      },
      {
        id: 'l23-p2',
        kind: 'classify',
        concept: 'eval-harness-design',
        prompt: 'Which threat to validity does each situation illustrate?',
        categories: THREATS,
        entries: [
          { id: 'e1', text: 'Three of the twenty test tasks are quoted as examples inside the prompt being tested', correct: 'leakage', why: 'Test cases inside the prompt measure memory.' },
          { id: 'e2', text: 'You edit the prompt until the five tasks you are scoring on all pass', correct: 'tuning', why: 'You tuned on the test set.' },
          { id: 'e3', text: 'The agent that wrote the patch is asked whether the patch is correct', correct: 'grader', why: 'Self-grading is not independent.' },
          { id: 'e4', text: 'Each condition is run twice on three tasks', correct: 'sample', why: 'Too few runs and cases to separate an effect from variation.' },
          { id: 'e5', text: 'Condition A runs on the old model version and condition B on the new one', correct: 'unequal', why: 'More than one thing differs between the conditions.' },
        ],
        explanation: 'Name the threat, then name the guard.',
      },
      {
        id: 'l23-p3',
        kind: 'order',
        concept: 'eval-harness-design',
        prompt: 'Put the steps of building a small evaluation harness in order.',
        steps: [
          { id: 'o1', text: 'State the question, the hypothesis and the success criteria', why: 'Before any result exists.' },
          { id: 'o2', text: 'Collect real cases, including edge cases, and split development from held-out', why: 'Mirror reality; protect the exam.' },
          { id: 'o3', text: 'Choose graders (deterministic first) and lock the rubric and measures', why: 'Decide how to judge before you look.' },
          { id: 'o4', text: 'Fix the baseline and change exactly one thing between conditions', why: 'So a difference can be attributed.' },
          { id: 'o5', text: 'Run several trials per case per condition and record everything, including failures and unknowns', why: 'Variation and failures are data.' },
          { id: 'o6', text: 'Analyse per case and per condition, then write the limitations and the next experiment', why: 'Report only what the data supports.' },
        ],
        explanation: 'Question, cases, graders, conditions, trials, honest reading.',
      },
      {
        id: 'l23-p4',
        kind: 'single',
        concept: 'eval-harness-design',
        prompt: 'You want to know whether a generated fix is correct, and the repository has a test suite that reproduces the bug. Which grader is strongest?',
        options: [
          o('a', 'Run the test suite and use its result, with a rubric only for qualities tests cannot check', 'Correct: a deterministic grader cannot be flattered.'),
          o('b', 'Ask the model whether its fix works', 'The author vouching for itself.', 'judge-model-is-ground-truth'),
          o('c', 'Read the diff and decide by eye', 'Reading is not running; it is slower and less reliable than the tests.'),
        ],
        correct: 'a',
        explanation: 'Deterministic first.',
      },
    ],
  },
  assessment: {
    title: 'Plan an evaluation and audit one',
    intro: 'A new workflow and a new report, no hints. The leakage and held-out questions are mandatory checks. The last scored item checks a real experiment you save in the AI Lab.',
    passMark: 0.8,
    items: [
      {
        id: 'l23-a1',
        kind: 'fields',
        concept: 'eval-harness-design',
        points: 3,
        prompt: 'Plan a small evaluation. Answer each part concretely.',
        brief: `**Question:** does a "write a plan first, then implement" workflow produce better small-feature changes in your repository than plain prompting?`,
        fields: [
          {
            id: 'cases',
            label: 'The cases',
            help: 'Where they come from, roughly how many, and how you protect the test.',
            groups: [
              { label: 'real cases of your own', anyOf: ['past', 'history', 'real', 'my repository', 'my repo', 'backlog', 'actual tickets', 'closed'] },
              { label: 'a held-out split', anyOf: ['held-out', 'held out', 'withheld', 'hold out', 'separate set', 'not look at', 'development set', 'dev set'] },
            ],
            placeholder: 'e.g. twelve features from my repository history, eight for ... and four ...',
          },
          {
            id: 'grader',
            label: 'The graders',
            help: 'How correctness and quality are judged.',
            groups: [
              { label: 'a deterministic grader', anyOf: ['tests pass', 'test suite', 'run the tests', 'deterministic', 'compile', 'type check', 'typecheck', 'lint'] },
              { label: 'a locked or blinded rubric for the rest', anyOf: ['rubric', 'blind', 'blinded', 'hide which', 'locked', 'lock the'] },
            ],
            placeholder: 'e.g. the test suite for ... and a rubric for ..., locked ...',
          },
          {
            id: 'comparison',
            label: 'The comparison design',
            help: 'Baseline, what stays the same and the number of runs.',
            groups: [
              { label: 'a baseline and one difference', anyOf: ['baseline', 'plain prompt', 'only difference', 'one difference', 'exactly one', 'single change'] },
              { label: 'same cases and repeated runs', anyOf: ['same cases', 'same tasks', 'same repository', 'same environment', 'repeat', 'several runs', 'three runs', 'trials', 'each condition'] },
            ],
            placeholder: 'e.g. baseline is ... ; the only difference is ... ; three runs ...',
          },
          {
            id: 'reporting',
            label: 'Reporting',
            help: 'What you will report, including failures and limits.',
            groups: [
              { label: 'counts, ranges and failures kept', anyOf: ['counts', 'range', 'ranges', 'every run', 'all runs', 'failures', 'failed runs', 'unknown', 'per case', 'per-case'] },
              { label: 'limitations stated', anyOf: ['limitation', 'cannot show', 'one repository', 'one model', 'small sample', 'does not generalis', 'does not generaliz', 'next experiment'] },
            ],
            placeholder: 'e.g. report counts and ranges per condition, keep ... ; limitations ...',
          },
        ],
        explanation: 'Real cases with a held-out split, deterministic graders plus a locked or blinded rubric, a baseline with one difference and repeated runs, and honest reporting with limitations.',
      },
      {
        id: 'l23-a2',
        kind: 'flaglines',
        concept: 'eval-harness-design',
        filename: 'claude-md-experiment.txt (fabricated)',
        lines: REPORT_2,
        prompt: 'Flag the lines that make this comparison invalid or its conclusion unsupported. Some lines are fine.',
        targets: REPORT_2_TARGETS,
        explanation: 'A changed model version, too few runs, an unblinded count by someone with a stake, leakage through the quoted tasks, and an unsupported conclusion.',
      },
      {
        id: 'l23-a3',
        kind: 'single',
        concept: 'eval-harness-design',
        critical: true,
        points: 2,
        prompt: 'Two of your twenty test tasks are quoted as worked examples in the Skill instructions you are evaluating. What is the right response?',
        options: [
          o('a', 'Remove them from the test set (or from the instructions) and re-run: those cases cannot measure generalisation', 'Correct: test cases must not appear in what you are testing.'),
          o('b', 'Keep them: more test cases make the result stronger', 'Leaked cases inflate the score.', 'examples-are-the-test'),
          o('c', 'Keep them and mention them in the report', 'Disclosure helps, but the score is still contaminated.', 'examples-are-the-test'),
          o('d', 'Ignore it; two of twenty is only ten percent', 'A small share can still bias a small sample.', 'examples-are-the-test'),
        ],
        correct: 'a',
        explanation: 'Keep the exam out of the lesson plan.',
      },
      {
        id: 'l23-a4',
        kind: 'single',
        concept: 'eval-harness-design',
        critical: true,
        points: 2,
        prompt: 'What is the held-out set for?',
        options: [
          o('a', 'Judging the final version on cases you did not tune on, so the result shows generalisation', 'Correct: it is the exam you have not seen.'),
          o('b', 'Giving you more cases to tune against', 'Tuning on it destroys its purpose.', 'tuned-set-proves-it'),
          o('c', 'Making the report longer', 'Its value is methodological.'),
        ],
        correct: 'a',
        explanation: 'Do not touch it until you judge.',
      },
      {
        id: 'l23-a5',
        kind: 'classify',
        concept: 'eval-harness-design',
        prompt: 'Which threat to validity does each situation illustrate?',
        categories: THREATS,
        entries: [
          { id: 'b1', text: 'You adjust the rubric after seeing that the new workflow scored lower', correct: 'tuning', why: 'Changing the target after seeing results is tuning on the test.' },
          { id: 'b2', text: 'A public benchmark\'s questions may already be in the model\'s training data', correct: 'leakage', why: 'Benchmark contamination is a form of leakage.' },
          { id: 'b3', text: 'A language model that was not audited against human labels grades all the outputs', correct: 'grader', why: 'An unaudited model grader is a measurement of unknown quality.' },
          { id: 'b4', text: 'Condition A is tested on small bugs and condition B on large refactors', correct: 'unequal', why: 'The tasks differ between the conditions.' },
          { id: 'b5', text: 'The result comes from a single run per condition', correct: 'sample', why: 'One trial cannot show the variation.' },
        ],
        explanation: 'Match the situation to the threat.',
      },
      {
        id: 'l23-a6',
        kind: 'single',
        concept: 'eval-harness-design',
        prompt: 'Your harness scores code fixes with a language-model grader. You also have unit tests. What is the sound use of the model grader?',
        options: [
          o('a', 'Use the tests as the primary measure; use the model grader only for qualities tests cannot check, after auditing it against cases you labelled yourself', 'Correct: deterministic first, audited model grader second.'),
          o('b', 'Use the model grader as the only measure because it reads the diff', 'It is a fallible measurement, not ground truth.', 'judge-model-is-ground-truth'),
          o('c', 'Use whichever of the two gives the better result', 'Choosing after the fact biases the comparison.', 'judge-model-is-ground-truth'),
        ],
        correct: 'a',
        explanation: 'Audit the grader before trusting its grades.',
      },
      {
        id: 'l23-a7',
        kind: 'multi',
        concept: 'eval-harness-design',
        prompt: 'Which things belong in the record of each run? Select all.',
        options: [
          o('a', 'The condition, the case and the date', 'Basic provenance.'),
          o('b', 'The fixture, workflow and model versions used', 'Without versions the result cannot be reproduced.'),
          o('c', 'The measured results, with missing measurements marked unknown', 'Unknown stays unknown.'),
          o('d', 'Only the runs that succeeded', 'Dropping failures is survivorship bias.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Record everything, including failures and unknowns.',
      },
      {
        id: 'l23-a8',
        kind: 'external',
        concept: 'eval-harness-design',
        check: 'lab-evaluation-harness',
        points: 3,
        prompt: 'Build a small evaluation in the AI Lab: a hypothesis, success criteria and planned measures chosen in advance, a baseline, an identified fixture, at least three runs per condition with real measurements, a locked rubric, and limitations. The checklist verifies what you saved. Do not enter invented numbers.',
        explanation: 'Run it by hand in your own tools and record honestly; leave unknowns unknown.',
      },
      {
        id: 'l23-a9',
        kind: 'reflect',
        concept: 'eval-harness-design',
        prompt: 'Self-assessment (recorded, not scored).',
        rubric: [
          'I keep test cases out of everything I tune, and I hold some cases back',
          'I prefer deterministic graders and audit any model grader',
          'I record every run, including failures and unknowns, and state the limitations',
        ],
        explanation: 'A harness is honesty made repeatable.',
      },
    ],
  },
  failureModes: [
    'Different tasks or environments across conditions.',
    'Test cases that also appear in the prompt, instructions or Skill.',
    'Tuning until the scored cases pass.',
    'Self-grading, or an unaudited model grader as ground truth.',
    'Dropping failed runs.',
    'Concluding from a handful of single runs.',
  ],
  application: {
    title: 'Turn one real change into a regression check',
    body: 'Pick a prompt, Skill or CLAUDE.md you rely on. Collect ten real cases (past tasks with a way to check the outcome), freeze four as held-out, and record how the current version does on all ten with repeated runs in the AI Lab. When you next change it, re-run the same cases and compare per case. Practical takeaway: add every real failure that reaches you as a new case.',
    fieldPrompt: 'Log it under Growth → Field evidence when a re-run of your cases catches a regression you would have shipped.',
  },
  reviewItems: [
    { id: 'l23-r1', kind: 'single', concept: 'eval-harness-design', difficulty: 1, prompt: 'What is a golden case?', options: [o('a', 'An input with a known acceptable outcome, drawn from your real work', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Any case the model gets right', 'That would make the set meaningless.'), o('c', 'A case taken from a public benchmark', 'Benchmark cases may not resemble your tasks and may be contaminated.', 'judge-model-is-ground-truth')], correct: 'a', explanation: 'Known outcome, real distribution.' },
    { id: 'l23-r2', kind: 'single', concept: 'eval-harness-design', difficulty: 1, prompt: 'Which grader should you prefer where it applies?', options: [o('a', 'A deterministic one such as a test suite', 'Correct: it matches the practice taught in this lesson.'), o('b', 'The model that generated the output', 'Self-grading is not independent.', 'judge-model-is-ground-truth'), o('c', 'Whichever is fastest', 'Speed is not the criterion.')], correct: 'a', explanation: 'Deterministic first.' },
    { id: 'l23-r3', kind: 'single', concept: 'eval-harness-design', difficulty: 2, prompt: 'Why run several trials per case?', options: [o('a', 'Outputs vary from run to run, so one trial cannot show the effect or the spread', 'Correct: it matches the practice taught in this lesson.'), o('b', 'The first trial is always unreliable', 'No trial is special.'), o('c', 'To make the table larger', 'Not a reason.')], correct: 'a', explanation: 'Variation needs repeats.' },
    { id: 'l23-r4', kind: 'multi', concept: 'eval-harness-design', difficulty: 2, prompt: 'Select the guards against leakage.', options: [o('a', 'Keep test cases out of prompts and instructions', 'Direct guard.'), o('b', 'Freeze a held-out set and do not tune on it', 'Protects the exam.'), o('c', 'Prefer your own private cases to public benchmarks for decisions', 'Public sets may overlap training data.'), o('d', 'Use more of the test cases as examples', 'That creates leakage.', 'examples-are-the-test')], correct: ['a', 'b', 'c'], explanation: 'Separate teaching from testing.' },
    { id: 'l23-r5', kind: 'single', concept: 'eval-harness-design', difficulty: 2, prompt: 'Why compare per case as well as in aggregate?', options: [o('a', 'An average can hide that a change fixed some cases and broke others', 'Correct: that is what a regression test catches.'), o('b', 'Per-case tables are required by the AI Lab', 'It is a practice, not a rule of the tool.'), o('c', 'Averages are always wrong', 'They are useful; they are not enough.')], correct: 'a', explanation: 'Aggregates hide flips.' },
    { id: 'l23-r6', kind: 'single', concept: 'eval-harness-design', difficulty: 3, prompt: 'A model grader agrees with your hand labels on 15 of 20 audited cases. How should you treat its scores?', options: [o('a', 'As a directional, model-graded measure with a stated agreement rate, backed by deterministic checks where they exist', 'Correct: report what it is and how good it is.'), o('b', 'As ground truth, because it is a strong model', 'Agreement of 15 of 20 means it disagrees often.', 'judge-model-is-ground-truth'), o('c', 'As useless', 'It can still be a useful extra signal when audited and labelled.')], correct: 'a', explanation: 'Audit, then label.' },
    { id: 'l23-r7', kind: 'single', concept: 'eval-harness-design', difficulty: 3, prompt: 'What does "survivorship" mean in an evaluation?', options: [o('a', 'Failed runs are dropped so only successes are reported', 'Correct: the table can only look good.'), o('b', 'Only the oldest cases are kept', 'That is a different bias.'), o('c', 'Runs that finish quickly are kept', 'Speed is not what defines it.')], correct: 'a', explanation: 'Keep every attempt.' },
    { id: 'l23-r8', kind: 'single', concept: 'eval-harness-design', difficulty: 3, prompt: 'When should you re-run your harness?', options: [o('a', 'Whenever the prompt, Skill, instructions, tools, model or settings change', 'Correct: that is its regression-test job.'), o('b', 'Only once, when you build it', 'A one-off result says nothing about later changes.'), o('c', 'Only when something obviously breaks', 'Silent regressions are the ones you need to find.')], correct: 'a', explanation: 'Re-run on every change.' },
  ],
  sources: [
    { ...ARTICLES.evals, supports: 'Tasks, trials, graders and outcomes; repeated trials because of non-determinism.' },
    { ...DOCS.developTests, supports: 'Eval design principles: task-specific, edge cases, automate grading, and the advice to use a different model to grade than to generate.' },
    { ...ARTICLES.multiAgent, supports: 'Starting evaluation early with a small set of realistic cases and keeping human review alongside automated grading.' },
  ],
};

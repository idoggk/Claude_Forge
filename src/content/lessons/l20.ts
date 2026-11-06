import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES } from './helpers';

const ROLES = [
  { id: 'representative', label: 'Representative (a common case)' },
  { id: 'boundary', label: 'Boundary (near the decision line)' },
  { id: 'negative', label: 'Negative (what is not in the class)' },
  { id: 'redundant', label: 'Redundant (adds nothing new)' },
];

/** A fabricated few-shot prompt draft. All content is invented. */
const PROMPT_DRAFT = [
  'Classify each review comment as BLOCKING or NON-BLOCKING.',
  'Example 1: "Typo in a comment" -> NON-BLOCKING',
  'Example 2: "Typo in a docstring" -> NON-BLOCKING',
  'Example 3: "Typo in the README" -> NON-BLOCKING',
  'Example 4: "Missing null check crashes on an empty list" -> BLOCKING',
  'Always answer using exactly the wording of the examples.',
  'Test on: "Typo in a comment", "Typo in a docstring", "Missing null check crashes on an empty list".',
];
const PROMPT_DRAFT_TARGETS = [
  { line: 3, severity: 'major' as const, why: 'A near-duplicate of Example 1. Repeated "typo" examples teach the surface cue "typo means non-blocking" instead of the decision rule, and spend examples that could show something new.' },
  { line: 4, severity: 'major' as const, why: 'A third typo example: the set is now mostly one pattern, which the model may over-learn.' },
  { line: 6, severity: 'major' as const, why: 'An instruction to copy the examples\' wording pushes the model toward the examples instead of the task, and breaks on any comment that does not resemble them.' },
  { line: 7, severity: 'critical' as const, why: 'The test cases are the prompt\'s own examples, so the test measures recall of the prompt, not generalisation. Test on withheld cases the prompt never contained.' },
];

/** A fabricated evaluation report with leakage and a tuned set. */
const EVAL_REPORT = [
  'Prompt v1: 3 examples (T1, T2, T3).',
  'Prompt v2: examples T1, T2, T3 plus T4 and T5, added after v1 missed them.',
  'Test set: T1 to T20.',
  'v1 accuracy on the test set: 15 of 20.',
  'v2 accuracy on the test set: 19 of 20.',
  'Conclusion: v2 is 20% better and generalises well.',
];
const EVAL_REPORT_TARGETS = [
  { line: 2, severity: 'major' as const, why: 'T4 and T5 were added after the prompt failed on them, so they were tuned on the very cases they now appear in.' },
  { line: 3, severity: 'critical' as const, why: 'The test set contains T1 to T5, which are examples inside the prompt. Leakage: those cases cannot measure generalisation.' },
  { line: 5, severity: 'major' as const, why: 'The score is inflated because five of the twenty test cases are examples v2 was shown.' },
  { line: 6, severity: 'critical' as const, why: '"20% better" and "generalises well" are not supported: leaked and tuned cases, one run, and a percentage that mixes percentage points with relative change.' },
];

export const L20: Lesson = {
  id: 'L20-few-shot-prompting',
  version: 3,
  track: 'prompting',
  alsoIn: ['safety-eval'],
  order: 20,
  title: 'Few-Shot Prompting and Examples',
  subtitle: 'Choosing representative, boundary and negative examples - and testing on cases the prompt has never seen',
  prerequisites: ['L12-context-engineering'],
  competencies: ['few-shot-design'],
  effortMinutes: 35,
  gameRelevance: 1,
  interestTags: ['context', 'experiments', 'ai-judgment'],
  problem: 'A team adds four examples to a review-comment classifier prompt. All four now classify correctly, and everyone relaxes. On the next batch of real comments the classifier labels half the borderline ones wrongly - and the failures are all comments that look nothing like the four examples.',
  whyItMatters: 'Examples are among the most reliable ways to steer format and judgment, and also one of the easiest ways to fool yourself. A good example set teaches the decision; a careless one teaches a surface pattern and then "passes" its own test.',
  objectives: [
    'Explain what examples teach a model and why they improve consistency.',
    'Choose a small example set that is representative, diverse, and includes boundary and negative cases.',
    'Recognise overfitting to examples and leakage between prompt and test set.',
    'Evaluate an example-based prompt on withheld cases, reporting counts honestly.',
    'Decide when examples add complexity without adding value.',
  ],
  segments: [
    {
      id: 's1',
      title: 'What passing your own examples proves',
      prediction: {
        prompt: 'You add four examples to a classifier prompt and the model now gets all four right. What have you learned about how well the prompt works?',
        options: [
          o('a', 'Very little: you measured it on cases it was shown, which says nothing yet about cases it was not', 'Passing the examples measures that they were read, not that the idea generalises.'),
          o('b', 'That it works, since it scored 100%', 'It scored 100% on the cases it was given.', 'examples-are-the-test'),
          o('c', 'That four examples are enough for any task', 'There is no universal number; coverage of the decision matters.', 'examples-are-the-test'),
        ],
        correct: 'a',
      },
      body: `Anthropic's prompting guidance says examples are one of the most reliable ways to steer output format, tone and structure, and that a few well-crafted examples (few-shot or multishot prompting) improve accuracy and consistency. It asks that examples be **relevant** (mirroring your real use), **diverse** (covering edge cases and varied enough that the model does not pick up unintended patterns) and **structured** (wrapped in tags so they are distinguishable from instructions). Its tip is 3 to 5 examples.

The guidance is about *building* the prompt. This lesson is about the part people skip: how you find out whether the examples did their job. The answer is never "the examples are right now".`,
    },
    {
      id: 's2',
      title: 'What an example teaches',
      body: `An example is a demonstration of a **decision**: *given this input, here is the correct output and, implicitly, why*. A model infers the rule from a handful of demonstrations, and it can infer the *wrong* rule when the examples share an accidental feature.

If every non-blocking example mentions a typo and the only blocking example mentions a crash, a plausible learned rule is "typo means non-blocking" - true of your examples, false of the world. The more your examples vary in wording, length and topic *while the label stays consistent with the real rule*, the more likely the model learns the rule rather than the surface.

Examples also fix **format**: if you need a particular output shape, one clear example often beats a paragraph describing it.`,
    },
    {
      id: 's3',
      title: 'Choosing the set',
      body: `Think of the example set as a tiny, deliberately chosen sample of the decision space:

| Kind | Purpose | Example (blocking vs non-blocking comments) |
|---|---|---|
| **Representative** | Anchor the common cases | A typical typo (non-blocking); SQL built from user input (blocking) |
| **Boundary** | Show where the line is, using cases that *look* like the other class | A missing null check that only crashes on empty input (looks small, is blocking); a style preference phrased technically (looks serious, is non-blocking) |
| **Negative** | Show what is *not* in scope, so the model does not force a label | "LGTM, ship it" is not a finding |
| **Redundant** | Adds nothing; costs tokens and can bias | A second typo example when you already have one |

Keep labels **balanced enough** that one class does not dominate, vary the surface features, and keep the format identical across examples. Test whether the *order* of examples matters for your task rather than assuming it does or does not.`,
    },
    {
      id: 's4',
      title: 'Overfitting, leakage and honest evaluation',
      body: `Treat the examples as training signal and the evaluation set as the exam.

- **Withhold** a set of cases the prompt never contained. Write it (or at least freeze it) *before* tuning.
- **No leakage**: no test case may appear in the prompt, and near-duplicates count. A report whose test set contains the prompt's own examples measures memory.
- **Tuning contaminates**: if you add the cases the prompt failed on as new examples, those cases are no longer a test of anything. You need a fresh withheld set for the revised prompt.
- **Report counts**, not just percentages: "17 of 20" is honest about the sample size; "85%" can hide how small it is.
- **Failures are information.** Read them: do they cluster at the boundary? That tells you which example is missing.

Anthropic's evaluation guidance says to design evals that mirror the real task distribution and to remember edge cases - which is exactly what a withheld set with boundary cases does.`,
    },
    {
      id: 's5',
      title: 'When examples are the wrong tool',
      body: `Examples are not free. Skip or reduce them when:

- A **clear instruction already works** on your withheld cases. Examples add tokens and maintenance for no gain.
- The task has **many valid outputs** and examples would anchor the model to one style you do not want.
- Examples **conflict with the instruction** or with each other, which makes behaviour less predictable.
- The behaviour is better enforced in **code** (a schema, a validator) than demonstrated.

The honest decision procedure is empirical: run the instruction alone and the instruction with examples on the same withheld cases and compare. If the examples do not help, remove them.`,
    },
    {
      id: 's6',
      title: 'Worked example: a review-comment classifier',
      body: `*Task: label review comments BLOCKING or NON-BLOCKING.* A first draft used three typo examples and one crash example.

**Revised set (four examples):** a typical typo (non-blocking), SQL from user input (blocking), a missing null check that crashes only on an empty list (blocking, boundary), and "prefer a for-of loop" (non-blocking, a style preference that sounds technical).

**Evaluation (fabricated numbers, for illustration):**

| Case set | Cases | Correct |
|---|---|---|
| The four prompt examples | 4 | 4 |
| Twelve withheld comments, never in the prompt | 12 | 8 |

The first row says only that the examples were read. The second says 8 of 12 correct on cases it had not seen - a real, if small, measurement. Reading the four misses shows all were **boundary** cases of a kind the set did not cover (a performance issue that blocks only at scale). The next move is a new boundary example, a *new* withheld set to re-test, and the comparison with the instruction-only prompt - not declaring victory.`,
    },
  ],
  activity: {
    title: 'Build an example set, then test it honestly',
    intro: 'Guided practice with fabricated comments and results.',
    items: [
      {
        id: 'l20-p1',
        kind: 'classify',
        concept: 'few-shot-design',
        prompt: 'For a BLOCKING / NON-BLOCKING review classifier whose set already has a typo example, what role would each candidate example play?',
        categories: ROLES,
        entries: [
          { id: 'e1', text: '"Typo in a comment (\'recieve\')" -> NON-BLOCKING', correct: 'representative', why: 'A common, clear non-blocking case.' },
          { id: 'e2', text: '"Missing null check; crashes only when the list is empty" -> BLOCKING', correct: 'boundary', why: 'It looks small but is blocking: it marks the decision line.' },
          { id: 'e3', text: '"Another typo, this time in a docstring" -> NON-BLOCKING', correct: 'redundant', why: 'The set already has a typo example; this adds nothing new.' },
          { id: 'e4', text: '"LGTM, ship it" -> NON-BLOCKING (no finding)', correct: 'negative', why: 'It shows what is not a finding, so the model does not force a label.' },
          { id: 'e5', text: '"SQL built by concatenating user input" -> BLOCKING', correct: 'representative', why: 'A typical blocking issue.' },
        ],
        explanation: 'Representative anchors, boundary defines the line, negative marks the edge of scope, redundant wastes space.',
      },
      {
        id: 'l20-p2',
        kind: 'multi',
        concept: 'few-shot-design',
        prompt: 'You may keep four of these seven candidate examples. Select the four that make the best set.',
        options: [
          o('a', '"Typo in a comment (\'recieve\')" -> NON-BLOCKING', 'A clear, common non-blocking case; keep one of the trivial kind.'),
          o('b', '"Another typo in a different comment" -> NON-BLOCKING', 'A near-duplicate of the first: it adds no new information.'),
          o('c', '"SQL built by concatenating user input" -> BLOCKING', 'A representative blocking case.'),
          o('d', '"Missing null check; crashes only on an empty list" -> BLOCKING', 'A boundary case that looks minor but is blocking.'),
          o('e', '"Prefer for-of over forEach here" -> NON-BLOCKING', 'A boundary case: style that sounds technical but is not blocking.'),
          o('f', '"LGTM, ship it" -> NON-BLOCKING', 'Useful for scope, but lower value than the four above when you can keep only four.'),
          o('g', '"Trailing whitespace on line 40" -> NON-BLOCKING', 'Trivial and redundant with the typo example.'),
        ],
        correct: ['a', 'c', 'd', 'e'],
        explanation: 'One trivial non-blocking, one clear blocking, and two boundary cases. Near-duplicates are dropped.',
      },
      {
        id: 'l20-p3',
        kind: 'flaglines',
        concept: 'few-shot-design',
        filename: 'review-classifier-prompt.txt',
        lines: PROMPT_DRAFT,
        prompt: 'Flag the lines of this fabricated prompt draft that weaken it as an example-based prompt or its test.',
        targets: PROMPT_DRAFT_TARGETS,
        hints: ['Look for repetition among the examples, an over-constraining rule, and what the test set is made of.'],
        explanation: 'Redundant typo examples, an instruction to copy example wording, and a test set equal to the examples.',
      },
      {
        id: 'l20-p4',
        kind: 'numeric',
        concept: 'few-shot-design',
        prompt: 'The prompt\'s four examples were classified 4 of 4. On twelve withheld cases it got 8 right. What is the held-out accuracy, as a whole-number percentage?',
        answer: 67,
        tolerance: 0.5,
        unit: '%',
        hints: ['Use only the withheld cases: correct divided by total.'],
        explanation: '8 of 12 is about 67%. The 4 of 4 on the examples is not part of the measurement.',
      },
    ],
  },
  assessment: {
    title: 'Improve a prompt with examples, then catch a bad evaluation',
    intro: 'A new task and a new report, no hints. The question about passing your own examples is a mandatory check.',
    passMark: 0.8,
    items: [
      {
        id: 'l20-a1',
        kind: 'fields',
        concept: 'few-shot-design',
        points: 3,
        prompt: 'Improve this instruction with a small example set, and say how you will test it. Answer each part concretely.',
        brief: `**Task:** an instruction says "Label each support message as BUG, FEATURE-REQUEST or BILLING." Real messages are short, informal and often mix topics ("the invoice page crashes when I try to download it").`,
        fields: [
          {
            id: 'selection',
            label: 'Which examples, and why',
            help: 'Cover all labels, and say what each example is for.',
            groups: [
              { label: 'a boundary or mixed case', anyOf: ['boundary', 'mixed', 'ambiguous', 'borderline', 'near the line', 'crashes', 'overlap', 'both'] },
              { label: 'representative cases for each label', anyOf: ['representative', 'typical', 'each label', 'every label', 'all three', 'common case', 'one for each'] },
            ],
            placeholder: 'e.g. one typical message per label plus a boundary case such as ...',
          },
          {
            id: 'format',
            label: 'How you format and balance them',
            help: 'Structure, consistency and variety.',
            groups: [
              { label: 'consistent structure or tags', anyOf: ['same format', 'consistent', 'tags', '<example', 'xml', 'identical format', 'same structure', 'delimit'] },
              { label: 'varied wording or balanced labels', anyOf: ['vary', 'varied', 'diverse', 'different wording', 'balanced', 'balance', 'not all', 'similar number'] },
            ],
            placeholder: 'e.g. every example uses the same ... and the wording ...',
          },
          {
            id: 'withheld',
            label: 'How you will test it',
            help: 'Cases and reporting.',
            groups: [
              { label: 'withheld cases never in the prompt', anyOf: ['withheld', 'held out', 'held-out', 'not in the prompt', 'never in the prompt', 'unseen', 'separate set', 'new cases'] },
              { label: 'report counts', anyOf: ['counts', 'out of', ' of ', 'sample size', 'how many', 'number correct'] },
            ],
            placeholder: 'e.g. twenty withheld messages ... reported as ...',
          },
          {
            id: 'risk',
            label: 'The main risk and your mitigation',
            help: 'Overfitting or leakage.',
            groups: [
              { label: 'overfitting or leakage named', anyOf: ['overfit', 'leak', 'memoris', 'memoriz', 'surface pattern', 'surface cue', 'tuned on', 'contaminat'] },
              { label: 'a mitigation', anyOf: ['fresh', 'new withheld', 'do not tune', "don't tune", 'freeze', 'vary', 'rerun', 're-run', 'compare with the instruction', 'instruction alone', 'without examples'] },
            ],
            placeholder: 'e.g. the risk is ... so I ...',
          },
        ],
        explanation: 'Representative and boundary examples with consistent structure and varied wording, tested on withheld cases reported as counts, with overfitting named and mitigated.',
      },
      {
        id: 'l20-a2',
        kind: 'flaglines',
        concept: 'few-shot-design',
        filename: 'prompt-eval-report.txt',
        lines: EVAL_REPORT,
        prompt: 'Flag the lines where this report claims more than it measured, or contains leakage. Some lines are fine.',
        targets: EVAL_REPORT_TARGETS,
        explanation: 'Tuning on failures, a test set that contains the examples, an inflated score and an unsupported conclusion. Lines 1, 4 are neutral statements of what was run.',
      },
      {
        id: 'l20-a3',
        kind: 'single',
        concept: 'few-shot-design',
        critical: true,
        points: 2,
        prompt: 'After adding five examples, your prompt classifies all five correctly. What is the strongest next step?',
        options: [
          o('a', 'Test on withheld cases that were never in the prompt, including boundary cases, and report the counts', 'Correct: only unseen cases can show the examples generalise.'),
          o('b', 'Re-run the same five examples several times to be sure that the result is stable and not luck', 'Repeating the prompt\'s own examples cannot show generalisation.', 'examples-are-the-test'),
          o('c', 'Declare it working: five out of five is a perfect score, so no further testing is needed', 'Five of five on seen cases is not a measurement of anything unseen.', 'examples-are-the-test'),
          o('d', 'Add the next five failures you find as new examples, and re-test on those to confirm the fix', 'Failures turned into examples are no longer a test; a fresh withheld set is needed.', 'examples-are-the-test'),
        ],
        correct: 'a',
        explanation: 'Withhold cases for testing.',
      },
      {
        id: 'l20-a4',
        kind: 'single',
        concept: 'few-shot-design',
        prompt: 'A prompt handles clear cases well but mislabels messages that mix a bug report with a billing complaint. Which change most directly targets the failure?',
        options: [
          o('a', 'Add an example of a mixed message with the label you actually want, in the same format', 'Correct: a boundary example demonstrates the decision exactly where it fails.'),
          o('b', 'Add three more clear bug-report examples so the model sees the bug-report label more often', 'The failures are at the boundary; more clear cases add nothing there.'),
          o('c', 'Tell the model to try harder and think more carefully whenever a message mixes two topics', 'That adds no information about the desired decision.', 'longer-prompt-better'),
        ],
        correct: 'a',
        explanation: 'Boundary failures need boundary examples.',
      },
      {
        id: 'l20-a5',
        kind: 'classify',
        concept: 'few-shot-design',
        prompt: 'For a BUG / FEATURE-REQUEST / BILLING classifier, what role would each candidate example play?',
        categories: ROLES,
        entries: [
          { id: 'b1', text: '"The app crashes when I tap Save" -> BUG', correct: 'representative', why: 'A typical bug report.' },
          { id: 'b2', text: '"The invoice page crashes when I download it" -> BUG (not BILLING)', correct: 'boundary', why: 'It mentions billing but the real problem is a crash: it marks the line.' },
          { id: 'b3', text: '"Thanks, that fixed it!" -> NONE (not a request)', correct: 'negative', why: 'It shows a message that fits no label.' },
          { id: 'b4', text: '"The app crashes when I tap Delete" -> BUG (the set already has a crash-on-tap bug)', correct: 'redundant', why: 'It repeats a pattern the set already covers.' },
        ],
        explanation: 'Match each example to what it adds.',
      },
      {
        id: 'l20-a6',
        kind: 'numeric',
        concept: 'few-shot-design',
        prompt: 'A revised prompt scored 17 correct on 20 withheld cases that were never in the prompt or used for tuning. What is the held-out accuracy, as a whole-number percentage?',
        answer: 85,
        tolerance: 0.5,
        unit: '%',
        explanation: '17 of 20 is 85%. Report it as 17 of 20: the sample is small.',
      },
      {
        id: 'l20-a7',
        kind: 'multi',
        concept: 'few-shot-design',
        prompt: 'In which situations do examples probably add unnecessary complexity? Select all.',
        options: [
          o('a', 'A clear instruction already scores well on your withheld cases', 'Examples would add tokens and upkeep for no measured gain.'),
          o('b', 'The task has many valid outputs and examples would anchor the model to one style', 'Anchoring narrows behaviour you wanted open.'),
          o('c', 'The rule can be enforced by a validator in code', 'Code enforcement beats demonstration.'),
          o('d', 'Outputs must follow a precise format the model keeps getting wrong', 'A format example is exactly where examples earn their cost.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Decide empirically: compare with and without examples on withheld cases.',
      },
      {
        id: 'l20-a8',
        kind: 'reflect',
        concept: 'few-shot-design',
        prompt: 'Self-assessment (recorded, not scored).',
        rubric: [
          'I can say what each example in my set is for (representative, boundary, negative)',
          'I test on cases the prompt has never contained and report counts',
          'I compare against the instruction without examples before keeping them',
        ],
        explanation: 'Examples teach; withheld cases test.',
      },
    ],
  },
  failureModes: [
    'Scoring a prompt on its own examples.',
    'Near-duplicate examples that teach a surface pattern.',
    'Adding failures as examples and re-testing on them.',
    'No boundary or negative examples.',
    'Reporting a percentage without the sample size.',
    'Keeping examples that do not beat the plain instruction.',
  ],
  application: {
    title: 'Improve one real classification or review prompt',
    body: 'Take a prompt you use that sorts or labels things. Write 10 or more real cases and set half aside before touching the prompt. Draft 3 to 5 examples (representative, boundary, negative). Run the instruction alone and the instruction with examples on the withheld half, several times, and record counts including failures. Practical takeaway: keep the withheld set frozen, and keep the examples only if they beat the plain instruction.',
    fieldPrompt: 'Log it under Growth → Field evidence when a withheld-case test changes which examples you keep.',
  },
  reviewItems: [
    { id: 'l20-r1', kind: 'single', concept: 'few-shot-design', difficulty: 1, prompt: 'What does Anthropic\'s guidance say good examples should be?', options: [o('a', 'Relevant, diverse and structured', 'Correct: mirror the real use, cover edge cases, and wrap them so they are distinguishable.'), o('b', 'As many as possible', 'The guidance suggests a handful, not volume.', 'longer-prompt-better'), o('c', 'Identical to the test cases', 'That is leakage, not good practice.', 'examples-are-the-test')], correct: 'a', explanation: 'Relevant, diverse, structured.' },
    { id: 'l20-r2', kind: 'single', concept: 'few-shot-design', difficulty: 1, prompt: 'What is a boundary example?', options: [o('a', 'A case near the decision line, often one that looks like the other class', 'Correct: it matches the practice taught in this lesson.'), o('b', 'The most common case in your data, which shows the model what an ordinary input looks like', 'That is a representative example.'), o('c', 'A repeated example that is shown more than once so that the model gives it greater weight', 'That is a redundant one.')], correct: 'a', explanation: 'Boundary examples define the line.' },
    { id: 'l20-r3', kind: 'single', concept: 'few-shot-design', difficulty: 2, prompt: 'Your test set contains the prompt\'s examples. What is the problem?', options: [o('a', 'Leakage: the test measures memory of the prompt, not generalisation', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Nothing: more cases is better, and the examples are a fair sample of the inputs to be handled', 'More cases help only if they are unseen.', 'examples-are-the-test'), o('c', 'The test is too hard, because the examples in the prompt are the cases that are the most unusual', 'It is too easy for the opposite reason.')], correct: 'a', explanation: 'No test case may be in the prompt.' },
    { id: 'l20-r4', kind: 'multi', concept: 'few-shot-design', difficulty: 2, prompt: 'Select the signs of a weak example set.', options: [o('a', 'Several near-duplicate examples', 'Redundant: it adds nothing the set does not already show.'), o('b', 'No example near the decision boundary', 'The hardest cases are uncovered.'), o('c', 'One label appears in almost every example', 'Unbalanced labels bias the output.'), o('d', 'Examples that vary in wording but share one label rule', 'That is good diversity.')], correct: ['a', 'b', 'c'], explanation: 'Redundant, unbalanced and boundary-free sets are weak.' },
    { id: 'l20-r5', kind: 'single', concept: 'few-shot-design', difficulty: 2, prompt: 'You tune a prompt by adding the cases it failed. How should you now evaluate it?', options: [o('a', 'On a fresh withheld set the revised prompt has never seen', 'Correct: tuned cases are no longer a test.'), o('b', 'On the same cases it failed before, which it now passes', 'Those are now training signal.', 'examples-are-the-test'), o('c', 'On the examples that are in the prompt, since those show what the model has been taught to do', 'They were shown to the model.', 'examples-are-the-test')], correct: 'a', explanation: 'Tuning contaminates the old set.' },
    { id: 'l20-r6', kind: 'single', concept: 'few-shot-design', difficulty: 3, prompt: 'The instruction alone scores 18 of 20 on withheld cases, and with four examples it scores 18 of 20. What is the sound decision?', options: [o('a', 'Prefer the simpler instruction-only prompt, since the examples added no measured benefit', 'Correct: complexity must earn its place.'), o('b', 'Keep the examples, since they cannot hurt and they may help on inputs that the test did not cover', 'They add tokens and upkeep and can anchor behaviour.'), o('c', 'Add more examples to the prompt, on the chance that a larger set will show the benefit later', 'There is no evidence more examples would help.')], correct: 'a', explanation: 'Compare with and without.' },
    { id: 'l20-r7', kind: 'single', concept: 'few-shot-design', difficulty: 3, prompt: 'Which report is most honest?', options: [o('a', '"17 of 20 correct on 20 withheld cases; four of the misses were boundary cases"', 'Correct: counts, withheld cases and failure analysis.'), o('b', '"85% accurate on the cases that I tried while I was improving the prompt over the past week"', 'No sample size and no indication of what was tested.', 'examples-are-the-test'), o('c', '"4 of 4 on the examples in the prompt, so the prompt is 100% correct on this kind of input"', 'That is the prompt\'s own examples.', 'examples-are-the-test')], correct: 'a', explanation: 'Counts, provenance of the cases, failures.' },
    { id: 'l20-r8', kind: 'single', concept: 'few-shot-design', difficulty: 3, prompt: 'Why do near-duplicate examples hurt?', options: [o('a', 'They spend examples on one pattern and can teach a surface cue instead of the decision rule', 'Correct: it matches the practice taught in this lesson.'), o('b', 'They make the prompt invalid, so the model refuses to follow it until the duplicates are removed', 'They are allowed; they are just wasteful.'), o('c', 'They are ignored by the model, so they cost tokens and add nothing to what it learns from them', 'They are read and can bias the output.')], correct: 'a', explanation: 'Diversity matters.' },
  ],
  sources: [
    { ...DOCS.promptingPractices, supports: 'Examples should be relevant, diverse and structured; the guidance suggests 3 to 5 examples.' },
    { ...DOCS.developTests, supports: 'Designing evaluations that mirror the real task distribution and include edge cases.' },
    { ...ARTICLES.evals, supports: 'Held-out tasks, graders and repeated trials when evaluating a change.' },
  ],
};

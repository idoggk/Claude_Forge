import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS } from './helpers';

export const L10: Lesson = {
  id: 'L10-forge-production-skill',
  version: 1,
  track: 'claude-code',
  order: 10,
  title: 'Forge a Production Skill',
  subtitle: 'Capstone: design, safety, tests, evidence and a decision you can defend',
  prerequisites: ['L05-first-custom-skill', 'L08-battle-lab'],
  competencies: ['production-skills', 'skill-authoring'],
  effortMinutes: 30,
  gameRelevance: 3,
  interestTags: ['authoring', 'game-dev', 'experiments'],
  problem: 'A Skill that validates is not a Skill you can trust in a real project. Production means: it triggers when it should, stays quiet when it should not, is safe to share, has been tried for real, and has been compared against doing nothing.',
  whyItMatters: 'This is the proof of the course outcome: you can build a Skill and demonstrate - not feel - that it helps.',
  objectives: [
    'Meet an explicit production checklist, verified from your saved Workshop and AI Lab data.',
    'Record a live-test observation and an experiment link.',
    'Make an Arsenal decision (keep, revise, reject) you can justify with evidence.',
  ],
  segments: [
    {
      id: 's1',
      title: 'What "production" means here',
      body: `A production-ready Skill, for this course, has:
1. **Zero validation errors** and no safety-class warnings.
2. A **description with a trigger and a boundary**.
3. **Scenarios**: at least 6 - two positive, two negative (one near-miss), one ambiguous.
4. **Progressive disclosure**: a linked reference file instead of one giant body.
5. **Revision history**: at least two snapshots, so you can see what changed.
6. **A live test** you actually ran in Claude Code, recorded honestly.
7. **An export** you have read.
8. **A comparison**: an AI Lab experiment with a condition naming this Skill.`,
    },
    {
      id: 's2',
      title: 'Choose a worthy target',
      body: `Pick a Skill that matches a fixture so you can test it: **merge-chain-debugger** (Fixture 1), **economy-sim-reviewer** (Fixture 2) or **handoff-gatekeeper** (Fixture 3) - all are listed as proposed custom Skills in the Discovery Hub. Prefer something you would genuinely use.`,
    },
    {
      id: 's3',
      title: 'Decide with evidence, including "reject"',
      body: `After your experiment, decide: **keep**, **revise** (change one thing, run again) or **reject**. "Rejected: no measurable benefit on two fixtures; context cost not justified" is a successful outcome - it saved you from carrying dead weight.

Do not mark a Skill **Mastered** in the Arsenal because you installed it. Mastered should mean you can write it, test it, and explain what it does and does not do.`,
    },
    {
      id: 's4',
      title: 'What to learn next',
      body: `The Growth page shows your weakest competencies and due reviews. Natural next steps beyond this release: path-scoped Skills (\`paths\`), Skills with hooks, plugin packaging, and \`claude plugin eval\` suites for trigger-rate measurement.`,
    },
  ],
  activity: {
    title: 'Build to the checklist',
    intro: 'Open the Workshop, create a Skill, and watch the live checklist. Then run your experiment in the AI Lab.',
    widget: 'capstone-brief',
    items: [
      {
        id: 'l10-p1',
        kind: 'single',
        concept: 'production-skills',
        prompt: 'Your Skill passes validation but you have not run it in Claude Code. How should you describe its status?',
        options: [
          o('a', 'Production-ready', 'Validation checks structure, not behaviour.'),
          o('b', 'Designed and validated; untested live', 'Correct and honest.'),
          o('c', 'Mastered', 'Nothing has been demonstrated.', 'marking-is-mastery'),
          o('d', 'Verified', 'Forge cannot verify behaviour.'),
        ],
        correct: 'b',
        explanation: 'Name the evidence you have.',
      },
      {
        id: 'l10-p2',
        kind: 'multi',
        concept: 'production-skills',
        prompt: 'Which belong in a production checklist? Select all.',
        options: [
          o('a', 'A near-miss negative scenario', 'Near-misses reveal over-triggering.'),
          o('b', 'A recorded live test', 'A recorded live test is evidence of real behaviour.'),
          o('c', 'An experiment comparing with no Skill', 'A baseline comparison shows what the Skill actually adds.'),
          o('d', 'Popularity of similar Skills on GitHub', 'No - not evidence about yours.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Evidence about your Skill, not about others.',
      },
      {
        id: 'l10-p3',
        kind: 'external',
        concept: 'production-skills',
        check: 'workshop-capstone-skill',
        points: 4,
        prompt: 'Verified from your saved Workshop and AI Lab data against the production checklist.',
        explanation: 'Each check reads your saved records.',
      },
    ],
  },
  assessment: {
    title: 'Capstone verification',
    intro: 'The checklist item is verified from your data. The self-assessment is yours and is never counted toward mastery. No hints.',
    passMark: 0.8,
    items: [
      {
        id: 'l10-a1',
        kind: 'external',
        concept: 'production-skills',
        check: 'workshop-capstone-skill',
        points: 6,
        prompt: 'Production checklist, verified from your saved Skill, live tests, revisions and experiments.',
        explanation: 'All checks must pass.',
      },
      {
        id: 'l10-a2',
        kind: 'single',
        concept: 'production-skills',
        critical: true,
        points: 2,
        prompt: 'When is it honest to mark a Skill "Mastered" in your Arsenal?',
        options: [
          o('a', 'Right after installing it', 'Installing proves nothing about skill.'),
          o('b', 'When you can write and test it, and you have evidence of what it does and does not do', 'Correct.'),
          o('c', 'When it has many stars', 'Popularity is not mastery.'),
          o('d', 'When validation shows no errors', 'Validation is structural.'),
        ],
        correct: 'b',
        explanation: 'Do not award mastery for simply marking an item as used.',
      },
      {
        id: 'l10-a3',
        kind: 'single',
        concept: 'production-skills',
        points: 2,
        prompt: 'Your experiment shows the Skill made no measurable difference over three runs per condition on one fixture. The best next step?',
        options: [
          o('a', 'Declare it useless forever', 'Too strong from this evidence.'),
          o('b', 'Keep it because it feels good', 'Ignores your own evidence.'),
          o('c', 'Revise one thing or add a second fixture and run again, or reject it with the evidence recorded', 'Correct.'),
          o('d', 'Delete the experiment', 'Negative results are results.'),
        ],
        correct: 'c',
        explanation: 'Decide from evidence and keep the record.',
      },
      {
        id: 'l10-a4',
        kind: 'multi',
        concept: 'production-skills',
        prompt: 'Select the claims you may truthfully make after live-testing 7 prompts and running 3+3 experiment runs.',
        options: [
          o('a', 'On these prompts it activated on N of M expected positives', 'A report of observations.'),
          o('b', 'On this fixture, with these runs, tests-passed was higher/lower/overlapping', 'A bounded claim.'),
          o('c', 'The Skill is better than no Skill', 'Three runs on one fixture cannot support a general claim.'),
          o('d', 'The Skill is safe', 'Safety needs a review, and a clean scan is not approval.'),
        ],
        correct: ['a', 'b'],
        explanation: 'Bounded, evidence-linked claims.',
      },
      {
        id: 'l10-a5',
        kind: 'reflect',
        concept: 'production-skills',
        prompt: 'Self-assessment (not counted toward mastery): tick what is true.',
        rubric: [
          'I could explain to a teammate why the description triggers and where it should not.',
          'I have read the exported SKILL.md and every bundled file.',
          'I know which of my scenarios failed live and what I changed.',
          'I would be comfortable defending keep / revise / reject using my recorded evidence.',
        ],
        explanation: 'Reflection is useful but is your own judgement - Forge records it separately.',
      },
    ],
  },
  failureModes: [
    'Calling a validated Skill "tested".',
    'Skipping the baseline condition.',
    'Marking Mastered on installation.',
    'Treating a rejected Skill as wasted effort.',
  ],
  application: {
    title: 'Use it on real work, then decide',
    body: 'Use the Skill for a week on One More Merge. Record the live tests and the experiment. Update the Arsenal with an honest status and a next-practice note.',
    fieldPrompt: 'Log it under Growth → Field evidence when you have used the Skill on real work for a while and made a keep / revise / reject call.',
  },
  reviewItems: [
    {
      id: 'l10-r1',
      kind: 'single',
      concept: 'production-skills',
      prompt: 'Which evidence shows a Skill triggers as intended?',
      options: [o('a', 'Live tests recorded in Claude Code against positive and negative prompts', 'Correct.'), o('b', 'A high overlap score', 'Heuristic only.'), o('c', 'A clean validation', 'Validation checks structure, not behaviour.'), o('d', 'Star count', 'Star counts say nothing about your Skill\'s behaviour.')],
      correct: 'a',
      explanation: 'Behaviour needs observation.',
    },
    {
      id: 'l10-r2',
      kind: 'single',
      concept: 'production-skills',
      prompt: 'A rejected Skill with a recorded reason is…',
      options: [o('a', 'A valid, useful outcome', 'Correct.'), o('b', 'A failure', 'A rejection backed by evidence is a result.'), o('c', 'Something to hide', 'There is nothing to hide in a negative result.'), o('d', 'Proof the course failed', 'A negative result is a result, not a course failure.')],
      correct: 'a',
      explanation: 'Evidence-based rejection saves context and attention.',
    },
    {
      id: 'l10-r3',
      kind: 'multi',
      concept: 'production-skills',
      prompt: 'Select the capstone checklist items.',
      options: [o('a', 'At least 2 saved revisions', 'Revision snapshots show what you changed when behaviour shifts.'), o('b', 'A recorded live test', 'A recorded live test is evidence of real behaviour.'), o('c', 'More than 1,000 characters of instructions', 'Not a requirement.'), o('d', 'An experiment naming the Skill', 'A comparison shows what the Skill adds.')],
      correct: ['a', 'b', 'd'],
      explanation: 'Revisions, live test, comparison.',
    },
  ],
  sources: [{ ...DOCS.skills, supports: 'Skill testing, evals, trigger troubleshooting.' }],
};

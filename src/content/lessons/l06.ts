import type { Lesson } from '@/domain/curriculum/types';
import { o } from './helpers';
import { BUGGY_RESOLVER, CASES, parseBoard, scanSeeds } from '@/fixtures/merge-cascade/cases';
import { totalValue, pieceValue } from '@/fixtures/merge-cascade/board';
import { CANDIDATES } from '@/fixtures/merge-cascade/candidates';

const SEEDS_1_40 = Array.from({ length: 40 }, (_, i) => i + 1);
const FIRST_FAIL = scanSeeds(BUGGY_RESOLVER, SEEDS_1_40)[0]!;

const cascadeCase = CASES.find((c) => c.id === 'cascade-into-four')!;
function valueDestroyedInCascadeCase(): number {
  const before = parseBoard(cascadeCase.board);
  const res = BUGGY_RESOLVER(before, { r: cascadeCase.drop.r, c: cascadeCase.drop.c }, cascadeCase.drop.rank);
  return totalValue(before) + pieceValue(cascadeCase.drop.rank) - totalValue(res.board);
}

export const L06: Lesson = {
  id: 'L06-merge-chain-failure',
  version: 3,
  track: 'game-dev',
  order: 6,
  title: 'Debug a Merge-Chain Failure',
  subtitle: 'Invariant-first debugging on a real seeded TypeScript bug',
  prerequisites: ['L01-skill-or-tool'],
  competencies: ['systematic-debugging'],
  effortMinutes: 18,
  gameRelevance: 3,
  interestTags: ['game-dev'],
  problem: 'QA reports: "after a big chain, I sometimes end up with fewer pieces and a lower score than I should". It only happens in some cascades. You can guess at the cause, or you can pin it down with an invariant and a reproduction.',
  whyItMatters: 'This is the investigation a debugging Skill should enforce. If you cannot do it by hand on a 100-line fixture, you cannot judge whether Claude - with or without a Skill - did it correctly.',
  objectives: [
    'State a violated invariant for a game rule (value conservation).',
    'Reproduce a failure with a seed and find the first failing step.',
    'Tell a root-cause fix from patches that merely hide the symptom.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Start from an invariant, not a hunch',
      body: `A merge board has a conservation law. If a piece of rank *r* is worth 3^*r*, then merging three rank-*r* pieces (3 × 3^*r*) into one rank *r*+1 (3^(*r*+1)) **preserves total value**. So after any drop:

> total value after = total value before + value of the dropped piece

When that equation fails, you know *something destroyed or created value* - long before you know what. That is far more precise than "the score is wrong".`,
    },
    {
      id: 's2',
      title: 'Minimal reproduction by seed',
      body: `Random play is reproducible when the RNG is seeded. Scan seeds, find the first one that violates the invariant, then find the **first drop number** where it breaks. Reduce the board to the smallest case that still fails - here, a group of four connected pieces.

Fixture 1 ships eight hand-written cases (three fail on the buggy code) plus seeded playthroughs. The cases include **edge cases** (max rank, occupied cell) so a fix cannot "pass" by breaking something else.`,
    },
    {
      id: 's3',
      title: 'Symptom patches vs root-cause fixes',
      body: `Typical tempting patches:
- **Special-case the reported situation** ("if the group has exactly 4…") - passes the ticket, fails the next variant.
- **Fix the number players noticed** (credit the lost score) - the board is still wrong.
- **Repair afterwards** (spawn replacement pieces) - restores one invariant by violating the rules.

A root-cause fix makes the *code state the rule*: a merge consumes **exactly three** pieces.`,
    },
    {
      id: 's4',
      title: 'Where a debugging Skill earns its keep',
      body: `A good debugging Skill changes the *order* of work: state the invariant → build a minimal reproduction → locate the cause → smallest fix → run the whole suite → add a regression test. Whether that helps *you* is an empirical question - Lesson 8 shows how to measure it instead of trusting the feeling.`,
    },
  ],
  activity: {
    title: 'Investigate the fixture',
    intro: 'Use the lab: run the cases, scan seeds, inspect boards, and test candidate patches. Everything runs the app\'s own trusted fixture code - nothing you type is executed.',
    widget: 'merge-lab',
    items: [
      {
        id: 'l06-p1',
        kind: 'multi',
        concept: 'systematic-debugging',
        prompt: 'Which of these are true invariants of the merge board? Select all.',
        options: [
          o('a', 'A drop adds exactly the dropped piece\'s value; merges conserve total value', 'True - the conservation law.'),
          o('b', 'After resolution no group of 3+ equal pieces remains (below max rank)', 'True - the board is stable.'),
          o('c', 'Each merge step consumes exactly 3 pieces', 'True: a merge step consumes exactly three pieces.'),
          o('d', 'The number of pieces on the board never decreases', 'False - merging reduces the piece count.'),
          o('e', 'Every drop causes at least one merge', 'False - isolated drops merge nothing.'),
        ],
        correct: ['a', 'b', 'c'],
        hints: ['A merge turns three pieces into one - what does that do to the piece count?'],
        explanation: 'Good invariants are properties that must hold after every operation.',
      },
      {
        id: 'l06-p2',
        kind: 'numeric',
        concept: 'systematic-debugging',
        prompt: 'Scan seeds 1-40 on the BUGGY code in the lab. How many of the 40 playthroughs violate an invariant?',
        answer: () => scanSeeds(BUGGY_RESOLVER, SEEDS_1_40).length,
        unit: 'seeds',
        hints: ['Use "Scan seeds 1-40" in the lab and count the failures.'],
        explanation: 'More than one seed fails: the bug is not a one-off, and each failing seed is a ready-made reproduction.',
      },
      {
        id: 'l06-p3',
        kind: 'numeric',
        concept: 'systematic-debugging',
        prompt: `Seed ${FIRST_FAIL.seed} is the lowest failing seed. On which drop number does an invariant first break?`,
        answer: FIRST_FAIL.dropNumber,
        unit: 'drop number',
        hints: ['Open the failing seed in the lab; it shows the first violating drop and the board before it.'],
        explanation: 'Knowing the first failing step turns a long random game into a short, readable reproduction.',
      },
      {
        id: 'l06-p4',
        kind: 'single',
        concept: 'systematic-debugging',
        prompt: 'Which function contains the root cause?',
        options: [
          o('a', 'floodGroup() - it finds too many connected cells', 'It finds the right group; the group may legitimately have more than three cells.'),
          o('b', 'pickMergeCells() - it returns the whole group instead of three cells', 'Correct: the rule says exactly three are consumed; the code consumes all of them.'),
          o('c', 'pieceValue() - the 3^rank formula is wrong and gives merged pieces the wrong value', 'The formula is what makes the invariant hold.'),
          o('d', 'dropPiece()\'s loop - it never terminates for some boards', 'It terminates; the loss is in what each iteration clears.'),
        ],
        correct: 'b',
        hints: ['Which function decides how many cells a merge clears?'],
        explanation: 'The invariant failure appears only when a group has more than three members - exactly where "take all" differs from "take three".',
      },
      {
        id: 'l06-p5',
        kind: 'single',
        concept: 'systematic-debugging',
        prompt: 'Run each candidate patch in the lab. Which one is a real fix?',
        options: CANDIDATES.map((c) => o(c.id, c.label, c.verdict)),
        correct: 'slice-merge-size',
        hints: ['A real fix passes every case AND every seed, including the group-of-five case.'],
        explanation: 'The suite is the judge - not how plausible the patch sounds.',
      },
    ],
  },
  assessment: {
    title: 'Debugging check',
    intro: 'Unseen questions about the same fixture family. No hints.',
    passMark: 0.75,
    items: [
      {
        id: 'l06-a1',
        kind: 'numeric',
        concept: 'systematic-debugging',
        prompt: 'In the case "cascade-into-four", by how much does the BUGGY code reduce the board\'s total value below what conservation requires?',
        answer: valueDestroyedInCascadeCase,
        unit: 'value units',
        diagnose: (v, e) => (v === 0 ? 'The first merge is correct; the loss happens in the cascade step. Compare totals after the whole drop.' : v < e ? 'One of the lost pieces is rank 2 (worth 9), not rank 1.' : null),
        explanation: 'One rank-2 piece (3² = 9) disappears in the cascade.',
      },
      {
        id: 'l06-a2',
        kind: 'classify',
        concept: 'systematic-debugging',
        prompt: 'Which invariant does each observation violate?',
        categories: [
          { id: 'value', label: 'Value conservation' },
          { id: 'stability', label: 'Stability' },
          { id: 'size', label: 'Merge size' },
          { id: 'bounds', label: 'Rank bounds' },
          { id: 'none', label: 'No violation' },
        ],
        entries: [
          { id: 'o1', text: 'Total board value after a drop is 9 lower than before + dropped piece', correct: 'value', why: 'Value was destroyed.' },
          { id: 'o2', text: 'After resolution, three rank-2 pieces still touch', correct: 'stability', why: 'They should have merged.' },
          { id: 'o3', text: 'A merge step logged four consumed pieces', correct: 'size', why: 'Exactly three are allowed.' },
          { id: 'o4', text: 'A cell contains rank 9 while MAX_RANK is 6', correct: 'bounds', why: 'A rank above MAX_RANK violates the rank-bounds invariant.' },
          { id: 'o5', text: 'Two different seeds produce different final scores', correct: 'none', why: 'Different seeds are expected to differ; that is not a violation.' },
        ],
        explanation: 'Naming the violated invariant is the shortest path to the cause.',
      },
      {
        id: 'l06-a3',
        kind: 'order',
        concept: 'systematic-debugging',
        prompt: 'Order a disciplined investigation.',
        steps: [
          { id: 'd1', text: 'State the invariant that is violated' },
          { id: 'd2', text: 'Find a seed or board that reproduces it, then minimize it' },
          { id: 'd3', text: 'Locate the code that decides the violating behaviour' },
          { id: 'd4', text: 'Make the smallest change that makes the code state the rule' },
          { id: 'd5', text: 'Run the full suite and the seeded scan, including edge cases' },
          { id: 'd6', text: 'Add the reproduction as a permanent regression test' },
        ],
        explanation: 'Evidence before edits; verification before "done".',
      },
      {
        id: 'l06-a4',
        kind: 'single',
        concept: 'systematic-debugging',
        prompt: 'A teammate proposes crediting the lost value to the score so players stop complaining. Why is that not a fix?',
        options: [
          o('a', 'It changes the score formula, and score rules are not ours to change in a bug fix', 'The proposal does touch the score, but changing a score is not the objection; the board\'s behaviour is.'),
          o('b', 'The board still destroys pieces; only the visible symptom changes', 'Correct: the board still destroys pieces. Crediting the score hides the symptom and leaves the defect.'),
          o('c', 'Scores should never be adjusted after release, whatever the reason or the bug', 'Scores change legitimately when rules change. That is not why this proposal fails.'),
          o('d', 'It is too slow to ship before the next release', 'Speed is irrelevant to whether the change repairs the defect.'),
        ],
        correct: 'b',
        explanation: 'A symptom patch leaves the invariant violated.',
      },
      {
        id: 'l06-a5',
        kind: 'keywords',
        concept: 'systematic-debugging',
        prompt: 'In one sentence, state the invariant that the buggy resolver violates.',
        groups: [
          { label: 'Value / total / sum', anyOf: ['value', 'total', 'sum', 'worth'] },
          { label: 'Conserved / unchanged / preserved by merges', anyOf: ['conserv', 'preserv', 'unchanged', 'same', 'equal', 'never lost', 'not lost', 'not destroy', 'no value'] },
        ],
        placeholder: 'A drop adds … and merges …',
        explanation: 'Reference: total board value is conserved by merges - after a drop it equals the previous value plus the dropped piece\'s value.',
      },
      {
        id: 'l06-a6',
        kind: 'single',
        concept: 'systematic-debugging',
        prompt: 'Which fixture case best exposes the "special-case groups of exactly four" patch?',
        options: [
          o('a', 'isolated-drop', 'No group forms in this case, so the special-case patch for groups of four is never exercised.'),
          o('b', 'group-of-five-row', 'Correct: five connected pieces, so the special case does not apply and the bug returns.'),
          o('c', 'simple-triple', 'Exactly three - passes regardless.'),
          o('d', 'occupied-cell', 'This case tests rejection of an invalid drop, which is input validation and not group size.'),
        ],
        correct: 'b',
        explanation: 'Test the neighbour of the reported case.',
      },
    ],
  },
  failureModes: [
    'Debugging from the symptom ("score is wrong") instead of an invariant.',
    'Fixing the reported case and shipping the neighbouring one.',
    'Declaring victory without running the full suite and edge cases.',
    'Editing the tests to match the new behaviour.',
  ],
  application: {
    title: 'Take it to One More Merge',
    body: 'Write down 2-3 conservation or stability rules in your real merge code (value, piece count after known operations, no stable group of 3+). Turn one into a seeded property test. Practical takeaway: a bug report becomes a failing invariant check before it becomes a fix.',
    fieldPrompt: 'Log it under Growth → Field evidence when you add an invariant-based test to a real project, or fix a real bug with this order of work.',
  },
  reviewItems: [
    {
      id: 'l06-r1',
      kind: 'single',
      concept: 'systematic-debugging',
      prompt: 'Merging three rank-2 pieces (worth 9 each) yields one rank-3 piece. What is it worth?',
      options: [o('a', '27', 'Correct: 3 × 9 = 27 = 3^3, so merging conserves value.'), o('b', '18', 'That is two pieces.'), o('c', '9', 'The old value of one piece.'), o('d', '81', 'That is rank 4.')],
      correct: 'a',
      explanation: '3 × 9 = 27 = 3³: conserved.',
    },
    {
      id: 'l06-r2',
      kind: 'single',
      concept: 'systematic-debugging',
      prompt: 'Why keep edge cases (max rank, occupied cell) in the suite when fixing the merge bug?',
      options: [o('a', 'So the fix cannot pass by breaking an unrelated rule', 'Correct: a fix must not trade one defect for another.'), o('b', 'To make the test suite longer, so that it looks more complete to anyone who reads the results', 'Suite length is not a goal; coverage of the rules is.'), o('c', 'Because vitest requires every suite that covers game rules to include a max-rank and occupied-cell case', 'vitest has no such requirement.'), o('d', 'Because edge cases run faster than ordinary cases', 'Edge cases do not speed anything up; they protect correctness.')],
      correct: 'a',
      explanation: 'A fix must not trade one defect for another.',
    },
    {
      id: 'l06-r3',
      kind: 'multi',
      concept: 'systematic-debugging',
      prompt: 'Select the symptom-masking patches.',
      options: [o('a', 'Credit the lost value to the score', 'Hides the visible symptom.'), o('b', 'Consume exactly three cells per merge', 'This is the root-cause fix, so it is not symptom masking.'), o('c', 'Respawn lost pieces in empty cells', 'Hides the loss by inventing pieces.'), o('d', 'Special-case groups of exactly four', 'Fits the report, not the cause.')],
      correct: ['a', 'c', 'd'],
      explanation: 'Only the change that makes the code state the rule is a fix.',
    },
  ],
  sources: [],
};

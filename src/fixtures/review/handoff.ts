/**
 * EDUCATIONAL FIXTURE - a fabricated multi-agent handoff written for Claude Forge.
 * No real repository, PR or agent output is represented. The defects are seeded
 * so that a checklist can be graded deterministically.
 */

export const HANDOFF_ID = 'RB-17';

export const BUILDER_SUMMARY = `**Handoff ${HANDOFF_ID} - chain bonus + resolveBoard allocation cleanup** *(fictional)*

Adds a chain bonus (+10% per chain step) and removes per-step allocations in \`resolveBoard\`.

**Builder claims**
1. All tests pass.
2. Board resolution is ~40% faster.
3. Behaviour stays deterministic - all rolls are seeded.
4. The change only touches chain scoring.

Files changed: \`src/core/boardRules.ts\`, \`src/core/scoring.ts\`, \`balance/economy.json\`, \`tests/chain.test.ts\`, \`src/ui/ComboBanner.ts\`.`;

export const REVIEWER_NOTE = `**Reviewer R1 - verdict: Approved**

Read \`scoring.ts\` and \`ComboBanner.ts\`. Logic is clear. Nit: banner string could use a constant.

*(Review log: 2 of 5 changed files opened. \`boardRules.ts\` and the test file were not opened. CI link not checked.)*`;

export const INTEGRATOR_CONTEXT = `**CI on the branch**
- typecheck: passed
- unit tests: 212 passed, 0 failed, **2 skipped**
- determinism simulation (200 seeds): **not run** (manual trigger)
- benchmark job: **not configured**

**State of main**
- Branch base is 3 commits behind \`main\`.
- One of those commits, \`fix(gravity): resolveBoard column compaction\` by another Builder, edits \`src/core/boardRules.ts\` lines 38-60 - the same function this branch rewrites.`;

export const DIFF_FILENAME = 'handoff-RB-17.diff';
export const DIFF_LINES: string[] = [
  'diff --git a/src/core/boardRules.ts b/src/core/boardRules.ts',
  '@@ -41,18 +41,27 @@ export function resolveBoard(board: Board, rng: Rng): Resolution {',
  '-  const groups = findGroups(board);',
  '+  // perf: reuse scratch buffers instead of allocating per cascade step',
  '+  const groups = findGroupsInto(scratch, board);',
  '   for (const g of groups) {',
  '     applyMerge(board, g);',
  '+    chainCount += 1;',
  '   }',
  '+  // chain bonus: +10% per step, with a small chance of a free extra step',
  '+  const bonus = chainCount * 0.1 + (Math.random() < 0.1 ? 0.5 : 0);',
  '+  return { board, chainCount, bonus };',
  'diff --git a/src/core/scoring.ts b/src/core/scoring.ts',
  '@@ -12,6 +12,7 @@ export function scoreResolution(res: Resolution): number {',
  '-  return res.base;',
  '+  return Math.round(res.base * (1 + res.bonus));',
  'diff --git a/balance/economy.json b/balance/economy.json',
  '-  "chainRewardShards": 12,',
  '+  "chainRewardShards": 18,',
  'diff --git a/tests/chain.test.ts b/tests/chain.test.ts',
  "-  it('awards no bonus below 2 chain steps', () => {",
  "+  it.skip('awards no bonus below 2 chain steps', () => {",
  "-  it('bonus is deterministic for a fixed seed', () => {",
  "+  it.skip('bonus is deterministic for a fixed seed', () => {",
  'diff --git a/src/ui/ComboBanner.ts b/src/ui/ComboBanner.ts',
  '-  const label = `x${chain}`;',
  '+  const label = `Combo x${chain}`;',
];

export interface SeededIssue {
  id: string;
  text: string;
  severity: 'critical' | 'major' | 'minor';
  /** Which Builder claim this contradicts, if any. */
  contradictsClaim: number | null;
  /** Strings that must appear in the fixture text as evidence (verified by a unit test). */
  evidence: { source: 'diff' | 'ci' | 'reviewer' | 'summary'; contains: string }[];
  why: string;
}

export const SEEDED_ISSUES: SeededIssue[] = [
  {
    id: 'tests-skipped',
    text: 'Two chain tests were skipped, so "all tests pass" is not evidence of correctness',
    severity: 'critical',
    contradictsClaim: 1,
    evidence: [
      { source: 'diff', contains: 'it.skip(\'awards no bonus' },
      { source: 'ci', contains: '2 skipped' },
    ],
    why: 'A suite that passes because the relevant tests were disabled proves nothing. The skipped tests are exactly the ones covering the new behaviour.',
  },
  {
    id: 'nondeterministic-roll',
    text: 'The chain bonus uses Math.random(), breaking seeded determinism',
    severity: 'critical',
    contradictsClaim: 3,
    evidence: [{ source: 'diff', contains: 'Math.random()' }],
    why: 'Deterministic simulations (and replay/balance tooling) depend on every roll going through the seeded RNG. The determinism test that would have caught this is one of the skipped tests.',
  },
  {
    id: 'shared-file-conflict',
    text: 'boardRules.ts was also changed on main; the branch is stale and will conflict (textually and semantically)',
    severity: 'critical',
    contradictsClaim: 4,
    evidence: [{ source: 'ci', contains: '3 commits behind' }],
    why: 'Two Builders edited the same function. Approval and CI results on a stale base say nothing about the merged result; the Integrator must require a rebase and a re-run.',
  },
  {
    id: 'perf-unverified',
    text: 'The "~40% faster" claim has no benchmark behind it',
    severity: 'major',
    contradictsClaim: 2,
    evidence: [
      { source: 'ci', contains: 'benchmark job: **not configured**' },
      { source: 'summary', contains: '~40% faster' },
    ],
    why: 'No method, baseline or numbers were provided and no benchmark exists in CI. Either measure it or delete the claim.',
  },
  {
    id: 'review-scope-gap',
    text: 'The Reviewer opened 2 of 5 files and never looked at the core rules file or the tests',
    severity: 'major',
    contradictsClaim: null,
    evidence: [{ source: 'reviewer', contains: '2 of 5 changed files opened' }],
    why: 'An approval only covers what was reviewed. The highest-risk file was outside the review, so this approval cannot gate a merge of core rules.',
  },
  {
    id: 'balance-without-sim',
    text: 'chainRewardShards changed 12 → 18 (+50%) with no economy simulation re-run',
    severity: 'major',
    contradictsClaim: 4,
    evidence: [{ source: 'diff', contains: '"chainRewardShards": 18' }],
    why: 'Balance constants feed the economy. A 50% reward change needs the simulation re-run (and the result attached) before it ships.',
  },
  {
    id: 'scope-creep-ui',
    text: 'ComboBanner copy was changed but is not mentioned in the summary',
    severity: 'minor',
    contradictsClaim: 4,
    evidence: [{ source: 'diff', contains: 'Combo x${chain}' }],
    why: 'Harmless on its own, but unreported changes make a summary unreliable as a map of the diff.',
  },
];

export const DISTRACTOR_ISSUES: { id: string; text: string; why: string }[] = [
  { id: 'd-long-function', text: 'resolveBoard is longer than 40 lines', why: 'Style only, and the handoff shows no evidence of it. It would not change a merge decision.' },
  { id: 'd-ticket', text: 'The commit message does not reference a ticket number', why: 'Process nit with no correctness or safety impact for this decision.' },
  { id: 'd-increment', text: '`chainCount += 1` should be written `chainCount++`', why: 'Pure preference; equivalent behaviour.' },
  { id: 'd-jsdoc', text: 'New functions lack JSDoc comments', why: 'Not a gate for this change; it would not alter the verdict.' },
];

export const GATES: { id: string; text: string; required: boolean; why: string }[] = [
  { id: 'g-typecheck', text: 'Typecheck passes on the rebased branch', required: true, why: 'Cheap, mandatory on every merge - and it must be the rebased result, not the stale branch.' },
  { id: 'g-no-skips', text: 'Full unit suite passes with zero skipped or deleted tests', required: true, why: 'Skipped tests are unverified behaviour. The gate is "no skips introduced", not just "green".' },
  { id: 'g-regression-test', text: 'A seeded regression test covers the chain bonus', required: true, why: 'New behaviour needs a test that would fail if the roll became random again.' },
  { id: 'g-determinism-sim', text: 'Determinism simulation (200 seeds) re-run after the rebase', required: true, why: 'Core rules changed; the project\'s own invariant is reproducible simulation.' },
  { id: 'g-rebase', text: 'Rebase on current main, resolve the boardRules.ts conflict, then re-run every gate', required: true, why: 'Evidence gathered on a stale base does not transfer to the merged code.' },
  { id: 'g-independent-review', text: 'Independent reviewer approval covering ALL changed core files', required: true, why: 'Approval scope must match change scope.' },
  { id: 'g-economy-sim', text: 'Economy simulation re-run for the reward constant change', required: true, why: 'A +50% reward constant is a balance change; the simulation is the evidence.' },
  { id: 'g-perf-or-retract', text: 'Benchmark with before/after numbers, or remove the performance claim', required: true, why: 'Claims need evidence or need to go.' },
  { id: 'g-playtest-all', text: 'Manual playtest of all six worlds', required: false, why: 'Disproportionate for this change; automated determinism and economy gates cover the risk.' },
  { id: 'g-license', text: 'Dependency and license audit', required: false, why: 'No dependencies changed.' },
  { id: 'g-bundle', text: 'Bundle-size analysis', required: false, why: 'No new dependencies or assets.' },
  { id: 'g-art', text: 'Art direction review', required: false, why: 'No art assets changed.' },
];

export const INTEGRATION_STEPS: { id: string; text: string; why: string }[] = [
  { id: 's-return', text: 'Return to the Builder: un-skip the tests, replace Math.random with the seeded RNG, retract or prove the perf claim', why: 'Fix the cause before spending anyone\'s review time on a branch with known defects.' },
  { id: 's-rebase', text: 'Builder rebases on current main and resolves the boardRules.ts conflict', why: 'Everything after this must run on the merged shape of the code.' },
  { id: 's-rerun', text: 'Re-run typecheck, full tests (no skips), determinism simulation and economy simulation', why: 'Evidence must come from the rebased branch.' },
  { id: 's-review', text: 'Independent Reviewer reviews the full diff, including boardRules.ts, against the re-run results', why: 'Review is most valuable when the evidence already exists and the defects above are gone.' },
  { id: 's-merge', text: 'Integrator merges only when every required gate is green and records the evidence in the merge note', why: 'The Integrator owns the merge decision, not the Builder or Reviewer.' },
  { id: 's-smoke', text: 'Post-merge smoke check on main', why: 'Last line of defence against integration surprises.' },
];

export const VERDICTS: { id: string; text: string; correct: boolean; why: string }[] = [
  { id: 'v-block', text: 'Do not merge: return to the Builder with the required changes, then re-run all gates', correct: true, why: 'Three critical issues and a review that did not cover the core file.' },
  { id: 'v-merge-followup', text: 'Merge now and file follow-up tickets for each of the problems the Reviewer and the gates found', correct: false, why: 'Merging known nondeterminism and disabled tests into core rules trades a cheap fix now for an expensive investigation later.' },
  { id: 'v-trust-review', text: 'Merge: the Reviewer approved the change and CI is green, so the gates have been passed', correct: false, why: 'The approval did not cover the core file and "green" includes two skipped tests on a stale base.' },
  { id: 'v-nits', text: 'Approve with nits: only the banner copy needs to change before the merge goes ahead', correct: false, why: 'Misses every critical issue; the nit is the least important finding.' },
];

export function evidenceText(source: 'diff' | 'ci' | 'reviewer' | 'summary'): string {
  switch (source) {
    case 'diff':
      return DIFF_LINES.join('\n');
    case 'ci':
      return INTEGRATOR_CONTEXT;
    case 'reviewer':
      return REVIEWER_NOTE;
    case 'summary':
      return BUILDER_SUMMARY;
  }
}

/** Lines in DIFF_LINES (1-based) that carry a seeded problem. Derived, not duplicated, so tests keep them honest. */
export const DIFF_TARGETS: { line: number; severity: 'critical' | 'major' | 'minor'; why: string }[] = [
  { line: 1, severity: 'major', why: 'boardRules.ts is a shared core file that main also changed - expect a conflict.' },
  { line: 11, severity: 'critical', why: 'Math.random() inside core rules breaks seeded determinism.' },
  { line: 19, severity: 'major', why: 'Reward constant +50% with no economy simulation evidence.' },
  { line: 22, severity: 'critical', why: 'it.skip disables a test that covers the new bonus rule.' },
  { line: 24, severity: 'critical', why: 'it.skip disables the determinism test - the one that would have caught line 11.' },
];

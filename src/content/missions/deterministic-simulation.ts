import { SkillContentSchema, type SkillContent } from '@/domain/skills/model';
import type { LoopMission, MissionCase } from '@/domain/loop/types';
import { DET_CHECKLIST, DEV_CHANGES, HELDOUT_CHANGES, POLICY_MD, VERDICT_FORMAT, taskPrompt, truthFor, type Change } from '@/fixtures/determinism/mission';
import { newId } from '@/lib/ids';

const toCase = (c: Change): MissionCase => ({
  id: c.id,
  title: c.title,
  change: `${c.change}\n\n\`\`\`diff\n${c.diff}\n\`\`\``,
  rationale: c.rationale,
  prompt: taskPrompt(c),
});

function starter(): SkillContent {
  return SkillContentSchema.parse({
    name: 'deterministic-simulation-reviewer',
    description: 'Reviews game simulation code changes. Use for questions about game logic, replays, randomness and bugs in Phaser or other web games.',
    instructions: `# Deterministic simulation reviewer

1. Read the proposed change and the simulation code.
2. Think about whether the change could affect replays or randomness.
3. Say whether the change looks safe.
4. Recommend approve, revise or reject, and explain why.

The review policy and vocabulary are in [the determinism reference](references/determinism.md).`,
    useCases: ['A teammate proposes a change to simulation, spawn or merge logic', 'Replays or tests that used to match start to differ'],
    nonUseCases: ['Art, UI or copy changes'],
    references: [
      {
        path: 'references/determinism.md',
        content: `# Determinism vocabulary

- **Deterministic**: the same seed and the same moves always produce the same trace.
- **Trace**: the ordered list of events a run produces. A hash makes two traces easy to compare.
- **Golden trace**: the reviewed reference trace that tests compare against.
- **Sources of nondeterminism**: the wall clock, the global random generator, and the order in which independent inputs arrive.
`,
      },
    ],
    scenarios: [
      { id: newId('sc'), prompt: 'Review this change to how bonus pieces spawn.', expected: 'activate', note: 'Core use' },
      { id: newId('sc'), prompt: 'Our replay tests started failing after yesterday\'s merge. Could the new tie-break code be the cause?', expected: 'activate', note: 'Symptom-led' },
      { id: newId('sc'), prompt: 'Is it OK to cache neighbour lookups in the flood fill?', expected: 'activate', note: 'Paraphrase without the word "deterministic"' },
      { id: newId('sc'), prompt: 'Make the title screen buttons bigger.', expected: 'not-activate', note: 'UI work' },
      { id: newId('sc'), prompt: 'Why is the battle scene slow on phones?', expected: 'not-activate', note: 'Performance, a near-miss' },
      { id: newId('sc'), prompt: 'Review this change to the upgrade cost curve.', expected: 'not-activate', note: 'Economy review' },
      { id: newId('sc'), prompt: 'Does the game feel fair?', expected: 'ambiguous', note: 'Decide whether vague fairness questions should trigger the reviewer' },
    ],
  });
}

export const DETERMINISTIC_SIMULATION_MISSION: LoopMission = {
  id: 'deterministic-simulation-reviewer',
  version: 1,
  title: 'Deterministic Merge Simulation Reviewer',
  tagline: 'Build a Skill that decides whether a change keeps a seeded simulation reproducible - from evidence, not from how the diff reads.',
  problem: `A match-three style game lives or dies by its replays and tests: the same seed and the same moves must give the same board. Every few weeks someone proposes a harmless-looking tweak - "use Math.random for spawns so they feel organic", "apply inputs in arrival order, sorting is wasteful", "break ties with the clock to feel fair".

Some of those quietly destroy reproducibility. Some are fine (a refactor, a cache). Some are deterministic but **change the trace** and silently invalidate every golden file. Asking Claude "is this safe?" gets a fluent answer, but whether it **runs** the harness, spots the exact source of nondeterminism, and separates *non-deterministic* from *deterministic-but-changed* varies from run to run.

**What is inefficient:** a reviewer that reads the diff and sounds confident, instead of one that demands the same evidence every time.`,
  whyItMatters: 'Nondeterminism bugs are the hardest to find later: a flaky replay, a desync, a golden test that fails one run in five. A reviewer Skill that always compares trace hashes across perturbed environments catches them at the diff, where they are cheap.',
  targetOutcome: 'A Skill that, on unseen changes, runs the determinism harness, compares the per-environment hashes with the golden hash, names the specific source of nondeterminism, and distinguishes "non-deterministic" (reject) from "deterministic but changes the trace" (revise) - more often than Claude without it.',
  skillConcept: 'A Skill as an *evidence gate with a decision table*: run the check, read the numbers, map them to one of three outcomes.',
  prerequisites: ['L05-first-custom-skill', 'L06-merge-chain-failure'],
  successCriteria: [
    'Your recorded verdicts match the harness ground truth more often than the baseline on the development changes',
    'The improvement holds on held-out changes that break determinism through mechanisms you did not tune against',
    'Checklist items (ran the harness, compared hashes, named the source, separated changed from nondeterministic) are met more consistently',
    'You can state what changed between v1 and v2 and why',
  ],
  designTargets: POLICY_MD,
  fixture: { devId: 'det-sim-dev', heldoutId: 'det-sim-heldout', devLabel: 'Deterministic Merge Simulation Reviewer - development changes', heldoutLabel: 'Deterministic Merge Simulation Reviewer - held-out changes' },
  devCases: DEV_CHANGES.map(toCase),
  heldoutCases: HELDOUT_CHANGES.map(toCase),
  checklist: [
    { ...DET_CHECKLIST[0], patternId: 'missing-verification', hint: 'Add a gate: "Run `npx tsx check.ts <change-id>` and read its output before recommending anything."' },
    { ...DET_CHECKLIST[1], patternId: 'missing-verification', hint: 'Require the answer to quote the four environment hashes and the golden hash, and say what their equality or difference means.' },
    { ...DET_CHECKLIST[2], patternId: 'weak-output-contract', hint: 'Define an output field: "Source of nondeterminism: <Math.random | clock | input order | none found>".' },
    { ...DET_CHECKLIST[3], patternId: 'weak-output-contract', hint: 'Give an explicit decision table: hashes differ → reject; hashes agree but differ from golden → revise; hashes agree and match golden → approve.' },
    { ...DET_CHECKLIST[4], patternId: 'missing-safety-gates', hint: 'Add a stop rule: never approve a trace change without a declared behaviour change and a regenerated golden trace.' },
  ],
  starter,
  starterNote: 'The starter is deliberately plain: a broad description, no evidence gate and no decision table. Those are hypotheses about what might go wrong - your recorded data decides what to change. Edit anything.',
  baselineHowTo: [
    'Download the development fixture pack and unzip it into a fresh, empty folder (outside any repository that has Skills installed).',
    'In that folder run `npm install`, then start Claude Code with `claude`.',
    'Run `/skills` and confirm no reviewer Skill is listed. This is the baseline: Claude without your Skill.',
    'For each change below, start a new conversation (a new session, or `/clear`), paste the task prompt exactly as given, and let Claude work.',
    "Copy Claude's final answer, read its `VERDICT:` line, and record the result here.",
  ],
  skillHowTo: [
    'Export your Skill as a ZIP from the Workshop (the Build step) and read the SKILL.md inside it.',
    'Extract the folder into `.claude/skills/` inside the SAME fixture folder, so only the Skill differs from the baseline.',
    'Start a new Claude Code session and run `/skills` to confirm the Skill is listed.',
    'Paste each task prompt unchanged. Do NOT mention the Skill: whether its description makes it activate is part of the test.',
    'Record the verdict, whether the Skill visibly activated, and the same measurements as the baseline.',
  ],
  evidenceHowTo: [
    '**Verdict**: the last `VERDICT:` line in Claude\'s answer. If there is none, record "no usable verdict" - that counts as not matching.',
    '**Checklist**: tick only what the answer actually contains. Read it against the five items; do not tick on impressions.',
    '**Rework rounds**: follow-up prompts you had to send because the answer was wrong or incomplete. Leave blank if you did not track it.',
    '**Interventions**: times you had to run a command or supply data Claude should have handled. Leave blank if you did not track it.',
    '**Runtime / tokens**: only if you actually measured them from a real report. Otherwise leave them blank - they stay unknown.',
    'Paste the final answer as evidence so the record can be audited later.',
  ],
  heldoutWhy:
    'You tuned the Skill against the development changes. Re-running them can overstate improvement: you may have shaped the Skill around their quirks, and you already know their answers. The held-out changes break (or preserve) determinism through different mechanisms and are scored against ground truth you have not seen. Forge keeps their truth hidden until every held-out run is recorded, then locks the runs.',
  transferPrompt:
    'Take the same procedure to One More Merge: write down the real determinism rule for your simulation (same seed + same moves = same trace), keep a golden trace in your tests, and have Claude review your next real change to spawn, merge or input handling with the Skill - and require it to attach the hash comparison. Keep the verdict-vs-harness record for your next three changes.',
  truth: (caseId) => truthFor(caseId),
  verdicts: [
    { value: 'approve', label: 'approve' },
    { value: 'revise', label: 'revise' },
    { value: 'reject', label: 'reject' },
  ],
  verdictFormat: VERDICT_FORMAT,
  labels: {
    truthSource: 'the determinism harness',
    truthShort: 'determinism harness',
    caseNoun: 'change',
    caseNounPlural: 'changes',
    answerNoun: 'verdict',
    truthLimitation: 'Ground truth comes from running one small fictional simulation under four perturbed environments (different Math.random streams, clocks and input arrival orders). It shows whether trace hashes agree in those environments; it does not prove determinism in every possible environment or in a real game.',
    fixtureBadge: 'Seeded merge-simulation fixture',
    estimate: '~40-90 min',
    packDescription: 'A self-contained folder: the seeded merge simulation, the code each change would produce, the perturbation harness, a README with the policy, and no answers.',
    howTruthWorks: 'Every change is run under four perturbed environments and its trace hashes are compared with each other and with the golden hash, so the right verdict does not depend on anyone\'s opinion. The verdict you record is your reading of Claude\'s answer; Forge compares it with the harness.',
  },
};

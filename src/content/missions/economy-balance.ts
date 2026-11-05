import { SkillContentSchema, type SkillContent } from '@/domain/skills/model';
import type { LoopMission, MissionCase } from '@/domain/loop/types';
import {
  DESIGN_TARGETS_MD,
  DEV_PROPOSALS,
  HELDOUT_PROPOSALS,
  ALL_PROPOSALS,
  REVIEW_CHECKLIST,
  taskPrompt,
  truthFor,
  type Proposal,
} from '@/fixtures/economy/mission';
import { newId } from '@/lib/ids';

const toCase = (p: Proposal): MissionCase => ({ id: p.id, title: p.title, change: p.change, rationale: p.rationale, prompt: taskPrompt(p) });

function starter(): SkillContent {
  return SkillContentSchema.parse({
    name: 'economy-balance-reviewer',
    description: 'Reviews game economy and balance changes. Use for questions about game balance, currencies, rewards, progression and difficulty tuning.',
    instructions: `# Economy balance reviewer

1. Read the proposed change and the economy configuration.
2. Think about how the change affects currency supply, sinks and progression pacing.
3. Say whether the change looks healthy for the game.
4. Recommend approve, revise or reject, and explain why.

Definitions of the main metrics are in [the metrics reference](references/metrics.md).`,
    useCases: ['A designer proposes changing a reward, cost or sink constant', 'Testers report progression feels too fast, too slow or too rich'],
    nonUseCases: ['Art, copy or UI changes'],
    references: [
      {
        path: 'references/metrics.md',
        content: `# Economy metrics

- **Supply**: currency entering the economy per stage.
- **Sinks**: what removes currency (upgrade purchases, repair tax).
- **Affordability** = supply ÷ price of the next upgrade. How many upgrades one stage of income buys.
- **Hoard ratio** = balance ÷ price of the next upgrade. How many upgrades are sitting unspent.
- **Gate**: a rule that limits how many upgrades can be bought at a stage, however much currency you hold.
`,
      },
    ],
    scenarios: [
      { id: newId('sc'), prompt: 'Review this proposed economy change: raise the base reward by 15%.', expected: 'activate', note: 'Core use' },
      { id: newId('sc'), prompt: 'Is it safe to change the upgrade cost growth from 1.15 to 1.12?', expected: 'activate', note: 'Paraphrase without the word "review"' },
      { id: newId('sc'), prompt: 'Players are hoarding shards late in the game. Should we add a bigger sink?', expected: 'activate', note: 'Symptom-led request' },
      { id: newId('sc'), prompt: 'Rename the shop screen buttons to be clearer.', expected: 'not-activate', note: 'UI work' },
      { id: newId('sc'), prompt: 'Suggest a new enemy type for the fire world.', expected: 'not-activate', note: 'Game design, but not an economy review: a near-miss' },
      { id: newId('sc'), prompt: 'Why does my Phaser sprite flicker on iOS?', expected: 'not-activate', note: '' },
      { id: newId('sc'), prompt: 'Does the early progression feel too fast?', expected: 'ambiguous', note: 'Decide whether vague feel questions should trigger the reviewer' },
    ],
  });
}

const devCases = DEV_PROPOSALS.map(toCase);
const heldoutCases = HELDOUT_PROPOSALS.map(toCase);

export const ECONOMY_BALANCE_MISSION: LoopMission = {
  id: 'economy-balance-reviewer',
  version: 1,
  title: 'Economy Balance Reviewer',
  tagline: 'Build a Skill that reviews economy changes, tells surplus from inflation, and demands simulation evidence.',
  problem: `A designer keeps proposing economy tweaks: "players are rich, cut rewards", "add a bigger sink", "make upgrades cheaper". Each proposal comes with a confident story. Asking Claude "is this OK?" gets a plausible-sounding answer — sometimes backed by a simulation run, sometimes by vibes.

Some of these changes are safe, some quietly decouple income from price and break pacing weeks later, and one looks scary only because stockpiles behind a **stage gate** are large (that is *surplus*, not *inflation*).

**What is inefficient:** the quality of the review depends on whether Claude happens to run the simulation, which ratio it looks at, and whether it notices the gate. That varies run to run.`,
  whyItMatters: 'Economy changes are where plausible-sounding AI advice does the most quiet damage. A reviewer Skill that forces the same evidence every time is worth more than any single clever answer — if, and only if, you can show it actually helps.',
  targetOutcome: 'A Skill that, on unseen proposals, runs the simulation, reasons from income-to-price ratios rather than raw balances, separates gate-bound surplus from runaway supply, and ends with a verdict that matches the simulation — more often than Claude without it.',
  skillConcept: 'A Skill as a *procedure with an evidence gate and an output contract* — not a pile of domain knowledge.',
  prerequisites: ['L05-first-custom-skill', 'L07-economy-inflation'],
  successCriteria: [
    'Your recorded verdicts match the simulation ground truth more often than the baseline on the development set',
    'The improvement holds on held-out proposals you did not tune against',
    'Evidence checklist items (ran the simulation, cited ratios, separated surplus from inflation) are met more consistently',
    'You can state what changed between v1 and v2 and why',
  ],
  designTargets: DESIGN_TARGETS_MD,
  fixture: { devId: 'economy-balance-review', heldoutId: 'economy-balance-heldout', devLabel: 'Economy Balance Reviewer - development proposals', heldoutLabel: 'Economy Balance Reviewer - held-out proposals' },
  devCases,
  heldoutCases,
  checklist: [
    { ...REVIEW_CHECKLIST[0], patternId: 'missing-verification', hint: 'Add a gate: "Do not recommend anything until you have run `npx tsx run.ts <proposal-id>` and read the output."' },
    { ...REVIEW_CHECKLIST[1], patternId: 'weak-output-contract', hint: 'State which metric decides the verdict (affordability by stage) and that raw balance alone is never evidence.' },
    { ...REVIEW_CHECKLIST[2], patternId: 'weak-output-contract', hint: 'Require a line that separates surplus held back by a gate from runaway supply, with the evidence for each.' },
    { ...REVIEW_CHECKLIST[3], patternId: 'missing-verification', hint: 'Require every number in the answer to be quoted from the simulation output, with its stage.' },
    { ...REVIEW_CHECKLIST[4], patternId: 'weak-output-contract', hint: 'Add a "Limits" section: synthetic data, one seed, one player policy.' },
  ],
  starter,
  starterNote: 'The starter is deliberately plain: a broad description, no evidence gate and no output contract. Those are hypotheses about what might go wrong - your recorded data decides what to change. Edit anything.',
  baselineHowTo: [
    'Download the development fixture pack and unzip it into a fresh, empty folder (outside any repository that has Skills installed).',
    'In that folder run `npm install`, then start Claude Code with `claude`.',
    'Run `/skills` and confirm no economy reviewer Skill is listed. This is the baseline: Claude without your Skill.',
    'For each case below, start a new conversation (a new session, or `/clear`), paste the task prompt exactly as given, and let Claude work.',
    'Copy Claude\'s final answer, read its `VERDICT:` line, and record the result here.',
  ],
  skillHowTo: [
    'Export your Skill as a ZIP from the Workshop (the Build step) and read the SKILL.md inside it.',
    'Extract the folder into `.claude/skills/` inside the SAME fixture folder, so only the Skill differs from the baseline.',
    'Start a new Claude Code session and run `/skills` to confirm the Skill is listed.',
    'Paste each task prompt unchanged. Do NOT mention the Skill: whether its description makes it activate is part of the test.',
    'Record the verdict, whether the Skill visibly activated, and the same measurements as the baseline.',
  ],
  evidenceHowTo: [
    '**Verdict**: the last `VERDICT:` line in Claude\'s answer. If there is none, record "unclear" - that counts as not matching.',
    '**Checklist**: tick only what the answer actually contains. Read it against the five items; do not tick on impressions.',
    '**Rework rounds**: how many follow-up prompts you had to send because the answer was wrong or incomplete. Leave blank if you did not track it.',
    '**Interventions**: times you had to run a command or supply data Claude should have handled. Leave blank if you did not track it.',
    '**Runtime / tokens**: only if you actually measured them from a real report. Otherwise leave them blank - they stay unknown.',
    'Paste the final answer as evidence so the record can be audited later.',
  ],
  heldoutWhy:
    'You tuned the Skill against the development proposals. Re-running those same proposals can overstate improvement for two reasons: you may have shaped the Skill around their quirks (overfitting), and you already know their ground truth. Held-out proposals use different levers and are scored against ground truth you have not seen. Forge keeps their truth hidden until you have recorded every held-out run, then locks the runs.',
  transferPrompt:
    'Take the same procedure to One More Merge: write down the real economy targets (for example the income-to-price band you want from stage N on), then have Claude review your next real balance change with the Skill - and require it to attach the simulation output. Keep the verdict-vs-simulation record for your next three changes.',
  truth: (caseId) => {
    const p = ALL_PROPOSALS.find((x) => x.id === caseId);
    return p ? truthFor(p) : undefined;
  },
  verdicts: [
    { value: 'approve', label: 'approve' },
    { value: 'revise', label: 'revise' },
    { value: 'reject', label: 'reject' },
  ],
  verdictFormat: 'VERDICT: approve | revise | reject',
  labels: {
    truthSource: 'the Shardfall economy simulation',
    truthShort: 'simulation',
    caseNoun: 'proposal',
    caseNounPlural: 'proposals',
    answerNoun: 'verdict',
    truthLimitation: 'Ground truth is defined by published design targets applied to a deterministic simulation of one synthetic economy, not by playtesting or live-game data.',
    fixtureBadge: 'Shardfall economy fixture',
    estimate: '~40-90 min',
    packDescription: 'A self-contained folder: the Shardfall economy, simulator, README with the design targets, and no answers.',
    howTruthWorks: "Every proposal is scored by the Shardfall economy simulator against these published design targets, so the right verdict does not depend on anyone's opinion. The verdict you record is your reading of Claude's answer; Forge compares it with the simulation.",
  },
};

import { SkillContentSchema, type SkillContent } from '@/domain/skills/model';
import type { LoopMission, MissionCase } from '@/domain/loop/types';
import { DEV_PACKETS, HELDOUT_PACKETS, INT_CHECKLIST, POLICY_MD, VERDICT_FORMAT, taskPrompt, truthFor } from '@/fixtures/integration/mission';
import type { Packet } from '@/fixtures/integration/packets';
import { newId } from '@/lib/ids';

const toCase = (p: Packet): MissionCase => ({
  id: p.id,
  title: p.title,
  change: `Handoff packet from ${p.agent}: branch \`${p.branch.name}\`, ${p.branch.changed.length} file(s) changed.`,
  rationale: `The Builder says: "${p.summary}"`,
  prompt: taskPrompt(p),
});

function starter(): SkillContent {
  return SkillContentSchema.parse({
    name: 'multi-agent-integration-auditor',
    description: 'Reviews merge readiness of agent-made changes. Use for questions about pull requests, merges, CI and code review in game projects.',
    instructions: `# Multi-agent integration auditor

1. Read the Builder's summary and the Reviewer's note.
2. Look at the CI log and the state of main.
3. Decide whether the change looks ready.
4. Recommend merge, revise or block, and explain why.

The vocabulary is in [the integration reference](references/integration.md).`,
    useCases: ['An agent-made branch is ready for a merge decision', 'A Builder says everything is green and asks the Integrator to merge'],
    nonUseCases: ['Writing the feature itself'],
    references: [
      {
        path: 'references/integration.md',
        content: `# Integration vocabulary

- **Builder**: the agent that wrote the change. **Reviewer**: a separate agent that checks it. **Integrator**: decides the merge.
- **Gate**: a check that must pass before merge (typecheck, unit tests, replay).
- **Stale base**: the branch was built on an older commit than main's head.
- **Claim**: something the Builder asserts; it needs evidence of the same kind.
`,
      },
    ],
    scenarios: [
      { id: newId('sc'), prompt: 'Builder-2 says its branch is green. Can I merge it?', expected: 'activate', note: 'Core use' },
      { id: newId('sc'), prompt: 'Two agents finished their branches - which should I merge first and is anything blocking?', expected: 'activate', note: 'Paraphrase' },
      { id: newId('sc'), prompt: 'The Reviewer approved but CI looks odd. Should I worry?', expected: 'activate', note: 'Symptom-led' },
      { id: newId('sc'), prompt: 'Write the HUD combo counter.', expected: 'not-activate', note: 'Feature work' },
      { id: newId('sc'), prompt: 'Explain how git rebase works.', expected: 'not-activate', note: 'A general git question: a near-miss' },
      { id: newId('sc'), prompt: 'Review this change to the upgrade cost curve.', expected: 'not-activate', note: 'Economy review' },
      { id: newId('sc'), prompt: 'Is the codebase healthy?', expected: 'ambiguous', note: 'Decide whether vague health questions should trigger the auditor' },
    ],
  });
}

export const INTEGRATION_AUDITOR_MISSION: LoopMission = {
  id: 'multi-agent-integration-auditor',
  version: 1,
  title: 'Multi-Agent Integration Auditor',
  tagline: 'Build a Skill that decides whether agent-made work may merge - by checking what actually ran, not what the Builder says.',
  problem: `You run Builder, Reviewer and Integrator agents. Each one hands you a confident summary: "all green", "reviewed, no concerns", "about 40% faster". The Integrator's job is to turn those claims into a merge decision.

The traps are well known and easy to miss: tests that were **skipped** rather than passed, a branch that is **green but built on an old base** that main has since changed, a performance claim with **no measurement**, a change to the simulation with **no replay gate**. And one false alarm: a branch that is behind main but touches nothing main changed.

**What is inefficient:** whether Claude checks the evidence behind each claim, instead of trusting the summaries, varies from run to run.`,
  whyItMatters: 'A bad merge costs far more than a careful audit: a stale-base conflict breaks main, an unmeasured "optimisation" ships a regression, a skipped test run hides a broken change. A Skill that makes the Integrator verify the same things every time is worth having - if you can show it helps.',
  targetOutcome: 'A Skill that, on unseen packets, lists each gate with its evidence, checks the tests actually ran, compares the base with main for overlapping files, matches each claim to evidence of the same kind, and ends with a merge decision that matches the policy - more often than Claude without it.',
  skillConcept: 'A Skill as a *checklist with evidence requirements and a decision table* for a role (Integrator), not a pile of git knowledge.',
  prerequisites: ['L05-first-custom-skill', 'L09-reviewer-vs-builder'],
  successCriteria: [
    'Your recorded decisions match the policy ground truth more often than the baseline on the development packets',
    'The improvement holds on held-out packets that exercise rules the development set never did, including a false alarm',
    'Checklist items (gates with evidence, tests actually ran, base vs main, claims vs evidence) are met more consistently',
    'You can state what changed between v1 and v2 and why',
  ],
  designTargets: POLICY_MD,
  fixture: { devId: 'integration-dev', heldoutId: 'integration-heldout', devLabel: 'Multi-Agent Integration Auditor - development packets', heldoutLabel: 'Multi-Agent Integration Auditor - held-out packets' },
  devCases: DEV_PACKETS.map(toCase),
  heldoutCases: HELDOUT_PACKETS.map(toCase),
  checklist: [
    { ...INT_CHECKLIST[0], patternId: 'missing-verification', hint: 'Require a table: each required gate, its status, and the line in the CI log that shows it.' },
    { ...INT_CHECKLIST[1], patternId: 'missing-verification', hint: 'Add: "A gate that reports zero tests run is NOT a pass. Quote the run count."' },
    { ...INT_CHECKLIST[2], patternId: 'missing-safety-gates', hint: 'Add a stop rule: compare the branch base with main and list files changed on both; behind-main alone is not a blocker.' },
    { ...INT_CHECKLIST[3], patternId: 'weak-output-contract', hint: 'Add an output section "Claims vs evidence": each Builder claim, the evidence found, and whether it is the right kind.' },
    { ...INT_CHECKLIST[4], patternId: 'weak-output-contract', hint: 'Require "Before merge:" with the minimal actions, or "none".' },
  ],
  starter,
  starterNote: 'The starter is deliberately plain: a broad description, no evidence requirements and no decision table. Those are hypotheses about what might go wrong - your recorded data decides what to change. Edit anything.',
  baselineHowTo: [
    'Download the development fixture pack and unzip it into a fresh, empty folder (outside any repository that has Skills installed).',
    'In that folder start Claude Code with `claude` (there is nothing to install: the packets are plain text files).',
    'Run `/skills` and confirm no integration Skill is listed. This is the baseline: Claude without your Skill.',
    'For each packet below, start a new conversation (a new session, or `/clear`), paste the task prompt exactly as given, and let Claude work.',
    "Copy Claude's final answer, read its `DECISION:` line, and record the result here.",
  ],
  skillHowTo: [
    'Export your Skill as a ZIP from the Workshop (the Build step) and read the SKILL.md inside it.',
    'Extract the folder into `.claude/skills/` inside the SAME fixture folder, so only the Skill differs from the baseline.',
    'Start a new Claude Code session and run `/skills` to confirm the Skill is listed.',
    'Paste each task prompt unchanged. Do NOT mention the Skill: whether its description makes it activate is part of the test.',
    'Record the decision, whether the Skill visibly activated, and the same measurements as the baseline.',
  ],
  evidenceHowTo: [
    '**Decision**: the last `DECISION:` line in Claude\'s answer. If there is none, record "no usable decision" - that counts as not matching.',
    '**Checklist**: tick only what the answer actually contains. Read it against the five items; do not tick on impressions.',
    '**Rework rounds**: follow-up prompts you had to send because the answer was wrong or incomplete. Leave blank if you did not track it.',
    '**Interventions**: times you had to supply data Claude should have found itself. Leave blank if you did not track it.',
    '**Runtime / tokens**: only if you actually measured them from a real report. Otherwise leave them blank - they stay unknown.',
    'Paste the final answer as evidence so the record can be audited later.',
  ],
  heldoutWhy:
    'You tuned the Skill against the development packets. Re-running them can overstate improvement: you may have shaped the Skill around their quirks, and you already know their answers. The held-out packets exercise rules the development set never did, including a false alarm (behind main, but safe), and are scored against ground truth you have not seen. Forge keeps their truth hidden until every held-out run is recorded, then locks the runs.',
  transferPrompt:
    'Take the same procedure to One More Merge: write your real merge policy down (which gates are required, when a stale base blocks, what a performance claim needs), give the Integrator agent the Skill, and keep a record of every decision it makes against what you would have decided - especially the ones where it blocked something you thought was fine.',
  truth: (caseId) => truthFor(caseId),
  verdicts: [
    { value: 'merge', label: 'merge' },
    { value: 'revise', label: 'revise' },
    { value: 'block', label: 'block' },
  ],
  verdictFormat: VERDICT_FORMAT,
  labels: {
    truthSource: 'the merge policy',
    truthShort: 'merge policy',
    caseNoun: 'packet',
    caseNounPlural: 'packets',
    answerNoun: 'decision',
    truthLimitation: 'Ground truth is a published merge policy applied to fabricated packets in a fictional repository. It tests whether the decision follows the evidence in the packet; real repositories are messier, and real CI and benchmark data would need real verification.',
    fixtureBadge: 'Fabricated handoff packets',
    estimate: '~40-90 min',
    packDescription: 'A self-contained folder: fabricated Builder/Reviewer/CI/main-state files for each packet, a README with the merge policy, and no answers.',
    howTruthWorks: 'Every packet is judged by the published merge policy applied to its facts (gates, base vs main, claims, findings), so the right decision does not depend on anyone\'s opinion. The decision you record is your reading of Claude\'s answer; Forge compares it with the policy.',
  },
};

import { SkillContentSchema, type SkillContent } from '@/domain/skills/model';
import type { LoopMission, MissionCase } from '@/domain/loop/types';
import { DEV_SCENES, HELDOUT_SCENES, PERF_CHECKLIST, ROOT_CAUSES, RULES_MD, VERDICT_FORMAT, taskPrompt, truthFor, type Scene } from '@/fixtures/perf/mission';
import { newId } from '@/lib/ids';

const toCase = (s: Scene): MissionCase => ({
  id: s.id,
  title: s.title,
  change: s.description,
  rationale: `Complaint: ${s.complaint}`,
  prompt: taskPrompt(s),
});

function starter(): SkillContent {
  return SkillContentSchema.parse({
    name: 'phaser-performance-investigator',
    description: 'Helps with game performance problems. Use for lag, stutter, FPS drops and optimisation in Phaser or other web games.',
    instructions: `# Phaser performance investigator

1. Read the complaint and the scene description.
2. Think about what is most likely slow: textures, physics, scripts or memory.
3. Suggest the optimisations that usually help.
4. State the root cause.

Definitions of the five subsystems are in [the subsystem reference](references/subsystems.md).`,
    useCases: ['A scene stutters, drops frames or slows down as content grows', 'A teammate blames textures, physics or memory without data'],
    nonUseCases: ['Gameplay bugs that are not about speed'],
    references: [
      {
        path: 'references/subsystems.md',
        content: `# Per-frame cost centres

- **allocation**: objects created during a frame (new Vector2, new Rectangle...). Pooling or reuse removes them.
- **collision**: candidate pairs tested. A naive loop is O(n^2); a spatial grid only tests nearby entities, if its cell size fits the world.
- **draw-calls**: one per texture or batch change. A packed atlas and texture-sorted drawing keep them low.
- **display-list**: display objects visited by the renderer. Containers with many children and no off-screen culling multiply it.
- **update-logic**: scripted work per unit per frame (AI, steering, path search).
`,
      },
    ],
    scenarios: [
      { id: newId('sc'), prompt: 'My Phaser game drops frames when there are lots of enemies. Why?', expected: 'activate', note: 'Core use' },
      { id: newId('sc'), prompt: 'The battle scene stutters but the menu is fine - where do I look first?', expected: 'activate', note: 'Symptom-led' },
      { id: newId('sc'), prompt: 'Should I compress my textures to fix lag?', expected: 'activate', note: 'Leading question - the Skill should still insist on measuring' },
      { id: newId('sc'), prompt: 'Add a new boss with a three-phase fight.', expected: 'not-activate', note: 'Feature work' },
      { id: newId('sc'), prompt: 'Why does the sprite flicker on iOS?', expected: 'not-activate', note: 'A rendering bug, not a performance one' },
      { id: newId('sc'), prompt: 'Review this change to the upgrade cost curve.', expected: 'not-activate', note: 'Economy review' },
      { id: newId('sc'), prompt: 'Is my game fast enough?', expected: 'ambiguous', note: 'Decide how the Skill should treat vague requests' },
    ],
  });
}

const devCases = DEV_SCENES.map(toCase);
const heldoutCases = HELDOUT_SCENES.map(toCase);

export const PHASER_PERFORMANCE_MISSION: LoopMission = {
  id: 'phaser-performance-investigator',
  version: 1,
  title: 'Phaser Performance Investigator',
  tagline: 'Build a Skill that makes Claude measure before it diagnoses - and never promises FPS it cannot know.',
  problem: `"The game is laggy." Every team has a theory: the textures are too big, the physics is too heavy, there is a memory leak. Ask Claude and you get a confident, plausible list of optimisations - usually the ones that are most commonly true, not the ones that are true **here**.

Performance work has a classic trap: fixing the loudest suspect instead of the biggest cost. A scene can have an alarming-looking allocation in \`create()\` that runs once, while a naive collision loop quietly does 130,000 pair tests every frame.

**What is inefficient:** whether Claude measures first, reads the evidence rather than the complaint, and avoids promising a speed-up it cannot know, varies from run to run.`,
  whyItMatters: 'Wrong performance work is expensive: weeks spent compressing textures while a loop is quadratic. A Skill that forces counting before diagnosing, and keeps "work units" separate from "FPS", saves that time - if you can show it works.',
  targetOutcome: 'A Skill that, on unseen scenes, runs the profiler, names the subsystem with the largest share of counted work (not the most suspicious-looking code), says plainly that counted work is not frame time, and proposes a fix aimed at the dominant cost.',
  skillConcept: 'A Skill as an *investigation procedure with an evidence gate*: measure, rank, then explain - and a hard rule against unsupported speed claims.',
  prerequisites: ['L05-first-custom-skill', 'L08-battle-lab'],
  successCriteria: [
    'Your recorded root causes match the cost-model ground truth more often than the baseline on the development scenes',
    'The improvement holds on held-out scenes with different bottlenecks',
    'Checklist items (ran the profiler, cited counts, separated work units from FPS) are met more consistently',
    'No answer promises an FPS figure the fixture cannot know',
  ],
  designTargets: RULES_MD,
  fixture: { devId: 'phaser-perf-dev', heldoutId: 'phaser-perf-heldout', devLabel: 'Phaser Performance Investigator - development scenes', heldoutLabel: 'Phaser Performance Investigator - held-out scenes' },
  devCases,
  heldoutCases,
  checklist: [
    { ...PERF_CHECKLIST[0], patternId: 'missing-verification', hint: 'Add a gate: "Run `npx tsx profile.ts <scene-id>` and read its output before naming any cause."' },
    { ...PERF_CHECKLIST[1], patternId: 'missing-verification', hint: 'Require the answer to quote the subsystem table: counted work and share for each of the five.' },
    { ...PERF_CHECKLIST[2], patternId: 'missing-safety-gates', hint: 'State a stop rule: the root cause is the largest share (at least half), whatever the complaint or code excerpt suggests.' },
    { ...PERF_CHECKLIST[3], patternId: 'missing-safety-gates', hint: 'Forbid FPS or millisecond claims; require a sentence that real-device profiling is needed before promising a speed-up.' },
    { ...PERF_CHECKLIST[4], patternId: 'weak-output-contract', hint: 'Define the output: ROOT CAUSE line, the evidence, the first fix, and the expected change in counted work.' },
  ],
  starter,
  starterNote: 'The starter is deliberately plain: a broad description, no evidence gate and no rule against speed promises. Those are hypotheses about what might go wrong - your recorded data decides what to change. Edit anything.',
  baselineHowTo: [
    'Download the development fixture pack and unzip it into a fresh, empty folder (outside any repository that has Skills installed).',
    'In that folder run `npm install`, then start Claude Code with `claude`.',
    'Run `/skills` and confirm no performance Skill is listed. This is the baseline: Claude without your Skill.',
    'For each scene below, start a new conversation (a new session, or `/clear`), paste the task prompt exactly as given, and let Claude work.',
    "Copy Claude's final answer, read its `ROOT CAUSE:` line, and record the result here.",
  ],
  skillHowTo: [
    'Export your Skill as a ZIP from the Workshop (the Build step) and read the SKILL.md inside it.',
    "Extract the folder into `.claude/skills/` inside the SAME fixture folder, so only the Skill differs from the baseline.",
    'Start a new Claude Code session and run `/skills` to confirm the Skill is listed.',
    'Paste each task prompt unchanged. Do NOT mention the Skill: whether its description makes it activate is part of the test.',
    'Record the root cause, whether the Skill visibly activated, and the same measurements as the baseline.',
  ],
  evidenceHowTo: [
    '**Root cause**: the last `ROOT CAUSE:` line in Claude\'s answer. If there is none, record "no usable root cause" - that counts as not matching.',
    '**Checklist**: tick only what the answer actually contains. Read it against the five items; do not tick on impressions. A promised FPS or millisecond figure means "units not FPS" is NOT met.',
    '**Rework rounds**: follow-up prompts you had to send because the answer was wrong or incomplete. Leave blank if you did not track it.',
    '**Interventions**: times you had to run a command or supply data Claude should have handled. Leave blank if you did not track it.',
    '**Runtime / tokens**: only if you actually measured them from a real report. Otherwise leave them blank - they stay unknown.',
    'Paste the final answer as evidence so the record can be audited later.',
  ],
  heldoutWhy:
    'You tuned the Skill against the development scenes. Re-running them can overstate improvement: you may have shaped the Skill around their quirks, and you already know their answers. The held-out scenes use different bottlenecks and are scored against ground truth you have not seen. Forge keeps their truth hidden until every held-out run is recorded, then locks the runs.',
  transferPrompt:
    'Take the same procedure to One More Merge: profile a real scene with the browser\'s performance tools on a real mid-range phone, record the real frame times yourself, and have Claude rank what the profile shows - then keep a record of whether its first suggestion paid off. Never quote the cost-model numbers as FPS.',
  truth: (caseId) => truthFor(caseId),
  verdicts: ROOT_CAUSES.map((r) => ({ value: r.value, label: r.label })),
  verdictFormat: VERDICT_FORMAT,
  labels: {
    truthSource: 'the Embergate cost-model profiler',
    truthShort: 'cost-model profiler',
    caseNoun: 'scene',
    caseNounPlural: 'scenes',
    answerNoun: 'root cause',
    truthLimitation: 'Ground truth comes from a published cost model that COUNTS per-frame work (objects, pairs, draw calls, visits, operations). It is not frame time, FPS or a measurement on any device; real performance claims need real profiling on real hardware.',
    fixtureBadge: 'Embergate cost-model fixture',
    estimate: '~40-90 min',
    packDescription: 'A self-contained folder: the Embergate cost-model profiler, the scenes (complaint, description, code excerpt), a README explaining the model, and no answers.',
    howTruthWorks: 'Every scene is scored by counting per-frame work with a published cost model - never by timing anything. A subsystem is the root cause when it accounts for at least half of the counted work; otherwise the answer is "mixed". The root cause you record is your reading of Claude\'s answer; Forge compares it with the profiler.',
  },
};

import JSZip from 'jszip';
import { sha256Hex } from '@/lib/hash';
import type { MetricId } from '@/domain/experiments/model';
import mergeBoard from './merge-cascade/board.ts?raw';
import mergeInvariants from './merge-cascade/invariants.ts?raw';
import mergeCases from './merge-cascade/cases.ts?raw';
import mergeRng from './merge-cascade/rng.ts?raw';
import econSim from './economy/sim.ts?raw';
import econRng from './economy/rng.ts?raw';
import perfProfiler from './perf/profiler.ts?raw';
import perfRng from './perf/rng.ts?raw';
import detSim from './determinism/sim.ts?raw';
import detRng from './determinism/rng.ts?raw';
import detHarness from './determinism/harness.ts?raw';
import detVariantsDev from './determinism/variants-dev.ts?raw';
import detVariantsHeld from './determinism/variants-heldout.ts?raw';
import { INT_CHECKLIST, packFiles as integrationFiles } from './integration/mission';
import { CHECK_RUN, DEV_CHANGES, HELDOUT_CHANGES, DET_CHECKLIST, POLICY_MD, changesJson } from './determinism/mission';
import { DEV_SCENES, HELDOUT_SCENES, PROFILE_RUN, RULES_MD as PERF_RULES_MD, PERF_CHECKLIST, scenesJson } from './perf/mission';
import { DESIGN_TARGETS_MD, DEV_PROPOSALS, HELDOUT_PROPOSALS, LIVE_CONFIG, REVIEW_CHECKLIST } from './economy/mission';
import {
  BUILDER_SUMMARY,
  DIFF_LINES,
  HANDOFF_ID,
  INTEGRATOR_CONTEXT,
  REVIEWER_NOTE,
  SEEDED_ISSUES,
} from './review/handoff';

export type FixtureId = 'merge-cascade' | 'economy-inflation' | 'review-handoff' | 'economy-balance-review' | 'economy-balance-heldout' | 'phaser-perf-dev' | 'phaser-perf-heldout' | 'det-sim-dev' | 'det-sim-heldout' | 'integration-dev' | 'integration-heldout';

export interface FixtureInfo {
  id: FixtureId;
  label: string;
  version: string;
  summary: string;
  /** Suggested task prompt (editable by the learner). */
  prompt: string;
  successCriteria: string[];
  suggestedMeasures: MetricId[];
  /** For checklist fixtures: the seeded items the learner ticks per run. */
  checklist: { id: string; text: string }[];
  checklistLabel: string;
  /** How objective results are obtained for this fixture. */
  objectiveHow: string;
}

export const FIXTURES: FixtureInfo[] = [
  {
    id: 'merge-cascade',
    label: 'Merge cascade bug (TypeScript)',
    version: '1',
    summary: 'A 5x5 merge-3 board loses pieces when a merge or cascade involves a group of four or more. Educational fixture - original code.',
    prompt: 'The tests in this folder fail. Find the root cause of the lost pieces in board.ts, explain which invariant is violated, and fix it with the smallest correct change. Run npm test and show the result.',
    successCriteria: ['All tests in the pack pass (npm test)', 'No test file was edited to make tests pass', 'Explanation names the violated invariant (value conservation)'],
    suggestedMeasures: ['testsPassedRatio', 'successRate', 'developerEffortMin'],
    checklist: [],
    checklistLabel: '',
    objectiveHow: 'Run `npm install && npm test` inside the exported pack and record the pass/fail counts - or upload the vitest JSON report (`npx vitest run --reporter=json --outputFile=report.json`).',
  },
  {
    id: 'economy-inflation',
    label: 'Economy inflation (simulation)',
    version: '1',
    summary: 'A fictional progression economy where reward power compounds faster than upgrade cost. Diagnose supply vs sinks vs gates vs pacing.',
    prompt: 'Run the simulation (npx tsx run.ts) and diagnose why late-game players accumulate currency far faster than upgrade costs grow. Distinguish supply, sinks, bottlenecks and pacing, identify the root cause, and propose the smallest fix. Do not claim that a big balance alone proves inflation.',
    successCriteria: ['Root cause identified with evidence from the output', 'Explicitly distinguishes gate-bound surplus from runaway supply', 'Proposed fix targets the cause, not just a symptom'],
    suggestedMeasures: ['seededIssuesFound', 'successRate', 'developerEffortMin'],
    checklist: [
      { id: 'root-cause-coupling', text: 'Names the compounding power/reward coupling vs upgrade cost growth as the root cause' },
      { id: 'uses-affordability', text: 'Uses affordability (income vs price) or an equivalent ratio as evidence' },
      { id: 'separates-gate', text: 'Separates gate-bound surplus (bottleneck) from runaway supply' },
      { id: 'fix-targets-cause', text: 'Proposes a fix that targets the coupling (e.g. linear power, lower coupling), not only sinks' },
      { id: 'no-early-game-blame', text: 'Does not blame the early game or the repair sink' },
    ],
    checklistLabel: 'Diagnosis checklist items found',
    objectiveHow: 'Tick which checklist items the output actually contains. This mapping is your judgement against a fixed checklist (self-reported).',
  },
  {
    id: 'review-handoff',
    label: 'Multi-agent review failure (handoff)',
    version: '1',
    summary: 'A fabricated Builder → Reviewer → Integrator handoff with seeded defects: skipped tests, nondeterminism, a stale shared-file base, an unverified performance claim.',
    prompt: 'Act as the Integrator. Read the handoff files. List every defect that should block the merge, say which validation gates are required, and give a verdict. Be specific and cite the evidence.',
    successCriteria: ['All critical seeded issues are found', 'Verdict is "do not merge yet"', 'Gates named match the evidence'],
    suggestedMeasures: ['seededIssuesFound', 'successRate', 'developerEffortMin'],
    checklist: SEEDED_ISSUES.map((i) => ({ id: i.id, text: i.text })),
    checklistLabel: 'Seeded issues found',
    objectiveHow: 'Tick which seeded issues the output identified. The checklist is fixed in the fixture; the mapping is your judgement (self-reported).',
  },
  {
    id: 'economy-balance-review',
    label: 'Economy Balance Reviewer - development proposals',
    version: '1',
    summary: 'Skill Improvement Loop mission: review four proposed changes to the live Shardfall economy. Ground truth is computed from the simulator.',
    prompt: 'See the per-case prompts in the Skill Improvement Loop (identical for every condition).',
    successCriteria: ['Recorded verdict matches the simulation ground truth', 'Checklist items are met', 'No unsupported numeric claims'],
    suggestedMeasures: ['successRate', 'seededIssuesFound', 'reworkRounds', 'interventions', 'runtimeSec'],
    checklist: REVIEW_CHECKLIST.map((c) => ({ id: c.id, text: c.text })),
    checklistLabel: 'Review-quality checklist items met',
    objectiveHow: 'Record the VERDICT line from each answer. Forge grades it against the simulation ground truth. Tick the checklist items the answer actually contains.',
  },
  {
    id: 'economy-balance-heldout',
    label: 'Economy Balance Reviewer - held-out proposals',
    version: '1',
    summary: 'Held-out proposals using levers the development set never touched. Ground truth stays hidden until every run is recorded.',
    prompt: 'See the per-case prompts in the Skill Improvement Loop (identical for every condition).',
    successCriteria: ['Recorded verdict matches the simulation ground truth'],
    suggestedMeasures: ['successRate', 'seededIssuesFound', 'reworkRounds', 'interventions'],
    checklist: REVIEW_CHECKLIST.map((c) => ({ id: c.id, text: c.text })),
    checklistLabel: 'Review-quality checklist items met',
    objectiveHow: 'Same procedure as the development set. Do not look at held-out ground truth until all runs are recorded.',
  },
  {
    id: 'phaser-perf-dev',
    label: 'Phaser Performance Investigator - development scenes',
    version: '1',
    summary: 'Skill Improvement Loop mission: four performance complaints in a fictional Embergate scene. Ground truth is computed by a published work-counting cost model - never FPS.',
    prompt: 'See the per-scene prompts in the Skill Improvement Loop (identical for every condition).',
    successCriteria: ['Recorded root cause matches the cost-model ground truth', 'Checklist items are met', 'No FPS or frame-time claim is made'],
    suggestedMeasures: ['successRate', 'seededIssuesFound', 'reworkRounds', 'interventions', 'runtimeSec'],
    checklist: PERF_CHECKLIST.map((c) => ({ id: c.id, text: c.text })),
    checklistLabel: 'Investigation checklist items met',
    objectiveHow: 'Record the ROOT CAUSE line from each answer. Forge grades it against the counted-work ground truth. Tick the checklist items the answer actually contains.',
  },
  {
    id: 'phaser-perf-heldout',
    label: 'Phaser Performance Investigator - held-out scenes',
    version: '1',
    summary: 'Held-out scenes with different bottlenecks than the development set. Ground truth stays hidden until every run is recorded.',
    prompt: 'See the per-scene prompts in the Skill Improvement Loop (identical for every condition).',
    successCriteria: ['Recorded root cause matches the cost-model ground truth'],
    suggestedMeasures: ['successRate', 'seededIssuesFound', 'reworkRounds', 'interventions'],
    checklist: PERF_CHECKLIST.map((c) => ({ id: c.id, text: c.text })),
    checklistLabel: 'Investigation checklist items met',
    objectiveHow: 'Same procedure as the development set. Do not look at held-out ground truth until all runs are recorded.',
  },
  {
    id: 'det-sim-dev',
    label: 'Deterministic Merge Simulation Reviewer - development changes',
    version: '1',
    summary: 'Skill Improvement Loop mission: four proposed changes to a seeded merge simulation. Ground truth is computed by running each change under perturbed environments and comparing trace hashes.',
    prompt: 'See the per-change prompts in the Skill Improvement Loop (identical for every condition).',
    successCriteria: ['Recorded verdict matches the harness ground truth', 'Checklist items are met', 'The named source of nondeterminism is specific'],
    suggestedMeasures: ['successRate', 'seededIssuesFound', 'reworkRounds', 'interventions', 'runtimeSec'],
    checklist: DET_CHECKLIST.map((c) => ({ id: c.id, text: c.text })),
    checklistLabel: 'Review-quality checklist items met',
    objectiveHow: 'Record the VERDICT line from each answer. Forge grades it against the harness ground truth. Tick the checklist items the answer actually contains.',
  },
  {
    id: 'det-sim-heldout',
    label: 'Deterministic Merge Simulation Reviewer - held-out changes',
    version: '1',
    summary: 'Held-out changes that break (or preserve) determinism through mechanisms the development set never showed. Ground truth stays hidden until every run is recorded.',
    prompt: 'See the per-change prompts in the Skill Improvement Loop (identical for every condition).',
    successCriteria: ['Recorded verdict matches the harness ground truth'],
    suggestedMeasures: ['successRate', 'seededIssuesFound', 'reworkRounds', 'interventions'],
    checklist: DET_CHECKLIST.map((c) => ({ id: c.id, text: c.text })),
    checklistLabel: 'Review-quality checklist items met',
    objectiveHow: 'Same procedure as the development set. Do not look at held-out ground truth until all runs are recorded.',
  },
  {
    id: 'integration-dev',
    label: 'Multi-Agent Integration Auditor - development packets',
    version: '1',
    summary: 'Skill Improvement Loop mission: four fabricated Builder/Reviewer handoff packets. Ground truth is the published merge policy applied to each packet.',
    prompt: 'See the per-packet prompts in the Skill Improvement Loop (identical for every condition).',
    successCriteria: ['Recorded decision matches the policy ground truth', 'Checklist items are met', 'Claims are matched to evidence'],
    suggestedMeasures: ['successRate', 'seededIssuesFound', 'reworkRounds', 'interventions', 'runtimeSec'],
    checklist: INT_CHECKLIST.map((c) => ({ id: c.id, text: c.text })),
    checklistLabel: 'Audit checklist items met',
    objectiveHow: 'Record the DECISION line from each answer. Forge grades it against the policy ground truth. Tick the checklist items the answer actually contains.',
  },
  {
    id: 'integration-heldout',
    label: 'Multi-Agent Integration Auditor - held-out packets',
    version: '1',
    summary: 'Held-out packets that exercise policy rules the development set never did, including a false alarm. Ground truth stays hidden until every run is recorded.',
    prompt: 'See the per-packet prompts in the Skill Improvement Loop (identical for every condition).',
    successCriteria: ['Recorded decision matches the policy ground truth'],
    suggestedMeasures: ['successRate', 'seededIssuesFound', 'reworkRounds', 'interventions'],
    checklist: INT_CHECKLIST.map((c) => ({ id: c.id, text: c.text })),
    checklistLabel: 'Audit checklist items met',
    objectiveHow: 'Same procedure as the development set. Do not look at held-out ground truth until all runs are recorded.',
  },
];

export function getFixture(id: string): FixtureInfo | undefined {
  return FIXTURES.find((f) => f.id === id);
}

const nl = (s: string) => s.replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');

const MERGE_TEST = `import { describe, expect, it } from 'vitest';
import { CASES, runCase, scanSeeds } from './cases';
import { dropPiece } from './board';

const resolver = (b: Parameters<typeof dropPiece>[0], at: Parameters<typeof dropPiece>[1], rank: number) => dropPiece(b, at, rank);

describe('merge cascade fixture', () => {
  for (const c of CASES) {
    it(c.title, () => {
      expect(runCase(resolver, c).failures).toEqual([]);
    });
  }
  it('seeded playthroughs never violate an invariant (seeds 1-40)', () => {
    const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(scanSeeds(resolver, seeds).map((v) => v.seed)).toEqual([]);
  });
});
`;

const ECON_RUN = `import { BUGGY_CONFIG, simulate } from './sim';

const rows = simulate(BUGGY_CONFIG);
const cols = ['stage', 'level', 'maxLevel', 'supply', 'repair', 'upgradeSpend', 'upgradesBought', 'balance', 'nextCost', 'affordability', 'hoardRatio', 'gated'] as const;
console.log(cols.join(','));
for (const r of rows) console.log(cols.map((c) => String(r[c])).join(','));
`;

const PKG = (name: string, scripts: Record<string, string>, dev: Record<string, string>) =>
  JSON.stringify({ name, private: true, type: 'module', scripts, devDependencies: dev }, null, 2) + '\n';

const READMES: Record<'merge-cascade' | 'economy-inflation' | 'review-handoff', string> = {
  'merge-cascade': `# Merge cascade fixture (educational)

Original code written for Claude Forge. Not from any production game.

- \`board.ts\` contains a seeded bug. The tests are expected to FAIL on the original files.
- Run: \`npm install\` then \`npm test\`.
- Record the pass/fail counts in the Battle Lab, or export a JSON report:
  \`npx vitest run --reporter=json --outputFile=report.json\` and upload it.
- Do not edit \`cases.ts\` or \`board.test.ts\` when solving; that would invalidate the comparison.
- \`MANIFEST.sha256\` lists each file's SHA-256. The fixture hash shown in Forge is the SHA-256 of MANIFEST.sha256 itself.
  PowerShell: \`Get-FileHash MANIFEST.sha256 -Algorithm SHA256\`
`,
  'economy-inflation': `# Economy inflation fixture (educational)

A fictional progression economy ("Shardfall"). All numbers are synthetic; this is not telemetry from any real game.

- Run: \`npm install\` then \`npx tsx run.ts\` to print one CSV row per stage.
- Task: diagnose why late-game affordability runs away. Separate supply, sinks, bottlenecks and pacing.
- \`MANIFEST.sha256\` lists each file's SHA-256. The fixture hash shown in Forge is the SHA-256 of MANIFEST.sha256 itself.
  PowerShell: \`Get-FileHash MANIFEST.sha256 -Algorithm SHA256\`
`,
  'review-handoff': `# Multi-agent handoff fixture (educational)

A fabricated Builder -> Reviewer -> Integrator handoff (${HANDOFF_ID}). No real repository or PR is represented.

Task: act as the Integrator. List the defects that should block the merge, the validation gates that are required, and your verdict.

\`MANIFEST.sha256\` lists each file's SHA-256. The fixture hash shown in Forge is the SHA-256 of MANIFEST.sha256 itself.
PowerShell: \`Get-FileHash MANIFEST.sha256 -Algorithm SHA256\`
`,
};

const MISSION_RUN = `import { readFileSync } from 'node:fs';
import { simulate } from './sim';
import { LIVE_CONFIG } from './live-config';

// Usage: npx tsx run.ts live            -> the current economy
//        npx tsx run.ts <proposal-id>   -> the economy with that proposal's patch applied
// Prints one CSV row per stage.
type Patch = Record<string, unknown> & { coupling?: { mode: 'linear' | 'compound'; k: number } };
const proposals = JSON.parse(readFileSync(new URL('./proposals.json', import.meta.url), 'utf8')) as { id: string; patch: Patch }[];
const id = process.argv[2];
if (!id) {
  console.error('Usage: npx tsx run.ts live | <proposal-id>   (ids: ' + proposals.map((p) => p.id).join(', ') + ')');
  process.exit(1);
}
const patch: Patch = id === 'live' ? {} : (proposals.find((p) => p.id === id)?.patch ?? (() => { console.error('Unknown proposal ' + id); process.exit(1); })());
const cfg = { ...LIVE_CONFIG, ...patch, coupling: patch.coupling ?? LIVE_CONFIG.coupling } as typeof LIVE_CONFIG;
const rows = simulate(cfg);
const cols = ['stage', 'level', 'maxLevel', 'supply', 'upgradeSpend', 'balance', 'nextCost', 'affordability', 'hoardRatio', 'gated'] as const;
console.log(cols.join(','));
for (const r of rows) console.log(cols.map((c) => String(r[c])).join(','));
`;

function missionReadme(phase: 'dev' | 'heldout'): string {
  return [
    `# Shardfall economy review fixture (${phase === 'dev' ? 'development set' : 'HELD-OUT set'})`,
    '',
    'A **fictional** training economy written for Claude Forge. All numbers are synthetic and deterministic. It is not telemetry from any real game.',
    '',
    'Task: review the proposed changes in `proposals.json` against the design targets below.',
    '',
    DESIGN_TARGETS_MD,
    '',
    'Files: `sim.ts` (simulator), `live-config.ts` (the current economy), `proposals.json` (the proposals), `run.ts` (CLI).',
    "`MANIFEST.sha256` lists each file's SHA-256. The fixture hash shown in Forge is the SHA-256 of MANIFEST.sha256 itself.",
    '',
  ].join('\n');
}

function missionFiles(phase: 'dev' | 'heldout'): { path: string; content: string }[] {
  const list = phase === 'dev' ? DEV_PROPOSALS : HELDOUT_PROPOSALS;
  return [
    { path: 'sim.ts', content: econSim },
    { path: 'rng.ts', content: econRng },
    { path: 'live-config.ts', content: "import type { EconomyConfig } from './sim';\n\nexport const LIVE_CONFIG: EconomyConfig = " + JSON.stringify(LIVE_CONFIG, null, 2) + ';\n' },
    { path: 'proposals.json', content: JSON.stringify(list.map(({ id, title, change, rationale, patch }) => ({ id, title, change, rationale, patch })), null, 2) + '\n' },
    { path: 'run.ts', content: MISSION_RUN },
    { path: 'package.json', content: PKG('forge-fixture-economy-review', { start: 'tsx run.ts live' }, { tsx: '^4.20.0', typescript: '^5.9.0' }) },
    { path: 'README.md', content: missionReadme(phase) },
  ];
}

function perfFiles(phase: 'dev' | 'heldout'): { path: string; content: string }[] {
  const list = phase === 'dev' ? DEV_SCENES : HELDOUT_SCENES;
  return [
    { path: 'profiler.ts', content: perfProfiler },
    { path: 'rng.ts', content: perfRng },
    { path: 'cases.json', content: scenesJson(list) },
    { path: 'profile.ts', content: PROFILE_RUN },
    { path: 'package.json', content: PKG('forge-fixture-phaser-perf', { start: 'tsx profile.ts' }, { tsx: '^4.20.0', typescript: '^5.9.0' }) },
    {
      path: 'README.md',
      content: [
        `# Embergate performance fixture (${phase === 'dev' ? 'development set' : 'HELD-OUT set'})`,
        '',
        'A **fictional** Phaser-style scene profiler written for Claude Forge. Everything here is synthetic and deterministic. It is not a real game and it measures no device.',
        '',
        'Task: for the scene you are given, decide which subsystem accounts for most of the per-frame work.',
        '',
        PERF_RULES_MD,
        '',
        'Files: `cases.json` (the scenes), `profiler.ts` (the cost model), `profile.ts` (CLI), `rng.ts`.',
        "`MANIFEST.sha256` lists each file's SHA-256. The fixture hash shown in Forge is the SHA-256 of MANIFEST.sha256 itself.",
        '',
      ].join('\n'),
    },
  ];
}

function detFiles(phase: 'dev' | 'heldout'): { path: string; content: string }[] {
  const list = phase === 'dev' ? DEV_CHANGES : HELDOUT_CHANGES;
  return [
    { path: 'sim.ts', content: detSim },
    { path: 'rng.ts', content: detRng },
    { path: 'harness.ts', content: detHarness },
    { path: 'variants.ts', content: phase === 'dev' ? detVariantsDev : detVariantsHeld },
    { path: 'cases.json', content: changesJson(list) },
    { path: 'check.ts', content: CHECK_RUN },
    { path: 'package.json', content: PKG('forge-fixture-determinism', { start: 'tsx check.ts' }, { tsx: '^4.20.0', typescript: '^5.9.0' }) },
    {
      path: 'README.md',
      content: [
        `# Merge simulation determinism fixture (${phase === 'dev' ? 'development set' : 'HELD-OUT set'})`,
        '',
        'A **fictional** seeded merge-board simulation written for Claude Forge. Everything is synthetic and deterministic by design; it is not from any real game.',
        '',
        'Task: review the proposed changes in `cases.json` against the policy below.',
        '',
        POLICY_MD,
        '',
        'Files: `sim.ts` (the simulation), `variants.ts` (the code each change would produce), `harness.ts` (the perturbation harness), `check.ts` (CLI), `cases.json`, `rng.ts`.',
        "`MANIFEST.sha256` lists each file's SHA-256. The fixture hash shown in Forge is the SHA-256 of MANIFEST.sha256 itself.",
        '',
      ].join('\n'),
    },
  ];
}

export async function fixtureFiles(id: FixtureId): Promise<{ path: string; content: string }[]> {
  let files: { path: string; content: string }[];
  switch (id) {
    case 'merge-cascade':
      files = [
        { path: 'board.ts', content: mergeBoard },
        { path: 'invariants.ts', content: mergeInvariants },
        { path: 'cases.ts', content: mergeCases },
        { path: 'rng.ts', content: mergeRng },
        { path: 'board.test.ts', content: MERGE_TEST },
        { path: 'package.json', content: PKG('forge-fixture-merge-cascade', { test: 'vitest run' }, { vitest: '^5.1.0', typescript: '^5.9.0' }) },
        { path: 'README.md', content: READMES[id] },
      ];
      break;
    case 'economy-inflation':
      files = [
        { path: 'sim.ts', content: econSim },
        { path: 'rng.ts', content: econRng },
        { path: 'run.ts', content: ECON_RUN },
        { path: 'package.json', content: PKG('forge-fixture-economy', { start: 'tsx run.ts' }, { tsx: '^4.20.0', typescript: '^5.9.0' }) },
        { path: 'README.md', content: READMES[id] },
      ];
      break;
    case 'economy-balance-review':
      files = missionFiles('dev');
      break;
    case 'economy-balance-heldout':
      files = missionFiles('heldout');
      break;
    case 'phaser-perf-dev':
      files = perfFiles('dev');
      break;
    case 'phaser-perf-heldout':
      files = perfFiles('heldout');
      break;
    case 'det-sim-dev':
      files = detFiles('dev');
      break;
    case 'det-sim-heldout':
      files = detFiles('heldout');
      break;
    case 'integration-dev':
      files = integrationFiles('dev');
      break;
    case 'integration-heldout':
      files = integrationFiles('heldout');
      break;
    case 'review-handoff':
      files = [
        { path: '01-builder-summary.md', content: BUILDER_SUMMARY },
        { path: '02-diff.patch', content: DIFF_LINES.join('\n') },
        { path: '03-reviewer-note.md', content: REVIEWER_NOTE },
        { path: '04-ci-and-main-state.md', content: INTEGRATOR_CONTEXT },
        { path: 'README.md', content: READMES[id] },
      ];
      break;
  }
  // Strip import aliases so packs are self-contained.
  return files.map((f) => ({ path: f.path, content: nl(f.content) })).sort((a, b) => a.path.localeCompare(b.path));
}

export async function fixtureManifest(id: FixtureId): Promise<string> {
  const files = await fixtureFiles(id);
  const lines: string[] = [];
  for (const f of files) lines.push(`${await sha256Hex(f.content)}  ${f.path}`);
  return lines.join('\n') + '\n';
}

export async function fixtureHash(id: FixtureId): Promise<string> {
  return sha256Hex(await fixtureManifest(id));
}

export async function buildFixturePack(id: FixtureId): Promise<{ blob: Blob; filename: string; manifest: string }> {
  const files = await fixtureFiles(id);
  const manifest = await fixtureManifest(id);
  const zip = new JSZip();
  const root = `forge-fixture-${id}`;
  const date = new Date(Date.UTC(2026, 0, 1));
  for (const f of files) zip.file(`${root}/${f.path}`, f.content, { date, createFolders: false });
  zip.file(`${root}/MANIFEST.sha256`, manifest, { date, createFolders: false });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, filename: `${root}.zip`, manifest };
}

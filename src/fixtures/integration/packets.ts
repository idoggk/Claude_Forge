/**
 * Multi-Agent Integration Auditor - packets.
 *
 * Each packet is a FABRICATED handoff in a fictional repository: a Builder's summary, a diff stat, a Reviewer's
 * note, a CI log and the state of main. Nothing here is from a real repository or CI run. Metrics are COUNTS of
 * operations (never FPS or wall-clock time).
 *
 * Ground truth is computed by `policy.ts` from the structured fields below. The pack contains only the rendered
 * text, never these fields, never the verdict.
 */
export type GateStatus = 'passed' | 'failed' | 'skipped';

export interface Packet {
  id: string;
  phase: 'dev' | 'heldout';
  title: string;
  agent: string;
  summary: string;
  branch: { name: string; builtOn: string; mainHead: string; changed: string[]; mainChangedSince: string[] };
  gates: {
    typecheck: GateStatus;
    tests: { status: GateStatus; ran: number; passed: number; skippedReason?: string };
    lint: { status: 'passed' | 'warnings' | 'failed'; warnings: number };
    /** Replay/determinism gate (required when `sim/` files change). */
    replay: 'passed' | 'failed' | 'not-reported';
  };
  claims: { text: string; kind: 'performance' | 'behaviour'; evidence: 'benchmark' | 'test-output' | 'none' }[];
  reviewer: { name: string; findings: { severity: 'blocking' | 'minor'; text: string; resolved: boolean }[]; note: string };
  userVisible: boolean;
  changelog: boolean;
  benchmark?: string;
}

const REPO = 'ember-merge (fictional)';

export const DEV_PACKETS: Packet[] = [
  {
    id: 'int-1', phase: 'dev', title: 'Show combo count on the HUD', agent: 'builder-2',
    summary: 'Adds a combo counter to the HUD. Touches only the HUD component and its test. Rebased on main this morning.',
    branch: { name: 'feat/combo-hud', builtOn: 'c7a21f0', mainHead: 'c7a21f0', changed: ['ui/hud.ts', 'ui/hud.test.ts', 'CHANGELOG.md'], mainChangedSince: [] },
    gates: { typecheck: 'passed', tests: { status: 'passed', ran: 214, passed: 214 }, lint: { status: 'passed', warnings: 0 }, replay: 'passed' },
    claims: [{ text: 'Adds a combo counter to the HUD.', kind: 'behaviour', evidence: 'test-output' }],
    reviewer: { name: 'reviewer-1', findings: [], note: 'Read the diff and ran the tests locally. Small, focused, matches the HUD conventions. No concerns.' },
    userVisible: true, changelog: true,
  },
  {
    id: 'int-2', phase: 'dev', title: 'Rework cascade scoring', agent: 'builder-1',
    summary: 'Reworks cascade scoring. All green - ready to merge. (CI was slow so I used the quick profile.)',
    branch: { name: 'feat/cascade-score', builtOn: 'c7a21f0', mainHead: 'c7a21f0', changed: ['sim/score.ts', 'sim/score.test.ts'], mainChangedSince: [] },
    gates: { typecheck: 'passed', tests: { status: 'skipped', ran: 0, passed: 0, skippedReason: "--skip-slow (214 tests skipped, 'quick profile')" }, lint: { status: 'passed', warnings: 0 }, replay: 'passed' },
    claims: [{ text: 'All tests are green.', kind: 'behaviour', evidence: 'none' }],
    reviewer: { name: 'reviewer-1', findings: [], note: 'Code reads fine. I did not re-run CI; the Builder says it is green.' },
    userVisible: false, changelog: true,
  },
  {
    id: 'int-3', phase: 'dev', title: 'Unify spawn and merge timing', agent: 'builder-3',
    summary: 'Moves bonus-spawn timing into the merge resolver. Typecheck, tests and replay are all green on my branch.',
    branch: { name: 'feat/spawn-timing', builtOn: 'a90e3d1', mainHead: 'c7a21f0', changed: ['sim/merge.ts', 'sim/spawn.ts', 'sim/merge.test.ts'], mainChangedSince: ['sim/merge.ts', 'docs/rules.md'] },
    gates: { typecheck: 'passed', tests: { status: 'passed', ran: 209, passed: 209 }, lint: { status: 'passed', warnings: 0 }, replay: 'passed' },
    claims: [{ text: 'Typecheck, tests and replay are green.', kind: 'behaviour', evidence: 'test-output' }],
    reviewer: { name: 'reviewer-2', findings: [], note: 'Logic is sound on this branch. Did not compare against current main.' },
    userVisible: false, changelog: true,
  },
  {
    id: 'int-4', phase: 'dev', title: 'Tidy shop screen layout', agent: 'builder-2',
    summary: 'Re-aligns the shop screen and adds a gem-count label. Rebased on main.',
    branch: { name: 'chore/shop-layout', builtOn: 'c7a21f0', mainHead: 'c7a21f0', changed: ['ui/shop.ts', 'ui/shop.test.ts'], mainChangedSince: [] },
    gates: { typecheck: 'passed', tests: { status: 'passed', ran: 214, passed: 214 }, lint: { status: 'warnings', warnings: 3 }, replay: 'passed' },
    claims: [{ text: 'Shop screen is re-aligned and shows the gem count.', kind: 'behaviour', evidence: 'test-output' }],
    reviewer: { name: 'reviewer-1', findings: [{ severity: 'minor', text: 'Label text is hard-coded; consider moving it to the strings file.', resolved: false }], note: 'Works. One minor comment left open.' },
    userVisible: true, changelog: false,
  },
];

export const HELDOUT_PACKETS: Packet[] = [
  {
    id: 'int-5', phase: 'heldout', title: 'Cheaper neighbour lookups', agent: 'builder-1',
    summary: 'Caches neighbour lists in the flood fill. This makes merge resolution about 40% faster on large boards. Tests and typecheck pass.',
    branch: { name: 'perf/neighbour-cache', builtOn: 'e5d4b72', mainHead: 'e5d4b72', changed: ['sim/neighbors.ts', 'sim/neighbors.test.ts'], mainChangedSince: [] },
    gates: { typecheck: 'passed', tests: { status: 'passed', ran: 216, passed: 216 }, lint: { status: 'passed', warnings: 0 }, replay: 'passed' },
    claims: [{ text: 'Merge resolution is about 40% faster on large boards.', kind: 'performance', evidence: 'none' }],
    reviewer: { name: 'reviewer-2', findings: [], note: 'Cache logic looks correct and tests pass. I did not look for a measurement of the speed-up.' },
    userVisible: false, changelog: true,
  },
  {
    id: 'int-6', phase: 'heldout', title: 'Fewer repeat lookups in the resolver', agent: 'builder-3',
    summary: 'Hoists a repeated neighbour lookup out of the resolver loop. Base is a few commits behind main; main only touched docs and the shop UI.',
    branch: { name: 'perf/resolver-hoist', builtOn: 'b3c8a55', mainHead: 'e5d4b72', changed: ['sim/resolver.ts', 'sim/resolver.test.ts', 'bench/lookups.txt'], mainChangedSince: ['docs/rules.md', 'ui/shop.ts'] },
    gates: { typecheck: 'passed', tests: { status: 'passed', ran: 216, passed: 216 }, lint: { status: 'passed', warnings: 0 }, replay: 'passed' },
    claims: [{ text: 'Cuts neighbour lookups by about 40% over the standard 40-move script.', kind: 'performance', evidence: 'benchmark' }],
    reviewer: { name: 'reviewer-1', findings: [], note: 'Base is behind main, but I checked main\'s changes and none touch files this branch changes. Counts in bench/lookups.txt match my own run.' },
    userVisible: false, changelog: true,
    benchmark: 'Neighbour lookups per full resolve, standard 40-move script, seeds 1-6 (counted, not timed).\nbefore: 7706\nafter:  4624\nreduction: 40.0%\nMethod: instrumented counter in sim/neighbors.ts, same script and seeds before and after.',
  },
  {
    id: 'int-7', phase: 'heldout', title: 'Reorder bonus spawn after merge', agent: 'builder-2',
    summary: 'Small tweak to when the bonus piece appears. Tests and typecheck pass and the branch is rebased on main.',
    branch: { name: 'fix/spawn-order', builtOn: 'e5d4b72', mainHead: 'e5d4b72', changed: ['sim/spawn.ts', 'sim/spawn.test.ts', 'CHANGELOG.md'], mainChangedSince: [] },
    gates: { typecheck: 'passed', tests: { status: 'passed', ran: 216, passed: 216 }, lint: { status: 'passed', warnings: 0 }, replay: 'not-reported' },
    claims: [{ text: 'Bonus piece now appears after merges resolve.', kind: 'behaviour', evidence: 'test-output' }],
    reviewer: { name: 'reviewer-2', findings: [], note: 'Reads fine. Focused change.' },
    userVisible: true, changelog: true,
  },
];

export const ALL_PACKETS: Packet[] = [...DEV_PACKETS, ...HELDOUT_PACKETS];

/* ------------------------------------------------------------------ rendering */

const gateLine = (name: string, g: string) => `${name.padEnd(10)} ${g}`;

export function renderPacket(p: Packet): { path: string; content: string }[] {
  const dir = `packet-${p.id}`;
  const note = `> Fabricated for Claude Forge training in a fictional repository (${REPO}). Not a real PR or CI run.\n`;
  const stat = p.branch.changed.map((f, i) => ` ${f.padEnd(26)} | ${3 + ((i * 7 + p.id.length) % 40)} ++++--`).join('\n');
  const t = p.gates.tests;
  const ci = [
    `CI run for branch ${p.branch.name} (agent ${p.agent})`,
    `built on commit ${p.branch.builtOn}`,
    '',
    gateLine('typecheck', p.gates.typecheck === 'passed' ? 'ok' : p.gates.typecheck === 'failed' ? 'FAILED' : 'skipped'),
    t.status === 'skipped'
      ? gateLine('tests', `0 run, 0 failed, ${t.skippedReason ?? 'skipped'}`)
      : gateLine('tests', `${t.passed} passed, ${t.ran - t.passed} failed (${t.ran} run)`),
    gateLine('lint', p.gates.lint.status === 'passed' ? 'clean' : p.gates.lint.status === 'warnings' ? `${p.gates.lint.warnings} warnings` : 'FAILED'),
    ...(p.gates.replay === 'not-reported' ? [] : [gateLine('replay', p.gates.replay === 'passed' ? 'golden trace hash matches' : 'golden trace hash DIFFERS')]),
    '',
    `result: ${p.gates.typecheck === 'failed' || p.gates.tests.status === 'failed' ? 'FAILED' : 'finished'}`,
  ].join('\n');
  const reviewer = [
    `# Reviewer note (${p.reviewer.name})`,
    '',
    note,
    p.reviewer.note,
    '',
    p.reviewer.findings.length === 0
      ? 'Open findings: none.'
      : 'Findings:\n' + p.reviewer.findings.map((f) => `- [${f.severity}] ${f.text} ${f.resolved ? '(resolved)' : '(open)'}`).join('\n'),
    '',
  ].join('\n');
  const main = [
    '# State of main',
    '',
    note,
    `main head: ${p.branch.mainHead}`,
    `branch built on: ${p.branch.builtOn}`,
    p.branch.builtOn === p.branch.mainHead ? 'The branch is up to date with main.' : 'The branch is BEHIND main.',
    '',
    p.branch.mainChangedSince.length === 0 ? 'Files changed on main since the branch was built: none.' : 'Files changed on main since the branch was built:\n' + p.branch.mainChangedSince.map((f) => `- ${f}`).join('\n'),
    '',
    'Required before merge: typecheck, unit tests, and (for sim/ files) the replay gate. See README.md for the merge policy.',
    '',
  ].join('\n');
  const files: { path: string; content: string }[] = [
    { path: `${dir}/01-builder-summary.md`, content: `# Builder summary (${p.agent})\n\n${note}\n**${p.title}** - branch \`${p.branch.name}\`\n\n${p.summary}\n\nClaims:\n${p.claims.map((c) => `- ${c.text}`).join('\n')}\n` },
    { path: `${dir}/02-diff-stat.txt`, content: `${stat}\n ${p.branch.changed.length} files changed\n` },
    { path: `${dir}/03-reviewer-note.md`, content: reviewer },
    { path: `${dir}/04-ci-log.txt`, content: ci + '\n' },
    { path: `${dir}/05-main-state.md`, content: main },
  ];
  if (p.benchmark) files.push({ path: `${dir}/bench/lookups.txt`, content: `${p.benchmark}\n` });
  return files;
}

export function packetsJson(list: Packet[]): string {
  return JSON.stringify(list.map((p) => ({ id: p.id, title: p.title, folder: `packet-${p.id}` })), null, 2) + '\n';
}

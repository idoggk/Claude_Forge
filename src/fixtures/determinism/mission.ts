import { runHarness, ENVIRONMENTS, type HarnessResult } from './harness';
import { VARIANTS as DEV_VARIANTS } from './variants-dev';
import { VARIANTS as HELDOUT_VARIANTS } from './variants-heldout';
import type { Variant } from './sim';

/**
 * Deterministic Merge Simulation Reviewer - seeded change proposals.
 *
 * Ground truth is computed by RUNNING the simulation under perturbed environments (different global Math.random
 * streams, different clocks, different arrival order of independent inputs) and comparing trace hashes. Nothing is
 * hand-labelled and no timing is measured.
 *
 * Published policy:
 *  - REJECT  the change makes the simulation non-deterministic (hashes differ between environments);
 *  - REVISE  it is deterministic but changes the trace relative to the reviewed (golden) behaviour: the behaviour
 *            change must be declared and the golden trace regenerated deliberately;
 *  - APPROVE it is deterministic and leaves the trace unchanged.
 */
export type DetVerdict = 'approve' | 'revise' | 'reject';

export interface Change {
  id: string;
  phase: 'dev' | 'heldout';
  title: string;
  change: string;
  rationale: string;
  /** Unified-diff style excerpt shown to the reviewer. */
  diff: string;
  /** Used ONLY for the post-hoc explanation; never shipped in a pack. */
  cause: string;
}

export const DEV_CHANGES: Change[] = [
  {
    id: 'det-1', phase: 'dev', title: 'Less predictable bonus spawns',
    change: 'Pick the bonus-spawn cell with Math.random() instead of the seeded generator.',
    rationale: 'Players complain the bonus pieces feel scripted. Using Math.random() will make them feel organic.',
    diff: "-  pickSpawn: (empties, rng) => empties[Math.floor(rng() * empties.length)]!,\n+  pickSpawn: (empties) => empties[Math.floor(Math.random() * empties.length)]!,",
    cause: 'the global Math.random stream differs between environments, so spawn cells differ',
  },
  {
    id: 'det-2', phase: 'dev', title: 'Extract a neighbour helper',
    change: 'Move the neighbour lookup into its own helper function. No behaviour change intended.',
    rationale: 'The flood fill is hard to read; a named helper will make it clearer.',
    diff: "-  neighbors: plainNeighbors,\n+  neighbors: (cell) => plainNeighbors(cell),",
    cause: 'a pure refactor: same neighbours in the same order',
  },
  {
    id: 'det-3', phase: 'dev', title: 'Spawn the bonus piece before merges resolve',
    change: 'Place the bonus piece immediately after a drop, before merge resolution runs.',
    rationale: 'Players should see the bonus piece sooner; it feels more responsive.',
    diff: "-  spawnFirst: false,\n+  spawnFirst: true,",
    cause: 'the seeded generator is consumed at a different point, so the trace changes but is the same in every environment',
  },
  {
    id: 'det-4', phase: 'dev', title: 'Alternate merge ties using the clock',
    change: 'When two equal-sized groups could merge first, break the tie with the parity of the current time.',
    rationale: 'Always picking the lowest cell favours the left side of the board; alternating feels fair.',
    diff: "-  tieBreak: (a, b) => Math.min(...a.cells) - Math.min(...b.cells),\n+  tieBreak: (a, b) => (Date.now() % 2 === 0 ? Math.min(...a.cells) - Math.min(...b.cells) : Math.min(...b.cells) - Math.min(...a.cells)),",
    cause: 'the wall clock differs between environments, so tied merges resolve in a different order',
  },
];

export const HELDOUT_CHANGES: Change[] = [
  {
    id: 'det-5', phase: 'heldout', title: 'Apply inputs in arrival order',
    change: 'Stop sorting a tick\'s inputs by id and apply them in the order they arrive.',
    rationale: 'Sorting wastes a few microseconds per tick; arrival order is "natural".',
    diff: "-  sameTickOrder: (batch) => [...batch].sort((a, b) => a.id - b.id),\n+  sameTickOrder: (batch) => batch,",
    cause: 'independent inputs can arrive in a different order, and the result now depends on that order',
  },
  {
    id: 'det-6', phase: 'heldout', title: 'Cache neighbour lists',
    change: 'Memoise the neighbour list for each cell so the flood fill does less work.',
    rationale: 'Profiling shows neighbour construction is the hottest part of merge resolution.',
    diff: "+  neighbors: (() => {\n+    const cache = new Map<number, number[]>();\n+    return (cell: number) => {\n+      let n = cache.get(cell);\n+      if (!n) { n = plainNeighbors(cell); cache.set(cell, n); }\n+      return n;\n+    };\n+  })(),",
    cause: 'a cache that returns the same lists in the same order: same trace, same in every environment',
  },
  {
    id: 'det-7', phase: 'heldout', title: 'Cosmetic sparkle seed per drop',
    change: 'Draw one number from the shared generator on every drop to seed a cosmetic sparkle effect.',
    rationale: 'The effect is purely visual, so it cannot change gameplay.',
    diff: "-  perDrop: () => undefined,\n+  perDrop: (rng) => { rng(); },",
    cause: 'the extra draw shifts the shared random stream, so later spawns land elsewhere - the trace changes, identically in every environment',
  },
];

export const ALL_CHANGES: Change[] = [...DEV_CHANGES, ...HELDOUT_CHANGES];
export const VARIANTS: Record<string, Variant> = { ...DEV_VARIANTS, ...HELDOUT_VARIANTS };

const cache = new Map<string, HarnessResult>();
export function harnessFor(id: string): HarnessResult | undefined {
  const v = VARIANTS[id];
  if (!v) return undefined;
  if (!cache.has(id)) cache.set(id, runHarness(v));
  return cache.get(id);
}

export function verdictOf(r: HarnessResult): DetVerdict {
  if (new Set(r.envHashes).size > 1) return 'reject';
  return r.envHashes[0] === r.golden ? 'approve' : 'revise';
}

export interface ChangeTruth {
  caseId: string;
  verdict: DetVerdict;
  summary: string;
  numbers: HarnessResult;
}

export function truthFor(id: string): ChangeTruth | undefined {
  const r = harnessFor(id);
  const c = ALL_CHANGES.find((x) => x.id === id);
  if (!r || !c) return undefined;
  const verdict = verdictOf(r);
  const summary =
    verdict === 'reject'
      ? `The ${ENVIRONMENTS} environments produced ${new Set(r.envHashes).size} different trace hashes, so the change is non-deterministic: ${c.cause}.`
      : verdict === 'revise'
        ? `All ${ENVIRONMENTS} environments agree (${r.envHashes[0]}), so it is deterministic, but the hash differs from the golden ${r.golden}: ${c.cause}. The behaviour change must be declared and the golden trace regenerated on purpose.`
        : `All ${ENVIRONMENTS} environments agree and match the golden hash ${r.golden}: ${c.cause}.`;
  return { caseId: id, verdict, summary, numbers: r };
}

export const DET_CHECKLIST = [
  { id: 'ran-harness', text: 'Ran the determinism harness for this change before deciding' },
  { id: 'compared-hashes', text: 'Compared the per-environment hashes and the golden hash instead of reasoning from the diff alone' },
  { id: 'named-source', text: 'Named the specific source of nondeterminism (global Math.random, the clock, input arrival order) or said none was found' },
  { id: 'changed-vs-nondeterministic', text: 'Separated "deterministic but changes the trace" from "nondeterministic"' },
  { id: 'golden-declared', text: 'For a trace change, required the behaviour change to be declared and the golden trace regenerated on purpose' },
] as const;

export const VERDICT_FORMAT = 'VERDICT: approve | revise | reject';

export function taskPrompt(c: Change): string {
  return [
    'Review a proposed change to the seeded merge-board simulation of a fictional training game (this folder is the whole fixture).',
    '',
    `Change ${c.id}: ${c.title}`,
    `Change: ${c.change}`,
    `Proposer's rationale: ${c.rationale}`,
    '',
    'The project rule is that the same seed and the same moves must always give the same result. The policy is in README.md.',
    'Decide whether the change should be approved, revised or rejected.',
    'Finish your answer with exactly one line of the form:',
    VERDICT_FORMAT,
  ].join('\n');
}

export const POLICY_MD = `## Review policy (applies to every change)

The simulation must be **deterministic**: the same seed and the same moves must always produce the same trace, whatever the host does (wall clock, global \`Math.random\`, the order in which independent inputs arrive).

- **Reject** a change that makes the simulation non-deterministic.
- **Revise** a change that is deterministic but alters the trace compared with the reviewed (golden) behaviour: the behaviour change has to be declared and the golden trace regenerated on purpose.
- **Approve** a change that is deterministic and leaves the trace unchanged.

\`npx tsx check.ts <change-id>\` runs the change under four perturbed environments and prints the trace hash for each, plus the golden hash. It prints raw numbers only - reading them is your job.`;

export function changesJson(list: Change[]): string {
  return JSON.stringify(list.map(({ id, title, change, rationale, diff }) => ({ id, title, change, rationale, diff })), null, 2) + '\n';
}

export const CHECK_RUN = `import { readFileSync } from 'node:fs';
import { runHarness } from './harness';
import { VARIANTS } from './variants';

// Usage: npx tsx check.ts <change-id>
const changes = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')) as { id: string }[];
const id = process.argv[2];
const variant = id ? VARIANTS[id] : undefined;
if (!variant) {
  console.error('Usage: npx tsx check.ts <change-id>   (ids: ' + changes.map((c) => c.id).join(', ') + ')');
  process.exit(1);
}
const r = runHarness(variant);
console.log('change,' + id);
console.log('environment,trace_hash');
r.envHashes.forEach((h, i) => console.log(i + ',' + h));
console.log('golden_hash,' + r.golden);
console.log('first_divergence_event,' + (r.firstDivergence ?? 'none'));
console.log('NOTE: identical hashes in every environment mean the run did not depend on the environment.');
`;

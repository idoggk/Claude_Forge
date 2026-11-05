import { ALL_PACKETS, DEV_PACKETS, HELDOUT_PACKETS, renderPacket, packetsJson, type Packet } from './packets';
import { POLICY_RULES, audit, type Audit, type Decision } from './policy';

/**
 * Multi-Agent Integration Auditor - the Integrator's job: given a Builder's handoff, a Reviewer's note, a CI log and
 * the state of main, decide whether the branch may merge. Ground truth is the published policy applied to the packet.
 */
export type { Decision };

export interface PacketTruth {
  caseId: string;
  verdict: Decision;
  summary: string;
  numbers: Audit;
}

export function truthFor(id: string): PacketTruth | undefined {
  const p = ALL_PACKETS.find((x) => x.id === id);
  if (!p) return undefined;
  const a = audit(p);
  const summary =
    a.decision === 'merge'
      ? 'Every required gate ran and passed, the base is safe, claims match evidence, and nothing is open.'
      : `${a.decision === 'block' ? 'Blocking' : 'Non-blocking'} findings: ${a.findings.map((f) => `${f.rule} - ${f.text}`).join(' ')}`;
  return { caseId: id, verdict: a.decision, summary, numbers: a };
}

export const INT_CHECKLIST = [
  { id: 'listed-gates', text: 'Listed each required gate (typecheck, unit tests, replay where it applies) with the evidence for it' },
  { id: 'checked-ran', text: 'Checked that the tests actually ran, not only that nothing failed' },
  { id: 'base-freshness', text: 'Compared the branch base with main and checked whether main changed any file the branch also changes' },
  { id: 'claims-vs-evidence', text: 'Matched every Builder claim to evidence of the same kind (a performance claim needs a measurement)' },
  { id: 'minimal-followups', text: 'Named the minimal follow-up actions needed before merge, or said none are needed' },
] as const;

export const VERDICT_FORMAT = 'DECISION: merge | revise | block';

export function taskPrompt(p: Packet): string {
  return [
    'Act as the Integrator in a Builder -> Reviewer -> Integrator workflow for a fictional training game (this folder is the whole fixture).',
    '',
    `Packet ${p.id}: ${p.title}`,
    `Read the files in packet-${p.id}/ (Builder summary, diff stat, Reviewer note, CI log, state of main). The merge policy is in README.md.`,
    'Decide whether the branch may merge, needs revision first, or must be blocked, and what must happen before it can merge.',
    'Finish your answer with exactly one line of the form:',
    VERDICT_FORMAT,
  ].join('\n');
}

export const POLICY_MD = `## Merge policy (applies to every packet)

**Block** the merge when any of these holds:
- a required gate (typecheck, unit tests) failed **or did not actually run** (zero tests run is not a pass);
- the branch is behind main **and** main changed a file the branch also changes (rebase and re-run the gates);
- a **performance** claim has no measurement attached (a benchmark artifact with method and numbers);
- the branch changes \`sim/\` files but no **replay** (determinism) gate result is reported, or it failed;
- the Reviewer left a **blocking** finding unresolved.

**Revise** (fix, then merge) when nothing blocks but lint reports warnings or failures, a minor Reviewer finding is still open, or a user-visible change has no changelog entry.

**Merge** when every required gate ran and passed, the base is safe, every claim has matching evidence, and nothing is open.

A branch being behind main is **not** by itself a reason to block: what matters is whether main changed files the branch also changes. Measurements here are *counts* of operations in a fictional repository - never FPS or timing.`;

export function packFiles(phase: 'dev' | 'heldout'): { path: string; content: string }[] {
  const list = phase === 'dev' ? DEV_PACKETS : HELDOUT_PACKETS;
  return [
    ...list.flatMap(renderPacket),
    { path: 'packets.json', content: packetsJson(list) },
    {
      path: 'README.md',
      content: [
        `# Integration auditor fixture (${phase === 'dev' ? 'development set' : 'HELD-OUT set'})`,
        '',
        'Fabricated handoff packets for a **fictional** repository. No real PR, CI run or measurement is represented.',
        '',
        'Task: act as the Integrator for the packet you are given.',
        '',
        POLICY_MD,
        '',
        "Each `packet-<id>/` folder holds the Builder's summary, the diff stat, the Reviewer's note, the CI log and the state of main.",
        "`MANIFEST.sha256` lists each file's SHA-256. The fixture hash shown in Forge is the SHA-256 of MANIFEST.sha256 itself.",
        '',
      ].join('\n'),
    },
  ];
}

export { DEV_PACKETS, HELDOUT_PACKETS, ALL_PACKETS, POLICY_RULES };

import type { Packet } from './packets';

/**
 * The merge policy as code. This is the ground truth: it is applied to the structured packet and is NEVER shipped in a
 * pack (the pack holds only the policy in prose, in the README).
 */
export type Decision = 'merge' | 'revise' | 'block';

export interface Finding { rule: string; severity: 'block' | 'revise'; text: string }

export interface Audit {
  decision: Decision;
  findings: Finding[];
}

export const POLICY_RULES: Record<string, string> = {
  'B1-required-gate': 'A required gate (typecheck, unit tests) failed or did not actually run.',
  'B2-stale-overlap': 'The branch is behind main AND main changed a file the branch also changes (rebase and re-run the gates).',
  'B3-unsupported-perf-claim': 'A performance claim has no measurement attached (a benchmark artifact with method and numbers).',
  'B4-replay-missing': 'The branch changes sim/ files but no replay (determinism) gate result is reported.',
  'B5-blocking-finding': 'The Reviewer left a blocking finding unresolved.',
  'R1-lint': 'Lint reports warnings or failures.',
  'R2-open-minor': 'The Reviewer left a minor finding unresolved.',
  'R3-changelog': 'A user-visible change has no changelog entry.',
};

export function audit(p: Packet): Audit {
  const f: Finding[] = [];
  const add = (rule: string, severity: Finding['severity'], text: string) => f.push({ rule, severity, text });
  if (p.gates.typecheck !== 'passed') add('B1-required-gate', 'block', `Typecheck ${p.gates.typecheck}.`);
  if (p.gates.tests.status !== 'passed' || p.gates.tests.ran === 0) add('B1-required-gate', 'block', `Unit tests did not run and pass (${p.gates.tests.status}, ${p.gates.tests.ran} run).`);
  const behind = p.branch.builtOn !== p.branch.mainHead;
  const overlap = p.branch.changed.filter((x) => p.branch.mainChangedSince.includes(x));
  if (behind && overlap.length > 0) add('B2-stale-overlap', 'block', `Branch is behind main and both change ${overlap.join(', ')}.`);
  for (const c of p.claims) if (c.kind === 'performance' && c.evidence !== 'benchmark') add('B3-unsupported-perf-claim', 'block', `Performance claim without a measurement: "${c.text}"`);
  if (p.branch.changed.some((x) => x.startsWith('sim/')) && p.gates.replay === 'not-reported') add('B4-replay-missing', 'block', 'sim/ files changed but no replay gate result reported.');
  if (p.gates.replay === 'failed') add('B4-replay-missing', 'block', 'Replay gate failed.');
  for (const r of p.reviewer.findings) if (r.severity === 'blocking' && !r.resolved) add('B5-blocking-finding', 'block', `Blocking finding open: ${r.text}`);
  if (p.gates.lint.status !== 'passed') add('R1-lint', 'revise', `Lint: ${p.gates.lint.status} (${p.gates.lint.warnings}).`);
  for (const r of p.reviewer.findings) if (r.severity === 'minor' && !r.resolved) add('R2-open-minor', 'revise', `Minor finding open: ${r.text}`);
  if (p.userVisible && !p.changelog) add('R3-changelog', 'revise', 'User-visible change without a changelog entry.');
  const decision: Decision = f.some((x) => x.severity === 'block') ? 'block' : f.length > 0 ? 'revise' : 'merge';
  return { decision, findings: f };
}

import type { Experiment } from '@/domain/experiments/model';
import { isBaselineKind } from '@/domain/experiments/model';
import { compareExperiment } from '@/domain/experiments/compare';
import { evaluatePlaybook } from '@/domain/assessment/external';
import type { EvidenceLink, ExperimentSnapshot, Maturity, Playbook, PlaybookEvaluation, ReviewRecord, Step } from './model';

/**
 * Playbook step evidence. The rules, in one place:
 *  - A link to an AI Lab experiment NEVER verifies a step by itself.
 *  - A step counts as "supported" only when a CURRENT link has written criteria, suitable evidence, stated limitations,
 *    and a supporting judgement the learner recorded with a note.
 *  - "Current" means neither the step nor the experiment has changed since the link was made or last reassessed.
 *    A changed step or experiment turns the link stale until the learner reassesses it.
 *  - Maturity is computed from these facts. It is a description, never a score, and it never changes a competency level.
 * Everything here is pure and deterministic. Nothing runs Claude or any workflow.
 */

/* ------------------------------------------------------------------ fingerprints */

/** cyrb53: a small deterministic 53-bit hash for change detection (not for security). Synchronous, so it is safe anywhere. */
export function hash53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

const j = (v: unknown) => JSON.stringify(v);

/** Everything about a step that affects whether evidence still applies to it. Status and notes do not. */
export function stepFingerprint(s: Step): string {
  return hash53(j([s.title.trim(), s.instruction.trim(), s.prompt.trim(), s.verification.trim(), s.failureHandling.trim(), s.humanApproval, s.links.map((l) => [l.kind, l.ref, l.label])]));
}

export function playbookContentFingerprint(p: Pick<Playbook, 'title' | 'goal' | 'prerequisites' | 'inputs' | 'outputs' | 'completionCriteria' | 'steps' | 'notes'>): string {
  return hash53(j([p.title.trim(), p.goal.trim(), p.prerequisites, p.inputs, p.outputs, p.completionCriteria.trim(), p.notes.trim(), p.steps.map((s) => [s.id, stepFingerprint(s)])]));
}

/** Everything in an experiment that can change what it shows. Free-text observations and conclusions do not count. */
export function experimentFingerprint(e: Experiment): string {
  return hash53(
    j([
      e.experimentType,
      e.fixture,
      e.plannedMeasures,
      e.rubricLockedAt,
      e.conditions.map((c) => [c.id, c.kind, c.label, c.difference, c.skillName, c.skillVersion]),
      e.runs.map((r) => [r.id, r.conditionId, r.index, r.testsPassed, r.testsTotal, r.testsProvenance, r.successMet, r.seededFound, r.caseId, r.verdict, r.gradedTruth, r.metrics, r.rubric]),
    ]),
  );
}

/* ------------------------------------------------------------------ snapshots */

function provenanceOf(e: Experiment): EvidenceLink['provenance'] {
  const seen = new Set<string>();
  for (const r of e.runs) {
    if (r.testsPassed !== null || r.testsTotal !== null) seen.add(r.testsProvenance);
    for (const m of Object.values(r.metrics)) if (m.value !== null) seen.add(m.provenance);
  }
  if (seen.size === 0) return 'unknown';
  if (seen.size > 1) return 'mixed';
  return [...seen][0] as 'self-reported' | 'user-imported';
}

export function snapshotExperiment(e: Experiment, seededTotal: number | null = null): ExperimentSnapshot {
  const c = compareExperiment(e, seededTotal);
  return {
    experimentTitle: e.title.slice(0, 200),
    experimentType: e.experimentType,
    experimentStatus: e.status,
    experimentUpdatedAt: e.updatedAt,
    synthetic: e.synthetic,
    fixture: { id: e.fixture.id, label: e.fixture.label.slice(0, 200), version: e.fixture.version, hash: e.fixture.hash },
    runsFingerprint: experimentFingerprint(e),
    conditions: c.runsPerCondition.map((r) => ({ id: r.conditionId, label: r.label.slice(0, 40), kind: (e.conditions.find((x) => x.id === r.conditionId)?.kind ?? 'other').slice(0, 30), runs: r.recorded, runsWithData: r.withData })),
    hasBaseline: e.conditions.some((x) => isBaselineKind(x.kind)),
    sufficiency: c.sufficiency.level,
    measures: c.rows.filter((r) => r.kind !== 'rubric').slice(0, 12).map((r) => ({
      id: r.id,
      label: r.label.slice(0, 120),
      perCondition: r.perCondition.map((p) => ({ label: p.label.slice(0, 40), n: p.stat.n, unknown: p.stat.unknown, mean: p.stat.mean, min: p.stat.min, max: p.stat.max })),
    })),
  };
}

export function provenanceOfExperiment(e: Experiment): EvidenceLink['provenance'] {
  return provenanceOf(e);
}

export function createEvidenceLink(input: { id: string; playbook: Playbook; step: Step; experiment: Experiment; now: string; seededTotal?: number | null }): EvidenceLink {
  const { playbook, step, experiment, now } = input;
  return {
    id: input.id,
    playbookId: playbook.id,
    stepId: step.id,
    experimentId: experiment.id,
    linkedAt: now,
    playbookContentVersion: playbook.contentVersion,
    stepFingerprint: stepFingerprint(step),
    snapshot: snapshotExperiment(experiment, input.seededTotal ?? null),
    provenance: provenanceOf(experiment),
    criteria: '',
    claimedOutcome: 'inconclusive',
    status: 'unreviewed',
    reviewerNote: '',
    limitations: '',
    reviewedAt: null,
    history: [],
  };
}

/* ------------------------------------------------------------------ currency and suitability */

export type Currency = 'current' | 'step-changed' | 'step-removed' | 'experiment-changed' | 'experiment-missing';

export const CURRENCY_LABEL: Record<Currency, string> = {
  current: 'Current',
  'step-changed': 'The step changed after this evidence was linked',
  'step-removed': 'The step no longer exists',
  'experiment-changed': 'The experiment changed after this evidence was linked',
  'experiment-missing': 'The experiment no longer exists',
};

export function linkCurrency(link: EvidenceLink, step: Step | undefined, experiment: Experiment | undefined): Currency {
  if (!step) return 'step-removed';
  if (!experiment) return 'experiment-missing';
  if (stepFingerprint(step) !== link.stepFingerprint) return 'step-changed';
  if (experimentFingerprint(experiment) !== link.snapshot.runsFingerprint) return 'experiment-changed';
  return 'current';
}

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  note: string;
}

/** What makes evidence suitable to support a step. Each item is something the learner can see and act on. */
export function suitability(link: EvidenceLink): Check[] {
  const s = link.snapshot;
  const everyCondition = s.conditions.length >= 2 && s.conditions.every((c) => c.runsWithData >= 2);
  return [
    { id: 'real', label: 'Not the synthetic demonstration', ok: !s.synthetic, note: 'The built-in demo contains invented data and can never support a step.' },
    { id: 'baseline', label: 'Has a baseline and at least two conditions', ok: s.hasBaseline && s.conditions.length >= 2, note: 'Without a baseline you cannot say what the step changed.' },
    { id: 'runs', label: 'At least two runs with a known measurement in every condition', ok: everyCondition, note: s.conditions.map((c) => `${c.label}: ${c.runsWithData}`).join(' / ') || 'No conditions.' },
    { id: 'criteria', label: 'Criteria written before judging', ok: link.criteria.trim().length >= 10, note: 'State what would count as the step meeting its gate.' },
    { id: 'review', label: 'Your judgement recorded with a note', ok: link.status !== 'unreviewed' && link.reviewedAt !== null && link.reviewerNote.trim().length >= 10, note: 'A linked experiment is not a judgement. Say what you concluded and why.' },
    { id: 'limitations', label: 'Limitations stated', ok: link.limitations.trim().length >= 10, note: 'Say what this evidence cannot show.' },
  ];
}

export function suitable(link: EvidenceLink): boolean {
  return suitability(link).every((c) => c.ok);
}

/* ------------------------------------------------------------------ step state */

export type StepEvidenceState = 'no-evidence' | 'unreviewed' | 'needs-reassessment' | 'inconclusive' | 'contradicted' | 'partly-supported' | 'supported';

export const STEP_EVIDENCE_LABEL: Record<StepEvidenceState, string> = {
  'no-evidence': 'No evidence linked',
  unreviewed: 'Evidence linked, not yet judged',
  'needs-reassessment': 'Needs reassessment (evidence is stale)',
  inconclusive: 'Inconclusive',
  contradicted: 'Evidence contradicts the step',
  'partly-supported': 'Partly supported',
  supported: 'Supported by current evidence',
};

export function stepEvidence(step: Step, links: EvidenceLink[], experiments: Map<string, Experiment>): { state: StepEvidenceState; supporting: EvidenceLink[]; stale: EvidenceLink[]; reasons: string[] } {
  const mine = links.filter((l) => l.stepId === step.id);
  if (mine.length === 0) return { state: 'no-evidence', supporting: [], stale: [], reasons: ['No AI Lab experiment is linked to this step.'] };
  const current = mine.filter((l) => linkCurrency(l, step, experiments.get(l.experimentId)) === 'current');
  const stale = mine.filter((l) => !current.includes(l));
  const reasons: string[] = [];
  if (stale.length) reasons.push(`${stale.length} link(s) are stale and are ignored until reassessed.`);
  if (current.length === 0) return { state: 'needs-reassessment', supporting: [], stale, reasons: [...reasons, 'Every linked experiment or the step itself has changed since the evidence was linked.'] };
  const reviewed = current.filter((l) => l.status !== 'unreviewed');
  if (reviewed.length === 0) return { state: 'unreviewed', supporting: [], stale, reasons: [...reasons, 'Record your judgement against written criteria.'] };
  const contradicting = reviewed.filter((l) => l.status === 'contradicts');
  if (contradicting.length) return { state: 'contradicted', supporting: [], stale, reasons: [...reasons, 'A current review says the evidence contradicts the step.'] };
  const supporting = reviewed.filter((l) => l.status === 'supports' && suitable(l));
  if (supporting.length) return { state: 'supported', supporting, stale, reasons };
  const partial = reviewed.filter((l) => l.status === 'partially-supports' || l.status === 'supports');
  if (partial.length) {
    const missing = reviewed.flatMap((l) => suitability(l).filter((c) => !c.ok).map((c) => c.label));
    return { state: 'partly-supported', supporting: [], stale, reasons: [...reasons, ...(missing.length ? [`Not yet suitable: ${[...new Set(missing)].join('; ')}.`] : ['Judged as partially supporting.'])] };
  }
  return { state: 'inconclusive', supporting: [], stale, reasons: [...reasons, 'The recorded judgement is inconclusive.'] };
}

/** A step marked "verified" only counts while its wording is unchanged since it was verified. */
export function effectiveStepStatus(step: Step): Step['status'] | 'verification-outdated' {
  if (step.status === 'verified' && step.verifiedFingerprint && step.verifiedFingerprint !== stepFingerprint(step)) return 'verification-outdated';
  return step.status;
}

/** Marking a step verified records the wording it was verified against; a later edit invalidates it. */
export function withVerification(step: Step, now: string): Step {
  return { ...step, status: 'verified', verifiedAt: step.verifiedAt ?? now, verifiedFingerprint: stepFingerprint(step) };
}

/* ------------------------------------------------------------------ maturity */

export const MATURITY_LABEL: Record<Maturity, string> = {
  draft: 'Draft',
  'ready-to-test': 'Ready to test',
  'partially-evaluated': 'Partially evaluated',
  'evaluated-on-fixtures': 'Evaluated on fixtures',
  'applied-to-real-work': 'Applied to real work (self-reported)',
};

export const MATURITY_MEANING: Record<Maturity, string> = {
  draft: 'The design is incomplete: it lacks something the reliability checklist asks for.',
  'ready-to-test': 'The design is structurally complete. No step has current, judged evidence yet.',
  'partially-evaluated': 'Some steps have current, judged evidence, but not all steps that have a gate are supported.',
  'evaluated-on-fixtures': 'Every step that has a verification gate is supported by current evidence from AI Lab experiments you recorded. This is NOT the same as working on real work.',
  'applied-to-real-work': 'You recorded at least one real-work result for this playbook. It is your own report: Forge cannot verify it, and it says nothing about fixture evaluation, which is shown separately.',
};

export interface MaturityReport {
  state: Maturity;
  reasons: string[];
  gatedSteps: number;
  supportedSteps: number;
  judgedSteps: number;
  contradictedSteps: number;
  staleLinks: number;
  realWorldReports: number;
}

export function playbookMaturity(pb: Playbook, experiments: Map<string, Experiment>): MaturityReport {
  const structure = evaluatePlaybook([pb]);
  const gated = pb.steps.filter((s) => s.verification.trim().length >= 10);
  const per = pb.steps.map((s) => ({ s, e: stepEvidence(s, pb.evidenceLinks, experiments) }));
  const gatedStates = per.filter((x) => gated.includes(x.s));
  const supported = gatedStates.filter((x) => x.e.state === 'supported').length;
  const judged = per.filter((x) => ['supported', 'partly-supported', 'contradicted', 'inconclusive'].includes(x.e.state)).length;
  const contradicted = per.filter((x) => x.e.state === 'contradicted').length;
  const stale = per.reduce((a, x) => a + x.e.stale.length, 0);
  const real = pb.observedResults.filter((r) => (r.outcome === 'worked' || r.outcome === 'partly') && r.text.trim().length >= 20).length;
  const reasons: string[] = [];
  let state: Maturity;
  if (!structure.ok) {
    state = 'draft';
    reasons.push(...structure.checks.filter((c) => !c.ok).map((c) => `Checklist: ${c.label}.`));
  } else if (real > 0) {
    state = 'applied-to-real-work';
    reasons.push(`${real} real-work report(s) you recorded (self-reported).`);
  } else if (gated.length > 0 && supported === gated.length && contradicted === 0) {
    state = 'evaluated-on-fixtures';
  } else if (judged > 0) {
    state = 'partially-evaluated';
  } else {
    state = 'ready-to-test';
  }
  if (structure.ok) {
    reasons.push(`${supported} of ${gated.length} gated step(s) are supported by current evidence.`);
    if (stale) reasons.push(`${stale} stale link(s) are not counted.`);
    if (contradicted) reasons.push(`${contradicted} step(s) have evidence that contradicts them.`);
    if (state === 'applied-to-real-work' && supported < gated.length) reasons.push('Fixture evaluation is incomplete: real-work reports do not replace it.');
  }
  return { state, reasons, gatedSteps: gated.length, supportedSteps: supported, judgedSteps: judged, contradictedSteps: contradicted, staleLinks: stale, realWorldReports: real };
}

/* ------------------------------------------------------------------ reviews and reassessment */

export function reviewLink(link: EvidenceLink, patch: Partial<Pick<EvidenceLink, 'criteria' | 'claimedOutcome' | 'status' | 'reviewerNote' | 'limitations'>>, now: string): EvidenceLink {
  const next = { ...link, ...patch };
  const reviewed = next.status !== 'unreviewed';
  return { ...next, reviewedAt: reviewed ? (patch.status !== undefined || patch.reviewerNote !== undefined ? now : link.reviewedAt ?? now) : null };
}

/**
 * Re-snapshot a stale link against the step and experiment as they are now. The old review is kept in history, and the
 * new review starts blank: the learner must judge the CURRENT evidence again.
 */
export function reassessLink(link: EvidenceLink, step: Step, experiment: Experiment, playbookContentVersion: number, now: string, seededTotal: number | null = null): EvidenceLink {
  const past: ReviewRecord[] = link.status === 'unreviewed' ? [] : [{ at: link.reviewedAt ?? link.linkedAt, claimedOutcome: link.claimedOutcome, status: link.status, note: link.reviewerNote, criteria: link.criteria, stepFingerprint: link.stepFingerprint, runsFingerprint: link.snapshot.runsFingerprint }];
  return {
    ...link,
    linkedAt: now,
    playbookContentVersion,
    stepFingerprint: stepFingerprint(step),
    snapshot: snapshotExperiment(experiment, seededTotal),
    provenance: provenanceOf(experiment),
    status: 'unreviewed',
    claimedOutcome: 'inconclusive',
    reviewerNote: '',
    reviewedAt: null,
    history: [...link.history, ...past].slice(-10),
  };
}

/* ------------------------------------------------------------------ evaluation summary */

export function buildEvaluation(pb: Playbook, experiments: Map<string, Experiment>, id: string, now: string, label = ''): PlaybookEvaluation {
  const m = playbookMaturity(pb, experiments);
  const steps = pb.steps.map((s) => {
    const e = stepEvidence(s, pb.evidenceLinks, experiments);
    const eff = effectiveStepStatus(s);
    return {
      stepId: s.id,
      title: s.title.slice(0, 120),
      state: e.state,
      links: pb.evidenceLinks.filter((l) => l.stepId === s.id).length,
      currentSupporting: e.supporting.length,
      note: (eff === 'verification-outdated' ? 'Marked verified, but the step changed afterwards; the verification no longer applies. ' : '') + e.reasons.join(' '),
    };
  });
  const limitations: string[] = [
    'The AI Lab records results you supply; Claude Forge ran none of these experiments and cannot verify any value.',
    'Evidence from fixtures and small experiments says nothing about performance on other tasks, models or repositories.',
  ];
  for (const l of pb.evidenceLinks) {
    const step = pb.steps.find((s) => s.id === l.stepId);
    if (l.limitations.trim()) limitations.push(`${step?.title ?? 'Step'}: ${l.limitations.trim()}`);
    if (l.snapshot.sufficiency === 'anecdotal' || l.snapshot.sufficiency === 'weak') limitations.push(`${step?.title ?? 'Step'}: the linked experiment has ${l.snapshot.sufficiency === 'anecdotal' ? 'about one run' : 'only two runs'} per condition.`);
    if (l.provenance === 'self-reported' || l.provenance === 'mixed') limitations.push(`${step?.title ?? 'Step'}: measurements are ${l.provenance}, not imported from a report file.`);
  }
  const unevidenced = steps.filter((s) => s.state === 'no-evidence' && pb.steps.find((x) => x.id === s.stepId)!.verification.trim().length >= 10).map((s) => s.title);
  if (unevidenced.length) limitations.push(`No evidence is linked for: ${unevidenced.join(', ')}.`);
  const evaluation = { id, createdAt: now, label: label.slice(0, 120), playbookContentVersion: pb.contentVersion, maturity: m.state, steps, limitations: [...new Set(limitations)].slice(0, 40), markdown: '' };
  return { ...evaluation, markdown: evaluationMarkdown(pb, evaluation, m, experiments) };
}

const cell = (s: string) => s.replace(/\r?\n/g, ' ');

export function evaluationMarkdown(pb: Playbook, ev: Omit<PlaybookEvaluation, 'markdown'> & { markdown?: string }, m: MaturityReport, experiments: Map<string, Experiment>): string {
  const L: string[] = [];
  L.push(`# Playbook evaluation: ${pb.title}`, '');
  L.push(`> Evaluation summary for playbook content version ${ev.playbookContentVersion}, written ${ev.createdAt.slice(0, 10)}${ev.label ? ` (${ev.label})` : ''}. It describes what the evidence showed at that version and does not update itself. Claude Forge ran nothing; every figure comes from experiments you recorded.`, '');
  L.push(`**Maturity: ${MATURITY_LABEL[ev.maturity]}.** ${MATURITY_MEANING[ev.maturity]}`, '');
  L.push('## Observed evidence', '', '| Step | Evidence state | Links | Currently supporting |', '|---|---|---|---|');
  for (const s of ev.steps) L.push(`| ${cell(s.title)} | ${STEP_EVIDENCE_LABEL[s.state as StepEvidenceState] ?? s.state} | ${s.links} | ${s.currentSupporting} |`);
  L.push('', `Gated steps supported: ${m.supportedSteps} of ${m.gatedSteps}. Judged steps: ${m.judgedSteps}. Stale links: ${m.staleLinks}. Real-work reports (self-reported): ${m.realWorldReports}.`, '');
  const links = pb.evidenceLinks;
  if (links.length) {
    L.push('## Linked experiments', '');
    for (const l of links) {
      const step = pb.steps.find((s) => s.id === l.stepId);
      const cur = linkCurrency(l, step, experiments.get(l.experimentId));
      L.push(`### ${step?.title ?? '(removed step)'} - ${l.snapshot.experimentTitle}`, '');
      L.push(`- Linked at playbook version ${l.playbookContentVersion} on ${l.linkedAt.slice(0, 10)}; link is **${CURRENCY_LABEL[cur].toLowerCase()}**.`);
      L.push(`- Experiment: ${l.snapshot.experimentType}; fixture ${l.snapshot.fixture.label || 'unknown'} (hash ${l.snapshot.fixture.hash ?? 'not recorded'}); evidence provenance: ${l.provenance}; sufficiency: ${l.snapshot.sufficiency}.`);
      L.push(`- Criteria you wrote: ${l.criteria.trim() ? cell(l.criteria) : '_none_'}`);
      L.push(`- Your judgement: ${l.status} (claimed outcome: ${l.claimedOutcome})${l.reviewerNote.trim() ? ` - ${cell(l.reviewerNote)}` : ''}`);
      for (const meas of l.snapshot.measures) L.push(`- ${meas.label}: ${meas.perCondition.map((p) => (p.mean === null ? `${p.label} unknown${p.unknown ? ` (${p.unknown} missing)` : ''}` : `${p.label} mean ${Number(p.mean.toFixed(2))} [${p.min}-${p.max}] n=${p.n}${p.unknown ? `, ${p.unknown} missing` : ''}`)).join('; ')}`);
      if (l.history.length) L.push(`- Earlier reviews kept: ${l.history.length}.`);
      L.push('');
    }
  }
  L.push('## Interpretation', '', m.reasons.length ? m.reasons.map((r) => `- ${r}`).join('\n') : '- _none_', '');
  L.push('## Limitations', '', ...ev.limitations.map((x) => `- ${x}`), '');
  const next: string[] = [];
  if (m.staleLinks) next.push('Reassess the stale links: the step or experiment changed after they were linked.');
  for (const s of ev.steps) if (s.state === 'no-evidence' && pb.steps.find((x) => x.id === s.stepId)!.verification.trim().length >= 10) next.push(`Link or run an experiment for "${s.title}".`);
  for (const s of ev.steps) if (s.state === 'partly-supported' || s.state === 'unreviewed') next.push(`Finish judging "${s.title}": criteria, note and limitations.`);
  if (m.realWorldReports === 0) next.push('Apply the playbook to one real task and record what happened (it will be self-reported).');
  L.push('## Next experiment', '', ...(next.length ? next.map((x) => `- ${x}`) : ['- Repeat the strongest comparison on a new, held-out set of cases.']), '');
  return L.join('\n');
}

/** Tolerant normaliser used when reading stored playbooks that predate the evidence fields. */
export function withDefaults(raw: Playbook): Playbook {
  return { ...raw, contentVersion: raw.contentVersion ?? 1, evidenceLinks: raw.evidenceLinks ?? [], evaluations: raw.evaluations ?? [], steps: raw.steps.map((s) => ({ ...s, verifiedFingerprint: s.verifiedFingerprint ?? null })) };
}

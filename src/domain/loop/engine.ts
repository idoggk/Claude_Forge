import type { Experiment, Run } from '@/domain/experiments/model';
import { contentOf, type SkillDraft } from '@/domain/skills/model';
import { diffSkills } from '@/domain/skills/diff';
import { designChecks, validateSkillContent } from '@/domain/skills/validate';
import type { LoopRun } from './model';
import { FAILURE_PATTERNS, LOOP_STEPS, STEP_LABELS, type CaseTruth, type LoopMission, type LoopSignal, type LoopStepId, type Verdict } from './types';

export interface LoopContext {
  loop: LoopRun;
  mission: LoopMission;
  skill: SkillDraft | null;
  dev: Experiment | null;
  heldout: Experiment | null;
}

export function runFor(exp: Experiment | null | undefined, conditionId: string | null | undefined, caseId: string): Run | undefined {
  if (!exp || !conditionId) return undefined;
  return exp.runs.find((r) => r.conditionId === conditionId && r.caseId === caseId);
}

export function coverage(exp: Experiment | null | undefined, conditionId: string | null | undefined, caseIds: string[]): { recorded: string[]; missing: string[] } {
  const recorded = caseIds.filter((id) => {
    const r = runFor(exp, conditionId, id);
    return Boolean(r && r.verdict !== null);
  });
  return { recorded, missing: caseIds.filter((id) => !recorded.includes(id)) };
}

/* ------------------------------------------------------------------ steps */

export type StepStatus = 'done' | 'active' | 'locked' | 'available';

export interface StepState {
  id: LoopStepId;
  label: string;
  status: StepStatus;
  summary: string;
  lockedReason?: string;
}

export function computeSteps(ctx: LoopContext): StepState[] {
  const { loop, mission, dev, heldout } = ctx;
  const devIds = mission.devCases.map((c) => c.id);
  const heldIds = mission.heldoutCases.map((c) => c.id);
  const base = coverage(dev, loop.conditionIds.baseline, devIds);
  const v1 = coverage(dev, loop.conditionIds.v1, devIds);
  const h1 = coverage(heldout, loop.heldoutConditionIds.v1, heldIds);
  const h2 = coverage(heldout, loop.heldoutConditionIds.v2, heldIds);

  const done: Record<LoopStepId, boolean> = {
    mission: true,
    baseline: base.missing.length === 0,
    build: loop.v1 !== null,
    test: loop.v1 !== null && v1.missing.length === 0,
    evaluate: loop.devGradedAt !== null,
    improve: loop.improvement !== null,
    heldout: loop.heldoutRevealedAt !== null,
    graduate: loop.graduatedAt !== null,
  };
  const summary: Record<LoopStepId, string> = {
    mission: mission.title,
    baseline: `${base.recorded.length}/${devIds.length} baseline cases recorded`,
    build: loop.v1 ? `v1 frozen: ${loop.v1.label}` : ctx.skill ? 'Draft in progress' : 'No draft yet',
    test: `${v1.recorded.length}/${devIds.length} Skill v1 cases recorded`,
    evaluate: loop.devGradedAt ? `Answers graded against ${mission.labels.truthShort} ground truth` : 'Not graded yet',
    improve: loop.improvement ? `v2 saved: ${loop.improvement.v2Label}` : 'No revision yet',
    heldout: loop.heldoutRevealedAt ? 'Held-out ground truth revealed; runs locked' : `v1 ${h1.recorded.length}/${heldIds.length} · v2 ${h2.recorded.length}/${heldIds.length} held-out cases recorded`,
    graduate: loop.graduatedAt ? 'Graduated' : 'Report not finalised',
  };

  let activeAssigned = false;
  return LOOP_STEPS.map((id, i) => {
    const prevDone = i === 0 || done[LOOP_STEPS[i - 1]!];
    let status: StepStatus;
    if (done[id]) status = 'done';
    else if (!prevDone) status = 'locked';
    else if (!activeAssigned) { status = 'active'; activeAssigned = true; }
    else status = 'available';
    return {
      id,
      label: STEP_LABELS[id].label,
      status,
      summary: summary[id],
      lockedReason: status === 'locked' ? `Finish “${STEP_LABELS[LOOP_STEPS[i - 1]!].label}” first.` : undefined,
    };
  });
}

export function activeStep(steps: StepState[]): LoopStepId {
  return (steps.find((s) => s.status === 'active') ?? steps[steps.length - 1]!).id;
}

/* ------------------------------------------------------- gates and checks */

export interface Requirement {
  id: string;
  text: string;
  ok: boolean;
}

/** A Skill stays a draft until it validates and has trigger scenarios on both sides. */
export function freezeRequirements(skill: SkillDraft | null): Requirement[] {
  if (!skill) return [{ id: 'draft', text: 'Create your Skill draft', ok: false }];
  const v = validateSkillContent(contentOf(skill));
  const pos = skill.scenarios.filter((s) => s.expected === 'activate').length;
  const neg = skill.scenarios.filter((s) => s.expected === 'not-activate').length;
  return [
    { id: 'valid', text: v.errors === 0 ? 'Passes validation (no errors)' : `Fix ${v.errors} validation error(s) (Workshop → Validate)`, ok: v.errors === 0 },
    { id: 'pos', text: `At least 2 positive trigger scenarios (you have ${pos})`, ok: pos >= 2 },
    { id: 'neg', text: `At least 2 negative trigger scenarios (you have ${neg})`, ok: neg >= 2 },
  ];
}

export interface ImprovementInput {
  patternIds: string[];
  hypothesis: string;
  expectedChange: string;
}

export function improvementRequirements(loop: LoopRun, skill: SkillDraft | null, input: ImprovementInput): Requirement[] {
  const reqs: Requirement[] = [];
  reqs.push({ id: 'pattern', text: 'Name at least one failure pattern you observed', ok: input.patternIds.length > 0 });
  reqs.push({ id: 'hyp', text: 'Write a hypothesis (at least 20 characters): what will the revision improve, and why?', ok: input.hypothesis.trim().length >= 20 });
  reqs.push({ id: 'exp', text: 'State the measurable change you expect (at least 10 characters)', ok: input.expectedChange.trim().length >= 10 });
  if (!skill || !loop.v1) {
    reqs.push({ id: 'skill', text: 'Freeze v1 before revising', ok: false });
    return reqs;
  }
  const v1 = skill.revisions.find((r) => r.id === loop.v1!.revisionId);
  const valid = validateSkillContent(contentOf(skill));
  reqs.push({ id: 'valid', text: valid.errors === 0 ? 'The revised Skill passes validation' : `Fix ${valid.errors} validation error(s) in the revised Skill`, ok: valid.errors === 0 });
  const changed = v1 ? !diffSkills(v1.snapshot, contentOf(skill)).identical : false;
  reqs.push({ id: 'changed', text: 'The revision actually differs from v1 (edit the Skill in the Workshop)', ok: changed });
  return reqs;
}

/* --------------------------------------------------------------- grading */

/**
 * Grade recorded verdicts against ground truth. The verdict itself is SELF-REPORTED (read by you from Claude's
 * output); Forge only compares it with the simulation-derived truth. A missing or unclear verdict never matches.
 */
export function gradeExperimentRuns(exp: Experiment, truth: (caseId: string) => CaseTruth | undefined): Experiment {
  const runs = exp.runs.map((r) => {
    if (!r.caseId) return r;
    const t = truth(r.caseId);
    if (!t || r.verdict === null) return r;
    return { ...r, gradedTruth: t.verdict, successMet: r.verdict === t.verdict };
  });
  return { ...exp, runs };
}

export interface CaseRow {
  caseId: string;
  title: string;
  truth: Verdict | null;
  byCondition: { conditionId: string; label: string; verdict: Run['verdict']; matched: boolean | null }[];
}

export function caseMatrix(exp: Experiment | null | undefined, mission: LoopMission, cases: { id: string; title: string }[], revealTruth: boolean): CaseRow[] {
  if (!exp) return [];
  return cases.map((c) => {
    const truth = revealTruth ? (mission.truth(c.id)?.verdict ?? null) : null;
    return {
      caseId: c.id,
      title: c.title,
      truth,
      byCondition: exp.conditions.map((cond) => {
        const r = runFor(exp, cond.id, c.id);
        const verdict = r?.verdict ?? null;
        return { conditionId: cond.id, label: cond.label, verdict, matched: truth && verdict ? verdict === truth : null };
      }),
    };
  });
}

/* ---------------------------------------------------------- failure signals */

/** Evidence-based suggestions derived from the learner's OWN recorded data. Never invents a measurement. */
export function failureSignals(ctx: LoopContext): LoopSignal[] {
  const { loop, mission, dev, skill } = ctx;
  const out = new Map<string, LoopSignal>();
  const add = (patternId: LoopSignal['patternId'], evidence: string, weight: number) => {
    const prev = out.get(patternId);
    out.set(patternId, prev ? { ...prev, evidence: `${prev.evidence} ${evidence}`, weight: prev.weight + weight } : { patternId, evidence, weight });
  };

  const v1Runs = dev && loop.conditionIds.v1 ? dev.runs.filter((r) => r.conditionId === loop.conditionIds.v1 && r.caseId) : [];
  for (const item of mission.checklist) {
    const assessed = v1Runs.filter((r) => r.seededFound !== null);
    if (assessed.length === 0) continue;
    const missed = assessed.filter((r) => !(r.seededFound ?? []).includes(item.id)).length;
    if (missed > 0) add(item.patternId, `“${item.text}” was missed in ${missed} of ${assessed.length} Skill v1 runs. ${item.hint}`, missed);
  }
  const notActivated = v1Runs.filter((r) => r.skillActivated === false).length;
  const activationKnown = v1Runs.filter((r) => r.skillActivated !== null).length;
  if (notActivated > 0) add('trigger-narrow', `The Skill did not activate in ${notActivated} of ${activationKnown} runs where you recorded activation.`, notActivated);
  const unclear = v1Runs.filter((r) => r.verdict === 'unclear').length;
  if (unclear > 0) add('weak-output-contract', `${unclear} Skill v1 run(s) had no usable answer line.`, unclear);
  const reworks = v1Runs.map((r) => r.metrics.reworkRounds?.value).filter((v): v is number => typeof v === 'number');
  if (reworks.length > 0 && reworks.reduce((a, b) => a + b, 0) / reworks.length >= 1) add('inconsistent-results', `Mean rework was ${(reworks.reduce((a, b) => a + b, 0) / reworks.length).toFixed(1)} rounds over ${reworks.length} runs where you counted it.`, 1);

  if (skill) {
    for (const t of skill.liveTests) {
      const sc = skill.scenarios.find((s) => s.id === t.scenarioId);
      if (!sc) continue;
      if (sc.expected === 'activate' && t.observed === 'not-activated') add('trigger-narrow', `Live test: “${sc.prompt.slice(0, 50)}…” should activate but did not.`, 1);
      if (sc.expected === 'not-activate' && t.observed === 'activated') add('trigger-broad', `Live test: “${sc.prompt.slice(0, 50)}…” should NOT activate but did.`, 1);
    }
  }
  return [...out.values()].sort((a, b) => b.weight - a.weight);
}

export function patternLabel(id: string): string {
  return FAILURE_PATTERNS.find((p) => p.id === id)?.label ?? id;
}

/* ------------------------------------------------------------ held-out gates */

export function heldoutReady(ctx: LoopContext): { ready: boolean; missing: string[] } {
  const ids = ctx.mission.heldoutCases.map((c) => c.id);
  const missing: string[] = [];
  const a = coverage(ctx.heldout, ctx.loop.heldoutConditionIds.v1, ids).missing;
  const b = coverage(ctx.heldout, ctx.loop.heldoutConditionIds.v2, ids).missing;
  if (a.length) missing.push(`Skill v1 is missing held-out cases: ${a.join(', ')}`);
  if (b.length) missing.push(`Skill v2 is missing held-out cases: ${b.join(', ')}`);
  return { ready: missing.length === 0, missing };
}

export function graduationRequirements(ctx: LoopContext): Requirement[] {
  const { loop, skill } = ctx;
  const valid = skill ? validateSkillContent(contentOf(skill)).errors === 0 : false;
  return [
    { id: 'heldout', text: 'Held-out ground truth revealed (and runs locked)', ok: loop.heldoutRevealedAt !== null },
    { id: 'valid', text: 'The final Skill passes validation', ok: valid },
    { id: 'lessons', text: 'Write what you learned (at least 30 characters)', ok: loop.reflection.lessons.trim().length >= 30 },
    { id: 'application', text: 'Write how you will apply it to a real project (at least 30 characters)', ok: loop.reflection.application.trim().length >= 30 },
  ];
}

export function designAdvice(skill: SkillDraft | null) {
  return skill ? designChecks(contentOf(skill)) : [];
}

/* ------------------------------------------------------------- match stats */

export interface MatchStat {
  conditionId: string;
  label: string;
  /** Cases where a verdict was recorded. */
  recorded: number;
  /** Cases where the verdict matched the simulation ground truth (only counted once graded). */
  matched: number;
  /** Cases graded against ground truth. */
  graded: number;
  total: number;
  unclear: number;
}

/** Verdict-match per condition. matched/graded are 0 and graded stays 0 until ground truth has been applied; never inferred. */
export function matchStats(exp: Experiment | null | undefined, caseIds: string[]): MatchStat[] {
  if (!exp) return [];
  return exp.conditions.map((c) => {
    const runs = caseIds.map((id) => runFor(exp, c.id, id)).filter((r): r is Run => Boolean(r) && r!.verdict !== null);
    const graded = runs.filter((r) => r.gradedTruth !== null);
    return {
      conditionId: c.id,
      label: c.label,
      recorded: runs.length,
      matched: graded.filter((r) => r.successMet === true).length,
      graded: graded.length,
      total: caseIds.length,
      unclear: runs.filter((r) => r.verdict === 'unclear').length,
    };
  });
}

export function pct(n: number, d: number): string {
  return d === 0 ? 'unknown' : `${n}/${d}`;
}

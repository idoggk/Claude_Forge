import { gradeItem } from '../assessment/grade';
import type { Mission, MissionRun, MissionStep, ItemStep, BranchStep } from './model';
import { stepById, successors } from './model';

/**
 * The mission state machine. Pure functions over a stored run: no clock, no database. Every move returns a new run, or an
 * error that says why the move is not allowed.
 *
 * Rules that protect evidence:
 *  - a step is answered once; after it is checked it is frozen and cannot change;
 *  - there is no backward navigation, so a frozen answer can never be altered by going back;
 *  - a run belongs to one content version; if the content changes, the old run stays as it was and a new one is started.
 */
export type MoveResult = { ok: true; run: MissionRun } | { ok: false; error: string };

export function newRun(m: Mission, id: string, now: string): MissionRun {
  return { id, schemaVersion: 1, kind: m.kind, missionId: m.id, missionVersion: m.version, status: 'in-progress', stepId: m.steps[0]!.id, path: [m.steps[0]!.id], answers: {}, frozen: [], results: [], hintsUsed: 0, branches: {}, resumes: 0, startedAt: now, updatedAt: now, completedAt: null };
}

export const isCurrent = (run: MissionRun, m: Mission): boolean => run.missionVersion === m.version;
export const isFrozen = (run: MissionRun, stepId: string): boolean => run.frozen.includes(stepId);

/** Record an answer for the current item step without checking it (so a refresh keeps what was typed). Frozen steps refuse. */
export function setAnswer(run: MissionRun, m: Mission, stepId: string, answer: unknown, now: string): MoveResult {
  const step = stepById(m, stepId);
  if (run.status === 'completed') return { ok: false, error: 'This run is finished.' };
  if (!step || step.type !== 'item') return { ok: false, error: 'That step takes no answer.' };
  if (stepId !== run.stepId) return { ok: false, error: 'That is not the current step.' };
  if (isFrozen(run, stepId)) return { ok: false, error: 'That answer is already checked and cannot change.' };
  return { ok: true, run: { ...run, answers: { ...run.answers, [stepId]: answer }, updatedAt: now } };
}

/** Check the current item step: grade it with the Academy's own grader, freeze it, and store the result. */
export function checkStep(run: MissionRun, m: Mission, stepId: string, hintsUsed: number, now: string): MoveResult {
  const step = stepById(m, stepId);
  if (run.status === 'completed') return { ok: false, error: 'This run is finished.' };
  if (!step || step.type !== 'item') return { ok: false, error: 'That step takes no answer.' };
  if (stepId !== run.stepId) return { ok: false, error: 'That is not the current step.' };
  if (isFrozen(run, stepId)) return { ok: false, error: 'That answer is already checked.' };
  if (step.frozenOnAnswer && hintsUsed > 0) return { ok: false, error: 'An independent challenge has no hints.' };
  const grade = gradeItem(step.item, run.answers[stepId]);
  if (!grade.answered) return { ok: false, error: 'Answer first.' };
  const result = { stepId, correct: grade.correct, score: grade.score, hintsUsed };
  return { ok: true, run: { ...run, frozen: [...run.frozen, stepId], results: [...run.results.filter((r) => r.stepId !== stepId), result], hintsUsed: run.hintsUsed + hintsUsed, updatedAt: now } };
}

export function chooseBranch(run: MissionRun, m: Mission, stepId: string, optionId: string, now: string): MoveResult {
  const step = stepById(m, stepId);
  if (run.status === 'completed') return { ok: false, error: 'This run is finished.' };
  if (!step || step.type !== 'branch') return { ok: false, error: 'That step is not a choice.' };
  if (stepId !== run.stepId) return { ok: false, error: 'That is not the current step.' };
  if (run.branches[stepId]) return { ok: false, error: 'That choice is already made.' };
  if (!step.options.some((o) => o.id === optionId)) return { ok: false, error: 'No such option.' };
  return { ok: true, run: { ...run, branches: { ...run.branches, [stepId]: optionId }, frozen: [...run.frozen, stepId], updatedAt: now } };
}

/** Whether the learner may move on from the current step. */
export function canAdvance(run: MissionRun, m: Mission): boolean {
  const step = stepById(m, run.stepId);
  if (!step || run.status === 'completed') return false;
  if (step.type === 'read') return true;
  return isFrozen(run, step.id);
}

export function advance(run: MissionRun, m: Mission, now: string): MoveResult {
  const step = stepById(m, run.stepId);
  if (!step) return { ok: false, error: 'The mission content changed; start a new run.' };
  if (!canAdvance(run, m)) return { ok: false, error: step.type === 'item' ? 'Check your answer first.' : step.type === 'branch' ? 'Choose first.' : 'Cannot continue.' };
  let nextId: string | undefined;
  if (step.type === 'branch') nextId = step.options.find((o) => o.id === run.branches[step.id])?.goto;
  else nextId = successors(m, step)[0];
  if (!nextId) return { ok: true, run: { ...run, status: 'completed', completedAt: now, updatedAt: now } };
  return { ok: true, run: { ...run, stepId: nextId, path: [...run.path, nextId], updatedAt: now } };
}

/**
 * Combine a run being saved with what is already stored under the same id. A tab that was opened before an answer was checked
 * (a second tab, a restored page) holds an older copy of the run; saving it blindly would replace a frozen answer with a new one.
 * Rules: a finished run is final; a step frozen in storage keeps its stored answer, result and branch; progress never moves
 * backwards. Everything else comes from the incoming run.
 */
export function mergeRuns(stored: MissionRun | undefined, incoming: MissionRun): MissionRun {
  if (!stored || stored.id !== incoming.id) return incoming;
  if (stored.status === 'completed') return stored;
  const kept = new Set(stored.frozen);
  const answers = { ...incoming.answers };
  const branches = { ...incoming.branches };
  for (const id of kept) {
    if (id in stored.answers) answers[id] = stored.answers[id];
    if (id in stored.branches) branches[id] = stored.branches[id]!;
  }
  const results = [...stored.results.filter((r) => kept.has(r.stepId)), ...incoming.results.filter((r) => !kept.has(r.stepId))];
  const ahead = stored.path.length > incoming.path.length ? stored : incoming;
  return {
    ...incoming,
    answers,
    branches,
    results,
    frozen: [...new Set([...stored.frozen, ...incoming.frozen])],
    hintsUsed: results.reduce((n, r) => n + r.hintsUsed, 0),
    path: ahead.path,
    stepId: ahead.stepId,
    resumes: Math.max(stored.resumes, incoming.resumes),
    startedAt: stored.startedAt,
    updatedAt: stored.updatedAt > incoming.updatedAt ? stored.updatedAt : incoming.updatedAt,
  };
}

/** Coming back to an unfinished run. Counted locally, only to see whether runs are picked up again. */
export const markResumed = (run: MissionRun, now: string): MissionRun => ({ ...run, resumes: run.resumes + 1, updatedAt: now });

/** What a learner is shown at the end. Descriptive: finishing is not proof of understanding. */
export function runSummary(run: MissionRun, m: Mission) {
  const items = m.steps.filter((s): s is ItemStep => s.type === 'item');
  // A prediction is made before the idea is taught, so a wrong one is expected and useful. It is shown, but not counted as a miss.
  const predictIds = new Set(items.filter((s) => s.phase === 'predict').map((s) => s.id));
  const scored = items.filter((s) => !predictIds.has(s.id));
  const answered = run.results.filter((r) => !predictIds.has(r.stepId)).length;
  const correct = run.results.filter((r) => !predictIds.has(r.stepId) && r.correct).length;
  const predictions = items.filter((s) => predictIds.has(s.id)).map((s) => ({ stepId: s.id, result: run.results.find((r) => r.stepId === s.id) ?? null }));
  const challenge = items.filter((s) => s.frozenOnAnswer).map((s) => ({ stepId: s.id, result: run.results.find((r) => r.stepId === s.id) ?? null }));
  const branches = m.steps.filter((s): s is BranchStep => s.type === 'branch').map((s) => ({ stepId: s.id, better: s.options.find((o) => o.id === run.branches[s.id])?.better ?? null }));
  return { answered, correct, total: scored.length, predictions, challenge, branches, hintsUsed: run.hintsUsed };
}

/** Position for the progress indicator along the path taken so far plus the steps still to come on the straight path. */
export function progressOf(run: MissionRun, m: Mission): { done: number; total: number } {
  const total = Math.max(m.steps.length, run.path.length);
  return { done: run.status === 'completed' ? total : Math.max(0, run.path.length - 1), total };
}

export const currentStep = (run: MissionRun, m: Mission): MissionStep | undefined => stepById(m, run.stepId);

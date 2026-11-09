import { z } from 'zod';
import type { CompetencyId, Item } from '../curriculum/types';

/**
 * Guided missions and Quick Sparks: one content-driven, step-based format.
 *
 * A step is a short screen with ONE action. The learner reads a beat, or decides, predicts, orders, finds a fault, builds a
 * small structure, or chooses a branch. Items reuse the Academy's own item types and graders, so nothing is graded twice
 * differently. Completing a mission or a spark is practice, not mastery: independent mastery still comes only from the
 * lesson's own assessment.
 */
export const PHASES = ['hook', 'predict', 'discover', 'practice', 'challenge', 'reflect'] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_LABELS: Record<Phase, string> = { hook: 'Hook', predict: 'Predict', discover: 'Discover', practice: 'Practice', challenge: 'Challenge', reflect: 'Reflect' };

export type MissionItemKind = 'single' | 'multi' | 'order' | 'flaglines' | 'case' | 'construct';
export const MISSION_ITEM_KINDS: MissionItemKind[] = ['single', 'multi', 'order', 'flaglines', 'case', 'construct'];

interface StepBase { id: string; phase: Phase }
export interface ReadStep extends StepBase { type: 'read'; title: string; /** Markdown, kept short. */ body: string; /** Label of the continue button. */ cta?: string }
export interface ItemStep extends StepBase {
  type: 'item';
  item: Item;
  /** Shown after the answer is checked, as the one thing to take away. */
  reveal?: string;
  /**
   * A challenge is independent: no hints, and once checked it is frozen for good. Practice and predict steps allow hints.
   * Neither raises a competency level.
   */
  frozenOnAnswer?: boolean;
}
export interface BranchOption { id: string; text: string; /** What happens as a result: shown, then the learner continues to `goto`. */ consequence: string; goto: string; /** Whether this is the better choice (for the end summary only; branches are not graded). */ better?: boolean }
export interface BranchStep extends StepBase { type: 'branch'; prompt: string; options: BranchOption[] }
export type MissionStep = ReadStep | ItemStep | BranchStep;

export interface NextLink { label: string; to: string }
export interface Mission {
  id: string;
  version: number;
  kind: 'mission' | 'spark';
  title: string;
  /** One line shown on cards. */
  tagline: string;
  objectives: string[];
  competencies: CompetencyId[];
  /** Mission ids or lesson ids that make this one easier. Advisory: nothing is locked. */
  prerequisites: string[];
  /** An editorial estimate, not a measurement of any learner's speed. */
  minutes: number;
  steps: MissionStep[];
  /** For a guided mission: the lesson whose own independent assessment is the evidence. */
  lessonId?: string;
  next: NextLink[];
}

/* ------------------------------------------------------------------------------------------ progress (stored) */

export const StepResultSchema = z.object({ stepId: z.string(), correct: z.boolean(), score: z.number().min(0).max(1), hintsUsed: z.number().int().min(0).default(0) });
export type StepResult = z.infer<typeof StepResultSchema>;

export const MissionRunSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1).default(1),
  kind: z.enum(['mission', 'spark']),
  missionId: z.string().min(1),
  /** The content version this run was started on. A run never silently moves to different content. */
  missionVersion: z.number().int().min(1),
  status: z.enum(['in-progress', 'completed']),
  /** Id of the step the learner is on. */
  stepId: z.string(),
  /** Steps visited, in order. */
  path: z.array(z.string()).max(200).default([]),
  /** Raw answers by step id, kept so a resumed or finished run can show what was chosen. */
  answers: z.record(z.string(), z.unknown()).default({}),
  /** Steps whose answer is checked and can no longer change. */
  frozen: z.array(z.string()).default([]),
  results: z.array(StepResultSchema).default([]),
  hintsUsed: z.number().int().min(0).default(0),
  /** Chosen option for each branch step. */
  branches: z.record(z.string(), z.string()).default({}),
  /** How many times the learner came back to an unfinished run. Local only. */
  resumes: z.number().int().min(0).default(0),
  startedAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable().default(null),
});
export type MissionRun = z.infer<typeof MissionRunSchema>;

/* ------------------------------------------------------------------------------------------ validation */

export interface MissionProblem { missionId: string; stepId: string | null; message: string }

export interface ValidationContext {
  lessonIds: ReadonlySet<string>;
  competencyIds: ReadonlySet<string>;
  /** Ids of other missions and sparks, for prerequisites. */
  missionIds: ReadonlySet<string>;
  /** Routes that exist, for `next` links: the validator checks a link starts with "/". */
}

const STEP_ORDER_OK = (phases: Phase[]): boolean => phases.every((p, i) => i === 0 || PHASES.indexOf(p) >= PHASES.indexOf(phases[i - 1]!) - 0);

/** The step a learner continues to after `step`, given any branch choice. null means the mission ends. */
export function successors(m: Mission, step: MissionStep): string[] {
  if (step.type === 'branch') return [...new Set(step.options.map((o) => o.goto))];
  const i = m.steps.findIndex((s) => s.id === step.id);
  const next = m.steps[i + 1];
  return next ? [next.id] : [];
}

export function validateMission(m: Mission, ctx: ValidationContext): MissionProblem[] {
  const out: MissionProblem[] = [];
  const p = (stepId: string | null, message: string) => out.push({ missionId: m.id, stepId, message });
  if (!/^[a-z0-9][a-z0-9-]*$/.test(m.id)) p(null, 'The id must be lowercase letters, digits and hyphens.');
  if (!Number.isInteger(m.version) || m.version < 1) p(null, 'The version must be a whole number of at least 1.');
  if (m.objectives.length < 1) p(null, 'It needs at least one learning objective.');
  if (m.competencies.length < 1) p(null, 'It needs at least one competency.');
  for (const c of m.competencies) if (!ctx.competencyIds.has(c)) p(null, `Unknown competency "${c}".`);
  for (const pre of m.prerequisites) if (!ctx.lessonIds.has(pre) && !ctx.missionIds.has(pre)) p(null, `Unknown prerequisite "${pre}".`);
  if (!(m.minutes > 0 && m.minutes <= 60)) p(null, 'The estimated minutes must be between 1 and 60.');
  if (m.steps.length < (m.kind === 'spark' ? 3 : 6)) p(null, `A ${m.kind} needs at least ${m.kind === 'spark' ? 3 : 6} steps.`);
  if (m.next.length < 1) p(null, 'It needs at least one next step.');
  for (const n of m.next) if (!n.to.startsWith('/')) p(null, `The next link "${n.label}" must be an in-app route.`);
  if (m.kind === 'mission') {
    if (!m.lessonId || !ctx.lessonIds.has(m.lessonId)) p(null, 'A guided mission must point at the lesson whose independent assessment is its evidence.');
    if (!m.steps.some((s) => s.type === 'item' && s.frozenOnAnswer)) p(null, 'A guided mission needs an independent challenge step (frozen on answer).');
    if (!m.steps.some((s) => s.type === 'item' && s.phase === 'predict')) p(null, 'A guided mission needs a prediction before the explanation.');
    const reflect = m.steps[m.steps.length - 1];
    if (!reflect || reflect.phase !== 'reflect') p(null, 'The last step of a guided mission must be the reflection.');
  }
  // The first screen must make the learner act within the first two steps (a hook is allowed to be a short read).
  const firstAction = m.steps.findIndex((s) => s.type !== 'read');
  if (firstAction === -1 || firstAction > 1) p(null, 'The learner must be asked to decide or predict within the first two steps.');

  const ids = m.steps.map((s) => s.id);
  if (new Set(ids).size !== ids.length) p(null, 'Step ids must be unique.');
  if (!STEP_ORDER_OK(m.steps.map((s) => s.phase))) p(null, 'Phases must not go backwards.');

  for (const s of m.steps) {
    if (s.type === 'read') {
      if (s.body.trim().length < 20) p(s.id, 'A read step needs real text.');
      if (s.body.length > 900) p(s.id, 'A read step is too long: split it (progressive disclosure).');
    } else if (s.type === 'item') {
      const it = s.item;
      if (!(MISSION_ITEM_KINDS as string[]).includes(it.kind)) p(s.id, `Item kind "${it.kind}" is not supported in missions.`);
      if (!it.explanation || it.explanation.length < 20) p(s.id, 'Every item needs an explanation shown as feedback.');
      if (it.kind === 'single' || it.kind === 'multi') {
        if (it.options.length < 3) p(s.id, 'A choice needs at least three options.');
        for (const o of it.options) if (o.why.trim().length < 12) p(s.id, `Option ${o.id} has no useful feedback.`);
        const correct = it.kind === 'single' ? [it.correct] : it.correct;
        for (const c of correct) if (!it.options.some((o) => o.id === c)) p(s.id, `The correct option "${c}" does not exist.`);
      }
      if (it.kind === 'case') for (const part of it.parts) {
        if (!part.options.some((o) => o.id === part.correct)) p(s.id, `Part ${part.id} has no correct option.`);
        for (const o of part.options) if (o.why.trim().length < 12) p(s.id, `Part ${part.id} option ${o.id} has no useful feedback.`);
      }
      if (s.frozenOnAnswer && it.hints && it.hints.length > 0) p(s.id, 'An independent challenge must not offer hints.');
    } else {
      if (s.options.length < 2) p(s.id, 'A branch needs at least two options.');
      for (const o of s.options) {
        if (!ids.includes(o.goto)) p(s.id, `Branch option ${o.id} goes to "${o.goto}", which does not exist.`);
        if (o.consequence.trim().length < 20) p(s.id, `Branch option ${o.id} has no useful consequence.`);
        else if (ids.indexOf(o.goto) <= ids.indexOf(s.id)) p(s.id, `Branch option ${o.id} goes backwards, which could loop.`);
      }
    }
  }

  // Every step is reachable from the first, and every path ends.
  const byId = new Map(m.steps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const stack = m.steps.length ? [m.steps[0]!.id] : [];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const step = byId.get(id);
    if (!step) continue;
    for (const n of successors(m, step)) stack.push(n);
  }
  for (const s of m.steps) if (!seen.has(s.id)) p(s.id, 'This step cannot be reached.');
  return out;
}

export const stepById = (m: Mission, id: string): MissionStep | undefined => m.steps.find((s) => s.id === id);

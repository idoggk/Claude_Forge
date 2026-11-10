import type { CompetencyId, FlagLinesItem, Item, MultiItem, Option, SingleItem, CaseItem, ConstructItem } from '@/domain/curriculum/types';
import type { BranchStep, ItemStep, Phase, ReadStep } from '@/domain/missions/model';
import { o } from '@/content/lessons/helpers';

/** Small constructors so a mission reads like its content. They add no behaviour: a step is plain data. */
export { o };
export type Opt = Option;

export const read = (id: string, phase: Phase, title: string, body: string, cta?: string): ReadStep => ({ id, phase, type: 'read', title, body, ...(cta ? { cta } : {}) });

interface Common { reveal?: string; hints?: string[]; frozen?: boolean; explanation: string; critical?: boolean }
const wrap = (id: string, phase: Phase, item: Item, c: Common): ItemStep => ({ id, phase, type: 'item', item, ...(c.reveal ? { reveal: c.reveal } : {}), ...(c.frozen ? { frozenOnAnswer: true } : {}) });

export const pick = (id: string, phase: Phase, concept: CompetencyId, prompt: string, options: Opt[], correct: string, c: Common): ItemStep => {
  const item: SingleItem = { id, kind: 'single', concept, prompt, options, correct, explanation: c.explanation, ...(c.hints && !c.frozen ? { hints: c.hints } : {}) };
  return wrap(id, phase, item, c);
};
export const multi = (id: string, phase: Phase, concept: CompetencyId, prompt: string, options: Opt[], correct: string[], c: Common): ItemStep => {
  const item: MultiItem = { id, kind: 'multi', concept, prompt, options, correct, explanation: c.explanation, ...(c.hints && !c.frozen ? { hints: c.hints } : {}) };
  return wrap(id, phase, item, c);
};
export const flag = (id: string, phase: Phase, concept: CompetencyId, prompt: string, filename: string, lines: string[], targets: FlagLinesItem['targets'], c: Common): ItemStep => {
  const item: FlagLinesItem = { id, kind: 'flaglines', concept, prompt, filename, lines, targets, explanation: c.explanation, ...(c.hints && !c.frozen ? { hints: c.hints } : {}) };
  return wrap(id, phase, item, c);
};
export const scenario = (id: string, phase: Phase, concept: CompetencyId, prompt: string, situation: string, constraints: string[], parts: CaseItem['parts'], c: Common): ItemStep => {
  const item: CaseItem = { id, kind: 'case', format: 'scenario', concept, prompt, situation, constraints, parts, explanation: c.explanation };
  return wrap(id, phase, item, c);
};
export const diagnosis = (id: string, phase: Phase, concept: CompetencyId, prompt: string, situation: string, artifact: string[], parts: CaseItem['parts'], c: Common): ItemStep => {
  const item: CaseItem = { id, kind: 'case', format: 'diagnosis', concept, prompt, situation, artifact, parts, explanation: c.explanation };
  return wrap(id, phase, item, c);
};
export const build = (id: string, phase: Phase, concept: CompetencyId, prompt: string, brief: string, checks: ConstructItem['checks'], rubric: string[], reference: string, c: Common & { placeholder?: string }): ItemStep => {
  const item: ConstructItem = { id, kind: 'construct', format: 'json', concept, prompt, brief, checks, rubric, reference, explanation: c.explanation, ...(c.placeholder ? { placeholder: c.placeholder } : {}) };
  return wrap(id, phase, item, c);
};
export const branch = (id: string, phase: Phase, prompt: string, options: BranchStep['options']): BranchStep => ({ id, phase, type: 'branch', prompt, options });
export const part = (id: string, label: string, options: Opt[], correct: string) => ({ id, label, options, correct });

/** Parse helpers for construct checks. */
export const parse = (s: string): Record<string, unknown> | null => { try { const v = JSON.parse(s); return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null; } catch { return null; } };
export const rows = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []);
export const text = (v: unknown) => (typeof v === 'string' ? v : '');

import { describe, expect, it } from 'vitest';
import { UNITS, MISSIONS_ONLY, SPARKS_ONLY, validateAllUnits, unitForLesson } from '@/content/units/registry';
import { LESSONS } from '@/content/lessons';
import { gradeItem } from '@/domain/assessment/grade';
import { advance, chooseBranch, checkStep, newRun, setAnswer } from '@/domain/missions/engine';
import { MISSION_ITEM_KINDS, type ItemStep, type Mission } from '@/domain/missions/model';
import { perfectAnswer, wrongAnswer } from './helpers';
import { allItems as lessonItems, absoluteWordCue, choiceItems, duplicateChoices, longestCorrectShare, emptyFeedback, weakDistractors, type AuditItem } from '@/domain/curriculum/audit';

const itemSteps = (m: Mission): ItemStep[] => m.steps.filter((s): s is ItemStep => s.type === 'item');
const asAudit = (m: Mission): AuditItem[] => itemSteps(m).map((s) => ({ lessonId: m.id, where: 'activity' as const, item: s.item }));
const T = '2026-11-09T10:00:00.000Z';

describe('guided missions and Quick Sparks', () => {
  it('every unit validates (references, feedback, branches, reachability, phases, early action)', () => {
    expect(validateAllUnits()).toEqual([]);
  });
  it('ids are unique and versions are set', () => {
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(UNITS.length);
    for (const u of UNITS) expect(u.version).toBeGreaterThanOrEqual(1);
  });
  it('there are five guided missions on five different lessons, each tied to that lesson\'s own independent assessment', () => {
    expect(MISSIONS_ONLY.map((m) => m.lessonId)).toEqual(['L01-skill-or-tool', 'L12-context-engineering', 'L21-prompt-injection-trust-boundaries', 'L13-why-agents-fail', 'L23-evaluation-harnesses']);
    for (const m of MISSIONS_ONLY) {
      expect(unitForLesson(m.lessonId!)).toBe(m);
      expect(m.next.some((n) => n.to === `/academy/lesson/${m.lessonId}`), `${m.id} routes to the assessment`).toBe(true);
      expect(LESSONS.find((l) => l.id === m.lessonId)).toBeTruthy();
    }
  });
  it('each mission follows hook, predict, discover, practice, challenge, reflect and uses at least three interaction types', () => {
    for (const m of MISSIONS_ONLY) {
      const phases = new Set(m.steps.map((s) => s.phase));
      for (const p of ['hook', 'predict', 'discover', 'practice', 'challenge', 'reflect']) expect(phases.has(p as never), `${m.id}: ${p}`).toBe(true);
      const types = new Set(m.steps.map((s) => (s.type === 'item' ? s.item.kind : s.type)));
      types.delete('read');
      expect(types.size, `${m.id}: ${[...types]}`).toBeGreaterThanOrEqual(3);
      expect(m.steps.filter((s) => s.type === 'read').length, `${m.id}: not a wall of reading`).toBeLessThanOrEqual(Math.ceil(m.steps.length / 2));
    }
  });
  it('the missions use more than one kind of interaction between them, including a branch, a find-the-fault, a diagnosis and a construction', () => {
    const kinds = new Set(MISSIONS_ONLY.flatMap((m) => m.steps.map((s) => (s.type === 'item' ? (s.item.kind === 'case' ? `case:${s.item.format}` : s.item.kind) : s.type))));
    for (const k of ['branch', 'flaglines', 'case:diagnosis', 'case:scenario', 'construct', 'multi', 'single']) expect(kinds.has(k), k).toBe(true);
  });
  it('every item step is gradable: a perfect answer is correct, a wrong one is not, and reference solutions pass', () => {
    for (const u of UNITS) for (const s of itemSteps(u)) {
      expect((MISSION_ITEM_KINDS as string[]).includes(s.item.kind)).toBe(true);
      expect(gradeItem(s.item, perfectAnswer(s.item)).correct, `${u.id}/${s.id}`).toBe(true);
      expect(gradeItem(s.item, wrongAnswer(s.item)).correct, `${u.id}/${s.id} wrong accepted`).toBe(false);
    }
  });
  it('a perfect walk through every unit through the real state machine completes it', () => {
    for (const u of UNITS) {
      let run = newRun(u, `r-${u.id}`, T);
      let guard = 0;
      while (run.status === 'in-progress' && guard++ < 60) {
        const step = u.steps.find((s) => s.id === run.stepId)!;
        let r;
        if (step.type === 'item') {
          const a = setAnswer(run, u, step.id, perfectAnswer(step.item), T); if (!a.ok) throw new Error(a.error);
          const c = checkStep(a.run, u, step.id, 0, T); if (!c.ok) throw new Error(c.error);
          r = advance(c.run, u, T);
        } else if (step.type === 'branch') {
          const b = chooseBranch(run, u, step.id, step.options[0]!.id, T); if (!b.ok) throw new Error(b.error);
          r = advance(b.run, u, T);
        } else r = advance(run, u, T);
        if (!r.ok) throw new Error(`${u.id}: ${r.error}`);
        run = r.run;
      }
      expect(run.status, u.id).toBe('completed');
    }
  });
  it('the independent challenge in each mission is new: it is not an item from the lesson\'s own assessment or pools', () => {
    for (const m of MISSIONS_ONLY) {
      const lesson = LESSONS.find((l) => l.id === m.lessonId)!;
      const lessonPrompts = new Set(lessonItems([lesson]).map((x) => x.item.prompt.toLowerCase()));
      for (const s of itemSteps(m)) expect(lessonPrompts.has(s.item.prompt.toLowerCase()), `${m.id}/${s.id}`).toBe(false);
    }
  });
  it('the unit items meet the same assessment-quality gates as the lessons (no length cue, no duplicate or empty options, every option explained)', () => {
    const items = UNITS.flatMap(asAudit);
    expect(longestCorrectShare(items).share).toBeLessThanOrEqual(0.25);
    expect(duplicateChoices(items)).toEqual([]);
    expect(weakDistractors(items)).toEqual([]);
    expect(emptyFeedback(items)).toEqual([]);
    const cue = absoluteWordCue(items);
    expect(cue.wrong - cue.right).toBeLessThanOrEqual(0.25);
    expect(choiceItems(items).length).toBeGreaterThan(5);
  });
  it('the right option is not systematically in one place or one length', () => {
    let longest = 0, shortest = 0, n = 0;
    for (const u of UNITS) for (const s of itemSteps(u)) {
      const parts = s.item.kind === 'single' ? [{ options: s.item.options, correct: s.item.correct }] : s.item.kind === 'case' ? s.item.parts : [];
      for (const p of parts) { n++; const c = p.options.find((x) => x.id === p.correct)!; const oth = p.options.filter((x) => x !== c); if (oth.every((x) => c.text.length > x.text.length)) longest++; if (oth.every((x) => c.text.length < x.text.length)) shortest++; }
    }
    expect(longest / n).toBeLessThanOrEqual(0.45);
    expect(shortest / n).toBeLessThanOrEqual(0.55);
  });
  it('sparks are short, resumable units that never claim mastery', () => {
    for (const s of SPARKS_ONLY) { expect(s.minutes).toBeLessThanOrEqual(4); expect(s.steps.length).toBeLessThanOrEqual(6); }
  });
});

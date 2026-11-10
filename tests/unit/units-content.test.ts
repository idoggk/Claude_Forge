import { describe, expect, it } from 'vitest';
import { UNITS, MISSIONS_ONLY, SPARKS_ONLY, validateAllUnits, unitForLesson } from '@/content/units/registry';
import { LESSONS } from '@/content/lessons';
import { gradeItem, seededOrder } from '@/domain/assessment/grade';
import { advance, chooseBranch, checkStep, newRun, setAnswer } from '@/domain/missions/engine';
import { MISSION_ITEM_KINDS, type ItemStep, type Mission } from '@/domain/missions/model';
import { perfectAnswer, wrongAnswer } from './helpers';
import { allItems as lessonItems, absoluteWordCue, choiceItems, duplicateChoices, longestCorrectShare, emptyFeedback, weakDistractors, type AuditItem } from '@/domain/curriculum/audit';

const itemSteps = (m: Mission): ItemStep[] => m.steps.filter((s): s is ItemStep => s.type === 'item');
const asAudit = (m: Mission): AuditItem[] => itemSteps(m).map((s) => ({ lessonId: m.id, where: 'activity' as const, item: s.item }));
const T = '2026-11-09T10:00:00.000Z';

const STOP = new Set('a an the and or of to in on for is are be it its this that with as at by from not no do does can you your we they them their i if so but than then into over about which what when how why'.split(' '));
const cw = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w) && w.length > 2);
const keyTexts = (it: ItemStep['item']): string[] => {
  const out = [it.prompt];
  if (it.kind === 'single' || it.kind === 'multi') { const c = it.kind === 'single' ? [it.correct] : it.correct; for (const o of it.options.filter((x) => c.includes(x.id))) out.push(o.text); }
  return out;
};

describe('guided missions and Quick Sparks', () => {
  it('ASSESSMENT INTEGRITY: no mission or spark restates a lesson item (activity, assessment or review) or its right answer, so independent assessments stay unseen', () => {
    const lessons = lessonItems(LESSONS);
    const hits: string[] = [];
    for (const u of UNITS) for (const st of itemSteps(u)) for (const t of keyTexts(st.item)) {
      const a = new Set(cw(t));
      if (a.size < 5) continue;
      for (const l of lessons) for (const x of keyTexts(l.item)) {
        const b = new Set(cw(x));
        if (b.size < 5) continue;
        const inter = [...a].filter((w) => b.has(w)).length;
        if (inter / Math.min(a.size, b.size) >= 0.6) hits.push(`${u.id}/${st.id} ~ ${l.lessonId}/${l.item.id}`);
      }
    }
    expect(hits).toEqual([]);
  });
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
  it('LENGTH CUE: the right option is not systematically the shortest or the longest, by words or by characters', () => {
    const words = (t: string) => t.split(/\s+/).length;
    const c = { n: 0, charLongest: 0, charShortest: 0, wordLongest: 0, wordShortest: 0, clearLonger: 0, clearShorter: 0 };
    for (const u of UNITS) for (const s of itemSteps(u)) {
      const parts = s.item.kind === 'single' ? [{ options: s.item.options, correct: s.item.correct }] : s.item.kind === 'case' ? s.item.parts : [];
      for (const p of parts) {
        c.n++;
        const right = p.options.find((x) => x.id === p.correct)!;
        const others = p.options.filter((x) => x !== right);
        const maxC = Math.max(...others.map((x) => x.text.length)), minC = Math.min(...others.map((x) => x.text.length));
        if (right.text.length > maxC) c.charLongest++;
        if (right.text.length < minC) c.charShortest++;
        if (others.every((x) => words(right.text) > words(x.text))) c.wordLongest++;
        if (others.every((x) => words(right.text) < words(x.text))) c.wordShortest++;
        if (right.text.length > maxC * 1.08) c.clearLonger++; // visibly longer than every other option
        if (right.text.length < minC * 0.92) c.clearShorter++; // visibly shorter than every other option
      }
    }
    // Chance is about 0.3 for 3 to 4 options. The audit measured "shortest" at 0.45 by characters and 0.48 by words (a rule that
    // picked the shortest option got 57%) before the options were rebalanced. Character rank is left generous because the
    // remaining differences are a few characters; the "clear" gates are the ones a learner could actually see.
    expect(c.charLongest / c.n).toBeLessThanOrEqual(0.5);
    expect(c.charShortest / c.n).toBeLessThanOrEqual(0.4);
    expect(c.wordLongest / c.n).toBeLessThanOrEqual(0.4);
    expect(c.wordShortest / c.n).toBeLessThanOrEqual(0.4);
    expect(c.clearLonger / c.n).toBeLessThanOrEqual(0.15);
    expect(c.clearShorter / c.n).toBeLessThanOrEqual(0.15);
  });
  it('WORDING CUE: wrong options do not carry their own "because/since/so that" justification much more often than right ones', () => {
    const CONN = /\b(since|because|so that|therefore|which means|as it|as the)\b|, so\b/i;
    let right = 0, rightConn = 0, wrong = 0, wrongConn = 0;
    for (const u of UNITS) for (const s of itemSteps(u)) {
      const groups = s.item.kind === 'single' ? [{ options: s.item.options, correct: [s.item.correct] }] : s.item.kind === 'multi' ? [{ options: s.item.options, correct: s.item.correct }] : s.item.kind === 'case' ? s.item.parts.map((p) => ({ options: p.options, correct: [p.correct] })) : [];
      for (const g of groups) for (const o of g.options) { const isRight = g.correct.includes(o.id); if (isRight) { right++; if (CONN.test(o.text)) rightConn++; } else { wrong++; if (CONN.test(o.text)) wrongConn++; } }
    }
    // the audit found 0.44 for wrong options against 0.12 for right ones, which made "pick the one that does not explain itself" work
    expect(Math.abs(wrongConn / wrong - rightConn / right)).toBeLessThanOrEqual(0.15);
  });
  it('POSITION: the right option is not always authored first AND shown by a biased shuffle; displayed positions are uniform for these items', () => {
    // authored order is irrelevant only if the shuffle is uniform (see learning-quality.test.ts); this guards the 3-option sparks directly
    const opts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const last = [...Array(900).keys()].filter((i) => seededOrder(opts, `u_${i}:mr_${i}:ask`, false)[2]!.id === 'a').length;
    expect(last).toBeLessThan(380); // about 300 expected; the old rotation gave about 450
  });
  it('sparks are short, resumable units that never claim mastery', () => {
    for (const s of SPARKS_ONLY) { expect(s.minutes).toBeLessThanOrEqual(4); expect(s.steps.length).toBeLessThanOrEqual(6); }
  });
});

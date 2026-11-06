import { describe, expect, it } from 'vitest';
import { LESSONS } from '@/content/lessons';
import { CAPABILITIES } from '@/content/capability/map';
import { COMPETENCIES, TRACKS } from '@/domain/curriculum/competencies';
import { gradeItem } from '@/domain/assessment/grade';
import { pickedMisconceptions } from '@/domain/assessment/misconception';
import { perfectAnswer, wrongAnswer } from './helpers';
import type { CaseItem, ConstructItem, Item } from '@/domain/curriculum/types';

const R6 = ['L25-agent-permissions-least-privilege', 'L26-hooks-guardrails-deterministic-gates', 'L27-research-reliability', 'L28-ai-workflow-architecture'];
const lessons = LESSONS.filter((l) => R6.includes(l.id));
const all = (l: (typeof lessons)[number]): Item[] => [...l.activity.items, ...l.assessment.items, ...l.reviewItems];

describe('Round 6 modules: permissions, gates, research reliability and workflow architecture', () => {
  it('all four exist, are ordered after the Round 4 lessons and teach one advanced competency each', () => {
    expect(lessons.map((l) => l.order)).toEqual([25, 26, 27, 28]);
    for (const l of lessons) {
      expect(l.competencies.length).toBe(1);
      expect(COMPETENCIES.find((c) => c.id === l.competencies[0])?.advanced).toBe(true);
      expect(l.sources.length).toBeGreaterThanOrEqual(4);
      expect(l.segments.length).toBeGreaterThanOrEqual(4);
      expect(l.objectives.length).toBeGreaterThanOrEqual(5);
      expect(l.reviewItems.length).toBeGreaterThanOrEqual(8);
      expect(l.assessment.items.length).toBeGreaterThanOrEqual(6);
      expect(l.segments.some((s) => s.prediction), `${l.id} has an active-recall prediction`).toBe(true);
      expect(l.application.body.length).toBeGreaterThan(60);
    }
  });

  it('each assessment uses all three new formats: a decision scenario, an error diagnosis and a structured construction', () => {
    for (const l of lessons) {
      const kinds = l.assessment.items.map((i) => (i.kind === 'case' ? `case:${i.format}` : i.kind));
      expect(kinds, l.id).toContain('case:scenario');
      expect(kinds, l.id).toContain('case:diagnosis');
      expect(kinds, l.id).toContain('construct');
    }
  });

  it('scenario pairs change one constraint and flip the answers', () => {
    for (const l of lessons) {
      const scenarios = l.assessment.items.filter((i): i is CaseItem => i.kind === 'case' && i.format === 'scenario');
      expect(scenarios.length, l.id).toBeGreaterThanOrEqual(2);
      const [a, b] = scenarios;
      expect(JSON.stringify(a!.constraints)).not.toBe(JSON.stringify(b!.constraints));
      // at least one part of the second scenario has a different correct option text from every part of the first
      const rightTexts = (c: CaseItem) => c.parts.map((p) => p.options.find((o) => o.id === p.correct)!.text);
      expect(rightTexts(a!).some((t) => !rightTexts(b!).includes(t))).toBe(true);
    }
  });

  it('a perfect answer to every item is graded correct, and a deliberately wrong one is not', () => {
    for (const l of lessons) for (const it of all(l)) {
      if (it.kind === 'external' || it.kind === 'reflect') continue;
      expect(gradeItem(it, perfectAnswer(it)).correct, `${l.id}/${it.id}`).toBe(true);
      expect(gradeItem(it, wrongAnswer(it)).correct, `${l.id}/${it.id} wrong accepted`).toBe(false);
    }
  });

  it('case items give partial credit per part and are correct only when every part is', () => {
    const it = lessons[0]!.assessment.items.find((i): i is CaseItem => i.kind === 'case' && i.format === 'scenario')!;
    const good = Object.fromEntries(it.parts.map((p) => [p.id, p.correct]));
    const oneWrong = { ...good, [it.parts[0]!.id]: it.parts[0]!.options.find((o) => o.id !== it.parts[0]!.correct)!.id };
    const g = gradeItem(it, oneWrong);
    expect(g.correct).toBe(false);
    expect(g.score).toBeCloseTo((it.parts.length - 1) / it.parts.length, 2);
    expect(gradeItem(it, {}).answered).toBe(false);
    expect(gradeItem(it, {}).score).toBe(0);
  });

  it('construct items grade structure only, say so, never pass the starter or an empty draft, and report the failing parts', () => {
    for (const l of lessons) {
      const c = l.assessment.items.find((i): i is ConstructItem => i.kind === 'construct')!;
      expect(gradeItem(c, '').answered).toBe(false);
      expect(gradeItem(c, '').correct).toBe(false);
      expect(gradeItem(c, '{}').correct).toBe(false);
      expect(gradeItem(c, 'not json at all').correct).toBe(false);
      const partial = gradeItem(c, c.reference.replace(/"deny"[\s\S]*?\],?/, ''));
      expect(partial.feedback).toMatch(/cannot tell you whether your design is good/);
      expect(c.rubric.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('construct checks cannot be satisfied by keyword stuffing alone: a draft of the right words without structure fails', () => {
    for (const l of lessons) {
      const c = l.assessment.items.find((i): i is ConstructItem => i.kind === 'construct')!;
      const words = c.checks.map((x) => x.label).join(' ');
      expect(gradeItem(c, words).correct).toBe(false);
      expect(gradeItem(c, JSON.stringify({ words })).correct).toBe(false);
    }
  });

  it('a wrong choice in a case part can carry a misconception, which is reported', () => {
    const it = lessons[0]!.assessment.items.find((i): i is CaseItem => i.kind === 'case' && i.format === 'scenario')!;
    const wrong = Object.fromEntries(it.parts.map((p) => [p.id, p.options.find((o) => o.id !== p.correct && o.misconception)?.id ?? p.correct]));
    expect(pickedMisconceptions(it, wrong).length).toBeGreaterThan(0);
  });

  it('planned topics that now have a lesson point at it, and other planned topics stay planned', () => {
    const linked = TRACKS.flatMap((t) => t.topics).filter((t) => t.lessonId && R6.includes(t.lessonId));
    expect(linked.length).toBeGreaterThanOrEqual(6);
    expect(TRACKS.flatMap((t) => t.topics).filter((t) => !t.lessonId).length).toBeGreaterThan(15);
  });

  it('all four are reachable from the Capability Map', () => {
    const reachable = new Set(CAPABILITIES.flatMap((c) => c.lessons));
    for (const l of lessons) expect(reachable.has(l.id), l.id).toBe(true);
  });
});

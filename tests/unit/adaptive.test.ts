import { describe, expect, it } from 'vitest';
import { LESSONS } from '@/content/lessons';
import { MIXED_EXERCISES } from '@/content/interleaved';
import { adaptiveSuggestions, competencyEvidence } from '@/domain/mastery/adaptive';
import { gradeItem } from '@/domain/assessment/grade';
import { lessonStatus } from '@/domain/mastery/recommend';
import type { Attempt } from '@/persistence/schemas';
import type { CaseItem } from '@/domain/curriculum/types';

const L = LESSONS.find((l) => l.id === 'L21-prompt-injection-trust-boundaries')!;
const C = L.competencies[0]!;
let n = 0;
const attempt = (over: Partial<Attempt> & { score?: number } = {}): Attempt => {
  const s = over.score ?? 1;
  return { id: `a${++n}`, lessonId: L.id, lessonVersion: L.version, stage: 'assessment', startedAt: '2026-01-01T00:00:00.000Z', submittedAt: '2026-01-01T00:00:00.000Z', attemptNumber: 1, answers: {}, results: [], score: s, passed: s >= 0.7, criticalFailed: [], hintsUsed: 0, confidence: 3, predictedPct: null, independent: true, unseen: true, conceptResults: { [C]: { score: s, items: 5, criticalFailed: false } }, ...over } as Attempt;
};
const input = (attempts: Attempt[], extra: Partial<Parameters<typeof adaptiveSuggestions>[0]> = {}) => ({ lessons: LESSONS, attempts, misconceptionHits: [], completedTransfers: 0, ...extra });

describe('adaptive suggestions explain themselves', () => {
  it('no evidence means no suggestion: clicking through lessons never raises difficulty', () => {
    expect(adaptiveSuggestions(input([]))).toEqual([]);
  });
  it('every suggestion states why, the evidence, what it trains and what would count as improvement', () => {
    const s = adaptiveSuggestions(input([attempt({ confidence: 5, score: 0.3, independent: true })]));
    expect(s.length).toBeGreaterThan(0);
    for (const x of s) {
      expect(x.why.length).toBeGreaterThan(20);
      expect(x.evidence.length).toBeGreaterThan(0);
      expect(x.improvement.length).toBeGreaterThan(20);
      expect(x.competencies.length).toBeGreaterThan(0);
      expect(x.to).toMatch(/^\//);
    }
  });
  it('confident and wrong leads to a foundation review that quotes the confidence and the score', () => {
    const [top] = adaptiveSuggestions(input([attempt({ confidence: 5, score: 0.25 })]));
    expect(top!.tier).toBe('foundation');
    expect(top!.evidence[0]).toMatch(/confidence 5 of 5 and scored 25%/);
    expect(top!.to).toBe(`/academy/lesson/${L.id}`);
  });
  it('a repeated misconception, not a single slip, triggers a review that names the belief', () => {
    const id = 'summary-is-safe-memory';
    expect(adaptiveSuggestions(input([], { misconceptionHits: [{ id, lessonId: 'x' }] }))).toEqual([]);
    const s = adaptiveSuggestions(input([], { misconceptionHits: [{ id, lessonId: 'x' }, { id, lessonId: 'y' }] }));
    expect(s[0]!.tier).toBe('foundation');
    expect(s[0]!.evidence[0]).toMatch(/2 times/);
  });
  it('guided-only evidence leads to an independent assessment, not to harder work', () => {
    const s = adaptiveSuggestions(input([attempt({ independent: false, hintsUsed: 2, score: 0.8 })]));
    expect(s.map((x) => x.tier)).toContain('standard');
    expect(s.map((x) => x.tier)).not.toContain('harder');
  });
  it('harder work needs repeated independent, unseen, strong results and no calibration problem', () => {
    const one = adaptiveSuggestions(input([attempt({ score: 0.95 })]));
    expect(one.map((x) => x.tier)).not.toContain('harder');
    const two = adaptiveSuggestions(input([attempt({ score: 0.95 }), attempt({ score: 0.9 })]));
    expect(two.map((x) => x.tier)).toContain('harder');
    const overconfident = adaptiveSuggestions(input([attempt({ score: 0.95 }), attempt({ score: 0.9 }), attempt({ score: 0.3, confidence: 5 })]));
    expect(overconfident.map((x) => x.tier)).not.toContain('harder');
  });
  it('practice attempts and seen-before attempts never count as independent evidence', () => {
    const ev = competencyEvidence(LESSONS, [attempt({ stage: 'practice' as never, score: 1 }), attempt({ unseen: false, score: 1 })])[C]!;
    expect(ev.independentPasses).toBe(0);
  });
  it('attempts on a superseded lesson version are not current evidence, and are reported as stale', () => {
    const ev = competencyEvidence(LESSONS, [attempt({ lessonVersion: L.version - 1 })])[C]!;
    expect(ev.current).toBe(0);
    expect(ev.staleOnly).toBe(true);
    expect(adaptiveSuggestions(input([attempt({ lessonVersion: L.version - 1, confidence: 5, score: 0.1 })]))).toEqual([]);
  });
  it('transfer is suggested only after strong independent evidence and only until a transfer is completed', () => {
    const a = [attempt({ score: 0.95 })];
    expect(adaptiveSuggestions(input(a)).map((x) => x.tier)).toContain('transfer');
    expect(adaptiveSuggestions(input(a, { completedTransfers: 1 })).map((x) => x.tier)).not.toContain('transfer');
    expect(adaptiveSuggestions(input(a)).find((x) => x.tier === 'transfer')!.improvement).toMatch(/self-reported/);
  });
  it('cross-topic practice appears for a learner who is independent in at least one of the combined competencies', () => {
    const s = adaptiveSuggestions(input([attempt({ score: 0.9 })]));
    expect(s.some((x) => x.tier === 'cross-topic' && x.to.startsWith('/practice/'))).toBe(true);
  });
  it('is deterministic and has no duplicates', () => {
    const a = [attempt({ score: 0.95 }), attempt({ score: 0.9 })];
    const x = adaptiveSuggestions(input(a));
    expect(adaptiveSuggestions(input(a))).toEqual(x);
    expect(new Set(x.map((s) => `${s.tier}|${s.to}`)).size).toBe(x.length);
  });
  it('a suggestion changes no lesson status or mastery by itself', () => {
    const a = [attempt({ confidence: 5, score: 0.2 })];
    const before = lessonStatus(L, a, []);
    adaptiveSuggestions(input(a));
    expect(lessonStatus(L, a, [])).toBe(before);
  });
});

describe('interleaved exercises', () => {
  it('each combines at least two topics, is a complete case, and is gradable', () => {
    expect(MIXED_EXERCISES.length).toBeGreaterThanOrEqual(5);
    for (const m of MIXED_EXERCISES) {
      expect(m.competencies.length, m.id).toBeGreaterThanOrEqual(2);
      const it: CaseItem = m.item;
      expect(it.parts.length, m.id).toBeGreaterThanOrEqual(3);
      for (const p of it.parts) {
        expect(p.options.map((o) => o.id), `${m.id}/${p.id}`).toContain(p.correct);
        p.options.forEach((o) => expect(o.why.length).toBeGreaterThanOrEqual(12));
      }
      expect(gradeItem(it, Object.fromEntries(it.parts.map((p) => [p.id, p.correct]))).correct, m.id).toBe(true);
      expect(gradeItem(it, Object.fromEntries(it.parts.map((p) => [p.id, p.options.find((o) => o.id !== p.correct)!.id]))).correct, m.id).toBe(false);
      if (it.format === 'scenario') expect((it.constraints ?? []).length).toBeGreaterThanOrEqual(3);
    }
  });
  it('the right option is not the longest by a wide margin in most parts', () => {
    let leak = 0, parts = 0;
    for (const m of MIXED_EXERCISES) for (const p of m.item.parts) {
      const c = p.options.find((o) => o.id === p.correct)!;
      parts++;
      if (p.options.filter((o) => o !== c).every((o) => c.text.length >= o.text.length * 1.25)) leak++;
    }
    expect(leak / parts).toBeLessThanOrEqual(0.4);
  });
});

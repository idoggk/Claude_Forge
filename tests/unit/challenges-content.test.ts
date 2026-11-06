import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '@/content/challenges';
import { FIXTURE_VIEWS } from '@/content/challenges/fixtures';
import { scoreEngine } from '@/domain/challenges/lab';
import { LESSONS } from '@/content/lessons';

describe('challenge content', () => {
  it('there are four, each complete', () => {
    expect(CHALLENGES.map((c) => c.id)).toEqual(['extraction', 'research', 'agent', 'context']);
    for (const c of CHALLENGES) {
      for (const k of ['problem', 'objective', 'fixture', 'task', 'honesty'] as const) expect(c[k].length, `${c.id}.${k}`).toBeGreaterThan(20);
      expect(c.guided.steps.length).toBeGreaterThanOrEqual(3);
      expect(c.hints.length).toBeGreaterThanOrEqual(3);
      expect(c.rubric.length).toBeGreaterThanOrEqual(4);
      expect(c.commonMistakes.length).toBeGreaterThanOrEqual(3);
      expect(FIXTURE_VIEWS[c.id]!().length).toBeGreaterThan(0);
    }
  });
  it('every reference solution passes its own engine, using only options that exist', () => {
    for (const c of CHALLENGES) {
      const ids = new Set(c.engine.groups.flatMap((g) => g.options.map((o) => o.id)));
      for (const id of c.reference.selected) expect(ids.has(id), `${c.id}:${id}`).toBe(true);
      expect(c.engine.run(c.reference.selected).passed, c.id).toBe(true);
    }
  });
  it('a perfect attempt scores 100% and an empty one is low', () => {
    for (const c of CHALLENGES) {
      const answers = Object.fromEntries(c.engine.questions().map((q) => [q.id, q.correct[0]!]));
      expect(scoreEngine(c.engine, c.reference.selected, answers).score, c.id).toBe(1);
      expect(scoreEngine(c.engine, [], {}).score, c.id).toBeLessThan(0.4);
    }
  });
  it('every question has at least one correct option that exists, and no duplicate ids', () => {
    for (const c of CHALLENGES) for (const q of c.engine.questions()) {
      expect(q.correct.length).toBeGreaterThan(0);
      for (const id of q.correct) expect(q.options.some((o) => o.id === id), `${c.id}.${q.id}`).toBe(true);
      expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
    }
  });
  it('the transfer destinations are real lessons', () => {
    for (const c of CHALLENGES) expect(LESSONS.some((l) => l.id === c.transfer.lessonId), c.id).toBe(true);
  });
});

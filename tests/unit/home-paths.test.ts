import { describe, expect, it } from 'vitest';
import { HOME_PATHS } from '@/content/home/paths';
import { pathStats } from '@/domain/mastery/paths';
import { LESSONS } from '@/content/lessons';
import { TRACKS } from '@/domain/curriculum/competencies';
import type { Attempt } from '@/persistence/schemas';
import { MISSIONS } from '@/content/missions';

const attempt = (lessonId: string, version: number, passed: boolean): Attempt => ({
  id: `a-${lessonId}-${passed}`, lessonId, lessonVersion: version, stage: 'assessment', startedAt: 't', submittedAt: '2026-11-06T00:00:00Z', attemptNumber: 1, answers: {}, results: [], score: passed ? 1 : 0.2, passed, criticalFailed: [], hintsUsed: 0,
  confidence: null, predictedPct: null, independent: true, unseen: true, conceptResults: {},
} as unknown as Attempt);

describe('the four learning paths are views over the real lessons', () => {
  it('every track belongs to exactly one path and every lesson to exactly one path, so the counts always add up to the Academy', () => {
    const tracks = HOME_PATHS.flatMap((p) => p.trackIds);
    expect(new Set(tracks).size).toBe(tracks.length);
    expect([...tracks].sort()).toEqual(TRACKS.map((t) => t.id).sort());
    const total = HOME_PATHS.map((p) => pathStats(p.trackIds, LESSONS, [], []).total);
    expect(total.reduce((a, b) => a + b, 0)).toBe(LESSONS.length);
    expect(HOME_PATHS.map((p) => p.id)).toEqual(['ai-engineering', 'game-development', 'agents-automation', 'research-verification']);
  });

  it('a path with no progress shows 0 passed of its real total, never a made-up figure', () => {
    for (const p of HOME_PATHS) {
      const s = pathStats(p.trackIds, LESSONS, [], []);
      expect(s.passed).toBe(0);
      expect(s.started).toBe(0);
      expect(s.total).toBeGreaterThan(0);
      expect(s.next).not.toBeNull();
    }
  });

  it('passing a lesson counts once, in its own path only, and moves "next" on', () => {
    const l = LESSONS.find((x) => x.id.startsWith('L06'))!; // game development
    const before = pathStats(HOME_PATHS[1]!.trackIds, LESSONS, [], []);
    const after = pathStats(HOME_PATHS[1]!.trackIds, LESSONS, [attempt(l.id, l.version, true)], []);
    expect(after.passed).toBe(1);
    expect(after.next?.id).not.toBe(before.next?.id);
    for (const p of [HOME_PATHS[0]!, HOME_PATHS[2]!, HOME_PATHS[3]!]) expect(pathStats(p.trackIds, LESSONS, [attempt(l.id, l.version, true)], []).passed).toBe(0);
  });

  it('a failed assessment is "started", not passed, and the started lesson is offered first', () => {
    const l = LESSONS.find((x) => x.id.startsWith('L01'))!;
    const s = pathStats(HOME_PATHS[0]!.trackIds, LESSONS, [attempt(l.id, l.version, false)], []);
    expect(s.passed).toBe(0);
    expect(s.started).toBe(1);
    expect(s.next?.id).toBe(l.id);
  });

  it('planned topics are counted apart, so the research path says its research track is planned', () => {
    const research = pathStats(HOME_PATHS[3]!.trackIds, LESSONS, [], []);
    expect(research.plannedTopics).toBeGreaterThanOrEqual(3);
    expect(research.total).toBe(LESSONS.filter((l) => ['safety-eval', 'research'].includes(l.track)).length);
    expect(TRACKS.find((t) => t.id === 'research')!.topics.every((t) => !t.lessonId || LESSONS.some((l) => l.id === t.lessonId))).toBe(true);
  });

  it('the game path points at the real Skill Improvement Loop missions', () => {
    expect(HOME_PATHS[1]!.extra?.to).toBe('/loop');
    expect(MISSIONS.length).toBeGreaterThan(0);
  });
});

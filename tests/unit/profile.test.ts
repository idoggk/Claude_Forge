import { describe, expect, it } from 'vitest';
import { COMPETENCY_AREAS } from '@/domain/curriculum/competencies';
import { LESSONS } from '@/content/lessons';
import { buildMasteryProfile, STATE_LABEL } from '@/domain/mastery/profile';
import { evaluateCompetencies } from '@/domain/mastery/competency';
import type { Attempt } from '@/persistence/schemas';

const today = '2026-11-05';
const attempt = (lessonId: string, score: number, over: Partial<Attempt> = {}): Attempt => {
  const l = LESSONS.find((x) => x.id === lessonId)!;
  return { id: `a-${lessonId}-${Math.random()}`, lessonId, lessonVersion: l.version, stage: 'assessment', startedAt: 't', submittedAt: '2026-11-04T00:00:00Z', attemptNumber: 1, answers: {}, results: [], score, passed: score >= l.assessment.passMark, criticalFailed: [], hintsUsed: 0, confidence: null, predictedPct: null, independent: true, unseen: true, conceptResults: Object.fromEntries(l.competencies.map((c) => [c, { score, items: 4, criticalFailed: false }])), ...over };
};
const build = (attempts: Attempt[] = [], runs: { activityId: string; results: never[] }[] = []) => {
  const evaluations = evaluateCompetencies(attempts, LESSONS, [], []);
  return buildMasteryProfile({ areas: COMPETENCY_AREAS, lessons: LESSONS, evaluations, attempts, progress: [], reviews: [], field: [], activityRuns: runs, today });
};

describe('Personal AI Mastery Profile', () => {
  it('covers all thirteen areas and marks areas with no lessons as planned, with no levels claimed', () => {
    const p = build();
    expect(p).toHaveLength(13);
    const planned = p.filter((a) => a.state === 'planned');
    expect(planned.map((a) => a.area.id)).toEqual(expect.arrayContaining(['ai-fundamentals', 'prompting', 'research', 'ai-system-design']));
    for (const a of planned) { expect(a.competencies).toEqual([]); expect(a.next).toBeNull(); expect(a.lessonsTotal).toBe(0); expect(STATE_LABEL[a.state]).toMatch(/Planned/); }
  });

  it('a new learner has nothing claimed: every non-planned area is "not started" and offers an explained next step', () => {
    for (const a of build().filter((x) => x.state !== 'planned')) {
      expect(a.state, a.area.id).toBe('not-started');
      expect(a.next?.text.length ?? 0, a.area.id).toBeGreaterThan(20);
      expect(a.evidenceLine).toMatch(/0 of \d+ lessons? passed/);
    }
  });

  it('state follows the WEAKEST competency: a strong concept cannot hide a weak one', () => {
    const area = COMPETENCY_AREAS.find((a) => a.id === 'ai-coding')!;
    expect(area.competencyIds.length).toBeGreaterThan(1);
    // Strong evidence on one lesson only.
    const p = build([attempt('L11-choose-ai-approach', 1)]).find((a) => a.area.id === 'tool-selection')!;
    expect(p.competencies.find((c) => c.id === 'approach-selection')!.level).toBeGreaterThanOrEqual(2);
    expect(['building', 'not-started']).toContain(p.state); // other concepts in the area are still unseen
    expect(p.state).not.toBe('independent');
    expect(p.state).not.toBe('field-proven');
  });

  it('practice runs are counted as practice and never change a level', () => {
    const before = build();
    const after = build([], [{ activityId: 'opportunity-finder', results: [] }, { activityId: 'opportunity-finder', results: [] }]);
    const a = after.find((x) => x.area.id === 'tool-selection')!;
    expect(a.practiceRuns).toBe(2);
    expect(a.evidenceLine).toMatch(/do not change levels/);
    expect(a.competencies.map((c) => c.level)).toEqual(before.find((x) => x.area.id === 'tool-selection')!.competencies.map((c) => c.level));
    expect(a.state).toBe('not-started');
  });
});

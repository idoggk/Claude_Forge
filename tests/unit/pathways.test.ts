import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PATHWAYS, type Stage } from '@/content/pathways';
import { CHALLENGE_BY_ID } from '@/content/challenges';
import { LESSONS } from '@/content/lessons';
import { pathwayProgress, stepHref, type PathwayEvidence } from '@/domain/mastery/pathways';

const none: PathwayEvidence = { passedLessonIds: new Set(), challengeIdsRun: new Set(), experimentsWithRuns: 0, pilotExperimentsWithRuns: 0, loops: 0, arsenalEntries: 0, playbooks: 0, completedTransfers: 0, takeaways: 0, finderRuns: 0 };
const app = readFileSync('src/app/App.tsx', 'utf8');

describe('capability pathways', () => {
  it('there are at least six, each with learn, practice, experiment, apply and save, in that order', () => {
    expect(PATHWAYS.length).toBeGreaterThanOrEqual(6);
    const order: Stage[] = ['learn', 'practice', 'experiment', 'apply', 'save'];
    for (const p of PATHWAYS) {
      const stages = p.steps.map((s) => s.stage);
      expect(new Set(stages), p.id).toEqual(new Set(order));
      const idx = stages.map((s) => order.indexOf(s));
      expect([...idx].sort((a, b) => a - b), `${p.id} is in order`).toEqual(idx);
      expect(new Set(p.steps.map((s) => `${s.stage}:${stepHref(s.target)}`)).size, `${p.id} has no duplicate steps`).toBe(p.steps.length);
    }
  });
  it('every step leads to a page that exists: a real lesson, a real challenge, or a registered route', () => {
    for (const p of PATHWAYS) for (const s of p.steps) {
      const t = s.target;
      if (t.kind === 'lesson') expect(LESSONS.some((l) => l.id === t.lessonId), `${p.id}: ${t.lessonId}`).toBe(true);
      else if (t.kind === 'challenge') expect(CHALLENGE_BY_ID.has(t.challengeId), `${p.id}: ${t.challengeId}`).toBe(true);
      else expect(app, `${p.id}: ${t.to}`).toContain(`path="${t.to.replace(/^\//, '').replace('/new', '/:takeawayId')}"`);
    }
  });
  it('no pathway step is a lesson that is only planned', () => {
    for (const p of PATHWAYS) for (const s of p.steps) if (s.target.kind === 'lesson') { const t = s.target; expect(LESSONS.find((l) => l.id === t.lessonId)).toBeTruthy(); }
  });
  it('progress counts only matching records and never marks a step done by visiting', () => {
    const p = PATHWAYS[0]!;
    expect(pathwayProgress(p, none).done).toBe(0);
    expect(pathwayProgress(p, none).next).toBe(p.steps[0]);
    const lessonId = (p.steps[0]!.target as { lessonId: string }).lessonId;
    const some = pathwayProgress(p, { ...none, passedLessonIds: new Set([lessonId]) });
    expect(some.done).toBe(1);
    expect(some.next).toBe(p.steps[1]);
  });
  it('a pathway can reach 100% only with every kind of record', () => {
    const p = PATHWAYS[1]!;
    const all: PathwayEvidence = { passedLessonIds: new Set(p.steps.flatMap((s) => (s.target.kind === 'lesson' ? [s.target.lessonId] : []))), challengeIdsRun: new Set(['extraction']), experimentsWithRuns: 1, pilotExperimentsWithRuns: 1, loops: 1, arsenalEntries: 1, playbooks: 1, completedTransfers: 1, takeaways: 1, finderRuns: 1 };
    expect(pathwayProgress(p, all).done).toBe(p.steps.length);
    expect(pathwayProgress(p, { ...all, takeaways: 0 }).done).toBe(p.steps.length - 1);
  });
});

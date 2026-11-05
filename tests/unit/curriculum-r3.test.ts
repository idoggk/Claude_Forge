import { describe, expect, it } from 'vitest';
import { COMPETENCIES, COMPETENCY_AREAS, TRACKS } from '@/domain/curriculum/competencies';
import { LESSONS } from '@/content/lessons';
import { MISCONCEPTIONS } from '@/content/misconceptions';
import { DIAGNOSTIC } from '@/content/diagnostic';

const lessonIds = new Set(LESSONS.map((l) => l.id));
const R3 = ['L11-choose-ai-approach', 'L12-context-engineering', 'L13-why-agents-fail', 'L14-mcp-or-not', 'L15-reliable-ai-workflow', 'L16-ai-evaluation', 'L17-efficient-ai-development', 'L18-evaluate-an-ai-tool'];

describe('curriculum taxonomy (twelve tracks, honest about what exists)', () => {
  it('has twelve ordered tracks and every topic with a lessonId points at a real lesson', () => {
    expect(TRACKS).toHaveLength(12);
    expect(TRACKS.map((t) => t.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const t of TRACKS) {
      expect(t.topics.length, t.id).toBeGreaterThan(0);
      expect(t.outcome.length, t.id).toBeGreaterThan(30);
      for (const topic of t.topics) if (topic.lessonId) expect(lessonIds.has(topic.lessonId), `${t.id}: ${topic.title}`).toBe(true);
    }
  });

  it('never presents a planned topic as available: a topic has a lesson or it is planned, and every lesson is placed in a track', () => {
    for (const l of LESSONS) {
      const inTrack = TRACKS.some((t) => t.id === l.track);
      expect(inTrack, l.id).toBe(true);
    }
    const planned = TRACKS.flatMap((t) => t.topics.filter((x) => !x.lessonId));
    expect(planned.length).toBeGreaterThan(10); // most of the long tail is still planned, and says so
  });

  it('keeps the original ten lessons, and the eight new ones are in place', () => {
    for (const id of R3) expect(lessonIds.has(id), id).toBe(true);
    expect(LESSONS.filter((l) => l.order <= 10)).toHaveLength(10);
  });

  it('the thirteen profile areas reference real competencies; planned areas have none and say why', () => {
    expect(COMPETENCY_AREAS).toHaveLength(13);
    const comps = new Set(COMPETENCIES.map((c) => c.id));
    for (const a of COMPETENCY_AREAS) {
      for (const c of a.competencyIds) expect(comps.has(c), `${a.id} ${c}`).toBe(true);
      if (a.competencyIds.length === 0) expect(a.plannedNote, a.id).toBeTruthy();
    }
    // every competency belongs to at least one area, so no evidence is invisible in the profile
    const placed = new Set(COMPETENCY_AREAS.flatMap((a) => a.competencyIds));
    for (const c of COMPETENCIES) expect(placed.has(c.id), c.id).toBe(true);
  });
});

describe('Round 3 lessons', () => {
  const lessons = LESSONS.filter((l) => R3.includes(l.id));
  it('each has the required pedagogy: problem, prediction, worked example, practice, independent assessment, application, 8 review items, sources', () => {
    for (const l of lessons) {
      expect(l.segments.some((s) => s.prediction), `${l.id} has a prediction-before-explanation`).toBe(true);
      expect(l.segments.some((s) => /worked example/i.test(s.title)), `${l.id} has a worked example`).toBe(true);
      expect(l.activity.items.length, l.id).toBeGreaterThanOrEqual(4);
      expect(l.assessment.items.length, l.id).toBeGreaterThanOrEqual(6);
      expect(l.reviewItems.length, l.id).toBeGreaterThanOrEqual(8);
      expect(l.sources.length, l.id).toBeGreaterThanOrEqual(2);
      expect(l.application.fieldPrompt, l.id).toMatch(/Field evidence/);
      expect(l.assessment.items.some((i) => i.kind === 'reflect'), l.id).toBe(true);
    }
  });

  it('every incorrect option carries a reason, and misconception tags point at real catalog entries', () => {
    for (const l of lessons) {
      for (const it of [...l.activity.items, ...l.assessment.items, ...l.reviewItems]) {
        if (it.kind !== 'single' && it.kind !== 'multi') continue;
        for (const o of it.options) {
          expect(o.why.length, `${l.id}/${it.id}/${o.id}`).toBeGreaterThanOrEqual(12);
          if (o.misconception) expect(MISCONCEPTIONS[o.misconception], `${l.id}/${it.id}/${o.id}`).toBeDefined();
        }
      }
    }
  });

  it('lessons with a pass-through external check name a check that exists', () => {
    const l15 = lessons.find((l) => l.id === 'L15-reliable-ai-workflow')!;
    const l16 = lessons.find((l) => l.id === 'L16-ai-evaluation')!;
    expect(l15.assessment.items.some((i) => i.kind === 'external' && i.check === 'playbook-workflow')).toBe(true);
    expect(l16.assessment.items.some((i) => i.kind === 'external' && i.check === 'lab-repeated-runs')).toBe(true);
  });

  it('fabricated material uses no real credential, domain or person', () => {
    const text = JSON.stringify(lessons.map((l) => [l.segments, l.activity, l.assessment]));
    expect(text).not.toMatch(/ghp_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{12,}/);
    for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+)/g)) expect(m[1], 'fabricated hosts must be .example').toMatch(/\.example(\.com)?$|^code\.claude\.com$|^www\.anthropic\.com$/);
  });

  it('the diagnostic covers every foundation competency exactly once and the corrective questions of new misconceptions exist', () => {
    expect(DIAGNOSTIC.items.map((i) => i.concept).sort()).toEqual(COMPETENCIES.filter((c) => !c.advanced).map((c) => c.id).sort());
    for (const id of ['agents-always-better', 'longer-prompt-better', 'confident-trace-success', 'mcp-for-everything', 'secrets-in-config', 'vendor-claim-is-evidence', 'parallel-always-faster', 'works-once-reliable']) {
      expect(MISCONCEPTIONS[id], id).toBeDefined();
    }
  });
});

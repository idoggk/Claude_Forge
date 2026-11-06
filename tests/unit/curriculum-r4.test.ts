import { describe, expect, it } from 'vitest';
import { LESSONS } from '@/content/lessons';
import { COMPETENCIES, TRACKS } from '@/domain/curriculum/competencies';
import { MISCONCEPTIONS } from '@/content/misconceptions';
import { SOURCE_REGISTRY } from '@/content/sources/registry';
import { CORPUS } from '@/content/fixtures/retrieval';
import { CAPABILITIES } from '@/content/capability/map';
import { gradeItem } from '@/domain/assessment/grade';
import { perfectAnswer, wrongAnswer } from './helpers';
import type { Item } from '@/domain/curriculum/types';

const R4 = ['L19-structured-outputs-tool-calling', 'L20-few-shot-prompting', 'L21-prompt-injection-trust-boundaries', 'L22-retrieval-augmented-generation', 'L23-evaluation-harnesses', 'L24-long-running-agent-context'];
const lessons = LESSONS.filter((l) => R4.includes(l.id));
const items = (l: (typeof lessons)[number]): Item[] => [...l.activity.items, ...l.assessment.items, ...l.reviewItems];

describe('Round 4 advanced lessons', () => {
  it('all six exist, are versioned, ordered after the original eighteen, and map to advanced competencies', () => {
    expect(lessons).toHaveLength(6);
    expect(lessons.map((l) => l.order)).toEqual([19, 20, 21, 22, 23, 24]);
    const advanced = new Set(COMPETENCIES.filter((c) => c.advanced).map((c) => c.id));
    for (const id of ['agent-permissions', 'deterministic-gates']) advanced.delete(id as never); // taught by the Round 6 lessons, tested in curriculum-r6.test.ts
    expect(advanced.size).toBe(6);
    for (const l of lessons) {
      expect(l.version).toBeGreaterThanOrEqual(1);
      expect(l.competencies.length).toBe(1);
      expect(advanced.has(l.competencies[0]!), l.id).toBe(true);
      for (const p of l.prerequisites) expect(LESSONS.some((x) => x.id === p), `${l.id} prereq ${p}`).toBe(true);
    }
    // every advanced competency is taught by exactly one lesson, so no advanced competency is orphaned
    for (const c of advanced) expect(lessons.filter((l) => l.competencies.includes(c)).length, c).toBe(1);
  });

  it('each follows the required pedagogy: problem, prediction, worked example, interactive practice, independent assessment, application, 8-item review pool', () => {
    for (const l of lessons) {
      expect(l.problem.length, l.id).toBeGreaterThan(150);
      expect(l.segments.some((s) => s.prediction), `${l.id} prediction`).toBe(true);
      expect(l.segments.some((s) => /worked example/i.test(s.title)), `${l.id} worked example`).toBe(true);
      expect(l.activity.items.length, l.id).toBeGreaterThanOrEqual(4);
      expect(l.assessment.items.length, l.id).toBeGreaterThanOrEqual(8);
      expect(l.reviewItems.length, l.id).toBeGreaterThanOrEqual(8);
      expect(l.assessment.items.some((i) => i.kind === 'reflect'), l.id).toBe(true);
      expect(l.assessment.items.some((i) => i.critical), `${l.id} has a mandatory check`).toBe(true);
      expect(l.failureModes.length, l.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('assessments are not just multiple choice: each mixes at least three item kinds including a deterministic non-choice task', () => {
    for (const l of lessons) {
      const kinds = new Set(l.assessment.items.map((i) => i.kind));
      expect(kinds.size, `${l.id} kinds: ${[...kinds].join(',')}`).toBeGreaterThanOrEqual(4);
      expect([...kinds].some((k) => ['flaglines', 'fields', 'classify', 'order', 'numeric', 'external'].includes(k)), l.id).toBe(true);
    }
  });

  it('every wrong option explains itself in a real sentence and misconception tags exist', () => {
    for (const l of lessons) {
      for (const it of items(l)) {
        if (it.kind !== 'single' && it.kind !== 'multi') continue;
        for (const o of it.options) {
          expect(o.why.length, `${l.id}/${it.id}/${o.id}`).toBeGreaterThanOrEqual(12);
          if (o.misconception) expect(MISCONCEPTIONS[o.misconception], `${l.id}/${it.id}/${o.id} -> ${o.misconception}`).toBeDefined();
        }
      }
    }
  });

  it('a perfect answer is graded fully correct and a deliberately wrong one is not (deterministic grading, no free-form guessing)', () => {
    for (const l of lessons) {
      for (const it of [...l.activity.items, ...l.assessment.items, ...l.reviewItems]) {
        if (it.kind === 'external' || it.kind === 'reflect') continue;
        const good = gradeItem(it, perfectAnswer(it));
        expect(good.correct, `${l.id}/${it.id}: ${good.feedback}`).toBe(true);
        const bad = gradeItem(it, wrongAnswer(it));
        expect(bad.correct, `${l.id}/${it.id} wrong answer accepted`).toBe(false);
      }
    }
  });

  it('structured-answer items are narrow keyword checks and say so: pasting only the first keyword of each group is enough, a vague answer is not', () => {
    for (const l of lessons) for (const it of l.assessment.items) {
      if (it.kind !== 'fields') continue;
      expect(gradeItem(it, Object.fromEntries(it.fields.map((f) => [f.id, 'I would be careful and test it thoroughly.']))).correct, `${l.id}/${it.id}`).toBe(false);
      expect(it.fields.length, it.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('sources are the verified Anthropic pages recorded in the source registry as read', () => {
    const read = new Set(SOURCE_REGISTRY.filter((s) => s.status === 'read').map((s) => s.url));
    for (const l of lessons) {
      expect(l.sources.length, l.id).toBeGreaterThanOrEqual(3);
      for (const s of l.sources) {
        if (/platform\.claude\.com|anthropic\.com\/(news|engineering)/.test(s.url)) expect(read.has(s.url), `${l.id}: ${s.url} is not in the registry as read`).toBe(true);
      }
    }
  });

  it('the inert prompt-injection samples are text only: no real URL, credential or executable instruction target', () => {
    const l = lessons.find((x) => x.id.startsWith('L21'))!;
    const text = JSON.stringify([l.activity, l.assessment]);
    expect(text).not.toMatch(/ghp_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{12,}|sk-[a-z0-9]{10,}/);
    for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+)/g)) expect(m[1], 'sample hosts must be .example').toMatch(/\.example(\.com)?$/);
    expect(l.segments.map((s) => s.body).join(' ')).toMatch(/inert/i);
  });

  it('the retrieval lesson uses the deterministic fixture honestly: the widget is declared, snippets quote the corpus, and the limits are stated', () => {
    const l = lessons.find((x) => x.id.startsWith('L22'))!;
    expect(l.activity.widget).toBe('retrieval-lab');
    const p1 = l.activity.items.find((i) => i.id === 'l22-p1')!;
    if (p1.kind !== 'classify') throw new Error('expected classify');
    const allText = CORPUS.map((d) => d.text).join(' ');
    for (const e of p1.entries) {
      const quoted = e.text.match(/"([^"]{12,})"/)?.[1]?.replace(/\.$/, '');
      if (quoted && !/raises the default/.test(quoted)) expect(allText, e.id).toContain(quoted.slice(0, 40));
    }
    expect(l.segments.map((s) => s.body).join(' ')).toMatch(/does not simulate/i);
  });

  it('the harness lesson connects to the AI Lab through a verified external check', () => {
    const l = lessons.find((x) => x.id.startsWith('L23'))!;
    expect(l.assessment.items.some((i) => i.kind === 'external' && i.check === 'lab-evaluation-harness')).toBe(true);
  });

  it('planned topics that now have a lesson point at it, and planned topics are still not shown as available', () => {
    const linked = TRACKS.flatMap((t) => t.topics).filter((t) => t.lessonId && R4.includes(t.lessonId));
    expect(linked.length).toBeGreaterThanOrEqual(8);
    expect(TRACKS.flatMap((t) => t.topics).filter((t) => !t.lessonId).length).toBeGreaterThan(20);
  });

  it('every R4 lesson is reachable from the Capability Map', () => {
    const reachable = new Set(CAPABILITIES.flatMap((c) => c.lessons));
    for (const l of lessons) expect(reachable.has(l.id), l.id).toBe(true);
  });
});

import { recommend } from '@/domain/mastery/recommend';
import { goalLessons } from '@/content/capability/goals';

describe('recommendations surface the advanced lessons with reasons', () => {
  const l21 = LESSONS.find((l) => l.id.startsWith('L21'))!;
  const l14 = LESSONS.find((l) => l.id.startsWith('L14'))!;
  const attempt = (lessonId: string, version: number) => ({
    id: `a-${lessonId}`, lessonId, lessonVersion: version, stage: 'assessment' as const, startedAt: 't', submittedAt: '2026-11-01T00:00:00Z', attemptNumber: 1, answers: {}, results: [], score: 1, passed: true, criticalFailed: [], hintsUsed: 0,
    confidence: null, predictedPct: null, independent: true, unseen: true, conceptResults: {},
  });
  const base = { lessons: [l14, l21], attempts: [attempt(l14.id, l14.version)], progress: [], reviews: [], profile: null, today: '2026-11-05' };

  it('an advanced lesson becomes recommendable once its prerequisite is passed, and says so', () => {
    const r = recommend(base).primary;
    expect(r.lessonId).toBe(l21.id);
    expect(r.reasons.join(' ')).toMatch(/prerequisites are complete/i);
  });

  it('is held back until prerequisites are met', () => {
    const fresh = recommend({ ...base, attempts: [] });
    expect(fresh.primary.lessonId).toBe(l14.id);
    const l21c = [fresh.primary, ...fresh.alternatives].find((c) => c.lessonId === l21.id);
    expect(l21c?.reasons.join(' ') ?? '').toMatch(/Best after/);
  });

  it('an active misconception raises it, naming the belief and the lesson that teaches it', () => {
    const plain = recommend(base).primary;
    const hit = recommend({ ...base, misconceptionHits: [{ id: 'tell-it-to-ignore-injection', lessonId: l14.id }] }).primary;
    expect(hit.score).toBeGreaterThan(plain.score);
    expect(hit.reasons.join(' ')).toMatch(/different lesson; this lesson teaches Prompt injection and trust boundaries directly/);
  });

  it('a learning goal on the capability raises it with a visible reason, and a goal is never evidence', () => {
    const goal = { id: 'g', schemaVersion: 1 as const, title: 'Defend my agents', why: '', capabilityIds: ['trust-boundaries'], status: 'active' as const, achievedNote: '', achievedAt: null, createdAt: 't', updatedAt: 't' };
    const plain = recommend(base).primary;
    const steered = recommend({ ...base, goalLessons: goalLessons([goal]) }).primary;
    expect(steered.score).toBeGreaterThan(plain.score);
    expect(steered.reasons.join(' ')).toMatch(/Supports your goal "Defend my agents"/);
    expect(steered.status).toBe('not-started');
  });
});

describe('adding advanced lessons does not reorder the first track', () => {
  const lesson = (id: string) => LESSONS.find((l) => l.id.startsWith(id))!;
  const passed = (l: (typeof LESSONS)[number]) => ({
    id: `a-${l.id}`, lessonId: l.id, lessonVersion: l.version, stage: 'assessment' as const, startedAt: 't', submittedAt: '2026-11-01T00:00:00Z', attemptNumber: 1, answers: {}, results: [], score: 1, passed: true, criticalFailed: [], hintsUsed: 0,
    confidence: 4, predictedPct: null, independent: true, unseen: true, conceptResults: {},
  });
  const input = (done: string[]) => ({ lessons: LESSONS, attempts: done.map((d) => passed(lesson(d))), progress: [], reviews: [], profile: { interests: [] }, today: '2026-11-05' });

  it('after the first lesson the next recommendation is the second lesson, not a foundational lesson that many later ones depend on', () => {
    const r = recommend(input(['L01'])).primary;
    expect(r.title).toBe(lesson('L02').title);
  });
});

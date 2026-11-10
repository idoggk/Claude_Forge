import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForgeDB, setDbForTesting, getDb, DB_VERSION } from '@/persistence/db';
import * as repo from '@/persistence/repo';
import { DIAGNOSTIC } from '@/content/diagnostic';
import { MISCONCEPTIONS } from '@/content/misconceptions';
import { LESSONS } from '@/content/lessons';
import { COMPETENCIES as ALL_COMPETENCIES } from '@/domain/curriculum/competencies';

/** The placement diagnostic probes the foundations; advanced competencies (Round 4) are taught but not placed. */
const COMPETENCIES = ALL_COMPETENCIES.filter((c) => !c.advanced);
import { gradeDiagnostic, latestHint } from '@/domain/mastery/diagnostic';
import { recommend } from '@/domain/mastery/recommend';
import { applyImport, exportAll, parseBackup, serializeBackup } from '@/persistence/backup';
import { setClockOffsetDays, todayKey } from '@/lib/clock';
import { newId } from '@/lib/ids';
import { perfectAnswers, wrongAnswers } from './helpers';

let n = 0;
beforeEach(async () => {
  setClockOffsetDays(0);
  const db = new ForgeDB(`diag-${++n}-${Math.random().toString(36).slice(2)}`);
  setDbForTesting(db);
  await db.open();
});

describe('diagnostic content', () => {
  it('has exactly one scenario question per competency, each well-formed', () => {
    expect(DIAGNOSTIC.items).toHaveLength(COMPETENCIES.length);
    expect(new Set(DIAGNOSTIC.items.map((i) => i.concept))).toEqual(new Set(COMPETENCIES.map((c) => c.id)));
    const lessonItemIds = new Set(LESSONS.flatMap((l) => [...l.activity.items, ...l.assessment.items, ...l.reviewItems]).map((i) => i.id));
    for (const it of DIAGNOSTIC.items) {
      expect(it.kind).toBe('single');
      expect(it.options.filter((o) => o.id === it.correct)).toHaveLength(1);
      expect((it as { critical?: boolean }).critical, 'a diagnostic has no mandatory checks').toBeFalsy();
      for (const o of it.options) {
        expect(o.why.length, `${it.id}/${o.id}`).toBeGreaterThan(8);
        if (o.misconception) expect(MISCONCEPTIONS[o.misconception], `${it.id}/${o.id}`).toBeDefined();
        if (o.misconception) expect(o.id, `${it.id} correct option tagged`).not.toBe(it.correct);
      }
      expect(lessonItemIds.has(it.id), it.id).toBe(false);
    }
  });
});

describe('gradeDiagnostic', () => {
  it('perfect answers leave no gaps; wrong answers flag every concept and surface misconceptions', () => {
    const good = gradeDiagnostic(perfectAnswers(DIAGNOSTIC.items));
    expect(good.gaps).toEqual([]);
    expect(good.solid).toHaveLength(COMPETENCIES.length);
    const bad = gradeDiagnostic(wrongAnswers(DIAGNOSTIC.items));
    expect(bad.gaps).toHaveLength(COMPETENCIES.length);
    expect(bad.solid).toEqual([]);
  });
  it('unanswered questions are gaps, never correct', () => {
    const r = gradeDiagnostic({});
    expect(r.gaps).toHaveLength(COMPETENCIES.length);
    expect(r.results.every((x) => !x.answered && !x.correct)).toBe(true);
  });
  it('a tagged wrong option is reported as a misconception, deduplicated', () => {
    const answers: Record<string, unknown> = {};
    for (const it of DIAGNOSTIC.items) answers[it.id] = it.options.find((o) => o.misconception)?.id ?? it.options.find((o) => o.id !== it.correct)!.id;
    const r = gradeDiagnostic(answers);
    expect(r.misconceptions.length).toBeGreaterThan(5);
    expect(new Set(r.misconceptions).size).toBe(r.misconceptions.length);
  });
});

describe('persistence: a diagnostic can never award mastery', () => {
  it('saves a record and touches no attempt, review, progress or competency', async () => {
    const before = await getDb().competencies.toArray();
    const { record, created } = await repo.submitDiagnostic({ id: newId('dg'), answers: perfectAnswers(DIAGNOSTIC.items) });
    expect(created).toBe(true);
    expect(record.gaps).toEqual([]);
    expect(await getDb().attempts.count()).toBe(0);
    expect(await getDb().reviews.count()).toBe(0);
    expect(await getDb().lessonProgress.count()).toBe(0);
    expect(await getDb().competencies.toArray()).toEqual(before);
    for (const c of await getDb().competencies.toArray()) expect(c.level).toBe(0);
  });

  it('is idempotent per id, and retaking appends while keeping history', async () => {
    const id = newId('dg');
    await repo.submitDiagnostic({ id, answers: wrongAnswers(DIAGNOSTIC.items) });
    const dup = await repo.submitDiagnostic({ id, answers: perfectAnswers(DIAGNOSTIC.items) });
    expect(dup.created).toBe(false);
    expect(dup.record.gaps).toHaveLength(COMPETENCIES.length); // the first submission stands
    await repo.submitDiagnostic({ id: newId('dg'), answers: perfectAnswers(DIAGNOSTIC.items) });
    expect(await getDb().diagnostics.count()).toBe(2);
  });

  it('latestHint uses the most recent record of the current version only', async () => {
    await repo.submitDiagnostic({ id: newId('dg'), answers: wrongAnswers(DIAGNOSTIC.items) });
    setClockOffsetDays(1);
    await repo.submitDiagnostic({ id: newId('dg'), answers: perfectAnswers(DIAGNOSTIC.items) });
    const recs = await getDb().diagnostics.toArray();
    expect(latestHint(recs)!.gaps).toEqual([]);
    expect(latestHint(recs.map((r) => ({ ...r, diagnosticVersion: 99 })))).toBeNull();
    expect(latestHint([])).toBeNull();
  });

  it('round-trips through a backup and a bad record is rejected', async () => {
    await repo.submitDiagnostic({ id: newId('dg'), answers: wrongAnswers(DIAGNOSTIC.items) });
    const text = serializeBackup(await exportAll());
    const parsed = parseBackup(text);
    expect(parsed.preview.counts.diagnostics).toBe(1);
    const broken = JSON.parse(text);
    broken.data.diagnostics[0].diagnosticVersion = 0;
    const bad = parseBackup(JSON.stringify(broken));
    expect(bad.preview.ok).toBe(false);
    expect(bad.valid!.diagnostics).toHaveLength(0);
    const db2 = new ForgeDB(`diag-restore-${Math.random().toString(36).slice(2)}`);
    setDbForTesting(db2);
    await db2.open();
    await applyImport(parsed.valid!, 'replace');
    expect(await db2.diagnostics.count()).toBe(1);
  });

  it('upgrades a v3 database to the current version with every existing record intact', async () => {
    const name = `diag-migrate-${Math.random().toString(36).slice(2)}`;
    const old = new Dexie(name);
    old.version(3).stores({
      profile: 'id', preferences: 'id', lessonProgress: 'lessonId', attempts: 'id, lessonId, stage, submittedAt, [lessonId+stage]', competencies: 'competencyId', reviews: 'lessonId, dueOn',
      annotations: 'entryId', arsenal: 'entryId, status', customSkills: 'id, updatedAt', experiments: 'id, updatedAt, status', evidence: 'id, experimentId', fieldEvidence: 'id, entryId, createdAt', loops: 'id, status, updatedAt', meta: 'key',
    });
    await old.open();
    await old.table('reviews').put({ lessonId: 'L01-skill-or-tool', box: 2, dueOn: todayKey(), lapses: 1, cycle: 3, lastReviewedAt: null, lastOutcome: null, createdAt: 't', history: [] });
    old.close();
    const db = new ForgeDB(name);
    setDbForTesting(db);
    await db.open();
    expect(DB_VERSION).toBe(8);
    expect(db.verno).toBe(8);
    expect(await db.reviews.get('L01-skill-or-tool')).toMatchObject({ box: 2, lapses: 1, cycle: 3 });
    expect(await db.diagnostics.count()).toBe(0);
  });
});

describe('recommendations use the diagnostic as a hint, with reasons', () => {
  const base = { lessons: LESSONS, attempts: [], progress: [], reviews: [], profile: null, today: '2026-01-01' };

  it('raises the priority of a lesson that builds a flagged gap, and says why', () => {
    const plain = recommend(base);
    const hinted = recommend({ ...base, diagnostic: { gaps: ['experiment-design'], solid: [], takenAt: 't' } });
    const l8 = LESSONS.find((l) => l.competencies.includes('experiment-design'))!;
    const pick = (r: ReturnType<typeof recommend>) => [r.primary, ...r.alternatives].find((c) => c.lessonId === l8.id);
    // not necessarily top-4 for a fresh learner; compare via a forced candidate list
    const all = recommend({ ...base, lessons: [l8], diagnostic: { gaps: ['experiment-design'], solid: [], takenAt: 't' } }).primary;
    const none = recommend({ ...base, lessons: [l8] }).primary;
    expect(all.score).toBeGreaterThan(none.score);
    expect(all.reasons.join(' ')).toMatch(/placement diagnostic flagged/i);
    expect(all.reasons.join(' ')).toMatch(/hint rather than a measurement/i);
    void plain; void hinted; void pick;
  });

  it('a "solid" diagnostic never marks anything passed or lowers the evidence required', () => {
    const r = recommend({ ...base, lessons: [LESSONS[0]!], diagnostic: { gaps: [], solid: LESSONS[0]!.competencies, takenAt: 't' } });
    expect(r.primary.kind).toBe('lesson');
    expect(r.primary.status).toBe('not-started');
    expect(r.primary.reasons.join(' ')).toMatch(/assessment will confirm/i);
  });

  it('offers the Improvement Loop only when its prerequisites are passed and none has been started', () => {
    const lessons = LESSONS.filter((l) => ['L05-first-custom-skill', 'L07-economy-inflation'].includes(l.id));
    const loop = { prerequisites: lessons.map((l) => l.id), started: 0 };
    expect(recommend({ ...base, lessons, loop }).primary.kind).not.toBe('loop');
    const attempts = lessons.map((l) => ({
      id: l.id, lessonId: l.id, lessonVersion: l.version, stage: 'assessment' as const, startedAt: 't', submittedAt: 't', attemptNumber: 1, answers: {}, results: [], score: 1, passed: true, criticalFailed: [], hintsUsed: 0,
      confidence: null, predictedPct: null, independent: true, unseen: true, conceptResults: {},
    }));
    const r = recommend({ ...base, lessons, attempts, loop });
    expect(r.primary.kind).toBe('loop');
    expect(r.primary.reasons.join(' ')).toMatch(/Skill Improvement Loop|measured evidence/);
    expect(recommend({ ...base, lessons, attempts, loop: { ...loop, started: 1 } }).primary.kind).not.toBe('loop');
  });

  it('due reviews still outrank everything, including the loop', () => {
    const l = LESSONS[0]!;
    const rec = { lessonId: l.id, box: 0, dueOn: '2025-12-30', lapses: 0, cycle: 0, lastReviewedAt: null, lastOutcome: null, createdAt: 't', history: [] };
    expect(recommend({ ...base, reviews: [rec], loop: { prerequisites: [], started: 0 } }).primary.kind).toBe('review');
  });
});

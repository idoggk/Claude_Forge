import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForgeDB, setDbForTesting, getDb, ALL_STORES, DB_VERSION } from '@/persistence/db';
import * as repo from '@/persistence/repo';
import { applyImport, exportAll, parseBackup, serializeBackup, BACKUP_VERSION } from '@/persistence/backup';
import { LESSONS } from '@/content/lessons';
import { setClockOffsetDays, todayKey } from '@/lib/clock';
import { perfectAnswers, wrongAnswers } from './helpers';
import { newId } from '@/lib/ids';
import { SkillContentSchema, emptyContent, type SkillDraft } from '@/domain/skills/model';

const L01 = LESSONS[0]!;
let n = 0;

beforeEach(async () => {
  setClockOffsetDays(0);
  const db = new ForgeDB(`test-${++n}-${Math.random().toString(36).slice(2)}`);
  setDbForTesting(db);
  await db.open();
});

const submit = (over: Partial<Parameters<typeof repo.submitAttempt>[0]> = {}) =>
  repo.submitAttempt({ attemptId: newId('att'), lesson: L01, stage: 'assessment', startedAt: new Date().toISOString(), answers: perfectAnswers(L01.assessment.items), hintsUsed: 0, confidence: 4, ...over });

describe('attempt submission', () => {
  it('records a graded attempt, raises competency, and schedules the first review for tomorrow', async () => {
    const r = await submit();
    expect(r.created).toBe(true);
    expect(r.attempt.passed).toBe(true);
    expect(r.attempt.score).toBe(1);
    expect(r.attempt.unseen).toBe(true);
    expect(r.levelsAfter['mechanism-selection']).toBe(3);
    const review = await getDb().reviews.get(L01.id);
    expect(review).toMatchObject({ box: 0 });
    expect(review!.dueOn > todayKey()).toBe(true);
    expect((await getDb().lessonProgress.get(L01.id))?.completedAt).not.toBeNull();
  });

  it('the same attempt ID can never be counted twice (duplicate submit is idempotent)', async () => {
    const id = newId('att');
    const a = await submit({ attemptId: id });
    const b = await submit({ attemptId: id });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(await getDb().attempts.count()).toBe(1);
    // and concurrent double-clicks
    const id2 = newId('att');
    await Promise.all([submit({ attemptId: id2 }), submit({ attemptId: id2 })]);
    expect(await getDb().attempts.count()).toBe(2);
  });

  it('keeps failed attempts, numbers them, and marks retakes as seen (cannot raise level 3)', async () => {
    const fail = await submit({ answers: wrongAnswers(L01.assessment.items), confidence: 5 });
    expect(fail.attempt.passed).toBe(false);
    expect(fail.levelsAfter['mechanism-selection']).toBeLessThan(3);
    expect(fail.calibration?.verdict).toBe('overconfident');
    const retake = await submit();
    expect(retake.attempt.attemptNumber).toBe(2);
    expect(retake.attempt.unseen).toBe(false);
    expect(retake.attempt.passed).toBe(true);
    expect(retake.levelsAfter['mechanism-selection']).toBe(2); // passing a retake gives guided credit only
    expect(await getDb().attempts.count()).toBe(2);
  });

  it('assessments never accept hints, practice records them and stays guided', async () => {
    const a = await submit({ hintsUsed: 3 });
    expect(a.attempt.hintsUsed).toBe(0);
    const p = await submit({ stage: 'practice', answers: perfectAnswers(L01.activity.items), hintsUsed: 2 });
    expect(p.attempt.hintsUsed).toBe(2);
    expect(p.attempt.independent).toBe(false);
    expect(p.attempt.unseen).toBe(false);
  });

  it('survives a "reload": a fresh DB handle sees the same data', async () => {
    await submit();
    const name = getDb().name;
    getDb().close();
    const reopened = new ForgeDB(name);
    setDbForTesting(reopened);
    expect(await reopened.attempts.count()).toBe(1);
    expect((await reopened.competencies.get('mechanism-selection'))?.level).toBe(3);
  });
});

describe('spaced review end to end (with time travel)', () => {
  it('a review becomes due, is graded on fresh items, and moves the schedule', async () => {
    await submit();
    expect((await repo.startReview(L01.id))!.items).toHaveLength(3);
    setClockOffsetDays(2);
    const session = (await repo.startReview(L01.id))!;
    const ok = await repo.submitReview({ attemptId: newId('rv'), lessonId: L01.id, startedAt: new Date().toISOString(), answers: perfectAnswers(session.items), hintsUsed: 0, confidence: 4 });
    expect(ok!.outcome).toBe('pass');
    expect(ok!.review).toMatchObject({ box: 1, cycle: 1 });
    expect(ok!.review.dueOn).toBe(new Date(Date.parse(todayKey() + 'T00:00:00Z') + 3 * 86400000).toISOString().slice(0, 10));
    // rotating pool: the next session shows different items
    const next = (await repo.startReview(L01.id))!;
    expect(next.items.map((i) => i.id)).not.toEqual(session.items.map((i) => i.id));
  });

  it('failing a review resets the box and counts a lapse; a duplicate submit does nothing', async () => {
    await submit();
    setClockOffsetDays(2);
    const session = (await repo.startReview(L01.id))!;
    const id = newId('rv');
    const input = { attemptId: id, lessonId: L01.id, startedAt: new Date().toISOString(), answers: wrongAnswers(session.items), hintsUsed: 0, confidence: 5 };
    const r1 = await repo.submitReview(input);
    expect(r1!.outcome).toBe('fail');
    expect(r1!.review).toMatchObject({ box: 0, lapses: 1 });
    const r2 = await repo.submitReview(input);
    expect(r2!.created).toBe(false);
    expect((await getDb().reviews.get(L01.id))!.lapses).toBe(1);
  });

  it('a review can earn level 3 after a retake-only history, because review items are unseen', async () => {
    await submit({ answers: wrongAnswers(L01.assessment.items) });
    await submit(); // retake: seen -> level 2 at best
    expect((await getDb().competencies.get('mechanism-selection'))!.level).toBe(2);
    setClockOffsetDays(3);
    const session = (await repo.startReview(L01.id))!;
    await repo.submitReview({ attemptId: newId('rv'), lessonId: L01.id, startedAt: new Date().toISOString(), answers: perfectAnswers(session.items), hintsUsed: 0, confidence: 4 });
    expect((await getDb().competencies.get('mechanism-selection'))!.level).toBe(3);
  });
});

describe('field evidence and arsenal', () => {
  it('field evidence lifts a level-3 competency to field-proven, and removing it lowers it again', async () => {
    await submit();
    const ev = await repo.addFieldEvidence({ competencyIds: ['mechanism-selection'], title: 'Moved a rule into a hook', project: 'OMM', date: '2026-11-05', description: 'Added a PostToolUse hook for tsc', outcome: 'Blocked a bad edit', artifactNote: '' });
    expect((await getDb().competencies.get('mechanism-selection'))!.level).toBe(4);
    await repo.deleteFieldEvidence(ev.id);
    expect((await getDb().competencies.get('mechanism-selection'))!.level).toBe(3);
  });

  it('arsenal status changes are persisted with history; "installed" is only ever declared', async () => {
    await repo.setArsenalStatus('playwright-mcp', 'interested');
    await repo.setArsenalStatus('playwright-mcp', 'evaluating');
    await repo.patchArsenal('playwright-mcp', { inspected: true, declaredInstalled: true, securityConcerns: 'unpinned' });
    const rec = (await getDb().arsenal.get('playwright-mcp'))!;
    expect(rec.status).toBe('evaluating');
    expect(rec.history.map((h) => h.to)).toEqual(['interested', 'evaluating']);
    expect(rec).toMatchObject({ inspected: true, approved: false, declaredInstalled: true });
    await expect(repo.patchArsenal('not-added', { inspected: true })).rejects.toThrow(/Add the item/);
  });
});

describe('backup, import and data safety', () => {
  async function seed() {
    await repo.saveProfile({ displayName: 'Dev', interests: ['game-dev'], onboardedAt: new Date().toISOString() });
    await submit();
    await repo.setArsenalStatus('obra-superpowers', 'evaluating');
    const draft: SkillDraft = { ...SkillContentSchema.parse({ ...emptyContent(), name: 'my-skill', description: 'Use when testing', instructions: 'Do it' }), id: 'sk1', liveTests: [], revisions: [], lastExportedAt: null, lastExportedName: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await repo.saveSkill(draft);
  }

  it('export → wipe → restore preserves meaningful progress', async () => {
    await seed();
    const text = serializeBackup(await exportAll());
    await repo.resetEverything();
    expect(await getDb().attempts.count()).toBe(0);
    const parsed = parseBackup(text);
    expect(parsed.preview.ok).toBe(true);
    expect(parsed.preview.version).toBe(BACKUP_VERSION);
    await applyImport(parsed.valid!, 'replace');
    expect(await getDb().attempts.count()).toBe(1);
    expect((await getDb().competencies.get('mechanism-selection'))!.level).toBe(3);
    expect((await getDb().arsenal.get('obra-superpowers'))!.status).toBe('evaluating');
    expect((await getDb().customSkills.get('sk1'))!.name).toBe('my-skill');
    expect((await getDb().profile.get('me'))!.displayName).toBe('Dev');
    expect(await getDb().reviews.count()).toBe(1);
  });

  const malformed: [string, string][] = [
    ['not JSON', '{oops'],
    ['wrong format', JSON.stringify({ format: 'something-else', version: 1, data: {} })],
    ['array', '[]'],
    ['missing version', JSON.stringify({ format: 'claude-forge-backup', data: {} })],
    ['future version', JSON.stringify({ format: 'claude-forge-backup', version: 99, data: {} })],
    ['missing data', JSON.stringify({ format: 'claude-forge-backup', version: 1 })],
    ['null', 'null'],
  ];
  it.each(malformed)('rejects a malformed import (%s) without applying anything', async (_name, text) => {
    await seed();
    const before = await exportAll();
    const parsed = parseBackup(text);
    expect(parsed.preview.ok).toBe(false);
    expect(parsed.preview.fatal).toBeTruthy();
    expect(parsed.valid).toBeNull();
    const after = await exportAll();
    expect(after.data).toEqual(before.data); // existing data intact
  });

  it('reports invalid records in the preview and refuses a strict import of them', async () => {
    await seed();
    const b = await exportAll();
    (b.data.attempts[0] as Record<string, unknown>).score = 'high'; // corrupt one record
    (b.data.arsenal as unknown[]).push({ entryId: '', status: 'nope' });
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.preview.ok).toBe(false);
    expect(parsed.preview.invalidCount).toBe(2);
    expect(parsed.preview.invalid.map((i) => i.store).sort()).toEqual(['arsenal', 'attempts']);
    expect(parsed.preview.counts.attempts).toBe(0);
    expect(parsed.valid!.profile).toHaveLength(1);
  });

  it('a failure while writing rolls back: a replace import never leaves the database half-empty', async () => {
    await seed();
    const before = await exportAll();
    const parsed = parseBackup(serializeBackup(before));
    // Sabotage: a record that passes validation but cannot be written (IndexedDB cannot clone functions).
    const circular: Record<string, unknown> = { entryId: 'x', status: 'interested', inspected: false, approved: false, declaredInstalled: false, addedAt: 'a', updatedAt: 'a', history: [] };
    circular.notCloneable = () => 1; // functions cannot be stored in IndexedDB: the write fails mid-transaction
    (parsed.valid!.arsenal as unknown[]).push(circular);
    await expect(applyImport(parsed.valid!, 'replace')).rejects.toThrow();
    expect((await exportAll()).data).toEqual(before.data);
  });

  it('merge mode keeps local attempts, local profile and newer local records', async () => {
    await seed();
    const snapshot = await exportAll();
    await repo.saveProfile({ displayName: 'Changed locally' });
    await repo.patchArsenal('obra-superpowers', { nextPractice: 'newer local note' });
    await applyImport(parseBackup(serializeBackup(snapshot)).valid!, 'merge');
    expect((await getDb().profile.get('me'))!.displayName).toBe('Changed locally');
    expect((await getDb().arsenal.get('obra-superpowers'))!.nextPractice).toBe('newer local note');
    expect(await getDb().attempts.count()).toBe(1);
  });

  it('imports are treated as data: a hostile script string in a note is stored inertly', async () => {
    await repo.setArsenalStatus('x', 'interested');
    const b = await exportAll();
    (b.data.arsenal[0] as Record<string, unknown>).securityConcerns = '<img src=x onerror=alert(1)>';
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.preview.ok).toBe(true);
    await applyImport(parsed.valid!, 'replace');
    expect((await getDb().arsenal.get('x'))!.securityConcerns).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('schema migration v1 → v2', () => {
  it('upgrades an existing v1 database in place without dropping any record', async () => {
    const name = `migrate-${Math.random().toString(36).slice(2)}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({
      profile: 'id', preferences: 'id', lessonProgress: 'lessonId', attempts: 'id, lessonId, stage, submittedAt, [lessonId+stage]',
      competencies: 'competencyId', reviews: 'lessonId, dueOn', annotations: 'entryId', arsenal: 'entryId, status', customSkills: 'id, updatedAt',
      experiments: 'id, updatedAt, status', evidence: 'id, experimentId', meta: 'key',
    });
    await v1.open();
    await v1.table('attempts').bulkAdd([
      { id: 'old1', lessonId: 'L01-skill-or-tool', lessonVersion: 1, stage: 'assessment', startedAt: 'a', submittedAt: '2026-11-01T00:00:00Z', attemptNumber: 1, answers: {}, results: [], score: 0.9, passed: true, criticalFailed: [], hintsUsed: 0, confidence: 4, predictedPct: 80 },
      { id: 'old2', lessonId: 'L01-skill-or-tool', lessonVersion: 1, stage: 'practice', startedAt: 'a', submittedAt: '2026-11-01T00:00:00Z', attemptNumber: 2, answers: {}, results: [], score: 0.6, passed: false, criticalFailed: [], hintsUsed: 2, confidence: null, predictedPct: null },
    ]);
    await v1.table('arsenal').put({ entryId: 'e', status: 'using', addedAt: 'a', updatedAt: 'a' });
    v1.close();

    const v2 = new ForgeDB(name);
    await v2.open();
    expect(v2.verno).toBe(DB_VERSION);
    expect(await v2.attempts.count()).toBe(2);
    expect(await v2.arsenal.count()).toBe(1);
    const old1 = (await v2.attempts.get('old1')) as unknown as Record<string, unknown>;
    expect(old1).toMatchObject({ independent: true, unseen: true, conceptResults: {} });
    const old2 = (await v2.attempts.get('old2')) as unknown as Record<string, unknown>;
    expect(old2).toMatchObject({ independent: false, unseen: false });
    expect(await v2.fieldEvidence.count()).toBe(0); // new v2 store exists
    expect((await v2.meta.get('migratedFrom'))?.value).toBe(1);
    expect(ALL_STORES.every((s) => v2.tables.some((t) => t.name === s))).toBe(true);
  });
});

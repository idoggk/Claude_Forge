import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { DB_VERSION, ForgeDB, getDb, setDbForTesting } from '@/persistence/db';
import * as repo from '@/persistence/repo';
import { exportAll, parseBackup, applyImport } from '@/persistence/backup';
import { CONFIDENCE_LEVELS, TakeawaySchema, confidenceProblems, emptyTakeaway, reachableLevels, takeawaysJson, takeawaysMarkdown, type Takeaway } from '@/domain/library/model';

const T0 = '2026-01-01T00:00:00.000Z';
const noCtx = { completedTransferIds: new Set<string>(), experimentIds: new Set<string>(), challengeIds: new Set<string>() };
const mk = (over: Partial<Takeaway> = {}): Takeaway => ({ ...emptyTakeaway('t1', T0), title: 'Examples help format', statement: 'Three examples fixed my commit format.', ...over });

async function freshDb() {
  const db = new ForgeDB(`lib-${Math.random().toString(36).slice(2)}`);
  setDbForTesting(db);
  await db.open();
  return db;
}

describe('takeaway confidence rules', () => {
  it('hypothesis needs nothing; every higher level needs a reason in your words', () => {
    expect(confidenceProblems({ confidence: 'hypothesis', confidenceNote: '', references: [] }, noCtx)).toEqual([]);
    expect(confidenceProblems({ confidence: 'anecdotal', confidenceNote: '', references: [] }, noCtx)).not.toEqual([]);
    expect(confidenceProblems({ confidence: 'anecdotal', confidenceNote: 'I saw it twice on my repo.', references: [] }, noCtx)).toEqual([]);
  });
  it('evaluated on fixtures needs a lab report or challenge that exists; a made-up id does not count', () => {
    const t = { confidence: 'evaluated-on-fixtures' as const, confidenceNote: 'Judged on the fixed cases.', references: [{ kind: 'lab-report' as const, id: 'e1', label: '' }] };
    expect(confidenceProblems(t, noCtx)).not.toEqual([]);
    expect(confidenceProblems(t, { ...noCtx, experimentIds: new Set(['e1']) })).toEqual([]);
    expect(confidenceProblems({ ...t, references: [{ kind: 'goal', id: 'g', label: '' }] }, { ...noCtx, experimentIds: new Set(['e1']) })).not.toEqual([]);
  });
  it('applied to real work needs a COMPLETED transfer task', () => {
    const t = { confidence: 'applied-to-real-work' as const, confidenceNote: 'Used it on the billing service.', references: [{ kind: 'transfer' as const, id: 'x', label: '' }] };
    expect(confidenceProblems(t, noCtx)).not.toEqual([]);
    expect(confidenceProblems(t, { ...noCtx, completedTransferIds: new Set(['x']) })).toEqual([]);
  });
  it('reachableLevels never offers a level the references cannot support', () => {
    expect(reachableLevels({ confidenceNote: '', references: [] }, noCtx)).toEqual(['hypothesis', 'anecdotal']);
    expect(CONFIDENCE_LEVELS).toHaveLength(4);
  });
});

describe('takeaway storage', () => {
  beforeEach(async () => { await freshDb(); });
  it('saves a hypothesis, keeps history, and never raises confidence on its own', async () => {
    const r = await repo.saveTakeaway(mk());
    expect(r.ok).toBe(true);
    const again = await repo.saveTakeaway({ ...mk(), statement: 'Edited wording.' });
    expect(again.ok && again.takeaway.confidence).toBe('hypothesis');
    expect(again.ok && again.takeaway.history).toHaveLength(1);
  });
  it('refuses a level its references cannot support, and stores nothing', async () => {
    const r = await repo.saveTakeaway(mk({ confidence: 'applied-to-real-work', confidenceNote: 'It worked at work.' }));
    expect(r.ok).toBe(false);
    expect(await getDb().takeaways.count()).toBe(0);
  });
  it('accepts raising to evaluated once a real experiment is referenced, records it in history, and always allows lowering', async () => {
    const db = getDb();
    await db.experiments.put({ id: 'e1' } as never);
    await repo.saveTakeaway(mk());
    const up = await repo.saveTakeaway(mk({ confidence: 'evaluated-on-fixtures', confidenceNote: 'Judged on the six fixed cases.', references: [{ kind: 'lab-report', id: 'e1', label: 'Examples vs none' }] }));
    expect(up.ok && up.takeaway.history.map((h) => h.to)).toEqual(['hypothesis', 'evaluated-on-fixtures']);
    const down = await repo.saveTakeaway(mk({ confidence: 'hypothesis', references: [] }));
    expect(down.ok && down.takeaway.confidence).toBe('hypothesis');
    expect(down.ok && down.takeaway.history.at(-1)!.from).toBe('evaluated-on-fixtures');
  });
  it('a challenge counts as evidence only after a run is saved', async () => {
    const t = mk({ confidence: 'evaluated-on-fixtures', confidenceNote: 'Practised the idea on the challenge.', references: [{ kind: 'challenge', id: 'extraction', label: '' }] });
    expect((await repo.saveTakeaway(t)).ok).toBe(false);
    await repo.recordActivityRun({ id: 'r1', activityId: 'challenge:extraction', activityVersion: 1, answers: {}, results: [], score: 0.5 });
    expect((await repo.saveTakeaway(t)).ok).toBe(true);
  });
  it('round-trips through backup export and import', async () => {
    await repo.saveTakeaway(mk());
    const file = await exportAll();
    expect(file.data.takeaways).toHaveLength(1);
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.preview.counts.takeaways).toBe(1);
    const db2 = await freshDb();
    await applyImport(parsed.valid!, 'replace');
    expect(await db2.takeaways.count()).toBe(1);
  });
  it('an older backup without takeaways still imports', () => {
    const p = parseBackup(JSON.stringify({ format: 'claude-forge-backup', version: 1, exportedAt: T0, data: { goals: [] } }));
    expect(p.preview.fatal).toBeNull();
  });
});

describe('exports', () => {
  it('markdown states the confidence, the reason and the references, and the honesty header', () => {
    const md = takeawaysMarkdown([mk({ confidence: 'anecdotal', confidenceNote: 'Saw it twice.', references: [{ kind: 'playbook', id: 'p', label: 'Commit playbook' }], tags: ['prompts'] })]);
    expect(md).toContain('Anecdotal');
    expect(md).toContain('**Why this level:** Saw it twice.');
    expect(md).toContain('Playbook: Commit playbook');
    expect(md).toMatch(/nothing here was verified by Forge/);
  });
  it('json is valid, labelled, and parses back to the same takeaways', () => {
    const items = [mk()];
    const j = JSON.parse(takeawaysJson(items, T0));
    expect(j.format).toBe('claude-forge-takeaways');
    expect(TakeawaySchema.array().parse(j.takeaways)).toEqual(items);
  });
});

describe('migration v6 -> v7', () => {
  it('adds the takeaways store and keeps every existing record', async () => {
    const name = `lib-mig-${Math.random().toString(36).slice(2)}`;
    const old = new Dexie(name);
    old.version(6).stores({
      profile: 'id', preferences: 'id', lessonProgress: 'lessonId', attempts: 'id, lessonId, stage, submittedAt, [lessonId+stage]', competencies: 'competencyId', reviews: 'lessonId, dueOn',
      annotations: 'entryId', arsenal: 'entryId, status', customSkills: 'id, updatedAt', experiments: 'id, updatedAt, status', evidence: 'id, experimentId', fieldEvidence: 'id, date, entryId, createdAt',
      loops: 'id, status, updatedAt', diagnostics: 'id, takenAt', goals: 'id, status, updatedAt', playbooks: 'id, updatedAt', activityRuns: 'id, activityId, takenAt', transferTasks: 'id, status, updatedAt', meta: 'key',
    });
    await old.open();
    await old.table('activityRuns').put({ id: 'r-old', activityId: 'opportunity-finder', activityVersion: 1, takenAt: T0, answers: {}, results: [], score: 1 });
    old.close();
    const db = new ForgeDB(name);
    setDbForTesting(db);
    await db.open();
    expect(DB_VERSION).toBe(7);
    expect(db.verno).toBe(7);
    expect((await db.activityRuns.get('r-old'))!.score).toBe(1);
    expect(await db.takeaways.count()).toBe(0);
  });
});

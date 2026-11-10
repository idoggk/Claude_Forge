import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForgeDB, setDbForTesting, DB_VERSION } from '@/persistence/db';
import * as repo from '@/persistence/repo';
import { applyImport, exportAll, parseBackup, serializeBackup, BACKUP_FORMAT } from '@/persistence/backup';
import { ExperimentSchema } from '@/domain/experiments/model';
import { DEMO_EXPERIMENT } from '@/domain/experiments/demo';
import { fromTemplate, newPlaybook } from '@/domain/playbook/ops';
import { PLAYBOOK_TEMPLATES } from '@/content/playbook/seeds';
import { MAX_ACTIVE_GOALS } from '@/domain/goals/model';
import { setClockOffsetDays } from '@/lib/clock';
import { newId } from '@/lib/ids';

let n = 0;
async function freshDb() {
  const db = new ForgeDB(`r3-${++n}-${Math.random().toString(36).slice(2)}`);
  setDbForTesting(db);
  await db.open();
  return db;
}
beforeEach(() => setClockOffsetDays(0));

describe('v4 -> v5 migration (R2 database upgraded by R3)', () => {
  const V4_STORES = {
    profile: 'id', preferences: 'id', lessonProgress: 'lessonId', attempts: 'id, lessonId, stage, submittedAt, [lessonId+stage]', competencies: 'competencyId', reviews: 'lessonId, dueOn',
    annotations: 'entryId', arsenal: 'entryId, status', customSkills: 'id, updatedAt', experiments: 'id, updatedAt, status', evidence: 'id, experimentId', fieldEvidence: 'id, date, entryId, createdAt',
    loops: 'id, status, updatedAt', diagnostics: 'id, takenAt', meta: 'key',
  };

  it('keeps every record, defaults old experiments to Skill experiments, and adds the new stores empty', async () => {
    const name = `r3-migrate-${Math.random().toString(36).slice(2)}`;
    const old = new Dexie(name);
    old.version(4).stores(V4_STORES);
    await old.open();
    // An R2-shaped experiment: no experimentType / subject, and an R2-era condition kind.
    const { experimentType: _t, subject: _s, ...r2exp } = { ...DEMO_EXPERIMENT, id: 'exp-old', synthetic: false } as Record<string, unknown>;
    await old.table('experiments').put(r2exp);
    await old.table('profile').put({ id: 'me', displayName: 'Ada', interests: ['game-dev'], dailyMinutes: 20, onboardedAt: 't', createdAt: 't' });
    await old.table('arsenal').put({ entryId: 'playwright-mcp', status: 'evaluating', inspected: false, approved: false, declaredInstalled: false, observedUsefulness: null, rejectionReason: '', securityConcerns: '', nextPractice: '', experimentIds: [], lastEvaluatedAt: null, addedAt: 't', updatedAt: 't', history: [] });
    await old.table('diagnostics').put({ id: 'dg1', diagnosticId: 'placement', diagnosticVersion: 1, takenAt: 't', answers: {}, results: [], gaps: ['skill-security'], solid: [], misconceptions: [] });
    old.close();

    const db = new ForgeDB(name);
    setDbForTesting(db);
    await db.open();
    expect(DB_VERSION).toBe(8);
    expect(db.verno).toBe(8);

    const exp = await db.experiments.get('exp-old');
    expect(exp).toBeDefined();
    expect((exp as unknown as { experimentType: string }).experimentType).toBe('skill');
    expect((exp as unknown as { subject: string }).subject).toBe('');
    expect(ExperimentSchema.safeParse(exp).success).toBe(true);
    expect((await db.profile.get('me'))?.displayName).toBe('Ada');
    expect((await db.arsenal.get('playwright-mcp'))?.status).toBe('evaluating');
    expect(await db.diagnostics.count()).toBe(1);
    expect(await db.goals.count()).toBe(0);
    expect(await db.playbooks.count()).toBe(0);
    expect(await db.activityRuns.count()).toBe(0);
  });

  it('the built-in demo experiment still validates and keeps the Skill-centred condition kinds', () => {
    expect(ExperimentSchema.safeParse(DEMO_EXPERIMENT).success).toBe(true);
    expect(DEMO_EXPERIMENT.conditions.some((c) => c.kind === 'no-skill')).toBe(true);
  });
});

describe('backup: an R2 backup file still imports, and R3 data round-trips', () => {
  it('imports a backup that has none of the new stores, without discarding anything', async () => {
    await freshDb();
    const exp = { ...DEMO_EXPERIMENT, id: 'exp-r2', synthetic: false } as Record<string, unknown>;
    delete exp.experimentType; delete exp.subject;
    const file = {
      format: BACKUP_FORMAT, version: 1, exportedAt: '2026-10-01T00:00:00.000Z', app: 'claude-forge', notice: 'x',
      data: { profile: [{ id: 'me', displayName: 'Old', interests: [], dailyMinutes: 20, onboardedAt: 't', createdAt: 't' }], experiments: [exp] },
    };
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.preview.ok).toBe(true);
    expect(parsed.preview.invalidCount).toBe(0);
    expect(parsed.valid!.experiments).toHaveLength(1);
    const db = await freshDb();
    await applyImport(parsed.valid!, 'replace');
    expect((await db.experiments.get('exp-r2'))!.experimentType).toBe('skill');
    expect((await db.profile.get('me'))!.displayName).toBe('Old');
  });

  it('round-trips goals, playbooks and practice runs, and reports (never silently drops) an invalid record', async () => {
    const db = await freshDb();
    await repo.saveGoal({ title: 'Automate the Friday report', capabilityIds: ['reliable-workflows'] });
    await repo.savePlaybook(fromTemplate(newId('pb'), PLAYBOOK_TEMPLATES[0]!, () => newId('st')));
    await repo.recordActivityRun({ id: 'run1', activityId: 'opportunity-finder', activityVersion: 1, answers: { a: 'software' }, results: [{ itemId: 'of-rename', concept: 'approach-selection', correct: true, score: 1 }], score: 1 });
    const text = serializeBackup(await exportAll());
    const parsed = parseBackup(text);
    expect(parsed.preview.counts.goals).toBe(1);
    expect(parsed.preview.counts.playbooks).toBe(1);
    expect(parsed.preview.counts.activityRuns).toBe(1);

    const broken = JSON.parse(text);
    broken.data.goals[0].capabilityIds = [];
    const bad = parseBackup(JSON.stringify(broken));
    expect(bad.preview.ok).toBe(false);
    expect(bad.preview.invalid.some((x) => x.store === 'goals')).toBe(true);
    expect(bad.valid!.goals).toHaveLength(0);

    const db2 = await freshDb();
    await applyImport(parsed.valid!, 'replace');
    expect(await db2.goals.count()).toBe(1);
    expect(await db2.playbooks.count()).toBe(1);
    expect(await db2.activityRuns.count()).toBe(1);
    void db;
  });
});

describe('goals', () => {
  it('limits active goals, never creates competency evidence, and "achieved" records the learner\'s own note', async () => {
    const db = await freshDb();
    for (let i = 0; i < MAX_ACTIVE_GOALS; i++) await repo.saveGoal({ title: `Goal ${i}`, capabilityIds: ['evaluation'] });
    await expect(repo.saveGoal({ title: 'One too many', capabilityIds: ['evaluation'] })).rejects.toThrow(/active goals/);
    const first = (await db.goals.toArray())[0]!;
    await repo.setGoalStatus(first.id, 'achieved', ' Used it to catch a regression in my project ');
    const done = (await db.goals.get(first.id))!;
    expect(done.status).toBe('achieved');
    expect(done.achievedNote).toBe('Used it to catch a regression in my project');
    expect(done.achievedAt).not.toBeNull();
    // reactivating respects the limit once there is room
    await repo.saveGoal({ title: 'Fills the slot', capabilityIds: ['evaluation'] });
    await expect(repo.setGoalStatus(first.id, 'active')).rejects.toThrow();
    // goals never touch competency records or attempts
    expect(await db.competencies.count()).toBe(0);
    expect(await db.attempts.count()).toBe(0);
  });

  it('rejects a goal with no capability or an unknown shape', async () => {
    await freshDb();
    await expect(repo.saveGoal({ title: 'x', capabilityIds: [] })).rejects.toThrow();
  });
});

describe('playbook persistence', () => {
  it('keeps the previous content as a version-history entry and caps history', async () => {
    const db = await freshDb();
    const pb = newPlaybook('pb1', { title: 'v1', goal: 'first goal text here' });
    await repo.savePlaybook(pb);
    const v2 = await repo.savePlaybook({ ...(await db.playbooks.get('pb1'))!, title: 'v2' }, 'renamed');
    expect(v2.revisions).toHaveLength(1);
    expect(v2.revisions[0]!.snapshot.title).toBe('v1');
    expect(v2.revisions[0]!.label).toBe('renamed');
    let cur = v2;
    for (let i = 0; i < 40; i++) cur = await repo.savePlaybook({ ...cur, title: `t${i}` }, `rev ${i}`);
    expect(cur.revisions.length).toBe(30);
  });
});

describe('practice runs never change competency levels', () => {
  it('recording an Opportunity Finder run leaves competencies and attempts untouched', async () => {
    const db = await freshDb();
    await repo.recordActivityRun({ id: 'r1', activityId: 'opportunity-finder', activityVersion: 1, answers: {}, results: [{ itemId: 'of-rename', concept: 'approach-selection', correct: true, score: 1 }], score: 1 });
    expect(await db.competencies.count()).toBe(0);
    expect(await db.attempts.count()).toBe(0);
    expect(await db.activityRuns.count()).toBe(1);
  });
});

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { o } from '@/content/lessons/helpers';
import { advance, canAdvance, chooseBranch, checkStep, isCurrent, markResumed, mergeRuns, newRun, progressOf, runSummary, setAnswer } from '@/domain/missions/engine';
import { MissionRunSchema, validateMission, type Mission, type ValidationContext } from '@/domain/missions/model';
import { DB_VERSION, ForgeDB, getDb, setDbForTesting } from '@/persistence/db';
import * as repo from '@/persistence/repo';
import { exportAll, parseBackup, applyImport } from '@/persistence/backup';

const T = '2026-11-09T10:00:00.000Z';
const ctx: ValidationContext = { lessonIds: new Set(['L01-skill-or-tool']), competencyIds: new Set(['mechanism-selection']), missionIds: new Set(['other']) };

const mission = (over: Partial<Mission> = {}): Mission => ({
  id: 'demo', version: 1, kind: 'mission', title: 'Demo', tagline: 'A demo mission', objectives: ['Choose the right mechanism'], competencies: ['mechanism-selection'], prerequisites: ['other'], minutes: 8, lessonId: 'L01-skill-or-tool',
  steps: [
    { id: 'hook', phase: 'hook', type: 'read', title: 'A problem', body: 'Claude skips a step in long sessions even though your Skill says to run it.' },
    { id: 'predict', phase: 'predict', type: 'item', item: { id: 'predict', kind: 'single', concept: 'mechanism-selection', prompt: 'What will fix it?', options: [o('a', 'A hook that enforces the step', 'A hook runs every time; a Skill is only guidance.'), o('b', 'Louder capital letters in the Skill', 'Emphasis changes the odds, not the nature of the rule.'), o('c', 'A longer Skill description with more examples', 'A longer description changes when the Skill loads, not whether the step runs.')], correct: 'a', explanation: 'A rule that must hold every time needs enforcement.' } },
    { id: 'branch', phase: 'discover', type: 'branch', prompt: 'Your move?', options: [{ id: 'x', text: 'Write it as a hook', consequence: 'The check now runs at the action every time, whatever the model remembers.', goto: 'practice', better: true }, { id: 'y', text: 'Remind Claude again', consequence: 'It works until the next long session, when the reminder scrolls away.', goto: 'practice', better: false }] },
    { id: 'practice', phase: 'practice', type: 'item', item: { id: 'practice', kind: 'multi', concept: 'mechanism-selection', prompt: 'Which belong in a hook?', options: [o('a', 'Block a commit unless tests ran', 'Must hold every time.'), o('b', 'Explain how to read a failing test', 'That is judgment, which suits a Skill.'), o('c', 'Refuse writes outside one folder', 'A limit that must always hold.')], correct: ['a', 'c'], explanation: 'Policies need enforcement, procedures need judgment.', hints: ['Which must hold every time?'] } },
    { id: 'challenge', phase: 'challenge', type: 'item', frozenOnAnswer: true, item: { id: 'challenge', kind: 'single', concept: 'mechanism-selection', prompt: 'A new rule: never print secrets. Where?', options: [o('a', 'A hook or permission that blocks it', 'Enforced, not requested.'), o('b', 'A sentence in the project instructions', 'Guidance can be skipped.'), o('c', 'A Skill that describes secrets in detail', 'A Skill is loaded only when relevant.')], correct: 'a', explanation: 'Must-hold rules are enforced.' } },
    { id: 'reflect', phase: 'reflect', type: 'read', title: 'The principle', body: 'Guidance for judgment, enforcement for policy. Ask: if this were skipped once, would that be unacceptable?' },
  ],
  next: [{ label: 'Take the assessment', to: '/academy/lesson/L01-skill-or-tool' }],
  ...over,
});

describe('mission validation', () => {
  it('accepts a well-formed mission', () => { expect(validateMission(mission(), ctx)).toEqual([]); });
  it('reports duplicate ids, missing feedback and unknown references', () => {
    const m = mission({ competencies: ['nope' as never], prerequisites: ['missing'], lessonId: 'L99' });
    const msgs = validateMission(m, ctx).map((p) => p.message).join('|');
    expect(msgs).toMatch(/Unknown competency/);
    expect(msgs).toMatch(/Unknown prerequisite/);
    expect(msgs).toMatch(/lesson whose independent assessment/);
    const dup = mission(); dup.steps[3] = { ...dup.steps[3]!, id: 'predict' } as never;
    expect(validateMission(dup, ctx).map((p) => p.message).join('|')).toMatch(/unique/);
    const noFb = mission(); (noFb.steps[1] as never as { item: { options: { why: string }[] } }).item.options[1]!.why = 'no';
    expect(validateMission(noFb, ctx).some((p) => /no useful feedback/.test(p.message))).toBe(true);
  });
  it('catches broken and backward branches, unreachable steps and a missing challenge or prediction', () => {
    const bad = mission(); (bad.steps[2] as never as { options: { goto: string }[] }).options[0]!.goto = 'nowhere';
    expect(validateMission(bad, ctx).some((p) => /does not exist/.test(p.message))).toBe(true);
    const back = mission(); (back.steps[2] as never as { options: { goto: string }[] }).options[0]!.goto = 'hook';
    expect(validateMission(back, ctx).some((p) => /backwards/.test(p.message))).toBe(true);
    const skip = mission(); (skip.steps[2] as never as { options: { goto: string }[] }).options.forEach((x) => { x.goto = 'challenge'; });
    expect(validateMission(skip, ctx).some((p) => p.stepId === 'practice' && /cannot be reached/.test(p.message))).toBe(true);
    const noChallenge = mission(); (noChallenge.steps[4] as never as { frozenOnAnswer?: boolean }).frozenOnAnswer = false;
    expect(validateMission(noChallenge, ctx).some((p) => /independent challenge/.test(p.message))).toBe(true);
  });
  it('requires the learner to act early, forbids hints on an independent challenge, and keeps read steps short', () => {
    const late = mission(); late.steps.splice(1, 0, { id: 'x', phase: 'hook', type: 'read', title: 'More', body: 'Another long read before anything is asked of the learner at all.' }, { id: 'y', phase: 'hook', type: 'read', title: 'More', body: 'Yet another long read before anything is asked of the learner at all.' });
    expect(validateMission(late, ctx).some((p) => /within the first two steps/.test(p.message))).toBe(true);
    const hint = mission(); (hint.steps[4] as never as { item: { hints: string[] } }).item.hints = ['a hint'];
    expect(validateMission(hint, ctx).some((p) => /must not offer hints/.test(p.message))).toBe(true);
    const long = mission(); (long.steps[0] as never as { body: string }).body = 'x'.repeat(901);
    expect(validateMission(long, ctx).some((p) => /too long/.test(p.message))).toBe(true);
  });
});

describe('mission state machine', () => {
  const m = mission();
  const ok = (r: ReturnType<typeof advance>) => { if (!r.ok) throw new Error(r.error); return r.run; };

  it('walks a mission start to finish, with branches, feedback and a frozen challenge', () => {
    let run = newRun(m, 'r1', T);
    expect(run.stepId).toBe('hook');
    run = ok(advance(run, m, T));
    expect(canAdvance(run, m)).toBe(false); // an item must be checked first
    expect(advance(run, m, T).ok).toBe(false);
    run = ok(setAnswer(run, m, 'predict', 'b', T));
    run = ok(checkStep(run, m, 'predict', 0, T));
    expect(run.results[0]).toMatchObject({ stepId: 'predict', correct: false });
    run = ok(advance(run, m, T));
    expect(canAdvance(run, m)).toBe(false);
    run = ok(chooseBranch(run, m, 'branch', 'x', T));
    run = ok(advance(run, m, T));
    expect(run.stepId).toBe('practice');
    run = ok(setAnswer(run, m, 'practice', ['a', 'c'], T));
    run = ok(checkStep(run, m, 'practice', 1, T));
    expect(run.hintsUsed).toBe(1);
    run = ok(advance(run, m, T));
    run = ok(setAnswer(run, m, 'challenge', 'a', T));
    run = ok(checkStep(run, m, 'challenge', 0, T));
    run = ok(advance(run, m, T));
    expect(run.stepId).toBe('reflect');
    run = ok(advance(run, m, T));
    expect(run.status).toBe('completed');
    expect(run.completedAt).toBe(T);
    const s = runSummary(run, m);
    // the prediction is shown separately and is not counted as a decision
    expect(s).toMatchObject({ answered: 2, correct: 2, total: 2, hintsUsed: 1 });
    expect(s.predictions).toHaveLength(1);
    expect(s.predictions[0]!.result?.correct).toBe(false); // a wrong prediction is not a miss
    expect(s.challenge[0]!.result?.correct).toBe(true);
    expect(s.branches[0]!.better).toBe(true);
    expect(progressOf(run, m).done).toBe(progressOf(run, m).total);
  });

  it('a checked answer is frozen: it cannot be changed, re-checked or reached by going back', () => {
    let run = ok(advance(newRun(m, 'r2', T), m, T));
    run = ok(setAnswer(run, m, 'predict', 'a', T));
    run = ok(checkStep(run, m, 'predict', 0, T));
    expect(setAnswer(run, m, 'predict', 'b', T).ok).toBe(false);
    expect(checkStep(run, m, 'predict', 0, T).ok).toBe(false);
    expect(run.frozen).toContain('predict');
    // there is no operation that moves back: the path only ever grows
    const next = ok(advance(run, m, T));
    expect(next.path).toEqual(['hook', 'predict', 'branch']);
    expect(setAnswer(next, m, 'predict', 'c', T).ok).toBe(false); // not the current step any more
  });

  it('an independent challenge refuses hints, and nothing is checked without an answer', () => {
    let run = newRun(m, 'r3', T);
    run = { ...run, stepId: 'challenge', path: ['hook', 'challenge'] };
    expect(checkStep(run, m, 'challenge', 0, T).ok).toBe(false); // no answer yet
    run = ok(setAnswer(run, m, 'challenge', 'a', T));
    expect(checkStep(run, m, 'challenge', 1, T).ok).toBe(false);
    expect(checkStep(run, m, 'challenge', 0, T).ok).toBe(true);
  });

  it('answers survive a refresh (they are part of the stored run) and resuming is counted', () => {
    let run = ok(advance(newRun(m, 'r4', T), m, T));
    run = ok(setAnswer(run, m, 'predict', 'a', T));
    const reloaded = MissionRunSchema.parse(JSON.parse(JSON.stringify(run)));
    expect(reloaded.answers.predict).toBe('a');
    expect(reloaded.stepId).toBe('predict');
    expect(markResumed(reloaded, T).resumes).toBe(1);
  });

  it('a run belongs to its content version; changed content leaves the old run untouched', () => {
    const run = newRun(m, 'r5', T);
    expect(isCurrent(run, m)).toBe(true);
    expect(isCurrent(run, mission({ version: 2 }))).toBe(false);
    expect(run.missionVersion).toBe(1);
  });

  it('a finished run accepts no more moves', () => {
    let run = newRun(m, 'r6', T);
    run = { ...run, status: 'completed', completedAt: T };
    expect(advance(run, m, T).ok).toBe(false);
    expect(setAnswer(run, m, 'predict', 'a', T).ok).toBe(false);
  });
});

describe('mission run persistence', () => {
  beforeEach(async () => { const db = new ForgeDB(`mr-${Math.random().toString(36).slice(2)}`); setDbForTesting(db); await db.open(); });
  it('saves, finds the unfinished run, and keeps finished runs as history', async () => {
    const m = mission();
    await repo.saveMissionRun(newRun(m, 'a', T));
    await repo.saveMissionRun({ ...newRun(m, 'b', '2026-11-08T10:00:00.000Z'), status: 'completed', completedAt: T });
    expect((await repo.activeMissionRun('demo'))?.id).toBe('a');
    expect(await getDb().missionRuns.count()).toBe(2);
    await repo.deleteMissionRun('a');
    expect(await repo.activeMissionRun('demo')).toBeUndefined();
    expect(await getDb().missionRuns.count()).toBe(1);
  });
  it('mission runs never create attempts or touch competencies', async () => {
    await repo.saveMissionRun({ ...newRun(mission(), 'c', T), status: 'completed', completedAt: T });
    expect(await getDb().attempts.count()).toBe(0);
    expect(await getDb().competencies.count()).toBe(0);
  });
  it('a stale copy of a run cannot replace an answer that is already checked (second tab, restored page)', async () => {
    const m = mission();
    const ok = (r: ReturnType<typeof setAnswer>) => { if (!r.ok) throw new Error(r.error); return r.run; };
    const base = ok(advance(newRun(m, 'stale', T), m, T)); // on the predict step, nothing answered
    // tab A answers wrongly and checks
    let a = ok(setAnswer(base, m, 'predict', 'b', T));
    a = ok(checkStep(a, m, 'predict', 0, T));
    await repo.saveMissionRun(a);
    // tab B still holds the unanswered copy, answers correctly and checks
    let b = ok(setAnswer(base, m, 'predict', 'a', '2026-11-09T10:05:00.000Z'));
    b = ok(checkStep(b, m, 'predict', 0, '2026-11-09T10:05:00.000Z'));
    const saved = await repo.saveMissionRun(b);
    expect(saved.answers.predict).toBe('b'); // the first checked answer stands
    expect(saved.results.find((r) => r.stepId === 'predict')?.correct).toBe(false);
    expect((await getDb().missionRuns.get('stale'))?.answers.predict).toBe('b');
    expect(saved.frozen).toEqual(['predict']);
  });
  it('a finished run is final, progress never moves backwards, and unrelated runs are untouched', () => {
    const m = mission();
    const done = { ...newRun(m, 'x', T), status: 'completed' as const, completedAt: T, stepId: 'reflect', path: ['hook', 'reflect'] };
    expect(mergeRuns(done, { ...newRun(m, 'x', T) })).toBe(done);
    const ahead = { ...newRun(m, 'y', T), stepId: 'branch', path: ['hook', 'predict', 'branch'], frozen: ['predict'], answers: { predict: 'a' } };
    const behind = { ...newRun(m, 'y', T), stepId: 'predict', path: ['hook', 'predict'], answers: { predict: 'c' } };
    const merged = mergeRuns(ahead, behind);
    expect(merged.stepId).toBe('branch');
    expect(merged.answers.predict).toBe('a');
    const other = newRun(m, 'z', T);
    expect(mergeRuns(ahead, other)).toBe(other);
    expect(mergeRuns(undefined, other)).toBe(other);
  });
  it('round-trips through backup export and import, and an older backup without runs still imports', async () => {
    await repo.saveMissionRun(newRun(mission(), 'd', T));
    const file = await exportAll();
    expect(file.data.missionRuns).toHaveLength(1);
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.preview.counts.missionRuns).toBe(1);
    const db2 = new ForgeDB(`mr2-${Math.random().toString(36).slice(2)}`); setDbForTesting(db2); await db2.open();
    await applyImport(parsed.valid!, 'replace');
    expect(await db2.missionRuns.count()).toBe(1);
    expect(parseBackup(JSON.stringify({ format: 'claude-forge-backup', version: 1, exportedAt: T, data: { goals: [] } })).preview.fatal).toBeNull();
  });
});

describe('migration v7 -> v8', () => {
  it('adds the missionRuns store and keeps every existing record', async () => {
    const name = `mr-mig-${Math.random().toString(36).slice(2)}`;
    const old = new Dexie(name);
    old.version(7).stores({
      profile: 'id', preferences: 'id', lessonProgress: 'lessonId', attempts: 'id, lessonId, stage, submittedAt, [lessonId+stage]', competencies: 'competencyId', reviews: 'lessonId, dueOn',
      annotations: 'entryId', arsenal: 'entryId, status', customSkills: 'id, updatedAt', experiments: 'id, updatedAt, status', evidence: 'id, experimentId', fieldEvidence: 'id, date, entryId, createdAt',
      loops: 'id, status, updatedAt', diagnostics: 'id, takenAt', goals: 'id, status, updatedAt', playbooks: 'id, updatedAt', activityRuns: 'id, activityId, takenAt', transferTasks: 'id, status, updatedAt', takeaways: 'id, confidence, updatedAt', meta: 'key',
    });
    await old.open();
    await old.table('activityRuns').put({ id: 'r-old', activityId: 'opportunity-finder', activityVersion: 1, takenAt: T, answers: {}, results: [], score: 1 });
    await old.table('takeaways').put({ id: 'tk', schemaVersion: 1, title: 'Keep me', statement: 'Still here.', confidence: 'hypothesis', confidenceNote: '', references: [], tags: [], history: [], createdAt: T, updatedAt: T });
    old.close();
    const db = new ForgeDB(name);
    setDbForTesting(db);
    await db.open();
    expect(DB_VERSION).toBe(8);
    expect(db.verno).toBe(8);
    expect((await db.activityRuns.get('r-old'))!.score).toBe(1);
    expect((await db.takeaways.get('tk'))!.title).toBe('Keep me');
    expect(await db.missionRuns.count()).toBe(0);
  });
});

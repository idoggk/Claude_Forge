import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ForgeDB, setDbForTesting } from '@/persistence/db';
import * as repo from '@/persistence/repo';
import { applyImport, parseBackup } from '@/persistence/backup';
import { TRANSFER_KINDS, TransferTaskSchema, completionProblems, newTransferTask, transferTaskToMarkdown, type TransferTask } from '@/domain/transfer/model';
import { TRANSFER_PROMPTS } from '@/content/transfer/prompts';
import { fromTemplate } from '@/domain/playbook/ops';
import { PLAYBOOK_TEMPLATES } from '@/content/playbook/seeds';
import { playbookMaturity } from '@/domain/playbook/evidence';
import { LESSONS } from '@/content/lessons';

const T0 = '2026-11-05T10:00:00.000Z';
let n = 0;
async function freshDb() {
  const db = new ForgeDB(`tt-${++n}-${Math.random().toString(36).slice(2)}`);
  setDbForTesting(db);
  await db.open();
  return db;
}
const complete = (over: Partial<TransferTask> = {}): TransferTask => ({
  ...newTransferTask('t1', T0, { title: 'Few-shot for commit messages', kind: 'prompt-technique' }),
  verificationCriteria: 'Nine of ten past diffs give the house style with no retry.',
  observations: 'On ten past diffs seven matched the style; two copied the wrong example.',
  evidence: [{ id: 'e1', at: T0, text: 'Commit abc1234 holds the prompt; results in my notes.', provenance: 'self-reported' }],
  reflection: 'Seven of ten is below the bar; the wrong example leaked, so I would drop it.',
  ...over,
});

describe('a plan is not a result', () => {
  it('a task with a full plan but nothing observed is not completable, and each missing part is named', () => {
    const planOnly = { ...newTransferTask('t', T0), problem: 'p'.repeat(100), currentWorkflow: 'c'.repeat(100), proposedWorkflow: 'x'.repeat(200), expectedBenefit: 'b'.repeat(50), risks: 'r'.repeat(50), verificationCriteria: 'v'.repeat(40) };
    const p = completionProblems(planOnly);
    expect(p.join(' ')).toMatch(/what actually happened/);
    expect(p.join(' ')).toMatch(/evidence/);
    expect(p.join(' ')).toMatch(/reflection/);
    expect(completionProblems(complete())).toEqual([]);
    expect(completionProblems({ ...complete(), evidence: [] }).length).toBe(1);
    expect(completionProblems({ ...complete(), reflection: 'ok' }).length).toBe(1);
  });

  it('completeTransferTask refuses an incomplete task and leaves it open; it completes a complete one with a timestamp', async () => {
    const db = await freshDb();
    await repo.saveTransferTask(complete({ reflection: '' }));
    const refused = await repo.completeTransferTask('t1');
    expect(refused).toMatchObject({ ok: false });
    expect((await db.transferTasks.get('t1'))!.status).not.toBe('completed');
    await repo.saveTransferTask(complete());
    expect(await repo.completeTransferTask('t1')).toEqual({ ok: true });
    const done = (await db.transferTasks.get('t1'))!;
    expect(done.status).toBe('completed');
    expect(done.completedAt).not.toBeNull();
    expect(await repo.completeTransferTask('missing')).toMatchObject({ ok: false });
  });

  it('completing a task never creates competency evidence, reviews or attempts', async () => {
    const db = await freshDb();
    await repo.saveTransferTask(complete());
    await repo.completeTransferTask('t1');
    await repo.recomputeCompetencies('test');
    expect((await db.competencies.toArray()).every((c) => c.level === 0)).toBe(true);
    expect(await db.attempts.count()).toBe(0);
    expect(await db.fieldEvidence.count()).toBe(0);
  });
});

describe('guidance never fills the record in for you', () => {
  it('every kind has prompts for thinking, shown as placeholders, and the new-task factory leaves every written field empty', () => {
    for (const k of TRANSFER_KINDS) {
      const p = TRANSFER_PROMPTS[k];
      for (const v of Object.values(p)) expect(v.length).toBeGreaterThan(15);
      const t = newTransferTask('x', T0, { kind: k });
      expect([t.problem, t.currentWorkflow, t.proposedWorkflow, t.expectedBenefit, t.verificationCriteria, t.risks, t.observations, t.reflection, t.nextImprovement]).toEqual(['', '', '', '', '', '', '', '', '']);
      expect(t.evidence).toEqual([]);
      expect(t.status).toBe('planned');
    }
  });

  it('the kinds are not game-specific: prompt technique, Skill, automation, agent workflow, research and game development are all first-class', () => {
    expect([...TRANSFER_KINDS]).toEqual(expect.arrayContaining(['prompt-technique', 'skill', 'automation', 'agent-workflow', 'research-procedure', 'game-dev-workflow']));
  });

  it('every lesson page can start a task: a lesson source validates and carries its id', () => {
    const t = newTransferTask('x', T0, { source: { kind: 'lesson', id: LESSONS[0]!.id, label: LESSONS[0]!.title } });
    expect(TransferTaskSchema.safeParse(t).success).toBe(true);
  });
});

describe('Markdown export is honest about what it is', () => {
  it('has every section the protocol asks for, says Forge read and verified nothing, and marks completion as self-declared', () => {
    const md = transferTaskToMarkdown({ ...complete(), status: 'completed', completedAt: T0 }, '2026-11-06T00:00:00.000Z');
    for (const h of ['## Problem', '## Current workflow', '## Proposed improved workflow', '## Expected benefit', '## Verification criteria', '## Risks', '## Observations', '## Evidence (author-described)', '## Reflection', '## Next improvement']) expect(md).toContain(h);
    expect(md).toMatch(/did not read the target project, run anything, or verify any statement/);
    expect(md).toMatch(/self-declared/);
    expect(md).toMatch(/_not written_/); // empty sections are shown as empty, not invented
  });
});

describe('recording a real-world result on a playbook', () => {
  it('adds a self-reported result without changing the playbook version, and lifts maturity only to "applied" while fixture evaluation stays incomplete', async () => {
    const db = await freshDb();
    await repo.savePlaybook(fromTemplate('pb', PLAYBOOK_TEMPLATES[0]!, (() => { let i = 0; return () => `s${++i}`; })(), T0));
    const before = (await db.playbooks.get('pb'))!;
    expect(playbookMaturity(before, new Map()).state).toBe('ready-to-test');
    expect(await repo.recordPlaybookRealWorldResult('pb', 'worked', 'Ran it on release 1.4; the coverage script caught two missing PR numbers and the retry fixed them.')).toEqual({ ok: true });
    const after = (await db.playbooks.get('pb'))!;
    expect(after.contentVersion).toBe(before.contentVersion);
    expect(after.observedResults).toHaveLength(1);
    const m = playbookMaturity(after, new Map());
    expect(m.state).toBe('applied-to-real-work');
    expect(m.supportedSteps).toBe(0);
    expect(m.reasons.join(' ')).toMatch(/Fixture evaluation is incomplete/);
    expect(await repo.recordPlaybookRealWorldResult('nope', 'worked', 'x')).toMatchObject({ ok: false });
  });
});

describe('transfer tasks and older backups', () => {
  it('a backup from before transfer tasks (and before evidence fields) imports cleanly and leaves transfer tasks empty', async () => {
    const db = await freshDb();
    const base = fromTemplate('pb-old', PLAYBOOK_TEMPLATES[0]!, (() => { let i = 0; return () => `o${++i}`; })(), T0) as unknown as Record<string, unknown>;
    const { contentVersion: _a, evidenceLinks: _b, evaluations: _c, ...r3 } = base;
    const steps = (base.steps as Record<string, unknown>[]).map((s) => { const { verifiedFingerprint: _f, ...rest } = s; return rest; });
    const file = JSON.stringify({ format: 'claude-forge-backup', version: 1, exportedAt: T0, app: 'claude-forge', notice: '', data: { playbooks: [{ ...r3, steps }] } });
    const parsed = parseBackup(file);
    expect(parsed.preview.fatal).toBeNull();
    expect(parsed.preview.invalidCount).toBe(0);
    await applyImport(parsed.valid, 'merge');
    const pb = (await db.playbooks.get('pb-old'))!;
    expect(pb.contentVersion).toBe(1);
    expect(pb.evidenceLinks).toEqual([]);
    expect(await db.transferTasks.count()).toBe(0);
  });
});

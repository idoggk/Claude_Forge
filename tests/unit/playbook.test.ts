import { describe, expect, it } from 'vitest';
import { PLAYBOOK_TEMPLATES } from '@/content/playbook/seeds';
import { LESSONS } from '@/content/lessons';
import { CAPABILITY_IDS } from '@/content/capability/map';
import { PlaybookSchema, type Playbook } from '@/domain/playbook/model';
import { PLAYBOOK_FORMAT, counts, duplicatePlaybook, exportPlaybookJson, exportPlaybookMarkdown, fromTemplate, newPlaybook, parsePlaybookJson, playbookProblems, reliabilityChecklist, stepProblem, blankStep } from '@/domain/playbook/ops';
import { evaluateExternal } from '@/domain/assessment/external';
import { gradeItem } from '@/domain/assessment/grade';

let k = 0;
const sid = () => `st-${++k}`;

describe('seeded exemplar playbooks', () => {
  it('are designs, never pre-verified, and use real capability ids', () => {
    expect(PLAYBOOK_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(PLAYBOOK_TEMPLATES.map((t) => t.templateId)).size).toBe(PLAYBOOK_TEMPLATES.length);
    for (const t of PLAYBOOK_TEMPLATES) {
      for (const s of t.steps) { expect(s.status, `${t.templateId}/${s.id}`).toBe('planned'); expect(s.verifiedNote).toBe(''); }
      for (const c of t.capabilityIds) expect(CAPABILITY_IDS.has(c), `${t.templateId} -> ${c}`).toBe(true);
      expect(t.notes, t.templateId).toMatch(/design only|designs?/i);
    }
  });

  it('every seed meets the reliability checklist taught in Lesson 15 (so it is a fair exemplar)', () => {
    for (const t of PLAYBOOK_TEMPLATES) {
      const pb = fromTemplate('pb', t, sid);
      const res = reliabilityChecklist(pb);
      expect(res.checks.filter((c) => !c.ok).map((c) => c.label), t.templateId).toEqual([]);
      expect(res.ok, t.templateId).toBe(true);
      expect(playbookProblems(pb), t.templateId).toEqual([]);
    }
  });

  it('copying a template gives new step ids, planned status and template origin', () => {
    const pb = fromTemplate('pb1', PLAYBOOK_TEMPLATES[0]!, sid);
    expect(pb.origin).toEqual({ kind: 'template', templateId: PLAYBOOK_TEMPLATES[0]!.templateId });
    expect(new Set(pb.steps.map((s) => s.id)).size).toBe(pb.steps.length);
    expect(pb.steps.every((s) => s.id !== PLAYBOOK_TEMPLATES[0]!.steps[0]!.id)).toBe(true);
    expect(counts(pb).verified).toBe(0);
  });
});

describe('Lesson 15 external check reads saved playbooks', () => {
  const l15 = LESSONS.find((l) => l.id === 'L15-reliable-ai-workflow')!;
  const item = l15.assessment.items.find((i) => i.kind === 'external')!;
  it('fails with no playbook and passes with a complete one; an empty playbook does not pass', () => {
    expect(gradeItem(item, undefined, evaluateExternal([], [], [], [])).correct).toBe(false);
    expect(gradeItem(item, undefined, evaluateExternal([], [], [], [newPlaybook('p')])).correct).toBe(false);
    const good = fromTemplate('p', PLAYBOOK_TEMPLATES[0]!, sid);
    expect(gradeItem(item, undefined, evaluateExternal([], [], [], [good])).correct).toBe(true);
  });
});

describe('verification honesty', () => {
  it('a step cannot be verified without saying what verified it', () => {
    const s = { ...blankStep('s1'), title: 'Check', status: 'verified' as const, verifiedNote: '' };
    expect(stepProblem(s)).toMatch(/what verified it/);
    expect(stepProblem({ ...s, verifiedNote: 'Ran it twice on the sample export and saw the count gate pass.' })).toBeNull();
    expect(stepProblem({ ...s, status: 'done' })).toBeNull();
  });
});

describe('export and import', () => {
  const base = (): Playbook => {
    const p = fromTemplate('pb1', PLAYBOOK_TEMPLATES[1]!, sid);
    p.steps[0] = { ...p.steps[0]!, status: 'verified', verifiedNote: 'Saw it pass on my own export file.', verifiedAt: 't' };
    p.observedResults = [{ id: 'o1', at: '2026-11-01T00:00:00.000Z', outcome: 'worked', text: 'Ran on real tickets.' }];
    return p;
  };

  it('markdown states that it is a design that was not executed, and shows gates, failure handling and approvals', () => {
    const md = exportPlaybookMarkdown(base(), '2026-11-05T00:00:00.000Z');
    expect(md).toMatch(/not executed by Claude Forge/);
    expect(md).toMatch(/Verification gate/);
    expect(md).toMatch(/If it fails/);
    expect(md).toMatch(/human approval/);
    expect(md).toMatch(/Observed results \(self-reported\)/);
    expect(md).toMatch(/\*\*Status:\*\* verified - Saw it pass/);
  });

  it('JSON round-trips through the importer, which resets other people\'s verification claims', () => {
    const json = exportPlaybookJson(base());
    expect(JSON.parse(json).format).toBe(PLAYBOOK_FORMAT);
    const r = parsePlaybookJson(json, 'pb-new', sid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.playbook.id).toBe('pb-new');
    expect(r.playbook.origin.kind).toBe('imported');
    expect(r.playbook.steps.every((s) => s.status === 'planned' && s.verifiedNote === '')).toBe(true);
    expect(r.playbook.observedResults).toEqual([]);
    expect(r.playbook.revisions).toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/reset to "planned"/);
    expect(PlaybookSchema.safeParse(r.playbook).success).toBe(true);
  });

  it('rejects bad input with a clear reason and never throws', () => {
    expect(parsePlaybookJson('not json', 'x', sid)).toMatchObject({ ok: false, error: expect.stringMatching(/not valid JSON/) });
    expect(parsePlaybookJson('{"format":"something-else"}', 'x', sid)).toMatchObject({ ok: false, error: expect.stringMatching(/not a Claude Forge playbook/) });
    expect(parsePlaybookJson(JSON.stringify({ format: PLAYBOOK_FORMAT, version: 99, playbook: {} }), 'x', sid)).toMatchObject({ ok: false, error: expect.stringMatching(/newer version/) });
    expect(parsePlaybookJson(JSON.stringify({ format: PLAYBOOK_FORMAT, version: 1, playbook: { title: '' } }), 'x', sid)).toMatchObject({ ok: false, error: expect.stringMatching(/failed validation/) });
    expect(parsePlaybookJson('x'.repeat(1_100_000), 'x', sid)).toMatchObject({ ok: false });
    expect(parsePlaybookJson('null', 'x', sid).ok).toBe(false);
  });

  it('markdown from imported text content never becomes HTML: hostile text stays inert text in the export', () => {
    const p = newPlaybook('p', { title: '<img src=x onerror=alert(1)>', goal: '<script>alert(1)</script> goal text here' });
    const md = exportPlaybookMarkdown(p);
    expect(md).toContain('<script>alert(1)</script>'); // exported verbatim as text; the app renders it as text, never as HTML
    const r = parsePlaybookJson(exportPlaybookJson(p), 'q', sid);
    expect(r.ok).toBe(true);
  });

  it('duplicate resets statuses and marks origin', () => {
    const d = duplicatePlaybook(base(), 'dup', sid);
    expect(d.title).toMatch(/\(copy\)$/);
    expect(d.origin.kind).toBe('duplicate');
    expect(counts(d).verified).toBe(0);
    expect(d.observedResults).toEqual([]);
  });
});

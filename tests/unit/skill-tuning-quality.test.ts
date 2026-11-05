import { describe, expect, it } from 'vitest';
import { SkillDraftSchema, type LiveTest, type Scenario, type SkillDraft } from '@/domain/skills/model';
import { analyzeTuning } from '@/domain/skills/tuning';
import { reviewQuality } from '@/domain/skills/quality';
import { triggerFingerprint } from '@/domain/skills/trigger';
import { starterContent } from '@/features/workshop/starter';

const DESC = 'Diagnoses merge chains that lose value in the board resolver. Use when pieces vanish or totals drop after a merge. Not for UI or art bugs.';
let seq = 0;
const sc = (prompt: string, expected: Scenario['expected']): Scenario => ({ id: `sc${++seq}`, prompt, expected, note: '' });
const lt = (s: Scenario | null, observed: LiveTest['observed'], d: SkillDraft | null, at = '2026-01-01T00:00:00Z', over: Partial<LiveTest> = {}): LiveTest => ({
  id: `lt${++seq}`, scenarioId: s?.id ?? null, prompt: s?.prompt ?? 'custom', testedAt: at, claudeCodeVersion: '', observed, notes: '',
  descriptionFingerprint: d ? triggerFingerprint(d.description, d.whenToUse) : '', ...over,
});
function draft(scenarios: Scenario[], live: (d: SkillDraft) => LiveTest[] = () => [], over: Partial<SkillDraft> = {}): SkillDraft {
  const base = SkillDraftSchema.parse({ ...starterContent(), name: 'merge-chain-debugger', description: DESC, id: 'd1', createdAt: 't', updatedAt: 't', scenarios, ...over });
  return { ...base, liveTests: live(base) };
}

describe('trigger tuning: expected vs manually recorded', () => {
  it('classifies each scenario from what YOU recorded, and never counts untested scenarios as passes or misses', () => {
    const a = sc('Pieces vanish when I drop a fourth one', 'activate');
    const b = sc('Totals drop after a cascade', 'activate');
    const c = sc('Fix the shop button colour', 'not-activate');
    const d = sc('Why is the title screen blurry?', 'not-activate');
    const e = sc('Is merge balance fair?', 'ambiguous');
    const f = sc('Never tested', 'activate');
    const t = analyzeTuning(draft([a, b, c, d, e, f], (x) => [lt(a, 'activated', x), lt(b, 'not-activated', x), lt(c, 'activated', x), lt(d, 'not-activated', x), lt(e, 'activated', x)]));
    const out = Object.fromEntries(t.rows.map((r) => [r.scenario.id, r.outcome]));
    expect(out[a.id]).toBe('true-positive');
    expect(out[b.id]).toBe('false-negative');
    expect(out[c.id]).toBe('false-positive');
    expect(out[d.id]).toBe('true-negative');
    expect(out[e.id]).toBe('ambiguous-observed');
    expect(out[f.id]).toBe('untested');
    expect(t.counts.untested).toBe(1);
    expect(t.precision).toBeCloseTo(0.5); // 1 TP / (1 TP + 1 FP)
    expect(t.recall).toBeCloseTo(0.5); // 1 TP / (1 TP + 1 FN)
    expect(t.counted).toEqual({ positives: 2, negatives: 2 });
    expect(t.notes.join(' ')).toMatch(/1 scenario\(s\) have no live observation/);
  });

  it('"only after rephrasing" is not a pass: it counts against recall', () => {
    const a = sc('Merge totals look wrong', 'activate');
    const t = analyzeTuning(draft([a], (x) => [lt(a, 'partial', x)]));
    expect(t.rows[0]!.outcome).toBe('partial');
    expect(t.recall).toBe(0);
    expect(t.rows[0]!.suggestion).toMatch(/only activated after rephrasing/i);
  });

  it('unmeasured is unmeasured, not zero: no negatives observed means precision and false positives are unknown', () => {
    const a = sc('Pieces vanish after merge', 'activate');
    const t = analyzeTuning(draft([a], (x) => [lt(a, 'activated', x)]));
    expect(t.precision).toBeNull();
    expect(t.recall).toBe(1);
    expect(t.notes.join(' ')).toMatch(/false positives are unmeasured \(not zero\)/);
    expect(analyzeTuning(draft([])).precision).toBeNull();
    expect(analyzeTuning(draft([])).recall).toBeNull();
    expect(analyzeTuning(draft([])).level).toBe('none');
  });

  it('uses only the most recent observation per scenario', () => {
    const a = sc('Pieces vanish after merge', 'activate');
    const t = analyzeTuning(draft([a], (x) => [lt(a, 'not-activated', x, '2026-01-01T00:00:00Z'), lt(a, 'activated', x, '2026-02-01T00:00:00Z')]));
    expect(t.rows[0]!.outcome).toBe('true-positive');
    expect(t.rows[0]!.observationCount).toBe(2);
  });

  it('an observation made against an older description is flagged and excluded from the rates', () => {
    const a = sc('Pieces vanish after merge', 'activate');
    const b = sc('Fix the shop button', 'not-activate');
    const d0 = draft([a, b]);
    const live = [lt(a, 'activated', d0), lt(b, 'not-activated', d0)];
    const edited = { ...d0, description: DESC + ' Also handles score bugs.', liveTests: live };
    const t = analyzeTuning(edited);
    expect(t.rows.every((r) => r.stale)).toBe(true);
    expect(t.counted).toEqual({ positives: 0, negatives: 0 });
    expect(t.precision).toBeNull();
    expect(t.notes.join(' ')).toMatch(/older description/);
    expect(t.rows.every((r) => r.suggestion === null)).toBe(true);
  });

  it('records from before fingerprints existed are counted but flagged as version-unknown', () => {
    const a = sc('Pieces vanish after merge', 'activate');
    const t = analyzeTuning(draft([a], () => [lt(a, 'activated', null)]));
    expect(t.rows[0]!.versionUnknown).toBe(true);
    expect(t.rows[0]!.stale).toBe(false);
    expect(t.counted.positives).toBe(1);
    expect(t.notes.join(' ')).toMatch(/before Forge tracked the wording/);
  });

  it('false-negative advice names prompt words the description never uses; false-positive advice names shared words', () => {
    const fn = sc('Cascades keep deleting my gems', 'activate');
    const fp = sc('The merge animation timing is off', 'not-activate');
    const t = analyzeTuning(draft([fn, fp], (x) => [lt(fn, 'not-activated', x), lt(fp, 'activated', x)]));
    expect(t.rows[0]!.suggestion).toMatch(/never uses: .*(cascade|gem|deleting)/);
    expect(t.rows[1]!.suggestion).toMatch(/Not for/);
    expect(t.rows[1]!.suggestion).toMatch(/heuristic/);
  });

  it('sufficiency never overstates: anecdotal below 4 observations, limited at most', () => {
    const mk = (n: number) => { const ss = Array.from({ length: n }, (_, i) => sc(`prompt ${i} merge`, i % 2 ? 'not-activate' : 'activate')); return analyzeTuning(draft(ss, (x) => ss.map((s) => lt(s, s.expected === 'activate' ? 'activated' : 'not-activated', x)))); };
    expect(mk(2).level).toBe('anecdotal');
    expect(mk(5).level).toBe('weak');
    expect(mk(10).level).toBe('limited');
    expect(mk(10).headline).toMatch(/directional/);
  });

  it('a stored live test without the new field still parses (migration-safe default)', () => {
    const r = SkillDraftSchema.parse({ ...starterContent(), id: 'x', createdAt: 't', updatedAt: 't', liveTests: [{ id: 'a', scenarioId: null, prompt: 'p', testedAt: 't', observed: 'activated' }] });
    expect(r.liveTests[0]!.descriptionFingerprint).toBe('');
  });
});

describe('Skill quality review', () => {
  const rich = () => {
    const ss = [sc('Pieces vanish after a merge', 'activate'), sc('Totals drop after a cascade', 'activate'), sc('Fix the shop button', 'not-activate'), sc('Why is the logo blurry', 'not-activate'), sc('Is the game fun?', 'ambiguous')];
    return draft(ss, (x) => ss.slice(0, 4).map((s) => lt(s, s.expected === 'activate' ? 'activated' : 'not-activated', x)), {
      instructions: '# Debugger\n\n1. Run `npx vitest run` and read the failing case.\n2. Check which invariant is violated and quote the line.\n3. Compare the board before and after the merge.\n4. Never patch before you have a failing case; stop and ask if none exists.\n\n## Output\n\nFinish with a line `Root cause: <function>`.\n\nSee [the invariants](references/invariants.md).',
      references: [{ path: 'references/invariants.md', content: '# Invariants\n' }],
    });
  };

  it('is a per-dimension review with reasons, never a single score', () => {
    const q = reviewQuality(rich());
    expect(q.dimensions.map((d) => d.id)).toEqual(['trigger', 'procedure', 'evidence', 'output', 'safety', 'disclosure', 'scenarios', 'live']);
    for (const d of q.dimensions) { expect([0, 1, 2, 3]).toContain(d.score); expect(d.evidence.length).toBeGreaterThan(0); }
    expect(q).not.toHaveProperty('score');
    expect(q.solid).toBeGreaterThanOrEqual(6);
    expect(q.disclaimer).toMatch(/not that it works/);
  });

  it('a vague draft scores low and gets concrete advice; the starter template from the app is mid-range', () => {
    const vague = reviewQuality(draft([], () => [], { description: 'Helps with games.', instructions: 'Think about it and give advice.', references: [] }));
    expect(vague.dimensions.find((d) => d.id === 'trigger')!.score).toBeLessThanOrEqual(1);
    expect(vague.dimensions.find((d) => d.id === 'evidence')!.score).toBe(0);
    expect(vague.dimensions.find((d) => d.id === 'output')!.score).toBe(0);
    expect(vague.dimensions.find((d) => d.id === 'scenarios')!.advice.length).toBeGreaterThan(0);
    expect(vague.solid).toBeLessThan(reviewQuality(rich()).solid);
  });

  it('the maturity ladder only ticks a rung when the evidence exists, and NEVER ticks field-proven', () => {
    const r = rich();
    const q = reviewQuality(r);
    const rung = (id: string) => q.ladder.find((x) => x.id === id)!;
    expect(rung('authored').reached).toBe(true);
    expect(rung('valid').reached).toBe(true);
    expect(rung('scenarios').reached).toBe(true);
    expect(rung('live').reached).toBe(true);
    expect(rung('measured').reached).toBe(false);
    expect(rung('field').reached).toBe(false);
    expect(rung('field').requires).toMatch(/your own recorded evidence/i);
    // measured only with a graduated loop built on THIS Skill
    expect(reviewQuality(r, { loops: [{ skillId: 'other', status: 'graduated' }] }).ladder.find((x) => x.id === 'measured')!.reached).toBe(false);
    expect(reviewQuality(r, { loops: [{ skillId: r.id, status: 'active' }] }).ladder.find((x) => x.id === 'measured')!.reached).toBe(false);
    const withLoop = reviewQuality(r, { loops: [{ skillId: r.id, status: 'graduated' }] });
    expect(withLoop.ladder.find((x) => x.id === 'measured')!.reached).toBe(true);
    expect(withLoop.ladder.find((x) => x.id === 'field')!.reached).toBe(false);
  });

  it('editing the description drops the live-tested rung, because the old observations tested different wording', () => {
    const r = rich();
    expect(reviewQuality(r).ladder.find((x) => x.id === 'live')!.reached).toBe(true);
    const edited = { ...r, description: r.description + ' And also economy questions.' };
    const q = reviewQuality(edited);
    expect(q.ladder.find((x) => x.id === 'live')!.reached).toBe(false);
    expect(q.dimensions.find((d) => d.id === 'live')!.score).toBe(0);
  });

  it('an empty draft reaches no rung', () => {
    const e = reviewQuality(draft([], () => [], { name: '', description: '', instructions: '', references: [] }));
    expect(e.ladder.every((x) => !x.reached)).toBe(true);
  });
});

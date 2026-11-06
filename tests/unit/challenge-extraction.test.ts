import { describe, expect, it } from 'vitest';
import { EXTRACTORS, MAX_VALIDATORS, SEEDS, VALIDATORS, diffRecords, expectedRecord, mostSilentExtractor, parseQuantity, questions, renderDocument, runValidatorLab, scoreExtraction, seededErrorsFor, validatorsCatchingInventedPo } from '@/domain/challenges/extraction';

describe('the fixture is generated from seeds, so the expected answers are computed', () => {
  it('six documents, each rendered from its seed, with the traps the challenge teaches', () => {
    expect(SEEDS).toHaveLength(6);
    const docs = Object.fromEntries(SEEDS.map((s) => [s.id, renderDocument(s)]));
    expect(docs.d3).not.toMatch(/order reference/); // no purchase order in the text
    expect(docs.d4).toMatch(/Date: 03\/04\/26/); // ambiguous
    expect(docs.d6).toMatch(/two dozen x Stapler refill/);
    expect(docs.d2).toMatch(/3 March 2026/);
    for (const d of Object.values(docs)) expect(d).not.toMatch(/https?:|@[a-z]+\./i); // fictional: no real domains or emails
  });

  it('the expected record is computed: null for a missing PO, null + ambiguity flag for an ambiguous date, a computed total that exposes the contradiction', () => {
    const byId = Object.fromEntries(SEEDS.map((s) => [s.id, expectedRecord(s)]));
    expect(byId.d3!.po_number).toBeNull();
    expect(byId.d4).toMatchObject({ date: null, date_ambiguous: true });
    expect(byId.d5).toMatchObject({ total_stated: 1240, total_computed: 1180, totals_consistent: false });
    expect(byId.d1).toMatchObject({ total_computed: 745, totals_consistent: true });
    expect(byId.d6!.line_items[0]!.quantity).toBe(24);
  });

  it('a small deterministic parser reads quantities, including "two dozen"', () => {
    expect([parseQuantity('2'), parseQuantity('two dozen'), parseQuantity('twelve'), parseQuantity('a handful')]).toEqual([2, 24, 12, null]);
  });
});

describe('seeded errors are found by diffing, not asserted', () => {
  it('the faithful extractor has none; the eager one invents, guesses and mis-normalises; the literal one is unnormalised', () => {
    expect(seededErrorsFor('faithful')).toEqual([]);
    const eager = seededErrorsFor('eager');
    const kinds = new Set(eager.map((e) => e.kind));
    for (const k of ['hallucinated', 'silent-guess', 'wrong-normalization', 'missed-conflict']) expect(kinds.has(k as never), k).toBe(true);
    expect(eager.find((e) => e.docId === 'd3' && e.field === 'po_number')).toMatchObject({ kind: 'hallucinated', got: 'PO-0000', want: null });
    expect(eager.find((e) => e.docId === 'd4' && e.field === 'date')).toMatchObject({ kind: 'silent-guess', want: null });
    expect(eager.find((e) => e.docId === 'd6' && e.field === 'line_items[0].quantity')).toMatchObject({ kind: 'wrong-normalization', got: 2, want: 24 });
    expect(eager.find((e) => e.docId === 'd2' && e.field === 'vendor')!.kind).toBe('hallucinated');
    const lit = seededErrorsFor('literal');
    expect(lit.some((e) => e.kind === 'type-error')).toBe(true);
    expect(lit.some((e) => e.field === 'totals_consistent')).toBe(true);
  });

  it('diffRecords ignores number formatting noise but not real differences', () => {
    const s = SEEDS[0]!;
    const e = expectedRecord(s);
    expect(diffRecords('d1', { ...e, total_stated: 745.0001 }, e)).toEqual([]);
    expect(diffRecords('d1', { ...e, total_stated: 700 }, e)).toHaveLength(1);
  });
});

describe('validators: valid JSON is not faithful JSON', () => {
  it('a schema/type check alone sees none of the eager extractor\'s plausible-looking errors', () => {
    const r = runValidatorLab(['schema-types']);
    const eager = r.perExtractor.find((p) => p.extractorId === 'eager')!;
    expect(eager.caught).toEqual([]); // "PO-0000" is a string, 2 is a number, false is a boolean: every one is valid JSON
    expect(eager.missed.length).toBe(eager.seeded.length);
    expect(r.perExtractor.find((p) => p.extractorId === 'literal')!.caught.length).toBeGreaterThan(10); // the literal extractor's type errors are visible
    expect(r.passed).toBe(false);
  });

  it('each check catches what it claims to catch', () => {
    const caught = (id: string, ex: 'eager' | 'literal', docId: string, field: string) => runValidatorLab([id]).perExtractor.find((p) => p.extractorId === ex)!.caught.some((e) => e.docId === docId && e.field === field);
    expect(caught('no-placeholders', 'eager', 'd3', 'po_number')).toBe(true);
    expect(caught('quote-in-source', 'eager', 'd3', 'po_number')).toBe(true);
    expect(caught('quote-in-source', 'eager', 'd2', 'vendor')).toBe(true);
    expect(caught('ambiguous-date-guard', 'eager', 'd4', 'date')).toBe(true);
    expect(caught('sum-check', 'eager', 'd5', 'totals_consistent')).toBe(true);
    expect(caught('rederive-quantities', 'eager', 'd6', 'line_items[0].quantity')).toBe(true);
    expect(caught('schema-types', 'literal', 'd1', 'line_items[0].quantity')).toBe(true);
    expect(caught('date-iso', 'literal', 'd2', 'date')).toBe(true);
  });

  it('"every field must be filled" raises false alarms on the faithful extractor, and a useless check changes nothing', () => {
    const harm = runValidatorLab(['all-fields-required']);
    expect(harm.perExtractor.find((p) => p.extractorId === 'faithful')!.falseAlarms.map((x) => x.field).sort()).toEqual(['date', 'po_number']);
    expect(harm.passed).toBe(false);
    const useless = runValidatorLab(['max-length']);
    expect(useless.caughtTotal).toBe(0);
    expect(useless.falseAlarms).toBe(0);
  });

  it('a good set exists: it covers at least 90% of the errors with no false alarms and no more than six checks', () => {
    const good = ['schema-types', 'quote-in-source', 'sum-check', 'ambiguous-date-guard', 'rederive-quantities', 'date-iso'];
    const r = runValidatorLab(good);
    expect(good.length).toBeLessThanOrEqual(MAX_VALIDATORS);
    expect(r.falseAlarms).toBe(0);
    expect(r.coverage).toBeGreaterThanOrEqual(0.9); // even for the extractor it catches least
    expect(r.passed).toBe(true);
  });

  it('piling on every check fails: more than six, and the harmful one fires false alarms', () => {
    const all = runValidatorLab(VALIDATORS.map((v) => v.id));
    expect(all.passed).toBe(false);
    expect(all.notes.join(' ')).toMatch(/pile of checks/);
    expect(all.notes.join(' ')).toMatch(/false alarm/);
  });

  it('every validator has a label and a plain statement of what it does', () => {
    for (const v of VALIDATORS) { expect(v.label.length).toBeGreaterThan(4); expect(v.what.length).toBeGreaterThan(20); }
    expect(EXTRACTORS.map((e) => e.id)).toEqual(['eager', 'literal', 'faithful']);
  });
});

describe('judgement questions have computed answers', () => {
  it('the silent extractor and the checks that catch the invented PO come from the diffs, not from a typed answer', () => {
    expect(mostSilentExtractor()).toBe('eager');
    const po = validatorsCatchingInventedPo();
    expect(po).toContain('no-placeholders');
    expect(po).toContain('quote-in-source');
    expect(po).not.toContain('schema-types');
    expect(po).not.toContain('all-fields-required');
    expect(questions().find((q) => q.id === 'harm')!.prompt).toMatch(/raised \d+ false alarm/);
  });

  it('scoring: a strong design with right answers scores high, valid-JSON-only scores low, and answers are graded independently', () => {
    const answers = { silent: 'eager', po: 'quote-in-source', harm: 'invent' };
    const strong = scoreExtraction(['schema-types', 'quote-in-source', 'sum-check', 'ambiguous-date-guard', 'rederive-quantities', 'date-iso'], answers);
    const weak = scoreExtraction(['schema-types'], { silent: 'literal', po: 'schema-types', harm: 'slow' });
    expect(strong.score).toBe(1);
    expect(weak.lab.coverage).toBe(0); // it sees none of the eager extractor's errors
    expect(weak.score).toBeLessThan(0.2);
    expect(weak.answers.every((a) => !a.correct)).toBe(true);
    expect(scoreExtraction([], {}).score).toBe(0);
  });
});

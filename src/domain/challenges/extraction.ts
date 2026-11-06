/**
 * Challenge A: faithful structured extraction.
 *
 * Six fictional supplier documents are RENDERED from seed records, so the expected extraction is computed from the same seed
 * (never typed separately). Three fictional "extractors" produce JSON from the seeds with different behaviours; the seeded
 * errors are found by DIFFING their output against the expected record. The learner picks validators and the app runs them,
 * showing what each catches and what it wrongly rejects. All vendors, numbers and documents are invented.
 */
export type Currency = 'USD' | 'EUR' | 'GBP';
export interface Item { description: string; quantity: number; unitPrice: number; qtyWords?: string }
export interface Seed {
  id: string;
  title: string;
  vendor: string;
  invoiceNumber: string;
  poNumber: string | null;
  /** ISO date when the document states it unambiguously. */
  date: string;
  dateStyle: 'iso' | 'long' | 'ambiguous';
  currency: Currency;
  items: Item[];
  /** The total the document states (may disagree with the items). */
  statedTotal: number;
  /** A hallucination trap for the eager extractor: the longer company name it would invent. */
  inventedVendor?: string;
}

export const SEEDS: Seed[] = [
  { id: 'd1', title: 'Clean invoice', vendor: 'Northwind Supply', invoiceNumber: 'NW-1001', poNumber: 'PO-7781', date: '2026-03-05', dateStyle: 'iso', currency: 'USD', items: [{ description: 'Pallet jack', quantity: 2, unitPrice: 310 }, { description: 'Safety gloves (box)', quantity: 10, unitPrice: 12.5 }], statedTotal: 745 },
  { id: 'd2', title: 'Long-form date, euro', vendor: 'Brightwater', invoiceNumber: 'BW-2290', poNumber: 'PO-7790', date: '2026-03-03', dateStyle: 'long', currency: 'EUR', items: [{ description: 'Filter cartridge', quantity: 6, unitPrice: 48 }], statedTotal: 288, inventedVendor: 'Brightwater Industries Inc.' },
  { id: 'd3', title: 'No purchase order', vendor: 'Harbor Tools', invoiceNumber: 'HT-0042', poNumber: null, date: '2026-02-17', dateStyle: 'iso', currency: 'USD', items: [{ description: 'Torque wrench', quantity: 1, unitPrice: 189 }], statedTotal: 189 },
  { id: 'd4', title: 'Ambiguous slash date', vendor: 'Kestrel Parts', invoiceNumber: 'KP-5570', poNumber: 'PO-7802', date: '2026-04-03', dateStyle: 'ambiguous', currency: 'USD', items: [{ description: 'Bearing set', quantity: 4, unitPrice: 22.5 }], statedTotal: 90 },
  { id: 'd5', title: 'Total contradicts the items', vendor: 'Alder & Finch', invoiceNumber: 'AF-3308', poNumber: 'PO-7811', date: '2026-03-21', dateStyle: 'iso', currency: 'GBP', items: [{ description: 'Desk lamp', quantity: 8, unitPrice: 60 }, { description: 'Cable organiser', quantity: 20, unitPrice: 35 }], statedTotal: 1240 },
  { id: 'd6', title: 'Quantity in words, pound sterling', vendor: 'Pennant Office', invoiceNumber: 'PO-9902-A', poNumber: 'PO-7820', date: '2026-03-28', dateStyle: 'long', currency: 'GBP', items: [{ description: 'Stapler refill', quantity: 24, unitPrice: 2.5, qtyWords: 'two dozen' }], statedTotal: 60 },
];

const SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€', GBP: '£' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const money = (n: number) => n.toFixed(2);
const sum = (items: Item[]) => Math.round(items.reduce((a, i) => a + i.quantity * i.unitPrice, 0) * 100) / 100;

function renderDate(s: Seed): string {
  const [y, m, d] = s.date.split('-').map(Number) as [number, number, number];
  if (s.dateStyle === 'iso') return s.date;
  if (s.dateStyle === 'long') return `${d} ${MONTHS[m - 1]} ${y}`;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(y % 100).padStart(2, '0')}`;
}

/** The text of a document, built from its seed. */
export function renderDocument(s: Seed): string {
  const L: string[] = [`INVOICE ${s.invoiceNumber}`, `From: ${s.vendor}`];
  if (s.poNumber) L.push(`Your order reference: ${s.poNumber}`);
  L.push(`Date: ${renderDate(s)}`, '');
  for (const i of s.items) L.push(`${i.qtyWords ?? i.quantity} x ${i.description} @ ${SYMBOL[s.currency]}${money(i.unitPrice)}`);
  L.push('', `Total due: ${SYMBOL[s.currency]}${money(s.statedTotal)}`);
  return L.join('\n');
}

/* ------------------------------------------------------------------------------------------------- expected and extractors */

export interface ExtractedItem { description: unknown; quantity: unknown; unit_price: unknown }
export interface ExtractedRecord {
  vendor: unknown;
  invoice_number: unknown;
  po_number: unknown;
  date: unknown;
  date_ambiguous: unknown;
  currency: unknown;
  line_items: ExtractedItem[];
  total_stated: unknown;
  total_computed: unknown;
  totals_consistent: unknown;
}

export const isAmbiguousDate = (s: Seed): boolean => s.dateStyle === 'ambiguous';

export function expectedRecord(s: Seed): ExtractedRecord {
  const computed = sum(s.items);
  return {
    vendor: s.vendor, invoice_number: s.invoiceNumber, po_number: s.poNumber,
    date: isAmbiguousDate(s) ? null : s.date, date_ambiguous: isAmbiguousDate(s), currency: s.currency,
    line_items: s.items.map((i) => ({ description: i.description, quantity: i.quantity, unit_price: i.unitPrice })),
    total_stated: s.statedTotal, total_computed: computed, totals_consistent: Math.abs(computed - s.statedTotal) < 0.005,
  };
}

/** Eager: fills gaps with plausible values and never questions the document. Valid JSON, unfaithful content. */
function eager(s: Seed): ExtractedRecord {
  const e = expectedRecord(s);
  const [y, m, d] = s.date.split('-').map(Number) as [number, number, number];
  const guessed = isAmbiguousDate(s) ? `${y}-${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}` : e.date; // reads 03/04/26 as day/month and states it as fact
  return {
    ...e,
    vendor: s.inventedVendor ?? s.vendor,
    po_number: s.poNumber ?? 'PO-0000',
    date: guessed, date_ambiguous: false,
    line_items: s.items.map((i) => ({ description: i.description, quantity: i.qtyWords ? 2 : i.quantity, unit_price: i.unitPrice })), // "two dozen" becomes 2
    total_computed: s.statedTotal, totals_consistent: true, // copies the stated total and calls it consistent
  };
}

/** Literal: copies text as written. Honest about gaps, but nothing is normalised or checked. */
function literal(s: Seed): ExtractedRecord {
  return {
    vendor: s.vendor, invoice_number: s.invoiceNumber, po_number: s.poNumber,
    date: renderDate(s), date_ambiguous: null, currency: SYMBOL[s.currency],
    line_items: s.items.map((i) => ({ description: i.description, quantity: String(i.qtyWords ?? i.quantity), unit_price: `${SYMBOL[s.currency]}${money(i.unitPrice)}` })),
    total_stated: `${SYMBOL[s.currency]}${money(s.statedTotal)}`, total_computed: null, totals_consistent: null,
  };
}

export const EXTRACTORS = [
  { id: 'eager', label: 'Extractor 1 (fills every gap)', run: eager },
  { id: 'literal', label: 'Extractor 2 (copies text as written)', run: literal },
  { id: 'faithful', label: 'Extractor 3 (nulls for the unknown, flags conflicts)', run: expectedRecord },
] as const;
export type ExtractorId = (typeof EXTRACTORS)[number]['id'];

/* ------------------------------------------------------------------------------------------------- seeded errors (a diff) */

export type ErrorKind = 'hallucinated' | 'silent-guess' | 'wrong-normalization' | 'type-error' | 'missed-conflict' | 'missing-field';
export interface SeededError { docId: string; field: string; kind: ErrorKind; got: unknown; want: unknown }

const same = (a: unknown, b: unknown) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.005 : a === b);

function classify(field: string, got: unknown, want: unknown): ErrorKind {
  if (got === null || got === undefined) return 'missing-field';
  if (typeof got !== typeof want && want !== null) return 'type-error';
  if (field === 'date' && want === null) return 'silent-guess';
  if (field === 'totals_consistent' || field === 'total_computed') return 'missed-conflict';
  if (want === null) return 'hallucinated';
  if (typeof got === 'string' && typeof want === 'string' && got.includes(want)) return 'hallucinated';
  return 'wrong-normalization';
}

export function diffRecords(docId: string, got: ExtractedRecord, want: ExtractedRecord): SeededError[] {
  const out: SeededError[] = [];
  const check = (field: string, g: unknown, w: unknown) => { if (!same(g, w)) out.push({ docId, field, kind: classify(field, g, w), got: g, want: w }); };
  for (const f of ['vendor', 'invoice_number', 'po_number', 'date', 'date_ambiguous', 'currency', 'total_stated', 'total_computed', 'totals_consistent'] as const) check(f, got[f], want[f]);
  want.line_items.forEach((w, i) => {
    const g = got.line_items[i];
    check(`line_items[${i}].description`, g?.description, w.description);
    check(`line_items[${i}].quantity`, g?.quantity, w.quantity);
    check(`line_items[${i}].unit_price`, g?.unit_price, w.unit_price);
  });
  return out;
}

/* ------------------------------------------------------------------------------------------------- validators */

export interface Violation { field: string; message: string }
interface Ctx { record: ExtractedRecord; text: string }
export interface Validator { id: string; label: string; what: string; check: (c: Ctx) => Violation[] }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const isIso = (v: unknown): boolean => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, dozen: 12 };
/** A deterministic parser: "two dozen" is 24, "6" is 6. Returns null when it cannot say. */
export function parseQuantity(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const parts = t.split(/\s+/);
  if (parts.length === 2 && parts[1] === 'dozen' && WORD_NUM[parts[0]!] !== undefined) return WORD_NUM[parts[0]!]! * 12;
  if (parts.length === 1 && WORD_NUM[parts[0]!] !== undefined) return WORD_NUM[parts[0]!]!;
  return null;
}
const ITEM_LINE = /^(.+?) x (.+?) @ /;

export const VALIDATORS: Validator[] = [
  { id: 'schema-types', label: 'Schema types', what: 'Every field has the type the schema says (numbers are numbers, currency is a code).', check: ({ record: r }) => {
    const v: Violation[] = [];
    const s = (f: string, _x: unknown, ok: boolean) => { if (!ok) v.push({ field: f, message: 'wrong type' }); };
    s('vendor', r.vendor, typeof r.vendor === 'string'); s('invoice_number', r.invoice_number, typeof r.invoice_number === 'string'); s('po_number', r.po_number, r.po_number === null || typeof r.po_number === 'string');
    s('currency', r.currency, r.currency === null || ['USD', 'EUR', 'GBP'].includes(String(r.currency))); s('total_stated', r.total_stated, r.total_stated === null || typeof r.total_stated === 'number');
    s('date_ambiguous', r.date_ambiguous, typeof r.date_ambiguous === 'boolean'); s('totals_consistent', r.totals_consistent, typeof r.totals_consistent === 'boolean'); s('total_computed', r.total_computed, typeof r.total_computed === 'number');
    r.line_items.forEach((i, k) => { s(`line_items[${k}].quantity`, i.quantity, typeof i.quantity === 'number'); s(`line_items[${k}].unit_price`, i.unit_price, typeof i.unit_price === 'number'); });
    return v;
  } },
  { id: 'required-fields', label: 'Required fields present', what: 'Vendor and invoice number are not empty.', check: ({ record: r }) => [['vendor', r.vendor], ['invoice_number', r.invoice_number]].filter(([, x]) => typeof x !== 'string' || !(x as string).trim()).map(([f]) => ({ field: String(f), message: 'required field is empty' })) },
  { id: 'no-placeholders', label: 'No placeholder values', what: 'Rejects values such as PO-0000, N/A or UNKNOWN standing in for a missing field.', check: ({ record: r }) => (typeof r.po_number === 'string' && /^(po-?0+|n\/a|none|unknown|tbd|0+)$/i.test(r.po_number.trim()) ? [{ field: 'po_number', message: 'looks like a placeholder' }] : []) },
  { id: 'quote-in-source', label: 'Quoted from the source', what: 'Each text value (vendor, invoice and order numbers, item names) must appear in the document.', check: ({ record: r, text }) => {
    const t = norm(text); const v: Violation[] = [];
    for (const [f, x] of [['vendor', r.vendor], ['invoice_number', r.invoice_number], ['po_number', r.po_number]] as const) if (typeof x === 'string' && x && !t.includes(norm(x))) v.push({ field: f, message: 'not found in the document' });
    r.line_items.forEach((i, k) => { if (typeof i.description === 'string' && !t.includes(norm(i.description))) v.push({ field: `line_items[${k}].description`, message: 'not found in the document' }); });
    return v;
  } },
  { id: 'sum-check', label: 'Totals add up', what: 'The record\'s own items must add up to the stated total, and totals_consistent must say so.', check: ({ record: r }) => {
    const items = r.line_items;
    const total = r.total_stated;
    if (typeof total !== 'number' || !items.every((i) => typeof i.quantity === 'number' && typeof i.unit_price === 'number')) return r.totals_consistent === null || r.totals_consistent === undefined ? [{ field: 'totals_consistent', message: 'consistency was not assessed' }, { field: 'total_computed', message: 'the total was not recomputed' }] : [];
    const computed = Math.round(items.reduce((a, i) => a + (i.quantity as number) * (i.unit_price as number), 0) * 100) / 100;
    const consistent = Math.abs(computed - total) < 0.005;
    const out: Violation[] = [];
    if (r.totals_consistent !== consistent) out.push({ field: 'totals_consistent', message: `items add up to ${computed}, so this should be ${consistent}` });
    if (typeof r.total_computed !== 'number' || Math.abs((r.total_computed as number) - computed) > 0.005) out.push({ field: 'total_computed', message: `should be ${computed}` });
    return out;
  } },
  { id: 'ambiguous-date-guard', label: 'Ambiguous dates stay null', what: 'If the document writes a day/month date that could be read two ways, the record must not state one reading as fact.', check: ({ record: r, text }) => {
    const m = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/);
    if (m && Number(m[1]) <= 12 && Number(m[2]) <= 12 && m[1] !== m[2]) {
      const v: Violation[] = [];
      if (r.date !== null) v.push({ field: 'date', message: 'the document\'s date can be read two ways' });
      if (r.date_ambiguous !== true) v.push({ field: 'date_ambiguous', message: 'the ambiguity should be flagged' });
      return v;
    }
    return [];
  } },
  { id: 'date-iso', label: 'Date is a valid ISO date', what: 'The date is YYYY-MM-DD and a real calendar date, or null.', check: ({ record: r }) => (r.date === null || isIso(r.date) ? [] : [{ field: 'date', message: 'not an ISO date' }]) },
  { id: 'rederive-quantities', label: 'Re-derive quantities from the source', what: 'A small deterministic parser reads each quantity from the document ("two dozen" is 24) and compares.', check: ({ record: r, text }) => {
    const lines = text.split('\n').map((l) => l.match(ITEM_LINE)).filter((m): m is RegExpMatchArray => Boolean(m));
    const v: Violation[] = [];
    lines.forEach((m, k) => { const want = parseQuantity(m[1]!); const got = r.line_items[k]?.quantity; if (want !== null && got !== want) v.push({ field: `line_items[${k}].quantity`, message: `the document says ${m[1]}` }); });
    return v;
  } },
  { id: 'all-fields-required', label: 'Every field must be filled', what: 'Rejects any record with a null field.', check: ({ record: r }) => (['po_number', 'date'] as const).filter((f) => r[f] === null).map((f) => ({ field: f, message: 'must not be null' })) },
  { id: 'max-length', label: 'Text fields under 200 characters', what: 'Rejects very long strings.', check: ({ record: r }) => (['vendor', 'invoice_number'] as const).filter((f) => typeof r[f] === 'string' && (r[f] as string).length > 200).map((f) => ({ field: f, message: 'too long' })) },
];

export const MAX_VALIDATORS = 6;

/* ------------------------------------------------------------------------------------------------- running them */

export interface ExtractorResult { extractorId: ExtractorId; seeded: SeededError[]; caught: SeededError[]; missed: SeededError[]; falseAlarms: { docId: string; field: string; validatorId: string; message: string }[] }
/** `coverage` is the lowest share of seeded errors caught for any one extractor. */
export interface LabResult { perExtractor: ExtractorResult[]; coverage: number; falseAlarms: number; seededTotal: number; caughtTotal: number; passed: boolean; notes: string[] }

export function seededErrorsFor(extractorId: ExtractorId): SeededError[] {
  const ex = EXTRACTORS.find((e) => e.id === extractorId)!;
  return SEEDS.flatMap((s) => diffRecords(s.id, ex.run(s), expectedRecord(s)));
}

/** Run the chosen validators on every extractor's output for every document. */
export function runValidatorLab(selected: string[]): LabResult {
  const chosen = VALIDATORS.filter((v) => selected.includes(v.id));
  const perExtractor: ExtractorResult[] = EXTRACTORS.map((ex) => {
    const seeded = seededErrorsFor(ex.id);
    const violations = SEEDS.flatMap((s) => chosen.flatMap((v) => v.check({ record: ex.run(s), text: renderDocument(s) }).map((x) => ({ docId: s.id, field: x.field, validatorId: v.id, message: x.message }))));
    // A failed sum-check shows the document's numbers do not agree, but not which one is wrong: it counts for any seeded error in the numbers.
    const numeric = (f: string) => f.startsWith('line_items[') || f.startsWith('total');
    const matches = (x: { docId: string; field: string; validatorId: string }, e: SeededError) => x.docId === e.docId && (x.field === e.field || (x.validatorId === 'sum-check' && numeric(x.field) && numeric(e.field)));
    const hit = (e: SeededError) => violations.some((x) => matches(x, e));
    const caught = seeded.filter(hit);
    const falseAlarms = violations.filter((x) => !seeded.some((e) => matches(x, e)));
    return { extractorId: ex.id, seeded, caught, missed: seeded.filter((e) => !hit(e)), falseAlarms };
  });
  const seededTotal = perExtractor.reduce((a, p) => a + p.seeded.length, 0);
  const caughtTotal = perExtractor.reduce((a, p) => a + p.caught.length, 0);
  const falseAlarms = perExtractor.reduce((a, p) => a + p.falseAlarms.length, 0);
  // Judged by the WEAKEST extractor: pooling would let a check that sees one extractor's many visible errors hide that it sees none of another's.
  const perCov = perExtractor.filter((p) => p.seeded.length > 0).map((p) => p.caught.length / p.seeded.length);
  const coverage = perCov.length ? Math.min(...perCov) : 1;
  const notes: string[] = [];
  if (selected.length > MAX_VALIDATORS) notes.push(`That is ${selected.length} validators. More than ${MAX_VALIDATORS} is a pile of checks, not a design: say which ones earn their place.`);
  if (falseAlarms > 0) notes.push(`${falseAlarms} false alarm(s): these checks rejected a field that was correct. A check that forces a value for something the document does not contain pushes extractors to invent it.`);
  return { perExtractor, coverage, falseAlarms, seededTotal, caughtTotal, passed: selected.length >= 1 && selected.length <= MAX_VALIDATORS && coverage >= 0.9 && falseAlarms === 0, notes };
}

/* ------------------------------------------------------------------------------------------------- judgement questions (answers computed) */

export interface ExtractionQuestion { id: string; prompt: string; options: { id: string; label: string }[]; correct: string[]; explain: string }

/** Which extractor made the most errors that still look valid: a stated value that is wrong but that a type check cannot see. Computed from the diffs. */
export function mostSilentExtractor(): ExtractorId {
  const types = runValidatorLab(['schema-types']);
  const silent = (id: ExtractorId) => {
    const p = types.perExtractor.find((x) => x.extractorId === id)!;
    return p.seeded.filter((e) => e.got !== null && e.got !== undefined && !p.caught.includes(e)).length;
  };
  return (['eager', 'literal'] as const).reduce((best, id) => (silent(id) > silent(best) ? id : best), 'literal' as ExtractorId);
}

/** Validators that catch the invented purchase-order number in Extractor 1 without a single false alarm on any extractor. */
export function validatorsCatchingInventedPo(): string[] {
  return VALIDATORS.filter((v) => {
    const r = runValidatorLab([v.id]);
    const eagerCaught = r.perExtractor.find((p) => p.extractorId === 'eager')!.caught.some((e) => e.field === 'po_number');
    return eagerCaught && r.falseAlarms === 0;
  }).map((v) => v.id);
}

export function questions(): ExtractionQuestion[] {
  const harmful = runValidatorLab(['all-fields-required']);
  return [
    { id: 'silent', prompt: 'Which extractor made the most errors that still look valid (right type, plausible value)?', options: EXTRACTORS.map((e) => ({ id: e.id, label: e.label })), correct: [mostSilentExtractor()], explain: 'Its output passes a type check, so only a check against the source or an independent calculation can catch it. Valid JSON is not faithful JSON.' },
    { id: 'po', prompt: 'Which single check catches the invented purchase-order number in Extractor 1 without rejecting anything correct?', options: VALIDATORS.map((v) => ({ id: v.id, label: v.label })), correct: validatorsCatchingInventedPo(), explain: 'Both a placeholder check and a quote-from-source check catch it. The type check passes it, because "PO-0000" is a string, and "every field must be filled" would force invention.' },
    { id: 'harm', prompt: `"Every field must be filled" raised ${harmful.falseAlarms} false alarm(s). Why is a rule like that harmful for extraction?`, options: [{ id: 'invent', label: 'It pushes the extractor to invent values for things the document does not contain.' }, { id: 'slow', label: 'It makes validation slower.' }, { id: 'types', label: 'It checks types instead of content.' }], correct: ['invent'], explain: 'A document with no purchase order has no purchase order. The faithful answer is null, and a rule that rejects null rewards a guess.' },
  ];
}

export interface ExtractionScore { score: number; lab: LabResult; answers: { id: string; correct: boolean }[] }

export function scoreExtraction(selected: string[], answers: Record<string, string>): ExtractionScore {
  const lab = runValidatorLab(selected);
  const qs = questions();
  const graded = qs.map((q) => ({ id: q.id, correct: q.correct.includes(answers[q.id] ?? '') }));
  const labScore = (lab.passed ? 1 : Math.max(0, lab.coverage - (lab.falseAlarms > 0 ? 0.25 : 0)) * 0.7);
  const qScore = graded.filter((g) => g.correct).length / qs.length;
  return { score: Math.round((labScore * 0.6 + qScore * 0.4) * 100) / 100, lab, answers: graded };
}

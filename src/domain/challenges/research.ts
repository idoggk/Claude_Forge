/**
 * Challenge B - research reliability. A closed, invented corpus about a fictional build cache ("Tidewater") and
 * three draft summaries. Each draft claim is generated from a base claim, and the generator records which flaw
 * (if any) it injected. The checks below read only the claim and the corpus.
 */
import { runChecks, pct, type Check, type Engine, type Flag, type LabItem, type Question, type Row } from './lab';

export type Tier = 'primary' | 'secondary' | 'vendor';
export interface Source { id: string; title: string; tier: Tier; date: string; topic: string; text: string }
export const AS_OF = '2025-07';

export const CORPUS: Source[] = [
  { id: 'S1', title: 'Tidewater 2 benchmark report (maintainers)', tier: 'primary', date: '2025-03', topic: 'speed', text: 'Median cold build fell from 412 s to 268 s across 14 repositories. Warm builds fell 61%. All runs were on Linux.' },
  { id: 'S2', title: 'Tidewater 1 benchmark report (maintainers)', tier: 'primary', date: '2023-05', topic: 'speed', text: 'Median cold build fell from 390 s to 351 s across 9 repositories.' },
  { id: 'S3', title: 'Tidewater marketing page', tier: 'vendor', date: '2025-06', topic: 'speed', text: 'Tidewater halves your build times. Customers report up to 70% faster pipelines.' },
  { id: 'S4', title: 'Independent measurement on three monorepos', tier: 'secondary', date: '2025-04', topic: 'speed', text: 'Cold builds improved 18-24%. Warm builds improved 55%. Windows runners showed no improvement.' },
  { id: 'S5', title: 'Tidewater 2.0 security advisory', tier: 'primary', date: '2025-02', topic: 'security', text: 'A cache poisoning flaw was fixed in 2.0.3. Versions before 2.0.3 should not share caches across trust boundaries.' },
  { id: 'S6', title: 'Community survey of hit rates', tier: 'secondary', date: '2024-05', topic: 'hit-rate', text: 'Median cache hit rate was 72% after tuning keys. Untuned hit rate was 31%.' },
  { id: 'S7', title: 'Tidewater pricing page', tier: 'vendor', date: '2025-01', topic: 'price', text: 'Cache storage costs $0.08 per GB-month.' },
  { id: 'S8', title: 'Tidewater documentation: platforms', tier: 'primary', date: '2025-05', topic: 'platform', text: 'Tidewater supports Linux and macOS. Windows support is experimental.' },
];
const SRC = new Map(CORPUS.map((s) => [s.id, s]));

export type ClaimType = 'performance' | 'security' | 'other';
export interface Claim { id: string; draft: string; type: ClaimType; text: string; cites: string[]; quote: string }
export type FlawKind = 'phantom-quote' | 'number-drift' | 'stale-source' | 'vendor-only' | 'overgeneral';

interface Base { id: string; type: ClaimType; text: string; cites: string[]; quote: string }
const BASE: Record<string, Base> = {
  cold: { id: 'cold', type: 'performance', text: 'Median cold build fell from 412 s to 268 s across 14 repositories.', cites: ['S1'], quote: 'Median cold build fell from 412 s to 268 s' },
  warm: { id: 'warm', type: 'performance', text: 'Warm builds fell 61%.', cites: ['S1'], quote: 'Warm builds fell 61%' },
  win: { id: 'win', type: 'performance', text: 'Windows runners showed no improvement.', cites: ['S4'], quote: 'Windows runners showed no improvement' },
  sec: { id: 'sec', type: 'security', text: 'Versions before 2.0.3 should not share caches across trust boundaries.', cites: ['S5'], quote: 'Versions before 2.0.3 should not share caches across trust boundaries' },
  hit: { id: 'hit', type: 'other', text: 'Untuned hit rate was 31%.', cites: ['S6'], quote: 'Untuned hit rate was 31%' },
  plat: { id: 'plat', type: 'other', text: 'Windows support is experimental.', cites: ['S8'], quote: 'Windows support is experimental' },
  price: { id: 'price', type: 'other', text: 'Cache storage costs $0.08 per GB-month.', cites: ['S7'], quote: 'Cache storage costs $0.08 per GB-month' },
};

/** Each injector changes one thing and reports the kind it injected. */
const INJECT: Record<FlawKind, (b: Base) => Base> = {
  'phantom-quote': (b) => ({ ...b, text: 'Tidewater dramatically cut cold builds.', quote: 'cold builds fell dramatically' }),
  'number-drift': (b) => ({ ...b, text: b.text.replace('412 s to 268 s', '412 s to 168 s').replace('61%', '81%') }),
  'stale-source': (b) => ({ ...b, cites: ['S2'], text: 'Median cold build fell from 390 s to 351 s across 9 repositories.', quote: 'Median cold build fell from 390 s to 351 s' }),
  'vendor-only': (b) => ({ ...b, cites: ['S3'], text: 'Customers report up to 70% faster pipelines.', quote: 'Customers report up to 70% faster pipelines' }),
  overgeneral: (b) => ({ ...b, text: 'Tidewater speeds up builds on every platform.', quote: 'Median cold build fell from 412 s to 268 s' }),
};

type Spec = [base: string, inject?: FlawKind];
const DRAFTS: { id: string; title: string; specs: Spec[] }[] = [
  { id: 'A', title: 'Draft A - written fast', specs: [['cold'], ['warm', 'number-drift'], ['win'], ['sec'], ['hit'], ['cold', 'phantom-quote'], ['price']] },
  { id: 'B', title: 'Draft B - confident', specs: [['cold', 'overgeneral'], ['cold', 'stale-source'], ['warm', 'vendor-only'], ['plat'], ['hit'], ['sec'], ['win']] },
  { id: 'C', title: 'Draft C - mostly careful', specs: [['cold', 'number-drift'], ['warm'], ['win'], ['plat'], ['hit'], ['price'], ['sec']] },
];

export const ITEMS: LabItem<Claim>[] = DRAFTS.flatMap((d) => d.specs.map(([baseId, inj], i) => {
  const base = BASE[baseId]!;
  const b = inj ? INJECT[inj](base) : base;
  const id = `${d.id}${i + 1}`;
  return { id, data: { id, draft: d.id, type: b.type, text: b.text, cites: b.cites, quote: b.quote }, flaws: inj ? [{ itemId: id, kind: inj }] : [] };
}));

/* ------------------------------------------------------------------ checks (read the claim and the corpus only) */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const nums = (s: string) => (s.match(/\d+(?:\.\d+)*/g) ?? []).map((n) => n.replace(/\.$/, ''));
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5)) - Number(a.slice(5));
const flag = (c: Claim, kind: FlawKind, message: string): Flag[] => [{ itemId: c.id, kind, message }];
const citedText = (c: Claim) => c.cites.map((id) => norm(SRC.get(id)?.text ?? '')).join(' ');

export const CHECKS: Check<Claim>[] = [
  { id: 'quote-in-source', label: 'Quote must appear in a cited source', what: 'Flags a claim whose quoted wording is not found in any source it cites.', flag: (c) => (citedText(c).includes(norm(c.quote)) ? [] : flag(c, 'phantom-quote', `"${c.quote}" is not in ${c.cites.join(', ')}`)) },
  { id: 'numbers-match', label: 'Every number must appear in a cited source', what: 'Flags a claim containing a number that its cited sources do not contain.', flag: (c) => { const t = citedText(c); const bad = nums(c.text).filter((n) => !nums(t).includes(n)); return bad.length ? flag(c, 'number-drift', `number(s) ${bad.join(', ')} not in ${c.cites.join(', ')}`) : []; } },
  { id: 'newer-source-exists', label: 'A newer source on the same topic must not exist', what: 'Flags a cited source when the corpus holds one at least 12 months newer on the same topic.', flag: (c) => c.cites.flatMap((id) => { const s = SRC.get(id); return s && CORPUS.some((o) => o.topic === s.topic && monthsBetween(s.date, o.date) >= 12) ? flag(c, 'stale-source', `${id} (${s.date}) has been superseded`) : []; }) },
  { id: 'vendor-only-performance', label: 'Performance claims need a non-vendor source', what: 'Flags a performance claim whose only citations are vendor pages.', flag: (c) => (c.type === 'performance' && c.cites.every((id) => SRC.get(id)?.tier === 'vendor') ? flag(c, 'vendor-only', 'only vendor sources') : []) },
  { id: 'scope-words', label: 'Universal words must come from the source', what: 'Flags "every", "all", "always" or "never" when the cited source does not use that word.', flag: (c) => { const t = citedText(c); const bad = (c.text.toLowerCase().match(/\b(every|all|always|never)\b/g) ?? []).filter((w) => !t.includes(w)); return bad.length ? flag(c, 'overgeneral', `"${bad[0]}" is not in ${c.cites.join(', ')}`) : []; } },
  { id: 'max-age-12mo', label: 'Reject any source older than 12 months', what: 'Flags any cited source more than 12 months before the report date, whether or not something newer exists.', flag: (c) => c.cites.flatMap((id) => { const s = SRC.get(id); return s && monthsBetween(s.date, AS_OF) > 12 ? flag(c, 'stale-source', `${id} is older than 12 months`) : []; }) },
  { id: 'no-vendor-sources', label: 'Reject all vendor sources', what: 'Flags any citation of a vendor page, for any kind of claim.', flag: (c) => c.cites.flatMap((id) => (SRC.get(id)?.tier === 'vendor' ? flag(c, 'vendor-only', `${id} is a vendor page`) : [])) },
  { id: 'two-sources', label: 'Every claim needs two sources', what: 'Flags every claim that cites a single source.', flag: (c) => (c.cites.length < 2 ? flag(c, 'phantom-quote', 'single source') : []) },
];
export const MAX_CHECKS = 5;

const KIND_LABEL: Record<string, string> = { 'phantom-quote': 'invented quote', 'number-drift': 'altered number', 'stale-source': 'superseded source', 'vendor-only': 'vendor-only evidence', overgeneral: 'over-general wording' };

export function runResearchLab(selected: string[]) {
  const checks = CHECKS.filter((c) => selected.includes(c.id));
  return { ...runChecks(ITEMS, checks), checks };
}

function claimsOf(draft: string) { return ITEMS.filter((i) => i.data.draft === draft); }
export function flawCountByDraft(): Record<string, number> { return Object.fromEntries(DRAFTS.map((d) => [d.id, claimsOf(d.id).reduce((n, i) => n + i.flaws.length, 0)])); }

export function kindsOnlyNumbersCatch(): string[] {
  const q = runResearchLab(['quote-in-source']); const n = runResearchLab(['numbers-match']);
  const has = (o: typeof q, k: string) => o.caught.some((f) => f.kind === k);
  return [...new Set(ITEMS.flatMap((i) => i.flaws.map((f) => f.kind)))].filter((k) => has(n, k) && !has(q, k));
}

export const researchEngine: Engine = {
  groups: [{ id: 'checks', title: 'Checks to run over all three drafts', hint: `Switch on up to ${MAX_CHECKS}. Each check reads a claim and the corpus; none can see which claims were altered.`, options: CHECKS.map((c) => ({ id: c.id, label: c.label, what: c.what })) }],
  max: MAX_CHECKS,
  run(selected) {
    const o = runResearchLab(selected);
    const total = ITEMS.reduce((n, i) => n + i.flaws.length, 0);
    const rows: Row[] = [
      ...o.caught.map((f) => ({ tone: 'ok' as const, label: `Caught ${f.itemId}`, detail: KIND_LABEL[f.kind] ?? f.kind })),
      ...o.missed.map((f) => ({ tone: 'bad' as const, label: `Missed ${f.itemId}`, detail: `${KIND_LABEL[f.kind] ?? f.kind} reached the reader` })),
      ...o.falseAlarms.map((g) => ({ tone: 'warn' as const, label: `False alarm on ${g.itemId}`, detail: `${g.message}. This claim is sound.` })),
    ];
    const passed = selected.length >= 1 && selected.length <= MAX_CHECKS && o.coverage >= 0.9 && o.falseAlarms.length === 0;
    return { passed, headline: passed ? 'Every injected flaw was caught and no sound claim was rejected.' : 'Not yet: either a flaw got through or a sound claim was rejected.', coverage: o.coverage, falseAlarms: o.falseAlarms.length, stats: [{ label: 'Flaws caught', value: `${o.caught.length} of ${total}` }, { label: 'False alarms', value: String(o.falseAlarms.length) }, { label: 'Coverage', value: pct(o.coverage) }], rows };
  },
  questions(): Question[] {
    const f = flawCountByDraft();
    const worst = Object.keys(f).reduce((a, b) => (f[b]! > f[a]! ? b : a));
    const stale = runResearchLab(['max-age-12mo']);
    return [
      { id: 'worst', prompt: 'Which draft contains the most injected flaws?', options: DRAFTS.map((d) => ({ id: d.id, label: d.title })), correct: [worst], explain: `Counted from the generator: ${DRAFTS.map((d) => `${d.id}=${f[d.id]}`).join(', ')}. The confident draft is not the sound one.` },
      { id: 'numbers', prompt: 'Which kind of flaw does a quote check miss but a number check catch?', options: Object.entries(KIND_LABEL).map(([id, label]) => ({ id, label })), correct: kindsOnlyNumbersCatch(), explain: 'The altered number sits next to a correctly quoted phrase, so a quote check is satisfied. Checking the claim text separately from the quote closes that gap.' },
      { id: 'age', prompt: `"Reject any source older than 12 months" raised ${stale.falseAlarms.length} false alarm(s). What is wrong with it?`, options: [{ id: 'old-ok', label: 'An old source can be the best and newest one on its topic; age matters only if something newer exists.' }, { id: 'slow', label: 'It is too slow to run.' }, { id: 'vendor', label: 'It also rejects vendor pages.' }], correct: ['old-ok'], explain: 'Recency is relative to what else is known. A rule that ignores that discards sound evidence.' },
    ];
  },
};

import type { ExternalCheckId, FieldsItem, FlagLinesItem, Item } from '../curriculum/types';

/**
 * Deterministic grading. Every item type is graded by explicit rules - there is
 * no free-form natural-language grading here. Items that cannot be graded
 * mechanically (`reflect`) are marked self-assessed and never count toward the
 * numeric score.
 */

export interface GradeDetail {
  label: string;
  ok: boolean;
  note: string;
}

export interface ItemGrade {
  itemId: string;
  kind: Item['kind'];
  concept: string;
  critical: boolean;
  correct: boolean;
  /** 0..1 partial credit */
  score: number;
  points: number;
  selfAssessed: boolean;
  answered: boolean;
  feedback: string;
  details: GradeDetail[];
}

export interface ExternalResult {
  ok: boolean;
  /** 0..1 */
  progress: number;
  checks: { label: string; ok: boolean; note: string }[];
}
export type ExternalResults = Partial<Record<ExternalCheckId, ExternalResult>>;

export interface ConceptResult {
  score: number;
  items: number;
  criticalFailed: boolean;
}

export interface AttemptGrade {
  results: ItemGrade[];
  score: number;
  passed: boolean;
  criticalFailed: string[];
  conceptResults: Record<string, ConceptResult>;
  selfAssessedCount: number;
  unanswered: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const STOPWORDS = new Set('a an the and or of to in on for is are be it its this that with as at by from not no do does can you your we they them their i if so but than then into because so when which what how why'.split(' '));
/**
 * A list of accepted terms is not an explanation. Keyword checks are narrow, and without this guard anyone who has read
 * the accepted terms could pass by typing them. An answer counts as a term list when it is long enough to be a sentence
 * but is almost all accepted words, or has almost no connecting words at all.
 */
export function readsAsTermList(raw: string, groups: { anyOf: string[] }[]): boolean {
  const tokens = normalizeText(raw).split(' ').filter(Boolean);
  if (tokens.length < 6) return false;
  const accepted = new Set(groups.flatMap((g) => g.anyOf.flatMap((k) => normalizeText(k).split(' '))));
  const inAccepted = tokens.filter((t) => accepted.has(t)).length / tokens.length;
  const connectors = tokens.filter((t) => STOPWORDS.has(t)).length / tokens.length;
  return inAccepted >= 0.7 || (tokens.length >= 8 && connectors < 0.1);
}
const TERM_LIST_FEEDBACK = 'This reads as a list of terms rather than an explanation, so it was not credited. Write one or two sentences saying what you would do and why.';

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9%.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  let cleaned = raw.trim().replace(/[\s%]/g, '');
  // Commas are accepted ONLY as thousands separators ("1,234.5"). "1,5" is ambiguous (a decimal comma in
  // many locales), so it is rejected rather than silently read as 15.
  if (cleaned.includes(',')) {
    if (!/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) return null;
    cleaned = cleaned.replace(/,/g, '');
  }
  if (cleaned === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function base(item: Item, partial: Partial<ItemGrade>): ItemGrade {
  return {
    itemId: item.id,
    kind: item.kind,
    concept: item.concept,
    critical: item.critical === true,
    correct: false,
    score: 0,
    points: item.points ?? 1,
    selfAssessed: false,
    answered: false,
    feedback: '',
    details: [],
    ...partial,
  };
}

export function gradeItem(item: Item, answer: unknown, external: ExternalResults = {}): ItemGrade {
  switch (item.kind) {
    case 'single': {
      const picked = typeof answer === 'string' ? answer : null;
      if (!picked) return base(item, { feedback: 'No answer selected.', details: item.options.map((o) => ({ label: o.text, ok: o.id === item.correct, note: o.why })) });
      const ok = picked === item.correct;
      return base(item, {
        answered: true,
        correct: ok,
        score: ok ? 1 : 0,
        feedback: ok ? 'Correct.' : 'Not quite.',
        details: item.options.map((o) => ({
          label: `${o.id === picked ? '▶ ' : ''}${o.text}`,
          ok: o.id === item.correct,
          note: o.why,
        })),
      });
    }
    case 'multi': {
      const picked = Array.isArray(answer) ? answer.filter((x): x is string => typeof x === 'string') : [];
      const correct = new Set(item.correct);
      const pickedSet = new Set(picked);
      const hits = picked.filter((p) => correct.has(p)).length;
      const wrong = picked.filter((p) => !correct.has(p)).length;
      const exact = hits === correct.size && wrong === 0;
      const score = clamp01((hits - wrong) / correct.size);
      return base(item, {
        answered: picked.length > 0,
        correct: exact,
        score: round(score),
        feedback: exact ? 'Correct - you found exactly the right set.' : `You selected ${hits} of ${correct.size} correct options and ${wrong} incorrect.`,
        details: item.options.map((o) => ({
          label: `${pickedSet.has(o.id) ? '☑' : '☐'} ${o.text}`,
          ok: correct.has(o.id) === pickedSet.has(o.id),
          note: `${correct.has(o.id) ? 'Should be selected. ' : 'Should NOT be selected. '}${o.why}`,
        })),
      });
    }
    case 'classify': {
      const map = answer && typeof answer === 'object' && !Array.isArray(answer) ? (answer as Record<string, unknown>) : {};
      const catLabel = new Map(item.categories.map((c) => [c.id, c.label]));
      let hits = 0;
      const details = item.entries.map((e) => {
        const given = typeof map[e.id] === 'string' ? (map[e.id] as string) : null;
        const ok = given === e.correct;
        if (ok) hits++;
        return {
          label: `${e.text}  →  ${given ? (catLabel.get(given) ?? given) : 'unassigned'}`,
          ok,
          note: ok ? e.why : `Belongs under "${catLabel.get(e.correct) ?? e.correct}". ${e.why}`,
        };
      });
      const answeredCount = item.entries.filter((e) => typeof map[e.id] === 'string').length;
      const score = hits / item.entries.length;
      return base(item, {
        answered: answeredCount > 0,
        correct: hits === item.entries.length,
        score: round(score),
        feedback: `${hits} of ${item.entries.length} classified correctly.`,
        details,
      });
    }
    case 'order': {
      const given = Array.isArray(answer) ? answer.filter((x): x is string => typeof x === 'string') : [];
      const want = item.steps.map((s) => s.id);
      const valid = given.length === want.length && want.every((id) => given.includes(id));
      if (!valid) return base(item, { feedback: 'Order the steps before submitting.', details: item.steps.map((s, i) => ({ label: `${i + 1}. ${s.text}`, ok: false, note: s.why ?? '' })) });
      const pos = new Map(given.map((id, i) => [id, i]));
      let okPairs = 0;
      let pairs = 0;
      for (let i = 0; i < want.length; i++)
        for (let j = i + 1; j < want.length; j++) {
          pairs++;
          if ((pos.get(want[i]!) ?? 0) < (pos.get(want[j]!) ?? 0)) okPairs++;
        }
      const exact = given.every((id, i) => id === want[i]);
      return base(item, {
        answered: true,
        correct: exact,
        score: round(pairs === 0 ? 1 : okPairs / pairs),
        feedback: exact ? 'Perfect order.' : `${okPairs} of ${pairs} step pairs were in the right relative order.`,
        details: item.steps.map((s, i) => ({
          label: `${i + 1}. ${s.text}`,
          ok: given[i] === s.id,
          note: s.why ?? '',
        })),
      });
    }
    case 'numeric': {
      const expected = typeof item.answer === 'function' ? item.answer() : item.answer;
      const value = parseNumber(answer);
      if (value === null) return base(item, { feedback: 'Enter a number.', details: [{ label: 'Expected', ok: false, note: `${expected}${item.unit ? ' ' + item.unit : ''}` }] });
      const tol = item.tolerance ?? 0;
      const ok = Math.abs(value - expected) <= tol + 1e-9;
      const diag = ok ? null : (item.diagnose?.(value, expected) ?? null);
      return base(item, {
        answered: true,
        correct: ok,
        score: ok ? 1 : 0,
        feedback: ok ? 'Correct.' : 'Not matching the fixture data.',
        details: [
          { label: `You answered ${value}${item.unit ? ' ' + item.unit : ''}`, ok, note: `Fixture value: ${expected}${item.unit ? ' ' + item.unit : ''}${tol ? ` (±${tol})` : ''}.` },
          ...(diag ? [{ label: 'Diagnosis', ok: false, note: diag }] : []),
        ],
      });
    }
    case 'keywords': {
      const text = typeof answer === 'string' ? normalizeText(answer) : '';
      if (!text) return base(item, { feedback: 'Write a short answer.', details: item.groups.map((g) => ({ label: g.label, ok: false, note: `Look for: ${g.anyOf.join(' / ')}` })) });
      if (readsAsTermList(String(answer), item.groups)) return base(item, { answered: true, feedback: TERM_LIST_FEEDBACK, details: item.groups.map((g) => ({ label: g.label, ok: false, note: 'Not credited: the answer reads as a list of terms.' })) });
      const need = item.minGroups ?? item.groups.length;
      let met = 0;
      const details = item.groups.map((g) => {
        const hit = g.anyOf.find((k) => text.includes(normalizeText(k)));
        if (hit) met++;
        return { label: g.label, ok: Boolean(hit), note: hit ? `Matched "${hit}".` : `Not found. Accepted terms include: ${g.anyOf.join(' / ')}.` };
      });
      return base(item, {
        answered: true,
        correct: met >= need,
        score: round(clamp01(met / need)),
        feedback: `Keyword check (deterministic, narrow): ${met} of ${item.groups.length} required ideas found. This cannot judge reasoning quality - compare with the explanation below.`,
        details,
      });
    }
    case 'fields':
      return gradeFields(item, answer);
    case 'flaglines':
      return gradeFlagLines(item, answer);
    case 'reflect': {
      const checked = answer && typeof answer === 'object' && !Array.isArray(answer) ? (answer as Record<string, unknown>) : {};
      const n = item.rubric.filter((_, i) => checked[String(i)] === true).length;
      return base(item, {
        answered: n > 0,
        correct: n === item.rubric.length,
        score: round(n / item.rubric.length),
        selfAssessed: true,
        feedback: 'Self-assessed. This is your own judgement against the rubric - it is recorded but never counted toward mastery scores.',
        details: item.rubric.map((r, i) => ({ label: r, ok: checked[String(i)] === true, note: checked[String(i)] === true ? 'You marked this as done.' : 'Not marked.' })),
      });
    }
    case 'external': {
      const res = external[item.check];
      if (!res) return base(item, { feedback: 'This task is verified from your saved work. Complete it first, then check again.', details: [] });
      return base(item, {
        answered: true,
        correct: res.ok,
        score: round(clamp01(res.progress)),
        feedback: res.ok ? 'Verified from your saved work.' : 'Not complete yet - see the checklist.',
        details: res.checks.map((c) => ({ label: c.label, ok: c.ok, note: c.note })),
      });
    }
  }
}

function gradeFields(item: FieldsItem, answer: unknown): ItemGrade {
  const map = answer && typeof answer === 'object' && !Array.isArray(answer) ? (answer as Record<string, unknown>) : {};
  let total = 0;
  let allOk = true;
  let any = false;
  const details: GradeDetail[] = item.fields.map((f) => {
    const raw = typeof map[f.id] === 'string' ? (map[f.id] as string) : '';
    const text = normalizeText(raw);
    if (text) any = true;
    if (text && readsAsTermList(raw, f.groups)) {
      allOk = false;
      return { label: f.label, ok: false, note: TERM_LIST_FEEDBACK };
    }
    const need = f.minGroups ?? f.groups.length;
    const hits = f.groups.map((g) => ({ g, hit: text ? g.anyOf.find((k) => text.includes(normalizeText(k))) : undefined }));
    const met = hits.filter((h) => h.hit).length;
    const ok = met >= need;
    if (!ok) allOk = false;
    total += text ? clamp01(met / need) : 0;
    const found = hits.filter((h) => h.hit).map((h) => h.g.label);
    const missing = hits.filter((h) => !h.hit).map((h) => `${h.g.label} (accepted terms include: ${h.g.anyOf.slice(0, 4).join(' / ')})`);
    return {
      label: f.label,
      ok,
      note: !text ? `Left blank. ${f.help}` : `${found.length ? `Contains: ${found.join('; ')}. ` : ''}${missing.length ? `Not found: ${missing.join('; ')}.` : 'Every required idea is present.'}`,
    };
  });
  return base(item, {
    answered: any,
    correct: allOk,
    score: round(total / item.fields.length),
    feedback: allOk ? 'Every field contains the ideas it needs (keyword check - it cannot judge the quality of your wording).' : 'Some fields are missing ideas. This check is deterministic and narrow: compare your wording with the model answer in the explanation.',
    details,
  });
}

const SEVERITY_WEIGHT = { critical: 3, major: 2, minor: 1 } as const;

function gradeFlagLines(item: FlagLinesItem, answer: unknown): ItemGrade {
  const flagged = new Set(
    Array.isArray(answer) ? answer.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= item.lines.length) : [],
  );
  const total = item.targets.reduce((a, t) => a + SEVERITY_WEIGHT[t.severity], 0);
  let got = 0;
  const details: GradeDetail[] = item.targets.map((t) => {
    const ok = flagged.has(t.line);
    if (ok) got += SEVERITY_WEIGHT[t.severity];
    return { label: `Line ${t.line} [${t.severity}]: ${item.lines[t.line - 1]?.trim().slice(0, 80) ?? ''}`, ok, note: ok ? t.why : `Missed. ${t.why}` };
  });
  const targetLines = new Set(item.targets.map((t) => t.line));
  const falsePositives = [...flagged].filter((l) => !targetLines.has(l));
  for (const l of falsePositives) details.push({ label: `Line ${l}: ${item.lines[l - 1]?.trim().slice(0, 80) ?? ''}`, ok: false, note: 'False positive - this line is benign in context. Over-flagging makes real findings harder to see.' });
  const recall = total === 0 ? 1 : got / total;
  const score = clamp01(recall * Math.max(0, 1 - 0.12 * falsePositives.length));
  const missedSerious = item.targets.some((t) => t.severity !== 'minor' && !flagged.has(t.line));
  const correct = !missedSerious && falsePositives.length <= 2;
  return base(item, {
    answered: flagged.size > 0,
    correct,
    score: round(score),
    feedback: `Found ${item.targets.filter((t) => flagged.has(t.line)).length} of ${item.targets.length} planted issues with ${falsePositives.length} false positive(s).`,
    details,
  });
}

export function gradeAttempt(
  items: Item[],
  answers: Record<string, unknown>,
  opts: { passMark: number; external?: ExternalResults },
): AttemptGrade {
  const results = items.map((it) => gradeItem(it, answers[it.id], opts.external ?? {}));
  const scored = results.filter((r) => !r.selfAssessed);
  const totalPoints = scored.reduce((a, r) => a + r.points, 0);
  const got = scored.reduce((a, r) => a + r.points * r.score, 0);
  const score = totalPoints === 0 ? 0 : round(got / totalPoints);
  const criticalFailed = results.filter((r) => r.critical && !r.selfAssessed && !r.correct).map((r) => r.itemId);

  const conceptResults: Record<string, ConceptResult> = {};
  const byConcept = new Map<string, ItemGrade[]>();
  for (const r of scored) byConcept.set(r.concept, [...(byConcept.get(r.concept) ?? []), r]);
  for (const [concept, rs] of byConcept) {
    const pts = rs.reduce((a, r) => a + r.points, 0);
    const g = rs.reduce((a, r) => a + r.points * r.score, 0);
    conceptResults[concept] = {
      score: pts === 0 ? 0 : round(g / pts),
      items: rs.length,
      criticalFailed: rs.some((r) => r.critical && !r.correct),
    };
  }
  return {
    results,
    score,
    passed: score >= opts.passMark && criticalFailed.length === 0,
    criticalFailed,
    conceptResults,
    selfAssessedCount: results.filter((r) => r.selfAssessed).length,
    unanswered: results.filter((r) => !r.answered && !r.selfAssessed).length,
  };
}

/** Deterministic shuffle so ordering exercises look the same on every render and in tests. */
export function seededOrder<T extends { id: string }>(items: T[], seed: string): T[] {
  const keyed = items.map((it) => {
    let h = 2166136261;
    const s = seed + ':' + it.id;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return { it, h: h >>> 0 };
  });
  keyed.sort((a, b) => a.h - b.h || a.it.id.localeCompare(b.it.id));
  const out = keyed.map((k) => k.it);
  if (out.length > 1 && out.every((x, i) => x.id === items[i]?.id)) out.push(out.shift()!);
  return out;
}

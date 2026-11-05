import { EvidenceSchema, ExperimentSchema, type Evidence, type Experiment } from './model';
import { EXPERIMENT_FORMAT, EXPERIMENT_FORMAT_VERSION } from './report';

/**
 * Everything imported is DATA written by someone else. Nothing here evaluates, executes or follows instructions found in
 * it, and every value carries a label saying how Forge came to hold it:
 *   parsed         read by Forge from a structured field or a recognised test-runner summary line
 *   user-supplied  free text or numbers the user (or the file's author) typed
 *   inferred       a statement found in text; NOT a measurement
 *   unknown        absent. Never filled in, never zero.
 */
export type ImportLabel = 'parsed' | 'user-supplied' | 'inferred' | 'unknown';
export const IMPORT_LABEL_MEANING: Record<ImportLabel, string> = {
  parsed: 'Parsed: read from a structured field or a recognised test summary line. Forge still cannot verify it was produced by a real run.',
  'user-supplied': 'User-supplied: text or numbers someone typed. Shown as plain text, never followed as instructions.',
  inferred: 'Inferred: a statement found in text, such as "all tests pass". It is a claim, not test output, and is never used as a measurement.',
  unknown: 'Unknown: not present. Forge leaves it unknown and never treats it as zero.',
};

/* ------------------------------------------------------------------------------------------ text evidence */

export interface ParsedCounts { passed: number; failed: number; total: number; runner: string; line: string }
export interface TextAnalysis {
  counts: ParsedCounts | null;
  /** More than one different summary line was found, so Forge refuses to choose. */
  ambiguous: boolean;
  /** Statements such as "all tests pass". Labelled inferred. */
  claims: string[];
  /** A claim and a parsed summary disagree. */
  contradiction: string | null;
}

const MAX_SCAN = 400_000;
const LINE_CAP = 400;
const int = (s: string | undefined): number => (s === undefined ? 0 : Math.min(1_000_000, Number.parseInt(s, 10) || 0));

// Each pattern is anchored to a whole line and uses no nested quantifiers.
const SUMMARIES: { runner: string; re: RegExp; read: (m: RegExpMatchArray) => { passed: number; failed: number; total: number } }[] = [
  {
    runner: 'Vitest',
    re: /^\s*Tests\s+(?:(\d+) failed \| )?(?:(\d+) passed)(?: \| (\d+) skipped)?\s*\((\d+)\)\s*$/,
    read: (m) => ({ passed: int(m[2]), failed: int(m[1]), total: int(m[4]) }),
  },
  {
    runner: 'Jest',
    re: /^\s*Tests:\s+(?:(\d+) failed, )?(?:(\d+) skipped, )?(?:(\d+) passed, )?(\d+) total\s*$/,
    read: (m) => ({ passed: int(m[3]), failed: int(m[1]), total: int(m[4]) }),
  },
  {
    runner: 'pytest',
    re: /^=+ (?:(\d+) failed)?(?:, )?(?:(\d+) passed)?(?:, \d+ \w+)* in [\d.]+s(?: \([^)]*\))? =+\s*$/,
    read: (m) => ({ passed: int(m[2]), failed: int(m[1]), total: int(m[2]) + int(m[1]) }),
  },
];

const CLAIM = /\b(?:all|every)\s+(?:the\s+)?tests?\s+(?:now\s+)?(?:pass|passed|passing)\b|\btests?\s+(?:are\s+)?(?:now\s+)?(?:pass|passed|passing|green)\b|\b\d+\s*\/\s*\d+\s+tests?\s+(?:pass|passed|passing)\b|\bno\s+(?:test\s+)?(?:failures|errors)\b|\bbuild\s+(?:succeeded|passes|passed)\b/i;

export function analyseEvidenceText(text: string): TextAnalysis {
  const lines = text.slice(0, MAX_SCAN).split(/\r?\n/);
  const found: ParsedCounts[] = [];
  const claims: string[] = [];
  let tapPass: number | null = null, tapFail: number | null = null, tapTests: number | null = null;
  const summaryLines = new Set<number>();
  lines.forEach((raw, i) => {
    const line = raw.slice(0, LINE_CAP);
    for (const s of SUMMARIES) {
      const m = line.match(s.re);
      if (m) {
        const c = s.read(m);
        if (c.total >= c.passed + c.failed && c.total > 0) { found.push({ ...c, runner: s.runner, line: line.trim() }); summaryLines.add(i); }
        return;
      }
    }
    const tap = line.match(/^#\s+(pass|fail|tests)\s+(\d+)\s*$/);
    if (tap) {
      const n = int(tap[2]);
      if (tap[1] === 'pass') tapPass = n; else if (tap[1] === 'fail') tapFail = n; else tapTests = n;
      summaryLines.add(i);
    }
  });
  if (tapPass !== null && tapFail !== null) {
    const total = tapTests ?? tapPass + tapFail;
    if (total >= tapPass + tapFail && total > 0) found.push({ passed: tapPass, failed: tapFail, total, runner: 'node:test (TAP)', line: `# tests ${total} / # pass ${tapPass} / # fail ${tapFail}` });
  }
  lines.forEach((raw, i) => {
    if (summaryLines.has(i) || claims.length >= 8) return;
    const line = raw.slice(0, LINE_CAP);
    if (CLAIM.test(line)) claims.push(line.trim().slice(0, 200));
  });
  const distinct = new Map(found.map((f) => [`${f.passed}/${f.failed}/${f.total}`, f]));
  const counts = distinct.size === 1 ? [...distinct.values()][0]! : null;
  let contradiction: string | null = null;
  if (counts && counts.failed > 0 && claims.some((c) => /\b(?:all|every)\b.*\bpass|no\s+(?:test\s+)?failures|green/i.test(c))) contradiction = `The text says tests pass, but the parsed summary (${counts.line}) reports ${counts.failed} failing.`;
  return { counts, ambiguous: distinct.size > 1, claims, contradiction };
}

/* ------------------------------------------------------------------------------------------ experiment records */

export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

export interface ImportField { field: string; value: string; label: ImportLabel }
export interface ExperimentImportPreview {
  title: string;
  fields: ImportField[];
  warnings: string[];
  runs: number;
  evidence: number;
}
export type ExperimentImportResult = { ok: true; preview: ExperimentImportPreview; experiment: Experiment; evidence: Evidence[] } | { ok: false; error: string };

const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * Read an exported Claude Forge experiment record as data and build a NEW experiment from it (new ids, nothing overwritten).
 * Every metric and test count becomes user-imported; loop membership and run locks are dropped; any derived comparison in
 * the file is ignored and recomputed.
 */
export function previewExperimentImport(text: string, newId: (prefix: string) => string, now: string): ExperimentImportResult {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) return { ok: false, error: `That file is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB.` };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Unexpected file contents.' };
  const r = raw as Record<string, unknown>;
  if (r.format !== EXPERIMENT_FORMAT) return { ok: false, error: 'That is not a Claude Forge experiment export.' };
  if (typeof r.version !== 'number' || r.version > EXPERIMENT_FORMAT_VERSION) return { ok: false, error: 'That record comes from a newer version of Claude Forge.' };
  const parsed = ExperimentSchema.safeParse(r.experiment);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: `The experiment failed validation: ${i?.path.join('.') || 'content'} - ${i?.message ?? 'invalid'}.` };
  }
  const warnings: string[] = [];
  const src = parsed.data;
  const condMap = new Map(src.conditions.map((c) => [c.id, newId('cond')]));
  const runMap = new Map(src.runs.map((x) => [x.id, newId('run')]));
  const importedMetrics = (m: Experiment['runs'][number]['metrics']) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, provenance: 'user-imported' as const }]));
  const runs = src.runs.filter((x) => condMap.has(x.conditionId)).map((x) => ({
    ...x,
    id: runMap.get(x.id)!,
    conditionId: condMap.get(x.conditionId)!,
    testsProvenance: 'user-imported' as const,
    metrics: importedMetrics(x.metrics),
  }));
  if (runs.length < src.runs.length) warnings.push(`${src.runs.length - runs.length} run(s) referred to a condition that is not in the file and were left out.`);

  let evidence: Evidence[] = [];
  const rawEvidence = Array.isArray(r.evidence) ? r.evidence : [];
  if (rawEvidence.length > 200) warnings.push('Only the first 200 evidence items were read.');
  let skipped = 0;
  for (const e of rawEvidence.slice(0, 200)) {
    const p = EvidenceSchema.safeParse(e);
    if (!p.success) { skipped++; continue; }
    const rid = p.data.runId ? runMap.get(p.data.runId) ?? null : null;
    evidence.push({ ...p.data, id: newId('ev'), runId: rid, provenance: 'user-imported', addedAt: now });
  }
  if (skipped) warnings.push(`${skipped} evidence item(s) did not validate and were left out.`);
  if (evidence.reduce((a, e) => a + e.size, 0) > 3 * 1024 * 1024) { evidence = evidence.slice(0, 20); warnings.push('The evidence was larger than 3 MB, so only the first 20 items were kept.'); }
  if ('derivedComparison' in r) warnings.push('The comparison in the file was ignored. Forge recomputes it from the imported runs.');
  if (src.loopId) warnings.push('This experiment came from a Skill Improvement Loop. It is imported as an ordinary experiment; loop links and locks are not carried over.');
  if (src.conclusion.trim()) warnings.push('The conclusion and observations are the file author’s words. Read them as claims, not as results.');
  warnings.push('Forge cannot verify any imported value. Test counts and measurements are labelled user-imported.');

  const experiment = ExperimentSchema.parse({
    ...src,
    id: newId('exp'),
    title: `${src.title} (imported)`.slice(0, 200),
    conditions: src.conditions.map((c) => ({ ...c, id: condMap.get(c.id)! })),
    runs,
    loopId: null,
    phase: null,
    runsLockedAt: null,
    skillLinks: [],
    status: runs.length ? 'recording' : 'draft',
    createdAt: now,
    updatedAt: now,
  });

  const withData = runs.filter((x) => x.testsTotal !== null || Object.values(x.metrics).some((m) => m.value !== null)).length;
  const fields: ImportField[] = [
    { field: 'Title', value: clip(src.title), label: 'user-supplied' },
    { field: 'Hypothesis', value: src.hypothesis.trim() ? clip(src.hypothesis) : 'not stated', label: src.hypothesis.trim() ? 'user-supplied' : 'unknown' },
    { field: 'Conditions', value: src.conditions.map((c) => c.label).join(', '), label: 'parsed' },
    { field: 'Fixture', value: `${clip(src.fixture.label, 80)}${src.fixture.hash ? ' (hash recorded)' : ' (no hash)'}`, label: src.fixture.hash ? 'parsed' : 'unknown' },
    { field: 'Runs', value: `${runs.length} (${withData} with at least one known measurement)`, label: 'parsed' },
    { field: 'Test counts and measurements', value: `${withData} run(s) carry values`, label: runs.length === 0 ? 'unknown' : 'parsed' },
    { field: 'Evidence attachments', value: `${evidence.length}`, label: evidence.length ? 'user-supplied' : 'unknown' },
    { field: 'Environment (model, Claude Code version)', value: [src.environment.model, src.environment.claudeCodeVersion].filter(Boolean).join(', ') || 'not recorded', label: src.environment.model || src.environment.claudeCodeVersion ? 'user-supplied' : 'unknown' },
  ];
  return { ok: true, preview: { title: experiment.title, fields, warnings, runs: runs.length, evidence: evidence.length }, experiment, evidence };
}

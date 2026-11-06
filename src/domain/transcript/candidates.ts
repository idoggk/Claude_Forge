import type { Evidence } from '@/domain/experiments/model';
import { redactSecrets, scanSecrets, type SecretFinding } from './secrets';
import { FORMAT_LABEL, type ParsedTranscript } from './parse';

/**
 * Turn a parsed transcript into a list of things the learner may attach, each labelled with how Forge knows it. Nothing is
 * attached until the learner selects it and confirms. Imported text is data: it never changes application behaviour.
 */
export type Classification = NonNullable<Evidence['classification']>;

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  'parsed-tool-result': 'Parsed tool result',
  'parsed-tool-call': 'Parsed tool call',
  'parsed-model-output': 'Parsed model output',
  'parsed-prompt': 'Parsed prompt',
  'parsed-metadata': 'Parsed metadata',
  'user-observation': 'Your observation',
  inferred: 'Inferred (not a measurement)',
  unknown: 'Source unknown',
};

export const CLASSIFICATION_MEANING: Record<Classification, string> = {
  'parsed-tool-result': 'Read from a tool_result block in the file. It is what the tool reported, but Forge cannot verify the file itself is genuine.',
  'parsed-tool-call': 'Read from a tool_use block: it shows that a call was made, not what it did.',
  'parsed-model-output': 'Text the model wrote, as recorded in the file. Whatever it claims (for example that tests passed) is a claim, not evidence.',
  'parsed-prompt': 'The first prompt in the file. It tells you what was asked, not how the result turned out.',
  'parsed-metadata': 'A field from the file\'s result record or timestamps. Forge reports it as found and does not check it.',
  'user-observation': 'Something you typed or attested to yourself.',
  inferred: 'A statement found in text, or a value derived from it. It is never used as a measurement.',
  unknown: 'Forge cannot tell who produced this text.',
};

export type CandidateKind = 'prompt' | 'final-output' | 'tool-result' | 'test-summary' | 'skill-call' | 'run-metadata' | 'duration' | 'plain-text' | 'model-claims';

export interface ImportCandidate {
  id: string;
  kind: CandidateKind;
  title: string;
  text: string;
  classification: Classification;
  note: string;
  defaultSelected: boolean;
  secrets: SecretFinding[];
  meta: Record<string, string>;
  /** Something the learner may choose to copy into the run form. Never applied automatically. */
  applies?: { kind: 'tests'; passed: number; total: number } | { kind: 'runtimeSec'; seconds: number } | null;
  /** The learner must say they ran this command themselves before counts can be applied (plain text only). */
  needsAttestation?: boolean;
}

const cap = (s: string, n = 20_000) => (s.length > n ? s.slice(0, n) : s);
const fmtSec = (ms: number) => (ms >= 3600_000 ? `${(ms / 3600_000).toFixed(1)} h` : ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`);

export function buildCandidates(p: ParsedTranscript, opts: { skillName?: string } = {}): ImportCandidate[] {
  const out: ImportCandidate[] = [];
  let n = 0;
  const add = (c: Omit<ImportCandidate, 'id' | 'secrets'> & { secrets?: SecretFinding[] }) => out.push({ ...c, id: `c${++n}`, secrets: c.secrets ?? scanSecrets(c.text) });
  const metaBase = { format: p.format };

  if (p.format === 'plain-text') {
    add({ kind: 'plain-text', title: 'The pasted text', text: cap(p.plainText ?? ''), classification: 'unknown', note: CLASSIFICATION_MEANING.unknown, defaultSelected: true, meta: metaBase });
    for (const t of p.toolTestSummaries) {
      add({ kind: 'test-summary', title: `A test summary line was recognised: ${t.counts.runner}`, text: t.counts.line, classification: 'unknown', note: 'The text has no structure, so Forge cannot tell whether a tool or a model produced this line. You can apply the counts only if you confirm you ran the command yourself.', defaultSelected: false, meta: { ...metaBase, runner: t.counts.runner }, applies: { kind: 'tests', passed: t.counts.passed, total: t.counts.total }, needsAttestation: true });
    }
    if (p.modelClaims.length) add({ kind: 'model-claims', title: 'Statements found in the text', text: p.modelClaims.join('\n'), classification: 'inferred', note: CLASSIFICATION_MEANING.inferred, defaultSelected: false, meta: metaBase });
    return out;
  }

  if (p.firstPrompt) add({ kind: 'prompt', title: 'The first prompt', text: cap(p.firstPrompt), classification: 'parsed-prompt', note: CLASSIFICATION_MEANING['parsed-prompt'], defaultSelected: true, meta: metaBase });
  if (p.finalOutput) add({ kind: 'final-output', title: p.result?.result ? 'The final result (from the result record)' : 'The last thing the model wrote', text: cap(p.finalOutput), classification: 'parsed-model-output', note: CLASSIFICATION_MEANING['parsed-model-output'], defaultSelected: true, meta: metaBase });

  for (const t of p.turns) for (const r of t.toolResults) {
    const summary = r.counts;
    if (!r.text.trim()) continue;
    add({
      kind: summary ? 'test-summary' : 'tool-result',
      title: `${r.toolName ?? 'Tool'} result${r.isError ? ' (reported an error)' : ''}${summary ? `: ${summary.runner} summary` : ''}`,
      text: r.text, classification: 'parsed-tool-result', note: CLASSIFICATION_MEANING['parsed-tool-result'] + (r.truncated ? ' Shortened to 20,000 characters.' : ''),
      defaultSelected: Boolean(summary), meta: { ...metaBase, tool: r.toolName ?? 'unknown', turn: String(t.index) },
      applies: summary ? { kind: 'tests', passed: summary.passed, total: summary.total } : null,
    });
  }

  for (const s of p.skillCalls) add({ kind: 'skill-call', title: `Skill tool call: ${s.name}`, text: `The file contains a call to the Skill tool for "${s.name}".`, classification: 'parsed-tool-call', note: CLASSIFICATION_MEANING['parsed-tool-call'] + ' It shows the Skill was called, not that it helped.', defaultSelected: true, meta: { ...metaBase, skill: s.name } });

  if (p.result) {
    const bits = [p.result.sessionId && `session ${p.result.sessionId}`, p.result.numTurns !== null && `${p.result.numTurns} turn(s)`, p.result.totalCostUsd !== null && `cost estimate ${p.result.totalCostUsd} USD (a client-side estimate)`, p.result.isError !== null && `is_error: ${p.result.isError}`, p.result.subtype && `subtype: ${p.result.subtype}`].filter(Boolean) as string[];
    if (bits.length) add({ kind: 'run-metadata', title: 'The result record', text: bits.join('\n'), classification: 'parsed-metadata', note: CLASSIFICATION_MEANING['parsed-metadata'], defaultSelected: false, meta: metaBase });
    if (p.result.durationMs !== null) add({ kind: 'duration', title: `Reported duration: ${fmtSec(p.result.durationMs)}`, text: `duration_ms = ${p.result.durationMs}`, classification: 'parsed-metadata', note: 'The result record states this duration. Forge does not check it.', defaultSelected: false, meta: { ...metaBase, field: 'duration_ms' }, applies: { kind: 'runtimeSec', seconds: Math.round(p.result.durationMs / 100) / 10 } });
  }
  if (!p.result?.durationMs && p.span && p.span.ms > 0) add({ kind: 'duration', title: `Time between the first and last timestamp: ${fmtSec(p.span.ms)}`, text: `${p.span.first} to ${p.span.last}`, classification: 'parsed-metadata', note: 'Computed from two timestamps in the file. It includes any time spent waiting for a person, so it is not Claude\'s working time. Apply it only if that is what you want to record.', defaultSelected: false, meta: { ...metaBase, field: 'timestamps' }, applies: { kind: 'runtimeSec', seconds: Math.round(p.span.ms / 100) / 10 } });

  if (p.modelClaims.length) add({ kind: 'model-claims', title: 'Statements the model made', text: p.modelClaims.join('\n'), classification: 'inferred', note: 'These are things the model said, such as "all tests pass". They are claims, never measurements. Compare them with the tool results above.', defaultSelected: false, meta: metaBase });
  if (opts.skillName?.trim() && p.skillCalls.length === 0) {
    const name = opts.skillName.trim().toLowerCase();
    const mentioned = p.turns.some((t) => t.texts.some((x) => x.toLowerCase().includes(name)));
    if (mentioned) add({ kind: 'model-claims', title: `"${opts.skillName.trim()}" appears in the text`, text: `The name appears in the file's text, but no Skill tool call was found. A name in text does not prove the Skill was used.`, classification: 'inferred', note: 'A mention is not an invocation.', defaultSelected: false, meta: metaBase });
  }
  return out;
}

/** A short plain-language summary shown at the top of the preview. */
export function previewSummary(p: ParsedTranscript): string[] {
  const L: string[] = [`Format: ${FORMAT_LABEL[p.format]}.`];
  if (p.format === 'plain-text') { L.push('No structure was assumed.'); return L; }
  L.push(`${p.parsedEvents} record(s) read, ${p.turns.length} message(s)${p.skippedLines ? `, ${p.skippedLines} line(s) skipped` : ''}.`);
  if (p.tools.length) L.push(`Tools called: ${p.tools.slice(0, 6).map((t) => `${t.name} ×${t.count}`).join(', ')}.`);
  const thinking = p.turns.reduce((a, t) => a + t.thinkingBlocks, 0);
  if (thinking) L.push(`${thinking} reasoning block(s) were found and are never imported.`);
  const unknown = Object.entries(p.unknownTypes);
  if (unknown.length) L.push(`Not recognised, so ignored: ${unknown.slice(0, 6).map(([k, v]) => `${k} ×${v}`).join(', ')}.`);
  return L;
}

export interface ImportSelection { ids: string[]; redact: boolean; attested: boolean }

export interface ImportOutcome {
  evidence: Omit<Evidence, 'experimentId' | 'runId'>[];
  tests: { passed: number; total: number } | null;
  runtimeSec: number | null;
  redactedCount: number;
  warnings: string[];
}

/**
 * Build what will be attached for the chosen candidates. Counts and runtime are returned separately and are applied only when
 * the learner chose the matching item. `makeId` and `now` are passed in so this stays pure.
 */
export function buildOutcome(candidates: ImportCandidate[], sel: ImportSelection, makeId: () => string, now: string, applyIds: { tests?: string; runtime?: string } = {}): ImportOutcome {
  const chosen = candidates.filter((c) => sel.ids.includes(c.id));
  const warnings: string[] = [];
  let redactedCount = 0;
  const evidence: ImportOutcome['evidence'] = chosen.map((c) => {
    let text = c.text;
    if (sel.redact) { const r = redactSecrets(text); text = r.text; redactedCount += r.count; }
    else if (c.secrets.length) warnings.push(`"${c.title}" was attached with ${c.secrets.length} possible secret(s) left in.`);
    const kind: Evidence['kind'] = c.kind === 'prompt' ? 'prompt' : c.kind === 'final-output' ? 'model-output' : c.kind === 'tool-result' || c.kind === 'test-summary' ? 'tool-result' : c.kind === 'skill-call' ? 'tool-call' : c.kind === 'run-metadata' || c.kind === 'duration' ? 'metadata' : c.kind === 'plain-text' ? 'pasted-output' : 'note';
    const classification: Classification = c.needsAttestation && sel.attested ? 'user-observation' : c.classification;
    return { id: makeId(), kind, name: c.title.slice(0, 200), mime: 'text/plain', size: new TextEncoder().encode(text).length, text: text.slice(0, 500_000), provenance: 'user-imported' as const, classification, meta: Object.fromEntries(Object.entries({ ...c.meta, imported: 'transcript' }).map(([k, v]) => [k.slice(0, 40), v.slice(0, 300)])), addedAt: now };
  });
  const tc = applyIds.tests ? candidates.find((c) => c.id === applyIds.tests) : undefined;
  const rc = applyIds.runtime ? candidates.find((c) => c.id === applyIds.runtime) : undefined;
  const tests = tc?.applies?.kind === 'tests' && (!tc.needsAttestation || sel.attested) ? { passed: tc.applies.passed, total: tc.applies.total } : null;
  if (tc?.needsAttestation && !sel.attested) warnings.push('Test counts from plain text were not applied: confirm you ran the command yourself first.');
  const runtimeSec = rc?.applies?.kind === 'runtimeSec' ? rc.applies.seconds : null;
  return { evidence, tests, runtimeSec, redactedCount, warnings };
}

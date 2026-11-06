import { analyseEvidenceText, type ParsedCounts } from '@/domain/experiments/importer';

/**
 * A tolerant, read-only parser for what Claude Code can produce. What is and is not documented (Anthropic docs, read
 * 2026-11-05 and 2026-11-06):
 *  - `claude -p --output-format json` returns structured JSON with the result, session id and metadata (documented).
 *  - `claude -p --output-format stream-json` returns newline-delimited JSON events; the last is a `result` message (documented).
 *  - Session transcripts are stored as JSONL under ~/.claude/projects, but the page says the entry format is INTERNAL and
 *    changes between versions (documented). It is parsed here on a best-effort basis and labelled as such.
 *  - `/export` writes a rendered plain-text transcript with no documented structure, so it is handled as plain text.
 * Nothing is evaluated or executed. Only the fields named below are read, as primitives, and everything is length-capped.
 */
export const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;
export const MAX_LINE_BYTES = 2 * 1024 * 1024;
export const MAX_EVENTS = 20_000;
const TEXT_CAP = 20_000;
const SMALL_CAP = 400;

export type TranscriptFormat = 'claude-print-json' | 'claude-stream-json' | 'claude-code-jsonl' | 'plain-text';

export const FORMAT_LABEL: Record<TranscriptFormat, string> = {
  'claude-print-json': 'claude -p --output-format json (documented)',
  'claude-stream-json': 'claude -p --output-format stream-json (documented)',
  'claude-code-jsonl': 'Claude Code session transcript, JSONL (internal format, best effort)',
  'plain-text': 'Plain text (for example /export): no structure is assumed',
};

export interface ToolUse { id: string; name: string; summary: string }
export interface ToolResult { toolUseId: string; toolName: string | null; isError: boolean | null; text: string; truncated: boolean; counts: ParsedCounts | null }
export interface Turn { index: number; role: 'user' | 'assistant'; timestamp: string | null; sidechain: boolean; texts: string[]; toolUses: ToolUse[]; toolResults: ToolResult[]; thinkingBlocks: number; imageBlocks: number }
export interface ResultMeta { result: string | null; sessionId: string | null; totalCostUsd: number | null; durationMs: number | null; numTurns: number | null; isError: boolean | null; subtype: string | null }

export interface ParsedTranscript {
  format: TranscriptFormat;
  turns: Turn[];
  lines: number;
  parsedEvents: number;
  skippedLines: number;
  unknownTypes: Record<string, number>;
  firstPrompt: string | null;
  finalOutput: string | null;
  result: ResultMeta | null;
  tools: { name: string; count: number }[];
  skillCalls: { name: string; toolUseId: string }[];
  /** Run-summary lines found in TOOL results: parsed. */
  toolTestSummaries: { toolName: string | null; counts: ParsedCounts }[];
  /** Statements found in what the MODEL wrote ("all tests pass", or a summary line it quoted): never measurements. */
  modelClaims: string[];
  span: { first: string; last: string; ms: number } | null;
  plainText: string | null;
  warnings: string[];
}

const str = (v: unknown, cap = TEXT_CAP): string | null => (typeof v === 'string' ? v.slice(0, cap) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const validTime = (v: unknown): string | null => { const s = str(v, 40); if (!s) return null; const t = Date.parse(s); return Number.isFinite(t) ? s : null; };

function summarizeInput(name: string, input: unknown): string {
  if (!isObj(input)) return '';
  const first = (k: string) => str(input[k], SMALL_CAP);
  if (name === 'Bash') return first('command') ?? '';
  if (name === 'Skill') return first('skill') ?? first('name') ?? first('command') ?? '';
  const pick = first('file_path') ?? first('path') ?? first('pattern') ?? first('url') ?? first('query') ?? first('description');
  return pick ?? Object.keys(input).slice(0, 6).join(', ');
}

function blockText(content: unknown): { text: string; truncated: boolean } {
  let t = '';
  if (typeof content === 'string') t = content;
  else if (Array.isArray(content)) t = content.map((b) => (isObj(b) && b.type === 'text' ? (str(b.text, TEXT_CAP * 2) ?? '') : '')).filter(Boolean).join('\n');
  return { text: t.slice(0, TEXT_CAP), truncated: t.length > TEXT_CAP };
}

function detectFormat(text: string): { format: TranscriptFormat; events: unknown[] | null; skipped: number; lines: number } {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const whole: unknown = JSON.parse(trimmed);
      if (Array.isArray(whole)) return { format: 'claude-stream-json', events: whole.slice(0, MAX_EVENTS), skipped: 0, lines: whole.length };
      if (isObj(whole) && (typeof whole.type === 'string' || typeof whole.result === 'string' || 'session_id' in whole)) {
        const isResult = whole.type === 'result' || typeof whole.result === 'string';
        if (isResult) return { format: 'claude-print-json', events: [whole], skipped: 0, lines: 1 };
      }
    } catch { /* not one JSON value: try line by line */ }
  }
  const lines = text.split(/\r?\n/);
  const events: unknown[] = [];
  let skipped = 0;
  let nonEmpty = 0;
  for (const l of lines) {
    if (!l.trim()) continue;
    nonEmpty++;
    if (events.length >= MAX_EVENTS) { skipped++; continue; }
    if (l.length > MAX_LINE_BYTES) { skipped++; continue; }
    if (!l.trimStart().startsWith('{')) { skipped++; continue; }
    try { const o: unknown = JSON.parse(l); if (isObj(o)) events.push(o); else skipped++; } catch { skipped++; }
  }
  const typed = events.filter((e) => isObj(e) && typeof e.type === 'string');
  if (nonEmpty > 0 && typed.length >= Math.max(1, Math.floor(nonEmpty * 0.6))) {
    const onDisk = typed.some((e) => isObj(e) && ('sessionId' in e || 'parentUuid' in e));
    return { format: onDisk ? 'claude-code-jsonl' : 'claude-stream-json', events: typed, skipped, lines: lines.length };
  }
  return { format: 'plain-text', events: null, skipped: 0, lines: lines.length };
}

export function parseTranscript(rawText: string): { ok: true; parsed: ParsedTranscript } | { ok: false; error: string } {
  if (new TextEncoder().encode(rawText).length > MAX_TRANSCRIPT_BYTES) return { ok: false, error: `That input is larger than ${MAX_TRANSCRIPT_BYTES / 1024 / 1024} MB.` };
  if (!rawText.trim()) return { ok: false, error: 'There is nothing to import.' };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000E-\u001F]/.test(rawText.slice(0, 4000))) return { ok: false, error: 'That looks like a binary file. Only text can be imported.' };

  const det = detectFormat(rawText);
  const base: ParsedTranscript = { format: det.format, turns: [], lines: det.lines, parsedEvents: 0, skippedLines: det.skipped, unknownTypes: {}, firstPrompt: null, finalOutput: null, result: null, tools: [], skillCalls: [], toolTestSummaries: [], modelClaims: [], span: null, plainText: null, warnings: [] };
  if (det.format === 'claude-code-jsonl') base.warnings.push('Anthropic documents this on-disk format as internal and subject to change between versions, so parts of it may be missed. What was not recognised is counted, not guessed.');
  if (det.skipped > 0) base.warnings.push(`${det.skipped} line(s) were skipped (not JSON, not an object, or over ${MAX_LINE_BYTES / 1024 / 1024} MB).`);

  if (det.format === 'plain-text' || !det.events) {
    const a = analyseEvidenceText(rawText);
    base.plainText = rawText.slice(0, 200_000);
    if (rawText.length > 200_000) base.warnings.push('Only the first 200,000 characters of the text are kept.');
    base.modelClaims = a.claims;
    if (a.counts) base.toolTestSummaries = [{ toolName: null, counts: a.counts }];
    base.warnings.push('Plain text has no structure, so Forge cannot tell who wrote each line. A recognised test summary is shown as "source unknown".');
    return { ok: true, parsed: base };
  }

  const toolNames = new Map<string, string>();
  const toolCount = new Map<string, number>();
  const stamps: string[] = [];
  let turnIndex = 0;
  for (const ev of det.events) {
    if (!isObj(ev)) continue;
    const type = str(ev.type, 60) ?? 'unknown';
    base.parsedEvents++;
    if (type === 'result') {
      base.result = { result: str(ev.result), sessionId: str(ev.session_id, 100), totalCostUsd: num(ev.total_cost_usd), durationMs: num(ev.duration_ms), numTurns: num(ev.num_turns), isError: bool(ev.is_error), subtype: str(ev.subtype, 60) };
      continue;
    }
    if (type !== 'user' && type !== 'assistant') { base.unknownTypes[type] = (base.unknownTypes[type] ?? 0) + 1; continue; }
    const msg = isObj(ev.message) ? ev.message : null;
    if (!msg) { base.unknownTypes[`${type} without message`] = (base.unknownTypes[`${type} without message`] ?? 0) + 1; continue; }
    const role: 'user' | 'assistant' = msg.role === 'assistant' || type === 'assistant' ? 'assistant' : 'user';
    const ts = validTime(ev.timestamp);
    if (ts) stamps.push(ts);
    const turn: Turn = { index: turnIndex++, role, timestamp: ts, sidechain: ev.isSidechain === true || (ev.parent_tool_use_id != null && ev.parent_tool_use_id !== ''), texts: [], toolUses: [], toolResults: [], thinkingBlocks: 0, imageBlocks: 0 };
    const content = msg.content;
    if (typeof content === 'string') turn.texts.push(content.slice(0, TEXT_CAP));
    else if (Array.isArray(content)) {
      for (const b of content) {
        if (!isObj(b)) continue;
        const bt = str(b.type, 40);
        if (bt === 'text') { const t = str(b.text); if (t) turn.texts.push(t); }
        else if (bt === 'thinking' || bt === 'redacted_thinking') turn.thinkingBlocks++; // counted, never imported
        else if (bt === 'image') turn.imageBlocks++;
        else if (bt === 'tool_use') {
          const id = str(b.id, 100) ?? '';
          const name = str(b.name, 100) ?? 'unknown';
          toolNames.set(id, name);
          toolCount.set(name, (toolCount.get(name) ?? 0) + 1);
          turn.toolUses.push({ id, name, summary: summarizeInput(name, b.input) });
          if (name === 'Skill') { const sk = summarizeInput(name, b.input); if (sk) base.skillCalls.push({ name: sk, toolUseId: id }); }
        } else if (bt === 'tool_result') {
          const id = str(b.tool_use_id, 100) ?? '';
          const { text, truncated } = blockText(b.content);
          const a = analyseEvidenceText(text);
          turn.toolResults.push({ toolUseId: id, toolName: toolNames.get(id) ?? null, isError: bool(b.is_error), text, truncated, counts: a.counts });
          if (a.counts) base.toolTestSummaries.push({ toolName: toolNames.get(id) ?? null, counts: a.counts });
        } else if (bt) base.unknownTypes[`block:${bt}`] = (base.unknownTypes[`block:${bt}`] ?? 0) + 1;
      }
    }
    base.turns.push(turn);
  }

  base.tools = [...toolCount].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const main = base.turns.filter((t) => !t.sidechain);
  base.firstPrompt = main.find((t) => t.role === 'user' && t.texts.length > 0 && t.toolResults.length === 0)?.texts[0] ?? null;
  const lastAssistant = [...main].reverse().find((t) => t.role === 'assistant' && t.texts.length > 0);
  base.finalOutput = base.result?.result ?? lastAssistant?.texts.at(-1) ?? null;
  for (const t of main) if (t.role === 'assistant') for (const x of t.texts) base.modelClaims.push(...analyseEvidenceText(x).claims, ...(analyseEvidenceText(x).counts ? [`(model quoted a test summary) ${analyseEvidenceText(x).counts!.line}`] : []));
  base.modelClaims = [...new Set(base.modelClaims)].slice(0, 12);
  if (stamps.length >= 2) {
    const sorted = [...stamps].sort();
    const first = sorted[0]!, last = sorted.at(-1)!;
    base.span = { first, last, ms: Date.parse(last) - Date.parse(first) };
  }
  if (base.turns.length === 0 && !base.result) base.warnings.push('No messages or result were recognised in this input.');
  return { ok: true, parsed: base };
}

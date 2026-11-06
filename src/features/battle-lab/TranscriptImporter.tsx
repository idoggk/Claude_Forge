import { useMemo, useState } from 'react';
import { Badge, Button, Callout, Card, TextArea } from '@/components/ui';
import { MAX_TRANSCRIPT_BYTES, parseTranscript, type ParsedTranscript } from '@/domain/transcript/parse';
import { CLASSIFICATION_LABEL, CLASSIFICATION_MEANING, buildCandidates, buildOutcome, previewSummary, type Classification, type ImportCandidate, type ImportOutcome } from '@/domain/transcript/candidates';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

const TONE: Record<Classification, 'teal' | 'neutral' | 'warn' | 'bad' | 'accent'> = {
  'parsed-tool-result': 'teal', 'parsed-tool-call': 'teal', 'parsed-model-output': 'accent', 'parsed-prompt': 'neutral', 'parsed-metadata': 'neutral', 'user-observation': 'neutral', inferred: 'warn', unknown: 'bad',
};
const SHOW_CAP = 3000;

/**
 * Import a Claude Code transcript or result as DATA: read it, preview it, warn about secrets, let the learner choose what to
 * attach, and only then hand the chosen items to the parent. Nothing is saved here and nothing is applied automatically.
 */
export function TranscriptImporter({ skillName, onConfirm, onCancel }: { skillName?: string; onConfirm: (o: ImportOutcome) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<ParsedTranscript | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [applyTests, setApplyTests] = useState<string | undefined>();
  const [applyRuntime, setApplyRuntime] = useState<string | undefined>();
  const [redact, setRedact] = useState(true);
  const [attested, setAttested] = useState(false);
  const [keepSecrets, setKeepSecrets] = useState(false);

  const candidates: ImportCandidate[] = useMemo(() => (parsed ? buildCandidates(parsed, { skillName }) : []), [parsed, skillName]);
  const secretCount = candidates.filter((c) => selected.includes(c.id)).reduce((a, c) => a + c.secrets.length, 0);
  const needsAttest = candidates.some((c) => c.needsAttestation && c.id === applyTests);

  const preview = (raw: string) => {
    const r = parseTranscript(raw);
    if (!r.ok) { setError(r.error); setParsed(null); return; }
    setError('');
    setParsed(r.parsed);
    const cs = buildCandidates(r.parsed, { skillName });
    setSelected(cs.filter((c) => c.defaultSelected).map((c) => c.id));
    setApplyTests(undefined); setApplyRuntime(undefined); setRedact(true); setAttested(false); setKeepSecrets(false);
  };
  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.size > MAX_TRANSCRIPT_BYTES) { setError(`${f.name} is larger than ${MAX_TRANSCRIPT_BYTES / 1024 / 1024} MB.`); return; }
    const t = await f.text();
    setText(t.length > 200_000 ? '' : t);
    preview(t);
  };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const confirmDisabled = selected.length === 0 || (secretCount > 0 && !redact && !keepSecrets) || (needsAttest && !attested);

  const confirm = () => {
    const ids = [...new Set([...selected, ...(applyTests ? [applyTests] : []), ...(applyRuntime ? [applyRuntime] : [])])];
    onConfirm(buildOutcome(candidates, { ids, redact, attested }, () => newId('ev'), nowIso(), { tests: applyTests, runtime: applyRuntime }));
  };

  return (
    <Card aria-labelledby="ti-h" className="space-y-4" data-testid="transcript-importer">
      <div>
        <h3 id="ti-h" className="text-lg font-semibold">Import a transcript or result</h3>
        <p className="text-sm text-muted">Read as data on this device. Nothing is uploaded, run or saved until you confirm, and nothing in the file can change how Forge behaves.</p>
      </div>

      {!parsed && (
        <div className="space-y-3">
          <div>
            <label htmlFor="ti-file" className="block text-sm font-semibold">Upload a file</label>
            <input id="ti-file" type="file" accept=".json,.jsonl,.txt,.md,.log,application/json,text/*" onChange={(e) => void onFile(e.target.files?.[0])} className="mt-1 block w-full text-sm file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-surface2 file:px-3 file:font-semibold file:text-fg" data-testid="ti-file" />
            <p className="mt-1 text-xs text-muted">Up to {MAX_TRANSCRIPT_BYTES / 1024 / 1024} MB. Supported: the JSON that <code>claude -p --output-format json</code> prints, <code>stream-json</code> lines, a session <code>.jsonl</code> (an internal format, parsed on a best-effort basis), or plain text such as <code>/export</code>.</p>
          </div>
          <TextArea label="…or paste it here" rows={5} mono value={text} onChange={(e) => setText(e.target.value)} data-testid="ti-text" />
          {error && <Callout tone="bad" role="alert" title="Cannot import this">{error}</Callout>}
          <div className="flex gap-2"><Button variant="primary" onClick={() => preview(text)} disabled={!text.trim()} data-testid="ti-preview">Preview</Button><Button variant="ghost" onClick={onCancel}>Cancel</Button></div>
        </div>
      )}

      {parsed && (
        <div className="space-y-4" data-testid="ti-preview-panel">
          <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="ti-summary">{previewSummary(parsed).map((l) => <li key={l}>{l}</li>)}</ul>
          {parsed.warnings.length > 0 && <Callout tone="warn" title="Read this first"><ul className="list-disc pl-4">{parsed.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Callout>}

          {candidates.some((c) => c.secrets.length > 0) && (
            <Callout tone="bad" role="alert" title="Possible secrets were found">
              <ul className="list-disc pl-4 text-sm" data-testid="ti-secrets">{candidates.filter((c) => c.secrets.length).flatMap((c) => c.secrets.slice(0, 5).map((s, i) => <li key={`${c.id}-${i}`}>{s.label} on line {s.line} of &ldquo;{c.title}&rdquo;: <code>{s.preview}</code></li>))}</ul>
              <p className="mt-1 text-xs">Forge matches the shapes of common credentials and cannot know what is secret to you. Review the text yourself before keeping anything.</p>
            </Callout>
          )}

          <div>
            <p className="mb-1 text-sm font-semibold">Choose what to attach ({selected.length} selected)</p>
            <ul className="space-y-2" data-testid="ti-candidates">
              {candidates.map((c) => (
                <li key={c.id} className="rounded-lg border border-line p-3">
                  <label className="flex min-h-11 cursor-pointer items-start gap-3">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} data-testid={`ti-pick-${c.kind}`} />
                    <span className="min-w-0 flex-1"><span className="font-semibold">{c.title}</span> <Badge tone={TONE[c.classification]} title={CLASSIFICATION_MEANING[c.classification]}>{CLASSIFICATION_LABEL[c.classification]}</Badge>{c.secrets.length > 0 && <> <Badge tone="bad">{c.secrets.length} possible secret(s)</Badge></>}</span>
                  </label>
                  <p className="ml-7 text-xs text-muted">{c.note}</p>
                  <details className="ml-7"><summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold">Show the text</summary><pre className="code-scroll max-h-48 whitespace-pre-wrap break-words text-xs" tabIndex={0}><code>{c.text.slice(0, SHOW_CAP)}{c.text.length > SHOW_CAP ? '\n… (shortened for display; the full text is attached)' : ''}</code></pre></details>
                  {c.applies?.kind === 'tests' && <label className="ml-7 flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="radio" name="apply-tests" className="h-4 w-4 accent-[var(--accent)]" checked={applyTests === c.id} onChange={() => setApplyTests(c.id)} data-testid="ti-apply-tests" />Also copy these counts into the run form: {c.applies.passed} passed of {c.applies.total}{applyTests === c.id && <button type="button" className="ml-2 underline" onClick={() => setApplyTests(undefined)}>undo</button>}</label>}
                  {c.applies?.kind === 'runtimeSec' && <label className="ml-7 flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={applyRuntime === c.id} onChange={() => setApplyRuntime(applyRuntime === c.id ? undefined : c.id)} data-testid="ti-apply-runtime" />Also record {c.applies.seconds} s as the runtime</label>}
                </li>
              ))}
            </ul>
          </div>

          {needsAttest && <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={attested} onChange={(e) => setAttested(e.target.checked)} data-testid="ti-attest" /><span>I ran this command myself and these are its real results. (Plain text has no structure, so Forge cannot check this for you.)</span></label>}

          {secretCount > 0 && (
            <div className="space-y-2 rounded-lg border border-line p-3 text-sm">
              <label className="flex min-h-11 cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={redact} onChange={(e) => { setRedact(e.target.checked); if (e.target.checked) setKeepSecrets(false); }} data-testid="ti-redact" /><span><strong>Replace possible secrets with a marker when saving</strong> (recommended)</span></label>
              {!redact && <label className="flex min-h-11 cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={keepSecrets} onChange={(e) => setKeepSecrets(e.target.checked)} data-testid="ti-keep" /><span>I have checked, and I want to keep these {secretCount} possible secret(s) in the saved copy.</span></label>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={confirmDisabled} onClick={confirm} data-testid="ti-confirm">Attach {selected.length} item(s)</Button>
            <Button variant="ghost" onClick={() => { setParsed(null); setError(''); }}>Choose something else</Button>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          </div>
          <p className="text-xs text-muted">Attached items are stored as text, marked <em>user-imported</em>, and shown as plain text. Reasoning blocks are never imported.</p>
        </div>
      )}
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { Badge, Button, Callout, Card, Segmented, TextArea, TextInput, useToast, cx } from '@/components/ui';
import { RUBRIC_CRITERIA, RunSchema, METRICS, type Experiment, type Evidence, type Run } from '@/domain/experiments/model';
import { looksBinary, MAX_EVIDENCE_BYTES, parseTestReport } from '@/domain/experiments/testReport';
import { getFixture } from '@/fixtures';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

const num = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

interface Pending { kind: Evidence['kind']; name: string; text: string; provenance: Evidence['provenance'] }

export interface RunFormResult { run: Run; evidence: Evidence[] }

export function RunForm({ exp, editing, onSave, onCancel }: { exp: Experiment; editing: Run | null; onSave: (r: RunFormResult) => Promise<void>; onCancel: () => void }) {
  const toast = useToast();
  const fx = getFixture(exp.fixture.id);
  const [condId, setCondId] = useState(editing?.conditionId ?? exp.conditions[0]!.id);
  const [passed, setPassed] = useState(editing?.testsPassed?.toString() ?? '');
  const [total, setTotal] = useState(editing?.testsTotal?.toString() ?? '');
  const [prov, setProv] = useState<Run['testsProvenance']>(editing?.testsProvenance ?? 'self-reported');
  const [success, setSuccess] = useState<'yes' | 'no' | 'na'>(editing ? (editing.successMet === null ? 'na' : editing.successMet ? 'yes' : 'no') : 'na');
  const [assessed, setAssessed] = useState(Boolean(editing?.seededFound));
  const [found, setFound] = useState<string[]>(editing?.seededFound ?? []);
  const [metrics, setMetrics] = useState<Record<string, string>>(Object.fromEntries(METRICS.filter((m) => m.kind === 'measured').map((m) => [m.id, editing?.metrics[m.id]?.value?.toString() ?? ''])));
  const [rubric, setRubric] = useState<Record<string, number | null>>(Object.fromEntries(RUBRIC_CRITERIA.map((c) => [c.id, editing?.rubric[c.id] ?? null])));
  const [obs, setObs] = useState(editing?.observations ?? '');
  const [pending, setPending] = useState<Pending[]>([]);
  const [pasteName, setPasteName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (editing) setCondId(editing.conditionId); }, [editing]);

  const onReport = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const r = parseTestReport(text);
    if (!r.ok) { setErr(`Test report not imported: ${r.error}`); return; }
    setErr('');
    setPassed(String(r.counts.passed)); setTotal(String(r.counts.total)); setProv('user-imported');
    setPending((p) => [...p, { kind: 'test-report', name: file.name, text, provenance: 'user-imported' }]);
    toast(`Imported ${r.counts.passed}/${r.counts.total} from ${file.name} (${r.counts.format}). Marked user-imported, not verified.`);
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_EVIDENCE_BYTES) { setErr(`${file.name} is larger than ${MAX_EVIDENCE_BYTES / 1024} KB.`); return; }
    const text = await file.text();
    if (looksBinary(text)) { setErr(`${file.name} looks like a binary file. Only text evidence is supported.`); return; }
    setErr('');
    setPending((p) => [...p, { kind: 'file', name: file.name, text, provenance: 'user-imported' }]);
  };
  const addPaste = () => {
    if (!pasteText.trim()) return;
    if (pasteText.length > MAX_EVIDENCE_BYTES) { setErr('Pasted text is too large.'); return; }
    setPending((p) => [...p, { kind: 'pasted-output', name: pasteName.trim() || 'Pasted output', text: pasteText, provenance: 'self-reported' }]);
    setPasteName(''); setPasteText(''); setErr('');
  };

  const save = async () => {
    setErr('');
    const pN = num(passed), tN = num(total);
    if ((passed.trim() !== '' || total.trim() !== '') && (pN === null || tN === null)) return setErr('Enter both tests passed and total as whole numbers, or leave both blank for unknown.');
    if (pN !== null && tN !== null && (pN > tN || !Number.isInteger(pN) || !Number.isInteger(tN))) return setErr('Tests passed cannot exceed the total, and both must be whole numbers.');
    const m: Run['metrics'] = {};
    for (const [id, v] of Object.entries(metrics)) { const n = num(v); if (v.trim() !== '' && n === null) return setErr(`${METRICS.find((x) => x.id === id)?.label}: enter a non-negative number or leave blank for unknown.`); if (n !== null) m[id] = { value: n, provenance: 'self-reported' }; }
    setBusy(true);
    try {
      const index = editing ? editing.index : exp.runs.filter((r) => r.conditionId === condId).length + 1;
      const run = RunSchema.parse({
        id: editing?.id ?? newId('run'), conditionId: condId, index, recordedAt: editing?.recordedAt ?? nowIso(),
        testsPassed: pN, testsTotal: tN, testsProvenance: prov,
        successMet: success === 'na' ? null : success === 'yes', seededFound: assessed ? found : null,
        metrics: m, rubric, observations: obs,
      });
      const evidence: Evidence[] = pending.map((p) => ({ id: newId('ev'), experimentId: exp.id, runId: run.id, kind: p.kind, name: p.name, mime: 'text/plain', size: new TextEncoder().encode(p.text).length, text: p.text, provenance: p.provenance, addedAt: nowIso() }));
      await onSave({ run, evidence });
      setPending([]);
      if (!editing) { setPassed(''); setTotal(''); setProv('self-reported'); setSuccess('na'); setAssessed(false); setFound([]); setMetrics(Object.fromEntries(Object.keys(metrics).map((k) => [k, '']))); setRubric(Object.fromEntries(RUBRIC_CRITERIA.map((c) => [c.id, null]))); setObs(''); }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Card aria-labelledby="run-form-h" className="space-y-5">
      <h2 id="run-form-h" className="text-lg font-semibold">{editing ? `Edit run ${editing.index}` : 'Record a run'}</h2>
      <Callout tone="info" title="Everything you enter here is self-reported or user-imported">Blank means unknown. It is never treated as zero, and Forge does not verify any number.</Callout>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="run-cond" className="block text-sm font-semibold">Condition</label>
          <select id="run-cond" value={condId} disabled={Boolean(editing)} onChange={(e) => setCondId(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface2 px-2" data-testid="run-condition">{exp.conditions.map((c) => <option key={c.id} value={c.id}>{c.label} - {c.kind === 'no-skill' ? 'no Skill' : c.skillName || c.kind}</option>)}</select>
        </div>
        <div><p className="mb-1 text-sm font-semibold">Success criterion met?</p><Segmented label="Success criterion" value={success} onChange={setSuccess} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'na', label: 'Not assessed' }]} /></div>
      </div>

      <fieldset className="rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Test results (objective, from your own run) <Badge tone={prov === 'user-imported' ? 'teal' : 'neutral'}>{prov}</Badge></legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextInput label="Tests passed" inputMode="numeric" value={passed} onChange={(e) => { setPassed(e.target.value); setProv('self-reported'); }} data-testid="tests-passed" />
          <TextInput label="Total tests" inputMode="numeric" value={total} onChange={(e) => { setTotal(e.target.value); setProv('self-reported'); }} data-testid="tests-total" />
          <div><label htmlFor="report-file" className="block text-sm font-semibold">…or import a report</label><input id="report-file" type="file" accept="application/json,.json" onChange={(e) => void onReport(e.target.files?.[0])} className="mt-1 block w-full text-sm file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-surface2 file:px-3 file:font-semibold file:text-fg" /><p className="mt-1 text-xs text-muted">vitest/jest JSON. Read as data only.</p></div>
        </div>
      </fieldset>

      {fx && fx.checklist.length > 0 && (
        <fieldset className="rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-semibold">{fx.checklistLabel} (fixed checklist, your judgement)</legend>
          <Segmented label="Checklist assessed" value={assessed ? 'yes' : 'no'} onChange={(v) => { setAssessed(v === 'yes'); if (v === 'no') setFound([]); }} options={[{ value: 'no', label: 'Not assessed' }, { value: 'yes', label: 'Assessed' }]} />
          {assessed && <div className="mt-2 space-y-1">{fx.checklist.map((c) => <label key={c.id} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={found.includes(c.id)} onChange={() => setFound((f) => f.includes(c.id) ? f.filter((x) => x !== c.id) : [...f, c.id])} />{c.text}</label>)}</div>}
        </fieldset>
      )}

      <fieldset className="rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Measured values (leave blank if you did not measure)</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {METRICS.filter((m) => m.kind === 'measured').map((m) => <TextInput key={m.id} label={m.label} inputMode="decimal" value={metrics[m.id] ?? ''} onChange={(e) => setMetrics({ ...metrics, [m.id]: e.target.value })} hint={m.help} data-testid={`metric-${m.id}`} />)}
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Rubric (subjective, self-assessed; fixed for the whole experiment)</legend>
        <div className="space-y-3">
          {RUBRIC_CRITERIA.map((c) => (
            <div key={c.id}>
              <p className="text-sm font-semibold">{c.label}</p>
              <div role="radiogroup" aria-label={`${c.label} score`} className="mt-1 flex flex-wrap gap-2">
                {[null, 0, 1, 2, 3].map((v) => <button key={String(v)} type="button" role="radio" aria-checked={rubric[c.id] === v} onClick={() => setRubric({ ...rubric, [c.id]: v })} data-testid={`rubric-${c.id}-${v === null ? 'na' : v}`} className={cx('transition-forge min-h-11 min-w-11 rounded-lg border px-3 text-sm font-semibold', rubric[c.id] === v ? 'border-accent bg-surface2' : 'border-line text-muted hover:bg-surface2')}>{v === null ? 'Not assessed' : v}</button>)}
              </div>
              <p className="mt-1 text-xs text-muted">{rubric[c.id] === null ? 'Not assessed - excluded from comparisons, never scored as 0.' : `${rubric[c.id]}: ${c.levels[rubric[c.id]!]}`}</p>
              <details className="text-xs text-muted"><summary className="cursor-pointer">Show the full rubric</summary><ol start={0} className="list-decimal pl-5">{c.levels.map((l, i) => <li key={i}>{l}</li>)}</ol></details>
            </div>
          ))}
        </div>
      </fieldset>

      <TextArea label="Observations - what you saw (facts, not conclusions)" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} data-testid="run-observations" />

      <fieldset className="rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Evidence for this run</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><TextInput label="Paste Claude's output - label" value={pasteName} onChange={(e) => setPasteName(e.target.value)} placeholder="Run output" /><TextArea label="Pasted output" rows={4} mono value={pasteText} onChange={(e) => setPasteText(e.target.value)} data-testid="evidence-text" /><Button size="sm" className="mt-2" onClick={addPaste} disabled={!pasteText.trim()} data-testid="add-pasted">Attach pasted output</Button></div>
          <div><label htmlFor="ev-file" className="block text-sm font-semibold">Or upload a text file</label><input id="ev-file" type="file" accept=".txt,.md,.json,.log,.diff,.patch,.ts,.js,text/*" onChange={(e) => void onFile(e.target.files?.[0])} className="mt-1 block w-full text-sm file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-surface2 file:px-3 file:font-semibold file:text-fg" /><p className="mt-1 text-xs text-muted">Text only, up to {MAX_EVIDENCE_BYTES / 1024} KB. Stored locally, displayed as plain text, never executed.</p></div>
        </div>
        {pending.length > 0 && <ul className="mt-2 space-y-1 text-sm" data-testid="pending-evidence">{pending.map((p, i) => <li key={i} className="flex items-center gap-2"><Badge tone="teal">{p.kind}</Badge>{p.name} <Badge>{p.provenance}</Badge><Button size="sm" variant="ghost" aria-label={`Remove ${p.name}`} icon="x" onClick={() => setPending((cur) => cur.filter((_, j) => j !== i))} /></li>)}</ul>}
      </fieldset>

      {err && <Callout tone="bad" role="alert" title="Check this">{err}</Callout>}
      <div className="flex flex-wrap gap-2"><Button variant="primary" size="lg" onClick={() => void save()} disabled={busy} data-testid="save-run">{editing ? 'Update run' : 'Save run'}</Button>{editing && <Button variant="ghost" onClick={onCancel}>Cancel editing</Button>}</div>
    </Card>
  );
}

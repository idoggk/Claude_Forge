import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Callout, Card, Segmented, TextArea, TextInput, useToast, cx } from '@/components/ui';
import { RUBRIC_CRITERIA, RunSchema, METRICS, type Experiment, type Evidence, type Run } from '@/domain/experiments/model';
import { looksBinary, MAX_EVIDENCE_BYTES, parseTestReport } from '@/domain/experiments/testReport';
import { IMPORT_LABEL_MEANING, analyseEvidenceText, type TextAnalysis } from '@/domain/experiments/importer';
import { TranscriptImporter } from './TranscriptImporter';
import type { ImportOutcome } from '@/domain/transcript/candidates';
import { getFixture } from '@/fixtures';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

const num = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

interface Pending { kind: Evidence['kind']; name: string; text: string; provenance: Evidence['provenance']; analysis: TextAnalysis; classification?: Evidence['classification']; meta?: Evidence['meta'] }

/** What Forge found in a piece of text, with how it knows. Pasted model output is untrusted: a statement is never a measurement. */
export function FoundInText({ analysis, onUse }: { analysis: TextAnalysis; onUse: (a: TextAnalysis) => void }) {
  const { counts, claims, ambiguous, contradiction } = analysis;
  if (!counts && claims.length === 0 && !ambiguous) return <p className="text-xs text-muted" data-testid="found-nothing">No recognised test summary in this text, so nothing can be applied. {IMPORT_LABEL_MEANING.unknown}</p>;
  return (
    <div className="space-y-2 rounded-lg border border-line p-2 text-sm" data-testid="found-in-text">
      {counts && (
        <div>
          <Badge tone="teal">Parsed</Badge> {counts.runner} summary: <code className="break-all">{counts.line}</code> → {counts.passed} passed, {counts.failed} failed, {counts.total} total.
          <p className="text-xs text-muted">Forge cannot tell whether this line came from a real test run or was typed by a model. Use it only if it is the output of a command you ran.</p>
          <Button size="sm" className="mt-1" onClick={() => onUse(analysis)} data-testid="use-parsed-counts">Use these counts ({counts.passed}/{counts.total})</Button>
        </div>
      )}
      {ambiguous && <p><Badge tone="warn">Ambiguous</Badge> More than one different test summary was found, so Forge will not choose one. Enter the counts yourself.</p>}
      {claims.length > 0 && (
        <div>
          <Badge tone="warn">Inferred</Badge> Statements found in the text:
          <ul className="list-disc pl-5 text-xs" data-testid="claims">{claims.map((c, i) => <li key={i}>“{c}”</li>)}</ul>
          <p className="text-xs text-muted">{IMPORT_LABEL_MEANING.inferred}</p>
        </div>
      )}
      {contradiction && <Callout tone="bad" role="alert" title="The text contradicts its own test summary">{contradiction}</Callout>}
    </div>
  );
}

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
  const [attempt, setAttempt] = useState<Run['attempt']>(editing?.attempt ?? 'completed');
  const [skillVersion, setSkillVersion] = useState(editing?.skillVersion ?? '');
  const [fixtureVersion, setFixtureVersion] = useState(editing?.fixtureVersion ?? '');
  const [context, setContext] = useState(editing?.context ?? '');
  const [pending, setPending] = useState<Pending[]>([]);
  const [pasteName, setPasteName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => { if (editing) setCondId(editing.conditionId); }, [editing]);

  const onReport = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const r = parseTestReport(text);
    if (!r.ok) { setErr(`Test report not imported: ${r.error}`); return; }
    setErr('');
    setPassed(String(r.counts.passed)); setTotal(String(r.counts.total)); setProv('user-imported');
    setPending((p) => [...p, { kind: 'test-report', name: file.name, text, provenance: 'user-imported', analysis: analyseEvidenceText(text) }]);
    toast(`Imported ${r.counts.passed}/${r.counts.total} from ${file.name} (${r.counts.format}). Marked user-imported, not verified.`);
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_EVIDENCE_BYTES) { setErr(`${file.name} is larger than ${MAX_EVIDENCE_BYTES / 1024} KB.`); return; }
    const text = await file.text();
    if (looksBinary(text)) { setErr(`${file.name} looks like a binary file. Only text evidence is supported.`); return; }
    setErr('');
    setPending((p) => [...p, { kind: 'file', name: file.name, text, provenance: 'user-imported', analysis: analyseEvidenceText(text) }]);
  };
  const addPaste = () => {
    if (!pasteText.trim()) return;
    if (pasteText.length > MAX_EVIDENCE_BYTES) { setErr('Pasted text is too large.'); return; }
    setPending((p) => [...p, { kind: 'pasted-output', name: pasteName.trim() || 'Pasted output', text: pasteText, provenance: 'self-reported', analysis: analyseEvidenceText(pasteText) }]);
    setPasteName(''); setPasteText(''); setErr('');
  };

  const useCounts = (a: TextAnalysis) => {
    if (!a.counts) return;
    setPassed(String(a.counts.passed)); setTotal(String(a.counts.total)); setProv('self-reported');
    toast(`Applied ${a.counts.passed}/${a.counts.total} from the text. Marked self-reported: Forge cannot verify it.`);
  };
  const applyImport = (o: ImportOutcome) => {
    setPending((p) => [...p, ...o.evidence.map((e) => ({ kind: e.kind, name: e.name, text: e.text, provenance: e.provenance, analysis: analyseEvidenceText(e.text), classification: e.classification, meta: e.meta }))]);
    if (o.tests) { setPassed(String(o.tests.passed)); setTotal(String(o.tests.total)); setProv('user-imported'); }
    if (o.runtimeSec !== null) setMetrics((m) => ({ ...m, runtimeSec: String(o.runtimeSec) }));
    setImporting(false);
    toast(`${o.evidence.length} item(s) added to this run's evidence${o.redactedCount ? `; ${o.redactedCount} possible secret(s) replaced` : ''}. Review the numbers, then save the run.`);
  };
  const pasteAnalysis = useMemo(() => (pasteText.trim() ? analyseEvidenceText(pasteText) : null), [pasteText]);

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
        attempt, skillVersion: skillVersion.trim(), fixtureVersion: fixtureVersion.trim(), context: context.trim(),
      });
      const evidence: Evidence[] = pending.map((p) => ({ id: newId('ev'), experimentId: exp.id, runId: run.id, kind: p.kind, name: p.name, mime: 'text/plain', size: new TextEncoder().encode(p.text).length, text: p.text, provenance: p.provenance, classification: p.classification ?? null, meta: p.meta ?? {}, addedAt: nowIso() }));
      await onSave({ run, evidence });
      setPending([]);
      if (!editing) { setPassed(''); setTotal(''); setProv('self-reported'); setSuccess('na'); setAssessed(false); setFound([]); setMetrics(Object.fromEntries(Object.keys(metrics).map((k) => [k, '']))); setRubric(Object.fromEntries(RUBRIC_CRITERIA.map((c) => [c.id, null]))); setObs(''); setAttempt('completed'); }
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
        <div className="sm:col-span-2"><p className="mb-1 text-sm font-semibold">How did this attempt end?</p><Segmented label="Attempt result" value={attempt} onChange={setAttempt} options={[{ value: 'completed', label: 'Completed' }, { value: 'failed', label: 'Failed' }, { value: 'abandoned', label: 'Abandoned' }]} /><p className="mt-1 text-xs text-muted">Record failed and abandoned attempts too. They stay in the counts; deleting them would make a condition look more reliable than it was. Leave measurements blank if you have none: blank is unknown, not a pass.</p></div>
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

      <details className="rounded-lg border border-line p-3" open={Boolean(skillVersion || fixtureVersion || context)}>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">Versions and execution context for this run (optional, but they decide whether runs are comparable)</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <TextInput label="Workflow / Skill version used" value={skillVersion} maxLength={120} onChange={(e) => setSkillVersion(e.target.value)} placeholder="commit, release or snapshot label" data-testid="run-skill-version" />
          <TextInput label="Fixture version used" value={fixtureVersion} maxLength={40} onChange={(e) => setFixtureVersion(e.target.value)} placeholder={exp.fixture.version || 'e.g. 1'} data-testid="run-fixture-version" />
          <TextInput label="Execution context" value={context} maxLength={300} onChange={(e) => setContext(e.target.value)} placeholder="model, session, anything that differed" data-testid="run-context" />
        </div>
        <p className="mt-1 text-xs text-muted">Forge compares these across runs and conditions and says so when they differ.</p>
      </details>

      <TextArea label="Observations - what you saw (facts, not conclusions)" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} data-testid="run-observations" />

      <fieldset className="rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Evidence for this run</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><TextInput label="Paste Claude's output - label" value={pasteName} onChange={(e) => setPasteName(e.target.value)} placeholder="Run output" /><TextArea label="Pasted output" rows={4} mono value={pasteText} onChange={(e) => setPasteText(e.target.value)} data-testid="evidence-text" />{pasteAnalysis && <div className="mt-2"><FoundInText analysis={pasteAnalysis} onUse={useCounts} /></div>}<Button size="sm" className="mt-2" onClick={addPaste} disabled={!pasteText.trim()} data-testid="add-pasted">Attach pasted output</Button></div>
          <div><label htmlFor="ev-file" className="block text-sm font-semibold">Or upload a text file</label><input id="ev-file" type="file" accept=".txt,.md,.json,.log,.diff,.patch,.ts,.js,text/*" onChange={(e) => void onFile(e.target.files?.[0])} className="mt-1 block w-full text-sm file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-surface2 file:px-3 file:font-semibold file:text-fg" /><p className="mt-1 text-xs text-muted">Text only, up to {MAX_EVIDENCE_BYTES / 1024} KB. Stored locally, displayed as plain text, never executed.</p></div>
        </div>
        <div className="mt-3 border-t border-line pt-3">{importing ? <TranscriptImporter skillName={exp.conditions.find((c) => c.id === condId)?.skillName} onCancel={() => setImporting(false)} onConfirm={applyImport} /> : <Button size="sm" onClick={() => setImporting(true)} data-testid="open-importer-full">Import a Claude Code transcript or result…</Button>}</div>
        {pending.length > 0 && <ul className="mt-2 space-y-2 text-sm" data-testid="pending-evidence">{pending.map((p, i) => <li key={i}><div className="flex items-center gap-2"><Badge tone="teal">{p.kind}</Badge>{p.name} <Badge>{p.provenance}</Badge>{p.classification && <Badge tone="accent">{p.classification}</Badge>}<Button size="sm" variant="ghost" aria-label={`Remove ${p.name}`} icon="x" onClick={() => setPending((cur) => cur.filter((_, j) => j !== i))} /></div>{(p.analysis.counts || p.analysis.claims.length > 0) && <div className="mt-1"><FoundInText analysis={p.analysis} onUse={useCounts} /></div>}</li>)}</ul>}
      </fieldset>

      {err && <Callout tone="bad" role="alert" title="Check this">{err}</Callout>}
      <div className="flex flex-wrap gap-2"><Button variant="primary" size="lg" onClick={() => void save()} disabled={busy} data-testid="save-run">{editing ? 'Update run' : 'Save run'}</Button>{editing && <Button variant="ghost" onClick={onCancel}>Cancel editing</Button>}</div>
    </Card>
  );
}

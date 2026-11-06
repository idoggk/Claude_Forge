import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, CopyButton, EmptyState, LinkButton, PageHeader, ProgressBar, Segmented, Spinner, TextArea, TextInput, useToast } from '@/components/ui';
import { getDb } from '@/persistence/db';
import { useLive } from '@/persistence/useLive';
import { addEvidence, saveExperiment } from '@/persistence/repo';
import { ATTEMPT_LABELS, type Evidence, type Experiment, type PilotFeedback, type Run } from '@/domain/experiments/model';
import { analyseEvidenceText, type TextAnalysis } from '@/domain/experiments/importer';
import { PILOT_RUNS_PER_CONDITION, buildQuickRun, currentPilotStep, nextActionText, nextRunLabel, pilotComplete, pilotReading, pilotSteps, runCounts, runSheetMarkdown, suggestedRunOrder } from '@/domain/pilot/pilot';
import { getPilotStarter } from '@/content/pilot/starters';
import { ComparisonView } from '@/features/battle-lab/ComparisonView';
import { FoundInText } from '@/features/battle-lab/RunForm';
import { TranscriptImporter } from '@/features/battle-lab/TranscriptImporter';
import type { ImportOutcome } from '@/domain/transcript/candidates';
import { LESSONS } from '@/content/lessons';
import { downloadText } from '@/lib/download';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'experiment';

/** A text field saved when it loses focus. Keeps its own draft so typing never fights the stored value. */
function SavedText({ label, value, onSave, rows = 3, hint, placeholder, testId, minChars }: { label: string; value: string; onSave: (v: string) => Promise<void>; rows?: number; hint?: ReactNode; placeholder?: string; testId: string; minChars?: number }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const short = minChars !== undefined && v.trim().length < minChars;
  return (
    <div>
      <TextArea label={label} rows={rows} value={v} placeholder={placeholder} hint={hint} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) void onSave(v); }} data-testid={testId} />
      {minChars !== undefined && <p className="mt-1 text-xs text-muted">{short ? `${Math.max(0, minChars - v.trim().length)} more character(s) to count as done.` : 'Saved when you leave the box.'}</p>}
    </div>
  );
}

function QuickRun({ exp, next, onSaved }: { exp: Experiment; next: string | null; onSaved: () => void }) {
  const toast = useToast();
  const first = exp.conditions.find((c) => c.label === next) ?? exp.conditions[0]!;
  const [cond, setCond] = useState(first.id);
  useEffect(() => setCond(exp.conditions.find((c) => c.label === next)?.id ?? exp.conditions[0]!.id), [next, exp.conditions]);
  const [attempt, setAttempt] = useState<Run['attempt']>('completed');
  const [success, setSuccess] = useState<'yes' | 'no' | 'unknown'>('unknown');
  const [rework, setRework] = useState('');
  const [effort, setEffort] = useState('');
  const [notes, setNotes] = useState('');
  const [paste, setPaste] = useState('');
  const [err, setErr] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<ImportOutcome | null>(null);
  const analysis: TextAnalysis | null = useMemo(() => (paste.trim() ? analyseEvidenceText(paste) : null), [paste]);
  const num = (s: string): number | null | 'bad' => (s.trim() === '' ? null : Number.isFinite(Number(s)) && Number(s) >= 0 ? Number(s) : 'bad');

  const save = async () => {
    const r = num(rework), m = num(effort);
    if (r === 'bad' || m === 'bad') return setErr('Corrections and minutes must be a number of 0 or more, or left blank for unknown.');
    setErr('');
    const now = nowIso();
    const run = buildQuickRun(exp, { conditionId: cond, attempt, success, reworkRounds: r, effortMin: m, interventions: null, observations: notes, tests: imported?.tests ?? null, runtimeSec: imported?.runtimeSec ?? null }, newId('run'), now);
    await saveExperiment({ ...exp, runs: [...exp.runs, run], rubricLockedAt: exp.rubricLockedAt ?? now, status: exp.status === 'draft' ? 'recording' : exp.status });
    if (paste.trim()) {
      const ev: Evidence = { id: newId('ev'), experimentId: exp.id, runId: run.id, kind: 'pasted-output', name: 'Pasted output', mime: 'text/plain', size: new TextEncoder().encode(paste).length, text: paste.slice(0, 500_000), provenance: 'self-reported', classification: null, meta: {}, addedAt: now };
      await addEvidence(ev);
    }
    for (const e of imported?.evidence ?? []) await addEvidence({ ...e, experimentId: exp.id, runId: run.id });
    setAttempt('completed'); setSuccess('unknown'); setRework(''); setEffort(''); setNotes(''); setPaste(''); setImported(null);
    toast('Run saved');
    onSaved();
  };

  return (
    <Card aria-labelledby="qr-h" className="space-y-3" data-testid="quick-run">
      <h3 id="qr-h" className="text-lg font-semibold">Record a run</h3>
      <div>
        <p className="mb-1 text-sm font-semibold">Which condition did you just run?</p>
        <Segmented label="Condition" value={cond} onChange={setCond} options={exp.conditions.map((c) => ({ value: c.id, label: `${c.label}${c.label === next ? ' (suggested next)' : ''}` }))} />
      </div>
      <div><p className="mb-1 text-sm font-semibold">How did the attempt end?</p><Segmented label="Attempt result" value={attempt} onChange={setAttempt} options={[{ value: 'completed', label: 'Completed' }, { value: 'failed', label: 'Failed' }, { value: 'abandoned', label: 'Abandoned' }]} /><p className="mt-1 text-xs text-muted">Record failed and abandoned runs too: they stay in the counts.</p></div>
      <div><p className="mb-1 text-sm font-semibold">Did it meet your checks?</p><Segmented label="Checks met" value={success} onChange={setSuccess} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Not sure' }]} /></div>
      <details>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">Optional measurements (blank means unknown)</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2"><TextInput label="Corrections you had to send" inputMode="numeric" value={rework} onChange={(e) => setRework(e.target.value)} data-testid="qr-rework" /><TextInput label="Minutes of your own attention" inputMode="decimal" value={effort} onChange={(e) => setEffort(e.target.value)} /></div>
      </details>
      <TextArea label="What you saw (facts, not conclusions)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="qr-notes" />
      <details>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">Attach the output (optional)</summary>
        <div className="mt-2 space-y-2">
          <TextArea label="Paste Claude's output or your test output" rows={4} mono value={paste} onChange={(e) => setPaste(e.target.value)} data-testid="qr-paste" />
          {analysis && <FoundInText analysis={analysis} onUse={() => undefined} />}
          <p className="text-xs text-muted">Stored as text, never executed. Pasting does not change your counts: you enter those above.</p>
          <div className="border-t border-line pt-2">
            {importing ? (
              <TranscriptImporter skillName={exp.pilot?.technique} onCancel={() => setImporting(false)} onConfirm={(o) => { setImported(o); setImporting(false); toast(`${o.evidence.length} item(s) ready to attach${o.redactedCount ? `; ${o.redactedCount} possible secret(s) replaced` : ''}. They are saved with the run.`); }} />
            ) : (
              <Button size="sm" onClick={() => setImporting(true)} data-testid="open-importer">Import a Claude Code transcript or result…</Button>
            )}
            {imported && (
              <div className="mt-2 rounded-lg border border-line p-2 text-sm" data-testid="imported-summary">
                <p><strong>Ready to save with this run:</strong> {imported.evidence.length} attachment(s) marked user-imported{imported.tests ? `; tests ${imported.tests.passed}/${imported.tests.total} (from an imported tool result)` : ''}{imported.runtimeSec !== null ? `; runtime ${imported.runtimeSec} s` : ''}.</p>
                {imported.warnings.map((w) => <p key={w} className="text-xs text-muted">{w}</p>)}
                <button type="button" className="mt-1 text-xs underline" onClick={() => setImported(null)}>Remove the import</button>
              </div>
            )}
          </div>
        </div>
      </details>
      {err && <Callout tone="bad" role="alert" title="Check this">{err}</Callout>}
      <Button variant="primary" onClick={() => void save()} data-testid="qr-save">Save run</Button>
    </Card>
  );
}

function PilotFeedbackForm({ exp, onSave }: { exp: Experiment; onSave: (f: PilotFeedback) => Promise<void> }) {
  const toast = useToast();
  const saved = exp.pilot?.feedback ?? null;
  const [f, setF] = useState<Omit<PilotFeedback, 'savedAt'>>({ confusing: saved?.confusing ?? '', unnecessaryEffort: saved?.unnecessaryEffort ?? '', judgmentChanged: saved?.judgmentChanged ?? 'unsure', improve: saved?.improve ?? '', wouldRepeat: saved?.wouldRepeat ?? 'maybe' });
  return (
    <details className="rounded-lg border border-line p-3" data-testid="pilot-feedback">
      <summary className="min-h-11 cursor-pointer font-semibold">Tell the next version what got in your way{saved ? ' (saved)' : ' (optional)'}</summary>
      <div className="mt-2 space-y-3">
        <p className="text-xs text-muted">Your own opinion about this flow. It stays on this device inside this experiment, is never sent anywhere, and is not evidence about how well anything performed.</p>
        <TextArea label="What was confusing?" rows={2} value={f.confusing} onChange={(e) => setF({ ...f, confusing: e.target.value })} data-testid="fb-confusing" />
        <TextArea label="Which step took more effort than it should have?" rows={2} value={f.unnecessaryEffort} onChange={(e) => setF({ ...f, unnecessaryEffort: e.target.value })} data-testid="fb-effort" />
        <Segmented label="Did the experiment change your judgment?" value={f.judgmentChanged} onChange={(v) => setF({ ...f, judgmentChanged: v })} options={[{ value: 'yes', label: 'Yes' }, { value: 'somewhat', label: 'Somewhat' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' }]} />
        <TextArea label="What would you improve?" rows={2} value={f.improve} onChange={(e) => setF({ ...f, improve: e.target.value })} data-testid="fb-improve" />
        <Segmented label="Would you repeat this workflow?" value={f.wouldRepeat} onChange={(v) => setF({ ...f, wouldRepeat: v })} options={[{ value: 'yes', label: 'Yes' }, { value: 'maybe', label: 'Maybe' }, { value: 'no', label: 'No' }]} />
        <Button onClick={async () => { await onSave({ ...f, savedAt: nowIso() }); toast('Feedback saved on this device'); }} data-testid="fb-save">Save feedback</Button>
      </div>
    </details>
  );
}

export default function PilotGuide() {
  const { experimentId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: exp, loading } = useLive<Experiment | undefined>(() => getDb().experiments.get(experimentId), [experimentId]);
  const { data: evidence } = useLive(() => getDb().evidence.where('experimentId').equals(experimentId).toArray(), [experimentId]);
  const [bump, setBump] = useState(0);
  void bump;
  if (loading) return <Spinner label="Opening the experiment" />;
  if (!exp || !exp.pilot) return <EmptyState title="That guided experiment was not found" action={<LinkButton to="/pilot" variant="primary">Back to the first experiment</LinkButton>}>It may have been deleted, or it was not started from the guided flow.</EmptyState>;
  const st = getPilotStarter(exp.pilot.starter)!;
  const steps = pilotSteps(exp);
  const current = currentPilotStep(exp);
  const done = steps.filter((s) => s.done).length;
  const complete = pilotComplete(exp);
  const counts = runCounts(exp);
  const next = nextRunLabel(exp);
  const order = suggestedRunOrder(exp.conditions.map((c) => c.label), PILOT_RUNS_PER_CONDITION);
  const reading = pilotReading(exp);
  const patch = async (p: Partial<Experiment>): Promise<void> => { await saveExperiment({ ...exp, ...p }); };
  // Steps 4 and 5 are one phase (run it, then record it), so both stay open until the evidence is complete.
  const open = (id: string) => current?.id === id || (complete && id === 'next') || ((id === 'run' || id === 'evidence') && (current?.id === 'run' || current?.id === 'evidence'));
  const [a, b] = exp.conditions;
  const lessons = st.relatedLessons.map((id) => LESSONS.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => Boolean(l));
  const stepHead = (id: string) => { const s = steps.find((x) => x.id === id)!; return <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 text-lg font-semibold"><span aria-hidden>{s.done ? '✓' : '○'}</span><span><span className="sr-only">{s.done ? 'Done: ' : 'Not done: '}</span>{s.n} · {s.title}</span>{current?.id === id && <Badge tone="accent">You are here</Badge>}</summary>; };

  return (
    <div data-testid="pilot-guide">
      <PageHeader eyebrow={`First experiment · ${st.title}`} title={exp.title} subtitle="Forge guides and records. You run the task in your own Claude Code, so nothing here is a result until you enter it." actions={<><LinkButton to="/pilot" variant="ghost" size="sm">All guided experiments</LinkButton><LinkButton to={`/battle-lab/${exp.id}`} variant="ghost" size="sm">Open in the Lab</LinkButton></>} />
      <div className="mb-4"><ProgressBar value={done} max={8} label={`${done} of 8 steps done`} /><p className="mt-1 text-sm text-muted" data-testid="pilot-progress">{done} of 8 steps done{current ? ` · next: ${current.title}` : ' · every step is done'}</p></div>

      <Callout tone="info" title="Do this now" role="status"><span data-testid="pilot-next-action">{nextActionText(exp).text}</span></Callout>

      <div className="mt-4 space-y-3">
        {/* 1-3 */}
        <Card><details open={Boolean(current && current.n <= 3)}>{stepHead('problem')}
          <div className="mt-2 space-y-2 text-sm">
            <p><strong>Task:</strong> {exp.problem}</p>
            <div><strong>Your checks:</strong><ul className="list-disc pl-5">{exp.successCriteria.map((c) => <li key={c}>{c}</li>)}</ul></div>
            <p><strong>Baseline ({a?.label}):</strong> {a?.difference}</p>
            <p><strong>Improved ({b?.label}, {b?.skillName}):</strong> {b?.difference}</p>
            <p><strong>You expect:</strong> {exp.hypothesis}</p>
            <p className="text-xs text-muted">Steps 2 and 3 are part of this plan. The hypothesis and prompt lock once a run is recorded so they cannot be bent to fit the results. Other setup can be changed in the <Link className="underline" to={`/battle-lab/${exp.id}`}>Lab</Link>.</p>
          </div>
        </details></Card>

        {/* 4 */}
        <Card><details open={open('run')}>{stepHead('run')}
          <div className="mt-2 space-y-3" data-testid="step-run">
            <Callout tone="info" title="Do this in your own Claude Code">Forge does not run Claude, install a Skill or read your project. Copy what you need, run it, then come back and record what happened.</Callout>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <div className="min-w-0 rounded-lg border border-line p-3"><p className="font-semibold">Copy this prompt (identical in every run)</p><pre className="code-scroll mt-1 max-h-40 whitespace-pre-wrap break-words text-xs" tabIndex={0}><code>{exp.prompt}</code></pre><div className="mt-2"><CopyButton text={exp.prompt} label="Copy the prompt" what="the prompt" /></div></div>
              <div className="min-w-0 rounded-lg border border-line p-3"><p className="font-semibold">Keep constant</p><ul className="mt-1 list-disc pl-5 text-sm">{st.keepConstant.map((k) => <li key={k}>{k}</li>)}</ul></div>
              <div className="min-w-0 rounded-lg border border-line p-3"><p className="font-semibold">Condition {a?.label}: {st.baselineLabel}</p><ol className="mt-1 list-decimal pl-5 text-sm">{st.baselineRun.map((k) => <li key={k}>{k}</li>)}</ol></div>
              <div className="min-w-0 rounded-lg border border-line p-3"><p className="font-semibold">Condition {b?.label}: {st.improvedLabel}</p><ol className="mt-1 list-decimal pl-5 text-sm">{st.improvedRun.map((k) => <li key={k}>{k}</li>)}</ol></div>
            </div>
            <div className="rounded-lg border border-line p-3 text-sm"><p className="font-semibold">Suggested order</p><p data-testid="run-order" className="mt-1">{order.join(' → ')}</p><p className="mt-1 text-xs text-muted">Alternating keeps one condition from always going first. Save after each run: {st.save.join('; ').toLowerCase()}.</p></div>
            <div className="flex flex-wrap gap-2"><Button icon="download" size="sm" onClick={() => downloadText(runSheetMarkdown(exp), `${slug(exp.title)}-run-sheet.md`, 'text/markdown')} data-testid="download-run-sheet">Download the run sheet (Markdown)</Button><CopyButton text={runSheetMarkdown(exp)} label="Copy the run sheet" what="the run sheet" /></div>
            {lessons.length > 0 && <p className="text-xs text-muted">Background: {lessons.map((l, i) => <span key={l.id}>{i > 0 && ', '}<Link className="underline" to={`/academy/lesson/${l.id}`}>{l.title}</Link></span>)}.</p>}
          </div>
        </details></Card>

        {/* 5 */}
        <Card><details open={open('evidence')}>{stepHead('evidence')}
          <div className="mt-2 space-y-3" data-testid="step-evidence">
            <div className="grid gap-2 sm:grid-cols-2">{counts.map((c) => <div key={c.label} className="rounded-lg border border-line p-2 text-sm" data-testid={`count-${c.label}`}><strong>{c.label}</strong>: {c.withData} of {PILOT_RUNS_PER_CONDITION} runs with a measurement{c.recorded > c.withData ? ` (${c.recorded} recorded)` : ''}</div>)}</div>
            <p className="text-sm text-muted">{steps.find((s) => s.id === 'evidence')!.detail}{next ? ` Next suggested run: condition ${next}.` : ''}</p>
            <QuickRun exp={exp} next={next} onSaved={() => setBump((x) => x + 1)} />
            {exp.runs.length > 0 && (
              <ul className="space-y-2" data-testid="pilot-runs">
                {[...exp.runs].sort((x, y) => x.recordedAt.localeCompare(y.recordedAt)).map((r) => {
                  const c = exp.conditions.find((x) => x.id === r.conditionId);
                  const ev = (evidence ?? []).filter((e) => e.runId === r.id).length;
                  return <Card as="li" key={r.id}><p className="text-sm"><strong>{c?.label} · run {r.index}</strong> {r.attempt !== 'completed' && <Badge tone="warn">{ATTEMPT_LABELS[r.attempt]}</Badge>} · checks met: {r.successMet === null ? 'not sure' : r.successMet ? 'yes' : 'no'} · corrections: {r.metrics.reworkRounds?.value ?? 'unknown'}{ev ? ` · ${ev} attachment(s)` : ''}</p>{r.observations && <p className="text-sm text-muted">{r.observations}</p>}<div className="mt-1"><ConfirmButton label="Remove run" confirmLabel="Remove this run" onConfirm={async () => { await patch({ runs: exp.runs.filter((x) => x.id !== r.id) }); toast('Run removed'); }} /></div></Card>;
                })}
              </ul>
            )}
          </div>
        </details></Card>

        {/* 6 */}
        <Card><details open={open('evaluate')}>{stepHead('evaluate')}
          <div className="mt-2 space-y-3" data-testid="step-evaluate">
            {exp.runs.length === 0 ? <p className="text-sm text-muted">Record some runs first. The comparison appears here.</p> : (
              <>
                <Callout tone={reading.enough ? 'info' : 'warn'} title={reading.headline} role="status">{reading.notes.map((n) => <p key={n} className="mt-1">{n}</p>)}</Callout>
                <ul className="space-y-2">{reading.rows.map((r) => <li key={r.measure} className="rounded-lg border border-line p-3 text-sm"><p className="font-semibold">{r.measure}</p><ul className="mt-1">{r.cells.map((c) => <li key={c.label}><strong>{c.label}:</strong> {c.text}</li>)}</ul><p className="mt-1 text-xs text-muted">{r.reading}</p></li>)}</ul>
                <details><summary className="min-h-11 cursor-pointer text-sm font-semibold">Full comparison (every figure, with ranges and unknowns)</summary><div className="mt-2"><ComparisonView experiment={exp} /></div></details>
              </>
            )}
            <div className="rounded-lg border border-line p-3"><p className="font-semibold">What this experiment cannot show</p><ul className="mt-1 list-disc pl-5 text-sm">{st.cannotInfer.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <SavedText label="Limitations, in your words: what could make this result misleading?" value={exp.limitations} onSave={(v) => patch({ limitations: v })} testId="ev-limitations" minChars={20} rows={3} />
          </div>
        </details></Card>

        {/* 7 */}
        <Card><details open={open('reflect')}>{stepHead('reflect')}
          <div className="mt-2" data-testid="step-reflect"><SavedText label="What do you conclude, and how sure are you?" value={exp.conclusion} onSave={(v) => patch({ conclusion: v })} testId="ev-conclusion" minChars={30} rows={4} hint="Say what the runs showed, what surprised you, and what you would decide. A small sample supports a direction, not a general claim." /></div>
        </details></Card>

        {/* 8 */}
        <Card><details open={open('next')}>{stepHead('next')}
          <div className="mt-2 space-y-3" data-testid="step-next">
            <SavedText label="One change to try next, or a decision to stop" value={exp.pilot.nextImprovement} onSave={(v) => patch({ pilot: { ...exp.pilot!, nextImprovement: v } })} testId="ev-next" minChars={15} rows={3} />
            {complete && (
              <div className="rounded-lg border border-line p-3" data-testid="pilot-complete">
                <p className="font-semibold">Every step is done.</p>
                <p className="mt-1 text-sm text-muted">The experiment is complete when you have three runs per condition with a measurement, written limits, a conclusion and a next step. It still shows one task, one setup and your own scoring.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {exp.status !== 'concluded' && <Button variant="primary" onClick={async () => { await patch({ status: 'concluded' }); toast('Marked concluded'); }} data-testid="pilot-conclude">Mark concluded</Button>}
                  {exp.status === 'concluded' && <Badge tone="ok">Concluded</Badge>}
                  <LinkButton to={`/battle-lab/${exp.id}`} size="sm">Export the report</LinkButton>
                  <LinkButton to="/transfer" size="sm">Take it to real work</LinkButton>
                  <LinkButton to={`/library/new?ref=lab-report&refId=${encodeURIComponent(exp.id)}&label=${encodeURIComponent(exp.title)}`} size="sm" data-testid="pilot-save-takeaway">Save a takeaway</LinkButton>
                  <Button size="sm" onClick={() => nav('/pilot')}>Start another</Button>
                </div>
              </div>
            )}
            <PilotFeedbackForm exp={exp} onSave={(f) => patch({ pilot: { ...exp.pilot!, feedback: f } })} />
          </div>
        </details></Card>
      </div>
    </div>
  );
}

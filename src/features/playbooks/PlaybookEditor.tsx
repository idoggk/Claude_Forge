import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, LinkButton, PageHeader, SelectField, Spinner, TextArea, TextInput, useToast } from '@/components/ui';
import { useExperiments, usePlaybooks, useSkills } from '@/app/hooks';
import { savePlaybook } from '@/persistence/repo';
import { blankStep, counts, exportPlaybookJson, exportPlaybookMarkdown, playbookProblems, reliabilityChecklist } from '@/domain/playbook/ops';
import { STEP_STATUSES, type Playbook, type Step, type StepStatus } from '@/domain/playbook/model';
import { MATURITY_LABEL, MATURITY_MEANING, effectiveStepStatus, playbookMaturity } from '@/domain/playbook/evidence';
import type { Experiment } from '@/domain/experiments/model';
import { EvaluationCard, MaturityCard, OrphanLinks, StepEvidencePanel } from './EvidencePanel';
import { CATALOG } from '@/content/catalog/entries';
import { CAPABILITIES } from '@/content/capability/map';
import { newId } from '@/lib/ids';
import { downloadText } from '@/lib/download';

const STATUS_LABEL: Record<StepStatus, string> = { planned: 'Planned', 'in-progress': 'In progress', done: 'Done (not verified)', verified: 'Verified' };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'playbook';

/** One-per-line list editor: keeps a draft string so typing newlines never fights the stored array. */
function LinesField({ label, value, onChange, hint, testId }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string; testId?: string }) {
  const [text, setText] = useState(value.join('\n'));
  return <TextArea label={label} hint={hint} rows={3} value={text} data-testid={testId} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20)); }} />;
}

function StepEditor({ s, i, n, onChange, onMove, onRemove, skills, evidence }: { s: Step; i: number; n: number; onChange: (s: Step) => void; onMove: (d: -1 | 1) => void; onRemove: () => void; skills: { id: string; name: string }[]; evidence: React.ReactNode }) {
  const [linkKind, setLinkKind] = useState<'catalog' | 'skill'>('catalog');
  const [linkRef, setLinkRef] = useState('');
  const set = <K extends keyof Step>(k: K, v: Step[K]) => onChange({ ...s, [k]: v });
  const outdated = effectiveStepStatus(s) === 'verification-outdated';
  return (
    <li className="rounded-xl border border-line p-4" data-testid={`step-${i}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Step {i + 1}</span>
        <Badge tone={outdated ? 'warn' : s.status === 'verified' ? 'ok' : s.status === 'planned' ? 'neutral' : 'accent'}>{outdated ? 'Verification outdated' : STATUS_LABEL[s.status]}</Badge>
        {s.humanApproval && <Badge tone="warn">Human approval</Badge>}
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => onMove(-1)} aria-label={`Move step ${i + 1} up`}>Up</Button>
          <Button size="sm" variant="ghost" disabled={i === n - 1} onClick={() => onMove(1)} aria-label={`Move step ${i + 1} down`}>Down</Button>
          <ConfirmButton label="Remove" confirmLabel="Remove step" onConfirm={onRemove} />
        </span>
      </div>
      <div className="mt-3 grid gap-3">
        <TextInput label="Title" value={s.title} maxLength={120} onChange={(e) => set('title', e.target.value)} data-testid={`step-${i}-title`} />
        <TextArea label="What happens" rows={2} value={s.instruction} maxLength={2000} onChange={(e) => set('instruction', e.target.value)} />
        <TextArea label="Prompt (optional)" rows={2} mono value={s.prompt} maxLength={4000} onChange={(e) => set('prompt', e.target.value)} />
        <TextArea label="Verification gate: what must be true before the next step, and how it is checked" rows={2} value={s.verification} maxLength={1500} onChange={(e) => set('verification', e.target.value)} data-testid={`step-${i}-verification`} />
        <TextArea label="If it fails: retry limit, fallback, or stop and escalate" rows={2} value={s.failureHandling} maxLength={1500} onChange={(e) => set('failureHandling', e.target.value)} data-testid={`step-${i}-failure`} />
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={s.humanApproval} onChange={(e) => set('humanApproval', e.target.checked)} data-testid={`step-${i}-approval`} />A person must decide before this step proceeds</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Status" value={s.status} onChange={(e) => onChange({ ...s, status: e.target.value as StepStatus, verifiedAt: e.target.value === 'verified' ? (s.verifiedAt ?? new Date().toISOString()) : null, verifiedFingerprint: null })} data-testid={`step-${i}-status`}>
            {STEP_STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}
          </SelectField>
          {s.status === 'verified' && <TextArea label="What verified it? (required)" rows={2} value={s.verifiedNote} maxLength={1500} onChange={(e) => set('verifiedNote', e.target.value)} data-testid={`step-${i}-verified-note`} />}
        </div>
        {outdated && (
          <Callout tone="warn" title="This step changed after it was verified" role="status">
            “Verified” described the earlier wording, so it no longer counts. Check the step against its gate again, update what verified it, then re-confirm.
            <div className="mt-2"><Button size="sm" onClick={() => onChange({ ...s, verifiedFingerprint: null, verifiedAt: new Date().toISOString() })} data-testid={`step-${i}-reconfirm`}>Re-confirm verification for the current wording</Button></div>
          </Callout>
        )}
        {evidence}
        <div>
          <p className="mb-1 text-sm font-semibold">Uses</p>
          {s.links.length > 0 && <ul className="mb-2 flex flex-wrap gap-2">{s.links.map((l, k) => <li key={k} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-sm">{l.kind === 'catalog' && l.ref ? <Link className="underline" to={`/discovery/${l.ref}`}>{l.label}</Link> : l.kind === 'skill' && l.ref ? <Link className="underline" to={`/workshop/${l.ref}`}>{l.label}</Link> : l.label}<button type="button" className="ml-1 min-h-8 min-w-8 text-muted hover:text-bad" aria-label={`Remove link ${l.label}`} onClick={() => set('links', s.links.filter((_, j) => j !== k))}>×</button></li>)}</ul>}
          <div className="flex flex-wrap items-end gap-2">
            <SelectField label="Link type" value={linkKind} onChange={(e) => { setLinkKind(e.target.value as 'catalog' | 'skill'); setLinkRef(''); }}><option value="catalog">Catalog entry</option><option value="skill">My Skill</option></SelectField>
            <SelectField label="Item" value={linkRef} onChange={(e) => setLinkRef(e.target.value)}>
              <option value="">Choose…</option>
              {linkKind === 'catalog' ? CATALOG.filter((c) => c.tier !== 'custom').map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>) : skills.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </SelectField>
            <Button size="sm" disabled={!linkRef || s.links.length >= 6} onClick={() => {
              const label = linkKind === 'catalog' ? (CATALOG.find((c) => c.id === linkRef)?.displayName ?? linkRef) : (skills.find((k) => k.id === linkRef)?.name ?? linkRef);
              set('links', [...s.links, { kind: linkKind === 'catalog' ? 'catalog' : 'skill', ref: linkRef, label }]);
              setLinkRef('');
            }}>Add link</Button>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function PlaybookEditor() {
  const { playbookId = '' } = useParams();
  const { data: all } = usePlaybooks();
  const { data: skills } = useSkills();
  const { data: experimentsRaw } = useExperiments();
  const nav = useNavigate();
  const toast = useToast();
  const stored = all?.find((p) => p.id === playbookId);
  const [draft, setDraft] = useState<Playbook | null>(null);
  const [dirty, setDirty] = useState(false);
  const latest = useRef<Playbook | null>(null);
  latest.current = draft;
  const [label, setLabel] = useState('');
  const [result, setResult] = useState<{ outcome: 'worked' | 'partly' | 'failed' | 'unknown'; text: string }>({ outcome: 'unknown', text: '' });

  useEffect(() => { if (stored && !draft) setDraft(stored); }, [stored, draft]);
  // Evidence is written straight to the stored playbook; with no unsaved edits the draft follows it, but only when the
  // stored copy is NEWER than the draft, so the draft never flips back to an older copy while its own save is still settling.
  useEffect(() => { if (stored && draft && !dirty && stored.updatedAt > draft.updatedAt) setDraft(stored); }, [stored, draft, dirty]);
  const problems = useMemo(() => (draft ? playbookProblems(draft) : []), [draft]);
  const check = useMemo(() => (draft ? reliabilityChecklist(draft) : null), [draft]);

  if (!all || !skills || !experimentsRaw) return <Spinner label="Loading the playbook" />;
  if (!stored && !draft) return <EmptyState title="That playbook does not exist" action={<LinkButton to="/playbooks" variant="primary">Back to playbooks</LinkButton>}>It may have been deleted.</EmptyState>;
  if (!draft) return <Spinner />;

  const upd = (patch: Partial<Playbook>) => { setDraft({ ...draft, ...patch }); setDirty(true); };
  const setStep = (i: number, s: Step) => upd({ steps: draft.steps.map((x, j) => (j === i ? s : x)) });
  const move = (i: number, d: -1 | 1) => { const a = [...draft.steps]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j]!, a[i]!]; upd({ steps: a }); };
  const c = counts(draft);
  const experiments: Experiment[] = experimentsRaw;
  // Evidence always reflects the SAVED playbook; the draft only supplies the step wording being edited.
  const saved = stored ?? draft;
  const expMap = new Map(experiments.map((x) => [x.id, x]));
  const maturity = playbookMaturity(saved, expMap);

  const save = async (withRevision?: string) => {
    if (problems.length) return toast(problems[0]!);
    const sent = draft;
    const next = await savePlaybook(sent, withRevision);
    const cur = latest.current;
    if (!cur || cur === sent) { setDraft(next); setDirty(false); } else {
      // The learner kept typing while the save was in flight: keep their newer text, take the stored bookkeeping.
      setDraft({ ...cur, revisions: next.revisions, contentVersion: next.contentVersion, evidenceLinks: next.evidenceLinks, evaluations: next.evaluations, updatedAt: next.updatedAt });
    }
    toast(withRevision ? 'Saved with a version-history entry' : 'Saved');
  };

  return (
    <div data-testid="playbook-editor">
      <PageHeader eyebrow="Playbook" title={draft.title || 'Untitled playbook'} subtitle="A design, not a run. Forge does not execute any step. Mark a step verified only after you have seen it work." actions={<LinkButton to="/playbooks" variant="ghost" size="sm">All playbooks</LinkButton>} />
      <div className="sticky top-14 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
        <Badge>{c.total} steps</Badge><Badge>{c.planned} planned</Badge><Badge tone={c.verified ? 'ok' : 'neutral'}>{c.verified} verified</Badge>
        <Badge tone={maturity.state === 'draft' || maturity.state === 'ready-to-test' ? 'neutral' : 'ok'} title={MATURITY_MEANING[maturity.state]}>{MATURITY_LABEL[maturity.state]}</Badge>
        {dirty && <Badge tone="warn">Unsaved changes</Badge>}
        <span className="ml-auto flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void save()} disabled={!dirty} data-testid="save-playbook">Save</Button>
          <Button icon="download" onClick={() => downloadText(exportPlaybookMarkdown(draft), `${slug(draft.title)}.md`, 'text/markdown')} data-testid="export-playbook-md">Markdown</Button>
          <Button icon="download" onClick={() => downloadText(exportPlaybookJson({ ...draft, evidenceLinks: saved.evidenceLinks, evaluations: saved.evaluations }), `${slug(draft.title)}.json`, 'application/json')} data-testid="export-playbook-json">JSON</Button>
        </span>
      </div>
      {problems.length > 0 && <div className="mb-4"><Callout tone="warn" title="Fix before saving" role="alert">{problems.join(' ')}</Callout></div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card>
            <div className="grid gap-3">
              <TextInput label="Title" value={draft.title} maxLength={120} onChange={(e) => upd({ title: e.target.value })} data-testid="pb-title" />
              <TextArea label="Goal" rows={2} value={draft.goal} maxLength={1000} onChange={(e) => upd({ goal: e.target.value })} data-testid="pb-goal" />
              <LinesField key={`in-${draft.updatedAt}`} label="Inputs (one per line)" hint="What the workflow needs to start, and how it is validated." value={draft.inputs} onChange={(v) => upd({ inputs: v })} testId="pb-inputs" />
              <LinesField key={`out-${draft.updatedAt}`} label="Outputs (one per line)" value={draft.outputs} onChange={(v) => upd({ outputs: v })} testId="pb-outputs" />
              <LinesField key={`pre-${draft.updatedAt}`} label="Prerequisites (one per line)" value={draft.prerequisites} onChange={(v) => upd({ prerequisites: v })} />
              <TextArea label="Completion criteria: how you will know it is finished, in checkable terms" rows={2} value={draft.completionCriteria} maxLength={1500} onChange={(e) => upd({ completionCriteria: e.target.value })} data-testid="pb-completion" />
            </div>
          </Card>
          <section aria-labelledby="steps-h">
            <div className="mb-2 flex items-center gap-2"><h2 id="steps-h" className="text-xl font-semibold">Steps</h2><Button size="sm" icon="plus" className="ml-auto" disabled={draft.steps.length >= 40} onClick={() => upd({ steps: [...draft.steps, blankStep(newId('st'))] })} data-testid="add-step">Add step</Button></div>
            {draft.steps.length === 0 ? <EmptyState title="No steps yet" icon="flag">Add the first step: what happens, and how you will know it worked.</EmptyState> : (
              <ol className="space-y-3">{draft.steps.map((s, i) => {
                const savedStep = saved.steps.find((x) => x.id === s.id);
                return (
                  <StepEditor key={s.id} s={s} i={i} n={draft.steps.length} skills={skills.map((k) => ({ id: k.id, name: k.name }))} onChange={(x) => setStep(i, x)} onMove={(d) => move(i, d)} onRemove={() => upd({ steps: draft.steps.filter((_, j) => j !== i) })}
                    evidence={savedStep ? <StepEvidencePanel playbook={saved} step={savedStep} index={i} experiments={experiments} dirty={dirty} /> : <p className="text-xs text-muted">Save the playbook to link evidence to this new step.</p>} />
                );
              })}</ol>
            )}
          </section>
          <OrphanLinks playbook={saved} />
          <Card>
            <h2 className="text-lg font-semibold">Capabilities</h2>
            <p className="mb-2 text-sm text-muted">Tag the Capability Map areas this playbook exercises.</p>
            <div className="flex flex-wrap gap-2">
              {CAPABILITIES.map((cap) => { const on = draft.capabilityIds.includes(cap.id); return <label key={cap.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${on ? 'border-accent bg-surface2 font-semibold' : 'border-line text-muted'}`}><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={on} onChange={() => upd({ capabilityIds: on ? draft.capabilityIds.filter((x) => x !== cap.id) : [...draft.capabilityIds, cap.id].slice(0, 12) })} />{cap.title}</label>; })}
            </div>
          </Card>
          <Card>
            <TextArea label="Notes" rows={3} value={draft.notes} maxLength={4000} onChange={(e) => upd({ notes: e.target.value })} />
          </Card>
          <Card aria-labelledby="obs-h">
            <h2 id="obs-h" className="text-lg font-semibold">Observed results (your own report)</h2>
            <p className="mb-2 text-sm text-muted">What happened when you used this on real work. Forge records it; it does not verify it.</p>
            {draft.observedResults.length > 0 && <ul className="mb-3 space-y-1 text-sm">{draft.observedResults.map((r) => <li key={r.id}><Badge tone={r.outcome === 'worked' ? 'ok' : r.outcome === 'failed' ? 'bad' : 'neutral'}>{r.outcome}</Badge> <span className="text-muted">{r.at.slice(0, 10)}</span> {r.text}</li>)}</ul>}
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
              <SelectField label="Outcome" value={result.outcome} onChange={(e) => setResult({ ...result, outcome: e.target.value as typeof result.outcome })}><option value="unknown">Unknown</option><option value="worked">Worked</option><option value="partly">Partly</option><option value="failed">Failed</option></SelectField>
              <TextInput label="What happened" value={result.text} maxLength={2000} onChange={(e) => setResult({ ...result, text: e.target.value })} data-testid="result-text" />
              <Button disabled={result.text.trim().length < 5} onClick={() => { upd({ observedResults: [...draft.observedResults, { id: newId('obs'), at: new Date().toISOString(), outcome: result.outcome, text: result.text.trim() }].slice(-50) }); setResult({ outcome: 'unknown', text: '' }); }}>Add</Button>
            </div>
          </Card>
        </div>

        <aside className="space-y-4" aria-label="Playbook checks and history">
          <MaturityCard playbook={saved} experiments={experiments} />
          {check && (
            <Card aria-labelledby="chk-h" data-testid="reliability-checklist">
              <h2 id="chk-h" className="text-lg font-semibold">Reliability checklist</h2>
              <p className="mb-2 text-xs text-muted">The same checks Lesson 15 verifies. They look at structure, not at whether the workflow works.</p>
              <ul className="space-y-1 text-sm">{check.checks.map((k) => <li key={k.label} className="flex gap-2"><span aria-hidden>{k.ok ? '✓' : '○'}</span><span><span className="sr-only">{k.ok ? 'Met: ' : 'Not met: '}</span>{k.label}{!k.ok && <span className="block text-xs text-muted">{k.note}</span>}</span></li>)}</ul>
            </Card>
          )}
          <EvaluationCard playbook={saved} experiments={experiments} dirty={dirty} />
          <Card aria-labelledby="hist-h" data-testid="version-history">
            <h2 id="hist-h" className="text-lg font-semibold">Version history</h2>
            <div className="mt-2 flex gap-2"><TextInput label="Label for this save" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. added approval step" data-testid="revision-label" /></div>
            <div className="mt-2"><Button size="sm" onClick={() => { void save(label.trim() || 'Saved version'); setLabel(''); }} data-testid="save-revision">Save and keep the previous version</Button></div>
            {draft.revisions.length === 0 ? <p className="mt-2 text-sm text-muted">No earlier versions kept yet.</p> : (
              <ul className="mt-3 space-y-2 text-sm">
                {[...draft.revisions].reverse().map((r) => (
                  <li key={r.id} className="rounded-lg border border-line p-2">
                    <p className="font-semibold">{r.label}</p>
                    <p className="text-xs text-muted">{r.savedAt.slice(0, 16).replace('T', ' ')} · {r.snapshot.steps.length} steps</p>
                    <ConfirmButton label="Restore this version" confirmLabel="Restore (current content becomes a version)" icon="clock" onConfirm={async () => {
                      const restored = await savePlaybook({ ...draft, ...r.snapshot, steps: r.snapshot.steps }, `Before restoring "${r.label}"`);
                      setDraft(restored); setDirty(false); toast('Restored');
                    }} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card><ConfirmButton label="Delete this playbook" confirmLabel="Really delete" onConfirm={async () => { const { deletePlaybook } = await import('@/persistence/repo'); await deletePlaybook(draft.id); nav('/playbooks'); }} /></Card>
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, LinkButton, PageHeader, SelectField, Spinner, TextArea, TextInput, useToast } from '@/components/ui';
import { useTransferTasks } from '@/app/hooks';
import { TRANSFER_KIND_LABELS, completionProblems, transferTaskToMarkdown, type TransferTask } from '@/domain/transfer/model';
import { TRANSFER_PROMPTS } from '@/content/transfer/prompts';
import { completeTransferTask, deleteTransferTask, recordPlaybookRealWorldResult, saveTransferTask } from '@/persistence/repo';
import { downloadText } from '@/lib/download';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'transfer-task';
const EDITABLE_STATUS = [{ v: 'planned', l: 'Planned' }, { v: 'in-progress', l: 'In progress' }, { v: 'abandoned', l: 'Abandoned (kept, not completed)' }] as const;

export default function TransferEditor() {
  const { taskId = '' } = useParams();
  const { data: tasks } = useTransferTasks();
  const nav = useNavigate();
  const toast = useToast();
  const stored = tasks?.find((t) => t.id === taskId);
  const [draft, setDraft] = useState<TransferTask | null>(null);
  const [dirty, setDirty] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [ev, setEv] = useState({ text: '', provenance: 'self-reported' as 'self-reported' | 'user-imported' | 'file-note' });
  const [outcome, setOutcome] = useState<'worked' | 'partly' | 'failed'>('partly');
  const [pushed, setPushed] = useState(false);
  const latest = useRef<TransferTask | null>(null);
  latest.current = draft;

  useEffect(() => { if (stored && !draft) setDraft(stored); }, [stored, draft]);
  useEffect(() => { if (stored && draft && !dirty && stored.updatedAt > draft.updatedAt) setDraft(stored); }, [stored, draft, dirty]);

  if (!tasks) return <Spinner label="Loading the task" />;
  if (!stored && !draft) return <EmptyState title="That transfer task does not exist" action={<LinkButton to="/transfer" variant="primary">Back to transfer tasks</LinkButton>}>It may have been deleted.</EmptyState>;
  if (!draft) return <Spinner />;
  const P = TRANSFER_PROMPTS[draft.kind];
  const upd = (patch: Partial<TransferTask>) => { setDraft({ ...draft, ...patch }); setDirty(true); };
  const completed = draft.status === 'completed';
  const missing = completionProblems(draft);

  const save = async () => {
    const sent = draft;
    const next = await saveTransferTask(sent);
    if (!latest.current || latest.current === sent) { setDraft(next); setDirty(false); } else setDraft({ ...latest.current, updatedAt: next.updatedAt });
    toast('Saved');
    return next;
  };

  const complete = async () => {
    if (dirty) await save();
    const r = await completeTransferTask(draft.id);
    if (!r.ok) { setProblems(r.problems); return; }
    setProblems([]);
    toast('Marked complete (your own declaration)');
  };

  const source = draft.source;
  const sourceLink = source.kind === 'lesson' && source.id ? `/academy/lesson/${source.id}` : source.kind === 'playbook' && source.id ? `/playbooks/${source.id}` : source.kind === 'skill' && source.id ? `/workshop/${source.id}` : null;

  return (
    <div data-testid="transfer-editor">
      <PageHeader eyebrow="Real-world transfer" title={draft.title} subtitle={`${TRANSFER_KIND_LABELS[draft.kind]}${source.label ? ` · from ${source.label}` : ''}`} actions={<><LinkButton to={`/library/new?ref=transfer&refId=${encodeURIComponent(draft.id)}&label=${encodeURIComponent(draft.title)}`} variant="secondary" size="sm" data-testid="tt-save-takeaway">Save a takeaway</LinkButton><LinkButton to="/transfer" variant="ghost" size="sm">All transfer tasks</LinkButton></>} />
      <div className="sticky top-14 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
        <Badge tone={completed ? 'ok' : 'neutral'}>{draft.status}</Badge>
        {completed && <Badge tone="teal">self-declared</Badge>}
        {dirty && <Badge tone="warn">Unsaved changes</Badge>}
        <span className="ml-auto flex flex-wrap gap-2">
          <Button variant="primary" disabled={!dirty} onClick={() => void save()} data-testid="tt-save">Save</Button>
          <Button icon="download" onClick={() => downloadText(transferTaskToMarkdown(draft), `${slug(draft.title)}.md`, 'text/markdown')} data-testid="tt-export">Markdown</Button>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card aria-labelledby="plan-h">
            <h2 id="plan-h" className="text-lg font-semibold">1. Plan</h2>
            <p className="mb-3 text-sm text-muted">Write this before you try anything. The grey text shows what to think about; it is not filled in for you.</p>
            <div className="grid gap-3">
              <TextInput label="Title" value={draft.title} maxLength={160} onChange={(e) => upd({ title: e.target.value })} data-testid="tt-f-title" />
              <TextInput label="Target project (name only; Forge never reads it)" value={draft.targetProject} maxLength={200} onChange={(e) => upd({ targetProject: e.target.value })} data-testid="tt-f-target" />
              <TextArea label="The problem" rows={3} value={draft.problem} placeholder={P.problem} maxLength={3000} onChange={(e) => upd({ problem: e.target.value })} data-testid="tt-f-problem" />
              <TextArea label="Your current workflow" rows={3} value={draft.currentWorkflow} placeholder={P.current} maxLength={3000} onChange={(e) => upd({ currentWorkflow: e.target.value })} data-testid="tt-f-current" />
              <TextArea label="The proposed improved workflow" rows={3} value={draft.proposedWorkflow} placeholder={P.proposed} maxLength={3000} onChange={(e) => upd({ proposedWorkflow: e.target.value })} data-testid="tt-f-proposed" />
              <TextArea label="Expected benefit" rows={2} value={draft.expectedBenefit} placeholder={P.benefit} maxLength={2000} onChange={(e) => upd({ expectedBenefit: e.target.value })} data-testid="tt-f-benefit" />
              <TextArea label="Verification criteria: how will you check it worked, in terms someone else could check?" rows={2} value={draft.verificationCriteria} placeholder={P.criteria} maxLength={2000} onChange={(e) => upd({ verificationCriteria: e.target.value })} data-testid="tt-f-criteria" />
              <TextArea label="Risks" rows={2} value={draft.risks} placeholder={P.risks} maxLength={2000} onChange={(e) => upd({ risks: e.target.value })} data-testid="tt-f-risks" />
            </div>
          </Card>

          <Card aria-labelledby="try-h">
            <h2 id="try-h" className="text-lg font-semibold">2. What happened</h2>
            <div className="mt-2 grid gap-3">
              <SelectField label="Where this stands" value={completed ? 'planned' : draft.status} disabled={completed} onChange={(e) => upd({ status: e.target.value as TransferTask['status'] })} hint="“Completed” is set only by the button below, once the record is complete." data-testid="tt-f-status">{EDITABLE_STATUS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</SelectField>
              <TextArea label="Observations: what you actually saw, including what did not work" rows={4} value={draft.observations} placeholder={P.observations} maxLength={6000} onChange={(e) => upd({ observations: e.target.value })} data-testid="tt-f-observations" />
              <div>
                <p className="text-sm font-semibold">Evidence you can point to</p>
                <p className="mb-2 text-xs text-muted">Describe it: a commit hash, a PR, a measurement, a before/after note, an AI Lab experiment. Nothing is uploaded and Forge cannot check it.</p>
                {draft.evidence.length > 0 && <ul className="mb-2 space-y-1 text-sm" data-testid="tt-evidence-list">{draft.evidence.map((e) => <li key={e.id} className="flex flex-wrap items-start gap-2"><Badge>{e.provenance}</Badge><span className="min-w-0 flex-1 break-words">{e.at.slice(0, 10)} · {e.text}</span><button type="button" className="min-h-8 min-w-8 text-muted hover:text-bad" aria-label="Remove this evidence note" onClick={() => upd({ evidence: draft.evidence.filter((x) => x.id !== e.id) })}>×</button></li>)}</ul>}
                <div className="grid gap-2 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
                  <TextInput label="Evidence note" value={ev.text} maxLength={2000} onChange={(e) => setEv({ ...ev, text: e.target.value })} data-testid="tt-ev-text" />
                  <SelectField label="Source" value={ev.provenance} onChange={(e) => setEv({ ...ev, provenance: e.target.value as typeof ev.provenance })}><option value="self-reported">Self-reported</option><option value="user-imported">From a tool or file</option><option value="file-note">A file I keep elsewhere</option></SelectField>
                  <Button disabled={ev.text.trim().length < 5 || draft.evidence.length >= 50} onClick={() => { upd({ evidence: [...draft.evidence, { id: newId('tev'), at: nowIso(), text: ev.text.trim(), provenance: ev.provenance }] }); setEv({ text: '', provenance: 'self-reported' }); }} data-testid="tt-ev-add">Add</Button>
                </div>
              </div>
            </div>
          </Card>

          <Card aria-labelledby="reflect-h">
            <h2 id="reflect-h" className="text-lg font-semibold">3. Reflect</h2>
            <div className="mt-2 grid gap-3">
              <TextArea label="Reflection: what you learned and what you would change" rows={4} value={draft.reflection} maxLength={4000} onChange={(e) => upd({ reflection: e.target.value })} data-testid="tt-f-reflection" />
              <TextArea label="Next improvement" rows={2} value={draft.nextImprovement} maxLength={2000} onChange={(e) => upd({ nextImprovement: e.target.value })} data-testid="tt-f-next" />
            </div>
          </Card>
        </div>

        <aside className="space-y-4" aria-label="Completion and links">
          <Card aria-labelledby="done-h" data-testid="tt-completion">
            <h2 id="done-h" className="text-lg font-semibold">Completion</h2>
            {completed ? (
              <p className="mt-1 text-sm">Marked complete on {draft.completedAt?.slice(0, 10)}. That is your own declaration; Forge did not verify it.</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">Complete needs all of these, in your words. A plan alone is not enough.</p>
                <ul className="mt-2 space-y-1 text-sm">{[
                  ['Verification criteria written', draft.verificationCriteria.trim().length >= 15],
                  ['Observations recorded', draft.observations.trim().length >= 30],
                  ['At least one evidence note', draft.evidence.length >= 1],
                  ['A reflection written', draft.reflection.trim().length >= 30],
                ].map(([label, ok]) => <li key={String(label)} className="flex gap-2"><span aria-hidden>{ok ? '✓' : '○'}</span><span><span className="sr-only">{ok ? 'Met: ' : 'Not met: '}</span>{label}</span></li>)}</ul>
                <Button className="mt-3" variant="primary" disabled={missing.length > 0 || draft.status === 'abandoned'} onClick={() => void complete()} data-testid="tt-complete">Mark complete</Button>
                {problems.length > 0 && <div className="mt-2"><Callout tone="warn" role="alert" title="Not complete yet"><ul className="list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Callout></div>}
              </>
            )}
            <p className="mt-3 text-xs text-muted">Completing a task does not change any competency level. Level 4 comes from field evidence you log in Growth.</p>
          </Card>
          {sourceLink && <Card><h2 className="text-lg font-semibold">Comes from</h2><p className="mt-1 text-sm"><Link className="underline underline-offset-2" to={sourceLink}>{source.label || source.kind}</Link></p></Card>}
          {source.kind === 'playbook' && source.id && completed && (
            <Card aria-labelledby="pbres-h" data-testid="tt-playbook-result">
              <h2 id="pbres-h" className="text-lg font-semibold">Record on the playbook</h2>
              <p className="mt-1 text-sm text-muted">Adds your observations to the playbook as a self-reported real-work result. It does not verify any step and does not replace fixture evidence.</p>
              <div className="mt-2"><SelectField label="How did it go?" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}><option value="worked">Worked</option><option value="partly">Partly</option><option value="failed">Failed</option></SelectField></div>
              <Button className="mt-2" size="sm" disabled={pushed} onClick={async () => { const r = await recordPlaybookRealWorldResult(source.id!, outcome, `Transfer task "${draft.title}": ${draft.observations}`); if (r.ok) setPushed(true); toast(r.ok ? 'Recorded on the playbook' : r.reason); }} data-testid="tt-push-result">{pushed ? 'Recorded' : 'Record as a real-work result'}</Button>
            </Card>
          )}
          <Card><ConfirmButton label="Delete this task" confirmLabel="Really delete" onConfirm={async () => { await deleteTransferTask(draft.id); nav('/transfer'); }} /></Card>
        </aside>
      </div>
    </div>
  );
}

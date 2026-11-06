import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, LinkButton, PageHeader, SelectField, Spinner, TextArea, TextInput, useToast } from '@/components/ui';
import { useTakeaways } from '@/app/hooks';
import { CONFIDENCE_LABELS, CONFIDENCE_LEVELS, CONFIDENCE_MEANING, REFERENCE_KINDS, REFERENCE_LABELS, emptyTakeaway, referenceHref, type Confidence, type ReferenceKind, type Takeaway } from '@/domain/library/model';
import { deleteTakeaway, saveTakeaway } from '@/persistence/repo';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';
import { useReferenceTargets } from './refs';

export default function TakeawayEditor() {
  const { takeawayId } = useParams();
  const { data: items } = useTakeaways();
  const targets = useReferenceTargets();
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<Takeaway | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [refKind, setRefKind] = useState<ReferenceKind>((params.get('ref') as ReferenceKind | null) ?? 'lab-report');
  const [refId, setRefId] = useState(params.get('refId') ?? '');
  const isNew = takeawayId === 'new';

  useEffect(() => {
    if (draft || !items) return;
    if (isNew) {
      const base = emptyTakeaway(newId('tk'), nowIso());
      const k = params.get('ref') as ReferenceKind | null;
      const id = params.get('refId');
      const label = params.get('label') ?? '';
      setDraft(k && id && (REFERENCE_KINDS as readonly string[]).includes(k) ? { ...base, references: [{ kind: k, id, label }] } : base);
    } else {
      const found = items.find((t) => t.id === takeawayId);
      if (found) setDraft(found);
    }
  }, [draft, items, isNew, takeawayId, params]);

  if (!items || !targets) return <Spinner label="Loading" />;
  if (!draft) return <EmptyState title="No such takeaway" action={<LinkButton to="/library">My library</LinkButton>}>It may have been deleted.</EmptyState>;
  const set = (patch: Partial<Takeaway>) => setDraft({ ...draft, ...patch });
  const options = targets[refKind];
  const addRef = () => {
    const o = options.find((x) => x.id === refId);
    if (!o || draft.references.some((r) => r.kind === refKind && r.id === o.id)) return;
    set({ references: [...draft.references, { kind: refKind, id: o.id, label: o.label }] });
  };
  const exists = (kind: ReferenceKind, id: string) => targets[kind].some((o) => o.id === id);

  const save = async () => {
    const res = await saveTakeaway({ ...draft, title: draft.title.trim(), statement: draft.statement.trim() });
    if (!res.ok) { setProblems(res.problems); return; }
    setProblems([]);
    setDraft(res.takeaway);
    toast('Takeaway saved');
    if (isNew) nav(`/library/${res.takeaway.id}`, { replace: true });
  };

  return (
    <div data-testid="takeaway-editor">
      <PageHeader eyebrow="My AI library" title={isNew ? 'New takeaway' : draft.title || 'Takeaway'} actions={<LinkButton to="/library" variant="secondary" size="sm">My library</LinkButton>} />
      <div className="space-y-4">
        <Card aria-labelledby="tk-what">
          <h2 id="tk-what" className="text-lg font-semibold">The takeaway</h2>
          <div className="mt-2 space-y-3">
            <TextInput label="Title" value={draft.title} maxLength={160} onChange={(e) => set({ title: e.target.value })} data-testid="tk-title" />
            <TextArea label="What you learned" hint="One or two sentences you would tell a colleague." rows={3} value={draft.statement} maxLength={1500} onChange={(e) => set({ statement: e.target.value })} data-testid="tk-statement" />
            <TextInput label="Tags" hint="Comma separated, optional." value={draft.tags.join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12) })} data-testid="tk-tags" />
          </div>
        </Card>

        <Card aria-labelledby="tk-conf">
          <h2 id="tk-conf" className="text-lg font-semibold">How far does the evidence go?</h2>
          <p className="text-sm text-muted">Forge never changes this for you. It starts as a hypothesis. You raise it, and Forge checks that the references below can support the new level.</p>
          <div className="mt-3 max-w-md"><SelectField label="Confidence" value={draft.confidence} onChange={(e) => set({ confidence: e.target.value as Confidence })} data-testid="tk-confidence">{CONFIDENCE_LEVELS.map((l) => <option key={l} value={l}>{CONFIDENCE_LABELS[l]}</option>)}</SelectField></div>
          <p className="mt-1 text-sm text-muted">{CONFIDENCE_MEANING[draft.confidence]}</p>
          <div className="mt-3"><TextArea label="Why this level" hint="Required above Hypothesis. In your own words." rows={2} value={draft.confidenceNote} maxLength={600} onChange={(e) => set({ confidenceNote: e.target.value })} data-testid="tk-note" /></div>
        </Card>

        <Card aria-labelledby="tk-refs">
          <h2 id="tk-refs" className="text-lg font-semibold">References</h2>
          <p className="text-sm text-muted">Link to what the takeaway came from. Evaluated on fixtures needs a Lab report or a challenge you have run; Applied to real work needs a completed transfer task.</p>
          {draft.references.length === 0 ? <p className="mt-2 text-sm text-muted" data-testid="tk-no-refs">No references yet.</p> : (
            <ul className="mt-2 space-y-1 text-sm" data-testid="tk-refs-list">
              {draft.references.map((r) => (
                <li key={`${r.kind}-${r.id}`} className="flex flex-wrap items-center gap-2">
                  <Badge>{REFERENCE_LABELS[r.kind]}</Badge>
                  {exists(r.kind, r.id) ? <Link className="text-accent-text underline" to={referenceHref(r)}>{r.label || r.id}</Link> : <span>{r.label || r.id} <span className="text-muted">(no longer on this device)</span></span>}
                  <Button size="sm" variant="ghost" onClick={() => set({ references: draft.references.filter((x) => !(x.kind === r.kind && x.id === r.id)) })} aria-label={`Remove reference ${r.label || r.id}`}>Remove</Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 grid items-end gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <SelectField label="Kind" value={refKind} onChange={(e) => { setRefKind(e.target.value as ReferenceKind); setRefId(''); }} data-testid="ref-kind">{REFERENCE_KINDS.map((k) => <option key={k} value={k}>{REFERENCE_LABELS[k]}</option>)}</SelectField>
            <SelectField label="Which one" value={refId} onChange={(e) => setRefId(e.target.value)} data-testid="ref-id"><option value="">{options.length ? 'Choose…' : 'None on this device yet'}</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</SelectField>
            <Button onClick={addRef} disabled={!refId} data-testid="ref-add">Add reference</Button>
          </div>
        </Card>

        {problems.length > 0 && <Callout tone="warn" title="Not saved yet" role="alert"><ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Callout>}
        {!isNew && draft.history.length > 1 && (
          <Card aria-labelledby="tk-hist"><h2 id="tk-hist" className="text-lg font-semibold">Confidence history</h2><ol className="mt-2 space-y-1 text-sm" data-testid="tk-history">{draft.history.map((h, i) => <li key={`${h.at}-${i}`}>{new Date(h.at).toLocaleDateString()}: {h.from ? `${CONFIDENCE_LABELS[h.from]} → ` : ''}{CONFIDENCE_LABELS[h.to]}{h.note ? ` (${h.note})` : ''}</li>)}</ol></Card>
        )}
        <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={save} disabled={!draft.title.trim() || !draft.statement.trim()} data-testid="tk-save">Save takeaway</Button>{!isNew && <ConfirmButton label="Delete" confirmLabel="Really delete" onConfirm={async () => { await deleteTakeaway(draft.id); toast('Takeaway deleted'); nav('/library'); }} />}</div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Badge, Button, Callout, Card, ConfirmButton, Icon, SelectField, TextArea, useToast } from '@/components/ui';
import { getDb } from '@/persistence/db';
import { patchArsenal, removeFromArsenal, saveAnnotation, setArsenalStatus } from '@/persistence/repo';
import { ARSENAL_STATUSES, type ArsenalStatus } from '@/persistence/schemas';
import { useLive } from '@/persistence/useLive';
import { nowIso } from '@/lib/clock';

export const STATUS_HELP: Record<ArsenalStatus, string> = {
  interested: 'I want to look at this.',
  evaluating: 'I am reading, inspecting or testing it.',
  using: 'It is part of my regular work.',
  practicing: 'I am deliberately practicing its workflow.',
  mastered: 'I can use, test and explain it - and I have evidence.',
  rejected: 'I decided no. Record why.',
  archived: 'Not relevant right now.',
};

/** "Mastered" is earned by evidence, not by clicking: it needs a rating and at least one linked experiment. */
export function masteryGate(rec: { observedUsefulness: number | null; experimentIds: string[] }): string[] {
  const missing: string[] = [];
  if (rec.observedUsefulness === null) missing.push('record your observed usefulness (1-5)');
  if (rec.experimentIds.length === 0) missing.push('link at least one AI Lab experiment');
  return missing;
}

export function AdoptionPanel({ entryId, heading = 'Your adoption', local = false }: { entryId: string; heading?: string; local?: boolean }) {
  const toast = useToast();
  const { data } = useLive(async () => {
    const db = getDb();
    const [rec, note, experiments] = await Promise.all([db.arsenal.get(entryId), db.annotations.get(entryId), db.experiments.toArray()]);
    return { rec, note, experiments };
  }, [entryId]);
  const [notes, setNotes] = useState('');
  const [concerns, setConcerns] = useState('');
  const [reason, setReason] = useState('');
  const [next, setNext] = useState('');
  const [loadedFor, setLoadedFor] = useState('');
  const [gateMsg, setGateMsg] = useState<string[]>([]);
  // Optimistic overrides so controls respond instantly; cleared when the saved record catches up.
  const [opt, setOpt] = useState<Partial<Record<string, unknown>>>({});
  useEffect(() => { setOpt({}); }, [data?.rec?.updatedAt, entryId]);

  useEffect(() => {
    if (data && loadedFor !== entryId) {
      setNotes(data.note?.notes ?? '');
      setConcerns(data.rec?.securityConcerns ?? '');
      setReason(data.rec?.rejectionReason ?? '');
      setNext(data.rec?.nextPractice ?? '');
      setLoadedFor(entryId);
    }
  }, [data, entryId, loadedFor]);

  if (!data) return null;
  const { experiments } = data;
  const rec = data.rec ? ({ ...data.rec, ...opt } as NonNullable<typeof data.rec>) : data.rec;
  const patch = async (p: Parameters<typeof patchArsenal>[1]) => { setOpt((o) => ({ ...o, ...p })); await patchArsenal(entryId, p); };

  const changeStatus = async (s: ArsenalStatus) => {
    if (s === 'mastered') {
      const missing = masteryGate(rec ?? { observedUsefulness: null, experimentIds: [] });
      if (missing.length) { setGateMsg(missing); return; }
    }
    setGateMsg([]);
    setOpt((o) => ({ ...o, status: s }));
    await setArsenalStatus(entryId, s);
    toast(`Arsenal: ${s}`);
  };

  return (
    <Card aria-labelledby={`adopt-${entryId}`} data-testid="adoption-panel">
      <h2 id={`adopt-${entryId}`} className="text-lg font-semibold">{heading}</h2>
      <p className="mt-1 text-xs text-muted">{local ? 'Everything here is a local, personal record.' : 'These are YOUR records, kept separate from the verified catalog facts above. They stay on this device.'}</p>

      {!rec ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted">Not in your Arsenal yet.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon="plus" onClick={() => void changeStatus('interested')} data-testid="add-interested">Add to Arsenal as Interested</Button>
            <Button onClick={() => void changeStatus('evaluating')} data-testid="add-evaluating">Start evaluating</Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <SelectField label="Status" value={rec.status} onChange={(e) => void changeStatus(e.target.value as ArsenalStatus)} hint={STATUS_HELP[rec.status]} data-testid="arsenal-status">
            {ARSENAL_STATUSES.map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
          </SelectField>
          {gateMsg.length > 0 && <Callout tone="warn" title="Not yet: Mastered needs evidence" role="alert">To mark this Mastered, first {gateMsg.join(' and ')}. Marking something as used never earns mastery.</Callout>}

          <fieldset className="space-y-2 rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-semibold">Trust steps - three separate facts, all declared by you</legend>
            {([
              ['inspected', 'Inspected', 'I read the source (SKILL.md and every script, as text).'],
              ['approved', 'Approved', 'I decided it is acceptable for a stated purpose and scope.'],
              ['declaredInstalled', 'Installed (declared)', 'I put it on a machine. Claude Forge cannot see your machine and does not verify this.'],
            ] as const).map(([key, label, help]) => (
              <label key={key} className="flex min-h-11 cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={rec[key]} onChange={async (e) => { await patch({ [key]: e.target.checked, ...(key === 'inspected' && e.target.checked ? { lastEvaluatedAt: nowIso() } : {}) }); }} />
                <span className="text-sm"><span className="font-semibold">{label}</span><span className="block text-muted">{help}</span></span>
              </label>
            ))}
            {rec.declaredInstalled && <p className="text-xs text-muted"><Icon name="info" size={14} className="mr-1 inline" />&ldquo;Installed&rdquo; is your statement, not a verified fact.</p>}
          </fieldset>

          <SelectField label="Observed usefulness (from your own use)" value={rec.observedUsefulness === null ? '' : String(rec.observedUsefulness)} onChange={(e) => void patch({ observedUsefulness: e.target.value ? Number(e.target.value) : null, lastEvaluatedAt: nowIso() })}>
            <option value="">Not rated</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} - {['not useful', 'marginal', 'sometimes useful', 'useful', 'clearly valuable'][n - 1]}</option>)}
          </SelectField>

          <fieldset className="rounded-lg border border-line p-3">
            <legend className="px-1 text-sm font-semibold">Linked experiments</legend>
            {experiments.length === 0 ? <p className="text-sm text-muted">No experiments yet. Create one in the AI Lab to back up your rating.</p> : (
              <ul className="space-y-1">{experiments.map((x) => (
                <li key={x.id}><label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={rec.experimentIds.includes(x.id)} onChange={(e) => void patch({ experimentIds: e.target.checked ? [...rec.experimentIds, x.id] : rec.experimentIds.filter((i) => i !== x.id) })} />{x.title}{x.synthetic && <Badge tone="warn">synthetic</Badge>}</label></li>
              ))}</ul>
            )}
          </fieldset>

          {rec.status === 'rejected' && (
            <TextArea label="Rejection reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} onBlur={() => void patchArsenal(entryId, { rejectionReason: reason })} hint="What did you find? Future you will want to know." data-testid="rejection-reason" />
          )}
          <TextArea label="Security concerns you found" rows={2} value={concerns} onChange={(e) => setConcerns(e.target.value)} onBlur={() => void patchArsenal(entryId, { securityConcerns: concerns })} />
          <TextArea label="Recommended next practice" rows={2} value={next} onChange={(e) => setNext(e.target.value)} onBlur={() => void patchArsenal(entryId, { nextPractice: next })} hint="One concrete thing to try next." />
          <p className="text-xs text-muted">History: {rec.history.map((h) => `${h.to} (${h.at.slice(0, 10)})`).join(' → ')}</p>
          <ConfirmButton label="Remove from Arsenal" confirmLabel="Yes, remove" onConfirm={async () => { await removeFromArsenal(entryId); toast('Removed from Arsenal'); }} />
        </div>
      )}

      <div className="mt-4 space-y-3 border-t border-line pt-3">
        <SelectField label="Relevance to YOUR project (your judgement, 0-3)" value={data.note?.personalRelevance === null || data.note?.personalRelevance === undefined ? '' : String(data.note.personalRelevance)} onChange={async (e) => { await saveAnnotation(entryId, { personalRelevance: e.target.value === '' ? null : Number(e.target.value) }); toast('Relevance saved'); }} hint="Separate from the catalog's own game-development rating." data-testid="personal-relevance">
          <option value="">Not rated</option><option value="0">0 - not relevant</option><option value="1">1 - marginal</option><option value="2">2 - useful</option><option value="3">3 - central to my project</option>
        </SelectField>
        <TextArea label="Personal notes (local; not part of the verified facts)" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={async () => { if (notes !== (data.note?.notes ?? '')) { await saveAnnotation(entryId, { notes }); toast('Notes saved'); } }} data-testid="personal-notes" />
      </div>
    </Card>
  );
}

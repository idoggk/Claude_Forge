import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, SelectField, useToast } from '@/components/ui';
import { usePlaybooks } from '@/app/hooks';
import { linkExperimentToStep } from '@/persistence/repo';
import { STEP_EVIDENCE_LABEL, linkCurrency } from '@/domain/playbook/evidence';
import type { Experiment } from '@/domain/experiments/model';

/** Lab-side view of the same links the Playbook editor shows: which playbook steps cite this experiment, and attach it to another. */
export function PlaybookLinksCard({ exp, seededTotal }: { exp: Experiment; seededTotal: number | null }) {
  const { data: playbooks } = usePlaybooks();
  const toast = useToast();
  const [pbId, setPbId] = useState('');
  const [stepId, setStepId] = useState('');
  if (!playbooks) return null;
  const mine = playbooks.flatMap((p) => p.evidenceLinks.filter((l) => l.experimentId === exp.id).map((l) => ({ p, l, step: p.steps.find((s) => s.id === l.stepId) })));
  const target = playbooks.find((p) => p.id === pbId);
  return (
    <Card aria-labelledby="pl-links-h" data-testid="playbook-links-card">
      <h2 id="pl-links-h" className="font-semibold">Playbook steps using this experiment</h2>
      {mine.length === 0 ? <p className="mt-1 text-sm text-muted">Not linked to any playbook step yet.</p> : (
        <ul className="mt-2 space-y-2 text-sm">
          {mine.map(({ p, l, step }) => {
            const cur = linkCurrency(l, step, exp);
            return (
              <li key={l.id} className="rounded-lg border border-line p-2">
                <Link className="font-semibold underline underline-offset-2" to={`/playbooks/${p.id}`}>{p.title}</Link>
                <span className="block text-muted">Step: {step?.title ?? '(removed)'}</span>
                <span className="mt-1 flex flex-wrap gap-2"><Badge tone={cur === 'current' ? 'ok' : 'warn'}>{cur === 'current' ? 'Current' : 'Stale: reassess in the playbook'}</Badge><Badge>{l.status === 'unreviewed' ? 'Not judged' : `Judged: ${l.status}`}</Badge></span>
              </li>
            );
          })}
        </ul>
      )}
      {playbooks.length > 0 && (
        <div className="mt-3 grid gap-2">
          <SelectField label="Attach to a playbook" value={pbId} onChange={(e) => { setPbId(e.target.value); setStepId(''); }} data-testid="attach-playbook"><option value="">Choose…</option>{playbooks.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</SelectField>
          {target && <SelectField label="Step" value={stepId} onChange={(e) => setStepId(e.target.value)} data-testid="attach-step"><option value="">Choose…</option>{target.steps.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.title}</option>)}</SelectField>}
          <div><Button size="sm" disabled={!pbId || !stepId} onClick={async () => { const r = await linkExperimentToStep(pbId, stepId, exp.id, seededTotal); toast(r.ok ? 'Attached. Open the playbook to write criteria and judge it.' : r.reason); if (r.ok) setStepId(''); }} data-testid="attach-btn">Attach as evidence</Button></div>
          <p className="text-xs text-muted">Attaching does not verify anything. {STEP_EVIDENCE_LABEL.unreviewed}: you judge it in the playbook, against criteria you write.</p>
        </div>
      )}
    </Card>
  );
}

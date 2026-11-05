import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, LinkButton, SelectField, TextArea, useToast } from '@/components/ui';
import type { Experiment } from '@/domain/experiments/model';
import type { EvidenceLink, Playbook, Step } from '@/domain/playbook/model';
import {
  CURRENCY_LABEL,
  MATURITY_LABEL,
  MATURITY_MEANING,
  STEP_EVIDENCE_LABEL,
  buildEvaluation,
  linkCurrency,
  playbookMaturity,
  stepEvidence,
  suitability,
  type StepEvidenceState,
} from '@/domain/playbook/evidence';
import { deleteEvaluation, linkExperimentToStep, reassessEvidenceLink, reviewEvidenceLink, saveEvaluation, unlinkEvidence } from '@/persistence/repo';
import { getFixture } from '@/fixtures';
import { downloadText } from '@/lib/download';

const seededTotalOf = (e: Experiment | undefined) => (e ? getFixture(e.fixture.id)?.checklist.length || null : null);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'playbook';

const CLAIMED: { value: EvidenceLink['claimedOutcome']; label: string }[] = [
  { value: 'inconclusive', label: 'Inconclusive' },
  { value: 'met', label: 'The step met its gate' },
  { value: 'partly-met', label: 'Partly met' },
  { value: 'not-met', label: 'Did not meet its gate' },
];
const STATUSES: { value: EvidenceLink['status']; label: string }[] = [
  { value: 'unreviewed', label: 'Not judged yet' },
  { value: 'supports', label: 'Supports the step' },
  { value: 'partially-supports', label: 'Partly supports the step' },
  { value: 'contradicts', label: 'Contradicts the step' },
  { value: 'inconclusive', label: 'Inconclusive' },
];

export const EVIDENCE_TONE: Record<StepEvidenceState, 'neutral' | 'warn' | 'bad' | 'ok' | 'accent'> = {
  'no-evidence': 'neutral',
  unreviewed: 'accent',
  'needs-reassessment': 'warn',
  inconclusive: 'neutral',
  contradicted: 'bad',
  'partly-supported': 'accent',
  supported: 'ok',
};

function Figures({ link }: { link: EvidenceLink }) {
  const ms = link.snapshot.measures.filter((m) => m.perCondition.some((p) => p.n > 0 || p.unknown > 0));
  if (ms.length === 0) return <p className="text-xs text-muted">No measured values were recorded in the linked experiment when it was linked.</p>;
  return (
    <ul className="space-y-0.5 text-xs text-muted" aria-label="Descriptive figures at the time of linking">
      {ms.map((m) => (
        <li key={m.id}>
          <span className="font-semibold text-fg">{m.label}:</span>{' '}
          {m.perCondition.map((p) => (p.mean === null ? `${p.label} unknown${p.unknown ? ` (${p.unknown} missing)` : ''}` : `${p.label} mean ${Number(p.mean.toFixed(2))} [${p.min} to ${p.max}], n=${p.n}${p.unknown ? `, ${p.unknown} missing` : ''}`)).join(' · ')}
        </li>
      ))}
    </ul>
  );
}

function LinkCard({ link, pb, step, experiment, disabled }: { link: EvidenceLink; pb: Playbook; step: Step | undefined; experiment: Experiment | undefined; disabled: boolean }) {
  const toast = useToast();
  const currency = linkCurrency(link, step, experiment);
  const current = currency === 'current';
  const checks = suitability(link);
  const [criteria, setCriteria] = useState(link.criteria);
  const [claimed, setClaimed] = useState(link.claimedOutcome);
  const [status, setStatus] = useState(link.status);
  const [note, setNote] = useState(link.reviewerNote);
  const [lims, setLims] = useState(link.limitations);
  // A reassessment or an outside change replaces the stored review: show it instead of stale form text.
  useEffect(() => { setCriteria(link.criteria); setClaimed(link.claimedOutcome); setStatus(link.status); setNote(link.reviewerNote); setLims(link.limitations); }, [link.id, link.reviewedAt, link.linkedAt, link.criteria, link.claimedOutcome, link.status, link.reviewerNote, link.limitations]);
  const dirtyForm = criteria !== link.criteria || claimed !== link.claimedOutcome || status !== link.status || note !== link.reviewerNote || lims !== link.limitations;

  const save = async () => {
    const r = await reviewEvidenceLink(pb.id, link.id, { criteria, claimedOutcome: claimed, status, reviewerNote: note, limitations: lims });
    toast(r.ok ? 'Review saved' : r.reason);
  };

  return (
    <li className="rounded-lg border border-line p-3" data-testid={`evlink-${link.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        {experiment ? <Link className="font-semibold underline underline-offset-2" to={`/battle-lab/${experiment.id}`}>{link.snapshot.experimentTitle}</Link> : <span className="font-semibold">{link.snapshot.experimentTitle}</span>}
        <Badge tone={current ? 'ok' : 'warn'} title={CURRENCY_LABEL[currency]}>{current ? 'Current' : 'Stale'}</Badge>
        <Badge>{link.provenance === 'user-imported' ? 'Imported' : link.provenance === 'self-reported' ? 'Self-reported' : link.provenance === 'mixed' ? 'Mixed provenance' : 'No values yet'}</Badge>
        <Badge title="How much the runs can support a comparison, not whether the result is true">{link.snapshot.sufficiency === 'limited' ? 'Limited sample' : link.snapshot.sufficiency === 'weak' ? 'Weak sample' : link.snapshot.sufficiency === 'anecdotal' ? 'Anecdotal' : 'No data'}</Badge>
        {link.snapshot.synthetic && <Badge tone="bad">Synthetic demo</Badge>}
        <span className="ml-auto" />
        <ConfirmButton label="Unlink" confirmLabel="Remove this link" icon="trash" onConfirm={async () => { const r = await unlinkEvidence(pb.id, link.id); toast(r.ok ? 'Unlinked' : r.reason); }} />
      </div>
      <p className="mt-1 text-xs text-muted">Linked {link.linkedAt.slice(0, 10)} at playbook version {link.playbookContentVersion} · fixture: {link.snapshot.fixture.label || 'unknown'}{link.snapshot.fixture.hash ? ` (hash ${link.snapshot.fixture.hash.slice(0, 10)}…)` : ' (no fixture hash recorded)'}</p>

      {!current && (
        <div className="mt-2">
          <Callout tone="warn" title="This evidence is stale and is not counted" role="status">
            {CURRENCY_LABEL[currency]}. A judgement about the old version cannot silently apply to the new one.
            {(currency === 'step-changed' || currency === 'experiment-changed') && <> Reassessing takes a fresh snapshot, keeps your earlier judgement in history and asks you to judge the current evidence again.</>}
            {(currency === 'step-changed' || currency === 'experiment-changed') && (
              <div className="mt-2"><Button size="sm" variant="primary" disabled={disabled} onClick={async () => { const r = await reassessEvidenceLink(pb.id, link.id, seededTotalOf(experiment)); toast(r.ok ? 'Reassessed: judge the current evidence' : r.reason); }} data-testid={`reassess-${link.id}`}>Reassess against the current step and experiment</Button></div>
            )}
          </Callout>
        </div>
      )}

      <div className="mt-2"><Figures link={link} /></div>

      <details className="mt-2" open={current && link.status === 'unreviewed'}>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Is this evidence suitable? ({checks.filter((c) => c.ok).length} of {checks.length})</summary>
        <ul className="space-y-1 text-sm" data-testid={`suit-${link.id}`}>{checks.map((c) => <li key={c.id} className="flex gap-2"><span aria-hidden>{c.ok ? '✓' : '○'}</span><span><span className="sr-only">{c.ok ? 'Met: ' : 'Not met: '}</span>{c.label}{!c.ok && <span className="block text-xs text-muted">{c.note}</span>}</span></li>)}</ul>
        <p className="mt-1 text-xs text-muted">A step counts as supported only when every item is met and your judgement is “Supports”.</p>
      </details>

      {current ? (
        <form className="mt-3 grid gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }} aria-label="Your review of this evidence">
          <TextArea label="Acceptance criteria: what would have to be true for this evidence to meet the step’s gate? Write this before judging." rows={2} value={criteria} maxLength={1500} disabled={disabled} onChange={(e) => setCriteria(e.target.value)} data-testid={`criteria-${link.id}`} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Did the step meet its gate (your claim)?" value={claimed} disabled={disabled} onChange={(e) => setClaimed(e.target.value as EvidenceLink['claimedOutcome'])} data-testid={`claimed-${link.id}`}>{CLAIMED.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
            <SelectField label="How does the evidence bear on the step?" value={status} disabled={disabled} onChange={(e) => setStatus(e.target.value as EvidenceLink['status'])} data-testid={`status-${link.id}`}>{STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>
          </div>
          <TextArea label="Your note: what you concluded and why" rows={2} value={note} maxLength={2000} disabled={disabled} onChange={(e) => setNote(e.target.value)} data-testid={`note-${link.id}`} />
          <TextArea label="Limitations: what this evidence cannot show" rows={2} value={lims} maxLength={2000} disabled={disabled} onChange={(e) => setLims(e.target.value)} data-testid={`lims-${link.id}`} />
          <div className="flex flex-wrap items-center gap-2"><Button type="submit" variant="primary" size="sm" disabled={disabled || !dirtyForm} data-testid={`save-review-${link.id}`}>Save review</Button>{link.reviewedAt && <span className="text-xs text-muted">Last judged {link.reviewedAt.slice(0, 10)}</span>}</div>
        </form>
      ) : (
        link.reviewedAt && <p className="mt-2 text-sm text-muted">Your earlier judgement ({link.status}) applied to a different version and is not counted.</p>
      )}

      {link.history.length > 0 && (
        <details className="mt-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Earlier judgements ({link.history.length})</summary>
          <ul className="space-y-1 text-sm text-muted">{[...link.history].reverse().map((h, i) => <li key={i}>{h.at.slice(0, 10)}: {h.status}{h.note ? ` - ${h.note}` : ''}</li>)}</ul>
        </details>
      )}
    </li>
  );
}

export function StepEvidencePanel({ playbook, step, index, experiments, dirty }: { playbook: Playbook; step: Step; index: number; experiments: Experiment[]; dirty: boolean }) {
  const toast = useToast();
  const map = useMemo(() => new Map(experiments.map((e) => [e.id, e])), [experiments]);
  const ev = stepEvidence(step, playbook.evidenceLinks, map);
  const mine = playbook.evidenceLinks.filter((l) => l.stepId === step.id);
  const linked = new Set(mine.map((l) => l.experimentId));
  const options = experiments.filter((e) => !linked.has(e.id));
  const [pick, setPick] = useState('');

  return (
    <details className="rounded-lg border border-line p-3" data-testid={`step-${index}-evidence`}>
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 text-sm font-semibold">
        <span>Evidence from the AI Lab</span>
        <Badge tone={EVIDENCE_TONE[ev.state]}>{STEP_EVIDENCE_LABEL[ev.state]}</Badge>
        <span className="text-xs font-normal text-muted">{mine.length} link{mine.length === 1 ? '' : 's'}</span>
      </summary>
      <div className="mt-2 space-y-3">
        <p className="text-sm text-muted">Linking an experiment does not verify the step. The step is supported only when the evidence is current and suitable, you wrote criteria, and you recorded a supporting judgement with a note.</p>
        {dirty && <Callout tone="info" title="Save the playbook first">Evidence is tied to the saved wording of a step, so linking and judging are available once your edits are saved. What you see here reflects the saved version.</Callout>}
        {ev.reasons.length > 0 && ev.state !== 'supported' && <ul className="list-disc pl-5 text-sm text-muted">{ev.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        {mine.length > 0 && <ul className="space-y-3">{mine.map((l) => <LinkCard key={l.id} link={l} pb={playbook} step={step} experiment={map.get(l.experimentId)} disabled={dirty} />)}</ul>}
        <div className="flex flex-wrap items-end gap-2">
          <SelectField label="Link an existing experiment" value={pick} disabled={dirty || options.length === 0} onChange={(e) => setPick(e.target.value)} hint={options.length === 0 ? 'No unlinked experiments yet.' : undefined} data-testid={`link-pick-${index}`}>
            <option value="">Choose…</option>
            {options.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </SelectField>
          <Button size="sm" disabled={dirty || !pick} onClick={async () => { const r = await linkExperimentToStep(playbook.id, step.id, pick, seededTotalOf(map.get(pick))); toast(r.ok ? 'Linked: now write criteria and judge it' : r.reason); if (r.ok) setPick(''); }} data-testid={`link-btn-${index}`}>Link</Button>
          <LinkButton size="sm" to={`/battle-lab?playbook=${encodeURIComponent(playbook.id)}&step=${encodeURIComponent(step.id)}`} aria-disabled={dirty} onClick={(e) => { if (dirty) e.preventDefault(); }} data-testid={`new-exp-${index}`}>Create a new experiment for this step</LinkButton>
        </div>
      </div>
    </details>
  );
}

export function MaturityCard({ playbook, experiments }: { playbook: Playbook; experiments: Experiment[] }) {
  const map = useMemo(() => new Map(experiments.map((e) => [e.id, e])), [experiments]);
  const m = playbookMaturity(playbook, map);
  return (
    <Card aria-labelledby="mat-h" data-testid="maturity-card">
      <h2 id="mat-h" className="text-lg font-semibold">Evidence maturity</h2>
      <p className="mt-1"><Badge tone={m.state === 'draft' ? 'neutral' : m.state === 'ready-to-test' ? 'accent' : m.state === 'partially-evaluated' ? 'accent' : 'ok'}>{MATURITY_LABEL[m.state]}</Badge></p>
      <p className="mt-2 text-sm">{MATURITY_MEANING[m.state]}</p>
      <ul className="mt-2 list-disc pl-5 text-xs text-muted">{m.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      <p className="mt-2 text-xs text-muted">Computed from your evidence, never chosen by hand. “Evaluated on fixtures” is not “works on real work”, and no maturity state changes your competency levels.</p>
    </Card>
  );
}

export function EvaluationCard({ playbook, experiments, dirty }: { playbook: Playbook; experiments: Experiment[]; dirty: boolean }) {
  const toast = useToast();
  const [label, setLabel] = useState('');
  const map = useMemo(() => new Map(experiments.map((e) => [e.id, e])), [experiments]);
  return (
    <Card aria-labelledby="eval-h" data-testid="evaluation-card">
      <h2 id="eval-h" className="text-lg font-semibold">Evaluation summaries</h2>
      <p className="mt-1 text-sm text-muted">A summary freezes what the evidence showed at playbook version {playbook.contentVersion}, with observed results, interpretation, limitations and a next experiment. It never updates itself.</p>
      <div className="mt-3 grid gap-2">
        <label className="grid gap-1 text-sm font-semibold">Label (optional)<input className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-normal" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. after fixing the retry gate" data-testid="eval-label" /></label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" disabled={dirty} onClick={async () => { const r = await saveEvaluation(playbook.id, label); toast(r.ok ? 'Evaluation summary saved' : r.reason); if (r.ok) setLabel(''); }} data-testid="save-evaluation">Save evaluation summary</Button>
          <Button size="sm" icon="download" onClick={() => { const e = buildEvaluation(playbook, map, 'preview', new Date().toISOString(), label); downloadText(e.markdown, `${slug(playbook.title)}-evaluation-preview.md`, 'text/markdown'); }} data-testid="download-current-evaluation">Download current (not saved)</Button>
        </div>
        {dirty && <p className="text-xs text-muted">Save the playbook first so the summary describes the saved steps.</p>}
      </div>
      {playbook.evaluations.length === 0 ? <p className="mt-3 text-sm text-muted">No summaries saved yet.</p> : (
        <ul className="mt-3 space-y-2 text-sm" data-testid="evaluation-list">
          {[...playbook.evaluations].reverse().map((e) => (
            <li key={e.id} className="rounded-lg border border-line p-2">
              <p className="font-semibold">{e.label || 'Evaluation summary'}</p>
              <p className="text-xs text-muted">{e.createdAt.slice(0, 16).replace('T', ' ')} · version {e.playbookContentVersion} · {MATURITY_LABEL[e.maturity]}</p>
              <div className="mt-1 flex flex-wrap gap-2"><Button size="sm" icon="download" onClick={() => downloadText(e.markdown, `${slug(playbook.title)}-evaluation-v${e.playbookContentVersion}.md`, 'text/markdown')}>Markdown</Button><ConfirmButton label="Delete" confirmLabel="Delete summary" onConfirm={() => void deleteEvaluation(playbook.id, e.id)} /></div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Evidence attached to steps that have since been removed: visible so it can be unlinked, never counted. */
export function OrphanLinks({ playbook }: { playbook: Playbook }) {
  const toast = useToast();
  const ids = new Set(playbook.steps.map((s) => s.id));
  const orphans = playbook.evidenceLinks.filter((l) => !ids.has(l.stepId));
  if (orphans.length === 0) return null;
  return (
    <Card aria-labelledby="orph-h">
      <h2 id="orph-h" className="text-lg font-semibold">Evidence for removed steps</h2>
      <p className="mb-2 text-sm text-muted">These links point at steps that no longer exist. They are not counted.</p>
      <ul className="space-y-1 text-sm">{orphans.map((l) => <li key={l.id} className="flex flex-wrap items-center gap-2">{l.snapshot.experimentTitle}<ConfirmButton label="Unlink" confirmLabel="Remove link" onConfirm={async () => { const r = await unlinkEvidence(playbook.id, l.id); toast(r.ok ? 'Unlinked' : r.reason); }} /></li>)}</ul>
    </Card>
  );
}

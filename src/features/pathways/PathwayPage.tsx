import { Link, useParams } from 'react-router-dom';
import { Badge, Callout, Card, EmptyState, LinkButton, PageHeader, Spinner } from '@/components/ui';
import { PATHWAY_BY_ID, STAGE_LABELS } from '@/content/pathways';
import { pathwayProgress, stepHref } from '@/domain/mastery/pathways';
import { usePathwayEvidence } from './usePathwayEvidence';

export default function PathwayPage() {
  const { pathwayId } = useParams();
  const ev = usePathwayEvidence();
  const p = pathwayId ? PATHWAY_BY_ID.get(pathwayId) : undefined;
  if (!p) return <EmptyState title="No such pathway" action={<LinkButton to="/pathways">All pathways</LinkButton>}>That pathway does not exist.</EmptyState>;
  if (!ev) return <Spinner label="Loading" />;
  const pr = pathwayProgress(p, ev);
  return (
    <div data-testid={`pathway-${p.id}`}>
      <PageHeader eyebrow="Pathway" title={p.title} subtitle={p.outcome} actions={<LinkButton to="/pathways" variant="secondary" size="sm">All pathways</LinkButton>} />
      <Callout tone="info" title="How progress is counted">{pr.done} of {pr.total} steps have a matching record on this device. A lesson counts when you have passed it; a challenge when you have saved a run; an experiment when it has a recorded run; a transfer task when you have completed it; the last step when you have saved a takeaway. Opening a page never counts.</Callout>
      <ol className="mt-4 space-y-3" data-testid="pathway-steps">
        {pr.steps.map(({ step, done }, i) => (
          <li key={`${step.stage}-${i}`}>
            <Card aria-labelledby={`st-${i}`} data-testid={`pathway-step-${i}`}>
              <div className="flex flex-wrap items-center gap-2"><Badge tone="accent">{i + 1}. {STAGE_LABELS[step.stage]}</Badge><h2 id={`st-${i}`} className="text-base font-semibold">{step.title}</h2><Badge tone={done ? 'ok' : 'neutral'}>{done ? 'Has a record' : 'No record yet'}</Badge></div>
              <p className="mt-1 text-sm text-muted">{step.why}</p>
              <div className="mt-2"><Link className="text-sm font-semibold text-accent-text underline" to={stepHref(step.target)} data-testid={`pathway-go-${i}`}>Go to this step</Link></div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

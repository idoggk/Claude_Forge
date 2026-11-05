import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, LinkButton, PageHeader, Spinner, useToast } from '@/components/ui';
import { useExperiments } from '@/app/hooks';
import { DEMO_ID } from '@/domain/experiments/demo';
import { deleteExperiment } from '@/persistence/repo';
import { NewExperimentForm } from './NewExperiment';

export default function BattleLabPage() {
  const { data: experiments } = useExperiments();
  const [creating, setCreating] = useState(false);
  const toast = useToast();
  if (!experiments) return <Spinner label="Loading the Battle Lab" />;
  return (
    <div>
      <PageHeader
        eyebrow="Skill Battle Lab"
        title="Compare workflows with evidence"
        subtitle="Manual experiments you run in your own Claude Code and record here. Forge keeps the method honest; it does not run Claude and verifies none of your numbers."
        actions={<><Button variant="primary" icon="plus" onClick={() => setCreating(true)} data-testid="new-experiment">New experiment</Button><LinkButton to={`/battle-lab/${DEMO_ID}`} icon="flask" data-testid="open-demo">Synthetic demo</LinkButton></>}
      />
      <div className="mb-5"><Callout tone="info" title="What this lab will and will not do">It will keep conditions, fixtures, prompts and rubrics fixed, show every value with its provenance, keep missing data as <em>unknown</em>, and say when evidence is too thin. It will not call Claude, generate results, or declare a Skill &ldquo;better&rdquo; from one run.</Callout></div>
      {creating && <NewExperimentForm onCancel={() => setCreating(false)} />}
      {experiments.length === 0 && !creating ? (
        <EmptyState title="No experiments yet" icon="flask" action={<><Button variant="primary" onClick={() => setCreating(true)}>Create your first experiment</Button><LinkButton to={`/battle-lab/${DEMO_ID}`}>See how it works (synthetic)</LinkButton></>}>Start with the merge-cascade fixture: compare Claude with and without a debugging Skill, three runs each.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="experiment-list">
          {experiments.map((e) => (
            <Card as="li" key={e.id} data-testid={`exp-${e.id}`}>
              <div className="flex flex-wrap gap-2"><Badge tone={e.status === 'concluded' ? 'ok' : 'accent'}>{e.status}</Badge><Badge>{e.fixture.label}</Badge>{e.loopId && <Badge tone="teal">Improvement Loop · {e.phase === 'heldout' ? 'held-out' : 'development'}</Badge>}</div>
              <h2 className="mt-1 text-lg font-semibold"><Link className="hover:underline" to={`/battle-lab/${e.id}`}>{e.title}</Link></h2>
              <p className="text-sm text-muted">{e.conditions.map((c) => c.label).join(' vs ')} · {e.runs.length} run(s) recorded · updated {new Date(e.updatedAt).toLocaleDateString()}</p>
              <div className="mt-2 flex flex-wrap gap-2"><LinkButton size="sm" variant="primary" to={`/battle-lab/${e.id}`}>Open</LinkButton>{e.loopId ? <LinkButton size="sm" to={`/loop/${e.loopId}`}>Open the loop</LinkButton> : <ConfirmButton label="Delete" confirmLabel="Delete experiment" onConfirm={async () => { await deleteExperiment(e.id); toast('Experiment deleted'); }} />}</div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, EmptyState, Button, LinkButton, PageHeader, TextInput, cx } from '@/components/ui';
import { CAPABILITIES, OUTCOMES } from '@/content/capability/map';
import { searchCapabilities, statusOf, type CapabilityKind } from '@/domain/capability/model';
import { GoalsPanel } from './GoalsPanel';

export const KIND_LABEL: Record<CapabilityKind, string> = { practice: 'Practice', mechanism: 'Mechanism', integration: 'Integration', framework: 'Framework', evaluation: 'Evaluation', safety: 'Safety', domain: 'Domain' };

function destinations(n: (typeof CAPABILITIES)[number]): string {
  const parts: string[] = [];
  if (n.lessons.length) parts.push(`${n.lessons.length} lesson${n.lessons.length === 1 ? '' : 's'}`);
  if (n.entries.length) parts.push(`${n.entries.length} catalog entr${n.entries.length === 1 ? 'y' : 'ies'}`);
  if (n.playbookTemplates.length) parts.push(`${n.playbookTemplates.length} playbook template${n.playbookTemplates.length === 1 ? '' : 's'}`);
  if (n.labTemplates.length) parts.push(`${n.labTemplates.length} AI Lab template${n.labTemplates.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<string | null>(null);
  const results = useMemo(() => {
    const found = searchCapabilities(CAPABILITIES, query, OUTCOMES);
    return outcome ? found.filter((n) => n.outcomes.includes(outcome)) : found;
  }, [query, outcome]);
  const active = OUTCOMES.find((o) => o.id === outcome);

  return (
    <div>
      <PageHeader
        art="discovery"
        eyebrow="Explore"
        title="AI Capability Map"
        subtitle={`${CAPABILITIES.length} capabilities, organised by what you want to achieve. Each card says when it fits, when it does not, and what it risks - and every card leads to a lesson, a catalog entry or a template. The map is Forge's own guidance; it ranks nothing by popularity.`}
        actions={<><LinkButton to="/discovery" variant="secondary">Discovery Hub</LinkButton><LinkButton to="/academy/opportunity-finder" variant="secondary">Opportunity Finder</LinkButton></>}
      />
      <section aria-labelledby="outcome-h" className="mb-5">
        <h2 id="outcome-h" className="mb-2 text-lg font-semibold">I want to…</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by outcome">
          {OUTCOMES.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={outcome === o.id}
              onClick={() => setOutcome(outcome === o.id ? null : o.id)}
              data-testid={`outcome-${o.id}`}
              className={cx('transition-forge min-h-11 rounded-lg border px-3 text-left text-sm', outcome === o.id ? 'border-accent bg-surface2 font-semibold' : 'border-line text-muted hover:bg-surface2 hover:text-fg')}
            >
              {o.title}
            </button>
          ))}
        </div>
        {active && <p className="mt-2 text-sm text-muted" data-testid="outcome-description">{active.description}</p>}
      </section>
      <Card className="mb-4">
        <TextInput label="Search capabilities by outcome, risk or decision" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. secrets, parallel, benchmark, workflow" data-testid="capability-search" />
      </Card>
      <p className="mb-2 text-sm text-muted" role="status" data-testid="capability-count">{results.length} of {CAPABILITIES.length} capabilities</p>
      {results.length === 0 ? (
        <EmptyState title="No capability matches" icon="search" action={<Button onClick={() => { setQuery(''); setOutcome(null); }}>Clear filters</Button>}>Try fewer words, or pick an outcome above.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="capability-results">
          {results.map((n) => (
            <Card as="li" key={n.id} className="flex flex-col gap-2" data-testid={`capability-${n.id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="teal">{KIND_LABEL[n.kind]}</Badge>
                <Badge tone={statusOf(n) === 'learnable' ? 'ok' : 'neutral'}>{statusOf(n) === 'learnable' ? 'Has lessons' : 'Reference and templates'}</Badge>
              </div>
              <h3 className="text-lg font-semibold"><Link to={`/explore/${n.id}`} className="underline-offset-2 hover:underline">{n.title}</Link></h3>
              <p className="text-sm text-muted">{n.summary}</p>
              <p className="text-sm"><span className="font-semibold">The deciding question: </span>{n.judgment}</p>
              <p className="text-xs text-muted">{destinations(n)}</p>
              <div className="mt-auto pt-1"><LinkButton to={`/explore/${n.id}`} size="sm" data-testid={`open-capability-${n.id}`}>Open</LinkButton></div>
            </Card>
          ))}
        </ul>
      )}
      <div className="mt-8"><GoalsPanel /></div>
    </div>
  );
}

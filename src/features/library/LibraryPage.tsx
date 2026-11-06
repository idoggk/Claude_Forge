import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, LinkButton, PageHeader, Segmented, Spinner } from '@/components/ui';
import { useTakeaways } from '@/app/hooks';
import { CONFIDENCE_LABELS, CONFIDENCE_LEVELS, CONFIDENCE_MEANING, REFERENCE_LABELS, takeawaysJson, takeawaysMarkdown, type Confidence } from '@/domain/library/model';
import { downloadText } from '@/lib/download';
import { nowIso } from '@/lib/clock';

const TONE: Record<Confidence, 'neutral' | 'warn' | 'accent' | 'ok'> = { hypothesis: 'neutral', anecdotal: 'warn', 'evaluated-on-fixtures': 'accent', 'applied-to-real-work': 'ok' };

export default function LibraryPage() {
  const { data: items } = useTakeaways();
  const [filter, setFilter] = useState<'all' | Confidence>('all');
  if (!items) return <Spinner label="Loading your library" />;
  const shown = filter === 'all' ? items : items.filter((t) => t.confidence === filter);
  return (
    <div>
      <PageHeader eyebrow="Keep" title="My AI library" subtitle="What you have learned about working with AI, each takeaway labelled by how far its evidence goes. Labels are raised only by you, and only when the references on the takeaway can support the new level. Everything stays on this device." actions={<LinkButton to="/library/new" variant="primary" icon="plus" data-testid="new-takeaway">New takeaway</LinkButton>} />
      <Card aria-labelledby="lib-levels" className="mb-4">
        <h2 id="lib-levels" className="text-lg font-semibold">What the labels mean</h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">{CONFIDENCE_LEVELS.map((l) => <div key={l}><dt className="font-semibold">{CONFIDENCE_LABELS[l]}</dt><dd className="text-muted">{CONFIDENCE_MEANING[l]}</dd></div>)}</dl>
      </Card>
      {items.length === 0 ? (
        <EmptyState title="No takeaways yet" action={<LinkButton to="/library/new" variant="primary">Write your first takeaway</LinkButton>}>A takeaway is one sentence you would tell a colleague, plus where it came from. Start with a hypothesis; raise it only when you have evidence.</EmptyState>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Segmented label="Show" value={filter} onChange={setFilter} options={[{ value: 'all', label: `All (${items.length})` }, ...CONFIDENCE_LEVELS.map((l) => ({ value: l, label: `${CONFIDENCE_LABELS[l]} (${items.filter((t) => t.confidence === l).length})` }))]} />
            <div className="flex flex-wrap gap-2"><Button size="sm" icon="download" onClick={() => downloadText(takeawaysMarkdown(items), 'my-ai-takeaways.md', 'text/markdown')} data-testid="export-md">Export Markdown</Button><Button size="sm" icon="download" onClick={() => downloadText(takeawaysJson(items, nowIso()), 'my-ai-takeaways.json', 'application/json')} data-testid="export-json">Export JSON</Button></div>
          </div>
          <ul className="space-y-3" data-testid="takeaway-list">
            {shown.map((t) => (
              <li key={t.id}>
                <Card aria-labelledby={`tk-${t.id}`} data-testid={`takeaway-${t.id}`}>
                  <div className="flex flex-wrap items-center gap-2"><h2 id={`tk-${t.id}`} className="text-lg font-semibold">{t.title}</h2><Badge tone={TONE[t.confidence]}>{CONFIDENCE_LABELS[t.confidence]}</Badge></div>
                  <p className="mt-1 text-sm">{t.statement}</p>
                  <p className="mt-2 text-xs text-muted">{t.references.length === 0 ? 'No references yet' : `${t.references.length} reference${t.references.length === 1 ? '' : 's'}: ${[...new Set(t.references.map((r) => REFERENCE_LABELS[r.kind]))].join(', ')}`}</p>
                  <div className="mt-2"><Link className="text-sm font-semibold text-accent-text underline" to={`/library/${t.id}`}>Open and edit</Link></div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

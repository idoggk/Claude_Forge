import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATALOG, CATALOG_SNAPSHOT_DATE } from '@/content/catalog/entries';
import { filterCatalog, EMPTY_FILTERS, type CatalogFilters } from '@/domain/catalog/search';
import { COMPONENT_TYPES, TIERS, TIER_LABELS, freshnessOf, type CatalogEntry, type ComponentType, type Freshness, type Tier } from '@/domain/catalog/schema';
import { Badge, Button, Callout, Card, EmptyState, Icon, LinkButton, PageHeader, SelectField, Spinner, TextInput, cx, useToast } from '@/components/ui';
import { useArsenal } from '@/app/hooks';
import { getDb } from '@/persistence/db';
import { saveAnnotation } from '@/persistence/repo';
import { useLive } from '@/persistence/useLive';
import { newId } from '@/lib/ids';
import { todayKey } from '@/lib/clock';
import { isSafeExternalUrl } from '@/lib/safeUrl';

const TYPE_LABEL: Record<ComponentType, string> = { skill: 'Skill', plugin: 'Plugin', mcp: 'MCP server', agent: 'Agent', hook: 'Hook', marketplace: 'Marketplace', other: 'Other' };
const SEC_LABEL = { 'not-reviewed': 'Not reviewed', 'metadata-only': 'Metadata only', 'content-inspected': 'Content inspected' } as const;
const FRESH_LABEL: Record<Freshness, string> = { fresh: 'Verified ≤30 days ago', aging: 'Verified 31–90 days ago', stale: 'Verified >90 days ago', 'not-applicable': 'No source to verify' };

export function tierTone(t: Tier): 'ok' | 'teal' | 'warn' | 'accent' { return t === 'official' ? 'ok' : t === 'community' ? 'teal' : t === 'candidate' ? 'warn' : 'accent'; }

function Toggle<T extends string>({ label, values, selected, onChange, render }: { label: string; values: readonly T[]; selected: T[]; onChange: (v: T[]) => void; render: (v: T) => string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => {
          const on = selected.includes(v);
          return (
            <label key={v} className={cx('transition-forge flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm', on ? 'border-accent bg-surface2 font-semibold' : 'border-line text-muted hover:bg-surface2')}>
              <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={on} onChange={() => onChange(on ? selected.filter((x) => x !== v) : [...selected, v])} />
              {render(v)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function EntryCard({ e, status }: { e: CatalogEntry; status?: string }) {
  const fresh = freshnessOf(e.verifiedAt, todayKey());
  return (
    <Card as="li" className="flex flex-col gap-2" data-testid={`entry-${e.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tierTone(e.tier)}>{TIER_LABELS[e.tier].label}</Badge>
        {e.componentTypes.map((t) => <Badge key={t}>{TYPE_LABEL[t]}</Badge>)}
        {status && <Badge tone="accent">Arsenal: {status}</Badge>}
      </div>
      <h3 className="text-lg font-semibold"><Link to={`/discovery/${e.id}`} className="underline-offset-2 hover:underline">{e.displayName}</Link></h3>
      <p className="text-sm text-muted">{e.purpose}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>{e.verifiedAt ? `Source read ${e.verifiedAt}` : 'No external source'}{fresh !== 'not-applicable' && ` · ${FRESH_LABEL[fresh]}`}</span>
        <span>Security: {SEC_LABEL[e.security.reviewStatus]}</span>
        <span>Install: {e.install.status === 'verified-from-source' ? 'command quoted from source' : e.install.status === 'unverified' ? 'unverified' : 'n/a'}</span>
        <span>Game relevance {e.relevance.gameDev}/3</span>
      </p>
      <div className="mt-auto pt-1"><LinkButton to={`/discovery/${e.id}`} size="sm" data-testid={`open-entry-${e.id}`}>View details</LinkButton></div>
    </Card>
  );
}

function CandidateForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('skill');
  const [publisher, setPublisher] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card>
      <h3 className="font-semibold">Add a candidate you found</h3>
      <p className="mt-1 text-sm text-muted">Stored locally as an <strong>unverified lead</strong>. Claude Forge does not fetch, read or vouch for it. Your notes stay separate from catalog facts.</p>
      <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setErr('Give it a name.');
        if (url.trim() && !isSafeExternalUrl(url.trim())) return setErr('Use a full https:// link (or leave it blank).');
        setErr(null);
        await saveAnnotation(`user_${newId('c').slice(2, 14)}`, { notes, candidate: { name: name.trim(), url: url.trim(), type, publisher: publisher.trim() } });
        toast('Candidate saved locally');
        onDone();
      }}>
        <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <TextInput label="Source link (https, optional)" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/…" inputMode="url" />
        <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value)}>{COMPONENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</SelectField>
        <TextInput label="Publisher (as you understand it)" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
        <div className="sm:col-span-2"><TextInput label="Why it caught your eye" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        {err && <p role="alert" className="text-sm text-bad sm:col-span-2">{err}</p>}
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" variant="primary">Save candidate</Button><Button variant="ghost" onClick={onDone}>Cancel</Button></div>
      </form>
    </Card>
  );
}

export default function DiscoveryPage() {
  const [f, setF] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [adding, setAdding] = useState(false);
  const { data: arsenal } = useArsenal();
  const { data: candidates } = useLive(() => getDb().annotations.filter((a) => a.candidate !== null).toArray());
  const statuses = useMemo(() => new Map((arsenal ?? []).map((a) => [a.entryId, a.status])), [arsenal]);
  const results = useMemo(() => filterCatalog(CATALOG, f, { today: todayKey(), arsenalStatus: statuses }), [f, statuses]);
  if (!arsenal || !candidates) return <Spinner label="Loading the catalog" />;
  const active = JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div>
      <PageHeader eyebrow="Discovery Hub" title="Curated Skills and integrations" subtitle={`${CATALOG.length} entries, a small deliberately-checked set - not a crawl. Snapshot read ${CATALOG_SNAPSHOT_DATE}. Popularity is never shown as proof of quality.`} actions={<Button icon="plus" onClick={() => setAdding(true)} data-testid="add-candidate">Add a candidate</Button>} />
      <div className="mb-4"><Callout tone="info" title="How to read this catalog">Facts come from pages read on the stated date through an automated fetch-and-summarize step, not from cloning or running anything. Anything that was not visible is marked <em>unknown</em>, never guessed. Install commands are quoted from their source with a link and are never executed here.</Callout></div>
      {adding && <div className="mb-4"><CandidateForm onDone={() => setAdding(false)} /></div>}

      <Card className="mb-4">
        <div className="grid gap-4">
          <TextInput label="Search name, outcome, technology, type, project relevance" type="search" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} placeholder="e.g. debugging, browser, react, mcp" data-testid="catalog-search" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Toggle label="Source tier" values={TIERS} selected={f.tiers} onChange={(tiers) => setF({ ...f, tiers })} render={(t) => ({ official: 'Official', community: 'Community', candidate: 'Candidate', custom: 'Custom (proposed)' })[t]} />
            <Toggle label="Component type" values={COMPONENT_TYPES} selected={f.types} onChange={(types) => setF({ ...f, types })} render={(t) => TYPE_LABEL[t]} />
            <Toggle label="Security review status" values={['not-reviewed', 'metadata-only', 'content-inspected'] as const} selected={f.securityStatus} onChange={(securityStatus) => setF({ ...f, securityStatus })} render={(s) => SEC_LABEL[s]} />
            <Toggle label="Verification freshness" values={['fresh', 'aging', 'stale'] as const} selected={f.freshness} onChange={(freshness) => setF({ ...f, freshness })} render={(s) => FRESH_LABEL[s]} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Game-development relevance" value={String(f.minGameRelevance)} onChange={(e) => setF({ ...f, minGameRelevance: Number(e.target.value) })}>
              <option value="0">Any</option><option value="1">At least 1/3</option><option value="2">At least 2/3</option><option value="3">3/3 (directly about game dev)</option>
            </SelectField>
            <SelectField label="Arsenal status" value={f.arsenal} onChange={(e) => setF({ ...f, arsenal: e.target.value as CatalogFilters['arsenal'] })}>
              <option value="any">Any</option><option value="in">In my Arsenal</option><option value="out">Not in my Arsenal</option>
            </SelectField>
          </div>
          {active && <div><Button variant="ghost" size="sm" onClick={() => setF(EMPTY_FILTERS)} data-testid="clear-filters">Clear all filters</Button></div>}
        </div>
      </Card>

      <p className="mb-2 text-sm text-muted" role="status" data-testid="result-count">{results.length} of {CATALOG.length} entries</p>
      {results.length === 0 ? (
        <EmptyState title="No entries match" icon="search" action={<Button onClick={() => setF(EMPTY_FILTERS)}>Clear filters</Button>}>Filters combine with AND. Try removing one, or add your own candidate.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="catalog-results">{results.map((e) => <EntryCard key={e.id} e={e} status={statuses.get(e.id)} />)}</ul>
      )}

      {candidates.length > 0 && (
        <section className="mt-8" aria-labelledby="cand-h">
          <h2 id="cand-h" className="text-xl font-semibold">Your candidates <Badge tone="warn">local · unverified</Badge></h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {candidates.map((a) => (
              <Card as="li" key={a.entryId}>
                <p className="flex items-center gap-2"><Icon name="flag" size={16} className="text-warn" /><Link className="font-semibold underline" to={`/discovery/${a.entryId}`}>{a.candidate!.name}</Link></p>
                <p className="text-sm text-muted">{a.candidate!.type}{a.candidate!.publisher && ` · ${a.candidate!.publisher}`}</p>
              </Card>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

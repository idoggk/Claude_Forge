import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getEntry } from '@/content/catalog/entries';
import { ARSENAL_STATUSES, type ArsenalStatus } from '@/persistence/schemas';
import { Badge, Button, Card, EmptyState, LinkButton, PageHeader, Spinner, cx } from '@/components/ui';
import { useArsenal, useSkills } from '@/app/hooks';
import { getDb } from '@/persistence/db';
import { setArsenalStatus } from '@/persistence/repo';
import { useLive } from '@/persistence/useLive';
import { formatIso } from '@/lib/clock';

export function ArsenalNav({ active }: { active: 'arsenal' | 'growth' }) {
  return (
    <nav aria-label="Arsenal and Growth" className="mb-4 inline-flex gap-1 rounded-lg border border-line bg-surface p-1">
      <Link to="/arsenal" aria-current={active === 'arsenal' ? 'page' : undefined} className={cx('min-h-10 rounded-md px-4 py-2 text-sm font-semibold', active === 'arsenal' ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg')}>Arsenal</Link>
      <Link to="/growth" aria-current={active === 'growth' ? 'page' : undefined} className={cx('min-h-10 rounded-md px-4 py-2 text-sm font-semibold', active === 'growth' ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg')}>Growth</Link>
    </nav>
  );
}

export default function ArsenalPage() {
  const { data: arsenal } = useArsenal();
  const { data: skills } = useSkills();
  const { data: notes } = useLive(() => getDb().annotations.toArray());
  const [filter, setFilter] = useState<ArsenalStatus | 'all'>('all');
  if (!arsenal || !skills || !notes) return <Spinner label="Loading your Arsenal" />;

  const describe = (id: string): { name: string; href: string; kind: string } => {
    if (id.startsWith('custom:')) { const s = skills.find((x) => `custom:${x.id}` === id); return { name: s?.name || '(unnamed Skill)', href: `/workshop/${id.slice(7)}`, kind: 'Your Skill' }; }
    const e = getEntry(id);
    if (e) return { name: e.displayName, href: `/discovery/${id}`, kind: e.tier };
    const c = notes.find((n) => n.entryId === id)?.candidate;
    return { name: c?.name ?? id, href: `/discovery/${id}`, kind: 'Your candidate (unverified)' };
  };

  const rows = arsenal.filter((a) => filter === 'all' || a.status === filter).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const untracked = skills.filter((s) => !arsenal.some((a) => a.entryId === `custom:${s.id}`));

  return (
    <div>
      <PageHeader eyebrow="Arsenal & Growth" title="Your Skill Arsenal" subtitle="Your actual relationship with each Skill. Everything here is your own declaration - Claude Forge cannot see what is installed on your machine." />
      <ArsenalNav active="arsenal" />
      <div role="group" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        {(['all', ...ARSENAL_STATUSES] as const).map((s) => {
          const n = s === 'all' ? arsenal.length : arsenal.filter((a) => a.status === s).length;
          return <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)} className={cx('transition-forge min-h-11 rounded-lg border px-3 text-sm font-semibold', filter === s ? 'border-accent bg-surface2' : 'border-line text-muted hover:bg-surface2')}>{s === 'all' ? 'All' : s[0]!.toUpperCase() + s.slice(1)} <span className="text-muted">{n}</span></button>;
        })}
      </div>

      {arsenal.length === 0 ? (
        <EmptyState title="Your Arsenal is empty" icon="shield" action={<LinkButton to="/discovery" variant="primary" icon="compass">Browse the Discovery Hub</LinkButton>}>Add something you are curious about or evaluating. &ldquo;Interested&rdquo; costs nothing and nothing is installed.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState title={`Nothing with status “${filter}”`} icon="shield" action={<Button onClick={() => setFilter('all')}>Show all</Button>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="arsenal-list">
          {rows.map((a) => {
            const d = describe(a.entryId);
            return (
              <Card as="li" key={a.entryId} data-testid={`arsenal-${a.entryId}`}>
                <div className="flex flex-wrap items-center gap-2"><Badge tone={a.status === 'rejected' ? 'bad' : a.status === 'mastered' ? 'ok' : 'accent'}>{a.status}</Badge><Badge>{d.kind}</Badge></div>
                <h3 className="mt-1 text-lg font-semibold"><Link to={d.href} className="hover:underline">{d.name}</Link></h3>
                <p className="mt-1 flex flex-wrap gap-2 text-xs">
                  <Badge tone={a.inspected ? 'ok' : 'neutral'}>{a.inspected ? 'inspected' : 'not inspected'}</Badge>
                  <Badge tone={a.approved ? 'ok' : 'neutral'}>{a.approved ? 'approved by you' : 'not approved'}</Badge>
                  <Badge tone={a.declaredInstalled ? 'warn' : 'neutral'} title="Declared by you; not verified by this app">{a.declaredInstalled ? 'installed (declared)' : 'not installed (declared)'}</Badge>
                </p>
                <dl className="mt-2 space-y-1 text-sm text-muted">
                  <div>Observed usefulness: {a.observedUsefulness ? `${a.observedUsefulness}/5` : 'not rated'} · Project relevance (yours): {notes.find((n) => n.entryId === a.entryId)?.personalRelevance ?? 'not rated'} · Experiments linked: {a.experimentIds.length}</div>
                  <div>Last evaluated: {formatIso(a.lastEvaluatedAt)}</div>
                  {a.status === 'rejected' && <div>Rejected because: {a.rejectionReason || <em>no reason recorded</em>}</div>}
                  {a.securityConcerns && <div>Security concerns: {a.securityConcerns}</div>}
                  <div>Next practice: {a.nextPractice || <em>none set</em>}</div>
                </dl>
                <div className="mt-2"><LinkButton size="sm" to={d.href}>Open &amp; edit</LinkButton></div>
              </Card>
            );
          })}
        </ul>
      )}

      <section className="mt-8" aria-labelledby="custom-h">
        <h2 id="custom-h" className="text-xl font-semibold">Your custom Skills</h2>
        {skills.length === 0 ? <p className="mt-1 text-sm text-muted">None yet. Build one in the Workshop and it will be listed here.</p> : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {skills.map((s) => (
              <Card as="li" key={s.id}>
                <h3 className="font-semibold"><Link className="hover:underline" to={`/workshop/${s.id}`}>{s.name || '(unnamed)'}</Link></h3>
                <p className="text-sm text-muted">{s.liveTests.length} live test(s) · {s.revisions.length} revision(s) · {s.lastExportedAt ? 'exported' : 'not exported'}</p>
                {untracked.some((u) => u.id === s.id) && <Button size="sm" className="mt-2" onClick={() => void setArsenalStatus(`custom:${s.id}`, 'practicing')}>Track in Arsenal as Practicing</Button>}
              </Card>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

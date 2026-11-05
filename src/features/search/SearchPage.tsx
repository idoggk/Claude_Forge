import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LESSONS } from '@/content/lessons';
import { CATALOG } from '@/content/catalog/entries';
import { EMPTY_FILTERS, filterCatalog } from '@/domain/catalog/search';
import { COMPETENCY_BY_ID } from '@/domain/curriculum/competencies';
import { Badge, Card, EmptyState, PageHeader, Spinner } from '@/components/ui';
import { useArsenal, useExperiments, useSkills } from '@/app/hooks';
import { todayKey } from '@/lib/clock';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const { data: skills } = useSkills();
  const { data: experiments } = useExperiments();
  const { data: arsenal } = useArsenal();

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (text: string) => terms.every((t) => text.toLowerCase().includes(t));
    const lessons = terms.length ? LESSONS.filter((l) => match([l.title, l.subtitle, l.problem, ...l.objectives, ...l.competencies.map((c) => COMPETENCY_BY_ID[c].title)].join(' '))) : [];
    const catalog = terms.length ? filterCatalog(CATALOG, { ...EMPTY_FILTERS, query: q }, { today: todayKey(), arsenalStatus: new Map((arsenal ?? []).map((a) => [a.entryId, a.status])) }) : [];
    const mine = terms.length ? (skills ?? []).filter((s) => match(`${s.name} ${s.description} ${s.instructions}`)) : [];
    const exps = terms.length ? (experiments ?? []).filter((e) => match(`${e.title} ${e.problem} ${e.hypothesis}`)) : [];
    return { lessons, catalog, mine, exps };
  }, [q, skills, experiments, arsenal]);

  if (!skills || !experiments || !arsenal) return <Spinner label="Searching" />;
  const total = results.lessons.length + results.catalog.length + results.mine.length + results.exps.length;

  return (
    <div>
      <PageHeader title="Search" subtitle="Across lessons, the Discovery catalog, your Skills and your experiments. Everything is searched on this device." />
      <form role="search" onSubmit={(e) => e.preventDefault()} className="mb-5">
        <label htmlFor="search-page-input" className="sr-only">Search query</label>
        <input id="search-page-input" autoFocus type="search" value={q} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} placeholder="Try: trigger, playwright, economy, worktree…" className="min-h-12 w-full rounded-lg border border-line bg-surface px-4 text-base focus:border-accent" data-testid="search-input" />
      </form>
      {!q.trim() ? (
        <EmptyState title="Type to search" icon="search">Search matches words in names, outcomes, tags and descriptions. All words must match.</EmptyState>
      ) : total === 0 ? (
        <EmptyState title={`Nothing matches “${q}”`} icon="search">Try fewer or different words. Catalog entries use terms like debugging, review, browser, mcp, plugin.</EmptyState>
      ) : (
        <div className="space-y-6" data-testid="search-results">
          {results.lessons.length > 0 && <section><h2 className="mb-2 text-lg font-semibold">Lessons</h2><ul className="space-y-2">{results.lessons.map((l) => <Card as="li" key={l.id}><Link className="font-semibold text-accent-text underline" to={`/academy/lesson/${l.id}`}>{l.title}</Link><p className="text-sm text-muted">{l.subtitle}</p></Card>)}</ul></section>}
          {results.catalog.length > 0 && <section><h2 className="mb-2 text-lg font-semibold">Discovery catalog</h2><ul className="space-y-2">{results.catalog.map((e) => <Card as="li" key={e.id}><Link className="font-semibold text-accent-text underline" to={`/discovery/${e.id}`}>{e.displayName}</Link> <Badge>{e.tier}</Badge><p className="text-sm text-muted">{e.purpose}</p></Card>)}</ul></section>}
          {results.mine.length > 0 && <section><h2 className="mb-2 text-lg font-semibold">Your Skills</h2><ul className="space-y-2">{results.mine.map((s) => <Card as="li" key={s.id}><Link className="font-semibold text-accent-text underline" to={`/workshop/${s.id}`}>{s.name || '(unnamed)'}</Link><p className="text-sm text-muted">{s.description.slice(0, 140)}</p></Card>)}</ul></section>}
          {results.exps.length > 0 && <section><h2 className="mb-2 text-lg font-semibold">Experiments</h2><ul className="space-y-2">{results.exps.map((e) => <Card as="li" key={e.id}><Link className="font-semibold text-accent-text underline" to={`/battle-lab/${e.id}`}>{e.title}</Link></Card>)}</ul></section>}
        </div>
      )}
    </div>
  );
}

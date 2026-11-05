import { Link, useParams } from 'react-router-dom';
import { getEntry } from '@/content/catalog/entries';
import { TIER_LABELS, freshnessOf } from '@/domain/catalog/schema';
import { LESSONS } from '@/content/lessons';
import { Badge, Button, Callout, Card, EmptyState, LinkButton, PageHeader, SafeLink, Spinner, useToast } from '@/components/ui';
import { AdoptionPanel } from '@/features/arsenal/AdoptionPanel';
import { tierTone } from './DiscoveryPage';
import { todayKey } from '@/lib/clock';
import { getDb } from '@/persistence/db';
import { useLive } from '@/persistence/useLive';

const unknown = <em className="text-muted">unknown</em>;

function CopyCommand({ command }: { command: string }) {
  const toast = useToast();
  return (
    <div className="flex items-start gap-2">
      <pre tabIndex={0} className="code-scroll min-w-0 flex-1 rounded-lg border border-line bg-surface2 p-2 text-xs"><code>{command}</code></pre>
      <Button size="sm" variant="ghost" icon="copy" aria-label={`Copy command: ${command}`} onClick={async () => { try { await navigator.clipboard.writeText(command); toast('Copied - read the source before you run it'); } catch { toast('Copy is blocked by this browser; select the text instead', 'bad'); } }}>Copy</Button>
    </div>
  );
}

function Sec({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2" aria-labelledby={`sec-${n}`}>
      <h2 id={`sec-${n}`} className="text-lg font-semibold"><span className="mr-2 text-accent-text">{n}.</span>{title}</h2>
      {children}
    </section>
  );
}

function UserCandidate({ id }: { id: string }) {
  const { data } = useLive(() => getDb().annotations.get(id), [id]);
  if (data === undefined) return <Spinner />;
  if (!data?.candidate) return <EmptyState title="Entry not found" action={<LinkButton to="/discovery" variant="primary">Back to Discovery</LinkButton>} />;
  const c = data.candidate;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <PageHeader eyebrow="Your candidate" title={c.name} subtitle="A lead you added. Claude Forge has not read, fetched or verified anything about it." />
        <Callout tone="warn" title="Local and unverified">Nothing below is a verified catalog fact. Inspect the source yourself (Lesson 4) before installing anything.</Callout>
        <Card><dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-muted">Type (your label)</dt><dd>{c.type}</dd></div><div><dt className="font-semibold text-muted">Publisher (your understanding)</dt><dd>{c.publisher || unknown}</dd></div><div className="sm:col-span-2"><dt className="font-semibold text-muted">Link you saved</dt><dd>{c.url ? <SafeLink href={c.url}>{c.url}</SafeLink> : unknown}</dd></div></dl></Card>
      </div>
      <AdoptionPanel entryId={id} local heading="Your adoption" />
    </div>
  );
}

export default function EntryPage() {
  const { entryId = '' } = useParams();
  if (entryId.startsWith('user_')) return <UserCandidate id={entryId} />;
  const e = getEntry(entryId);
  if (!e) return <EmptyState title="Entry not found" action={<LinkButton to="/discovery" variant="primary">Back to Discovery</LinkButton>}>This ID is not in the catalog snapshot.</EmptyState>;
  const fresh = freshnessOf(e.verifiedAt, todayKey());
  const lessons = e.relatedLessons.map((id) => LESSONS.find((l) => l.id === id)).filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <article>
      <PageHeader
        eyebrow="Discovery Hub"
        title={e.displayName}
        subtitle={<>{e.publisher}</>}
        actions={<LinkButton to="/discovery" size="sm">All entries</LinkButton>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone={tierTone(e.tier)}>{TIER_LABELS[e.tier].label}</Badge>
        {e.componentTypes.map((t) => <Badge key={t}>{t}</Badge>)}
        <Badge tone={e.security.reviewStatus === 'not-reviewed' ? 'warn' : 'neutral'}>Security: {e.security.reviewStatus.replace('-', ' ')}</Badge>
        {fresh !== 'not-applicable' && <Badge tone={fresh === 'fresh' ? 'ok' : fresh === 'aging' ? 'warn' : 'bad'}>{fresh}</Badge>}
      </div>
      <p className="mb-4 text-sm text-muted">{TIER_LABELS[e.tier].description}</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Sec n={1} title="What problem it solves"><p className="text-muted">{e.problemSolved}</p><p className="text-sm text-muted"><strong className="text-fg">Purpose: </strong>{e.purpose}</p></Sec>
          <Sec n={2} title="When to use it"><ul className="list-disc space-y-1 pl-5 text-muted">{e.whenToUse.map((x) => <li key={x}>{x}</li>)}</ul></Sec>
          <Sec n={3} title="When not to use it"><ul className="list-disc space-y-1 pl-5 text-muted">{e.whenNotToUse.map((x) => <li key={x}>{x}</li>)}</ul></Sec>
          <Sec n={4} title="How it works"><p className="text-muted">{e.howItWorks}</p></Sec>

          <Sec n={5} title="Verified source and provenance">
            <Card>
              <dl className="grid gap-3 text-sm sm:grid-cols-2" data-testid="provenance">
                <div className="sm:col-span-2"><dt className="font-semibold text-muted">Canonical source</dt><dd>{e.sourceUrl ? <SafeLink href={e.sourceUrl}>{e.sourceUrl}</SafeLink> : <span>None - this is a proposal for you to author</span>}</dd></div>
                <div><dt className="font-semibold text-muted">Last checked</dt><dd>{e.verifiedAt ?? unknown}</dd></div>
                <div><dt className="font-semibold text-muted">Evidence status</dt><dd>{e.evidenceStatus.replace(/-/g, ' ')}</dd></div>
                <div className="sm:col-span-2"><dt className="font-semibold text-muted">How it was checked</dt><dd>{e.verificationMethod}</dd></div>
                <div><dt className="font-semibold text-muted">Revision / release</dt><dd>{e.revision.value ?? unknown} <span className="block text-xs text-muted">{e.revision.note}</span></dd></div>
                <div><dt className="font-semibold text-muted">Last commit</dt><dd>{e.maintenance.lastCommit ?? unknown}</dd></div>
                <div className="sm:col-span-2"><dt className="font-semibold text-muted">Maintenance evidence</dt><dd>{e.maintenance.evidence} <span className="block text-xs text-muted">Repository-level activity does not prove an individual Skill is maintained.</span></dd></div>
                <div className="sm:col-span-2"><dt className="font-semibold text-muted">Licence evidence</dt><dd>{e.license.spdx ? <strong>{e.license.spdx} </strong> : <>{unknown} </>}<span className="text-muted">({e.license.status.replace(/-/g, ' ')}) {e.license.evidence}</span></dd></div>
                {e.observedSignals.stars && <div className="sm:col-span-2"><dt className="font-semibold text-muted">Observed signal</dt><dd>{e.observedSignals.stars} stars on {e.observedSignals.asOf} <span className="block text-xs text-muted">Shown for transparency only - popularity is not evidence of quality or safety.</span></dd></div>}
              </dl>
            </Card>
          </Sec>

          <Sec n={6} title="Installation information">
            {e.install.status === 'verified-from-source' ? (
              <div className="space-y-3" data-testid="install-info">
                <Callout tone="warn" title="Quoted, not endorsed - and never executed by Claude Forge">{e.install.note} Review the source (Lesson 4) before running anything. Plugins and MCP servers run code with your user privileges.</Callout>
                {e.install.methods.map((m) => (
                  <div key={m.command} className="space-y-1 rounded-lg border border-line p-3">
                    <p className="text-sm font-semibold">{m.label}</p>
                    <CopyCommand command={m.command} />
                    <p className="text-xs text-muted">Read from <SafeLink href={m.verifiedFrom}>{m.verifiedFrom}</SafeLink> on {e.verifiedAt}.{m.caveat && ` ${m.caveat}`}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Callout tone="info" title="No installation command is shown">{e.install.note}{e.sourceUrl && <> See <SafeLink href={e.sourceUrl}>the canonical source</SafeLink>.</>}</Callout>
            )}
          </Sec>

          <Sec n={7} title="Relevant project workflows">
            {e.workflows.length ? <ul className="list-disc space-y-1 pl-5 text-muted">{e.workflows.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-muted">None evaluated.</p>}
            <p className="text-sm text-muted"><strong className="text-fg">Game-development relevance {e.relevance.gameDev}/3:</strong> {e.relevance.note}</p>
            {e.notableComponents.length > 0 && <details><summary className="cursor-pointer text-sm font-semibold">Components named by the source ({e.notableComponents.length})</summary><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{e.notableComponents.map((c) => <li key={c.name}><strong className="text-fg">{c.name}:</strong> {c.description}</li>)}</ul><p className="mt-1 text-xs text-muted">Named in the source&apos;s README; individual files were not inspected.</p></details>}
          </Sec>

          <Sec n={8} title="Practical example"><p className="text-muted">{e.practicalExample}</p></Sec>

          <Sec n={9} title="Security and maintenance notes">
            {e.security.concerns.length > 0 ? <ul className="list-disc space-y-1 pl-5 text-muted">{e.security.concerns.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-muted">No specific concerns recorded - which is not the same as reviewed.</p>}
            {e.security.notes && <p className="text-sm text-muted">{e.security.notes}</p>}
            <h3 className="pt-2 text-sm font-semibold">Known limitations</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{e.limitations.map((x) => <li key={x}>{x}</li>)}</ul>
            {e.missingChecks.length > 0 && <><h3 className="pt-2 text-sm font-semibold">Checks not yet done</h3><ul className="list-disc space-y-1 pl-5 text-sm text-muted" data-testid="missing-checks">{e.missingChecks.map((x) => <li key={x}>{x}</li>)}</ul></>}
          </Sec>

          <Sec n={10} title="Alternatives">
            {e.alternatives.length ? <ul className="flex flex-wrap gap-2">{e.alternatives.map((id) => { const a = getEntry(id); return a ? <li key={id}><LinkButton size="sm" to={`/discovery/${id}`}>{a.displayName}</LinkButton></li> : null; })}</ul> : <p className="text-muted">None listed.</p>}
          </Sec>

          <Sec n={12} title="Related lessons and experiments">
            <ul className="list-disc space-y-1 pl-5">{lessons.map((l) => <li key={l.id}><Link className="text-accent-text underline" to={`/academy/lesson/${l.id}`}>{l.title}</Link></li>)}{lessons.length === 0 && <li className="list-none text-muted">No linked lessons.</li>}</ul>
            <LinkButton to="/battle-lab" size="sm" icon="flask">Compare it in the Battle Lab</LinkButton>
            {e.tier === 'custom' && <LinkButton to="/workshop" size="sm" icon="hammer">Draft it in the Workshop</LinkButton>}
          </Sec>
        </div>

        <aside aria-label="Personal adoption controls" className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Sec n={11} title="Personal adoption controls"><AdoptionPanel entryId={e.id} heading="Your Arsenal record" /></Sec>
        </aside>
      </div>
    </article>
  );
}

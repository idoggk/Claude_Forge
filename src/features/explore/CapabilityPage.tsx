import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Callout, Card, EmptyState, LinkButton, PageHeader, SafeLink, Spinner } from '@/components/ui';
import { CAPABILITY_BY_ID, CAPABILITIES, OUTCOMES } from '@/content/capability/map';
import { RELATION_LABELS, relatedNodes, statusOf } from '@/domain/capability/model';
import { LESSONS, getLesson } from '@/content/lessons';
import { getEntry } from '@/content/catalog/entries';
import { PLAYBOOK_TEMPLATES } from '@/content/playbook/seeds';
import { LAB_TEMPLATES } from '@/content/lab/templates';
import { lessonStatus } from '@/domain/mastery/recommend';
import { useLearning } from '@/app/hooks';
import { GoalForm } from './GoalsPanel';
import { KIND_LABEL } from './ExplorePage';

export default function CapabilityPage() {
  const { capabilityId = '' } = useParams();
  const { data: l } = useLearning();
  const [goal, setGoal] = useState(false);
  const n = CAPABILITY_BY_ID.get(capabilityId);
  if (!l) return <Spinner label="Loading" />;
  if (!n) return <EmptyState title="That capability does not exist" action={<LinkButton to="/explore" variant="primary">Back to the map</LinkButton>}>The link may be from an older version.</EmptyState>;
  const related = relatedNodes(CAPABILITIES, n.id);
  const outcomes = OUTCOMES.filter((o) => n.outcomes.includes(o.id));

  return (
    <div data-testid="capability-page">
      <PageHeader eyebrow={`Capability · ${KIND_LABEL[n.kind]}`} title={n.title} subtitle={n.summary} actions={<LinkButton to="/explore" variant="ghost" size="sm">Back to the map</LinkButton>} />
      <div className="mb-4 flex flex-wrap gap-2">{outcomes.map((o) => <Badge key={o.id} tone="accent">{o.title}</Badge>)}<Badge tone={statusOf(n) === 'learnable' ? 'ok' : 'neutral'}>{statusOf(n) === 'learnable' ? 'Has lessons' : 'Reference and templates only'}</Badge></div>

      <Callout tone="info" title="The deciding question">{n.judgment}</Callout>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card><h2 className="font-semibold">Use it when</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{n.useWhen.map((x) => <li key={x}>{x}</li>)}</ul></Card>
        <Card><h2 className="font-semibold">Avoid it when</h2>{n.avoidWhen.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{n.avoidWhen.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="mt-2 text-sm text-muted">No general counter-case; judge it against your task.</p>}</Card>
        <Card><h2 className="font-semibold">Risks to manage</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{n.risks.map((x) => <li key={x}>{x}</li>)}</ul></Card>
      </div>

      <section className="mt-6" aria-labelledby="go-h">
        <h2 id="go-h" className="mb-2 text-xl font-semibold">Where to go from here</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {n.lessons.length > 0 && (
            <Card>
              <h3 className="font-semibold">Learn it</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {n.lessons.map((id) => {
                  const lesson = getLesson(id) ?? LESSONS.find((x) => x.id === id);
                  if (!lesson) return null;
                  const st = lessonStatus(lesson, l.attempts, l.progress);
                  return <li key={id} className="flex flex-wrap items-center gap-2"><Link className="font-semibold underline" to={`/academy/lesson/${id}`}>{lesson.title}</Link><Badge tone={st === 'passed' ? 'ok' : 'neutral'}>{st === 'passed' ? 'Passed' : st === 'not-started' ? 'Not started' : 'In progress'}</Badge></li>;
                })}
              </ul>
            </Card>
          )}
          {n.entries.length > 0 && (
            <Card>
              <h3 className="font-semibold">Look at real examples</h3>
              <ul className="mt-2 space-y-1 text-sm">{n.entries.map((id) => { const e = getEntry(id); return e ? <li key={id}><Link className="font-semibold underline" to={`/discovery/${id}`}>{e.displayName}</Link> <span className="text-muted">· {e.publisher}</span></li> : null; })}</ul>
              <p className="mt-2 text-xs text-muted">Catalog facts show where and when they were read. Nothing is ranked by popularity.</p>
            </Card>
          )}
          {n.playbookTemplates.length > 0 && (
            <Card>
              <h3 className="font-semibold">Write it down as a playbook</h3>
              <ul className="mt-2 space-y-1 text-sm">{n.playbookTemplates.map((id) => { const t = PLAYBOOK_TEMPLATES.find((x) => x.templateId === id); return t ? <li key={id}><Link className="font-semibold underline" to={`/playbooks?template=${id}`}>{t.title}</Link></li> : null; })}</ul>
            </Card>
          )}
          {n.labTemplates.length > 0 && (
            <Card>
              <h3 className="font-semibold">Test it in the AI Lab</h3>
              <ul className="mt-2 space-y-1 text-sm">{n.labTemplates.map((id) => { const t = LAB_TEMPLATES.find((x) => x.id === id); return t ? <li key={id}><Link className="font-semibold underline" to={`/battle-lab?template=${id}`}>{t.title}</Link></li> : null; })}</ul>
            </Card>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-6" aria-labelledby="rel-h">
          <h2 id="rel-h" className="mb-2 text-xl font-semibold">Related capabilities</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {related.map(({ node, relation, direction }) => (
              <Card as="li" key={`${node.id}-${direction}-${relation.type}`}>
                <p className="text-xs uppercase tracking-wide text-muted">{direction === 'out' ? RELATION_LABELS[relation.type] : `${node.title} - ${RELATION_LABELS[relation.type].toLowerCase()} this`}</p>
                <p className="font-semibold"><Link className="underline" to={`/explore/${node.id}`}>{node.title}</Link></p>
                <p className="text-sm text-muted">{relation.note}</p>
              </Card>
            ))}
          </ul>
        </section>
      )}

      {n.sources.length > 0 && (
        <section className="mt-6" aria-labelledby="src-h">
          <h2 id="src-h" className="mb-2 text-xl font-semibold">Sources</h2>
          <ul className="space-y-1 text-sm">{n.sources.map((s) => <li key={s.url}><SafeLink href={s.url} className="underline">{s.label}</SafeLink> <span className="text-muted">- {s.supports}</span></li>)}</ul>
        </section>
      )}

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">Make it a goal</h2>
        <p className="mt-1 text-sm text-muted">Saving a goal changes what Forge recommends next. It does not record any skill.</p>
        {goal ? <div className="mt-3"><GoalForm initialCapabilityIds={[n.id]} onDone={() => setGoal(false)} /></div> : <div className="mt-3"><button className="transition-forge inline-flex min-h-11 items-center rounded-lg border border-accent px-4 font-semibold hover:bg-surface2" onClick={() => setGoal(true)} data-testid="make-goal">Save as a learning goal</button></div>}
      </Card>
    </div>
  );
}

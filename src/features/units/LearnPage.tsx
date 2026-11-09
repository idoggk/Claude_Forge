import { Link } from 'react-router-dom';
import { Badge, Card, PageHeader, Spinner } from '@/components/ui';
import { useMissionRuns } from '@/app/hooks';
import { MISSIONS_ONLY, SPARKS_ONLY } from '@/content/units/registry';
import type { Mission } from '@/domain/missions/model';

export default function LearnPage() {
  const { data: runs } = useMissionRuns();
  if (!runs) return <Spinner label="Loading" />;
  const status = (m: Mission) => {
    const mine = runs.filter((r) => r.missionId === m.id);
    const active = mine.find((r) => r.status === 'in-progress');
    const done = mine.filter((r) => r.status === 'completed').length;
    return active ? 'In progress' : done > 0 ? `Done ${done}×` : 'New';
  };
  const list = (units: Mission[], testId: string) => (
    <ul className="grid gap-3 md:grid-cols-2" data-testid={testId}>
      {units.map((m) => (
        <li key={m.id}>
          <Card aria-labelledby={`u-${m.id}`} className="h-full" data-testid={`unit-card-${m.id}`}>
            <div className="flex flex-wrap items-center gap-2"><h3 id={`u-${m.id}`} className="text-base font-semibold">{m.title}</h3><Badge tone={status(m) === 'In progress' ? 'warn' : 'neutral'}>{status(m)}</Badge></div>
            <p className="mt-1 text-sm text-muted">{m.tagline}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm"><Link className="font-semibold text-accent-text underline" to={`/${m.kind === 'spark' ? 'spark' : 'mission'}/${m.id}`} data-testid={`unit-open-${m.id}`}>{status(m) === 'In progress' ? 'Continue' : 'Start'}</Link><span className="text-xs text-muted">about {m.minutes} min (estimate)</span></div>
          </Card>
        </li>
      ))}
    </ul>
  );
  return (
    <div>
      <PageHeader eyebrow="Learn" title="Start learning" subtitle="Three ways in. Short ones fit a spare few minutes; missions take a little longer; deep labs are real work. Finishing any of them is practice. Independent assessments are still what raise a level." />
      <section aria-labelledby="l-sparks" className="mb-6"><h2 id="l-sparks" className="text-lg font-semibold">Quick Sparks · about 3 minutes</h2><p className="mb-2 text-sm text-muted">One problem, one decision, one idea to keep.</p>{list(SPARKS_ONLY, 'spark-list')}</section>
      <section aria-labelledby="l-missions" className="mb-6"><h2 id="l-missions" className="text-lg font-semibold">Guided missions · about 8 minutes</h2><p className="mb-2 text-sm text-muted">Hook, predict, discover, practise, challenge, reflect. Each ends at the lesson&apos;s independent assessment.</p>{list(MISSIONS_ONLY, 'mission-list')}</section>
      <section aria-labelledby="l-more"><h2 id="l-more" className="text-lg font-semibold">More ways to learn</h2>
        <ul className="mt-2 grid gap-2 text-sm md:grid-cols-2">
          <li><Link className="font-semibold text-accent-text underline" to="/deep-lab" data-testid="learn-deep-lab">Deep Lab · 20 to 45 minutes</Link> <span className="text-muted">real experiments with your own Claude Code</span></li>
          <li><Link className="font-semibold text-accent-text underline" to="/playgrounds" data-testid="learn-playgrounds">Playgrounds</Link> <span className="text-muted">interactive, explicitly simulated demonstrations</span></li>
          <li><Link className="font-semibold text-accent-text underline" to="/review5" data-testid="learn-review">Review for 5 minutes</Link> <span className="text-muted">short spaced review</span></li>
          <li><Link className="font-semibold text-accent-text underline" to="/academy">The full curriculum</Link> <span className="text-muted">every lesson, track and assessment</span></li>
        </ul>
      </section>
    </div>
  );
}

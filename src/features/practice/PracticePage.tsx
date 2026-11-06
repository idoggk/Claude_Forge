import { Link } from 'react-router-dom';
import { Badge, Callout, Card, PageHeader, Spinner } from '@/components/ui';
import { useActivityRuns } from '@/app/hooks';
import { MIXED_EXERCISES } from '@/content/interleaved';
import { COMPETENCY_BY_ID } from '@/domain/curriculum/competencies';
import { SuggestionCard } from './SuggestionCard';
import { useAdaptive } from './useAdaptive';

export default function PracticePage() {
  const suggestions = useAdaptive();
  const { data: runs } = useActivityRuns();
  if (!suggestions || !runs) return <Spinner label="Loading practice" />;
  return (
    <div>
      <PageHeader eyebrow="Practise" title="Practice that fits you" subtitle="Suggestions come from your own records: confidence against result, hints, repeated mistakes and assessment version. They never raise a level, and clicking through lessons never makes them harder." />
      <section aria-labelledby="prac-next" className="mb-6">
        <h2 id="prac-next" className="mb-2 text-lg font-semibold">Suggested next</h2>
        {suggestions.length === 0 ? (
          <Callout tone="info" title="Nothing to suggest yet">Suggestions need evidence. Pass an assessment and they will appear, with the reason, what they train and what would count as improvement.</Callout>
        ) : (
          <ul className="space-y-3" data-testid="adaptive-list">{suggestions.slice(0, 5).map((s) => <li key={`${s.tier}-${s.to}`}><SuggestionCard s={s} /></li>)}</ul>
        )}
      </section>
      <section aria-labelledby="prac-mixed">
        <h2 id="prac-mixed" className="mb-1 text-lg font-semibold">Mixed-topic exercises</h2>
        <p className="mb-3 text-sm text-muted">Each needs judgment from several topics at once. Runs are saved as practice and never change a competency level.</p>
        <ul className="grid gap-3 md:grid-cols-2" data-testid="mixed-list">
          {MIXED_EXERCISES.map((m) => {
            const mine = runs.filter((r) => r.activityId === `interleaved:${m.id}`);
            return (
              <li key={m.id}>
                <Card aria-labelledby={`mx-${m.id}`} className="h-full" data-testid={`mixed-${m.id}`}>
                  <h3 id={`mx-${m.id}`} className="text-base font-semibold">{m.title}</h3>
                  <p className="mt-1 text-sm text-muted">{m.teaches}</p>
                  <p className="mt-1 text-xs text-muted">Combines: {m.competencies.map((c) => COMPETENCY_BY_ID[c]?.title ?? c).join('; ')}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2"><Link className="font-semibold text-accent-text underline" to={`/practice/${m.id}`} data-testid={`mixed-open-${m.id}`}>Start</Link>{mine.length > 0 ? <Badge tone="accent">{mine.length} run{mine.length === 1 ? '' : 's'} · best {Math.round(Math.max(...mine.map((r) => r.score)) * 100)}%</Badge> : <Badge>Not attempted</Badge>}</div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

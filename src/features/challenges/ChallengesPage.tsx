import { Link } from 'react-router-dom';
import { Badge, Card, PageHeader, Spinner } from '@/components/ui';
import { useActivityRuns } from '@/app/hooks';
import { CHALLENGES, challengeActivityId } from '@/content/challenges';

export default function ChallengesPage() {
  const { data: runs } = useActivityRuns();
  if (!runs) return <Spinner label="Loading challenges" />;
  return (
    <div>
      <PageHeader eyebrow="Practise" title="Challenges" subtitle="Four hands-on problems for working with AI that are not games. Each one has a computed fixture, a worked example, hints, a reference solution and a rubric. They sharpen judgement; they never raise a competency level by themselves." />
      <ul className="grid gap-4 md:grid-cols-2" data-testid="challenge-list">
        {CHALLENGES.map((c) => {
          const mine = runs.filter((r) => r.activityId === challengeActivityId(c.id));
          const best = mine.reduce((m, r) => Math.max(m, r.score), 0);
          return (
            <li key={c.id}>
              <Card aria-labelledby={`ch-${c.id}`} className="h-full" data-testid={`challenge-card-${c.id}`}>
                <h2 id={`ch-${c.id}`} className="text-lg font-semibold">{c.title}</h2>
                <p className="mt-1 text-sm text-muted">{c.tagline}</p>
                <p className="mt-2 text-sm">{c.objective}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link className="font-semibold text-accent-text underline" to={`/challenges/${c.id}`} data-testid={`challenge-open-${c.id}`}>Open challenge</Link>
                  {mine.length > 0 ? <Badge tone="accent">{mine.length} run{mine.length === 1 ? '' : 's'} · best {Math.round(best * 100)}%</Badge> : <Badge>Not attempted</Badge>}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Badge, HomeImage, LinkButton, ProgressBar } from '@/components/ui';
import { HOME_PATHS } from '@/content/home/paths';
import { pathStats } from '@/domain/mastery/paths';
import type { Lesson } from '@/domain/curriculum/types';
import type { Attempt, LessonProgress } from '@/persistence/schemas';

/**
 * Four learning paths, each a real slice of the Academy. Every number is a count of real lessons with its denominator shown;
 * before any progress there is no bar, only what exists today. Topics that are only planned are said to be planned.
 */
export function LearningPaths({ returning, lessons, attempts, progress, missionCount, links = true }: { returning: boolean; lessons: Lesson[]; attempts: Attempt[]; progress: LessonProgress[]; missionCount: number; links?: boolean }) {
  return (
    <section aria-labelledby="paths-h" className="mt-5" data-testid="home-paths">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="paths-h" className="text-xl font-semibold">{returning ? 'Your four learning paths' : 'What you will learn: four paths'}</h2>
        {links && <Link to="/academy" className="text-sm text-accent-text underline">All twelve tracks in the Academy</Link>}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {HOME_PATHS.map((p) => {
          const s = pathStats(p.trackIds, lessons, attempts, progress);
          return (
            <li key={p.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface" data-testid={`path-${p.id}`}>
              <div className="hidden aspect-[16/7] overflow-hidden border-b border-line sm:block" aria-hidden="true"><HomeImage name={p.art} width={640} height={360} className="h-full w-full object-cover" /></div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="text-sm text-muted">{p.tagline}</p>
                {returning ? (
                  <div>
                    <ProgressBar value={s.passed} max={Math.max(1, s.total)} label={`${p.title}: lessons passed`} />
                    <p className="mt-1 text-xs text-muted" data-testid={`path-count-${p.id}`}>{s.passed} of {s.total} lessons passed{s.started > 0 ? ` · ${s.started} started` : ''}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted" data-testid={`path-count-${p.id}`}>{s.total} lesson{s.total === 1 ? '' : 's'} available</p>
                )}
                {s.plannedTopics > 0 && <p className="text-xs"><Badge>{s.plannedTopics} more topics planned</Badge></p>}
                {p.id === 'game-development' && missionCount > 0 && <p className="text-xs text-muted">Plus {missionCount} hands-on Skill Improvement Loop missions.</p>}
                {links && <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  {s.next ? <LinkButton size="sm" variant={returning ? 'secondary' : 'primary'} to={`/academy/lesson/${s.next.id}`} data-testid={`path-open-${p.id}`}>{s.passed === 0 && s.started === 0 ? 'Start' : s.passed === s.total ? 'Review' : 'Continue'}: {s.next.title}</LinkButton> : <LinkButton size="sm" to="/academy">Open the Academy</LinkButton>}
                  {p.extra && <LinkButton size="sm" variant="ghost" to={p.extra.to}>{p.extra.label}</LinkButton>}
                </div>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { LESSONS } from '@/content/lessons';
import { COMPETENCY_BY_ID, TRACKS } from '@/domain/curriculum/competencies';
import { lessonStatus, prerequisitesMet, type LessonStatus } from '@/domain/mastery/recommend';
import { dueReviews } from '@/domain/mastery/review';
import { todayKey } from '@/lib/clock';
import { Badge, Callout, Card, LinkButton, PageHeader, Spinner } from '@/components/ui';
import { useLearning } from '@/app/hooks';
import { DIAGNOSTIC } from '@/content/diagnostic';
import { latestHint } from '@/domain/mastery/diagnostic';

const STATUS: Record<LessonStatus, { label: string; tone: 'neutral' | 'accent' | 'warn' | 'ok' }> = {
  'not-started': { label: 'Not started', tone: 'neutral' },
  'in-progress': { label: 'In progress', tone: 'accent' },
  attempted: { label: 'Assessment not passed yet', tone: 'warn' },
  passed: { label: 'Passed', tone: 'ok' },
};

export default function AcademyPage() {
  const { data: l } = useLearning();
  if (!l) return <Spinner label="Loading the Academy" />;
  const due = dueReviews(l.reviews, todayKey());
  const passed = LESSONS.filter((x) => lessonStatus(x, l.attempts, l.progress) === 'passed').length;

  return (
    <div>
      <PageHeader eyebrow="Academy" title="Five tracks, ten lessons" subtitle={`${passed} of ${LESSONS.length} lessons passed. Each lesson: learn → practice (guided) → assess (independent) → apply to real work.`} />
      {(() => {
        const hint = latestHint(l.diagnostics);
        return (
          <Card className="mb-5" aria-labelledby="dg-h" data-testid="diagnostic-card">
            <h2 id="dg-h" className="text-lg font-semibold">{hint ? 'Placement diagnostic' : 'Not sure where to start?'}</h2>
            <p className="mt-1 text-sm text-muted">{hint ? `Last taken ${new Date(hint.takenAt).toLocaleDateString()}: ${hint.gaps.length} concept${hint.gaps.length === 1 ? '' : 's'} to look at first, ${hint.solid.length} solid start${hint.solid.length === 1 ? '' : 's'}.` : `${DIAGNOSTIC.items.length} short scenario questions (about 5 minutes). It points you at the lessons to look at first and never changes your competency levels.`}</p>
            <div className="mt-3"><LinkButton to="/academy/diagnostic" variant={hint ? 'secondary' : 'primary'} data-testid="open-diagnostic">{hint ? 'Retake the diagnostic' : 'Take the diagnostic'}</LinkButton></div>
          </Card>
        );
      })()}
      {due.length > 0 && (
        <div className="mb-5">
          <Callout tone="info" title={`${due.length} review${due.length === 1 ? '' : 's'} due`}>
            <p>{due.map((d, i) => <span key={d.lessonId}>{i > 0 && ' · '}<Link className="underline" to={`/academy/review/${d.lessonId}`}>{LESSONS.find((x) => x.id === d.lessonId)?.title ?? d.lessonId}</Link></span>)}</p>
          </Callout>
        </div>
      )}
      <div className="space-y-8">
        {TRACKS.map((t) => {
          const lessons = LESSONS.filter((x) => x.track === t.id);
          return (
            <section key={t.id} aria-labelledby={`track-${t.id}`}>
              <h2 id={`track-${t.id}`} className="text-xl font-semibold"><span className="mr-2 text-accent-text">Track {t.id}</span>{t.title}</h2>
              <p className="mt-1 max-w-prose text-muted">{t.summary}</p>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {lessons.map((x) => {
                  const st = lessonStatus(x, l.attempts, l.progress);
                  const pre = prerequisitesMet(x, LESSONS, l.attempts, l.progress);
                  return (
                    <Card as="li" key={x.id} className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>Lesson {x.order}</Badge>
                        <Badge tone={STATUS[st].tone}>{STATUS[st].label}</Badge>
                        <Badge>{x.effortMinutes} min</Badge>
                      </div>
                      <h3 className="text-lg font-semibold">{x.title}</h3>
                      <p className="text-sm text-muted">{x.subtitle}</p>
                      <p className="text-xs text-muted">Builds: {x.competencies.map((c) => COMPETENCY_BY_ID[c].title).join(', ')}</p>
                      {!pre.met && <p className="text-xs text-warn">Best after: {pre.missing.map((m) => m.title).join(', ')}</p>}
                      <div className="mt-auto pt-2">
                        <LinkButton to={`/academy/lesson/${x.id}`} variant={st === 'passed' ? 'secondary' : 'primary'} data-testid={`open-${x.id}`}>{st === 'not-started' ? 'Start lesson' : st === 'passed' ? 'Revisit' : 'Continue'}</LinkButton>
                      </div>
                    </Card>
                  );
                })}
              </ul>
              {t.plannedTopics.length > 0 && (
                <details className="mt-3 rounded-lg border border-dashed border-line p-3 text-sm text-muted">
                  <summary className="cursor-pointer font-semibold">Planned for later releases (not available yet)</summary>
                  <ul className="mt-2 list-disc pl-5">{t.plannedTopics.map((p) => <li key={p}>{p}</li>)}</ul>
                </details>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

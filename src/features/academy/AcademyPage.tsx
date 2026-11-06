import { Link } from 'react-router-dom';
import { LESSONS } from '@/content/lessons';
import { COMPETENCY_BY_ID, TRACKS } from '@/domain/curriculum/competencies';
import { lessonStatus, prerequisitesMet, type LessonStatus } from '@/domain/mastery/recommend';
import { dueReviews } from '@/domain/mastery/review';
import { todayKey } from '@/lib/clock';
import { Badge, Callout, Card, Illustration, LinkButton, PageHeader, Spinner, type ForgeArt } from '@/components/ui';
import { useLearning } from '@/app/hooks';
import { DIAGNOSTIC } from '@/content/diagnostic';
import { latestHint } from '@/domain/mastery/diagnostic';

/** The three specialisation tracks that have supplied artwork. Art says nothing about availability: planned tracks say so in text. */
const TRACK_ART: Partial<Record<string, ForgeArt>> = { agents: 'agents', 'game-dev': 'game-dev', research: 'research' };

const TRACK_SHORT: Record<string, string> = {
  fundamentals: 'Fundamentals', prompting: 'Prompting and context', 'claude-code': 'Claude Code', agents: 'Agents', 'mcp-tools': 'MCP and tools', automation: 'Automation', engineering: 'Engineering practice',
  'game-dev': 'Game development', research: 'Research', ecosystem: 'Ecosystem', 'safety-eval': 'Safety and evaluation', advanced: 'Advanced systems',
};

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

  const available = LESSONS.length;
  const plannedTopics = TRACKS.reduce((n, t) => n + t.topics.filter((x) => !x.lessonId).length, 0);

  return (
    <div>
      <PageHeader art="academy" eyebrow="Learn" title="Twelve tracks, one goal: use AI well" subtitle={`${passed} of ${available} available lessons passed. Each lesson: learn → practice (guided) → assess (independent) → apply to real work. ${plannedTopics} further topics are planned and clearly marked: nothing is shown as available until a lesson exists.`} actions={<><LinkButton to="/academy/opportunity-finder" variant="secondary" data-testid="open-finder">AI Opportunity Finder</LinkButton><LinkButton to="/explore" variant="secondary">Capability map</LinkButton></>} />
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
      <nav aria-label="Jump to a track" className="mb-6 flex flex-wrap gap-2" data-testid="track-jump">
        {TRACKS.map((t) => {
          const n = LESSONS.filter((x) => x.track === t.id).length;
          return <a key={t.id} href={`#track-${t.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`track-${t.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="transition-forge inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm hover:bg-surface2">{t.order}. {TRACK_SHORT[t.id] ?? t.title} <Badge tone={n > 0 ? 'ok' : 'neutral'}>{n > 0 ? `${n} lesson${n === 1 ? '' : 's'}` : 'planned'}</Badge></a>;
        })}
      </nav>
      <div className="space-y-8">
        {TRACKS.map((t) => {
          const lessons = LESSONS.filter((x) => x.track === t.id).sort((a, b) => a.order - b.order);
          const alsoIn = LESSONS.filter((x) => x.track !== t.id && x.alsoIn?.includes(t.id));
          const planned = t.topics.filter((x) => !x.lessonId);
          return (
            <section key={t.id} aria-labelledby={`track-${t.id}`} data-testid={`track-${t.id}`}>
              <div className="flex items-start gap-5">
                <div className="min-w-0 flex-1">
                  <h2 id={`track-${t.id}`} className="text-xl font-semibold"><span className="mr-2 text-accent-text">Track {t.order}</span>{t.title}</h2>
                  <p className="mt-1 max-w-prose text-muted">{t.summary}</p>
                  <p className="mt-1 max-w-prose text-sm"><strong>After this track:</strong> <span className="text-muted">{t.outcome}</span></p>
                </div>
                {TRACK_ART[t.id] && <div className="hidden w-40 shrink-0 md:block" aria-hidden="true"><Illustration name={TRACK_ART[t.id]!} /></div>}
              </div>
              {lessons.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-line p-3 text-sm text-muted" data-testid={`planned-${t.id}`}>No lesson in this track is available yet. The topics below are planned, not available.</p>}
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
              {alsoIn.length > 0 && <p className="mt-2 text-sm text-muted">Also relevant here: {alsoIn.map((x, i) => <span key={x.id}>{i > 0 && ', '}<Link className="text-accent-text underline" to={`/academy/lesson/${x.id}`}>{x.title}</Link></span>)}.</p>}
              {planned.length > 0 && (
                <details className="mt-3 rounded-lg border border-dashed border-line p-3 text-sm text-muted">
                  <summary className="cursor-pointer font-semibold">{planned.length} planned topic{planned.length === 1 ? '' : 's'} (not available yet)</summary>
                  <ul className="mt-2 list-disc pl-5">{planned.map((p) => <li key={p.title}>{p.title} <Badge>planned</Badge></li>)}</ul>
                </details>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

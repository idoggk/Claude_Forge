import { Link } from 'react-router-dom';
import { LESSONS } from '@/content/lessons';
import { COMPETENCIES, TRACKS } from '@/domain/curriculum/competencies';
import { LEVEL_NAMES } from '@/domain/mastery/competency';
import { lessonStatus, recommend } from '@/domain/mastery/recommend';
import { dueReviews } from '@/domain/mastery/review';
import { formatDateKey, todayKey } from '@/lib/clock';
import { Badge, Card, EmptyState, LinkButton, PageHeader, ProgressBar, Spinner } from '@/components/ui';
import { useActivityRuns, useArsenal, useExperiments, useGoals, useLearning, usePlaybooks } from '@/app/hooks';
import { goalLessons } from '@/content/capability/goals';
import { practiceGapsFromRuns } from '@/domain/finder/score';
import { CAPABILITY_BY_ID } from '@/content/capability/map';
import { useLoops } from '@/features/loop/useLoop';
import { MISSIONS } from '@/content/missions';
import { latestHint } from '@/domain/mastery/diagnostic';
import { misconceptionsHit } from '@/domain/mastery/reviewPlan';
import { useData } from '@/app/providers/DataProvider';
import { ARSENAL_STATUSES } from '@/persistence/schemas';

export default function MissionControl() {
  const { data: l } = useLearning();
  const { data: arsenal } = useArsenal();
  const { data: experiments } = useExperiments();
  const { data: loops } = useLoops();
  const { data: goals } = useGoals();
  const { data: runs } = useActivityRuns();
  const { data: playbooks } = usePlaybooks();
  const { profile } = useData();
  if (!l || !arsenal || !experiments || !loops || !goals || !runs || !playbooks) return <Spinner label="Loading Mission Control" />;

  const today = todayKey();
  const hint = latestHint(l.diagnostics);
  const rec = recommend({
    lessons: LESSONS, attempts: l.attempts, progress: l.progress, reviews: l.reviews, profile: profile ?? null, today,
    diagnostic: hint,
    misconceptionHits: misconceptionsHit(l.attempts, LESSONS).slice(0, 6),
    goalLessons: goalLessons(goals),
    practiceGaps: practiceGapsFromRuns(runs),
    loop: { prerequisites: MISSIONS[0]!.prerequisites, started: loops.length },
  });
  const p = rec.primary;
  const due = dueReviews(l.reviews, today);
  const lesson = p.lessonId ? LESSONS.find((x) => x.id === p.lessonId) : undefined;
  const track = lesson ? TRACKS.find((t) => t.id === lesson.track) : undefined;
  const trackLessons = track ? LESSONS.filter((x) => x.track === track.id) : [];
  const trackPassed = trackLessons.filter((x) => lessonStatus(x, l.attempts, l.progress) === 'passed').length;
  const upcoming = l.reviews.filter((r) => !due.includes(r)).sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
  const level = new Map(l.competencies.map((c) => [c.competencyId, c.level]));
  const inProgress = LESSONS.filter((x) => lessonStatus(x, l.attempts, l.progress) === 'in-progress' && x.id !== p.lessonId);
  const counts = Object.fromEntries(ARSENAL_STATUSES.map((s) => [s, arsenal.filter((a) => a.status === s).length]));
  const hasAnyProgress = l.attempts.length > 0;

  const primaryHref = p.kind === 'loop' ? '/loop' : p.kind === 'review' && p.lessonId ? `/academy/review/${p.lessonId}` : p.lessonId ? `/academy/lesson/${p.lessonId}` : '/growth';
  const primaryLabel = p.kind === 'loop' ? 'Open the Improvement Loop' : p.kind === 'review' ? 'Start review' : p.kind === 'retry' ? 'Retry the assessment' : p.kind === 'done' ? 'Open Growth' : lesson && lessonStatus(lesson, l.attempts, l.progress) === 'in-progress' ? 'Continue lesson' : 'Start mission';

  return (
    <div>
      <PageHeader art="hero-forge" eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} title={profile?.displayName ? `Welcome back, ${profile.displayName}` : 'Mission Control'} subtitle="One next step, the reason for it, and the evidence you have so far." />

      <Card className="border-accent" aria-labelledby="mission-title" data-testid="next-mission">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">{p.kind === 'review' ? 'Due now' : p.kind === 'retry' ? 'Close the gap' : p.kind === 'loop' ? 'Apply it' : 'Next mission'}</p>
        <h2 id="mission-title" className="mt-1 text-2xl font-semibold" data-testid="mission-title">{p.title}</h2>
        {lesson && <p className="mt-1 text-muted">{lesson.subtitle} · {lesson.effortMinutes} min</p>}
        <div className="mt-3 rounded-lg border border-line bg-surface2 p-3 text-sm">
          <p className="font-semibold">Why this, explained</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted" data-testid="mission-reasons">{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="mt-2 text-xs text-muted">A fixed scoring rule chose this - due reviews, prerequisites, failed attempts, your goals, interests and game-development relevance. It is not AI personalization.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <LinkButton to={primaryHref} variant="primary" size="lg" icon="arrow" data-testid="primary-action">{primaryLabel}</LinkButton>
          <LinkButton to="/academy" size="lg">Browse all lessons</LinkButton>
        </div>
        {rec.alternatives.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Other good options</summary>
            <ul className="mt-1 space-y-1">{rec.alternatives.map((a) => <li key={a.lessonId ?? a.title}><Link className="text-accent-text underline" to={a.kind === 'loop' ? '/loop' : a.kind === 'review' ? `/academy/review/${a.lessonId}` : `/academy/lesson/${a.lessonId}`}>{a.title}</Link> <span className="text-muted">- {a.reasons[0]}</span></li>)}</ul>
          </details>
        )}
      </Card>

      <Card className="mt-5" aria-labelledby="loop-h" data-testid="loop-card">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">Skill Improvement Loop</p>
        {(() => {
          const act = loops.find((x) => x.status === 'active');
          const m = MISSIONS[0]!;
          const grads = loops.filter((x) => x.status === 'graduated').length;
          return (
            <>
              <h2 id="loop-h" className="mt-1 text-lg font-semibold">{act ? `Continue: ${MISSIONS.find((x) => x.id === act.missionId)?.title ?? 'your loop'}` : m.title}</h2>
              <p className="mt-1 text-sm text-muted">{act ? 'Your loop is in progress. Everything you recorded is saved.' : 'Build a Skill, measure it against no Skill, revise it from what you saw, then test it on proposals it was never tuned for.'}{grads > 0 ? ` ${grads} graduated.` : ''}</p>
              <div className="mt-3"><LinkButton to={act ? `/loop/${act.id}` : '/loop'} variant={hasAnyProgress ? 'primary' : 'secondary'} icon="arrow" data-testid="loop-card-action">{act ? 'Continue the loop' : 'Open the Skill Improvement Loop'}</LinkButton></div>
            </>
          );
        })()}
      </Card>

      {inProgress.length > 0 && (
        <p className="mt-3 text-sm text-muted">Also in progress: {inProgress.map((x, i) => <span key={x.id}>{i > 0 && ', '}<Link className="text-accent-text underline" to={`/academy/lesson/${x.id}`}>{x.title}</Link></span>)}</p>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Card aria-labelledby="track-h">
          <h2 id="track-h" className="text-lg font-semibold">Active track</h2>
          {track ? (
            <>
              <p className="mt-1 font-semibold">Track {track.order} · {track.title}</p>
              <p className="text-sm text-muted">{track.summary}</p>
              <div className="mt-3"><ProgressBar value={trackPassed} max={trackLessons.length} label={`Lessons passed in track ${track.id}`} /></div>
              <p className="mt-1 text-xs text-muted">{trackPassed} of {trackLessons.length} lessons passed</p>
            </>
          ) : <p className="mt-1 text-sm text-muted">All current tracks are complete.</p>}
        </Card>

        <Card aria-labelledby="review-h">
          <h2 id="review-h" className="text-lg font-semibold">Review queue</h2>
          {due.length > 0 ? (
            <ul className="mt-2 space-y-2" data-testid="due-reviews">
              {due.map((d) => (
                <li key={d.lessonId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{LESSONS.find((x) => x.id === d.lessonId)?.title} <span className="text-muted">· due {formatDateKey(d.dueOn)}</span></span>
                  <LinkButton size="sm" variant="primary" to={`/academy/review/${d.lessonId}`}>Review</LinkButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted" data-testid="no-reviews">{upcoming ? `Nothing due. Next review: ${LESSONS.find((x) => x.id === upcoming.lessonId)?.title} on ${formatDateKey(upcoming.dueOn)}.` : 'Reviews appear here after you submit your first assessment.'}</p>
          )}
        </Card>

        <Card aria-labelledby="comp-h" className="md:col-span-2">
          <div className="flex items-center justify-between gap-2"><h2 id="comp-h" className="text-lg font-semibold">Competency progress</h2><Link to="/growth" className="text-sm text-accent-text underline">Evidence &amp; history</Link></div>
          {!hasAnyProgress && <p className="mt-1 text-sm text-muted">No demonstrated skills yet. Levels rise only from graded work: 0 Unseen → 1 Recognizes → 2 Guided → 3 Independent → 4 Field-proven.</p>}
          <ul className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {COMPETENCIES.map((c) => {
              const lv = level.get(c.id) ?? 0;
              return (
                <li key={c.id}>
                  <div className="flex justify-between gap-2 text-sm"><span className="font-medium">{c.title}</span><span className="text-muted">{LEVEL_NAMES[lv]}</span></div>
                  <ProgressBar value={lv} max={4} label={`${c.title} level ${lv} of 4`} tone={lv >= 3 ? 'ok' : 'accent'} />
                </li>
              );
            })}
          </ul>
        </Card>

        <Card aria-labelledby="exp-h">
          <div className="flex items-center justify-between gap-2"><h2 id="exp-h" className="text-lg font-semibold">Recent experiments</h2><LinkButton size="sm" to="/battle-lab" icon="flask">AI Lab</LinkButton></div>
          {experiments.length === 0 ? <p className="mt-1 text-sm text-muted">None yet. Compare a prompt, Skill, workflow, tool or model against a baseline - or open the synthetic demo to see how.</p> : (
            <ul className="mt-2 space-y-1 text-sm">{experiments.slice(0, 3).map((e) => <li key={e.id}><Link className="text-accent-text underline" to={`/battle-lab/${e.id}`}>{e.title}</Link> <Badge>{e.status}</Badge></li>)}</ul>
          )}
        </Card>

        <Card aria-labelledby="arsenal-h">
          <div className="flex items-center justify-between gap-2"><h2 id="arsenal-h" className="text-lg font-semibold">Skill Arsenal</h2><LinkButton size="sm" to="/arsenal" icon="shield">Open</LinkButton></div>
          {arsenal.length === 0 ? <p className="mt-1 text-sm text-muted">Empty. Add items from the Discovery Hub to track what you are evaluating, using or rejecting.</p> : (
            <p className="mt-2 flex flex-wrap gap-2 text-sm">{ARSENAL_STATUSES.filter((s) => counts[s]).map((s) => <Badge key={s} tone={s === 'rejected' ? 'bad' : s === 'mastered' ? 'ok' : 'neutral'}>{counts[s]} {s}</Badge>)}</p>
          )}
        </Card>
      </div>

      <Card className="mt-5" aria-labelledby="goals-h2" data-testid="home-goals">
        <div className="flex items-center justify-between gap-2"><h2 id="goals-h2" className="text-lg font-semibold">My learning goals</h2><LinkButton size="sm" to="/explore" icon="compass">Capability Map</LinkButton></div>
        {goals.filter((g) => g.status === 'active').length === 0 ? (
          <p className="mt-1 text-sm text-muted">No goals yet. Pick a capability on the Capability Map and save it as a goal; Forge will weigh it when recommending your next lesson.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">{goals.filter((g) => g.status === 'active').map((g) => <li key={g.id}><span className="font-semibold">{g.title}</span> <span className="text-muted">· {g.capabilityIds.map((id) => CAPABILITY_BY_ID.get(id)?.title ?? id).join(', ')}</span></li>)}</ul>
        )}
      </Card>

      <div className="mt-5 flex flex-wrap gap-2">
        <LinkButton to="/explore" icon="compass">Capability Map</LinkButton>
        <LinkButton to="/academy/opportunity-finder" icon="search">Opportunity Finder</LinkButton>
        <LinkButton to="/playbooks" icon="flag">{playbooks.length ? `Playbooks (${playbooks.length})` : 'Workflow Playbooks'}</LinkButton>
        <LinkButton to="/battle-lab" icon="flask">AI Lab</LinkButton>
        <LinkButton to="/workshop" icon="hammer">Skill Workshop</LinkButton>
        <LinkButton to="/discovery" icon="search">Discovery Hub</LinkButton>
      </div>
      {!hasAnyProgress && <div className="mt-5"><EmptyState title="Your evidence starts with the first lesson" icon="target">Nothing here is pre-filled or simulated. Everything on this page comes from what you complete. Not sure where to begin? <Link className="text-accent-text underline" to="/academy/diagnostic">Take the five-minute placement diagnostic</Link> - it never changes your levels.</EmptyState></div>}
    </div>
  );
}

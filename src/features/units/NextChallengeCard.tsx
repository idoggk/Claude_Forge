import { Link } from 'react-router-dom';
import { Badge, Card, LinkButton } from '@/components/ui';
import type { LearningNow } from './useNextChallenge';
import { unitPath } from '@/domain/missions/next';

const KIND_LABEL: Record<string, string> = { continue: 'Pick up where you left off', review: 'Due now', suggestion: 'Fits your last results', intro: 'Try this first', spark: 'A short one', mission: 'A guided mission', 'caught-up': 'Keep it fresh' };

/**
 * The one thing to do now, with the three ways in. Times are editorial estimates, not a measurement of anyone's speed, and the
 * choice comes from the learner's own records by a fixed rule (see domain/missions/next.ts), not from AI personalisation.
 */
export function NextChallengeCard({ now }: { now: LearningNow }) {
  const c = now.challenge;
  return (
    <Card aria-labelledby="nc-h" className="mb-4 border-accent" data-testid="next-challenge">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">Your next challenge · {KIND_LABEL[c.kind] ?? ''}</p>
      <h2 id="nc-h" className="mt-1 text-2xl font-semibold" data-testid="next-challenge-title">{c.title}</h2>
      <p className="mt-1 text-sm text-muted" data-testid="next-challenge-why">{c.why}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <LinkButton to={c.to} variant="primary" size="lg" icon="arrow" data-testid="next-challenge-start">{c.label}</LinkButton>
        <Badge>about {c.minutes} min (estimate)</Badge>
      </div>
      <nav aria-label="Three ways to learn" className="mt-4 grid gap-2 border-t border-line pt-3 sm:grid-cols-3" data-testid="learn-modes">
        <Link to={now.spark ? unitPath(now.spark) : '/learn'} className="rounded-lg border border-line p-3 text-sm hover:bg-surface2" data-testid="mode-spark"><span className="font-semibold">Quick Spark</span> <span className="text-muted">· 3 min</span><span className="block text-xs text-muted">One problem, one decision.</span></Link>
        <Link to={now.mission ? unitPath(now.mission) : '/learn'} className="rounded-lg border border-line p-3 text-sm hover:bg-surface2" data-testid="mode-mission"><span className="font-semibold">Guided Mission</span> <span className="text-muted">· 8 min</span><span className="block text-xs text-muted">Predict, practise, then a challenge.</span></Link>
        <Link to="/deep-lab" className="rounded-lg border border-line p-3 text-sm hover:bg-surface2" data-testid="mode-deep-lab"><span className="font-semibold">Deep Lab</span> <span className="text-muted">· 25 min</span><span className="block text-xs text-muted">A real experiment with your own tools.</span></Link>
      </nav>
      <p className="mt-2 text-xs text-muted">{now.dueReviews > 0 ? <><Link className="underline" to="/review5" data-testid="mode-review">Review for 5 minutes</Link> ({now.dueReviews} due). </> : null}<Link className="underline" to="/learn">All sparks, missions and playgrounds</Link>. Finishing one is practice; independent assessments are what raise a level.</p>
    </Card>
  );
}

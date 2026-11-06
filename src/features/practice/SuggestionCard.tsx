import { Link } from 'react-router-dom';
import { Badge, Card } from '@/components/ui';
import { TIER_LABELS, type AdaptiveSuggestion } from '@/domain/mastery/adaptive';
import { COMPETENCY_BY_ID } from '@/domain/curriculum/competencies';

export function SuggestionCard({ s, testId }: { s: AdaptiveSuggestion; testId?: string }) {
  return (
    <Card aria-label={s.title} data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2"><Badge tone="accent">{TIER_LABELS[s.tier]}</Badge><h3 className="text-base font-semibold">{s.title}</h3></div>
      <dl className="mt-2 space-y-1.5 text-sm">
        <div><dt className="inline font-semibold">Why this: </dt><dd className="inline">{s.why}</dd></div>
        <div><dt className="inline font-semibold">Trains: </dt><dd className="inline">{s.competencies.map((c) => COMPETENCY_BY_ID[c]?.title ?? c).join('; ')}</dd></div>
        <div><dt className="inline font-semibold">Your evidence: </dt><dd className="inline">{s.evidence.join(' ')}</dd></div>
        <div><dt className="inline font-semibold">What would count as improvement: </dt><dd className="inline">{s.improvement}</dd></div>
      </dl>
      <p className="mt-2"><Link className="font-semibold text-accent-text underline" to={s.to}>Open</Link></p>
    </Card>
  );
}

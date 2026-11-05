import { Badge, Button, Callout, Card, EmptyState } from '@/components/ui';
import type { SkillDraft } from '@/domain/skills/model';
import { OUTCOME_LABEL, analyzeTuning, type Outcome } from '@/domain/skills/tuning';

const TONE: Record<Outcome, 'ok' | 'warn' | 'bad' | 'neutral' | 'teal'> = {
  'true-positive': 'ok', 'true-negative': 'ok', 'false-negative': 'bad', 'false-positive': 'bad', partial: 'warn', 'ambiguous-observed': 'neutral', 'unknown-observed': 'neutral', untested: 'neutral',
};
const EXPECT = { activate: 'Should activate', 'not-activate': 'Should not activate', ambiguous: 'Ambiguous' } as const;
const pct = (x: number | null) => (x === null ? 'unmeasured' : `${Math.round(x * 100)}%`);

/**
 * Trigger tuning: your expectation vs what YOU recorded in a real Claude Code session. Forge never observes Claude;
 * unobserved is unmeasured, and observations made against an older description are flagged and left out of the rates.
 */
export function TuningPanel({ draft, onGoLive }: { draft: SkillDraft; onGoLive: () => void }) {
  const t = analyzeTuning(draft);
  const problems = t.rows.filter((r) => !r.stale && (r.outcome === 'false-negative' || r.outcome === 'false-positive' || r.outcome === 'partial'));
  if (draft.scenarios.length === 0) {
    return <EmptyState title="No scenarios to tune yet" icon="target">Write trigger scenarios on the Scenarios &amp; Dojo tab (what should and should not activate this Skill), then record what really happens in the Live test tab.</EmptyState>;
  }
  return (
    <div className="space-y-4" data-testid="tuning">
      <Callout tone={t.level === 'none' || t.level === 'anecdotal' ? 'warn' : 'info'} title={t.headline} role="status">
        {t.notes.map((n) => <p key={n}>{n}</p>)}
      </Callout>

      <div className="grid gap-3 sm:grid-cols-4" data-testid="tuning-stats">
        <Card><p className="text-sm text-muted">Recall (should-activate that did)</p><p className="text-2xl font-semibold" data-testid="tuning-recall">{pct(t.recall)}</p><p className="text-xs text-muted">{t.counts['true-positive']} of {t.counted.positives} observed</p></Card>
        <Card><p className="text-sm text-muted">Precision (activations that should have)</p><p className="text-2xl font-semibold" data-testid="tuning-precision">{pct(t.precision)}</p><p className="text-xs text-muted">needs a should-not observation</p></Card>
        <Card><p className="text-sm text-muted">False negatives</p><p className="text-2xl font-semibold" data-testid="tuning-fn">{t.counted.positives === 0 ? 'unmeasured' : t.counts['false-negative'] + t.counts.partial}</p><p className="text-xs text-muted">missed or only after rephrasing</p></Card>
        <Card><p className="text-sm text-muted">False positives</p><p className="text-2xl font-semibold" data-testid="tuning-fp">{t.counted.negatives === 0 ? 'unmeasured' : t.counts['false-positive']}</p><p className="text-xs text-muted">activated when it should not</p></Card>
      </div>
      <p className="text-xs text-muted">Every number comes from live tests YOU recorded (self-reported). Untested scenarios are not counted as passes or misses. These are observations from a handful of runs, not a measurement of Claude.</p>

      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scenario results">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="sr-only">Each scenario: what you expected, what you recorded, and the outcome</caption>
          <thead><tr className="text-left"><th scope="col" className="border-b border-line p-2">Prompt</th><th scope="col" className="border-b border-line p-2">You expected</th><th scope="col" className="border-b border-line p-2">You recorded</th><th scope="col" className="border-b border-line p-2">Outcome</th></tr></thead>
          <tbody data-testid="tuning-rows">
            {t.rows.map((r) => (
              <tr key={r.scenario.id} className="align-top" data-outcome={r.stale ? 'stale' : r.outcome}>
                <th scope="row" className="border-b border-line p-2 text-left font-medium">&ldquo;{r.scenario.prompt}&rdquo;<span className="block text-xs font-normal text-muted">Wording overlap {Math.round(r.prediction.score * 100)}% (heuristic only)</span></th>
                <td className="border-b border-line p-2">{EXPECT[r.scenario.expected]}</td>
                <td className="border-b border-line p-2">{r.observation ? <>{r.observation.observed.replace('-', ' ')} <span className="block text-xs text-muted">{new Date(r.observation.testedAt).toLocaleDateString()}{r.observationCount > 1 ? ` · latest of ${r.observationCount}` : ''}</span></> : <span className="text-muted">not tested</span>}</td>
                <td className="border-b border-line p-2"><Badge tone={r.stale ? 'warn' : TONE[r.outcome]}>{r.stale ? 'Stale - older wording' : OUTCOME_LABEL[r.outcome]}</Badge>{r.versionUnknown && !r.stale && <span className="mt-1 block text-xs text-muted">wording tested is unknown</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {problems.length > 0 && (
        <section aria-labelledby="tune-h" className="space-y-2">
          <h2 id="tune-h" className="text-lg font-semibold">What to change, and why</h2>
          <ul className="space-y-2" data-testid="tuning-suggestions">
            {problems.map((r) => <Card as="li" key={r.scenario.id}><p className="font-medium">&ldquo;{r.scenario.prompt}&rdquo; · {OUTCOME_LABEL[r.outcome]}</p><p className="mt-1 text-sm text-muted">{r.suggestion}</p></Card>)}
          </ul>
          <p className="text-xs text-muted">Suggestions are from a transparent word-overlap heuristic. After you edit the description, record new live tests: old observations will be marked stale because they tested different wording.</p>
        </section>
      )}
      <Button onClick={onGoLive} data-testid="tuning-go-live">Record a live test</Button>
    </div>
  );
}

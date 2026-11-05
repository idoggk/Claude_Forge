import { Badge, Card } from '@/components/ui';
import type { Experiment } from '@/domain/experiments/model';
import { caseMatrix, matchStats, pct } from '@/domain/loop/engine';
import type { LoopMission, MissionCase } from '@/domain/loop/types';

const tone = (matched: boolean | null) => (matched === null ? 'neutral' : matched ? 'ok' : 'bad');

/** Verdict-match per condition + a per-case table. Ground truth is shown only when `reveal` is true. */
export function MatchSummary({ exp, mission, cases, reveal, showWhy }: { exp: Experiment; mission: LoopMission; cases: MissionCase[]; reveal: boolean; showWhy?: boolean }) {
  const stats = matchStats(exp, cases.map((c) => c.id));
  const rows = caseMatrix(exp, mission, cases, reveal);
  return (
    <div className="space-y-4" data-testid="match-summary">
      <ul className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Card as="li" key={s.conditionId}>
            <p className="text-sm font-semibold">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold" data-testid={`match-${s.conditionId}`}>{reveal ? pct(s.matched, s.graded) : '—'}</p>
            <p className="text-xs text-muted">{reveal ? `${mission.labels.answerNoun}s matched the ${mission.labels.truthShort}` : 'ground truth not applied yet'}{s.unclear > 0 ? ` · ${s.unclear} with no usable verdict` : ''}</p>
          </Card>
        ))}
      </ul>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Per-${mission.labels.caseNoun} results`}>
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">Recorded {mission.labels.answerNoun} per {mission.labels.caseNoun} and condition</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="border-b border-line p-2 capitalize">{mission.labels.caseNoun}</th>
              <th scope="col" className="border-b border-line p-2 capitalize">{mission.labels.truthShort} says</th>
              {exp.conditions.map((c) => <th scope="col" key={c.id} className="border-b border-line p-2">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.caseId} className="align-top">
                <th scope="row" className="border-b border-line p-2 text-left font-medium">{r.title}</th>
                <td className="border-b border-line p-2">{r.truth ? <Badge tone="accent">{r.truth}</Badge> : <span className="text-muted">hidden</span>}</td>
                {r.byCondition.map((c) => (
                  <td key={c.conditionId} className="border-b border-line p-2">
                    {c.verdict ? <Badge tone={tone(c.matched)}>{c.verdict}{c.matched === null ? '' : c.matched ? ' ✓ match' : ' ✗ mismatch'}</Badge> : <span className="text-muted">not recorded</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showWhy && reveal && (
        <details className="rounded-lg border border-line p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Why the {mission.labels.truthShort} says what it says</summary>
          <ul className="mt-2 space-y-2">
            {cases.map((c) => {
              const t = mission.truth(c.id);
              return t ? <li key={c.id}><strong>{c.title}</strong> → {t.verdict}. <span className="text-muted">{t.summary}</span></li> : null;
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

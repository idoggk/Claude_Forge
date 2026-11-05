import type { Experiment } from '@/domain/experiments/model';
import { compareExperiment, type ComparisonRow, type Stat } from '@/domain/experiments/compare';
import { Badge, Callout, cx } from '@/components/ui';

function fmt(row: ComparisonRow, s: Stat): string {
  if (s.mean === null) return s.unknown ? `unknown (${s.unknown} missing)` : 'no data';
  const f = (n: number) => (row.unit === 'ratio' ? n.toFixed(2) : Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${f(s.mean)} [${f(s.min as number)}–${f(s.max as number)}] n=${s.n}${s.sd !== null ? ` · sd ${f(s.sd)}` : ''}${s.unknown ? ` · ${s.unknown} missing` : ''}`;
}

const READING_TONE = { separated: 'ok', overlap: 'warn', 'one-sided': 'warn', 'no-data': 'neutral' } as const;

export function ComparisonView({ experiment, seededTotal = null }: { experiment: Experiment; seededTotal?: number | null }) {
  const c = compareExperiment(experiment, seededTotal);
  const tone = c.sufficiency.level === 'none' || c.sufficiency.level === 'anecdotal' ? 'warn' : 'info';
  const objective = c.rows.filter((r) => r.kind !== 'rubric');
  const rubric = c.rows.filter((r) => r.kind === 'rubric');

  const Row = ({ r }: { r: ComparisonRow }) => (
    <li className="rounded-lg border border-line p-3 md:hidden">
      <p className="font-semibold">{r.label} <span className="text-xs font-normal text-muted">({r.direction} is better)</span></p>
      <ul className="mt-1 space-y-1 text-sm">
        {r.perCondition.map((p) => <li key={p.conditionId}><strong>{p.label}:</strong> {fmt(r, p.stat)}</li>)}
      </ul>
      <p className="mt-1 text-xs text-muted"><Badge tone={READING_TONE[r.assessment]}>{r.assessment}</Badge> {r.text}</p>
    </li>
  );

  const table = (rows: ComparisonRow[], caption: string) =>
    rows.length === 0 ? null : (
      <>
        <h4 className="mt-4 font-semibold">{caption}</h4>
        <ul className="mt-2 space-y-2 md:hidden">{rows.map((r) => <Row key={r.id} r={r} />)}</ul>
        <div className="mt-2 hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label={`${caption} table`}>
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead><tr className="text-left"><th scope="col" className="border-b border-line p-2">Measure</th>{experiment.conditions.map((cd) => <th scope="col" key={cd.id} className="border-b border-line p-2">{cd.label}</th>)}<th scope="col" className="border-b border-line p-2">Reading</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <th scope="row" className="border-b border-line p-2 text-left font-semibold">{r.label}<span className="block text-xs font-normal text-muted">{r.direction} is better</span></th>
                  {r.perCondition.map((p) => <td key={p.conditionId} className={cx('border-b border-line p-2', p.stat.mean === null && 'text-muted italic')}>{fmt(r, p.stat)}</td>)}
                  <td className="border-b border-line p-2 text-muted"><Badge tone={READING_TONE[r.assessment]}>{r.assessment}</Badge><span className="mt-1 block text-xs">{r.text}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );

  return (
    <div className="space-y-4" data-testid="comparison">
      <Callout tone={tone} title={c.sufficiency.headline} role="status">
        {c.sufficiency.reasons.map((r) => <p key={r}>{r}</p>)}
        {c.detail && <p className="mt-1" data-testid="comparison-summary">{c.detail}</p>}
      </Callout>
      <div className="grid gap-2 sm:grid-cols-2">
        {c.runsPerCondition.map((r) => <div key={r.conditionId} className="rounded-lg border border-line p-3 text-sm"><strong>{r.label}</strong>: {r.recorded} attempt(s) recorded, {r.withData} with at least one known measurement{r.failed + r.abandoned > 0 && <> · <span className="font-semibold">{r.failed} failed, {r.abandoned} abandoned (kept)</span></>}</div>)}
      </div>
      <p className="text-xs text-muted">Format: mean [min–max] n=known values · sd = sample standard deviation (shown from two values, a description of spread only). No significance test is computed: with this few runs it would not mean what it appears to mean. &ldquo;unknown&rdquo; means nothing was recorded - it is never counted as zero. All values are self-reported or user-imported; Claude Forge verifies none of them.</p>
      {table(objective, 'Objective and measured results')}
      {table(rubric, 'Rubric scores (subjective, self-assessed, 0–3)')}
      {c.rubricTotal && (
        <div className="rounded-lg border border-line p-3 text-sm" data-testid="rubric-total">
          <p className="font-semibold">Rubric subtotal over criteria recorded for every condition</p>
          <p className="text-muted">Included: {c.rubricTotal.included.join(', ')}. Excluded (not zeroed): {c.rubricTotal.excluded.join(', ') || 'none'}.</p>
          <ul className="mt-1">{c.rubricTotal.totals.map((t) => <li key={t.conditionId}>{t.label}: {t.total.toFixed(2)} / {t.max}</li>)}</ul>
        </div>
      )}
      {c.integrity.length > 0 && (
        <div data-testid="integrity-notes">
          <h4 className="font-semibold">Integrity notes</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{c.integrity.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

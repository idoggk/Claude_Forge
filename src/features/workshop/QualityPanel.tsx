import { Badge, Callout, Card, Icon } from '@/components/ui';
import { useLive } from '@/persistence/useLive';
import { getDb } from '@/persistence/db';
import type { SkillDraft } from '@/domain/skills/model';
import { reviewQuality } from '@/domain/skills/quality';

const LABEL = ['Absent', 'Weak', 'Reasonable', 'Strong'] as const;
const TONE = ['bad', 'warn', 'teal', 'ok'] as const;

export function QualityPanel({ draft }: { draft: SkillDraft }) {
  const { data: loops } = useLive(() => getDb().loops.toArray(), []);
  const q = reviewQuality(draft, { loops: (loops ?? []).map((l) => ({ skillId: l.skillId, status: l.status })) });
  return (
    <div className="space-y-4" data-testid="quality">
      <Callout tone="info" title="A static review, not proof">{q.disclaimer}</Callout>

      <Card aria-labelledby="ladder-h">
        <h2 id="ladder-h" className="text-lg font-semibold">What this Skill has actually earned</h2>
        <ol className="mt-3 space-y-2" data-testid="maturity-ladder">
          {q.ladder.map((r) => (
            <li key={r.id} className="flex items-start gap-3" data-rung={r.id} data-reached={r.reached}>
              <Icon name={r.reached ? 'check' : r.id === 'field' ? 'lock' : 'x'} size={18} className={r.reached ? 'mt-0.5 text-ok' : 'mt-0.5 text-muted'} />
              <span className="min-w-0 text-sm"><strong>{r.label}</strong> <Badge tone={r.reached ? 'ok' : 'neutral'}>{r.reached ? 'reached' : 'not yet'}</Badge><span className="block text-muted">Requires: {r.requires}</span><span className="block text-muted">Found: {r.found}</span></span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted">A rung is ticked only when the matching evidence exists in your data. &ldquo;Field-proven&rdquo; is never ticked here: it needs your own recorded evidence from real project use.</p>
      </Card>

      <section aria-labelledby="dims-h" className="space-y-2">
        <h2 id="dims-h" className="text-lg font-semibold">Eight qualities <span className="text-sm font-normal text-muted">· {q.solid} of {q.dimensions.length} reasonable or strong</span></h2>
        <ul className="grid gap-3 md:grid-cols-2" data-testid="quality-dimensions">
          {q.dimensions.map((d) => (
            <Card as="li" key={d.id} data-dimension={d.id} data-score={d.score}>
              <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{d.title}</h3><Badge tone={TONE[d.score]}>{LABEL[d.score]} ({d.score}/3)</Badge></div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">{d.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
              {d.advice.length > 0 && <ul className="mt-2 space-y-0.5 text-sm">{d.advice.map((a) => <li key={a}><Icon name="arrow" size={12} className="mr-1 inline text-accent-text" />{a}</li>)}</ul>}
            </Card>
          ))}
        </ul>
      </section>
    </div>
  );
}

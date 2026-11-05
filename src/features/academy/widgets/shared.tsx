import { evaluateExternal } from '@/domain/assessment/external';
import type { ExternalCheckId } from '@/domain/curriculum/types';
import { Icon, ProgressBar, Spinner, cx } from '@/components/ui';
import { loadExternalInputs } from '@/persistence/repo';
import { useLive } from '@/persistence/useLive';
import type { Cell } from '@/fixtures/merge-cascade/board';

/** A live checklist verified from saved Workshop / Battle Lab data. */
export function LiveChecklist({ check, title }: { check: ExternalCheckId; title: string }) {
  const { data } = useLive(async () => {
    const i = await loadExternalInputs();
    return evaluateExternal(i.skills, i.experiments, i.evidence)[check];
  }, [check]);
  if (!data) return <Spinner label="Checking your saved work" />;
  return (
    <div className="rounded-xl border border-line bg-surface p-4" data-testid={`live-${check}`}>
      <h3 className="font-semibold">{title}</h3>
      <div className="my-2"><ProgressBar value={Math.round(data.progress * 100)} label={`${title} progress`} tone="teal" /></div>
      <ul className="space-y-1.5 text-sm">
        {data.checks.map((c, i) => (
          <li key={i} className="flex gap-2"><Icon name={c.ok ? 'check' : 'x'} size={16} className={cx('mt-1', c.ok ? 'text-ok' : 'text-muted')} /><span><span className="font-medium">{c.label}</span> <span className="text-muted">- {c.note}</span></span></li>
        ))}
      </ul>
    </div>
  );
}

const RANK_COLORS = ['', '#6cc4b8', '#78c796', '#f0b04a', '#f58a90', '#c9a0f0', '#8fb8f5', '#f2d36b'];

export function BoardView({ rows, label, highlight }: { rows: string[]; label: string; highlight?: Cell | null }) {
  return (
    <div role="img" aria-label={`${label}: ${rows.join(' / ').replace(/\./g, 'empty ')}`} className="inline-grid gap-1 rounded-lg border border-line bg-surface2 p-2" style={{ gridTemplateColumns: `repeat(${rows[0]?.length ?? 5}, 2rem)` }}>
      {rows.flatMap((row, r) =>
        [...row].map((ch, c) => {
          const rank = ch === '.' ? 0 : Number(ch);
          const hl = highlight && highlight.r === r && highlight.c === c;
          return (
            <div key={`${r}-${c}`} className={cx('flex h-8 w-8 items-center justify-center rounded text-sm font-bold', hl && 'ring-2 ring-accent')} style={{ background: rank ? RANK_COLORS[rank % RANK_COLORS.length] : 'var(--surface3)', color: rank ? '#10151c' : 'var(--muted)' }}>
              {rank || ''}
            </div>
          );
        }),
      )}
    </div>
  );
}

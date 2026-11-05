import { Icon, cx } from '@/components/ui';
import { STEP_LABELS, type LoopStepId } from '@/domain/loop/types';
import type { StepState } from '@/domain/loop/engine';

export function Stepper({ steps, shown, onSelect }: { steps: StepState[]; shown: LoopStepId; onSelect: (id: LoopStepId) => void }) {
  return (
    <nav aria-label="Skill Improvement Loop steps" data-testid="loop-stepper">
      <ol className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {steps.map((s, i) => {
          const locked = s.status === 'locked';
          const current = s.id === shown;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={locked}
                aria-current={current ? 'step' : undefined}
                title={locked ? s.lockedReason : s.summary}
                onClick={() => onSelect(s.id)}
                data-testid={`step-${s.id}`}
                data-status={s.status}
                className={cx(
                  'transition-forge flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-center text-xs font-semibold',
                  current ? 'border-accent bg-surface2 text-fg' : 'border-line text-muted hover:bg-surface2 hover:text-fg',
                  locked && 'cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted',
                )}
              >
                <span className={cx('flex h-6 w-6 items-center justify-center rounded-full border text-[0.7rem]', s.status === 'done' ? 'border-ok text-ok' : s.status === 'active' ? 'border-accent bg-accent text-accent-fg' : 'border-line')}>
                  {s.status === 'done' ? <Icon name="check" size={14} /> : locked ? <Icon name="lock" size={12} /> : i + 1}
                </span>
                <span>{STEP_LABELS[s.id].short}</span>
                <span className="sr-only">{s.status === 'done' ? ' (complete)' : s.status === 'locked' ? ' (locked)' : s.status === 'active' ? ' (next up)' : ''}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

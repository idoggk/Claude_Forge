import { useEffect, useState } from 'react';
import type { LoopBundle } from '@/persistence/loopRepo';
import type { LoopStepId } from '@/domain/loop/types';
import type { Requirement } from '@/domain/loop/engine';
import { Icon } from '@/components/ui';

export interface StepProps {
  bundle: LoopBundle;
  goto: (s: LoopStepId) => void;
}

export function RequirementList({ items, label = 'Requirements' }: { items: Requirement[]; label?: string }) {
  return (
    <ul aria-label={label} className="space-y-1 text-sm" data-testid="requirements">
      {items.map((r) => (
        <li key={r.id} className="flex items-start gap-2">
          <Icon name={r.ok ? 'check' : 'x'} size={16} className={r.ok ? 'mt-0.5 text-ok' : 'mt-0.5 text-muted'} />
          <span className={r.ok ? '' : 'text-muted'}><span className="sr-only">{r.ok ? 'Met: ' : 'Not met: '}</span>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** A per-viewer convenience: keep a half-written form across a trip to the Workshop. Never the source of truth. */
export function useSessionDraft<T>(key: string, initial: T): [T, (v: T) => void] {
  const read = (): T => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  };
  const [v, setV] = useState<T>(read);
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable: the form still works */ }
  }, [key, v]);
  return [v, setV];
}

export function StepHeading({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">Step {n} of 8</p>
      <h2 className="text-xl font-semibold" tabIndex={-1} data-testid="step-title">{title}</h2>
      {children && <div className="mt-1 max-w-prose text-sm text-muted">{children}</div>}
    </header>
  );
}

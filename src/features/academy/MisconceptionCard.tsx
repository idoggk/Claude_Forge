import { useState } from 'react';
import { Badge, Button, Icon, cx } from '@/components/ui';
import type { Misconception } from '@/content/misconceptions';

/**
 * Authored feedback for a specific wrong belief: what it is, why it is tempting, why it fails, a contrast example,
 * and a short corrective question. The corrective question is practice only and never touches mastery.
 */
export function MisconceptionCard({ m }: { m: Misconception }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const c = m.corrective;
  const options = c.kind === 'single' ? c.options : [];
  const right = c.kind === 'single' ? c.correct : '';
  return (
    <section aria-label="Misconception" className="mt-2 rounded-lg border border-warn bg-surface p-3" data-testid={`misconception-${m.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warn">Common misconception</Badge>
        <p className="font-semibold">“{m.belief}”</p>
      </div>
      <dl className="mt-2 space-y-1.5 text-sm">
        <div><dt className="inline font-semibold">Why it is tempting: </dt><dd className="inline text-muted">{m.whyPlausible}</dd></div>
        <div><dt className="inline font-semibold">What actually happens: </dt><dd className="inline text-muted">{m.whyWrong}</dd></div>
      </dl>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-line p-2 text-sm"><p className="flex items-center gap-1 font-semibold"><Icon name="x" size={14} className="text-bad" />Misconception</p><p className="text-muted">{m.contrast.wrong}</p></div>
        <div className="rounded-lg border border-line p-2 text-sm"><p className="flex items-center gap-1 font-semibold"><Icon name="check" size={14} className="text-ok" />Better</p><p className="text-muted">{m.contrast.right}</p></div>
      </div>
      <p className="mt-1 text-xs text-muted">{m.contrast.note}</p>
      <div className="mt-2">
        <Button size="sm" aria-expanded={open} onClick={() => setOpen(!open)} data-testid={`try-${m.id}`}>{open ? 'Hide the corrective question' : 'Try a corrective question'}</Button>
        <span className="ml-2 text-xs text-muted">Practice only - it does not count toward mastery.</span>
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-line p-3 text-sm" data-testid={`corrective-${m.id}`}>
          <p className="font-medium" id={`cq-${m.id}`}>{c.prompt}</p>
          <div role="radiogroup" aria-labelledby={`cq-${m.id}`} className="space-y-1.5">
            {options.map((o) => {
              const showState = checked && (o.id === right || o.id === pick);
              return (
                <label key={o.id} className={cx('flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-2', pick === o.id ? 'border-accent bg-surface2' : 'border-line', showState && o.id === right && 'border-ok')}>
                  <input type="radio" name={`cq-${m.id}`} checked={pick === o.id} disabled={checked} onChange={() => setPick(o.id)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                  <span>{o.text}{showState && <span className="mt-1 block text-xs text-muted"><strong>{o.id === right ? '✓ ' : '✗ '}</strong>{o.why}</span>}</span>
                </label>
              );
            })}
          </div>
          {!checked ? (
            <Button size="sm" variant="primary" disabled={!pick} onClick={() => setChecked(true)}>Check</Button>
          ) : (
            <p role="status" className="font-semibold" data-testid={`corrective-result-${m.id}`}>{pick === right ? 'Correct - that is the better idea.' : 'Not quite. Read the explanation above, then try again.'} <Button size="sm" variant="ghost" onClick={() => { setChecked(false); setPick(null); }}>Try again</Button></p>
          )}
        </div>
      )}
    </section>
  );
}

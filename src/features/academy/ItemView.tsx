import { useMemo } from 'react';
import type { Item } from '@/domain/curriculum/types';
import type { ExternalResult, ItemGrade } from '@/domain/assessment/grade';
import { seededOrder } from '@/domain/assessment/grade';
import { pickedMisconceptions } from '@/domain/assessment/misconception';
import { getMisconception } from '@/content/misconceptions';
import { MisconceptionCard } from './MisconceptionCard';
import { Badge, Button, CodeLines, Icon, Markdown, ProgressBar, cx } from '@/components/ui';

export interface ItemViewProps {
  item: Item;
  index: number;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
  grade?: ItemGrade;
  hintsShown: number;
  onHint?: () => void;
  external?: ExternalResult;
  seed: string;
  /** When set, answer options are shown in a deterministic per-attempt order so positions cannot be memorised. */
  optionSeed?: string;
}

const KIND_LABEL: Record<Item['kind'], string> = {
  single: 'Choose one',
  multi: 'Select all that apply',
  classify: 'Classify each',
  order: 'Put in order',
  numeric: 'Enter a number',
  keywords: 'Short answer (keyword-checked)',
  flaglines: 'Flag the lines',
  reflect: 'Self-assessment',
  external: 'Verified from your saved work',
};

export function initialValue(item: Item, seed: string): unknown {
  if (item.kind === 'order') return seededOrder(item.steps, `${seed}:${item.id}`).map((s) => s.id);
  return undefined;
}

export function ItemView({ item, index, value, onChange, disabled, grade, hintsShown, onHint, external, seed, optionSeed }: ItemViewProps) {
  const graded = Boolean(grade);
  // Grading is by option id, never by position, so showing options in a different order per attempt is safe.
  const shown: Item = useMemo(() => ((item.kind === 'single' || item.kind === 'multi') && optionSeed ? { ...item, options: seededOrder(item.options, `${optionSeed}:${item.id}`) } : item), [item, optionSeed]);
  return (
    <fieldset className="rounded-xl border border-line bg-surface p-4 sm:p-5" data-testid={`item-${item.id}`}>
      <legend className="sr-only">Question {index + 1}</legend>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge>Q{index + 1}</Badge>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{KIND_LABEL[item.kind]}</span>
        {item.critical && <Badge tone="warn" title="A missed mandatory check caps your level for this concept, whatever else you score.">Mandatory check</Badge>}
        {item.kind === 'reflect' && <Badge tone="teal">Self-assessed · not scored</Badge>}
        {graded && (
          <Badge tone={grade!.selfAssessed ? 'teal' : grade!.correct ? 'ok' : grade!.score > 0 ? 'warn' : 'bad'}>
            {grade!.selfAssessed ? 'Recorded' : grade!.correct ? '✓ Correct' : grade!.score > 0 ? `Partly right · ${Math.round(grade!.score * 100)}%` : '✗ Not yet'}
          </Badge>
        )}
      </div>
      <Markdown className="font-medium">{item.prompt}</Markdown>

      <div className="mt-3">
        <Body {...{ item: shown, value, onChange, disabled: disabled || graded, grade, external, seed }} />
      </div>

      {!graded && item.hints && item.hints.length > 0 && onHint && (
        <div className="mt-3">
          {item.hints.slice(0, hintsShown).map((h, i) => (
            <p key={i} className="mb-2 rounded-lg border border-line bg-surface2 p-2 text-sm"><Icon name="info" size={14} className="mr-1 inline text-teal" /><strong>Hint {i + 1}:</strong> {h}</p>
          ))}
          {hintsShown < item.hints.length && !disabled && (
            <Button size="sm" variant="ghost" onClick={onHint} data-testid={`hint-${item.id}`}>Show hint ({hintsShown}/{item.hints.length}) · marks this attempt as guided</Button>
          )}
        </div>
      )}

      {graded && <Feedback item={item} grade={grade!} value={value} />}
    </fieldset>
  );
}

function Feedback({ item, grade, value }: { item: Item; grade: ItemGrade; value: unknown }) {
  const misconceptions = pickedMisconceptions(item, value).map(getMisconception).filter((m): m is NonNullable<typeof m> => Boolean(m));
  return (
    <div className="mt-4 space-y-2 rounded-lg border border-line bg-surface2 p-3 text-sm" data-testid={`feedback-${item.id}`} aria-live="polite">
      <p className="font-semibold">{grade.feedback}</p>
      {grade.details.length > 0 && (
        <ul className="space-y-1.5">
          {grade.details.map((d, i) => (
            <li key={i} className="flex gap-2">
              <Icon name={d.ok ? 'check' : 'x'} size={16} className={cx('mt-1', d.ok ? 'text-ok' : 'text-bad')} />
              <span className="min-w-0"><span className="font-medium">{d.label}</span>{d.note && <span className="block text-muted">{d.note}</span>}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line pt-2 text-muted"><strong className="text-fg">Why it matters: </strong>{item.explanation}</p>
      {misconceptions.map((m) => <MisconceptionCard key={m.id} m={m} />)}
    </div>
  );
}

function Body({ item, value, onChange, disabled, grade, external, seed }: { item: Item; value: unknown; onChange: (v: unknown) => void; disabled: boolean; grade?: ItemGrade; external?: ExternalResult; seed: string }) {
  const name = `q-${item.id}`;
  switch (item.kind) {
    case 'single':
      return (
        <div role="radiogroup" aria-label={item.prompt} className="space-y-2">
          {item.options.map((o) => (
            <label key={o.id} className={cx('transition-forge flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3', value === o.id ? 'border-accent bg-surface2' : 'border-line hover:bg-surface2', disabled && 'cursor-default')}>
              <input type="radio" name={name} value={o.id} checked={value === o.id} disabled={disabled} onChange={() => onChange(o.id)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
              <span>{o.text}</span>
            </label>
          ))}
        </div>
      );
    case 'multi': {
      const sel = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <div className="space-y-2">
          {item.options.map((o) => (
            <label key={o.id} className={cx('transition-forge flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3', sel.has(o.id) ? 'border-accent bg-surface2' : 'border-line hover:bg-surface2', disabled && 'cursor-default')}>
              <input
                type="checkbox"
                checked={sel.has(o.id)}
                disabled={disabled}
                onChange={() => {
                  const next = new Set(sel);
                  if (next.has(o.id)) next.delete(o.id);
                  else next.add(o.id);
                  onChange([...next]);
                }}
                className="mt-1 h-4 w-4 accent-[var(--accent)]"
              />
              <span>{o.text}</span>
            </label>
          ))}
        </div>
      );
    }
    case 'classify': {
      const map = (value && typeof value === 'object' ? value : {}) as Record<string, string>;
      return (
        <div className="space-y-2">
          {item.entries.map((e) => (
            <div key={e.id} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_14rem] sm:items-center">
              <label htmlFor={`${name}-${e.id}`} className="text-sm">{e.text}</label>
              <select id={`${name}-${e.id}`} disabled={disabled} value={map[e.id] ?? ''} onChange={(ev) => onChange({ ...map, [e.id]: ev.target.value })} className="min-h-11 w-full rounded-lg border border-line bg-surface2 px-2 text-sm focus:border-accent">
                <option value="">Choose…</option>
                {item.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }
    case 'order': {
      const ids = Array.isArray(value) ? (value as string[]) : seededOrder(item.steps, `${seed}:${item.id}`).map((s) => s.id);
      const byId = new Map(item.steps.map((s) => [s.id, s]));
      const move = (i: number, d: number) => {
        const j = i + d;
        if (j < 0 || j >= ids.length) return;
        const next = ids.slice();
        [next[i], next[j]] = [next[j]!, next[i]!];
        onChange(next);
      };
      return (
        <ol className="space-y-2">
          {ids.map((id, i) => (
            <li key={id} className="flex items-center gap-2 rounded-lg border border-line p-2">
              <span className="w-6 text-center text-sm font-semibold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 text-sm">{byId.get(id)?.text}</span>
              {!disabled && (
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`} className="h-11 w-11 rounded-lg border border-line text-lg hover:bg-surface2 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === ids.length - 1} aria-label={`Move step ${i + 1} down`} className="h-11 w-11 rounded-lg border border-line text-lg hover:bg-surface2 disabled:opacity-30">↓</button>
                </span>
              )}
            </li>
          ))}
        </ol>
      );
    }
    case 'numeric':
      return (
        <div className="flex items-center gap-2">
          <label htmlFor={name} className="sr-only">Your answer</label>
          <input id={name} inputMode="decimal" autoComplete="off" disabled={disabled} value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} onChange={(e) => onChange(e.target.value)} placeholder="Type a number" className="min-h-11 w-48 rounded-lg border border-line bg-surface2 px-3 focus:border-accent" />
          {item.unit && <span className="text-sm text-muted">{item.unit}</span>}
        </div>
      );
    case 'keywords':
      return (
        <div>
          <label htmlFor={name} className="sr-only">Your answer</label>
          <textarea id={name} rows={3} disabled={disabled} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} placeholder={item.placeholder ?? 'Write one or two sentences'} className="w-full rounded-lg border border-line bg-surface2 p-3 focus:border-accent" />
          <p className="mt-1 text-xs text-muted">Checked deterministically for key ideas - not for quality of reasoning.</p>
        </div>
      );
    case 'flaglines': {
      const flagged = new Set(Array.isArray(value) ? (value as number[]) : []);
      const marks: Record<number, 'ok' | 'miss' | 'fp'> | undefined = grade
        ? Object.fromEntries([
            ...item.targets.map((t) => [t.line, flagged.has(t.line) ? 'ok' : 'miss'] as const),
            ...[...flagged].filter((l) => !item.targets.some((t) => t.line === l)).map((l) => [l, 'fp'] as const),
          ])
        : undefined;
      return (
        <div>
          <p className="mb-2 text-sm text-muted">{item.filename} - tap or press Enter on a line to flag it. {flagged.size} flagged.</p>
          <CodeLines label={item.filename} lines={item.lines} flagged={flagged} marks={marks} onToggle={disabled ? undefined : (n) => { const s = new Set(flagged); if (s.has(n)) s.delete(n); else s.add(n); onChange([...s].sort((a, b) => a - b)); }} />
        </div>
      );
    }
    case 'reflect': {
      const checked = (value && typeof value === 'object' ? value : {}) as Record<string, boolean>;
      return (
        <div className="space-y-2">
          {item.rubric.map((r, i) => (
            <label key={i} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-3">
              <input type="checkbox" disabled={disabled} checked={checked[String(i)] === true} onChange={(e) => onChange({ ...checked, [String(i)]: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
              <span className="text-sm">{r}</span>
            </label>
          ))}
        </div>
      );
    }
    case 'external':
      return external ? (
        <div className="space-y-2" data-testid={`external-${item.id}`}>
          <ProgressBar value={Math.round(external.progress * 100)} label="Checklist progress" tone="teal" />
          <ul className="space-y-1.5 text-sm">
            {external.checks.map((c, i) => (
              <li key={i} className="flex gap-2"><Icon name={c.ok ? 'check' : 'x'} size={16} className={cx('mt-1', c.ok ? 'text-ok' : 'text-muted')} /><span><span className="font-medium">{c.label}</span> <span className="text-muted">- {c.note}</span></span></li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">Checking your saved work…</p>
      );
  }
}

export function useInitialAnswers(items: Item[], seed: string): Record<string, unknown> {
  return useMemo(() => Object.fromEntries(items.map((i) => [i.id, initialValue(i, seed)]).filter(([, v]) => v !== undefined)), [items, seed]);
}

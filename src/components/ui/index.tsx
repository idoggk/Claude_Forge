import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { Illustration, type ForgeArt } from './Illustration';
import { isSafeExternalUrl } from '@/lib/safeUrl';

export { Icon } from './Icon';
export { Illustration, HomeImage, artUrl, homeArtUrl } from './Illustration';
export type { ForgeArt, HomeArt } from './Illustration';
export type { IconName } from './Icon';
export { Markdown } from './Markdown';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* -------------------------------- buttons -------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const BTN_BASE = 'transition-forge inline-flex items-center justify-center gap-2 rounded-lg font-semibold select-none disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface2 text-fg border border-line hover:bg-surface3',
  ghost: 'text-fg hover:bg-surface2',
  danger: 'bg-transparent text-bad border border-bad hover:bg-surface2',
};
const BTN_SIZE: Record<Size, string> = { sm: 'min-h-9 px-3 text-sm', md: 'min-h-11 px-4 text-[0.95rem]', lg: 'min-h-12 px-5 text-base' };

export function Button({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: IconName }) {
  return (
    <button type={type} className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

export function LinkButton({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: LinkProps & { variant?: Variant; size?: Size; icon?: IconName }) {
  return (
    <Link className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </Link>
  );
}

export function CopyButton({ text, label = 'Copy', what = 'text', size = 'sm' }: { text: string; label?: string; what?: string; size?: Size }) {
  const toast = useToast();
  return (
    <Button
      size={size}
      icon="copy"
      aria-label={`${label} ${what}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast(`Copied ${what}`);
        } catch {
          toast('Copy is blocked by this browser; select the text and copy it manually', 'bad');
        }
      }}
    >
      {label}
    </Button>
  );
}

/** Two-step destructive confirmation without a modal: first click arms, second click confirms. */
export function ConfirmButton({ label, confirmLabel = 'Confirm', onConfirm, icon = 'trash', size = 'sm' }: { label: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; icon?: IconName; size?: Size }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(t);
  }, [armed]);
  if (!armed) return <Button variant="danger" size={size} icon={icon} onClick={() => setArmed(true)}>{label}</Button>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label={`Confirm: ${label}`}>
      <Button variant="danger" size={size} onClick={() => { setArmed(false); void onConfirm(); }}>{confirmLabel}</Button>
      <Button variant="ghost" size={size} onClick={() => setArmed(false)}>Cancel</Button>
    </span>
  );
}

/* --------------------------------- surfaces -------------------------------- */

export function Card({ children, className, as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' | 'li' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cx('rounded-xl border border-line bg-surface p-4 sm:p-5', className)} {...(rest as object)}>
      {children}
    </Tag>
  );
}

type Tone = 'neutral' | 'accent' | 'teal' | 'ok' | 'warn' | 'bad';
const TONE: Record<Tone, string> = {
  neutral: 'bg-surface2 text-muted border-line',
  accent: 'bg-surface2 text-accent-text border-accent',
  teal: 'bg-surface2 text-teal border-teal',
  ok: 'bg-surface2 text-ok border-ok',
  warn: 'bg-surface2 text-warn border-warn',
  bad: 'bg-surface2 text-bad border-bad',
};

export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-5 max-w-full break-words', TONE[tone])}>
      {children}
    </span>
  );
}

const CALLOUT: Record<'info' | 'warn' | 'bad' | 'ok', { icon: IconName; cls: string }> = {
  info: { icon: 'info', cls: 'border-teal' },
  warn: { icon: 'alert', cls: 'border-warn' },
  bad: { icon: 'alert', cls: 'border-bad' },
  ok: { icon: 'check', cls: 'border-ok' },
};

export function Callout({ tone = 'info', title, children, role }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; title?: string; children?: ReactNode; role?: 'alert' | 'status' }) {
  const c = CALLOUT[tone];
  const iconTone = tone === 'info' ? 'text-teal' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-ok';
  return (
    <div role={role} className={cx('flex gap-3 rounded-lg border-l-4 bg-surface2 p-3 text-sm', c.cls)}>
      <Icon name={c.icon} className={cx('mt-0.5', iconTone)} />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-muted [&_a]:text-accent-text [&_a]:underline">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action, icon = 'info' }: { title: string; children?: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-6 text-center">
      <Icon name={icon} size={28} className="mx-auto text-muted" />
      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      {children && <div className="mx-auto mt-1 max-w-prose text-sm text-muted">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 p-6 text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function ProgressBar({ value, max = 100, label, tone = 'accent' }: { value: number; max?: number; label: string; tone?: 'accent' | 'teal' | 'ok' }) {
  const pct = max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 w-full overflow-hidden rounded-full bg-surface3">
      <div className={cx('h-full rounded-full', tone === 'accent' ? 'bg-accent' : tone === 'teal' ? 'bg-teal' : 'bg-ok')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, eyebrow, actions, art }: { title: string; subtitle?: ReactNode; eyebrow?: string; actions?: ReactNode; art?: ForgeArt }) {
  const header = (
    <header className={cx('flex flex-wrap items-end justify-between gap-3', art ? 'min-w-0 flex-1' : 'mb-5')}>
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 max-w-prose text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
  if (!art) return header;
  // One decorative illustration per major screen: hidden on small screens so the heading and content stay first.
  return (
    <div className="mb-5 flex items-center gap-6">
      {header}
      <div className="hidden w-52 shrink-0 md:block lg:w-64" aria-hidden="true"><Illustration name={art} /></div>
    </div>
  );
}

export function SafeLink({ href, children, className }: { href: string | null | undefined; children: ReactNode; className?: string }) {
  if (!isSafeExternalUrl(href)) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={cx('inline-flex items-center gap-1 text-accent-text underline underline-offset-2 break-all', className)}>
      {children}
      <Icon name="link" size={14} />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/* ---------------------------------- forms ---------------------------------- */

const INPUT = 'transition-forge w-full min-h-11 rounded-lg border border-line bg-surface2 px-3 py-2 text-[0.95rem] text-fg placeholder:text-muted focus:border-accent disabled:opacity-60';

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-semibold">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}

export function TextInput({ label, hint, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input id={id} className={INPUT} aria-invalid={error ? true : undefined} {...rest} />
    </Field>
  );
}

export function TextArea({ label, hint, error, rows = 4, mono, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string | null; mono?: boolean }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <textarea id={id} rows={rows} className={cx(INPUT, 'resize-y', mono && 'font-mono text-sm')} aria-invalid={error ? true : undefined} {...rest} />
    </Field>
  );
}

export function SelectField({ label, hint, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select id={id} className={INPUT} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface2 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={cx('transition-forge min-h-9 rounded-md px-3 text-sm font-semibold', value === o.value ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- tabs ---------------------------------- */

export function Tabs<T extends string>({ label, tabs, value, onChange, idPrefix = '' }: { label: string; tabs: { id: T; label: string; badge?: ReactNode }[]; value: T; onChange: (id: T) => void; idPrefix?: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
    onChange(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[t.id] = el; }}
          role="tab"
          id={`${idPrefix}tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`${idPrefix}panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
          className={cx('transition-forge inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold', value === t.id ? 'border-accent bg-surface2 text-fg' : 'border-transparent text-muted hover:bg-surface2 hover:text-fg')}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, children, idPrefix = '' }: { id: string; active: boolean; children: ReactNode; idPrefix?: string }) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`${idPrefix}panel-${id}`} aria-labelledby={`${idPrefix}tab-${id}`} tabIndex={0} className="mt-4 focus:outline-none">
      {children}
    </div>
  );
}

/* --------------------------------- code view -------------------------------- */

export function CodeLines({ lines, flagged, onToggle, marks, label, startLine = 1 }: { lines: string[]; flagged?: Set<number>; onToggle?: (line: number) => void; marks?: Record<number, 'ok' | 'miss' | 'fp'>; label: string; startLine?: number }) {
  const toneFor = (n: number) => {
    const m = marks?.[n];
    if (m === 'ok') return 'bg-surface3 border-l-ok';
    if (m === 'miss') return 'bg-surface3 border-l-warn';
    if (m === 'fp') return 'bg-surface3 border-l-bad';
    return flagged?.has(n) ? 'bg-surface3 border-l-accent' : 'border-l-transparent';
  };
  return (
    <div role="group" aria-label={label} tabIndex={onToggle ? undefined : 0} className="code-scroll rounded-lg border border-line bg-surface2 py-1 font-mono text-[0.8rem] leading-6">
      {lines.map((text, i) => {
        const n = i + startLine;
        const inner = (
          <>
            <span className="w-8 shrink-0 select-none pr-2 text-right text-muted">{n}</span>
            <span className="whitespace-pre pr-3">{text || ' '}</span>
            {marks?.[n] && <span className="ml-auto pr-2 text-xs font-sans font-semibold">{marks[n] === 'ok' ? '✓ found' : marks[n] === 'miss' ? '• missed' : '✗ false positive'}</span>}
          </>
        );
        return onToggle ? (
          <button
            key={n}
            type="button"
            aria-pressed={flagged?.has(n) ?? false}
            onClick={() => onToggle(n)}
            className={cx('flex min-h-8 w-full min-w-max items-center border-l-4 text-left transition-forge hover:bg-surface3', toneFor(n))}
          >
            {inner}
          </button>
        ) : (
          <div key={n} className={cx('flex min-w-max items-center border-l-4', toneFor(n))}>{inner}</div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- toasts ---------------------------------- */

const ToastCtx = createContext<(msg: string, tone?: 'ok' | 'bad') => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: 'ok' | 'bad' }[]>([]);
  const counter = useRef(0);
  const push = useCallback((msg: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = ++counter.current;
    setItems((cur) => [...cur.slice(-2), { id, msg, tone }]);
    setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), tone === 'bad' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border bg-surface3 px-4 py-2 text-sm font-semibold shadow-lg', t.tone === 'ok' ? 'border-ok' : 'border-bad')}>
            <Icon name={t.tone === 'ok' ? 'check' : 'alert'} size={16} className={t.tone === 'ok' ? 'text-ok' : 'text-bad'} />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export { cx };

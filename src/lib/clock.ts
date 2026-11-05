/**
 * Clock + calendar-day helpers.
 *
 * Spaced review works on *local calendar days* (YYYY-MM-DD), never on raw
 * millisecond deltas, so daylight-saving changes and timezone travel cannot
 * make a review 23 or 25 hours "late". Day arithmetic is done in UTC on the
 * date components only, which has no DST discontinuities.
 *
 * A visible "time travel" offset (Settings → Testing tools) lets you verify
 * review scheduling without waiting days. It is stored in localStorage.
 */
const OFFSET_KEY = 'forge.testClockOffsetDays';
const DAY_MS = 86_400_000;

export function getClockOffsetDays(): number {
  try {
    const raw = localStorage.getItem(OFFSET_KEY);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  } catch {
    return 0;
  }
}

export function setClockOffsetDays(days: number): void {
  try {
    if (days === 0) localStorage.removeItem(OFFSET_KEY);
    else localStorage.setItem(OFFSET_KEY, String(Math.trunc(days)));
  } catch {
    /* storage unavailable: the offset simply does not persist */
  }
}

export function nowMs(): number {
  return Date.now() + getClockOffsetDays() * DAY_MS;
}

export function nowIso(): string {
  return new Date(nowMs()).toISOString();
}

/** Local calendar day for a Date, e.g. "2026-11-05". */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date(nowMs()));
}

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(s: string): boolean {
  if (!KEY_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function addDaysToKey(key: string, days: number): string {
  if (!isDateKey(key)) throw new Error(`Invalid date key: ${key}`);
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** b - a in whole calendar days. */
export function daysBetweenKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

export function formatDateKey(key: string): string {
  if (!isDateKey(key)) return key;
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

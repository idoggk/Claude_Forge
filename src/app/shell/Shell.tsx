import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, artUrl, type IconName, cx } from '@/components/ui';
import { useData } from '../providers/DataProvider';
import { ErrorBoundary } from '../ErrorBoundary';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  testId: string;
}

interface NavGroup {
  /** Visible heading; omitted for the first group (Home). */
  heading?: string;
  items: NavItem[];
}

/** Six areas keep the sidebar short: Home, Learn, Explore, Lab, Build, My System. Test ids are stable across versions. */
export const NAV_GROUPS: NavGroup[] = [
  { items: [{ to: '/', label: 'Mission Control', icon: 'home', end: true, testId: 'nav-mission' }] },
  {
    heading: 'Learn',
    items: [
      { to: '/academy', label: 'Academy', icon: 'book', testId: 'nav-academy' },
      { to: '/loop', label: 'Improvement Loop', icon: 'target', testId: 'nav-loop' },
    ],
  },
  {
    heading: 'Explore',
    items: [
      { to: '/explore', label: 'Capability Map', icon: 'compass', testId: 'nav-explore' },
      { to: '/discovery', label: 'Discovery Hub', icon: 'search', testId: 'nav-discovery' },
    ],
  },
  { heading: 'Lab', items: [{ to: '/battle-lab', label: 'AI Lab', icon: 'flask', testId: 'nav-battle-lab' }] },
  {
    heading: 'Build',
    items: [
      { to: '/workshop', label: 'Skill Workshop', icon: 'hammer', testId: 'nav-workshop' },
      { to: '/playbooks', label: 'Workflow Playbooks', icon: 'flag', testId: 'nav-playbooks' },
    ],
  },
  { heading: 'My System', items: [{ to: '/arsenal', label: 'Arsenal & Growth', icon: 'shield', testId: 'nav-arsenal' }] },
];
export const PRIMARY_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

const MOBILE_NAV: NavItem[] = [
  { to: '/', label: 'Mission', icon: 'home', end: true, testId: 'mnav-mission' },
  { to: '/academy', label: 'Learn', icon: 'book', testId: 'mnav-academy' },
  { to: '/explore', label: 'Explore', icon: 'compass', testId: 'mnav-explore' },
  { to: '/battle-lab', label: 'Lab', icon: 'flask', testId: 'mnav-battle-lab' },
  { to: '/more', label: 'More', icon: 'more', testId: 'mnav-more' },
];

const linkCls = ({ isActive }: { isActive: boolean }) =>
  cx('transition-forge flex min-h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] font-semibold', isActive ? 'bg-surface2 text-fg shadow-[inset_3px_0_0_var(--accent)]' : 'text-muted hover:bg-surface2 hover:text-fg');

export function Shell() {
  const loc = useLocation();
  const nav = useNavigate();
  const { setPrefs, profile, profileLoading } = useData();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  const [q, setQ] = useState('');

  // Move focus to the page on route change so keyboard and screen-reader users start at the new content.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  // First visit: send people to onboarding (Settings stays reachable so a backup can be restored).
  const needsOnboarding = !profileLoading && !profile?.onboardedAt;
  const open = ['/onboarding', '/settings', '/more'];
  useEffect(() => {
    if (needsOnboarding && !open.includes(loc.pathname)) nav('/onboarding', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOnboarding, loc.pathname]);

  // Ctrl/Cmd+K jumps to search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        nav('/search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  const dark = document.documentElement.getAttribute('data-theme') !== 'light';

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>

      <aside className="hidden border-r border-line bg-surface lg:flex lg:h-dvh lg:flex-col lg:sticky lg:top-0" aria-label="Sidebar">
        <Link to="/" className="flex items-center gap-3 px-5 py-5" aria-label="Claude Forge home">
          <img src="./icon.svg" alt="" width={32} height={32} className="rounded-lg" />
          <span className="font-display text-xl font-semibold">Claude Forge</span>
        </Link>
        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3">
          {NAV_GROUPS.map((g, gi) => (
            <div key={g.heading ?? 'home'} className={gi === 0 ? '' : 'mt-3'}>
              {g.heading && <p className="px-3 pb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted" aria-hidden="true">{g.heading}</p>}
              <div className="space-y-1">
                {g.items.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end} className={linkCls} data-testid={n.testId}>
                    <Icon name={n.icon} />
                    {n.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          <NavLink to="/search" className={linkCls} data-testid="nav-search"><Icon name="search" />Search<kbd className="ml-auto rounded border border-line px-1.5 text-xs text-muted">Ctrl K</kbd></NavLink>
          <NavLink to="/settings" className={linkCls} data-testid="nav-settings"><Icon name="cog" />Settings</NavLink>
          <p className="px-3 pt-2 text-xs text-muted">Your data stays on this device.</p>
        </div>
      </aside>

      <div className="relative isolate min-w-0">
        <div aria-hidden="true" className="forge-contours pointer-events-none absolute inset-x-0 top-0 -z-10 h-96" style={{ backgroundImage: `url(${artUrl('background-contours')})` }} />
        <header className="safe-top sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur lg:px-8">
          <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="Claude Forge home">
            <img src="./icon.svg" alt="" width={28} height={28} className="rounded-md" />
            <span className="font-display text-lg font-semibold">Forge</span>
          </Link>
          <form
            role="search"
            className="ml-auto hidden max-w-md flex-1 lg:block"
            onSubmit={(e) => {
              e.preventDefault();
              nav(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <label htmlFor="global-search" className="sr-only">Search lessons, catalog and your Skills</label>
            <div className="relative">
              <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input id="global-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons, catalog, your Skills" className="min-h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm placeholder:text-muted focus:border-accent" />
            </div>
          </form>
          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <Link to="/search" className="transition-forge inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface2 hover:text-fg lg:hidden" aria-label="Search" data-testid="header-search"><Icon name="search" /></Link>
            <button
              type="button"
              className="transition-forge inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface2 hover:text-fg"
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={() => void setPrefs({ theme: dark ? 'light' : 'dark' })}
            >
              <Icon name={dark ? 'sun' : 'moon'} />
            </button>
          </div>
        </header>

        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 focus:outline-none lg:px-8 lg:pb-12">
          <ErrorBoundary resetKey={loc.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <nav aria-label="Primary mobile" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.end}
                data-testid={n.testId}
                className={({ isActive }) => cx('transition-forge flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold', isActive ? 'text-accent-text' : 'text-muted')}
              >
                <Icon name={n.icon} size={22} />
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

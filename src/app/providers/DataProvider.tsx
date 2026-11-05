import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getDb } from '@/persistence/db';
import { getPreferences, savePreferences } from '@/persistence/repo';
import type { Preferences } from '@/persistence/schemas';
import { useProfileLive } from '../hooks';
import { Button, Callout, Spinner } from '@/components/ui';
import type { Profile } from '@/persistence/schemas';

interface DataCtx {
  prefs: Preferences;
  setPrefs: (p: Partial<Omit<Preferences, 'id'>>) => Promise<void>;
  profile: Profile | undefined;
  profileLoading: boolean;
  /**
   * Make a just-saved profile visible immediately. The IndexedDB live query emits a moment later; without this,
   * navigating right after saving could momentarily see "not onboarded" and bounce the user back.
   */
  setProfileOptimistic: (p: Profile) => void;
}

const Ctx = createContext<DataCtx | null>(null);

export function useData(): DataCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}

function applyTheme(p: Preferences) {
  const root = document.documentElement;
  const dark = p.theme === 'dark' || (p.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-motion', p.motion);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e1319' : '#f6f2e9');
  try {
    localStorage.setItem('forge.theme', p.theme);
    localStorage.setItem('forge.motion', p.motion);
  } catch {
    /* blocked storage: the IndexedDB copy is authoritative */
  }
}

/**
 * Opens IndexedDB before rendering the app. If storage is unavailable (private window, blocked site data) we say so
 * plainly instead of pretending progress is being saved.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'opening' | 'ready' | 'failed'>('opening');
  const [error, setError] = useState('');
  const [prefs, setPrefsState] = useState<Preferences>({ id: 'prefs', theme: 'dark', motion: 'system' });
  const { data: liveProfile, loading: profileLoading } = useProfileLive();
  const [optimistic, setOptimistic] = useState<Profile | undefined>(undefined);
  // The live value wins as soon as it has caught up; until then the just-saved value is used.
  const profile = liveProfile?.onboardedAt || !optimistic ? liveProfile : optimistic;
  useEffect(() => {
    // Once the saved profile has caught up, drop the optimistic copy so a later reset is seen correctly.
    if (liveProfile?.onboardedAt) setOptimistic(undefined);
  }, [liveProfile]);

  const open = useCallback(async () => {
    setState('opening');
    try {
      await getDb().open();
      const p = await getPreferences();
      setPrefsState(p);
      applyTheme(p);
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('failed');
    }
  }, []);

  useEffect(() => {
    void open();
  }, [open]);

  useEffect(() => {
    if (prefs.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme(prefs);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [prefs]);

  const setPrefs = useCallback(async (patch: Partial<Omit<Preferences, 'id'>>) => {
    const next = await savePreferences(patch);
    setPrefsState(next);
    applyTheme(next);
  }, []);

  if (state === 'opening') return <Spinner label="Opening your local data" />;
  if (state === 'failed') {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold">Local storage is unavailable</h1>
        <div className="mt-4">
          <Callout tone="bad" title="Claude Forge cannot save your progress in this browser session" role="alert">
            <p>Progress, Skills and experiments are stored in your browser&apos;s IndexedDB. It could not be opened: {error}</p>
            <p className="mt-2">Common causes: a private/incognito window, blocked site data, or a full disk. Nothing is sent to a server, so there is no remote copy to fall back on.</p>
          </Callout>
        </div>
        <Button className="mt-4" variant="primary" onClick={() => void open()}>Try again</Button>
      </main>
    );
  }
  return <Ctx.Provider value={{ prefs, setPrefs, profile, profileLoading, setProfileOptimistic: setOptimistic }}>{children}</Ctx.Provider>;
}

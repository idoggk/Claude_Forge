import { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';

export interface LiveState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to a Dexie query. The component re-renders whenever the underlying
 * IndexedDB rows change, so UI always reflects persisted state.
 */
export function useLive<T>(querier: () => Promise<T> | T, deps: unknown[] = []): LiveState<T> {
  const [state, setState] = useState<LiveState<T>>({ data: undefined, loading: true, error: null });
  const ref = useRef(querier);
  ref.current = querier;
  useEffect(() => {
    setState((s) => ({ ...s, loading: s.data === undefined }));
    const sub = liveQuery(() => ref.current()).subscribe({
      next: (data) => setState({ data, loading: false, error: null }),
      error: (error: unknown) => setState({ data: undefined, loading: false, error: error instanceof Error ? error : new Error(String(error)) }),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

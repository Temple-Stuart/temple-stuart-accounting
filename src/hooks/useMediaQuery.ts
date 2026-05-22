'use client';

import { useEffect, useState } from 'react';

/**
 * useMediaQuery — SSR-safe `window.matchMedia` subscription.
 *
 * Returns whether `query` currently matches, and re-renders on change. On the
 * server (no `window`) it returns `false` so the first client render matches
 * SSR output; the real value resolves in an effect after mount.
 *
 * First reusable responsive hook in the app (PR-Ops-Cal-4) — share it rather
 * than re-inlining `window.innerWidth`/resize listeners.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export default useMediaQuery;

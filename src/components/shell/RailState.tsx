'use client';

/**
 * ACCOUNTS-01 — the rail's open/collapsed state, held ABOVE the pages.
 *
 * SHELL-01 kept it in the Rail itself, which is mounted per page: navigating
 * from one room to another unmounted the rail and reset it to open. The state
 * lives here instead, in a provider the ROOT LAYOUT mounts
 * (src/app/layout.tsx → Providers), which client navigation never unmounts — so
 * a collapsed rail stays collapsed as you walk the steps.
 *
 * Still REACT STATE ONLY: no localStorage, no sessionStorage, no cookie
 * (SHELL-01's rule, unchanged) — it lasts as long as the tab, not longer.
 */
import { createContext, useContext, useMemo, useState } from 'react';

interface RailState {
  open: boolean;
  setOpen: (next: boolean | ((previous: boolean) => boolean)) => void;
}

const RailStateContext = createContext<RailState | null>(null);

export function RailStateProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <RailStateContext.Provider value={value}>{children}</RailStateContext.Provider>;
}

/** The rail's state. Throws when the provider is missing — the root layout mounts it, so its absence is a bug, not a state to paper over. */
export function useRailState(): RailState {
  const value = useContext(RailStateContext);
  if (!value) throw new Error('useRailState: no RailStateProvider above this rail — the root layout (src/app/layout.tsx → Providers) mounts it');
  return value;
}

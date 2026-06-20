'use client';

/**
 * RunwayDataProvider — shared data layer for the Runway tab's budget components.
 *
 * Pre-fetches all three budget routes in parallel whenever `year` changes so
 * HubBudgetSection and BudgetComparison (wired in the next task) read from a
 * single source of truth — eliminating the 3× duplicate fetches (Diagnosis §5
 * FM3) and the independent-year desync (Diagnosis §5 FM2).
 *
 * Holds: year / toggle (the HubBudgetSection activeTab) as shared state so
 * changing year in HubBudgetSection updates the context and BudgetComparison
 * re-renders to the same year (Diagnosis Root Cause A).
 */

import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';

export interface BudgetResponse {
  budgetData: Record<string, Record<number, number>>;
  actualData: Record<string, Record<number, number>>;
  coaNames: Record<string, string>;
}

export const EMPTY_BUDGET: BudgetResponse = { budgetData: {}, actualData: {}, coaNames: {} };

export type ToggleKey = 'personal' | 'business' | 'travel' | 'trading';

type RouteKey = 'personal' | 'business' | 'travel';

interface RunwayContextValue {
  year: number;
  setYear: Dispatch<SetStateAction<number>>;
  toggle: ToggleKey;
  setToggle: Dispatch<SetStateAction<ToggleKey>>;
  /** Pre-fetched data for all three routed budget tabs (trading has no route). */
  data: Record<RouteKey, BudgetResponse>;
  loading: boolean;
}

const RunwayContext = createContext<RunwayContextValue | null>(null);

const ROUTE_MAP: Record<RouteKey, string> = {
  personal: '/api/hub/year-calendar',
  business: '/api/hub/business-budget',
  travel:   '/api/hub/nomad-budget',
};

export function RunwayDataProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [toggle, setToggle] = useState<ToggleKey>('personal');
  const [data, setData] = useState<Record<RouteKey, BudgetResponse>>({
    personal: EMPTY_BUDGET,
    business: EMPTY_BUDGET,
    travel:   EMPTY_BUDGET,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      (Object.entries(ROUTE_MAP) as [RouteKey, string][]).map(([key, route]) =>
        fetch(`${route}?year=${year}`)
          .then(res => (res.ok ? res.json() : EMPTY_BUDGET))
          .then(d => [key, {
            budgetData: d.budgetData || {},
            actualData: d.actualData || {},
            coaNames:   d.coaNames   || {},
          }] as [RouteKey, BudgetResponse])
          .catch(err => {
            console.error(`[RunwayDataProvider] Failed to fetch ${route} (year=${year}):`, err);
            return [key, EMPTY_BUDGET] as [RouteKey, BudgetResponse];
          })
      )
    ).then(results => {
      if (cancelled) return;
      setData(Object.fromEntries(results) as Record<RouteKey, BudgetResponse>);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [year]);

  return (
    <RunwayContext.Provider value={{ year, setYear, toggle, setToggle, data, loading }}>
      {children}
    </RunwayContext.Provider>
  );
}

export function useRunwayData(): RunwayContextValue {
  const ctx = useContext(RunwayContext);
  if (!ctx) throw new Error('useRunwayData must be used inside <RunwayDataProvider>');
  return ctx;
}

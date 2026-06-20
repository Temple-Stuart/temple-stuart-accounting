'use client';

/**
 * RunwayDataProvider (EXEC: RunwayDataProvider task)
 *
 * Lifts year, activeTab, and the three budget-route payloads above both
 * HubBudgetSection and BudgetComparison so downstream tasks can wire them
 * to a single set of fetches rather than duplicate self-fetches.
 *
 * Owns: year, setYear, activeTab, setActiveTab, personalData, businessData,
 * travelData. Fetches all three routes inside one useEffect keyed on
 * [year, activeTab]. Export useRunwayData() to consume from children.
 *
 * Additive only — HubBudgetSection and BudgetComparison are unchanged by
 * this task; they continue to self-fetch until downstream tasks wire them
 * to consume this context instead.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface BudgetData {
  budgetData: Record<string, Record<number, number>>;
  actualData: Record<string, Record<number, number>>;
  coaNames: Record<string, string>;
  budgetGrandTotal: number;
  actualGrandTotal: number;
}

const EMPTY: BudgetData = {
  budgetData: {},
  actualData: {},
  coaNames: {},
  budgetGrandTotal: 0,
  actualGrandTotal: 0,
};

export type ActiveTab = 'personal' | 'business' | 'travel' | 'trading';

interface RunwayDataContextValue {
  year: number;
  setYear: (year: number) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  personalData: BudgetData;
  businessData: BudgetData;
  travelData: BudgetData;
}

const RunwayDataContext = createContext<RunwayDataContextValue | null>(null);

export function useRunwayData(): RunwayDataContextValue {
  const ctx = useContext(RunwayDataContext);
  if (!ctx) throw new Error('useRunwayData must be used inside <RunwayDataProvider>');
  return ctx;
}

export default function RunwayDataProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<ActiveTab>('personal');
  const [personalData, setPersonalData] = useState<BudgetData>(EMPTY);
  const [businessData, setBusinessData] = useState<BudgetData>(EMPTY);
  const [travelData, setTravelData] = useState<BudgetData>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    const fetchPersonal = async () => {
      try {
        const res = await fetch(`/api/hub/year-calendar?year=${year}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (cancelled) return;
        setPersonalData({
          budgetData: d.budgetData || {},
          actualData: d.actualData || {},
          coaNames: d.coaNames || {},
          budgetGrandTotal: d.budgetGrandTotal || 0,
          actualGrandTotal: d.actualGrandTotal || 0,
        });
      } catch {
        console.error('RunwayDataProvider: failed to fetch /api/hub/year-calendar');
      }
    };

    const fetchBusiness = async () => {
      try {
        const res = await fetch(`/api/hub/business-budget?year=${year}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (cancelled) return;
        setBusinessData({
          budgetData: d.budgetData || {},
          actualData: d.actualData || {},
          coaNames: d.coaNames || {},
          budgetGrandTotal: d.budgetGrandTotal || 0,
          actualGrandTotal: d.actualGrandTotal || 0,
        });
      } catch {
        console.error('RunwayDataProvider: failed to fetch /api/hub/business-budget');
      }
    };

    const fetchTravel = async () => {
      try {
        const res = await fetch(`/api/hub/nomad-budget?year=${year}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (cancelled) return;
        // nomad-budget may return monthlyData/grandTotal (legacy) or budgetData/budgetGrandTotal
        setTravelData({
          budgetData: d.budgetData || d.monthlyData || {},
          actualData: d.actualData || {},
          coaNames: d.coaNames || {},
          budgetGrandTotal: d.budgetGrandTotal || d.grandTotal || 0,
          actualGrandTotal: d.actualGrandTotal || 0,
        });
      } catch {
        console.error('RunwayDataProvider: failed to fetch /api/hub/nomad-budget');
      }
    };

    fetchPersonal();
    fetchBusiness();
    fetchTravel();

    return () => {
      cancelled = true;
    };
  }, [year, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <RunwayDataContext.Provider
      value={{ year, setYear, activeTab, setActiveTab, personalData, businessData, travelData }}
    >
      {children}
    </RunwayDataContext.Provider>
  );
}

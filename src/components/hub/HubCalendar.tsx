'use client';

/**
 * HubCalendar — the shared master calendar (PR-HCR1). It moves the calendar-feeding
 * logic out of the /hub page (verbatim) into a self-contained component so it can be
 * mounted on the public home page (account-gated) while /hub stays untouched.
 *
 * It fetches the SAME three sources the Hub merges and renders the SAME shared grid:
 *   • /api/calendar          → calendar_events (filtered to source 'trip')
 *   • /api/operations/daily-plan/items → operations blocks (mapOperationsBlocks)
 *   • /api/hub/operations-routines     → routine occurrences (mapOperationsRoutines)
 * merged into CalendarGrid (the same component /hub + /trading use).
 *
 * AUTH: all three routes are account-gated (NOT public). Logged IN, the component
 * fetches and renders the viewer's real calendar. Logged OUT, the home page passes
 * a static `demoEvents` seed — the fetch effect early-returns, so it never calls a
 * personal route for a guest (PR-HCR-DEMO).
 */

import { useEffect, useMemo, useState } from 'react';
import CalendarGrid, { type CalendarEvent as GridEvent, type SourceConfig } from '@/components/shared/CalendarGrid';
import HubEventCard from '@/components/hub/HubEventCard';
import { mapOperationsBlocks } from '@/lib/hub/mapOperationsBlocks';
import { mapOperationsRoutines, type RoutinesWindowResponse } from '@/lib/hub/mapOperationsRoutines';
import type { DailyPlanItem, CalendarBlockSummary } from '@/components/workbench/operations/dailyplan/types';

// The /api/calendar event shape (same as hub/page.tsx:25-35).
interface CalendarEvent {
  id: string;
  source: string;
  title: string;
  icon: string | null;
  start_date: string;
  end_date: string | null;
  is_recurring: boolean;
  location: string | null;
  budget_amount: number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Same three Hub sources + their grid styling (hub/page.tsx:68-83), plus the
// Trade layer (PR-HCR-TRADE) — added the SAME way: one entry here gives it a
// legend chip + grid color automatically (HUB_GRID_CONFIG below + CalendarGrid).
// Trade uses the warm amber scale so it stands apart from trip/operations/routines.
const SOURCE_CONFIG: Record<string, { icon: string; color: string; bgColor: string; dotColor: string; calendarColor: string }> = {
  trip: { icon: '✈️', color: 'text-cyan-600', bgColor: 'bg-cyan-50', dotColor: 'bg-cyan-500', calendarColor: 'bg-cyan-400' },
  operations: { icon: '🎯', color: 'text-indigo-600', bgColor: 'bg-indigo-50', dotColor: 'bg-indigo-500', calendarColor: 'bg-indigo-400' },
  routines: { icon: '🔁', color: 'text-teal-600', bgColor: 'bg-teal-50', dotColor: 'bg-teal-500', calendarColor: 'bg-teal-400' },
  trade: { icon: '📈', color: 'text-amber-600', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500', calendarColor: 'bg-amber-400' },
};
const HUB_GRID_CONFIG: Record<string, SourceConfig> = Object.fromEntries(
  Object.entries(SOURCE_CONFIG).map(([key, cfg]) => [key, {
    label: key.charAt(0).toUpperCase() + key.slice(1),
    icon: cfg.icon,
    bg: cfg.bgColor,
    dot: cfg.dotColor,
    badge: cfg.calendarColor,
    text: cfg.color,
  }])
);

const pad = (n: number) => String(n).padStart(2, '0');

interface HubCalendarProps {
  /**
   * When set, the calendar renders THIS static list and fetches NOTHING — the
   * logged-out "living demo" path. The fetch effect early-returns, so no
   * personal route is ever called for a guest. Omit it for the real,
   * logged-in calendar (the existing behavior).
   */
  demoEvents?: GridEvent[];
  /** Opens the home register/login modal — used by the demo's sign-up button. */
  onRequireAuth?: () => void;
}

export default function HubCalendar({ demoEvents, onRequireAuth }: HubCalendarProps = {}) {
  const isDemo = !!demoEvents;
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [operationsItems, setOperationsItems] = useState<DailyPlanItem[]>([]);
  const [routinesWindow, setRoutinesWindow] = useState<RoutinesWindowResponse>({ routines: [], truncated: false });
  const [cardSelection, setCardSelection] = useState<{ item: DailyPlanItem; block: CalendarBlockSummary } | null>(null);

  // ── The 3 calendar loaders — SAME logic as hub/page.tsx:192-294. ──
  const loadCalendar = async () => {
    try {
      const res = await fetch(`/api/calendar?year=${selectedYear}&month=${selectedMonth + 1}`);
      if (res.ok) {
        const data = await res.json();
        const raw = (data.events || []) as CalendarEvent[];
        setEvents(raw.filter((e) => e.source === 'trip'));
      }
    } catch (err) { console.error('Failed to load calendar:', err); }
  };

  const loadOperationsBlocks = async () => {
    try {
      const from = `${selectedYear}-${pad(selectedMonth + 1)}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const to = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(lastDay)}`;
      const res = await fetch(`/api/operations/daily-plan/items?from=${from}&to=${to}`);
      setOperationsItems(res.ok ? ((await res.json()).items || []) : []);
    } catch (err) {
      console.error('Failed to load operations blocks:', err);
      setOperationsItems([]);
    }
  };

  const loadOperationsRoutines = async () => {
    try {
      const from = `${selectedYear}-${pad(selectedMonth + 1)}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const to = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(lastDay)}`;
      const res = await fetch(`/api/hub/operations-routines?from=${from}&to=${to}`);
      if (res.ok) {
        const data: RoutinesWindowResponse = await res.json();
        setRoutinesWindow(data);
        if (data.truncated) {
          console.warn('[Hub] Routines window truncated — occurrence cap reached. Not all recurring routines may be visible.');
        }
      } else {
        setRoutinesWindow({ routines: [], truncated: false });
      }
    } catch (err) {
      console.error('Failed to load operations routines:', err);
      setRoutinesWindow({ routines: [], truncated: false });
    }
  };

  // Demo mode is STATIC: skip all three personal fetches entirely (the zero-fetch
  // guarantee — a logged-out guest never calls /api/calendar, /api/operations/*,
  // or /api/hub/*). The real, logged-in path is unchanged.
  useEffect(() => {
    if (demoEvents) return;
    loadCalendar(); loadOperationsBlocks(); loadOperationsRoutines();
  }, [selectedYear, selectedMonth, demoEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── The merge — SAME as hub/page.tsx:379-394. In demo mode, render the static
  //    seed straight through (already in CalendarEvent shape). ──
  const gridEvents: GridEvent[] = useMemo(() => {
    if (demoEvents) return demoEvents;
    const calendarSourceEvents: GridEvent[] = events.map((e) => ({
      id: e.id,
      source: e.source,
      title: e.title,
      icon: e.icon,
      startDate: e.start_date,
      endDate: e.end_date,
      isRecurring: e.is_recurring,
      location: e.location,
      budgetAmount: e.budget_amount,
    }));
    return [...calendarSourceEvents, ...mapOperationsBlocks(operationsItems), ...mapOperationsRoutines(routinesWindow)];
  }, [demoEvents, events, operationsItems, routinesWindow]);

  // ── Click → open the operations block's card (SAME as hub/page.tsx:165-178). ──
  const handleEventClick = (event: GridEvent) => {
    if (event.source !== 'operations') return;
    for (const item of operationsItems) {
      const block = item.calendar_blocks.find((b) => b.id === event.id);
      if (block) { setCardSelection({ item, block }); return; }
    }
    console.warn('[Hub] Could not locate item+block for event id:', event.id);
  };

  const goMonth = (delta: number) => {
    const d = new Date(selectedYear, selectedMonth + delta, 1);
    setSelectedYear(d.getFullYear());
    setSelectedMonth(d.getMonth());
  };
  const goToday = () => { const t = new Date(); setSelectedYear(t.getFullYear()); setSelectedMonth(t.getMonth()); };

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-brand-purple">Your calendar</p>
            {isDemo && (
              <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
                Live demo
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted">
            {isDemo
              ? 'This is the real app — these events are made up, and nothing here gets saved.'
              : 'Trips, routines, and your daily plan — all in one place.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => goMonth(-1)} aria-label="Previous month" className="rounded border border-border px-2 py-1 text-sm text-text-secondary hover:bg-bg-row">‹</button>
          <span className="min-w-[120px] text-center text-sm font-medium text-text-primary">{MONTHS[selectedMonth]} {selectedYear}</span>
          <button type="button" onClick={() => goMonth(1)} aria-label="Next month" className="rounded border border-border px-2 py-1 text-sm text-text-secondary hover:bg-bg-row">›</button>
          <button type="button" onClick={goToday} className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-bg-row">Today</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <CalendarGrid
          events={gridEvents}
          sourceConfig={HUB_GRID_CONFIG}
          defaultView="day"
          enableDayView={true}
          enableHubChrome={true}
          showBudgetTotals={true}
          showCategoryLegend={true}
          onEventClick={handleEventClick}
        />
      </div>

      {isDemo && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-bg-row p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-secondary">
            Like what you see? Make a free account and fill it with your own trips, routines, and plans.
          </p>
          <button
            type="button"
            onClick={() => onRequireAuth?.()}
            className="shrink-0 rounded bg-brand-purple px-6 py-2 text-sm font-semibold text-white hover:bg-brand-purple-hover"
          >
            Make my free account
          </button>
        </div>
      )}

      {cardSelection && (
        <HubEventCard
          item={cardSelection.item}
          block={cardSelection.block}
          onClose={() => setCardSelection(null)}
          onUpdated={() => { loadOperationsBlocks(); setCardSelection(null); }}
        />
      )}
    </div>
  );
}

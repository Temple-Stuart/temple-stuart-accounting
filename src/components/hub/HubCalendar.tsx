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
import EventDetailPanel from '@/components/hub/EventDetailPanel';
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
  // PR-Calendar-Times-Schema: time-of-day for timed events. Null for older/all-day rows.
  // From a raw SELECT these come back either as "HH:MM:SS" or an ISO time
  // ("1970-01-01THH:MM:SS.000Z") — toClock() normalizes both to "HH:MM".
  start_time: string | null;
  end_time: string | null;
  is_recurring: boolean;
  location: string | null;
  budget_amount: number;
}

// Normalize a raw TIME value to "HH:MM" (what the grid's timeToMinutes expects), or null.
// Handles "HH:MM:SS", a bare "HH:MM", and an ISO time string; null/empty → null (all-day).
function toClock(v: string | null): string | null {
  if (!v) return null;
  const timePart = v.includes('T') ? v.split('T')[1] : v;
  const m = timePart.match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

// The four calendar layers + their grid styling: Trips · Projects · Routines · Trade.
// PR-HCR-LAYERS: the old 'operations' layer is renamed to 'project' — Operations is
// the UMBRELLA (Projects + Routines), so the events tagged here are really PROJECT
// events; the legend now reads "Projects". One entry here gives a layer its legend
// chip + grid color automatically (HUB_GRID_CONFIG below + CalendarGrid). Each layer
// uses a distinct color scale: trip=cyan, project=indigo, routines=teal, trade=amber.
const SOURCE_CONFIG: Record<string, { label?: string; icon: string; color: string; bgColor: string; dotColor: string; calendarColor: string }> = {
  trip: { icon: '✈️', color: 'text-cyan-600', bgColor: 'bg-cyan-50', dotColor: 'bg-cyan-500', calendarColor: 'bg-cyan-400' },
  project: { label: 'Projects', icon: '🎯', color: 'text-indigo-600', bgColor: 'bg-indigo-50', dotColor: 'bg-indigo-500', calendarColor: 'bg-indigo-400' },
  routines: { icon: '🔁', color: 'text-teal-600', bgColor: 'bg-teal-50', dotColor: 'bg-teal-500', calendarColor: 'bg-teal-400' },
  trade: { icon: '📈', color: 'text-amber-600', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500', calendarColor: 'bg-amber-400' },
};
const HUB_GRID_CONFIG: Record<string, SourceConfig> = Object.fromEntries(
  Object.entries(SOURCE_CONFIG).map(([key, cfg]) => [key, {
    label: cfg.label ?? (key.charAt(0).toUpperCase() + key.slice(1)),
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
  // PR-HCR3: the clicked event for the read-only type-aware detail panel.
  const [detailEvent, setDetailEvent] = useState<GridEvent | null>(null);

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
      // PR-Flight-Times: carry the stored times through so the grid renders a timed block
      // (wheels-up → wheels-down). Null times → undefined → all-day, exactly as before.
      startTime: toClock(e.start_time),
      endTime: toClock(e.end_time),
      isRecurring: e.is_recurring,
      location: e.location,
      budgetAmount: e.budget_amount,
    }));
    // mapOperationsBlocks is SHARED with /hub and still emits source:'operations'
    // there; remap to 'project' HERE so these land on the renamed Projects layer
    // without touching the shared mapper or /hub (PR-HCR-LAYERS).
    const projectEvents: GridEvent[] = mapOperationsBlocks(operationsItems).map((e) => ({ ...e, source: 'project' }));
    // mapOperationsRoutines sets href:'/operations/routines'; on the master calendar
    // we want a routine click to open the detail panel, not navigate away. Drop the
    // href HERE (PR-HCR3.2) so CalendarGrid falls through to onEventClick — same
    // local-remap pattern as the project source above. The shared mapper is untouched,
    // so /hub keeps its href-navigation behavior.
    const routineEvents: GridEvent[] = mapOperationsRoutines(routinesWindow).map((e) => ({ ...e, href: undefined }));
    return [...calendarSourceEvents, ...projectEvents, ...routineEvents];
  }, [demoEvents, events, operationsItems, routinesWindow]);

  // ── Click → open a detail panel (PR-HCR3). A LIVE project block keeps its rich
  //    HubEventCard (reschedule/reconcile); everything else (the demo's trip/
  //    project/routine/trade, and live trip/trade) opens the read-only, type-aware
  //    EventDetailPanel. Live routines never reach here — CalendarGrid navigates
  //    them via their href (mapOperationsRoutines), which we leave unchanged. ──
  const handleEventClick = (event: GridEvent) => {
    if (!isDemo && event.source === 'project') {
      for (const item of operationsItems) {
        const block = item.calendar_blocks.find((b) => b.id === event.id);
        if (block) { setCardSelection({ item, block }); return; }
      }
    }
    setDetailEvent(event);
  };

  // PR-Calendar-Flush: the descriptive caption + the parent purple band are gone — the
  // grid's toolbar flows flush under the tab row.
  // PR-Mobile-Calendar-Declutter: the small "live demo" tag that used to sit up top is
  // removed too (clutter, worst on phone's tight space); the logged-out sign-up CTA below
  // still tells a guest the data is a demo.
  return (
    <div>
      {/* Edge-to-edge day-view grid. On phone it's day-only with a week strip; the grid's
          nav drives this component's fetch month via onMonthChange. */}
      <CalendarGrid
        events={gridEvents}
        sourceConfig={HUB_GRID_CONFIG}
        defaultView="day"
        enableDayView={true}
        enableHubChrome={true}
        showBudgetTotals={true}
        showCategoryLegend={true}
        onEventClick={handleEventClick}
        phoneDayOnly={true}
        onMonthChange={(year, month) => { setSelectedYear(year); setSelectedMonth(month); }}
        flush={true}
      />

      {isDemo && (
        <div className="m-4 flex flex-col items-start gap-2 rounded-lg border border-border bg-bg-row p-4 sm:flex-row sm:items-center sm:justify-between">
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

      {detailEvent && (
        <EventDetailPanel event={detailEvent} onClose={() => setDetailEvent(null)} />
      )}
    </div>
  );
}

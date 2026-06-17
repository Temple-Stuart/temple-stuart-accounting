'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ResponsiveViewController from './ResponsiveViewController';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CalendarEvent {
  id: string;
  source: string;
  title: string;
  icon?: string | null;
  startDate: string;        // YYYY-MM-DD
  endDate?: string | null;  // YYYY-MM-DD (for multi-day events)
  startTime?: string | null; // HH:MM (24h) for time-based positioning
  endTime?: string | null;   // HH:MM (24h)
  /** PR-Flight-Duration-Render: a flight's TRUE elapsed minutes. When present, block
   *  geometry is depart → depart+duration (NOT the naive stored end, which is a different
   *  zone → a 34h span). Null → an explicit flagged marker, never start→end. */
  durationMinutes?: number | null;
  isRecurring?: boolean;
  location?: string | null;
  budgetAmount?: number;
  details?: string[];        // compact detail lines (e.g. "PYPL | Iron Condor", "B-6210 · $250")
  /**
   * Internal navigation target. When set, clicking the event routes to
   * this path via the Next router (client-side). Takes precedence over
   * onEventClick so per-event click targets work without requiring every
   * caller to thread a callback. PR-Ops-5.3.
   */
  href?: string;
}

export interface SourceConfig {
  label: string;
  icon: string;
  bg: string;
  dot: string;
  badge?: string;
  text?: string;
}

export interface CalendarGridProps {
  events: CalendarEvent[];
  sourceConfig: Record<string, SourceConfig>;
  defaultView?: 'week' | 'month' | 'day';
  anchorDate?: string;
  highlightStart?: string;
  highlightEnd?: string;
  onEventClick?: (event: CalendarEvent, mouseEvent?: MouseEvent) => void;
  showBudgetTotals?: boolean;
  showCategoryLegend?: boolean;
  compact?: boolean;
  /**
   * Opt-in (PR-Ops-Cal-4): enables the Day view + the mobile auto-default to
   * Day below 768px. Default false — when off there is no Day button, the
   * auto-default effect is inert, and `calendarView` can never become 'day',
   * so existing callers (Trading, both Trips) render byte-identically.
   */
  enableDayView?: boolean;
  /**
   * Opt-in (PR-Ops-Hub-Header-1): applies Hub header chrome to the toolbar zone
   * — a purple-wash background + strong purple top border so the control surface
   * reads as its own zone, plus solid-purple active / muted-purple inactive view
   * buttons. Default false — when off the toolbar markup is byte-identical to
   * before, so Trading and both Trips are unaffected.
   */
  enableHubChrome?: boolean;
  /**
   * Opt-in (PR-Calendar-Native): on phone (<768px, via the enableDayView/enableHubChrome
   * mobile signal) show ONLY the Day view — hide the Week/Month buttons — and surface a
   * horizontal week strip (S M T W T F S + dates) to tap between days. Default false →
   * desktop and the other callers keep Day/Week/Month unchanged.
   */
  phoneDayOnly?: boolean;
  /**
   * Opt-in (PR-Calendar-Native): fires when the grid's own nav changes the visible
   * month, so the parent can refetch that month's events. This lets the grid's toolbar
   * be the single date nav (the parent drops its own redundant month-nav). Default
   * undefined → no-op for the other callers.
   */
  onMonthChange?: (year: number, month: number) => void;
  /**
   * Opt-in (PR-Calendar-Seamless): drop the outer card chrome (rounded corners, border,
   * shadow) so the grid sits FLUSH inside a parent that already provides the frame —
   * one continuous surface under a header band (a flush day-view look). Default false →
   * the other callers keep their floating card.
   */
  flush?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HOUR_HEIGHT = 52; // Calendar redesign: roomier rows, day-view spacing
const START_HOUR = 0;   // 12 AM
const END_HOUR = 24;    // 12 AM next day
const TOTAL_HOURS = END_HOUR - START_HOUR; // 24
const MIN_EVENT_HEIGHT = HOUR_HEIGHT * 1.5; // 60px minimum

const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

const dateToKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

const formatTime12h = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h)) return time;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
};

type TzMode = 'local' | 'home';

// ═══════════════════════════════════════════════════════════════
// Multi-day event splitter
// ═══════════════════════════════════════════════════════════════

interface DayBlock {
  event: CalendarEvent;
  startMin: number;  // minutes from midnight
  endMin: number;    // minutes from midnight
  label: string;     // display label
  isDepart: boolean; // true = departure half
  isArrive: boolean; // true = arrival half
}

function getBlocksForDay(dayKey: string, events: CalendarEvent[]): DayBlock[] {
  const blocks: DayBlock[] = [];

  for (const event of events) {
    if (!event.startTime) continue;
    // Normalize to the SAME "YYYY-MM-DD" key dayKey uses (dateToKey). event.startDate/endDate
    // can arrive as a full ISO datetime — trip events come from calendar_events (@db.Date),
    // serialized as "2026-07-01T00:00:00.000Z" — and comparing that raw against dayKey
    // ("2026-07-01") silently failed, so timed trip blocks were dropped entirely. parseDate
    // handles both ISO and plain "YYYY-MM-DD", so other sources are unaffected.
    const evtStartKey = dateToKey(parseDate(event.startDate));
    const evtEndKey = event.endDate ? dateToKey(parseDate(event.endDate)) : evtStartKey;
    const startMin = timeToMinutes(event.startTime);

    // ── PR-Flight-Duration-Render: trip events that reach here are FLIGHTS (only flights
    // get a start_time in calendar_events — non-flight trip rows are all-day and skipped
    // above). Draw their geometry from the TRUE elapsed duration, NOT the naive stored end
    // (which is in the arrival's DIFFERENT zone → a 34h span). Day-membership is by the
    // DERIVED end (start + duration), so the block lives only on the days the duration
    // actually covers — no phantom on the stored end_date. Zone reconciliation of the
    // arrival LABEL vs the geometry is PR-4, intentionally NOT done here.
    if (event.source === 'trip') {
      const dayOffset = Math.round((parseDate(dayKey).getTime() - parseDate(evtStartKey).getTime()) / 86_400_000);
      if (dayOffset < 0) continue;

      if (event.durationMinutes == null) {
        // POLICY (decided): unknown duration → a MINIMAL fixed-height marker on the depart
        // day ONLY, visibly flagged. NEVER reconstruct start→end (that is the 34h bug). This
        // is an explicit "we don't trust this" state, not a silent fallback.
        if (dayOffset === 0) {
          blocks.push({ event, startMin, endMin: startMin + 30, label: `⚠ duration unverified · ${event.title}`, isDepart: true, isArrive: false });
        }
        continue;
      }

      const totalEndMin = startMin + event.durationMinutes; // absolute minutes from depart-day midnight
      const dayStartAbs = dayOffset * 1440;
      if (dayStartAbs >= totalEndMin) continue; // duration doesn't reach this day → no phantom
      const segStart = dayOffset === 0 ? startMin : 0;
      const segEnd = Math.min(totalEndMin - dayStartAbs, 1440);
      const isArriveSeg = dayStartAbs + 1440 >= totalEndMin; // this day contains the duration end
      const label = isArriveSeg
        ? `arr ${event.endTime ? formatTime12h(event.endTime) : ''} ${event.title.replace(/^\d+:\d+\s*(AM|PM)\s*/i, '')}`.trim()
        : event.title;
      blocks.push({ event, startMin: segStart, endMin: Math.max(segEnd, segStart + 30), label, isDepart: dayOffset === 0, isArrive: isArriveSeg });
      continue;
    }

    // ── Non-trip (operations / project / routine) — UNCHANGED start→end behavior. ──
    const endMin = event.endTime ? timeToMinutes(event.endTime) : startMin + 120;

    if (evtStartKey === evtEndKey || !event.endDate) {
      // Same-day event — only show on its start date
      if (dayKey === evtStartKey) {
        blocks.push({ event, startMin, endMin: Math.max(endMin, startMin + 60), label: event.title, isDepart: false, isArrive: false });
      }
    } else {
      // Multi-day event
      if (dayKey === evtStartKey) {
        // Departure day: from departure time to end of day
        blocks.push({ event, startMin, endMin: 24 * 60, label: event.title, isDepart: true, isArrive: false });
      } else if (dayKey === evtEndKey) {
        // Arrival day: from start of day to arrival time
        blocks.push({ event, startMin: 0, endMin: Math.max(endMin, 60), label: `arr ${event.endTime ? formatTime12h(event.endTime) : ''} ${event.title.replace(/^\d+:\d+\s*(AM|PM)\s*/i, '')}`.trim(), isDepart: false, isArrive: true });
      }
    }
  }
  return blocks;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function CalendarGrid({
  events,
  sourceConfig,
  defaultView = 'week',
  anchorDate,
  highlightStart,
  highlightEnd,
  onEventClick,
  showBudgetTotals = false,
  showCategoryLegend = false,
  compact = false,
  enableDayView = false,
  enableHubChrome = false,
  phoneDayOnly = false,
  onMonthChange,
  flush = false,
}: CalendarGridProps) {
  const router = useRouter();
  const now = new Date();
  const anchor = anchorDate ? parseDate(anchorDate) : now;
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Tile-click dispatch: per-event `href` (PR-Ops-5.3) takes precedence
   * over the legacy onEventClick callback so per-source click targets
   * (e.g., Operations blocks → /workbench/operations) work without
   * every caller threading a handler.
   */
  const handleTileClick = (event: CalendarEvent, nativeEvent: MouseEvent) => {
    if (event.href) {
      router.push(event.href);
      return;
    }
    onEventClick?.(event, nativeEvent);
  };

  const [calendarView, setCalendarView] = useState<'week' | 'month' | 'day'>(defaultView);
  const [selectedYear, setSelectedYear] = useState(anchor.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(anchor.getMonth());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });
  // Day-view anchor (PR-Ops-Cal-4). Unused in week/month; day nav moves it.
  const [selectedDay, setSelectedDay] = useState<Date>(anchor);
  // Once the user taps any view button, auto-default never re-forces on resize.
  const [userPickedView, setUserPickedView] = useState(false);
  const [tzMode, setTzMode] = useState<TzMode>('local');

  const allSources = Object.keys(sourceConfig);
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>(
    () => Object.fromEntries(allSources.map(s => [s, true]))
  );

  // ── Highlight range ──
  const hlStart = highlightStart ? parseDate(highlightStart) : null;
  const hlEnd = highlightEnd ? parseDate(highlightEnd) : null;
  const isInHighlight = (d: Date) => {
    if (!hlStart || !hlEnd) return false;
    const t = d.getTime();
    return t >= hlStart.getTime() && t <= hlEnd.getTime();
  };

  // ── Derived data ──
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);

  const eventsByDateKey = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    const pushOn = (key: string, e: CalendarEvent) => {
      if (!map[key]) map[key] = [];
      if (!map[key].some(x => x.id === e.id)) map[key].push(e);
    };
    events.forEach(e => {
      const start = parseDate(e.startDate);
      pushOn(dateToKey(start), e);

      if (e.durationMinutes != null) {
        // PR-Month-Phantom-Fix: a flight (the ONLY event type with duration_minutes) belongs
        // to the days its TRUE elapsed time covers — start → start+duration — NOT the stored
        // end_date (the arrival's different zone). Mirror PR-3's day-view coverage: a day at
        // offset d is covered iff d*1440 < startMin+duration. For the live row (00:00 +
        // 1145min = 19:05 same day) that is Jul 1 ONLY → no Jul 2 phantom. NEVER falls through
        // to the stored-end_date branch below.
        if (e.startTime) {
          const totalEndMin = timeToMinutes(e.startTime) + e.durationMinutes;
          const lastDayOffset = Math.ceil(totalEndMin / 1440) - 1; // 0 = same day
          for (let off = 1; off <= lastDayOffset; off++) {
            const d = new Date(start);
            d.setDate(d.getDate() + off);
            pushOn(dateToKey(d), e);
          }
        }
        // (duration present but no start_time → start day only; never spill to end_date)
      } else if (e.endDate && e.endDate !== e.startDate) {
        // Legitimate multi-day ALL-DAY event (hotel/lodging, multi-day op) — UNCHANGED:
        // index the stored end day so it still appears on its end/checkout day.
        pushOn(dateToKey(parseDate(e.endDate)), e);
      }
    });
    return map;
  }, [events]);

  const getEventsForDate = (date: Date) => {
    const key = dateToKey(date);
    return (eventsByDateKey[key] || []).filter(e => visibleCategories[e.source] !== false);
  };

  // ── Navigation ──
  const prevMonth = () => { if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); } else { setSelectedMonth(m => m - 1); } };
  const nextMonth = () => { if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); } else { setSelectedMonth(m => m + 1); } };
  const prevWeek = () => { const ns = new Date(selectedWeekStart); ns.setDate(ns.getDate() - 7); setSelectedWeekStart(ns); setSelectedMonth(ns.getMonth()); setSelectedYear(ns.getFullYear()); };
  const nextWeek = () => { const ns = new Date(selectedWeekStart); ns.setDate(ns.getDate() + 7); setSelectedWeekStart(ns); setSelectedMonth(ns.getMonth()); setSelectedYear(ns.getFullYear()); };
  const goToDay = (d: Date) => {
    setSelectedDay(d);
    setSelectedYear(d.getFullYear()); setSelectedMonth(d.getMonth());
    const s = new Date(d); s.setDate(d.getDate() - d.getDay()); setSelectedWeekStart(s);
  };
  const prevDay = () => { const d = new Date(selectedDay); d.setDate(d.getDate() - 1); goToDay(d); };
  const nextDay = () => { const d = new Date(selectedDay); d.setDate(d.getDate() + 1); goToDay(d); };
  const goToToday = () => {
    const t = anchorDate ? parseDate(anchorDate) : new Date();
    setSelectedYear(t.getFullYear()); setSelectedMonth(t.getMonth());
    const s = new Date(t); s.setDate(t.getDate() - t.getDay()); setSelectedWeekStart(s);
    setSelectedDay(t);
  };
  const selectView = (v: 'week' | 'month' | 'day') => { setCalendarView(v); setUserPickedView(true); };

  // ── Calendar arrays ──
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) { const d = new Date(selectedWeekStart); d.setDate(selectedWeekStart.getDate() + i); weekDays.push(d); }

  // Time-grid columns: a single day in Day view, the full week otherwise.
  const gridDays = calendarView === 'day' ? [selectedDay] : weekDays;

  const headerTitle = calendarView === 'day'
    ? `${DAYS[selectedDay.getDay()]} ${MONTHS[selectedDay.getMonth()]} ${selectedDay.getDate()}, ${selectedDay.getFullYear()}`
    : calendarView === 'week'
    ? `${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
    : `${MONTHS[selectedMonth]} ${selectedYear}`;

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  // ── Toolbar chrome (PR-Ops-Hub-Header-1) ── off => byte-identical to before.
  // ── Mobile toolbar stack (PR-Ops-Hub-Mobile-Header-1) ──────────────────────
  // No `useMediaQuery` lives here. The `<768px` signal is owned by the
  // Cal-4 `ResponsiveViewController`, which is mounted ONLY when `enableDayView`
  // and mirrors the signal up via `onMobileChange` ONLY when `enableHubChrome`
  // (see the controller mount below). Callers that opt into neither (Trading,
  // both Trips) mount no controller, call no hook, subscribe no listener, and
  // never set this state — so `isMobile` stays `false`, `hubMobileToolbar` stays
  // `false`, and every class string below is byte-identical to before with zero
  // extra re-renders.
  const [isMobile, setIsMobile] = useState(false);
  const hubMobileToolbar = enableHubChrome && isMobile;
  const toolbarBarClass = enableHubChrome
    ? (hubMobileToolbar
        ? 'flex flex-col gap-3 px-4 py-3 border-b border-border border-t-[3px] border-t-brand-purple bg-brand-purple-wash'
        : 'flex items-center justify-between px-4 py-3 border-b border-border border-t-[3px] border-t-brand-purple bg-brand-purple-wash')
    : 'flex items-center justify-between px-4 py-3 border-b border-border bg-bg-row/50';
  const toolbarLeftClass = hubMobileToolbar ? 'flex flex-col gap-2' : 'flex items-center gap-4';
  const viewTrackExtra = hubMobileToolbar ? 'w-full ' : '';
  const viewBtnExtra = hubMobileToolbar ? 'flex-1 ' : '';
  const toolbarTitleClass = hubMobileToolbar ? 'text-sm font-semibold text-text-primary text-center' : 'text-sm font-semibold text-text-primary';
  const toolbarRightClass = hubMobileToolbar ? 'flex items-center justify-center gap-2' : 'flex items-center gap-2';
  const viewBtnActive = enableHubChrome ? 'bg-brand-purple-hover text-white shadow-sm' : 'bg-white shadow-sm text-text-primary';
  const viewBtnInactive = enableHubChrome ? 'text-brand-purple/70 hover:text-brand-purple' : 'text-text-muted hover:text-text-secondary';

  // PR-Calendar-Native: when phone-day-only is on, hide Week/Month → keep the mobile
  // signal so the toolbar + body know to show the week strip + a single day.
  const phoneOnlyActive = phoneDayOnly && isMobile;

  // PR-Calendar-Native: tell the parent when our nav crosses into a new month so it can
  // refetch — lets our toolbar be the single date nav.
  useEffect(() => {
    onMonthChange?.(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // PR-Calendar-Native: on phone-day-only, force the Day view (Week/Month are hidden).
  useEffect(() => {
    if (phoneOnlyActive && calendarView !== 'day') setCalendarView('day');
  }, [phoneOnlyActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll to first timed event ──
  useEffect(() => {
    if (calendarView === 'month' || !scrollRef.current) return;
    const allWeekEvents = gridDays.flatMap(d => getEventsForDate(d));
    const timedEvents = allWeekEvents.filter(e => e.startTime);
    if (timedEvents.length > 0) {
      const earliest = timedEvents.reduce((min, e) => {
        const m = timeToMinutes(e.startTime!);
        return m < min ? m : min;
      }, 24 * 60);
      const scrollTo = Math.max(0, ((earliest / 60) - 1) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = scrollTo;
    } else {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT; // default: 7 AM
    }
  }, [calendarView, selectedWeekStart, selectedDay]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className={flush ? 'bg-white overflow-hidden' : `bg-white ${hubMobileToolbar ? 'rounded-lg' : 'rounded'} border border-border overflow-hidden shadow-sm`}>
      {/* Mobile auto-default to Day view (PR-Ops-Cal-4) — opt-in only.
          Mounting the controller only when enableDayView keeps the responsive
          hook/listener off the prop-off path entirely. */}
      {enableDayView && (
        <ResponsiveViewController
          userPickedView={userPickedView}
          defaultView={defaultView}
          setCalendarView={setCalendarView}
          onMobileChange={enableHubChrome ? setIsMobile : undefined}
        />
      )}
      {/* Header bar */}
      <div className={toolbarBarClass}>
        <div className={toolbarLeftClass}>
          {/* PR-Mobile-Calendar-Declutter: on phone-day-only the view is locked to Day, so
              hide the WHOLE Day/Week/Month track — the lone "Day" button was dead UI eating
              a row. Desktop (a real Day/Week/Month choice) keeps it. */}
          {!phoneOnlyActive && (
            <div className={`${viewTrackExtra}flex bg-border/70 rounded p-0.5`}>
              {enableDayView && (
                <button onClick={() => selectView('day')} className={`${viewBtnExtra}px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${calendarView === 'day' ? viewBtnActive : viewBtnInactive}`}>Day</button>
              )}
              <button onClick={() => selectView('week')} className={`${viewBtnExtra}px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${calendarView === 'week' ? viewBtnActive : viewBtnInactive}`}>Week</button>
              <button onClick={() => selectView('month')} className={`${viewBtnExtra}px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${calendarView === 'month' ? viewBtnActive : viewBtnInactive}`}>Month</button>
            </div>
          )}
          {/* Timezone toggle */}
          {calendarView !== 'month' && (
            <select
              value={tzMode}
              onChange={e => setTzMode(e.target.value as TzMode)}
              className="text-xs border border-border rounded px-2 py-1 text-text-secondary bg-white"
            >
              <option value="local">Trip Local</option>
              <option value="home">Home (PST)</option>
            </select>
          )}
        </div>
        <h2 className={toolbarTitleClass}>{headerTitle}</h2>
        <div className={toolbarRightClass}>
          <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-row rounded border border-border transition-colors">
            {anchorDate ? 'Start' : 'Today'}
          </button>
          <button onClick={calendarView === 'day' ? prevDay : calendarView === 'week' ? prevWeek : prevMonth} className="w-8 h-8 flex items-center justify-center text-text-muted rounded hover:bg-bg-row transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={calendarView === 'day' ? nextDay : calendarView === 'week' ? nextWeek : nextMonth} className="w-8 h-8 flex items-center justify-center text-text-muted rounded hover:bg-bg-row transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Compact horizontal legend — only categories with events, deduplicated */}
      {showCategoryLegend && (() => {
        const activeSources = new Set(events.map(e => e.source));
        const seen = new Set<string>();
        const legendItems = Object.entries(sourceConfig).filter(([source, config]) => {
          if (!activeSources.has(source)) return false;
          if (seen.has(config.label)) return false;
          seen.add(config.label);
          return true;
        });
        return legendItems.length > 0 ? (
          <div className="px-4 py-2 border-b border-border flex flex-wrap gap-x-4 gap-y-1">
            {legendItems.map(([source, config]) => (
              <label key={source} className="flex items-center gap-1.5 cursor-pointer" onClick={() => setVisibleCategories(prev => ({ ...prev, [source]: prev[source] === false ? true : false }))}>
                <div className={`w-2.5 h-2.5 rounded-sm ${visibleCategories[source] !== false ? (config.badge || config.dot) : 'bg-border'}`} />
                <span className={`text-xs ${visibleCategories[source] !== false ? 'text-text-secondary' : 'text-text-faint line-through'}`}>{config.label}</span>
              </label>
            ))}
          </div>
        ) : null;
      })()}

      <div className="flex">
        {/* Calendar body */}
        <div className="flex-1 min-w-0">
          {calendarView !== 'month' ? (
            <div>
              {/* PR-Calendar-Native: phone-day-only → a tappable week strip (S M T W T F
                  S + dates, selected day in a purple circle, today in red). Tap a day to
                  switch; the toolbar arrows move day-by-day and the strip follows across
                  weeks. Otherwise the normal sticky Week/Day header. */}
              {phoneOnlyActive ? (
                <div className="flex border-b border-border sticky top-0 z-10 bg-white">
                  {weekDays.map((day, idx) => {
                    const isSel = day.toDateString() === selectedDay.toDateString();
                    const isToday = day.toDateString() === now.toDateString();
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => goToDay(day)}
                        aria-current={isSel ? 'date' : undefined}
                        className="flex flex-1 flex-col items-center py-2"
                      >
                        <span className="text-[10px] uppercase tracking-wide text-text-muted">{DAYS[day.getDay()][0]}</span>
                        <span className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${isSel ? 'bg-brand-purple text-white' : isToday ? 'text-red-500' : 'text-text-primary'}`}>{day.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
              <div className="flex border-b border-border sticky top-0 z-10 bg-white">
                <div className="w-14 flex-shrink-0" />
                {gridDays.map((day, idx) => {
                  const isToday = day.toDateString() === now.toDateString();
                  const hl = isInHighlight(day);
                  return (
                    <div key={idx} className={`flex-1 text-center py-2 border-l border-border-light ${isToday ? 'bg-red-50' : hl ? 'bg-purple-50/40' : ''}`}>
                      <div className="text-xs text-text-muted uppercase tracking-wide font-medium">{DAYS[day.getDay()]}</div>
                      <div className={`text-sm font-medium mt-0.5 ${isToday ? 'bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto' : 'text-text-primary'}`}>{day.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              )}

              {/* All-day events row */}
              {(() => {
                const allDayEvents = gridDays.map(day => {
                  const dayEvts = getEventsForDate(day);
                  return dayEvts.filter(e => !e.startTime);
                });
                const hasAnyAllDay = allDayEvents.some(evts => evts.length > 0);
                if (!hasAnyAllDay) return null;
                return (
                  <div className="flex border-b border-border">
                    <div className="w-14 flex-shrink-0 text-right pr-2 py-1">
                      <span className="text-[10px] text-text-faint">all day</span>
                    </div>
                    {gridDays.map((day, idx) => {
                      const evts = allDayEvents[idx];
                      return (
                        <div key={idx} className="flex-1 border-l border-border-light p-0.5 min-h-[28px]">
                          {evts.slice(0, 3).map((event, i) => {
                            const config = sourceConfig[event.source] || { badge: 'bg-gray-400', dot: 'bg-gray-400' };
                            return (
                              <div key={event.id || i}
                                onClick={(e) => handleTileClick(event, e.nativeEvent)}
                                className={`${config.badge || config.dot} text-white text-[10px] px-1.5 py-0.5 rounded truncate mb-0.5 ${(event.href || onEventClick) ? 'cursor-pointer hover:opacity-90' : ''}`}
                                title={event.title}>
                                {event.title}
                              </div>
                            );
                          })}
                          {evts.length > 3 && <div className="text-[10px] text-text-muted px-1">+{evts.length - 3}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Scrollable time grid */}
              <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: '600px' }}>
                <div className="flex relative" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
                  {/* Time gutter — calendar redesign: roomier width + clearer labels */}
                  <div className="w-16 flex-shrink-0 relative">
                    {hours.map(hour => (
                      <div key={hour} className="absolute w-full text-right pr-2" style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }}>
                        <span className="text-xs text-text-muted leading-none relative -top-1.5">
                          {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {gridDays.map((day, dayIdx) => {
                    const isToday = day.toDateString() === now.toDateString();
                    const hl = isInHighlight(day);
                    const dayKey = dateToKey(day);
                    const dayEvents = getEventsForDate(day);
                    const blocks = getBlocksForDay(dayKey, dayEvents);

                    return (
                      <div key={dayIdx} className={`flex-1 relative border-l border-border-light ${isToday ? 'bg-red-50/20' : hl ? 'bg-purple-50/10' : ''}`}>
                        {/* Hour grid lines */}
                        {hours.map(hour => (
                          <div key={hour} className="absolute w-full border-t border-border-light/60" style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }} />
                        ))}
                        {hours.map(hour => (
                          <div key={`half-${hour}`} className="absolute w-full border-t border-border-light/30" style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
                        ))}

                        {/* Current time indicator — a crisp red "now" line with the
                            current time on a small pill. */}
                        {isToday && (() => {
                          const nowMin = now.getHours() * 60 + now.getMinutes();
                          const top = (nowMin / 60) * HOUR_HEIGHT;
                          return (
                            <div className="absolute w-full z-20" style={{ top: `${top}px` }}>
                              <div className="flex items-center -translate-y-1/2">
                                <span className="rounded bg-red-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white shadow-sm">
                                  {formatTime12h(`${now.getHours()}:${now.getMinutes()}`)}
                                </span>
                                <div className="flex-1 h-[2px] bg-red-500" />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Timed events as positioned blocks */}
                        {blocks.map((block, blockIdx) => {
                          const top = (block.startMin / 60) * HOUR_HEIGHT;
                          const height = Math.max(((block.endMin - block.startMin) / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT);
                          const config = sourceConfig[block.event.source] || { badge: 'bg-gray-400', dot: 'bg-gray-400' };
                          const badgeColor = config.badge || config.dot;
                          // No rounding on split edges
                          const roundClass = block.isDepart ? 'rounded-t' : block.isArrive ? 'rounded-b' : 'rounded';

                          return (
                            <div
                              key={`${block.event.id}-${blockIdx}`}
                              onClick={(e) => handleTileClick(block.event, e.nativeEvent)}
                              className={`absolute left-0.5 right-0.5 ${badgeColor} text-white ${roundClass} overflow-hidden z-10 ${(block.event.href || onEventClick) ? 'cursor-pointer hover:opacity-90' : ''} transition-opacity`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              title={`${block.label}${block.event.budgetAmount ? ' - ' + formatCurrency(block.event.budgetAmount) : ''}`}
                            >
                              <div className="px-2 py-1.5 h-full overflow-hidden">
                                <div className="text-[11px] font-semibold leading-tight truncate">{block.label}</div>
                                {block.event.startTime && (
                                  <div className="text-[10px] opacity-80 leading-tight mt-0.5 truncate">
                                    {formatTime12h(block.event.startTime)}
                                    {block.event.endTime ? ` — ${formatTime12h(block.event.endTime)}` : ''}
                                  </div>
                                )}
                                {block.event.location && (
                                  <div className="text-[10px] opacity-70 leading-tight mt-0.5 truncate">{block.event.location}</div>
                                )}
                                {block.event.details && block.event.details[0] && (
                                  <div className="text-[10px] opacity-80 leading-tight mt-0.5 truncate">{block.event.details[0]}</div>
                                )}
                                {!block.event.startTime && block.event.budgetAmount && block.event.budgetAmount > 0 && (
                                  <div className="text-[10px] opacity-80 leading-tight mt-0.5">{formatCurrency(block.event.budgetAmount)}</div>
                                )}
                              </div>
                              {/* Recurrence signal — quiet corner glyph, NOT a text
                                  replacement (full title+time stay on every block).
                                  Absolutely positioned so it never steals width from
                                  the truncating title: the title keeps the full row
                                  and the badge yields visually in the tightest column. */}
                              {block.event.isRecurring && (
                                <span
                                  className="absolute top-0.5 right-1 text-[10px] leading-none opacity-60 pointer-events-none select-none"
                                  aria-label="Recurring"
                                  title="Recurring"
                                >
                                  ↻
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Budget totals row */}
              {showBudgetTotals && (
                <div className="flex border-t border-border">
                  <div className="w-14 flex-shrink-0" />
                  {gridDays.map((day, idx) => {
                    const dayEvents = getEventsForDate(day);
                    const total = dayEvents.reduce((s, e) => s + (e.budgetAmount || 0), 0);
                    return (
                      <div key={idx} className="flex-1 border-l border-border-light px-1 py-1 text-center">
                        {total > 0 && <div className="text-[10px] font-bold text-text-secondary tabular-nums">{formatCurrency(total)}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Month view — unchanged */
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map(day => <div key={day} className="text-center text-sm font-semibold text-text-muted py-2">{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="min-h-[90px]" />;
                  const date = new Date(selectedYear, selectedMonth, day);
                  const dayEvents = getEventsForDate(date);
                  const dayTotal = dayEvents.reduce((sum, e) => sum + (e.budgetAmount || 0), 0);
                  const isToday = day === now.getDate() && selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
                  const hl = isInHighlight(date);
                  const hasTradeData = showBudgetTotals && dayEvents.length > 0 && dayTotal !== 0;
                  const isWin = hasTradeData && dayTotal > 0;
                  const isLoss = hasTradeData && dayTotal < 0;

                  let cellClass: string;
                  let cellStyle: React.CSSProperties = {};
                  if (isWin) {
                    cellClass = 'border-emerald-400/50 bg-emerald-50/60';
                    cellStyle = { boxShadow: '0 0 12px rgba(22,163,74,0.2)' };
                  } else if (isLoss) {
                    cellClass = 'border-red-400/50 bg-red-50/60';
                    cellStyle = { boxShadow: '0 0 12px rgba(220,38,38,0.2)' };
                  } else if (hl) {
                    cellClass = 'border-purple-300 bg-purple-50/30';
                  } else {
                    cellClass = 'border-border-light bg-bg-row/50';
                  }

                  if (isToday) {
                    cellClass += ' ring-2 ring-brand-purple ring-offset-1';
                  }

                  // Collect detail lines from all events on this day
                  const allDetails = dayEvents.flatMap(e => e.details || []);

                  return (
                    <div key={day} className={`min-h-[90px] p-1.5 rounded-lg border overflow-hidden transition-all cursor-pointer hover:border-border ${cellClass}`} style={cellStyle}>
                      <div className="flex flex-col h-full">
                        <div className={`text-xs font-semibold mb-0.5 ${isToday ? 'text-brand-purple' : 'text-text-secondary'}`}>{day}</div>
                        {dayEvents.length > 0 && (
                          <div className="flex-1 flex flex-col">
                            {hasTradeData && (
                              <div className={`text-sm font-bold font-mono tabular-nums ${isWin ? 'text-brand-green' : isLoss ? 'text-brand-red' : 'text-text-secondary'}`}>
                                {dayTotal > 0 ? '+' : ''}{formatCurrency(dayTotal)}
                              </div>
                            )}
                            {allDetails.length > 0 && (
                              <div className="mt-0.5 space-y-px">
                                {allDetails.slice(0, 2).map((detail, i) => (
                                  <div key={i} className="text-[10px] text-text-muted truncate leading-tight">{detail}</div>
                                ))}
                                {allDetails.length > 2 && <div className="text-[9px] text-text-faint">+{allDetails.length - 2} more</div>}
                              </div>
                            )}
                            {!hasTradeData && (
                              <div className="flex flex-wrap gap-0.5 mt-auto">
                                {dayEvents.slice(0, 4).map((e, i) => {
                                  const config = sourceConfig[e.source] || { dot: 'bg-gray-400' };
                                  return <div key={i} className={`w-2 h-2 rounded-full ${config.dot}`} title={e.title} />;
                                })}
                                {dayEvents.length > 4 && <span className="text-[8px] text-text-faint">+{dayEvents.length - 4}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

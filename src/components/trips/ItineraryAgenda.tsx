'use client';

// ─── Itinerary Agenda / Stack (Travel-PR-18) ─────────────────────────────────
// A compact, chronological agenda view for the trip Itinerary panel. Replaces
// the hourly time-GRID's empty-cell sprawl (a red-eye flight fills a whole
// column) with one row per accounted-for item, grouped under per-day headers.
//
// SCOPE: Trips-only. The shared CalendarGrid (Hub/Trading/trip-list) is NOT
// touched — this component consumes the SAME `CalendarEvent[]` the grid does
// (built at the trip page's calendarEvents transform), reading it as-is. No new
// data shape, no transform change. Colors reuse the same `sourceConfig` the
// grid uses (raw Tailwind from TRAVEL_COA) — no brand tokens, no recolor.
//
// Day/Week/Month = the date WINDOW + day-grouping granularity, NOT grid scale.
// Empty days are skipped — that's the compactness win.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CalendarEvent, SourceConfig } from '@/components/shared/CalendarGrid';

export interface ItineraryAgendaProps {
  /** Same array the CalendarGrid receives (trip page calendarEvents). */
  events: CalendarEvent[];
  /** Same source→color map the grid uses (TRIP_SOURCE_CONFIG). */
  sourceConfig: Record<string, SourceConfig>;
  /** Active granularity = the date window + grouping cadence. */
  view: 'day' | 'week' | 'month';
  /** Window anchor (trip start). Defaults to today when absent. */
  anchorDate?: string;
  /** Mirrors CalendarGrid's onEventClick; `href` on the event takes precedence. */
  onEventClick?: (event: CalendarEvent, mouseEvent?: MouseEvent) => void;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parseDate = (s: string): Date => {
  const [y, m, d] = s.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
};
const dateToKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDay = (d: Date) => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
const formatCurrency = (a: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(a);

// Same 24h→12h formatting the grid uses for block times.
const fmtTime = (t: string): string => {
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
};

export default function ItineraryAgenda({ events, sourceConfig, view, anchorDate, onEventClick }: ItineraryAgendaProps) {
  const router = useRouter();
  const initial = anchorDate ? parseDate(anchorDate) : new Date();
  const [cursor, setCursor] = useState<Date>(initial);

  // ── Window from view + cursor ──────────────────────────────────────────────
  const startOfWeek = (d: Date) => addDays(d, -d.getDay());
  let windowStart: Date;
  let windowEnd: Date;
  if (view === 'day') {
    windowStart = cursor; windowEnd = cursor;
  } else if (view === 'week') {
    windowStart = startOfWeek(cursor); windowEnd = addDays(windowStart, 6);
  } else {
    windowStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    windowEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  }
  const wsKey = dateToKey(windowStart);
  const weKey = dateToKey(windowEnd);

  const shift = (dir: number) => {
    if (view === 'day') setCursor(c => addDays(c, dir));
    else if (view === 'week') setCursor(c => addDays(c, dir * 7));
    else setCursor(c => new Date(c.getFullYear(), c.getMonth() + dir, 1));
  };

  const handleClick = (e: CalendarEvent, native: MouseEvent) => {
    if (e.href) { router.push(e.href); return; }
    onEventClick?.(e, native);
  };

  // A multi-day SPAN (lodging) has distinct start/end dates and no clock time.
  // A red-eye flight also crosses midnight but HAS a startTime — it's a timed
  // row, not a span — so the startTime check keeps the two cases apart.
  const isMultiSpan = (e: CalendarEvent) => !e.startTime && !!e.endDate && e.endDate !== e.startDate;

  // ── Group events into the day they anchor to (clamped into the window) ──────
  const byDay: Record<string, CalendarEvent[]> = {};
  let windowTotal = 0;
  for (const e of events) {
    const evStartKey = e.startDate;
    const evEndKey = e.endDate || e.startDate;
    if (evStartKey > weKey || evEndKey < wsKey) continue; // no overlap with window
    const anchorKey = evStartKey < wsKey ? wsKey : evStartKey; // clamp into window
    (byDay[anchorKey] ||= []).push(e);
    windowTotal += e.budgetAmount || 0;
  }
  const dayKeys = Object.keys(byDay).sort(); // YYYY-MM-DD sorts chronologically

  // No-time / all-day / span rows sort to the TOP of their day group (mirrors
  // the grid's all-day row); timed rows follow, ascending by start time.
  const sortDay = (arr: CalendarEvent[]) => [...arr].sort((a, b) => {
    const at = a.startTime ? 1 : 0;
    const bt = b.startTime ? 1 : 0;
    if (at !== bt) return at - bt;
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    return a.title.localeCompare(b.title);
  });

  const timeLabel = (e: CalendarEvent): string => {
    if (isMultiSpan(e)) {
      const s = parseDate(e.startDate);
      const en = parseDate(e.endDate!);
      const nights = Math.round((en.getTime() - s.getTime()) / 86_400_000);
      return `${fmtDay(s)} → ${fmtDay(en)} · ${nights} night${nights === 1 ? '' : 's'}`;
    }
    if (e.startTime) {
      const s = parseDate(e.startDate);
      const startStr = fmtTime(e.startTime);
      if (e.endTime) {
        const crossesDay = !!e.endDate && e.endDate !== e.startDate;
        if (crossesDay) {
          const en = parseDate(e.endDate!);
          return `${fmtDay(s)} · ${startStr} → ${fmtDay(en)} · ${fmtTime(e.endTime)}`;
        }
        return `${startStr} → ${fmtTime(e.endTime)}`;
      }
      return startStr;
    }
    return 'All day';
  };

  const windowLabel = view === 'day'
    ? `${DOW[windowStart.getDay()]} ${fmtDay(windowStart)}, ${windowStart.getFullYear()}`
    : view === 'week'
      ? `${fmtDay(windowStart)} – ${fmtDay(windowEnd)}, ${windowEnd.getFullYear()}`
      : `${MONTHS_SHORT[windowStart.getMonth()]} ${windowStart.getFullYear()}`;

  return (
    <div>
      {/* Window nav header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{windowLabel}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(initial)} className="px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-row rounded border border-border transition-colors">Start</button>
          <button onClick={() => shift(-1)} aria-label="Previous" className="w-7 h-7 flex items-center justify-center text-text-muted rounded hover:bg-bg-row transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => shift(1)} aria-label="Next" className="w-7 h-7 flex items-center justify-center text-text-muted rounded hover:bg-bg-row transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {dayKeys.length === 0 ? (
        <div className="text-xs text-text-muted py-6 text-center border border-dashed border-border rounded">
          No itinerary items in this {view}.
        </div>
      ) : (
        <div className="space-y-4">
          {dayKeys.map(dk => {
            const d = parseDate(dk);
            const rows = sortDay(byDay[dk]);
            return (
              <div key={dk}>
                <div className="flex items-baseline gap-2 mb-1.5 pb-1 border-b border-border">
                  <span className="text-xs font-semibold text-text-primary">{DOW[d.getDay()]}</span>
                  <span className="text-xs text-text-muted">{fmtDay(d)}</span>
                </div>
                <div className="space-y-1">
                  {rows.map((e, i) => {
                    const cfg = sourceConfig[e.source];
                    const dot = cfg?.dot || 'bg-gray-400';
                    const clickable = !!(e.href || onEventClick);
                    return (
                      <div
                        key={e.id || i}
                        onClick={(ev) => handleClick(e, ev.nativeEvent)}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded ${clickable ? 'cursor-pointer hover:bg-bg-row' : ''}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} aria-hidden="true" />
                        <span className="text-[11px] text-text-muted tabular-nums flex-shrink-0 whitespace-nowrap">{timeLabel(e)}</span>
                        <span className="text-xs text-text-primary font-medium flex-1 min-w-0 truncate">
                          {e.title}
                          {e.isRecurring && <span className="ml-1 opacity-60" aria-label="Recurring" title="Recurring">↻</span>}
                        </span>
                        {e.location && (
                          <span className="hidden sm:block text-[11px] text-text-faint truncate max-w-[120px] flex-shrink-0">{e.location}</span>
                        )}
                        {e.budgetAmount != null && e.budgetAmount > 0 && (
                          <span className="text-[11px] font-semibold text-emerald-700 tabular-nums flex-shrink-0">{formatCurrency(e.budgetAmount)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cost-total footer — preserved in both views (mirrors the grid's totals). */}
      {windowTotal > 0 && (
        <div className="flex items-center justify-between mt-4 pt-2 border-t border-border">
          <span className="text-xs font-semibold text-text-secondary">Total</span>
          <span className="text-xs font-bold text-text-primary tabular-nums">{formatCurrency(windowTotal)}</span>
        </div>
      )}
    </div>
  );
}

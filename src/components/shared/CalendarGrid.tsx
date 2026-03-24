'use client';

import { useState, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CalendarEvent {
  id: string;
  source: string;
  title: string;
  icon?: string | null;
  startDate: string;        // YYYY-MM-DD
  endDate?: string | null;
  isRecurring?: boolean;
  location?: string | null;
  budgetAmount?: number;
}

export interface SourceConfig {
  label: string;
  icon: string;
  bg: string;         // badge/card background: 'bg-blue-100'
  dot: string;         // month-view dot: 'bg-blue-400'
  badge?: string;      // week-view event badge: 'bg-blue-400' (falls back to dot)
  text?: string;       // text color for labels
}

export interface CalendarGridProps {
  events: CalendarEvent[];
  sourceConfig: Record<string, SourceConfig>;
  defaultView?: 'week' | 'month';
  anchorDate?: string;           // anchor calendar to this date instead of today (YYYY-MM-DD)
  highlightStart?: string;       // highlight trip range start (YYYY-MM-DD)
  highlightEnd?: string;         // highlight trip range end (YYYY-MM-DD)
  onEventClick?: (event: CalendarEvent) => void;
  showBudgetTotals?: boolean;
  showCategoryLegend?: boolean;
  compact?: boolean;             // smaller sizing for embedded use
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

const dateToKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
}: CalendarGridProps) {
  const now = new Date();

  // Determine initial anchor
  const anchor = anchorDate ? parseDate(anchorDate) : now;

  const [calendarView, setCalendarView] = useState<'week' | 'month'>(defaultView);
  const [selectedYear, setSelectedYear] = useState(anchor.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(anchor.getMonth());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  // Visible categories (all on by default)
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
    events.forEach(e => {
      const d = parseDate(e.startDate);
      const key = dateToKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(e);
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
  const goToToday = () => {
    const t = anchorDate ? parseDate(anchorDate) : new Date();
    setSelectedYear(t.getFullYear()); setSelectedMonth(t.getMonth());
    const s = new Date(t); s.setDate(t.getDate() - t.getDay()); setSelectedWeekStart(s);
  };

  // ── Calendar arrays ──
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) { const d = new Date(selectedWeekStart); d.setDate(selectedWeekStart.getDate() + i); weekDays.push(d); }

  const headerTitle = calendarView === 'week'
    ? `${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
    : `${MONTHS[selectedMonth]} ${selectedYear}`;

  const maxEventsWeek = compact ? 5 : 8;

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="bg-white rounded border border-border overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-row/50">
        <div className="flex items-center gap-4">
          <div className="flex bg-border/70 rounded p-0.5">
            <button onClick={() => setCalendarView('week')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${calendarView === 'week' ? 'bg-white shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>Week</button>
            <button onClick={() => setCalendarView('month')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${calendarView === 'month' ? 'bg-white shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>Month</button>
          </div>
        </div>
        <h2 className="text-sm font-semibold text-text-primary">{headerTitle}</h2>
        <div className="flex items-center gap-2">
          <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-row rounded border border-border transition-colors">
            {anchorDate ? 'Start' : 'Today'}
          </button>
          <button onClick={calendarView === 'week' ? prevWeek : prevMonth} className="w-8 h-8 flex items-center justify-center text-text-muted rounded hover:bg-bg-row transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={calendarView === 'week' ? nextWeek : nextMonth} className="w-8 h-8 flex items-center justify-center text-text-muted rounded hover:bg-bg-row transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Category legend sidebar */}
        {showCategoryLegend && (
          <div className="w-44 border-r border-border p-3 bg-bg-row/30 hidden sm:block">
            <div className="space-y-0.5">
              {Object.entries(sourceConfig).map(([source, config]) => (
                <label key={source} className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:bg-bg-row transition-colors">
                  <input type="checkbox" checked={visibleCategories[source] !== false} onChange={e => setVisibleCategories(prev => ({ ...prev, [source]: e.target.checked }))} className="sr-only" />
                  <div className={`w-3 h-3 rounded-sm transition-colors ${visibleCategories[source] !== false ? (config.badge || config.dot) : 'bg-border'}`} />
                  <span className={`text-sm transition-colors ${visibleCategories[source] !== false ? 'text-text-secondary font-medium' : 'text-text-faint'}`}>{config.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Calendar body */}
        <div className="flex-1 min-w-0">
          {calendarView === 'week' ? (
            <div>
              {/* Week header */}
              <div className="grid grid-cols-7 border-b border-border">
                {weekDays.map((day, idx) => {
                  const isToday = day.toDateString() === now.toDateString();
                  const hl = isInHighlight(day);
                  return (
                    <div key={idx} className={`text-center py-3 border-r border-border-light last:border-r-0 ${isToday ? 'bg-red-50' : hl ? 'bg-purple-50/40' : ''}`}>
                      <div className="text-xs text-text-muted uppercase tracking-wide font-medium">{DAYS[day.getDay()]}</div>
                      <div className={`text-sm font-light mt-0.5 ${isToday ? 'bg-red-500 text-white w-9 h-9 rounded-full flex items-center justify-center mx-auto' : 'text-text-primary'}`}>{day.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              {/* Week body */}
              <div className="grid grid-cols-7 min-h-[320px]">
                {weekDays.map((day, idx) => {
                  const dayEvents = getEventsForDate(day);
                  const isToday = day.toDateString() === now.toDateString();
                  const hl = isInHighlight(day);
                  return (
                    <div key={idx} className={`border-r border-border-light last:border-r-0 p-1.5 ${isToday ? 'bg-red-50/30' : hl ? 'bg-purple-50/20' : ''}`}>
                      <div className="space-y-1">
                        {dayEvents.slice(0, maxEventsWeek).map((event, eventIdx) => {
                          const config = sourceConfig[event.source] || { dot: 'bg-gray-400', badge: 'bg-gray-400', label: event.source, icon: '', bg: '' };
                          const badgeColor = config.badge || config.dot;
                          return (
                            <div key={event.id || eventIdx}
                              onClick={() => onEventClick?.(event)}
                              className={`${badgeColor} text-white text-xs px-2 py-1.5 rounded truncate ${onEventClick ? 'cursor-pointer hover:opacity-90' : ''} transition-opacity`}
                              title={`${event.title}${event.budgetAmount ? ' - ' + formatCurrency(event.budgetAmount) : ''}`}>
                              {event.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > maxEventsWeek && <div className="text-xs text-text-muted px-2">+{dayEvents.length - maxEventsWeek} more</div>}
                        {showBudgetTotals && dayEvents.length > 0 && (() => {
                          const total = dayEvents.reduce((s, e) => s + (e.budgetAmount || 0), 0);
                          return total > 0 ? <div className="text-[10px] font-bold text-text-secondary tabular-nums px-1 pt-1">{formatCurrency(total)}</div> : null;
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Month view */
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map(day => <div key={day} className="text-center text-sm font-semibold text-text-muted py-2">{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
                  const date = new Date(selectedYear, selectedMonth, day);
                  const dayEvents = getEventsForDate(date);
                  const dayTotal = dayEvents.reduce((sum, e) => sum + (e.budgetAmount || 0), 0);
                  const isToday = day === now.getDate() && selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
                  const hl = isInHighlight(date);
                  return (
                    <div key={day} className={`aspect-square p-1 rounded border overflow-hidden transition-all cursor-pointer hover:border-border ${
                      isToday ? 'border-red-400 border-2 bg-red-50' : hl ? 'border-purple-300 bg-purple-50/30' : 'border-border-light bg-bg-row/50'
                    }`}>
                      <div className="flex flex-col h-full">
                        <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-brand-red' : 'text-text-secondary'}`}>{day}</div>
                        {dayEvents.length > 0 && (
                          <div className="flex-1 flex flex-col justify-end">
                            <div className="flex flex-wrap gap-0.5 mb-1">
                              {dayEvents.slice(0, 4).map((e, i) => {
                                const config = sourceConfig[e.source] || { dot: 'bg-gray-400' };
                                return <div key={i} className={`w-2 h-2 rounded-full ${config.dot}`} title={e.title} />;
                              })}
                              {dayEvents.length > 4 && <span className="text-[8px] text-text-faint">+{dayEvents.length - 4}</span>}
                            </div>
                            {showBudgetTotals && dayTotal > 0 && (
                              <div className="text-[10px] font-bold text-text-secondary tabular-nums truncate">{formatCurrency(dayTotal)}</div>
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

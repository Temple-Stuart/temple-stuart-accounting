'use client';

import { useState, useMemo, useRef, useEffect } from 'react';

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
  isRecurring?: boolean;
  location?: string | null;
  budgetAmount?: number;
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
  defaultView?: 'week' | 'month';
  anchorDate?: string;
  highlightStart?: string;
  highlightEnd?: string;
  onEventClick?: (event: CalendarEvent, mouseEvent?: MouseEvent) => void;
  showBudgetTotals?: boolean;
  showCategoryLegend?: boolean;
  compact?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HOUR_HEIGHT = 40;
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
    const evtStartKey = event.startDate;
    const evtEndKey = event.endDate || event.startDate;
    const startMin = timeToMinutes(event.startTime);
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
}: CalendarGridProps) {
  const now = new Date();
  const anchor = anchorDate ? parseDate(anchorDate) : now;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [calendarView, setCalendarView] = useState<'week' | 'month'>(defaultView);
  const [selectedYear, setSelectedYear] = useState(anchor.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(anchor.getMonth());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });
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
    events.forEach(e => {
      const d = parseDate(e.startDate);
      const key = dateToKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(e);
      // For multi-day events, also index on endDate
      if (e.endDate && e.endDate !== e.startDate) {
        const ed = parseDate(e.endDate);
        const ekey = dateToKey(ed);
        if (!map[ekey]) map[ekey] = [];
        if (!map[ekey].some(x => x.id === e.id)) map[ekey].push(e);
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

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  // ── Auto-scroll to first timed event ──
  useEffect(() => {
    if (calendarView !== 'week' || !scrollRef.current) return;
    const allWeekEvents = weekDays.flatMap(d => getEventsForDate(d));
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
  }, [calendarView, selectedWeekStart]);

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
          {/* Timezone toggle */}
          {calendarView === 'week' && (
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
          {calendarView === 'week' ? (
            <div>
              {/* Week header — sticky */}
              <div className="flex border-b border-border sticky top-0 z-10 bg-white">
                <div className="w-14 flex-shrink-0" />
                {weekDays.map((day, idx) => {
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

              {/* All-day events row */}
              {(() => {
                const allDayEvents = weekDays.map(day => {
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
                    {weekDays.map((day, idx) => {
                      const evts = allDayEvents[idx];
                      return (
                        <div key={idx} className="flex-1 border-l border-border-light p-0.5 min-h-[28px]">
                          {evts.slice(0, 3).map((event, i) => {
                            const config = sourceConfig[event.source] || { badge: 'bg-gray-400', dot: 'bg-gray-400' };
                            return (
                              <div key={event.id || i}
                                onClick={(e) => onEventClick?.(event, e.nativeEvent)}
                                className={`${config.badge || config.dot} text-white text-[10px] px-1.5 py-0.5 rounded truncate mb-0.5 ${onEventClick ? 'cursor-pointer hover:opacity-90' : ''}`}
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
                  {/* Time gutter */}
                  <div className="w-14 flex-shrink-0 relative">
                    {hours.map(hour => (
                      <div key={hour} className="absolute w-full text-right pr-2" style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }}>
                        <span className="text-[10px] text-text-faint leading-none relative -top-1.5">
                          {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day, dayIdx) => {
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

                        {/* Current time indicator */}
                        {isToday && (() => {
                          const nowMin = now.getHours() * 60 + now.getMinutes();
                          const top = (nowMin / 60) * HOUR_HEIGHT;
                          return (
                            <div className="absolute w-full z-20" style={{ top: `${top}px` }}>
                              <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
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
                              onClick={(e) => onEventClick?.(block.event, e.nativeEvent)}
                              className={`absolute left-0.5 right-0.5 ${badgeColor} text-white ${roundClass} overflow-hidden z-10 ${onEventClick ? 'cursor-pointer hover:opacity-90' : ''} transition-opacity`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              title={`${block.label}${block.event.budgetAmount ? ' - ' + formatCurrency(block.event.budgetAmount) : ''}`}
                            >
                              <div className="px-1.5 py-1 h-full overflow-hidden">
                                <div className="text-[11px] font-semibold leading-tight truncate">{block.label}</div>
                                {block.event.startTime && (
                                  <div className="text-[10px] opacity-80 leading-tight mt-0.5">
                                    {formatTime12h(block.event.startTime)}
                                    {block.event.endTime ? ` — ${formatTime12h(block.event.endTime)}` : ''}
                                  </div>
                                )}
                                {block.event.location && (
                                  <div className="text-[10px] opacity-70 leading-tight mt-0.5 truncate">{block.event.location}</div>
                                )}
                                {!block.event.startTime && block.event.budgetAmount && block.event.budgetAmount > 0 && (
                                  <div className="text-[10px] opacity-80 leading-tight mt-0.5">{formatCurrency(block.event.budgetAmount)}</div>
                                )}
                              </div>
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
                  {weekDays.map((day, idx) => {
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

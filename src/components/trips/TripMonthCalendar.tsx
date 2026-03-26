'use client';

import { useState, useMemo } from 'react';

interface Trip {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  activity: string | null;
}

interface TripMonthCalendarProps {
  trips: Trip[];
  onTripClick?: (tripId: string) => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const TRIP_COLORS = [
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TripMonthCalendar({ trips, onTripClick }: TripMonthCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  // Previous month trailing days
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Build day coverage map: dateKey -> { tripId, tripName, colorIdx, isStart, isEnd }[]
  const { dayCoverage, tripColorMap } = useMemo(() => {
    const coverage: Record<string, { tripId: string; tripName: string; colorIdx: number; isStart: boolean; isEnd: boolean }[]> = {};
    const colorMap: Record<string, number> = {};
    let colorIdx = 0;

    const datedTrips = trips.filter(t => t.startDate && t.endDate);
    datedTrips.forEach(trip => {
      if (!colorMap.hasOwnProperty(trip.id)) {
        colorMap[trip.id] = colorIdx % TRIP_COLORS.length;
        colorIdx++;
      }
      const ci = colorMap[trip.id];
      const start = parseLocalDate(trip.startDate!);
      const end = parseLocalDate(trip.endDate!);
      const startKey = dateKey(start);
      const endKey = dateKey(end);

      // Iterate each day in range
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = dateKey(cursor);
        if (!coverage[key]) coverage[key] = [];
        coverage[key].push({
          tripId: trip.id,
          tripName: trip.name,
          colorIdx: ci,
          isStart: key === startKey,
          isEnd: key === endKey,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return { dayCoverage: coverage, tripColorMap: colorMap };
  }, [trips]);

  const todayKey = dateKey(now);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // Calendar grid cells
  const cells: { day: number; inMonth: boolean }[] = [];
  // Leading days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, inMonth: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true });
  }
  // Trailing days to fill last row
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, inMonth: false });
    }
  }

  return (
    <div className="bg-white border border-border">
      <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center justify-between">
        <span>Trip Calendar</span>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center hover:bg-white/20 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-xs font-medium min-w-[120px] text-center">{MONTHS[month]} {year}</span>
          <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center hover:bg-white/20 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div className="p-3">
        {/* Weekday header */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d, i) => (
            <div key={i} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const key = cell.inMonth ? dateKey(new Date(year, month, cell.day)) : null;
            const isToday = cell.inMonth && key === todayKey;
            const coverage = key ? (dayCoverage[key] || []) : [];
            const hasTrip = coverage.length > 0;

            return (
              <div
                key={idx}
                className="relative flex flex-col items-center"
                style={{ height: '40px' }}
              >
                {/* Day number */}
                <div
                  className={`w-7 h-7 flex items-center justify-center text-xs rounded-full transition-colors ${
                    !cell.inMonth
                      ? 'text-gray-300'
                      : isToday
                        ? 'bg-brand-purple text-white font-bold'
                        : hasTrip
                          ? 'font-medium text-text-primary'
                          : 'text-text-secondary'
                  } ${hasTrip && cell.inMonth && !isToday ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                  onClick={() => {
                    if (hasTrip && cell.inMonth && onTripClick) {
                      onTripClick(coverage[0].tripId);
                    }
                  }}
                >
                  {cell.day}
                </div>
                {/* Trip indicator dots */}
                {hasTrip && cell.inMonth && (
                  <div className="flex gap-0.5 mt-0.5">
                    {coverage.slice(0, 3).map((c, i) => {
                      const color = TRIP_COLORS[c.colorIdx];
                      return (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${color.bg.replace('100', '400')}`}
                          style={{ backgroundColor: getColorHex(c.colorIdx) }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Trip legend */}
        {(() => {
          const visibleTrips = trips.filter(t => {
            if (!t.startDate || !t.endDate) return false;
            const start = parseLocalDate(t.startDate);
            const end = parseLocalDate(t.endDate);
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 0);
            return start <= monthEnd && end >= monthStart;
          });
          if (visibleTrips.length === 0) return null;
          return (
            <div className="mt-2 pt-2 border-t border-border-light">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {visibleTrips.map(trip => {
                  const ci = tripColorMap[trip.id] ?? 0;
                  const color = TRIP_COLORS[ci];
                  return (
                    <button
                      key={trip.id}
                      onClick={() => onTripClick?.(trip.id)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${color.bg} ${color.text} hover:opacity-80 transition-opacity`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getColorHex(ci) }} />
                      {trip.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function getColorHex(idx: number): string {
  const colors = ['#9333ea', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4'];
  return colors[idx % colors.length];
}

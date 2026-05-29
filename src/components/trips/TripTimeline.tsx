'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface TimelineTrip {
  id: string;
  name: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  committedAt: string | null;
}

interface TripTimelineProps {
  trips: TimelineTrip[];
}

type View = 'daily' | 'monthly';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// PR-12 Fix 3: replaces the prior month-grid calendar with a stacked
// timeline of trip date blocks. Each trip is one row; its bar spans
// the trip's date range. Daily / Monthly toggle compresses the x-axis.
export default function TripTimeline({ trips }: TripTimelineProps) {
  const router = useRouter();
  const [view, setView] = useState<View>('monthly');

  const withDates = useMemo(
    () => trips.filter(t => t.startDate && t.endDate),
    [trips]
  );

  // Min/max across all trips → axis range
  const { minTime, maxTime } = useMemo(() => {
    if (withDates.length === 0) return { minTime: 0, maxTime: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (const t of withDates) {
      const s = new Date(t.startDate!).getTime();
      const e = new Date(t.endDate!).getTime();
      if (s < min) min = s;
      if (e > max) max = e;
    }
    return { minTime: min, maxTime: max };
  }, [withDates]);

  // Axis tick labels — month boundaries for monthly view, day-ticks (week
  // boundaries) for daily view so the bar isn't a confused smear.
  const axisTicks = useMemo(() => {
    if (withDates.length === 0) return [] as { label: string; pct: number }[];
    const span = Math.max(1, maxTime - minTime);
    const ticks: { label: string; pct: number }[] = [];
    const start = new Date(minTime);
    const end = new Date(maxTime);

    if (view === 'monthly') {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor.getTime() <= end.getTime()) {
        const pct = ((cursor.getTime() - minTime) / span) * 100;
        ticks.push({
          label: `${MONTHS_SHORT[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
          pct: Math.max(0, Math.min(100, pct)),
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      while (cursor.getTime() <= end.getTime()) {
        const pct = ((cursor.getTime() - minTime) / span) * 100;
        ticks.push({
          label: `${MONTHS_SHORT[cursor.getMonth()]} ${cursor.getDate()}`,
          pct: Math.max(0, Math.min(100, pct)),
        });
        cursor.setDate(cursor.getDate() + 7);
      }
    }
    return ticks;
  }, [withDates, view, minTime, maxTime]);

  if (withDates.length === 0) {
    return (
      <div className="p-8 text-center text-text-faint text-sm">
        No trips with dates yet — saved trips will appear here as time blocks.
      </div>
    );
  }

  const span = Math.max(1, maxTime - minTime);

  return (
    <div className="p-4">
      {/* Daily / Monthly toggle */}
      <div className="flex items-center justify-end gap-1 mb-3">
        <button
          type="button"
          onClick={() => setView('daily')}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            view === 'daily'
              ? 'bg-brand-purple text-white border-brand-purple'
              : 'border-gray-200 text-text-secondary hover:bg-bg-row'
          }`}
        >
          Daily
        </button>
        <button
          type="button"
          onClick={() => setView('monthly')}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            view === 'monthly'
              ? 'bg-brand-purple text-white border-brand-purple'
              : 'border-gray-200 text-text-secondary hover:bg-bg-row'
          }`}
        >
          Monthly
        </button>
      </div>

      {/* Axis */}
      <div className="relative h-5 border-b border-gray-200 mb-2">
        {axisTicks.map((t, i) => (
          <div
            key={i}
            className="absolute top-0 text-[10px] text-text-faint font-mono -translate-x-1/2"
            style={{ left: `${t.pct}%` }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {/* Trip bars */}
      <div className="space-y-2">
        {withDates.map(trip => {
          const start = new Date(trip.startDate!).getTime();
          const end = new Date(trip.endDate!).getTime();
          const leftPct = ((start - minTime) / span) * 100;
          const widthPct = Math.max(0.5, ((end - start) / span) * 100);
          const isCommitted = !!trip.committedAt;

          return (
            <div key={trip.id} className="flex items-center gap-3">
              <div
                className="w-40 text-xs text-text-primary truncate cursor-pointer hover:text-brand-purple"
                onClick={() => router.push(`/budgets/trips/${trip.id}`)}
                title={trip.name}
              >
                {trip.name}
              </div>
              <div className="relative flex-1 h-6 bg-bg-row rounded">
                <div
                  className={`absolute top-0 h-full rounded text-[10px] text-white px-2 flex items-center cursor-pointer transition-colors ${
                    isCommitted
                      ? 'bg-brand-purple hover:bg-brand-purple-hover'
                      : 'bg-brand-gold hover:bg-brand-gold-bright'
                  }`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  onClick={() => router.push(`/budgets/trips/${trip.id}`)}
                  title={`${trip.destination || trip.name} · ${new Date(start).toLocaleDateString()} → ${new Date(end).toLocaleDateString()}`}
                >
                  <span className="truncate">{trip.destination || trip.name}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-[10px] text-text-faint">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-purple rounded-sm" /> Committed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-gold rounded-sm" /> Planning</span>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';

// Zone 3 (Overhaul-PR-3b): travel expenses for the active/upcoming committed
// trip, ordered by itinerary time. REAL data only — reuses /api/hub/trips
// (committed trips) + the existing auth'd /api/trips/[id]/itinerary endpoint.
// No fabricated rows: missing data → honest empty states.

interface TripSummary {
  id: string;
  name: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface ItineraryEntry {
  id: string;
  day: number;
  homeDate: string;
  homeTime: string | null;
  category: string;
  vendor: string;
  cost: string | null; // Prisma Decimal serialized as string
  note: string | null;
}

function fmtCost(s: string | null): string {
  if (s == null) return '—';
  const n = Number(s);
  return Number.isFinite(n) ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
}

/** Pick the active/upcoming trip: earliest whose endDate (or startDate) is today
 *  or later. Trips arrive sorted by startDate asc. Returns null if none upcoming. */
function pickActiveTrip(trips: TripSummary[]): TripSummary | null {
  const todayKey = new Date().toISOString().slice(0, 10);
  for (const t of trips) {
    const end = (t.endDate ?? t.startDate)?.slice(0, 10);
    if (end && end >= todayKey) return t;
  }
  return null;
}

export default function TripExpensesCard({ trips }: { trips: TripSummary[] }) {
  const activeTrip = useMemo(() => pickActiveTrip(trips), [trips]);
  const [entries, setEntries] = useState<ItineraryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeTrip) { setEntries(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/trips/${activeTrip.id}/itinerary`)
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => { if (!cancelled) setEntries(d.entries ?? []); })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeTrip]);

  // Order by itinerary time: day, then home time-of-day.
  const ordered = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort((a, b) =>
      a.day - b.day || (a.homeTime ?? '').localeCompare(b.homeTime ?? ''));
  }, [entries]);

  const total = ordered.reduce((s, e) => s + (Number(e.cost) || 0), 0);

  return (
    <div className="bg-white rounded-lg border border-border overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border bg-brand-purple-wash flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Trip Expenses</h2>
        {activeTrip && (
          <span className="text-xs text-text-muted truncate max-w-[50%]" title="Itinerary items are calendar-linked (calendar_events source='trip')">
            {activeTrip.name}{activeTrip.destination ? ` · ${activeTrip.destination}` : ''}
          </span>
        )}
      </div>

      {!activeTrip ? (
        <div className="px-4 py-8 text-center text-sm text-text-faint">No active trip</div>
      ) : loading ? (
        <div className="px-4 py-8 text-center text-sm text-text-faint">Loading itinerary…</div>
      ) : ordered.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-text-faint">No itinerary items for this trip</div>
      ) : (
        <>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-border-light">
            {ordered.map((e) => (
              <div key={e.id} className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-2 items-center text-xs font-mono">
                <div className="text-text-faint whitespace-nowrap">
                  D{e.day}{e.homeTime ? ` · ${e.homeTime}` : ''}
                </div>
                <div className="min-w-0">
                  <div className="text-text-primary truncate">{e.vendor}</div>
                  <div className="text-text-faint truncate">{e.category}</div>
                </div>
                <div className="text-text-secondary text-right whitespace-nowrap">{fmtCost(e.cost)}</div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs font-mono">
            <span className="text-text-muted">Total</span>
            <span className="font-semibold text-text-primary">${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
        </>
      )}
    </div>
  );
}

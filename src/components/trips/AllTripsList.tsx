'use client';

/**
 * AllTripsList — the "All Trips" list under the home Travel section (PR-HCR-Trips1).
 *
 * Shows the logged-in user's trips from GET /api/trips (name, destination, dates,
 * status). It is ACCOUNT-GATED by its mount: ModuleLauncher only renders it when
 * authed === true, so it never fetches a personal route for a guest. It re-fetches
 * whenever `refreshSignal` changes — the home Create-trip form bumps that after a
 * successful create, so a new trip shows up here in place (no navigation away).
 *
 * PR-HCR-Trips2: selection is LIFTED — clicking a row calls `onSelect(trip)` and the
 * parent (ModuleLauncher) owns the current trip, so later budget actions can read it.
 * The row highlight is driven by the parent's `selectedTripId`. This PR is selection +
 * context only — the click→populate detail view and budget writes are later PRs.
 */

import { useEffect, useState } from 'react';

export interface TripRow {
  id: string;
  name: string;
  destination: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  tripType: string;
}

interface Props {
  /** Bumped by the parent after a create so the list re-fetches in place. */
  refreshSignal?: number;
  /** PR-HCR-Trips2: lifted selection. The parent owns the current trip; clicking a
   *  row calls this so budget actions (later PRs) can read the selected trip. */
  onSelect?: (trip: TripRow) => void;
  /** The currently selected trip id (from the parent) — drives the row highlight. */
  selectedTripId?: string | null;
}

function formatRange(start: string | null, end: string | null): string {
  if (!start) return 'No dates yet';
  const fmt = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

export default function AllTripsList({ refreshSignal = 0, onSelect, selectedTripId = null }: Props) {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/trips')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load your trips (HTTP ${res.status})`);
        const data = await res.json();
        if (!cancelled) setTrips((data.trips || []) as TripRow[]);
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your trips'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-lg font-bold text-brand-purple">Your trips</p>
        {!loading && !error && <span className="text-xs text-text-muted">{trips.length} {trips.length === 1 ? 'trip' : 'trips'}</span>}
      </div>

      {loading && <p className="text-sm text-text-muted">Loading your trips…</p>}
      {error && <p className="rounded-lg border border-border bg-bg-row p-4 text-sm text-brand-red">{error}</p>}

      {!loading && !error && trips.length === 0 && (
        <p className="rounded-lg border border-border bg-bg-row p-4 text-sm text-text-muted">
          No trips yet. Make one above and it shows up here.
        </p>
      )}

      {!loading && !error && trips.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-row text-left text-xs uppercase tracking-wide text-text-faint">
                <th className="px-3 py-2 font-medium">Trip</th>
                <th className="px-3 py-2 font-medium">Where</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr
                  key={trip.id}
                  onClick={() => onSelect?.(trip)}
                  aria-selected={selectedTripId === trip.id}
                  className={`cursor-pointer border-t transition-colors hover:bg-bg-row ${selectedTripId === trip.id ? 'border-brand-purple bg-brand-purple/5' : 'border-border bg-white'}`}
                >
                  <td className="px-3 py-3 font-medium text-text-primary">{trip.name}</td>
                  <td className="px-3 py-3 text-text-secondary">{trip.destination || '—'}</td>
                  <td className="px-3 py-3 text-text-secondary">{formatRange(trip.startDate, trip.endDate)}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-xs font-medium text-brand-purple">
                      {trip.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

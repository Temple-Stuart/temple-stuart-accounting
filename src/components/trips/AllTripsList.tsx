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
 * The row highlight is driven by the parent's `selectedTripId`.
 *
 * PR-Trips3: each row has a delete button — confirm, then DELETE /api/trips/[id] (an
 * ownership-scoped route that cleans the trip + its bookings). On success it calls
 * `onDeleted(tripId)` so the parent re-fetches and clears the selection if needed.
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
  /** PR-Trips3: called with the deleted trip id after a successful delete, so the
   *  parent re-fetches the list and clears the selection if it was the current trip. */
  onDeleted?: (tripId: string) => void;
  /** PR-Trip-Modal: an action rendered in the header's upper-right (next to the
   *  trip count) — the home Travel block passes the "+ Create a trip" button that
   *  opens the create form in a modal. */
  headerAction?: React.ReactNode;
}

function formatRange(start: string | null, end: string | null): string {
  if (!start) return 'No dates yet';
  const fmt = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

export default function AllTripsList({ refreshSignal = 0, onSelect, selectedTripId = null, onDeleted, headerAction }: Props) {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // PR-Trips3: confirm, then delete. stopPropagation so the trash click never also
  // selects the row. The route is ownership-scoped (verifies the trip is the session
  // user's before deleting); on success the parent refreshes + clears the selection.
  const handleDelete = async (e: React.MouseEvent, trip: TripRow) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${trip.name}? This removes the trip and its bookings.`)) return;
    setDeletingId(trip.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Could not delete the trip (HTTP ${res.status})`);
      }
      onDeleted?.(trip.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the trip');
    } finally {
      setDeletingId(null);
    }
  };

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
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-lg font-bold text-white">Your trips</p>
        <div className="flex items-center gap-3">
          {!loading && !error && <span className="text-xs text-white/50">{trips.length} {trips.length === 1 ? 'trip' : 'trips'}</span>}
          {headerAction}
        </div>
      </div>

      {loading && <p className="text-sm text-white/50">Loading your trips…</p>}
      {error && <p className="rounded-lg border border-panel-border bg-panel-surface p-4 text-sm text-brand-red">{error}</p>}

      {!loading && !error && trips.length === 0 && (
        <p className="rounded-lg border border-panel-border bg-panel-surface p-4 text-sm text-white/50">
          No trips yet. Tap &ldquo;+ Create a trip&rdquo; and it shows up here.
        </p>
      )}

      {deleteError && <p className="mb-2 rounded-lg border border-panel-border bg-panel-surface p-3 text-sm text-brand-red">{deleteError}</p>}

      {!loading && !error && trips.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-panel-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-panel-surface text-left font-mono text-[10px] uppercase tracking-wider text-white/40">
                <th className="px-3 py-2 font-medium">Trip</th>
                <th className="px-3 py-2 font-medium">Where</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr
                  key={trip.id}
                  onClick={() => onSelect?.(trip)}
                  aria-selected={selectedTripId === trip.id}
                  className={`cursor-pointer border-t transition-colors hover:bg-panel-hover ${selectedTripId === trip.id ? 'border-brand-purple bg-brand-purple/10' : 'border-panel-border bg-panel-surface'}`}
                >
                  <td className="px-3 py-3 font-medium text-white">{trip.name}</td>
                  <td className="px-3 py-3 text-white/60">{trip.destination || '—'}</td>
                  <td className="px-3 py-3 text-white/60">{formatRange(trip.startDate, trip.endDate)}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-xs font-medium text-white">
                      {trip.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, trip)}
                      disabled={deletingId === trip.id}
                      aria-label={`Delete ${trip.name}`}
                      title="Delete trip"
                      className="rounded p-1 text-white/50 transition-colors hover:bg-panel-hover hover:text-brand-red disabled:opacity-50"
                    >
                      {deletingId === trip.id ? (
                        <span className="text-xs">Deleting…</span>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
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

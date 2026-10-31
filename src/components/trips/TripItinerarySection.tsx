'use client';

/**
 * TripItinerarySection — THE ITINERARY, ON /travel (TRAVEL-01, 2026-09-19).
 *
 * The selected trip's planned items in date order — each named by its item,
 * with its vendor, place, category, planned amount and, where it has one, its
 * time — rendered by the SAME TripTimeline the trip page mounts
 * (src/app/budgets/trips/[id]/page.tsx:645). Reads GET /api/trips/[id]/itinerary
 * (user-scoped; a foreign trip is a 404 the section shows). Two writes reach it,
 * both the trip page's own: the inline time/date edit (TripTimeline's PATCH) and
 * uncommit (a confirm, then DELETE /api/trips/[id]/vendor-commit — the trip
 * page's handleUncommitItem idiom). Nothing else is written; nothing is booked.
 */

import { useCallback, useEffect, useState } from 'react';
import TripTimeline, { type TripItineraryRow } from './TripTimeline';
import type { TripRow } from './AllTripsList';

interface Props {
  /** The trip selected in the list above; null → the honest line. */
  trip: TripRow | null;
  /** Bumped by the parent after any commit so the itinerary re-reads in place. */
  refreshSignal: number;
  /** Fired after an uncommit or an inline edit, so the ledger and bookings re-read too. */
  onChanged: () => void;
}

export default function TripItinerarySection({ trip, refreshSignal, onChanged }: Props) {
  const [rows, setRows] = useState<TripItineraryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!trip) return;
    setError(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/itinerary`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `The itinerary could not be read (HTTP ${res.status}).`);
        setRows(null);
        return;
      }
      setRows((data?.entries ?? []) as TripItineraryRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The itinerary could not be read.');
    }
  }, [trip]);

  useEffect(() => { void load(); }, [load, refreshSignal]);

  const uncommit = async (vendorOptionId: string, vendorOptionType: string) => {
    if (!trip) return;
    if (!confirm('Remove this from your itinerary and budget?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/vendor-commit`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionType: vendorOptionType, optionId: vendorOptionId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || 'Failed to uncommit');
      }
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uncommit failed');
    }
  };

  if (!trip) {
    return <span className="text-xs text-text-muted italic" data-itinerary-empty>no trip selected — pick one above.</span>;
  }

  return (
    <div data-trip-itinerary={trip.id}>
      {error && <p className="mb-2 text-xs text-red-300" data-itinerary-error>{error}</p>}
      {rows === null && !error ? (
        <span className="text-xs text-text-muted">loading the itinerary…</span>
      ) : rows && rows.length === 0 ? (
        <span className="text-xs text-text-muted italic" data-itinerary-empty>
          nothing planned yet — commit a flight, a stay or an activity from Search below.
        </span>
      ) : rows ? (
        <TripTimeline
          tripId={trip.id}
          itinerary={rows}
          startDate={trip.startDate}
          endDate={trip.endDate}
          onUncommit={uncommit}
          onChanged={() => { void load(); onChanged(); }}
        />
      ) : null}
    </div>
  );
}

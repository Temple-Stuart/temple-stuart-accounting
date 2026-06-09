'use client';

// ─── TripTimeline (Travel-PR-5/6 · T2 split) ─────────────────────────────────
// The LIVE, authed container for the trip Itinerary timeline. T2 split: this file
// keeps the EXACT live behavior it had before — the ONE inline time/date edit
// (PATCH /api/trips/[id]/itinerary/[itineraryId]) — and now renders the pure
// <TripTimelineView/> with the itinerary + the real PATCH wired to its onPatchItem
// callback. The public name + prop shape ({ tripId, itinerary, startDate, endDate,
// onUncommit, onChanged }) are unchanged, so the existing call site
// (budgets/trips/[id]/page.tsx:645) is untouched and /budgets/trips/[id] behaves
// identically. The PATCH is container-only; the pure view never fetches.

import TripTimelineView, { type TripItineraryRow, type PatchResult } from './TripTimelineView';

// Re-exported for backward compatibility (the type lived here before T2).
export type { TripItineraryRow } from './TripTimelineView';

interface Props {
  tripId: string;
  itinerary: TripItineraryRow[];
  /** Trip startDate/endDate (ISO) — the day range. Falls back to the min/max
   *  itinerary date when absent. */
  startDate: string | null;
  endDate: string | null;
  /** The SAME uncommit handler the agenda popover wired to (page.tsx
   *  handleUncommitItem) — self-confirms + reloads. */
  onUncommit?: (vendorOptionId: string, vendorOptionType: string) => void;
  /** Refresh after an inline edit — wired to loadTrip (the itinerary reload
   *  handleUncommitItem also calls). */
  onChanged?: () => void;
}

export default function TripTimeline({ tripId, itinerary, startDate, endDate, onUncommit, onChanged }: Props) {
  // The one inline time/date edit (PATCH). Container-only — the pure view awaits
  // this and reads ok/error; it never fetches. Same URL/body/error text as before.
  const patchItem = async (itemId: string, body: Record<string, unknown>): Promise<PatchResult> => {
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return { ok: false, error: d.message || d.error || `Save failed (${res.status})` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Save failed' };
    }
  };

  return (
    <TripTimelineView
      itinerary={itinerary}
      startDate={startDate}
      endDate={endDate}
      onUncommit={onUncommit}
      onChanged={onChanged}
      onPatchItem={patchItem}
    />
  );
}

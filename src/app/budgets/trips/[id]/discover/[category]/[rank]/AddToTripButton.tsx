'use client';

import { useState } from 'react';

interface Props {
  tripId: string;
  /** Hotel name → becomes the budget line description + itinerary vendor. */
  hotelName: string;
  /** Whole-stay total (rec.price, the reconciled PR-21 figure) — committed
   *  verbatim, NOT recomputed. Same value the detail-page Total shows. */
  amount: number | null;
  /** Scan destination (destinationLabel, e.g. "Bali (Canggu), Indonesia") —
   *  the country signal. Written to trip_itinerary.location so Committed
   *  Budget's Country column resolves correctly (page.tsx:306-317). */
  location: string | null;
  /** ISO check-in/out (YYYY-MM-DD) for the multi-day itinerary span. */
  checkinDate: string | null;
  checkoutDate: string | null;
  /** Optional detail passed through to the commit notes. */
  liteapiHotelId?: string | null;
  perNight?: number | null;
  nights?: number | null;
}

// PR-32: "Add to trip" — commits a discover-detail hotel into Committed Budget
// via the SYNTHETIC lodging path on /vendor-commit (no trip_lodging_options row
// required, mirroring the flight synthetic commit). Auth + ownership are enforced
// server-side inside the same gate (route.ts:80-85).
export function AddToTripButton({
  tripId, hotelName, amount, location, checkinDate, checkoutDate,
  liteapiHotelId, perNight, nights,
}: Props) {
  const [state, setState] = useState<'idle' | 'adding' | 'added' | 'failed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdd = async () => {
    setState('adding');
    setErrorMsg(null);
    try {
      // PR-33: commit the EXACT search window the rates were quoted for. NO
      // fallback to trip dates or today — a wrong window is a booking-integrity
      // bug (the 184-night itinerary). Missing dates → fail loud, do NOT commit.
      if (!checkinDate || !checkoutDate) {
        throw new Error('Missing stay dates for this hotel — re-scan to refresh, then add to trip.');
      }
      const startDate = checkinDate;
      const endDate = checkoutDate;

      // PR-33: assert the committed span matches the rec's night count. The
      // mapper derives both from the same search window, so checkout − checkin
      // MUST equal nights; a mismatch means inconsistent dates — fail loud
      // rather than persist a booking whose span and label disagree.
      const spanNights = Math.round(
        (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000,
      );
      if (nights != null && spanNights !== nights) {
        throw new Error(
          `Date mismatch: stay span is ${spanNights} night${spanNights === 1 ? '' : 's'} but the rate is for ${nights} — not committing inconsistent dates.`,
        );
      }
      if (spanNights < 1) {
        throw new Error('Invalid stay window (check-out must be after check-in) — not committing.');
      }

      const detail = [
        perNight != null ? `$${perNight}/night` : null,
        nights != null ? `${nights} night${nights === 1 ? '' : 's'}` : null,
        liteapiHotelId ? `hotel:${liteapiHotelId}` : null,
      ].filter(Boolean).join(' · ');

      const res = await fetch(`/api/trips/${tripId}/vendor-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionType: 'lodging',
          synthetic: true,                  // PR-32: no DB option row — build from payload
          optionId: `hotel-${liteapiHotelId || 'manual'}-${Date.now()}`,
          startDate,
          endDate,
          amount: amount ?? 0,              // rec.price (whole-stay total) — not recomputed
          notes: detail ? `${hotelName} | ${detail}` : hotelName,
          location,                         // destinationLabel → itinerary.location → Country
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Commit failed (HTTP ${res.status})`);
      }
      setState('added');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Add to trip failed');
      setState('failed');
    }
  };

  if (state === 'added') {
    return (
      <a
        href={`/budgets/trips/${tripId}`}
        className="px-4 py-2 bg-emerald-100 border border-emerald-300 text-emerald-800 text-sm font-medium rounded hover:bg-emerald-200"
      >
        ✓ Added to trip — view budget
      </a>
    );
  }

  // PR-33: no stay dates on the rec → disable commit (older cached scan). NO
  // trip-date fallback — re-scan to refresh the window.
  const datesMissing = !checkinDate || !checkoutDate;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleAdd}
        disabled={state === 'adding' || datesMissing}
        title={datesMissing ? 'Re-scan this hotel to refresh its stay dates' : undefined}
        className="px-4 py-2 border border-border text-sm font-medium rounded hover:bg-bg-row disabled:opacity-50"
      >
        {state === 'adding' ? 'Adding…' : 'Add to trip'}
      </button>
      {datesMissing && (
        <span className="text-xs text-text-muted">Re-scan to refresh stay dates.</span>
      )}
      {state === 'failed' && errorMsg && (
        <span className="text-xs text-brand-red">{errorMsg}</span>
      )}
    </div>
  );
}

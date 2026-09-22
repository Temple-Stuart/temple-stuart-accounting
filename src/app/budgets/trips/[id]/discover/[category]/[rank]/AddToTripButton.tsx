'use client';

import { useState } from 'react';
import { listTravelCOAAccounts } from '@/lib/travelCOA';

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
  /** Server-derived COA the selector pre-selects (leaving it reproduces today's
   *  behaviour); user can override to any canonical travel account. */
  suggestedCoaCode: string | null;
}

const COA_ACCOUNTS = listTravelCOAAccounts();

// PR-32: "Add to trip" — commits a discover-detail hotel into Committed Budget
// via the SYNTHETIC lodging path on /vendor-commit (no trip_lodging_options row
// required, mirroring the flight synthetic commit). Auth + ownership are enforced
// server-side inside the same gate (route.ts:80-85).
export function AddToTripButton({
  tripId, hotelName, amount, location, checkinDate, checkoutDate,
  liteapiHotelId, perNight, nights, suggestedCoaCode,
}: Props) {
  const [state, setState] = useState<'idle' | 'adding' | 'added' | 'failed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // HOTEL-02 (2026-09-22): the stay's clock is the property's, read by the commit
  // from the vendor's content — the 22:00–07:00 "overnight window" this button
  // used to prefill and send was a time nobody stated. There is no time input
  // here; the commit answers with what the property stated, shown below.
  const [stayTimes, setStayTimes] = useState<string | null>(null);
  // PR 3 capture: hotels are always DAILY (nightly stay); COA + clean vendor name overridable.
  const [coaCode, setCoaCode] = useState(suggestedCoaCode ?? '');
  const [vendorName, setVendorName] = useState(hotelName);

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
          recurrence: 'daily',              // a hotel stay is a nightly recurring block
          // HOTEL-02: the vendor's hotel id — the commit reads the property's own check-in /
          // check-out once and writes that clock or null; no time is sent from here.
          ...(liteapiHotelId ? { liteapiHotelId } : {}),
          coa_code: coaCode || undefined,        // user-selected COA; server validates, else derives
          vendor_name: vendorName || undefined,  // clean hotel name → trip_itinerary.vendor_name
          location,                         // destinationLabel → itinerary.location → Country
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || d.error || `Commit failed (HTTP ${res.status})`);
      }
      const d = await res.json();
      // HOTEL-02: the commit says what clock it stored — the property's, or its silence named.
      setStayTimes(liteapiHotelId ? (d.stayTimes?.statement ?? 'the commit reported no clock for this stay') : 'no vendor hotel named — no clock stated');
      setState('added');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Add to trip failed');
      setState('failed');
    }
  };

  if (state === 'added') {
    return (
      <div className="flex flex-col gap-1">
        <a
          href={`/budgets/trips/${tripId}`}
          className="self-start px-4 py-2 bg-emerald-100 border border-emerald-300 text-emerald-800 text-sm font-medium rounded hover:bg-emerald-200"
        >
          ✓ Added to trip — view budget
        </a>
        {stayTimes && <span className="text-xs text-text-muted" data-stay-times>{stayTimes}</span>}
      </div>
    );
  }

  // PR-33: no stay dates on the rec → disable commit (older cached scan). NO
  // trip-date fallback — re-scan to refresh the window.
  const datesMissing = !checkinDate || !checkoutDate;
  const inputCls = 'border border-border rounded px-2 py-1.5 text-sm bg-white';

  return (
    <div className="flex flex-col gap-2">
      {/* PR 3 capture — vendor name, COA account (all inline, no modal). Recurrence is
          fixed 'daily' for a nightly hotel stay. HOTEL-02: no time inputs — the
          property's check-in / check-out are read at commit and stated back. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Recurrence</span>
          <span className="px-3 py-1.5 text-sm rounded border border-border bg-white text-text-secondary">Daily (nightly stay)</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Check-in / check-out</span>
          <span className="px-3 py-1.5 text-sm rounded border border-border bg-white text-text-secondary">as the property states them — read when you add</span>
        </div>
        <label className="flex flex-col gap-1 min-w-[10rem]">
          <span className="text-[11px] text-text-muted">Vendor name</span>
          <input type="text" value={vendorName} onChange={e => setVendorName(e.target.value)}
            aria-label="Vendor name" className={`${inputCls} w-48`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">COA account</span>
          <select value={coaCode} onChange={e => setCoaCode(e.target.value)}
            aria-label="COA account" className={`${inputCls} w-56`}>
            <option value="">Auto (suggested)</option>
            {COA_ACCOUNTS.map(a => (
              <option key={a.code} value={a.code}>{a.code} · {a.label}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={state === 'adding' || datesMissing}
        title={datesMissing ? 'Re-scan this hotel to refresh its stay dates' : undefined}
        className="self-start px-4 py-2 border border-border text-sm font-medium rounded hover:bg-bg-row disabled:opacity-50"
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

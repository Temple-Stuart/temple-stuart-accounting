'use client';

/**
 * TripBookings (T3) — the selected trip's ATTACHED, REAL bookings, rendered from
 * GET /api/trips/[id]/reservations (the read-back that previously had zero UI
 * consumers). The twin display of TripBudgetActual: that card shows PLANNED
 * budget lines; this one shows BOOKED, PAID reservations (hotels attach live;
 * flights when T2b lands). Read-only — no writes, no new routes.
 *
 * Refresh truth (why these three triggers, nothing else):
 *  1. fetch on mount + tripId change — hotel bookings finalize on
 *     /booking/confirm (a different route), so coming back to the Travel tab is
 *     always a fresh mount; this covers the primary flow.
 *  2. the parent keys this component by tripsRefresh (same as TripBudgetActual)
 *     so in-tab commits remount + refetch it.
 *  3. a manual Refresh button for anything else (e.g. a booking finished in
 *     another tab) — an honest affordance instead of a fake live feed.
 * Every state is visible: loading, error (with retry), empty, rows. Guest
 * bookings (userId null) are invisible here BY DESIGN — the route never returns
 * them to an account user (reservations/route.ts:12-13).
 */

import { useCallback, useEffect, useState } from 'react';

interface BookingRow {
  id: string;
  name: string;
  provider: string;
  type: string; // 'hotel' | 'flight' | 'activity' | raw provider
  amountUsd: number;
  currency: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  bookingType: string;
  confirmationCode: string | null;
}

interface Props {
  tripId: string;
}

/** Exact-cents sum: per-row dollars → integer cents → sum → dollars. No float
 *  drift, no rounding games. */
function sumUsd(rows: BookingRow[]): string {
  const cents = rows.reduce((s, r) => s + Math.round(r.amountUsd * 100), 0);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export default function TripBookings({ tripId }: Props) {
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading');
  const [rows, setRows] = useState<BookingRow[]>([]);

  const load = useCallback(() => {
    let cancelled = false;
    setState('loading');
    fetch(`/api/trips/${tripId}/reservations`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setRows(Array.isArray(data.reservations) ? (data.reservations as BookingRow[]) : []);
        setState('ok');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [tripId]);

  useEffect(() => load(), [load]);

  return (
    <div className="mt-4 rounded-lg border border-border bg-bg-row p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">
          Booked{state === 'ok' ? ` (${rows.length})` : ''}
        </p>
        <button
          type="button"
          onClick={() => load()}
          className="text-xs font-medium text-brand-purple underline hover:text-brand-purple/80"
        >
          Refresh
        </button>
      </div>

      {state === 'loading' && <p className="text-sm text-text-muted">Loading bookings…</p>}
      {state === 'error' && (
        <p className="text-sm text-brand-red">
          Couldn&apos;t load this trip&apos;s bookings.{' '}
          <button type="button" onClick={() => load()} className="font-medium underline">Retry</button>
        </p>
      )}
      {state === 'ok' && rows.length === 0 && (
        <p className="text-sm text-text-muted">No bookings attached yet.</p>
      )}

      {state === 'ok' && rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-row text-xs uppercase tracking-wide">
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Dates</th>
                  <th className="px-3 py-2 text-right font-medium text-text-muted">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Confirmation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 capitalize text-text-secondary">{r.type}</td>
                    <td className="px-3 py-2 font-medium text-text-primary">{r.name}</td>
                    <td className="px-3 py-2 text-text-secondary">
                      {r.checkIn && r.checkOut
                        ? `${String(r.checkIn).slice(0, 10)} → ${String(r.checkOut).slice(0, 10)}`
                        : ''}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-brand-green">
                      ${r.amountUsd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{r.status}</td>
                    <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                      {r.confirmationCode ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-right text-sm font-semibold text-text-primary">
            Total booked: <span className="text-brand-green">${sumUsd(rows)}</span>
          </p>
        </>
      )}
    </div>
  );
}

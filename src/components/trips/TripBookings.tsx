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

import { Fragment, useCallback, useEffect, useState } from 'react';
import CancelBookingDialog from './CancelBookingDialog';

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
  /** PR-Cancel-1: the stored policy from book time — the pre-cancel dialog
   *  renders exactly this. */
  cancellationPolicyJson?: unknown;
}

/** PR-Cancel-1: the per-row cancellation outcome — the provider's verbatim
 *  numbers on success (null = not stated by provider), or the failure message. */
type CancelOutcome =
  | { ok: true; providerStatus: string | null; refundAmount: number | null; cancellationFee: number | null; currency: string | null }
  | { ok: false; message: string };

function moneyOrUnstated(v: number | null, cur: string | null): string {
  return v === null ? 'not stated by provider' : `${cur ? `${cur} ` : ''}${v.toFixed(2)}`;
}

interface Props {
  tripId: string;
  /** T4: after a detach succeeds, bump the shared tripsRefresh so this block,
   *  UnattachedBookings, and the budget ledger all remount together. */
  onChanged?: () => void;
}

/** Exact-cents sum: per-row dollars → integer cents → sum → dollars. No float
 *  drift, no rounding games. */
function sumUsd(rows: BookingRow[]): string {
  const cents = rows.reduce((s, r) => s + Math.round(r.amountUsd * 100), 0);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export default function TripBookings({ tripId, onChanged }: Props) {
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading');
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // PR-Cancel-1: the row whose pre-cancel dialog is open, and per-row outcomes.
  // Outcomes render INLINE under the row, which REMAINS after cancellation
  // (record-keeping) — so a cancel updates rows LOCALLY instead of bumping the
  // shared tripsRefresh (a remount would erase the inline outcome; the flip is
  // already persisted server-side, so any later refetch agrees).
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelOutcomes, setCancelOutcomes] = useState<Record<string, CancelOutcome>>({});

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

  // T4: detach — tripId → null via the dual-ownership PATCH. The booking is
  // KEPT (it moves to Unattached bookings); only the trip link clears.
  const detach = async (reservationId: string) => {
    if (!window.confirm('Remove this booking from the trip? The booking itself is kept.')) return;
    setBusyId(reservationId);
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not remove the booking from the trip.');
      if (onChanged) onChanged(); else load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove the booking from the trip.');
    } finally {
      setBusyId(null);
    }
  };

  // PR-Cancel-1: the confirmed cancel — POST the authed cancel route; on
  // success flip THIS row's status locally + show the provider's verbatim
  // outcome inline; on failure show the provider's message inline. Either way
  // the dialog closes and the row remains.
  const doCancel = async (row: BookingRow) => {
    setCancelBusy(true);
    try {
      const res = await fetch(`/api/reservations/${row.id}/cancel`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not cancel the booking.');
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: data.reservation?.status ?? 'cancelled' } : r)));
      setCancelOutcomes((prev) => ({
        ...prev,
        [row.id]: {
          ok: true,
          providerStatus: data.cancellation?.providerStatus ?? null,
          refundAmount: data.cancellation?.refundAmount ?? null,
          cancellationFee: data.cancellation?.cancellationFee ?? null,
          currency: data.cancellation?.currency ?? null,
        },
      }));
    } catch (err) {
      setCancelOutcomes((prev) => ({
        ...prev,
        [row.id]: { ok: false, message: err instanceof Error ? err.message : 'Could not cancel the booking.' },
      }));
    } finally {
      setCancelBusy(false);
      setCancelTarget(null);
    }
  };

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
      {actionError && (
        <p className="mb-2 rounded border border-border bg-white p-2 text-sm text-brand-red">{actionError}</p>
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
                  <th className="px-3 py-2 text-left font-medium text-text-muted"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const outcome = cancelOutcomes[r.id];
                  return (
                  <Fragment key={r.id}>
                  <tr className="border-b border-border last:border-0">
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
                    <td className="px-3 py-2 text-right">
                      {/* PR-Cancel-1: hotel-only v1 (liteapi rows), and ONLY while
                          confirmed — after the flip the action disappears, the
                          row stays (record-keeping). */}
                      {r.provider === 'liteapi' && r.status === 'confirmed' && (
                        <button
                          type="button"
                          disabled={busyId === r.id || cancelBusy}
                          onClick={() => setCancelTarget(r)}
                          className="mr-2 rounded border border-brand-red/40 px-2 py-1 text-xs font-medium text-brand-red hover:bg-brand-red/10 disabled:opacity-50"
                        >
                          Cancel booking
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => detach(r.id)}
                        className="rounded border border-border px-2 py-1 text-xs font-medium text-text-muted hover:bg-bg-row disabled:opacity-50"
                      >
                        {busyId === r.id ? 'Removing…' : 'Remove from trip'}
                      </button>
                    </td>
                  </tr>
                  {/* PR-Cancel-1: the provider's actual outcome, inline under the
                      row — verbatim numbers on success, the provider's message on
                      failure. Absent fields say so; nothing is invented. */}
                  {outcome && (
                    <tr className="border-b border-border last:border-0">
                      <td colSpan={7} className="px-3 py-2">
                        {outcome.ok ? (
                          <p className="text-xs text-text-secondary">
                            <span className="font-semibold text-brand-green">Cancelled</span>
                            {outcome.providerStatus ? ` (provider status: ${outcome.providerStatus})` : ''}
                            {' — refund: '}
                            <span className="font-medium">{moneyOrUnstated(outcome.refundAmount, outcome.currency)}</span>
                            {' · cancellation fee: '}
                            <span className="font-medium">{moneyOrUnstated(outcome.cancellationFee, outcome.currency)}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-brand-red">{outcome.message}</p>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-right text-sm font-semibold text-text-primary">
            Total booked: <span className="text-brand-green">${sumUsd(rows)}</span>
          </p>
        </>
      )}

      {cancelTarget && (
        <CancelBookingDialog
          bookingName={cancelTarget.name}
          checkIn={cancelTarget.checkIn}
          checkOut={cancelTarget.checkOut}
          policy={cancelTarget.cancellationPolicyJson ?? null}
          busy={cancelBusy}
          onConfirm={() => doCancel(cancelTarget)}
          onClose={() => { if (!cancelBusy) setCancelTarget(null); }}
        />
      )}
    </div>
  );
}

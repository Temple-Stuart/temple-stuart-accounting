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
import Link from 'next/link';
import CancelBookingDialog from './CancelBookingDialog';
import { destinationWords } from '@/lib/reservations/cancellationWords';

interface BookingRow {
  id: string;
  name: string;
  provider: string;
  type: string; // 'hotel' | 'flight' | 'activity' | raw provider
  /** SEC-03 (2026-09-25): null = the vendor stated no price — rendered "price
   *  not stated", left out of the total (which then says how many are). */
  amountUsd: number | null;
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
 *  numbers on success (null = not stated by provider), or the failure message.
 *  LAUNCH-01 RETIRE-01: the Duffel `flight` variant is gone with the provider —
 *  a 'duffel' history row offers no Cancel action (the route refuses one, 409). */
// CANCEL-01 (2026-09-26): the flight lane adds where the refund goes, any vouchers,
// and the PENDING outcome (a 202 — the airline accepted the request and has not
// finalized; the booking stays confirmed until it does).
interface OutcomeVoucher { code: string | null; airline: string | null; amount: { amount: number; currency: string | null } | null; validFrom: string | null; expiresAt: string | null }
type CancelOutcome =
  | { ok: true; providerStatus: string | null; refundAmount: number | null; cancellationFee: number | null; currency: string | null; destination: string | null; vouchers: OutcomeVoucher[]; pending: boolean }
  | { ok: false; message: string };

function moneyOrUnstated(v: number | null, cur: string | null): string {
  return v === null ? 'not stated by provider' : `${cur ? `${cur} ` : ''}${v.toFixed(2)}`;
}

interface Props {
  tripId: string;
  /** T4: after a detach succeeds, bump the shared tripsRefresh so this block,
   *  UnattachedBookings, and the budget ledger all remount together. */
  onChanged?: () => void;
  /** TRAVEL-PIPE: booking count reported up after each successful fetch (the
   *  Books onTotals idiom — zero new fetches). */
  onTotals?: (t: { bookings: number }) => void;
}

/** Exact-cents sum: per-row dollars → integer cents → sum → dollars. No float
 *  drift, no rounding games. SEC-03: a row whose price the vendor did not state
 *  (amountUsd null) is NOT in the sum; the caller says how many were left out. */
function sumUsd(rows: BookingRow[]): string {
  const cents = rows.reduce((s, r) => s + (r.amountUsd === null ? 0 : Math.round(r.amountUsd * 100)), 0);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
/** SEC-03: how many rows the total could not include. */
function unstatedCount(rows: BookingRow[]): number {
  return rows.filter((r) => r.amountUsd === null).length;
}

export default function TripBookings({ tripId, onChanged, onTotals }: Props) {
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
        const rows = Array.isArray(data.reservations) ? (data.reservations as BookingRow[]) : [];
        setRows(rows);
        onTotals?.({ bookings: rows.length });
        setState('ok');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [tripId, onTotals]);

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
          destination: data.cancellation?.destination ?? null,
          vouchers: Array.isArray(data.cancellation?.vouchers) ? (data.cancellation.vouchers as OutcomeVoucher[]) : [],
          pending: data.cancellation?.pending === true,
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
    <div className="mt-4 rounded-lg border border-border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">
          Booked{state === 'ok' ? ` (${rows.length})` : ''}
        </p>
        <button
          type="button"
          onClick={() => load()}
          className="text-xs font-medium text-text-primary underline hover:text-text-secondary"
        >
          Refresh
        </button>
      </div>

      {state === 'loading' && <p className="text-sm text-text-faint">Loading bookings…</p>}
      {state === 'error' && (
        <p className="text-sm text-brand-red">
          Couldn&apos;t load this trip&apos;s bookings.{' '}
          <button type="button" onClick={() => load()} className="font-medium underline">Retry</button>
        </p>
      )}
      {state === 'ok' && rows.length === 0 && (
        <p className="text-sm text-text-faint">No bookings attached yet.</p>
      )}
      {actionError && (
        <p className="mb-2 rounded border border-border bg-white p-2 text-sm text-brand-red">{actionError}</p>
      )}

      {state === 'ok' && rows.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-white font-mono text-[10px] uppercase tracking-wider">
                  <th className="px-3 py-2 text-left font-medium text-text-faint">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-text-faint">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-text-faint">Dates</th>
                  <th className="px-3 py-2 text-right font-medium text-text-faint">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-text-faint">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-text-faint">Confirmation</th>
                  <th className="px-3 py-2 text-left font-medium text-text-faint"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const outcome = cancelOutcomes[r.id];
                  return (
                  <Fragment key={r.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="px-3 py-2 capitalize text-text-muted">{r.type}</td>
                    <td className="px-3 py-2 font-medium text-text-primary">{r.name}</td>
                    <td className="px-3 py-2 text-text-muted">
                      {r.checkIn && r.checkOut
                        ? `${String(r.checkIn).slice(0, 10)} → ${String(r.checkOut).slice(0, 10)}`
                        : ''}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-brand-gold">
                      {r.amountUsd === null ? <span className="font-sans text-xs font-normal text-text-faint">price not stated</span> : `$${r.amountUsd.toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2 text-text-muted">{r.status === 'cancel_pending' ? 'cancellation requested — awaiting the airline' : r.status}</td>
                    <td className="px-3 py-2 font-mono text-xs text-text-muted">
                      {r.confirmationCode ?? ''}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {/* PR-Cancel-1: liteapi rows ONLY while confirmed — after the
                          flip the action disappears, the row stays (record-keeping).
                          Opens the stored-policy dialog. LAUNCH-01 RETIRE-01: 'duffel'
                          history rows get no action (the provider is retired). */}
                      {/* CANCEL-01 (2026-09-26): the two lanes the cancel route serves — a hotel
                          through the hotel endpoint, a flight through its own (quote first). `type`
                          is the lane through the one reader (reservations/lane.ts); an activity has
                          no cancel lane and no control. */}
                      {/* RECEIPT-01 (2026-09-26): the owner's printable receipt — the vendor's landed
                          words, the bank row and the ledger entry, each figure naming its source. Owner-only:
                          the middleware cookie gate and the API's ownership check. Beside Cancel. */}
                      <Link
                        href={`/booking/${r.id}/receipt`}
                        className="mr-2 rounded border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-row"
                        data-receipt-link={r.id}
                      >
                        Receipt
                      </Link>
                      {(r.type === 'hotel' || r.type === 'flight') && r.status === 'confirmed' && (
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
                        className="rounded border border-border px-2 py-1 text-xs font-medium text-text-faint hover:bg-bg-row disabled:opacity-50"
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
                        {!outcome.ok ? (
                          <p className="text-xs text-brand-red">{outcome.message}</p>
                        ) : (
                          <div className="text-xs text-text-muted" data-cancel-outcome={outcome.pending ? 'pending' : 'final'}>
                            <p>
                              {outcome.pending
                                ? <span className="font-semibold text-brand-amber">Cancellation requested — awaiting the airline</span>
                                : <span className="font-semibold text-brand-green">Cancelled</span>}
                              {outcome.providerStatus ? ` (provider status: ${outcome.providerStatus})` : ''}
                              {' — refund: '}
                              <span className="font-medium">{moneyOrUnstated(outcome.refundAmount, outcome.currency)}</span>
                              {' · cancellation fee: '}
                              <span className="font-medium">{moneyOrUnstated(outcome.cancellationFee, outcome.currency)}</span>
                              {r.type === 'flight' ? ` · refund goes ${destinationWords(outcome.destination)}` : ''}
                            </p>
                            {outcome.pending && (
                              <p>The booking stays confirmed until the airline finalizes; the figures above are what it has stated so far.</p>
                            )}
                            {outcome.vouchers.length > 0 && (
                              <ul className="mt-0.5 space-y-0.5">
                                {outcome.vouchers.map((v, i) => (
                                  <li key={i}>Voucher {v.code ?? '(no code stated)'}{v.airline ? ` · ${v.airline}` : ''}: {moneyOrUnstated(v.amount?.amount ?? null, v.amount?.currency ?? null)}{v.expiresAt ? ` · expires ${v.expiresAt}` : ''}</li>
                                ))}
                              </ul>
                            )}
                          </div>
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
          <p className="mt-2 text-right font-mono text-sm font-semibold text-text-primary">
            Total booked: <span className="text-brand-gold">${sumUsd(rows)}</span>
            {unstatedCount(rows) > 0 && (
              <span className="ml-1 text-text-faint"> · {unstatedCount(rows)} price not stated, not included</span>
            )}
          </p>
        </>
      )}

      {cancelTarget && (
        <CancelBookingDialog
          reservationId={cancelTarget.id}
          lane={cancelTarget.type}
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

'use client';

/**
 * UnattachedBookings (T4) — the authed user's ACCOUNT bookings with no trip:
 * the adoptable orphans, finally visible. Reads GET /api/reservations/unattached;
 * "Add to <trip>" PATCHes /api/reservations/[id] { tripId } (dual-ownership
 * gates server-side). Hidden entirely when the user has zero unattached rows —
 * no empty-state noise for users who never orphan. When rows exist but no trip
 * is selected, the rows still show with an honest one-line notice instead of
 * dead buttons. Every failure declares itself inline. Guest bookings (userId
 * null) never appear here by design — ownership is unprovable (T0 §5).
 */

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import CancelBookingDialog from './CancelBookingDialog';
import { destinationWords } from '@/lib/reservations/cancellationWords';

interface BookingRow {
  id: string;
  name: string;
  /** 'liteapi' | 'viator' | 'duffel' (history rows — LAUNCH-01 RETIRE-01) — the
   *  route always returned this; the Cancel action is liteapi-only (PR-Cancel-1). */
  provider: string;
  type: string;
  /** SEC-03 (2026-09-25): null = the vendor stated no price — rendered "price not stated". */
  amountUsd: number | null;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
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
  /** The trip selected in the list above — the attach target. */
  selectedTrip: { id: string; name?: string } | null;
  /** Bumps the shared tripsRefresh so TripBookings/TripBudgetActual remount. */
  onChanged?: () => void;
  /** TRAVEL-PIPE: orphan count reported up after each successful fetch (the
   *  Books onTotals idiom — zero new fetches). */
  onTotals?: (t: { unattached: number }) => void;
}

export default function UnattachedBookings({ selectedTrip, onChanged, onTotals }: Props) {
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading');
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // PR-Cancel-1: same local-update convention as TripBookings — the cancelled
  // row REMAINS with its inline outcome (a tripsRefresh bump would remount this
  // block and erase it; the flip is persisted server-side regardless).
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelOutcomes, setCancelOutcomes] = useState<Record<string, CancelOutcome>>({});

  const load = useCallback(() => {
    let cancelled = false;
    setState('loading');
    fetch('/api/reservations/unattached')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const rows = Array.isArray(data.reservations) ? (data.reservations as BookingRow[]) : [];
        setRows(rows);
        onTotals?.({ unattached: rows.length });
        setState('ok');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [onTotals]);

  useEffect(() => load(), [load]);

  const attach = async (reservationId: string) => {
    if (!selectedTrip) return;
    setBusyId(reservationId);
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: selectedTrip.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not attach the booking.');
      // Success: this row now belongs to the trip — refresh everything that
      // shows it (shared tripsRefresh remounts this block + TripBookings).
      if (onChanged) onChanged(); else load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not attach the booking.');
    } finally {
      setBusyId(null);
    }
  };

  // PR-Cancel-1: identical flow to TripBookings.doCancel — POST, local flip,
  // inline provider-verbatim outcome (or failure message), dialog closes.
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


  // Hidden entirely when there is genuinely nothing to adopt (and while the
  // brief initial load resolves — the block appears only when data proves it).
  if (state === 'loading') return null;
  if (state === 'ok' && rows.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">
          Unattached bookings{state === 'ok' ? ` (${rows.length})` : ''}
        </p>
        <button
          type="button"
          onClick={() => load()}
          className="text-xs font-medium text-text-primary underline hover:text-text-secondary"
        >
          Refresh
        </button>
      </div>

      {state === 'error' && (
        <p className="text-sm text-brand-red">
          Couldn&apos;t load your unattached bookings.{' '}
          <button type="button" onClick={() => load()} className="font-medium underline">Retry</button>
        </p>
      )}

      {state === 'ok' && rows.length > 0 && (
        <>
          {!selectedTrip && (
            <p className="mb-2 text-xs text-text-faint">Select a trip above to attach these.</p>
          )}
          {actionError && (
            <p className="mb-2 rounded border border-border bg-white p-2 text-sm text-brand-red">{actionError}</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-white font-mono text-[10px] uppercase tracking-wider">
                  <th className="px-3 py-2 text-left font-medium text-text-faint">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-text-faint">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-text-faint">Dates</th>
                  <th className="px-3 py-2 text-right font-medium text-text-faint">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-text-faint">Status</th>
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
                    <td className="px-3 py-2 text-right">
                      {/* PR-Cancel-1: liteapi rows only while confirmed — after the
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
                      {selectedTrip ? (
                        // REPAINT-04 (2026-09-21): the ghost button's label was white on cream (invisible);
                        // aubergine ink, the ds CONTROL.ghostButton idiom. Paint only — one class.
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => attach(r.id)}
                          className="rounded border border-brand-purple/40 px-2 py-1 text-xs font-medium text-brand-purple hover:bg-brand-purple/10 disabled:opacity-50"
                        >
                          {busyId === r.id ? 'Attaching…' : `Add to ${selectedTrip.name || 'selected trip'}`}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {/* PR-Cancel-1: the provider's actual outcome, inline — verbatim
                      numbers on success, the provider's message on failure. */}
                  {outcome && (
                    <tr className="border-b border-border last:border-0">
                      <td colSpan={6} className="px-3 py-2">
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

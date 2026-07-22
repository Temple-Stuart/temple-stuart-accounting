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
import CancelBookingDialog from './CancelBookingDialog';
import FlightCancelDialog, { type FlightCancelQuote } from './FlightCancelDialog';

interface BookingRow {
  id: string;
  name: string;
  /** 'liteapi' | 'viator' | 'duffel' — the route always returned this; declared
   *  now because the Cancel action is liteapi-only (PR-Cancel-1). */
  provider: string;
  type: string;
  amountUsd: number;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  confirmationCode: string | null;
  /** PR-Cancel-1: the stored policy from book time — the pre-cancel dialog
   *  renders exactly this. */
  cancellationPolicyJson?: unknown;
}

/** PR-Cancel-1/2: the per-row cancellation outcome — the provider's verbatim
 *  numbers on success (null = not stated by provider), or the failure message.
 *  The `flight` variant (PR-Cancel-2) carries Duffel's confirmed quote — the
 *  refund goes to the DUFFEL BALANCE, and the outcome line says so. */
type CancelOutcome =
  | { ok: true; providerStatus: string | null; refundAmount: number | null; cancellationFee: number | null; currency: string | null }
  | { ok: true; flight: true; refundAmount: string | null; refundCurrency: string | null }
  | { ok: false; message: string };

function moneyOrUnstated(v: number | null, cur: string | null): string {
  return v === null ? 'not stated by provider' : `${cur ? `${cur} ` : ''}${v.toFixed(2)}`;
}

interface Props {
  /** The trip selected in the list above — the attach target. */
  selectedTrip: { id: string; name?: string } | null;
  /** Bumps the shared tripsRefresh so TripBookings/TripBudgetActual remount. */
  onChanged?: () => void;
}

export default function UnattachedBookings({ selectedTrip, onChanged }: Props) {
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
  // PR-Cancel-2: the Duffel two-step (same shape as TripBookings) — quote
  // loading marker, the open flight dialog, and its button lock.
  const [quoteBusyId, setQuoteBusyId] = useState<string | null>(null);
  const [flightCancel, setFlightCancel] = useState<{
    row: BookingRow;
    quote: FlightCancelQuote;
    error: { message: string; stale: boolean } | null;
  } | null>(null);
  const [flightBusy, setFlightBusy] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setState('loading');
    fetch('/api/reservations/unattached')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setRows(Array.isArray(data.reservations) ? (data.reservations as BookingRow[]) : []);
        setState('ok');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, []);

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

  // ── PR-Cancel-2: Duffel quote-first — identical flow to TripBookings
  // (STEP-1 quote → dialog → STEP-2 confirm; stale 409 → Re-quote). ──
  const startFlightCancel = async (row: BookingRow) => {
    setQuoteBusyId(row.id);
    try {
      const res = await fetch(`/api/reservations/${row.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'quote' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not get a cancellation quote.');
      setFlightCancel({
        row,
        quote: {
          id: data.cancellation?.id ?? null,
          refundAmount: data.cancellation?.refundAmount ?? null,
          refundCurrency: data.cancellation?.refundCurrency ?? null,
          refundTo: data.cancellation?.refundTo ?? null,
          expiresAt: data.cancellation?.expiresAt ?? null,
        },
        error: null,
      });
    } catch (err) {
      setCancelOutcomes((prev) => ({
        ...prev,
        [row.id]: { ok: false, message: err instanceof Error ? err.message : 'Could not get a cancellation quote.' },
      }));
    } finally {
      setQuoteBusyId(null);
    }
  };

  const requoteFlight = async () => {
    if (!flightCancel) return;
    setFlightBusy(true);
    try {
      const res = await fetch(`/api/reservations/${flightCancel.row.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'quote' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not get a fresh quote.');
      setFlightCancel((prev) => prev && {
        ...prev,
        quote: {
          id: data.cancellation?.id ?? null,
          refundAmount: data.cancellation?.refundAmount ?? null,
          refundCurrency: data.cancellation?.refundCurrency ?? null,
          refundTo: data.cancellation?.refundTo ?? null,
          expiresAt: data.cancellation?.expiresAt ?? null,
        },
        error: null,
      });
    } catch (err) {
      setFlightCancel((prev) => prev && {
        ...prev,
        error: { message: err instanceof Error ? err.message : 'Could not get a fresh quote.', stale: false },
      });
    } finally {
      setFlightBusy(false);
    }
  };

  const confirmFlightCancel = async () => {
    if (!flightCancel || !flightCancel.quote.id) return;
    setFlightBusy(true);
    try {
      const res = await fetch(`/api/reservations/${flightCancel.row.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', cancellationId: flightCancel.quote.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlightCancel((prev) => prev && {
          ...prev,
          error: {
            message: data.error || 'Could not confirm the cancellation.',
            stale: data.code === 'quote_stale',
          },
        });
        return;
      }
      const rowId = flightCancel.row.id;
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, status: data.reservation?.status ?? 'cancelled' } : r)));
      setCancelOutcomes((prev) => ({
        ...prev,
        [rowId]: {
          ok: true,
          flight: true,
          refundAmount: data.cancellation?.refundAmount ?? null,
          refundCurrency: data.cancellation?.refundCurrency ?? null,
        },
      }));
      setFlightCancel(null);
    } catch (err) {
      setFlightCancel((prev) => prev && {
        ...prev,
        error: { message: err instanceof Error ? err.message : 'Could not confirm the cancellation.', stale: false },
      });
    } finally {
      setFlightBusy(false);
    }
  };

  // Hidden entirely when there is genuinely nothing to adopt (and while the
  // brief initial load resolves — the block appears only when data proves it).
  if (state === 'loading') return null;
  if (state === 'ok' && rows.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-border bg-bg-row p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">
          Unattached bookings{state === 'ok' ? ` (${rows.length})` : ''}
        </p>
        <button
          type="button"
          onClick={() => load()}
          className="text-xs font-medium text-brand-purple underline hover:text-brand-purple/80"
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
            <p className="mb-2 text-xs text-text-muted">Select a trip above to attach these.</p>
          )}
          {actionError && (
            <p className="mb-2 rounded border border-border bg-white p-2 text-sm text-brand-red">{actionError}</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-row text-xs uppercase tracking-wide">
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Dates</th>
                  <th className="px-3 py-2 text-right font-medium text-text-muted">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-text-muted">Status</th>
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
                    <td className="px-3 py-2 text-right">
                      {/* PR-Cancel-1/2: liteapi (hotel) + duffel (flight) rows,
                          only while confirmed — after the flip the action
                          disappears, the row stays (record-keeping). Hotels open
                          the stored-policy dialog; flights fire the Duffel quote
                          first (two-step). */}
                      {(r.provider === 'liteapi' || r.provider === 'duffel') && r.status === 'confirmed' && (
                        <button
                          type="button"
                          disabled={busyId === r.id || cancelBusy || quoteBusyId !== null || flightBusy}
                          onClick={() => (r.provider === 'duffel' ? startFlightCancel(r) : setCancelTarget(r))}
                          className="mr-2 rounded border border-brand-red/40 px-2 py-1 text-xs font-medium text-brand-red hover:bg-brand-red/10 disabled:opacity-50"
                        >
                          {quoteBusyId === r.id ? 'Getting quote…' : 'Cancel booking'}
                        </button>
                      )}
                      {selectedTrip ? (
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
                        ) : 'flight' in outcome ? (
                          <p className="text-xs text-text-secondary">
                            <span className="font-semibold text-brand-green">Cancelled</span>
                            {' — Duffel refunds '}
                            <span className="font-medium">
                              {outcome.refundAmount === null
                                ? 'an amount not stated by provider'
                                : `${outcome.refundCurrency ? `${outcome.refundCurrency} ` : ''}${outcome.refundAmount}`}
                            </span>
                            {' to the platform balance. Card refunds are processed separately.'}
                          </p>
                        ) : (
                          <p className="text-xs text-text-secondary">
                            <span className="font-semibold text-brand-green">Cancelled</span>
                            {outcome.providerStatus ? ` (provider status: ${outcome.providerStatus})` : ''}
                            {' — refund: '}
                            <span className="font-medium">{moneyOrUnstated(outcome.refundAmount, outcome.currency)}</span>
                            {' · cancellation fee: '}
                            <span className="font-medium">{moneyOrUnstated(outcome.cancellationFee, outcome.currency)}</span>
                          </p>
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
          bookingName={cancelTarget.name}
          checkIn={cancelTarget.checkIn}
          checkOut={cancelTarget.checkOut}
          policy={cancelTarget.cancellationPolicyJson ?? null}
          busy={cancelBusy}
          onConfirm={() => doCancel(cancelTarget)}
          onClose={() => { if (!cancelBusy) setCancelTarget(null); }}
        />
      )}

      {flightCancel && (
        <FlightCancelDialog
          bookingName={flightCancel.row.name}
          quote={flightCancel.quote}
          busy={flightBusy}
          error={flightCancel.error}
          onConfirm={confirmFlightCancel}
          onRequote={requoteFlight}
          onClose={() => { if (!flightBusy) setFlightCancel(null); }}
        />
      )}
    </div>
  );
}

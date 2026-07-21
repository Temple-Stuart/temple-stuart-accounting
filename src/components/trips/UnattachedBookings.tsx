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

import { useCallback, useEffect, useState } from 'react';

interface BookingRow {
  id: string;
  name: string;
  type: string;
  amountUsd: number;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  confirmationCode: string | null;
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
                    <td className="px-3 py-2 text-right">
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

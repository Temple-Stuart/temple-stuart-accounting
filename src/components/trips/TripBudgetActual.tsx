'use client';

/**
 * TripBudgetActual — the two horizontal-scroll rows under a selected trip (PR-Trips5).
 *
 *   • BUDGETED (purple) — the saved/planned lines from GET /api/trips/[id]/budget.
 *   • ACTUAL (green)    — the booked/paid items from GET /api/trips/[id]/reservations.
 *
 * Read-only display. It fetches BOTH in parallel with Promise.allSettled, so one row
 * failing never blanks the other — each row shows its own loading / empty / error.
 * It only mounts (and so only fetches) when a trip is selected, and the home list is
 * already logged-in-gated, so it never runs for a guest.
 *
 * Per-day figure: amount ÷ days between the item's dates — the same idea as the
 * itinerary's coveredDays/share (TripTimelineView.tsx:117-148), here using nights
 * (checkout − checkin) for a booking. Budgeted lines carry no per-line dates, so the
 * per-day only shows on cards that actually have a date span (the Actual bookings).
 */

import { useEffect, useState } from 'react';
import type { TripRow } from './AllTripsList';

interface BudgetItem {
  id: string;
  description: string | null;
  amount: string | number; // Prisma Decimal serializes as a string
  coaCode: string | null;
  year: number;
  month: number;
  // PR-Trips7: the vendor-option keys (from the linked trip_itinerary, surfaced by
  // /budget). Present only on lines that came from a vendor commit; null for manual
  // budget lines. Needed to uncommit via DELETE /vendor-commit.
  vendorOptionId?: string | null;
  vendorOptionType?: string | null;
}

interface Reservation {
  id: string;
  name: string;
  type: string;
  amountUsd: number;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

type RowState = 'loading' | 'ok' | 'error';

const MS_DAY = 86_400_000;

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** amount ÷ days between dates (nights). null when the item has no date span. */
function perDayUsd(amount: number, start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const days = Math.max(1, Math.round((b - a) / MS_DAY));
  return amount / days;
}

export default function TripBudgetActual({ trip }: { trip: TripRow }) {
  const [budget, setBudget] = useState<BudgetItem[]>([]);
  const [actual, setActual] = useState<Reservation[]>([]);
  const [budgetState, setBudgetState] = useState<RowState>('loading');
  const [actualState, setActualState] = useState<RowState>('loading');
  // PR-Trips7: uncommit state. reloadKey re-runs the fetch after a remove.
  const [reloadKey, setReloadKey] = useState(0);
  const [uncommittingId, setUncommittingId] = useState<string | null>(null);
  const [uncommitError, setUncommitError] = useState<string | null>(null);

  // PR-Trips7: uncommit a BUDGETED vendor line — confirm, then call the EXISTING
  // ownership-scoped DELETE /vendor-commit (which atomically cleans budget_line_items
  // + trip_itinerary + calendar_events). Only ever runs for a line that has the vendor
  // keys; ACTUAL/paid items never get this. On success it re-fetches the rows.
  const handleUncommit = async (item: BudgetItem) => {
    if (!item.vendorOptionId || !item.vendorOptionType) return;
    const label = item.description || item.coaCode || 'this item';
    if (!window.confirm(`Remove ${label} from this trip's budget?`)) return;
    setUncommittingId(item.id);
    setUncommitError(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/vendor-commit`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionType: item.vendorOptionType, optionId: item.vendorOptionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Could not remove the item (HTTP ${res.status})`);
      }
      setReloadKey((n) => n + 1);
    } catch (err) {
      setUncommitError(err instanceof Error ? err.message : 'Could not remove the item');
    } finally {
      setUncommittingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setBudgetState('loading');
    setActualState('loading');

    const budgetReq = fetch(`/api/trips/${trip.id}/budget`).then((r) =>
      r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
    );
    const actualReq = fetch(`/api/trips/${trip.id}/reservations`).then((r) =>
      r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))
    );

    // allSettled: a failure in one row must not kill the other.
    Promise.allSettled([budgetReq, actualReq]).then(([b, a]) => {
      if (cancelled) return;
      if (b.status === 'fulfilled') {
        setBudget((b.value.items || []) as BudgetItem[]);
        setBudgetState('ok');
      } else {
        setBudgetState('error');
      }
      if (a.status === 'fulfilled') {
        setActual((a.value.reservations || []) as Reservation[]);
        setActualState('ok');
      } else {
        setActualState('error');
      }
    });

    return () => { cancelled = true; };
  }, [trip.id, reloadKey]);

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-border bg-bg-row p-4">
      {/* ── BUDGETED (purple) — what you planned ─────────────────────────────── */}
      <div>
        <p className="mb-2 text-sm font-bold text-brand-purple">Budgeted — what you planned</p>
        {uncommitError && <p className="mb-2 rounded border border-border bg-white p-2 text-sm text-brand-red">{uncommitError}</p>}
        {budgetState === 'loading' && <p className="text-sm text-text-muted">Loading your planned items…</p>}
        {budgetState === 'error' && <p className="text-sm text-brand-red">Couldn&apos;t load your planned items.</p>}
        {budgetState === 'ok' && budget.length === 0 && <p className="text-sm text-text-muted">Nothing planned yet.</p>}
        {budgetState === 'ok' && budget.length > 0 && (
          <div className="flex snap-x gap-3 overflow-x-auto pb-1">
            {budget.map((item) => {
              const amt = Number(item.amount);
              return (
                <div key={item.id} className="min-w-[180px] shrink-0 snap-start rounded-lg border border-brand-purple/30 bg-white p-3">
                  <p className="truncate text-sm font-medium text-text-primary">{item.description || item.coaCode || 'Planned item'}</p>
                  <p className="mt-1 text-base font-bold text-brand-purple">{usd(amt)}</p>
                  {item.coaCode && <p className="mt-1 text-xs text-text-muted">{item.coaCode}</p>}
                  {item.vendorOptionId && (
                    <button
                      type="button"
                      onClick={() => handleUncommit(item)}
                      disabled={uncommittingId === item.id}
                      className="mt-2 w-full rounded border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-row hover:text-brand-red disabled:opacity-50"
                    >
                      {uncommittingId === item.id ? 'Removing…' : 'Remove'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ACTUAL (green) — what you booked + paid ──────────────────────────── */}
      <div>
        <p className="mb-2 text-sm font-bold text-brand-green">Actual — what you booked</p>
        {actualState === 'loading' && <p className="text-sm text-text-muted">Loading your bookings…</p>}
        {actualState === 'error' && <p className="text-sm text-brand-red">Couldn&apos;t load your bookings.</p>}
        {actualState === 'ok' && actual.length === 0 && <p className="text-sm text-text-muted">Nothing booked yet.</p>}
        {actualState === 'ok' && actual.length > 0 && (
          <div className="flex snap-x gap-3 overflow-x-auto pb-1">
            {actual.map((res) => {
              const pd = perDayUsd(res.amountUsd, res.checkIn, res.checkOut);
              const inOut = [shortDate(res.checkIn), shortDate(res.checkOut)].filter(Boolean).join(' – ');
              return (
                <div key={res.id} className="min-w-[180px] shrink-0 snap-start rounded-lg border border-brand-green/30 bg-white p-3">
                  <p className="truncate text-sm font-medium text-text-primary">{res.name}</p>
                  <p className="mt-1 text-base font-bold text-brand-green">{usd(res.amountUsd)}</p>
                  {pd != null && <p className="text-xs text-text-muted">${Math.round(pd)}/day</p>}
                  {inOut && <p className="mt-1 text-xs text-text-muted">{inOut}</p>}
                  <p className="mt-1 text-xs text-text-faint">{res.type} · {res.status}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

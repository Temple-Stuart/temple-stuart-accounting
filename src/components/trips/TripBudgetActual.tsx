'use client';

/**
 * TripBudgetActual — the trip's BUDGET LEDGER (PR-Trip-Ledger-1).
 *
 * Replaces the old two horizontal-scroll card rows (Budgeted + Actual) with ONE flat
 * statement-style table. Every row here is PLANNED/budget spend. Actual reconciliation
 * lives in Bookkeeping (the Plaid link), NOT here — there is no "actual" column.
 *
 * Reads GET /api/trips/[id]/budget, which now returns each budget_line_items row PLUS the
 * date / time / cadence / vendor fields from its linked trip_itinerary (surfaced in
 * PR-Trip-Ledger-1 — the route already loaded the row, it was just dropping these). Manual
 * lines have no itinerary, so those cells show "—" (never faked).
 *
 * PR-Ledger-Edit-Times: the Start/End date + time cells are INLINE-EDITABLE for
 * itinerary-backed rows (click → in-cell input → PATCH the trip_itinerary row → re-fetch).
 * The 15:00/11:00 hotel defaults are just the starting value; editing overrides them.
 *
 * COA + Project are DISPLAY-ONLY this PR (inline dropdown edits are later PRs). Project
 * shows "—" on every row — there is no project linkage yet (that's a schema migration).
 *
 * Saved vs Booked: every budget line is shown as "Saved" (planned). A real "Booked" (paid)
 * status is NOT derivable from budget_line_items today — paid bookings live in a separate
 * `reservations` table with no link back to a budget line — so the status column honestly
 * shows "Saved" for all rows rather than guessing. A later PR adds the reservations
 * join / a status column to mark genuinely-booked lines.
 */

import { useEffect, useRef, useState } from 'react';
import type { TripRow } from './AllTripsList';
import { formatMoney, moneyColorClass } from '@/lib/money';

interface LedgerItem {
  id: string;
  // The linked trip_itinerary row id (null on manual lines). Drives the inline
  // date/time edit — only itinerary-backed rows are editable.
  itineraryId: string | null;
  description: string | null;
  amount: string | number; // Prisma Decimal serializes as a string
  coaCode: string | null;
  // Surfaced from the linked trip_itinerary (null on manual lines → "—").
  vendor: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  cadence: string | null; // 'once' | 'daily' | null
  // Vendor-option keys → which removal path a row uses (Remove vs Delete).
  vendorOptionId?: string | null;
  vendorOptionType?: string | null;
}

type RowState = 'loading' | 'ok' | 'error';

const DASH = '—';

function fmtDate(s: string | null): string {
  if (!s) return DASH;
  // Parse the DATE-PORTION only (mirrors CalendarGrid.parseDate, CalendarGrid.tsx:104-107)
  // so a UTC-midnight stored value isn't localized BACKWARD a day. Building a LOCAL-midnight
  // Date from the Y-M-D parts formats to the true calendar date in any viewer zone — unlike
  // `new Date(isoString)`, which rolls a 00:00Z value back a day west of UTC. Malformed
  // input → Invalid Date → DASH (the existing visible-failure contract, no substitute).
  const [year, month, day] = s.split('T')[0].split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime())
    ? DASH
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(s: string | null): string {
  return s && s.trim() ? s : DASH;
}

function fmtCadence(c: string | null): string {
  if (c === 'daily') return 'Daily';
  if (c === 'once') return 'One-time';
  return DASH;
}

function txt(s: string | null | undefined): string {
  return s && String(s).trim() ? String(s) : DASH;
}

/** Stored value → the value an <input type="date"> expects (YYYY-MM-DD). */
function toDateInput(s: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Stored "HH:MM[:SS]" → the value an <input type="time"> expects (HH:MM). */
function toTimeInput(s: string | null): string {
  return s && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : '';
}

/**
 * One inline-editable date/time cell. Click → an in-cell <input> (no modal/drawer);
 * blur or Enter saves via onSave; Escape cancels. A failed save THROWS → the cell
 * reverts to the old value and the parent shows the error (never a fake success).
 * Display-only when not editable (manual lines with no itinerary row).
 */
function EditableCell({
  kind,
  value,
  editable,
  onSave,
}: {
  kind: 'date' | 'time';
  value: string | null;
  editable: boolean;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const cancelled = useRef(false);

  const display = kind === 'date' ? fmtDate(value) : fmtTime(value);
  const inputVal = kind === 'date' ? toDateInput(value) : toTimeInput(value);

  if (!editable) return <span className="text-white/40">{display}</span>;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { cancelled.current = false; setEditing(true); }}
        title="Click to edit"
        className="rounded px-1 text-left text-white/60 transition-colors hover:bg-panel-hover hover:text-white"
      >
        {value ? display : <span className="text-white underline decoration-dotted">Set</span>}
      </button>
    );
  }

  const commit = async (raw: string) => {
    if (saving) return;
    if (cancelled.current) { cancelled.current = false; setEditing(false); return; }
    if (!raw || raw === inputVal) { setEditing(false); return; } // no change → no PATCH
    setSaving(true);
    try {
      await onSave(raw); // success → parent re-fetches, remounting this cell with the saved value
    } catch {
      // error is surfaced by the parent banner; the cell reverts to the old display
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <input
      type={kind}
      autoFocus
      defaultValue={inputVal}
      disabled={saving}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { cancelled.current = true; (e.target as HTMLInputElement).blur(); }
      }}
      className="w-32 rounded border border-brand-purple/50 bg-panel-surface px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple disabled:opacity-50"
    />
  );
}

export default function TripBudgetActual({ trip }: { trip: TripRow }) {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [state, setState] = useState<RowState>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [uncommittingId, setUncommittingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Remove a vendor-linked line (uncommit) — the ownership-scoped DELETE /vendor-commit
  // atomically cleans budget_line_items + trip_itinerary + calendar_events. On success
  // it re-fetches. (Carried over from the old cards — not the COA/Project edits deferred
  // to later PRs.)
  const handleUncommit = async (item: LedgerItem) => {
    if (!item.vendorOptionId || !item.vendorOptionType) return;
    const label = item.description || item.coaCode || 'this item';
    if (!window.confirm(`Remove ${label} from this trip's budget?`)) return;
    setUncommittingId(item.id);
    setActionError(null);
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
      setActionError(err instanceof Error ? err.message : 'Could not remove the item');
    } finally {
      setUncommittingId(null);
    }
  };

  // Delete an unlinked (manual) line — ownership-scoped DELETE /budget-line removes ONLY
  // that one row (no cascade; manual lines have no itinerary/calendar rows).
  const handleDeleteLine = async (item: LedgerItem) => {
    const label = item.description || item.coaCode || 'this item';
    if (!window.confirm(`Delete ${label} from this trip's budget?`)) return;
    setDeletingId(item.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/budget-line`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetLineId: item.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Could not delete the item (HTTP ${res.status})`);
      }
      setReloadKey((n) => n + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete the item');
    } finally {
      setDeletingId(null);
    }
  };

  // PR-Ledger-Edit-Times: persist an inline Start/End date+time edit. PATCHes the linked
  // trip_itinerary row (auth + ownership gated server-side), then re-fetches so the cell
  // shows the SERVER's saved value (no optimistic drift). On failure it sets the error
  // banner and THROWS so the cell reverts — never a fake success.
  const saveCell = async (
    item: LedgerItem,
    field: 'startDate' | 'startTime' | 'endDate' | 'endTime',
    value: string,
  ) => {
    if (!item.itineraryId) return;
    setActionError(null);
    const res = await fetch(`/api/trips/${trip.id}/itinerary/${item.itineraryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.message || data.error || 'Could not save the change.');
      throw new Error('save failed');
    }
    setReloadKey((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetch(`/api/trips/${trip.id}/budget`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        setItems((data.items || []) as LedgerItem[]);
        setState('ok');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [trip.id, reloadKey]);

  const total = items.reduce((s, it) => s + Number(it.amount || 0), 0);

  const th = 'px-3 py-2 text-left font-medium text-white/40 whitespace-nowrap';
  const td = 'px-3 py-2 whitespace-nowrap';

  return (
    <div className="mt-4 rounded-lg border border-panel-border bg-panel-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white">Budget ledger</p>
        {state === 'ok' && items.length > 0 && (
          <p className="text-sm text-white/60">
            Total <span className={`font-mono font-bold ${moneyColorClass(total, 'expense')}`}>{formatMoney(total, { kind: 'expense' })}</span>
          </p>
        )}
      </div>

      {actionError && <p className="mb-2 rounded border border-panel-border bg-panel-surface p-2 text-sm text-brand-red">{actionError}</p>}
      {state === 'loading' && <p className="text-sm text-white/50">Loading your budget…</p>}
      {state === 'error' && <p className="text-sm text-brand-red">Couldn&apos;t load your budget.</p>}
      {state === 'ok' && items.length === 0 && <p className="text-sm text-white/50">No planned budget yet.</p>}

      {state === 'ok' && items.length > 0 && (
        // Wide statement table: on a narrow screen the whole table scrolls horizontally as
        // ONE unit (11 columns won't fit a phone). Every column stays on the surface — no
        // per-card scroll, no hidden drawers.
        <div className="overflow-x-auto rounded-lg border border-panel-border bg-panel-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-panel-border bg-panel-surface font-mono text-[10px] uppercase tracking-wider">
                <th className={th}>Saved / Booked</th>
                <th className={th}>Start date</th>
                <th className={th}>Start time</th>
                <th className={th}>End date</th>
                <th className={th}>End time</th>
                <th className={th}>Cadence</th>
                <th className={th}>COA</th>
                <th className={th}>Vendor</th>
                <th className={th}>Description</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={th}>Project</th>
                <th className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-panel-border last:border-0">
                  {/* Every budget line is Saved (planned). Booked (paid) is not derivable
                      from budget_line_items yet — see the file header. */}
                  <td className={td}>
                    <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-xs font-medium text-white">Saved</span>
                  </td>
                  <td className={td}><EditableCell kind="date" value={it.startDate} editable={!!it.itineraryId} onSave={(v) => saveCell(it, 'startDate', v)} /></td>
                  <td className={td}><EditableCell kind="time" value={it.startTime} editable={!!it.itineraryId} onSave={(v) => saveCell(it, 'startTime', v)} /></td>
                  <td className={td}><EditableCell kind="date" value={it.endDate} editable={!!it.itineraryId} onSave={(v) => saveCell(it, 'endDate', v)} /></td>
                  <td className={td}><EditableCell kind="time" value={it.endTime} editable={!!it.itineraryId} onSave={(v) => saveCell(it, 'endTime', v)} /></td>
                  <td className={`${td} text-white/60`}>{fmtCadence(it.cadence)}</td>
                  <td className={`${td} text-white/60`}>{txt(it.coaCode)}</td>
                  <td className={`${td} text-white/60`}>{txt(it.vendor)}</td>
                  <td className={`${td} font-medium text-white`}>
                    {it.description?.trim() ? it.description : txt(it.coaCode)}
                  </td>
                  {/* PR-Money-Convention: trip lines are EXPENSES → red, negative-signed. */}
                  <td className={`${td} text-right font-mono font-bold ${moneyColorClass(Number(it.amount || 0), 'expense')}`}>{formatMoney(Number(it.amount || 0), { kind: 'expense' })}</td>
                  {/* Project: no linkage yet (the FK is a later migration PR) → honest "—". */}
                  <td className={`${td} text-white/40`}>{DASH}</td>
                  <td className={`${td} text-right`}>
                    {it.vendorOptionId ? (
                      <button
                        type="button"
                        onClick={() => handleUncommit(it)}
                        disabled={uncommittingId === it.id}
                        className="rounded border border-panel-border px-2 py-1 text-xs text-white/50 transition-colors hover:bg-panel-hover hover:text-brand-red disabled:opacity-50"
                      >
                        {uncommittingId === it.id ? 'Removing…' : 'Remove'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDeleteLine(it)}
                        disabled={deletingId === it.id}
                        className="rounded border border-panel-border px-2 py-1 text-xs text-white/50 transition-colors hover:bg-panel-hover hover:text-brand-red disabled:opacity-50"
                      >
                        {deletingId === it.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

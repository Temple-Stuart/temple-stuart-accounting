'use client';

import { useState } from 'react';

interface Props {
  tripId: string;
  /** Scan catKey (e.g. 'gyms', 'dinner') → per-category COA, server-side. */
  category: string;
  /** Place name → budget line description + itinerary vendor. */
  placeName: string;
  /** Scan destination (destinationLabel) → trip_itinerary.location → the
   *  Committed Budget Country column. */
  location: string | null;
}

// PR-35: manual-price ONE-TIME commit for unpriced Google places. Google returns
// a place, not a cost — so the user enters the amount + dates + times here, and
// the commit lands in Committed Budget on the category's COA (PR-35a-synced) with
// the correct P-/B- prefix (enforced server-side in vendor-commit, incl. the
// personal-only/Business block). Recurring is a separate later PR.
export function PlaceCommitForm({ tripId, category, placeName, location }: Props) {
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [state, setState] = useState<'idle' | 'adding' | 'added' | 'failed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Client-side validation mirrors the server guard (the server is the real
  // enforcement — PR-33 discipline: NO fallback dates/amounts).
  const amt = Number(amount);
  const amountValid = Number.isFinite(amt) && amt > 0;
  const datesValid = !!startDate && !!endDate && endDate >= startDate;
  const canSubmit = amountValid && datesValid && state !== 'adding';

  const handleAdd = async () => {
    setState('adding');
    setErrorMsg(null);
    try {
      if (!amountValid) throw new Error('Enter a positive amount.');
      if (!startDate || !endDate) throw new Error('Start and end dates are required.');
      if (endDate < startDate) throw new Error('End date must be on or after start date.');

      const res = await fetch(`/api/trips/${tripId}/vendor-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionType: 'activity',
          synthetic: true,                 // no DB row — build from this payload
          category,                        // → per-category COA + accounting rule
          optionId: `place-${category}-${Date.now()}`,
          amount: amt,                     // manual cost (Google has no price)
          startDate,
          endDate,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          notes: placeName,
          location,                        // destinationLabel → Country column
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

  const inputCls = 'border border-border rounded px-2 py-1.5 text-sm bg-white';

  return (
    <div className="w-full border border-border rounded p-3 bg-bg-row space-y-3">
      <div className="text-sm font-medium text-text-primary">Add to trip</div>
      <p className="text-xs text-text-muted">
        Google places are unpriced — enter the expected cost, dates, and times to add this to your Committed Budget.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Amount (USD) *</span>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={amount}
            onChange={e => setAmount(e.target.value)} placeholder="0.00"
            aria-label="Amount" className={`${inputCls} w-28`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Start date *</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            aria-label="Start date" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">End date *</span>
          <input type="date" value={endDate} min={startDate || undefined}
            onChange={e => setEndDate(e.target.value)} aria-label="End date" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Start time</span>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
            aria-label="Start time" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">End time</span>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
            aria-label="End time" className={inputCls} />
        </label>
        <button type="button" onClick={handleAdd} disabled={!canSubmit}
          className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded hover:bg-brand-purple-hover disabled:opacity-50">
          {state === 'adding' ? 'Adding…' : 'Add to trip'}
        </button>
      </div>
      {state === 'failed' && errorMsg && (
        <span className="block text-xs text-brand-red">{errorMsg}</span>
      )}
    </div>
  );
}

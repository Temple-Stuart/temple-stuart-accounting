'use client';

/**
 * DEV harness for FlightCheckoutPanel (PR-Duffel-Pay-2). Lets you open the flight
 * checkout against Duffel TEST mode with a real test offer id (grab one from a live
 * flight search). PR-3 wires the proper "Book" button onto flight cards — this page
 * exists only to test the panel + flow in isolation, and is disabled in production.
 */

import { useState } from 'react';
import FlightCheckoutPanel from '@/components/trips/FlightCheckoutPanel';

export default function DevFlightCheckoutPage() {
  const [open, setOpen] = useState(false);
  const [offerId, setOfferId] = useState('');
  const [price, setPrice] = useState('100.00');
  const [currency, setCurrency] = useState('GBP');
  const [count, setCount] = useState(1);

  if (process.env.NODE_ENV === 'production') {
    return <p className="p-6 text-sm text-text-muted">Not available.</p>;
  }

  const field = 'w-full rounded border border-border px-3 py-2 text-sm';

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-lg font-bold text-brand-purple">DEV — flight checkout test harness</h1>
      <p className="text-sm text-text-muted">
        Paste a Duffel <strong>test</strong> offer id (from a live flight search) and open the
        checkout. TEST mode only — use a Duffel test card. PR-3 adds the real Book button.
      </p>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-brand-purple">Offer id</span>
        <input className={field} value={offerId} onChange={(e) => setOfferId(e.target.value)} placeholder="off_…" />
      </label>
      <div className="flex gap-2">
        <label className="flex-1 space-y-1">
          <span className="text-[11px] font-medium text-brand-purple">Price</span>
          <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="w-24 space-y-1">
          <span className="text-[11px] font-medium text-brand-purple">Currency</span>
          <input className={field} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </label>
        <label className="w-24 space-y-1">
          <span className="text-[11px] font-medium text-brand-purple">Pax</span>
          <input type="number" min={1} className={field} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} />
        </label>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!offerId.trim()}
        className="rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Open checkout
      </button>

      {open && (
        <FlightCheckoutPanel
          offer={{ id: offerId.trim(), price: Number(price) || 0, currency }}
          passengerCount={count}
          onClose={() => setOpen(false)}
          onBooked={(ref) => { window.alert(`Booked: ${ref}`); setOpen(false); }}
        />
      )}
    </div>
  );
}

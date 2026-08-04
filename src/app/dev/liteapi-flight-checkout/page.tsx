'use client';

/**
 * DEV harness for LiteApiFlightCheckoutPanel (PR-FL-4). Local verification
 * ONLY — paste a LiteAPI offerId (from /api/travel/liteapi/flights/search) and
 * mount the panel to prove the Nuitee-Stripe card flow in sandbox. Mirrors the
 * Duffel harness (src/app/dev/flight-checkout/page.tsx): disabled in
 * production; superseded by FL-6, which wires the panel onto the real flight
 * search results.
 */

import { useState } from 'react';
import LiteApiFlightCheckoutPanel from '@/components/trips/LiteApiFlightCheckoutPanel';

export default function DevLiteApiFlightCheckoutPage() {
  const [open, setOpen] = useState(false);
  const [offerId, setOfferId] = useState('');
  const [price, setPrice] = useState('100.00');
  const [currency, setCurrency] = useState('USD');

  if (process.env.NODE_ENV === 'production') {
    return <p className="p-6 text-sm text-text-muted">Not available.</p>;
  }

  const field = 'w-full rounded border border-border px-3 py-2 text-sm';

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-lg font-bold text-brand-purple">DEV — LiteAPI flight checkout harness</h1>
      <p className="text-sm text-text-muted">
        Paste a LiteAPI <strong>sandbox</strong> offerId (from a fresh
        /api/travel/liteapi/flights/search — offers expire in minutes) and open
        the checkout. Payment mounts on Nuitee&apos;s Stripe via the prebook
        response — FL-6 wires the real Book button. Fill EVERY passenger field
        (FL-4b: gender, nationality + full passport block are required by the
        live contract) and use a real-looking name — the provider&apos;s fraud
        filter rejects placeholders like &ldquo;Test&rdquo;.
      </p>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-brand-purple">Offer id</span>
        <textarea
          className={`${field} min-h-20 font-mono text-xs`}
          value={offerId}
          onChange={(e) => setOfferId(e.target.value)}
          placeholder="msgpack-encoded offerId from /flights/rates…"
        />
      </label>
      <div className="flex gap-2">
        <label className="flex-1 space-y-1">
          <span className="text-[11px] font-medium text-brand-purple">Display price</span>
          <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="w-24 space-y-1">
          <span className="text-[11px] font-medium text-brand-purple">Currency</span>
          <input className={field} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
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
        <LiteApiFlightCheckoutPanel
          offerId={offerId.trim()}
          price={price}
          currency={currency}
          onBooked={({ prebookId, transactionId }) => {
            console.log('[DEV harness] payment proof:', { prebookId, transactionId });
          }}
        />
      )}
    </div>
  );
}

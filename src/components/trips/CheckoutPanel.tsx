'use client';

/**
 * CheckoutPanel — a real hotel checkout (PR-B1). Given a bookable offer it runs
 * the EXISTING server spine end-to-end: prebook → a real guest form → book →
 * confirmation. It reuses /api/travel/liteapi/prebook + /book unchanged; those
 * routes are authed + trip-scoped (this opens for a signed-in user with a trip).
 *
 * SANDBOX/TEST: there is no card capture yet — the book call reuses the prebook's
 * transactionId, which LiteAPI's sandbox accepts. Real payment (LiteAPI's hosted
 * payment SDK) lands in PR-B2, so this is labelled a TEST booking: no card is
 * charged. Nothing is faked — the confirmation shown is the real book response.
 */

import { useEffect, useState } from 'react';

interface Prebook {
  prebookId: string;
  transactionId: string;
  price: number;
  currency: string;
  commission: number;
  cancellationPolicies?: unknown;
}

interface Confirmation {
  bookingId: string;
  confirmationCode: string | null;
  hotelName: string | null;
  checkinDate: string;
  checkoutDate: string;
  finalPriceCents: number | null;
  currency: string | null;
}

interface Props {
  tripId: string;
  offerId: string;
  hotelName: string;
  checkin: string;   // ISO YYYY-MM-DD
  checkout: string;  // ISO YYYY-MM-DD
  onClose: () => void;
  onBooked: (result: { confirmationCode: string | null; bookingId: string }) => void;
}

type Phase = 'prebooking' | 'form' | 'booking' | 'done';

const inputClass =
  'bg-white border border-border rounded px-3 py-2 text-sm text-text-primary w-full ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-purple/40';

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function CheckoutPanel({ tripId, offerId, hotelName, checkin, checkout, onClose, onBooked }: Props) {
  const [phase, setPhase] = useState<Phase>('prebooking');
  const [error, setError] = useState('');
  const [prebook, setPrebook] = useState<Prebook | null>(null);

  // Real guest details — NO hardcoded values.
  const [holderFirst, setHolderFirst] = useState('');
  const [holderLast, setHolderLast] = useState('');
  const [holderEmail, setHolderEmail] = useState('');
  const [guestFirst, setGuestFirst] = useState('');
  const [guestLast, setGuestLast] = useState('');
  const [sameAsHolder, setSameAsHolder] = useState(true);

  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  // STEP 1 — prebook on open (real price + commission + cancellation snapshot).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/travel/liteapi/prebook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId, offerId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Prebook failed (HTTP ${res.status})`);
        const p = data.prebook;
        if (!p?.prebookId || !p?.transactionId) throw new Error('This rate is no longer available — please pick another.');
        if (!cancelled) {
          setPrebook(p as Prebook);
          setPhase('form');
        }
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : 'Could not hold this rate.'); setPhase('form'); }
      }
    })();
    return () => { cancelled = true; };
  }, [tripId, offerId]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(holderEmail.trim());
  const gFirst = sameAsHolder ? holderFirst : guestFirst;
  const gLast = sameAsHolder ? holderLast : guestLast;
  const formValid =
    !!prebook &&
    holderFirst.trim() && holderLast.trim() && emailOk &&
    gFirst.trim() && gLast.trim();

  // STEP 2 — book with the REAL guest details + the prebook transactionId.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prebook || !formValid) return;
    setPhase('booking');
    setError('');
    try {
      const res = await fetch('/api/travel/liteapi/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          prebookId: prebook.prebookId,
          paymentTransactionId: prebook.transactionId, // sandbox — no SDK yet (PR-B2)
          holder: { firstName: holderFirst.trim(), lastName: holderLast.trim(), email: holderEmail.trim() },
          guests: [{ occupancyNumber: 1, firstName: gFirst.trim(), lastName: gLast.trim(), email: holderEmail.trim() }],
          checkinDate: checkin,
          checkoutDate: checkout,
          hotelName,
          guestCount: 1,
          finalPriceCents: Math.round(prebook.price * 100),
          currency: prebook.currency,
          commissionAmountCents: Math.round(prebook.commission * 100),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Booking failed (HTTP ${res.status})`);
      const r = data.reservation as Confirmation;
      setConfirmation(r);
      setPhase('done');
      onBooked({ confirmationCode: r?.confirmationCode ?? null, bookingId: r?.bookingId ?? prebook.prebookId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed.');
      setPhase('form'); // back to the form so they can retry — NOT a fake success
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-text-primary">Book {hotelName}</h3>
            <p className="text-xs text-text-muted">{checkin} → {checkout}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-primary">✕</button>
        </div>

        {/* Honest TEST-mode banner: no real charge until the payment step (PR-B2). */}
        <div className="mb-4 rounded border border-brand-amber/40 bg-brand-amber/10 px-3 py-2 text-xs text-brand-amber">
          Test booking — no card is charged yet. Real payment is coming soon.
        </div>

        {phase === 'prebooking' && (
          <p className="py-6 text-center text-sm text-text-muted">Holding this rate…</p>
        )}

        {phase !== 'prebooking' && phase !== 'done' && (
          <form onSubmit={submit} className="space-y-4">
            {/* Real prebook numbers (not guessed). */}
            {prebook && (
              <div className="rounded border border-border bg-bg-row p-3 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-text-muted">Total</span>
                  <span className="text-lg font-bold text-brand-green">{money(prebook.price, prebook.currency)}</span>
                </div>
                {prebook.commission > 0 && (
                  <div className="mt-1 flex items-baseline justify-between text-xs text-text-faint">
                    <span>Service margin (included)</span>
                    <span>{money(prebook.commission, prebook.currency)}</span>
                  </div>
                )}
                {prebook.cancellationPolicies != null && (
                  <p className="mt-2 text-xs text-text-muted">A cancellation policy applies to this rate.</p>
                )}
              </div>
            )}

            {error && <p className="rounded border border-brand-red/40 bg-brand-red/5 px-3 py-2 text-sm text-brand-red">{error}</p>}

            {/* Booker (holder) — required. */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Who's booking?</p>
              <div className="grid grid-cols-2 gap-2">
                <input className={inputClass} placeholder="First name" value={holderFirst} onChange={(e) => setHolderFirst(e.target.value)} aria-label="Booker first name" />
                <input className={inputClass} placeholder="Last name" value={holderLast} onChange={(e) => setHolderLast(e.target.value)} aria-label="Booker last name" />
              </div>
              <input type="email" className={inputClass} placeholder="Email for the confirmation" value={holderEmail} onChange={(e) => setHolderEmail(e.target.value)} aria-label="Booker email" />
              {holderEmail.length > 0 && !emailOk && <p className="text-xs text-brand-red">Enter a valid email.</p>}
            </div>

            {/* Guest staying — defaults to the booker, or enter a different name. */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={sameAsHolder} onChange={(e) => setSameAsHolder(e.target.checked)} />
                The guest staying is me
              </label>
              {!sameAsHolder && (
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} placeholder="Guest first name" value={guestFirst} onChange={(e) => setGuestFirst(e.target.value)} aria-label="Guest first name" />
                  <input className={inputClass} placeholder="Guest last name" value={guestLast} onChange={(e) => setGuestLast(e.target.value)} aria-label="Guest last name" />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded border border-border px-4 py-2 text-sm text-text-secondary hover:bg-bg-row">Cancel</button>
              <button
                type="submit"
                disabled={!formValid || phase === 'booking'}
                className="flex-1 rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover disabled:opacity-50"
              >
                {phase === 'booking' ? 'Booking…' : 'Confirm test booking'}
              </button>
            </div>
          </form>
        )}

        {phase === 'done' && confirmation && (
          <div className="space-y-3 py-2 text-center">
            <p className="text-base font-semibold text-brand-green">Booked — you're all set.</p>
            <div className="rounded border border-border bg-bg-row p-3 text-left text-sm">
              <Row label="Hotel" value={confirmation.hotelName || hotelName} />
              <Row label="Confirmation" value={confirmation.confirmationCode || '—'} />
              <Row label="Booking ID" value={confirmation.bookingId} />
              <Row label="Dates" value={`${confirmation.checkinDate} → ${confirmation.checkoutDate}`} />
              {confirmation.finalPriceCents != null && confirmation.currency && (
                <Row label="Total" value={money(confirmation.finalPriceCents / 100, confirmation.currency)} />
              )}
            </div>
            <button type="button" onClick={onClose} className="rounded bg-brand-purple px-6 py-2 text-sm font-semibold text-white hover:bg-brand-purple-hover">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

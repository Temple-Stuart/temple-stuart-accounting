'use client';

/**
 * /booking/confirm — the LiteAPI Payment SDK's returnUrl target (PR-B2). After the
 * customer pays in the hosted SDK, it redirects here carrying the prebook context
 * (prebookId, transactionId, hotel, dates, price) in the query string. This page
 * collects the guest's name and finalizes by calling the EXISTING book route with
 * the transactionId (method TRANSACTION_ID). If the payment wasn't completed, the
 * book route surfaces LiteAPI's real error (e.g. 2014) — nothing is faked.
 *
 * Public: a guest finalizes with no account. If a logged-in user came through with
 * a tripId, the book route links the trip (account booking) — same route, unchanged.
 */

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
// BOOK-3: guest bookings append a session-only trip record (the landing's
// "YOUR TRIP SO FAR" strip). Guest branch only — account bookings carry tripId.
import { addGuestTripRecord } from '@/lib/guestTrip';

interface Confirmation {
  bookingId: string;
  confirmationCode: string | null;
  hotelName: string | null;
  checkinDate: string;
  checkoutDate: string;
  finalPriceCents: number | null;
  currency: string | null;
}

const inputClass =
  'bg-white border border-border rounded px-3 py-2 text-sm text-text-primary w-full ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-purple/40';

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function BookingConfirm() {
  const params = useSearchParams();
  const prebookId = params.get('prebookId') || '';
  const transactionId = params.get('transactionId') || '';
  const hotelName = params.get('hotelName') || 'your stay';
  const checkin = params.get('checkin') || '';
  const checkout = params.get('checkout') || '';
  const currency = params.get('currency') || 'USD';
  const price = Number(params.get('price') || '0');
  const commission = Number(params.get('commission') || '0');
  const tripId = params.get('tripId') || undefined;

  const ready = !!prebookId && !!transactionId && !!checkin && !!checkout;

  const [holderFirst, setHolderFirst] = useState('');
  const [holderLast, setHolderLast] = useState('');
  const [holderEmail, setHolderEmail] = useState('');
  const [guestFirst, setGuestFirst] = useState('');
  const [guestLast, setGuestLast] = useState('');
  const [sameAsHolder, setSameAsHolder] = useState(true);

  const [phase, setPhase] = useState<'form' | 'booking' | 'done'>('form');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(holderEmail.trim());
  const gFirst = sameAsHolder ? holderFirst : guestFirst;
  const gLast = sameAsHolder ? holderLast : guestLast;
  const formValid = ready && holderFirst.trim() && holderLast.trim() && emailOk && gFirst.trim() && gLast.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;
    setPhase('booking');
    setError('');
    try {
      const res = await fetch('/api/travel/liteapi/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(tripId ? { tripId } : {}),
          prebookId,
          paymentTransactionId: transactionId,
          holder: { firstName: holderFirst.trim(), lastName: holderLast.trim(), email: holderEmail.trim() },
          guests: [{ occupancyNumber: 1, firstName: gFirst.trim(), lastName: gLast.trim(), email: holderEmail.trim() }],
          checkinDate: checkin,
          checkoutDate: checkout,
          hotelName,
          guestCount: 1,
          finalPriceCents: Math.round(price * 100),
          currency,
          commissionAmountCents: Math.round(commission * 100),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Booking failed (HTTP ${res.status})`);
      // BOOK-3: GUEST bookings (no tripId — the account branch carries one,
      // header comment :11-12) append the session trip record before the user
      // returns to '/'. Amount = the charged price this page displays; code
      // from the booking response.
      if (!tripId) {
        addGuestTripRecord({
          type: 'hotel',
          name: hotelName,
          confirmationCode:
            typeof (data.reservation as Confirmation | undefined)?.confirmationCode === 'string'
              ? (data.reservation as Confirmation).confirmationCode
              : null,
          amountUsd: Number.isFinite(price) && price > 0 ? price : null,
          currency,
          ts: Date.now(),
        });
      }
      setConfirmation(data.reservation as Confirmation);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed.');
      setPhase('form'); // honest — let them retry, NOT a fake success
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-xl font-bold text-text-primary">Finish your booking</h1>
      <p className="mt-1 text-sm text-text-muted">{hotelName}{checkin && checkout ? ` · ${checkin} → ${checkout}` : ''}</p>

      {!ready ? (
        <div className="mt-6 rounded-lg border border-border bg-white p-6 text-sm text-brand-red">
          We couldn&apos;t read your payment details. Please start the booking again.
          <div className="mt-3"><Link href="/" className="text-brand-purple underline">Back to search</Link></div>
        </div>
      ) : phase === 'done' && confirmation ? (
        <div className="mt-6 space-y-3 rounded-lg border border-border bg-white p-6 text-center">
          <p className="text-base font-semibold text-brand-green">Booked — you&apos;re all set.</p>
          <div className="rounded border border-border bg-bg-row p-3 text-left text-sm">
            <Row label="Hotel" value={confirmation.hotelName || hotelName} />
            <Row label="Confirmation" value={confirmation.confirmationCode || '—'} />
            <Row label="Booking ID" value={confirmation.bookingId} />
            <Row label="Dates" value={`${confirmation.checkinDate} → ${confirmation.checkoutDate}`} />
            {confirmation.finalPriceCents != null && confirmation.currency && (
              <Row label="Total" value={money(confirmation.finalPriceCents, confirmation.currency)} />
            )}
          </div>
          <Link href="/" className="inline-block rounded bg-brand-purple px-6 py-2 text-sm font-semibold text-white hover:bg-brand-purple-hover">Done</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-border bg-white p-6">
          <div className="rounded border border-border bg-bg-row p-3 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-text-muted">Total paid</span>
              <span className="text-lg font-bold text-brand-green">{money(Math.round(price * 100), currency)}</span>
            </div>
          </div>

          {error && <p className="rounded border border-brand-red/40 bg-brand-red/5 px-3 py-2 text-sm text-brand-red">{error}</p>}

          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">Who&apos;s booking?</p>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="First name" value={holderFirst} onChange={(e) => setHolderFirst(e.target.value)} aria-label="Booker first name" />
              <input className={inputClass} placeholder="Last name" value={holderLast} onChange={(e) => setHolderLast(e.target.value)} aria-label="Booker last name" />
            </div>
            <input type="email" className={inputClass} placeholder="Email for the confirmation" value={holderEmail} onChange={(e) => setHolderEmail(e.target.value)} aria-label="Booker email" />
            {holderEmail.length > 0 && !emailOk && <p className="text-xs text-brand-red">Enter a valid email.</p>}
          </div>

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

          <button
            type="submit"
            disabled={!formValid || phase === 'booking'}
            className="w-full rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover disabled:opacity-50"
          >
            {phase === 'booking' ? 'Booking…' : 'Confirm booking'}
          </button>
        </form>
      )}
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

export default function BookingConfirmPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg px-4 py-10 text-sm text-text-muted">Loading…</div>}>
      <BookingConfirm />
    </Suspense>
  );
}

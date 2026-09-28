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
// SEC-02b: a booking the vendor named with no name reads as its lane word (LANE-01).
import { LANE_WORD } from '@/lib/reservations/lane';

interface Confirmation {
  bookingId: string;
  confirmationCode: string | null;
  hotelName: string | null;
  // SEC-02b (2026-09-27): the vendor's stated days, or NULL — said, never the link's.
  checkinDate: string | null;
  checkoutDate: string | null;
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
  // SEC-02b (2026-09-27): the name and the dates the SEARCH showed, as the panel put
  // them in the link — this page's header only. They are never posted: the booking's
  // name and stay are what the vendor's book answer states, or NULL (book/route.ts).
  // No name in the link is no name here — the 'your stay' placeholder is gone.
  const hotelName = params.get('hotelName');
  const checkin = params.get('checkin') || '';
  const checkout = params.get('checkout') || '';
  // SEC-03 (2026-09-25): the currency the SEARCH was made in, as the panel put it
  // in the link — stated to the book route, never defaulted here. The price the
  // panel showed is DISPLAY ONLY: it is not posted (the ledger holds what the
  // vendor's book answer states, or NULL), and when the link has none the line
  // says so.
  const currency = params.get('currency') ?? '';
  const priceParam = params.get('price');
  const price = priceParam !== null && priceParam !== '' && Number.isFinite(Number(priceParam)) ? Number(priceParam) : null;
  const tripId = params.get('tripId') || undefined;

  // The two references the book route needs — the link's dates are not among them.
  const ready = !!prebookId && !!transactionId;

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
          // SEC-02b: no checkinDate / checkoutDate / hotelName — the stay is the vendor's.
          guestCount: 1,
          // SEC-03: no finalPriceCents — the ledger takes the vendor's stated
          // price or NULL; the search currency only when the link stated one.
          ...(currency ? { currency } : {}),
          // COMM-01 (2026-09-26): no commissionAmountCents — a client never states a
          // ledger amount; the ledger takes the vendor's stated figure or NULL.
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
          name: (data.reservation as Confirmation | undefined)?.hotelName ?? LANE_WORD.hotel,
          confirmationCode:
            typeof (data.reservation as Confirmation | undefined)?.confirmationCode === 'string'
              ? (data.reservation as Confirmation).confirmationCode
              : null,
          amountUsd: price !== null && price > 0 ? price : null,
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
      <p className="mt-1 text-sm text-text-muted">{[hotelName, checkin && checkout ? `${checkin} → ${checkout}` : null].filter(Boolean).join(' · ')}</p>

      {!ready ? (
        <div className="mt-6 rounded-lg border border-border bg-white p-6 text-sm text-brand-red">
          We couldn&apos;t read your payment details. Please start the booking again.
          <div className="mt-3"><Link href="/" className="text-brand-purple underline">Back to search</Link></div>
        </div>
      ) : phase === 'done' && confirmation ? (
        <div className="mt-6 space-y-3 rounded-lg border border-border bg-white p-6 text-center">
          <p className="text-base font-semibold text-brand-green">Booked — you&apos;re all set.</p>
          <div className="rounded border border-border bg-bg-row p-3 text-left text-sm">
            <Row label="Hotel" value={confirmation.hotelName ?? LANE_WORD.hotel} />
            <Row label="Confirmation" value={confirmation.confirmationCode || '—'} />
            <Row label="Booking ID" value={confirmation.bookingId} />
            {/* SEC-02b: the stay the vendor stated — a day it did not state is SAID. */}
            <Row label="Dates" value={confirmation.checkinDate !== null && confirmation.checkoutDate !== null ? `${confirmation.checkinDate} → ${confirmation.checkoutDate}` : 'dates not stated by the hotel — see your booking ID'} />
            {/* SEC-03: a price the vendor did not state is SAID — never $0, never a missing row. */}
            {confirmation.finalPriceCents !== null && confirmation.currency
              ? <Row label="Total" value={money(confirmation.finalPriceCents, confirmation.currency)} />
              : <Row label="Total" value="price not stated" />}
          </div>
          <Link href="/" className="inline-block rounded bg-brand-purple px-6 py-2 text-sm font-semibold text-white hover:bg-brand-purple-hover">Done</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-border bg-white p-6">
          <div className="rounded border border-border bg-bg-row p-3 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-text-muted">Total paid</span>
              <span className="text-lg font-bold text-brand-green">{price !== null && currency ? money(Math.round(price * 100), currency) : 'price not stated'}</span>
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

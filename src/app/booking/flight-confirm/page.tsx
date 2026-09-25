'use client';

/**
 * /booking/flight-confirm — FL-4c (2026-09-23).
 *
 * THE FLIGHTS ANALOGUE OF /booking/confirm, and it exists because the DOCUMENTED
 * payment rail redirects.
 *
 * LiteAPI's User Payment flow (docs.liteapi.travel/docs/user-payment) hands the
 * card to their hosted wrapper, which finishes with Stripe's confirmPayment and a
 * redirect to the `returnUrl` the caller configured. Hotels have landed on
 * /booking/confirm since PR-B2 for exactly that reason. Flights had no such
 * surface because the old panel mounted Elements itself and completed in-page;
 * moving flights onto the documented rail means the redirect has to land
 * somewhere, and landing a PAID customer on the hotel page would fail them.
 *
 * This page completes the booking with the EXISTING flights book route — the same
 * call the panel used to make (PR-FL-6c), with the same idempotency: the upstream
 * is idempotent per prebookId, so a refresh cannot double-book or re-charge.
 *
 * It invents nothing: every value it posts arrives in the query string the panel
 * built, and a missing one is stated rather than guessed.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Booked {
  bookingId: string;
  bookingRef: string | null;
  status: string | null;
  paymentStatus: string | null;
  pnr: string | null;
  price: number | null;
  currency: string | null;
  email?: { sent: true; id: string } | { sent: false; error: string };
}

function FlightConfirmInner() {
  const params = useSearchParams();
  const prebookId = params.get('prebookId') ?? '';
  const transactionId = params.get('transactionId') ?? '';
  const contactEmail = params.get('contactEmail') ?? '';
  // LANE-01 (2026-09-25): the owner's trip, when the checkout carried one. Sent
  // to the book route only when present; the route's own gate decides (401 for a
  // guest, 404 for a trip that is not theirs). Absent → standalone booking.
  const tripId = params.get('tripId') ?? '';

  const [phase, setPhase] = useState<'booking' | 'booked' | 'failed' | 'incomplete'>('booking');
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<Booked | null>(null);

  const complete = useCallback(async () => {
    setPhase('booking');
    setError('');
    try {
      const res = await fetch('/api/travel/liteapi/flights/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prebookId, transactionId, contactEmail, ...(tripId ? { tripId } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Booking did not complete (HTTP ${res.status})`);
      setBooked(data as Booked);
      setPhase('booked');
    } catch (err) {
      // THE CRITICAL STATE — paid but not booked. It never pretends: both
      // references are named and the ONLY offer is to retry the book step, which
      // is idempotent per prebookId and can neither re-pay nor double-book.
      setError(err instanceof Error ? err.message : 'Booking did not complete.');
      setPhase('failed');
    }
  }, [prebookId, transactionId, contactEmail, tripId]);

  useEffect(() => {
    if (!prebookId || !transactionId || !contactEmail) {
      setPhase('incomplete');
      return;
    }
    void complete();
  }, [prebookId, transactionId, contactEmail, complete]);

  const ticketIssuing = booked?.status === 'PENDING_CONFIRMATION' || booked?.status === 'PENDING';

  return (
    <div className="mx-auto max-w-lg px-4 py-12" data-flight-confirm={phase}>
      <h1 className="text-xl font-bold text-text-primary">Your flight</h1>

      {phase === 'incomplete' && (
        <div className="mt-4 rounded border border-brand-red/40 bg-brand-red/5 p-4 text-sm text-brand-red" role="alert">
          <p className="font-semibold">This page is missing the booking it should complete.</p>
          <p className="mt-1 text-xs">
            It needs the references the checkout puts in the link. Nothing was booked from here. If you paid, do not
            pay again — contact us and we will finish it.
          </p>
        </div>
      )}

      {phase === 'booking' && <p className="mt-4 text-sm text-text-faint">Completing your booking…</p>}

      {phase === 'failed' && (
        <div className="mt-4 space-y-3 rounded border border-brand-red/40 bg-brand-red/5 p-4 text-sm text-brand-red" role="alert">
          <p className="font-semibold">Your payment went through, but the booking did not complete.</p>
          <p className="text-xs">{error}</p>
          <p className="text-xs">
            Prebook reference <span className="font-mono">{prebookId}</span> · payment reference{' '}
            <span className="font-mono">{transactionId}</span>. Keep these.
          </p>
          <button type="button" onClick={() => void complete()} className="rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white">
            Retry booking
          </button>
        </div>
      )}

      {phase === 'booked' && booked && (
        <div className="mt-4 space-y-2 rounded border border-brand-green/40 bg-brand-green/5 p-4">
          <p className="text-sm font-semibold text-brand-green">
            {ticketIssuing ? 'Booked — your ticket is being issued' : 'Booked'}
          </p>
          <p className="text-sm text-text-primary">
            Reference <span className="font-mono">{booked.bookingRef ?? booked.bookingId}</span>
          </p>
          {booked.pnr && (
            <p className="text-xs text-text-primary">
              Airline confirmation (PNR): <span className="font-mono">{booked.pnr}</span>
            </p>
          )}
          {booked.price != null && (
            <p className="text-xs text-text-secondary">
              Total charged: {booked.currency ?? ''} {booked.price.toFixed(2)}
            </p>
          )}
          {/* FL-5b, unchanged in substance and moved here with the booking it
              belongs to: whether the confirmation went out, said either way. A
              booking that could not be emailed is still a booking, and the
              reference above is what the traveller keeps. */}
          {booked.email && (
            booked.email.sent
              ? <p className="text-xs text-text-secondary" data-flight-email="sent">A confirmation is on its way to your email.</p>
              : <p className="text-xs text-brand-amber" data-flight-email="failed">We could not send the confirmation email. Your booking is complete and paid — keep the reference above.</p>
          )}
          <Link href="/travel" className="inline-block text-sm text-brand-purple hover:text-brand-purple-hover">
            Back to travel →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function FlightConfirmPage() {
  return (
    <Suspense fallback={<p className="px-4 py-12 text-sm text-text-faint">Loading…</p>}>
      <FlightConfirmInner />
    </Suspense>
  );
}

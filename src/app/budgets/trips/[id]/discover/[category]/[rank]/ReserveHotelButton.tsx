'use client';

import { useState } from 'react';

interface Props {
  tripId: string;
  offerId: string;
  hotelName: string;
  checkinDate: string; // ISO YYYY-MM-DD
  checkoutDate: string;
  nightly: number | null;
  currency: string;
}

// Tiny client island that drives the PR-3b sandbox booking flow.
// Sandbox shortcut: prebook returns a transactionId that we pass straight
// through to /book — works because LiteAPI sandbox accepts it without real
// card capture. Production needs the hosted payment SDK to render here and
// collect a real card → that's PR-4b (flagged in the UI below).
export function ReserveHotelButton({
  tripId, offerId, hotelName, checkinDate, checkoutDate, nightly, currency,
}: Props) {
  const [state, setState] = useState<'idle' | 'reserving' | 'reserved' | 'failed'>('idle');
  const [confirmation, setConfirmation] = useState<{ code: string | null; bookingId: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleReserve = async () => {
    setState('reserving');
    setErrorMsg(null);
    try {
      const prebookRes = await fetch('/api/travel/liteapi/prebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, offerId }),
      });
      const prebookBody = await prebookRes.json().catch(() => ({}));
      if (!prebookRes.ok) throw new Error(prebookBody.error || `Prebook HTTP ${prebookRes.status}`);
      const prebook = prebookBody.prebook;
      if (!prebook?.prebookId || !prebook?.transactionId) {
        throw new Error('Prebook response missing prebookId or transactionId');
      }

      const holder = { firstName: 'Trip', lastName: 'Owner', email: 'guest@example.com' };
      const bookRes = await fetch('/api/travel/liteapi/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          prebookId: prebook.prebookId,
          paymentTransactionId: prebook.transactionId,
          holder,
          guests: [{ occupancyNumber: 1, ...holder }],
          checkinDate,
          checkoutDate,
          hotelName,
          guestCount: 1,
          finalPriceCents: Math.round((prebook.price || nightly || 0) * 100),
          currency: prebook.currency || currency,
          commissionAmountCents: Math.round((prebook.commission || 0) * 100),
        }),
      });
      const bookBody = await bookRes.json().catch(() => ({}));
      if (!bookRes.ok) throw new Error(bookBody.error || `Book HTTP ${bookRes.status}`);
      const r = bookBody.reservation;
      setConfirmation({ code: r?.confirmationCode || null, bookingId: r?.bookingId || prebook.prebookId });
      setState('reserved');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Reserve failed');
      setState('failed');
    }
  };

  if (state === 'reserved' && confirmation) {
    return (
      <div className="px-4 py-2 bg-emerald-100 border border-emerald-300 text-emerald-800 text-sm font-medium rounded">
        Reserved · {confirmation.code || confirmation.bookingId}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleReserve}
        disabled={state === 'reserving'}
        className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded hover:bg-brand-purple-hover disabled:opacity-50"
      >
        {state === 'reserving' ? 'Reserving…' : 'Reserve'}
      </button>
      <span className="text-[10px] text-text-faint">Sandbox booking — no real card captured (PR-4b adds the payment SDK).</span>
      {state === 'failed' && errorMsg && (
        <span className="text-xs text-brand-red max-w-xs">{errorMsg}</span>
      )}
    </div>
  );
}

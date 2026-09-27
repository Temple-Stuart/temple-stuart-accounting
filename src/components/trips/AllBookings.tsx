'use client';

/**
 * AllBookings — BOOKINGS-01 (2026-09-27): every booking of the signed-in user, in ONE list.
 *
 * One authed GET of /api/reservations (every reservation WHERE userId = the caller,
 * newest first — guest rows never appear), each row already built by the pure leaf
 * src/lib/reservations/bookingRow.ts: the lane and name, the dates, the status (and a
 * pending cancel's stated time), the confirmation code, a flight's ticketing, the last
 * vendor read, the bank match, the ledger posting, the budget line, the vendor price as
 * recorded, and the receipt and trip links. This component types no word of its own —
 * every one is the leaf's (BOOKING_WORDS). It writes nothing. TripBookings (a trip's)
 * and UnattachedBookings (the unattached) stay as they are; this replaces neither.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BOOKING_WORDS, type BookingRow } from '@/lib/reservations/bookingRow';

type Loaded = { state: 'loading' } | { state: 'error'; message: string } | { state: 'done'; rows: BookingRow[] };

export default function AllBookings() {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/reservations');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `${BOOKING_WORDS.unreadable} (${res.status})`);
        if (alive) setLoaded({ state: 'done', rows: Array.isArray(data.bookings) ? (data.bookings as BookingRow[]) : [] });
      } catch (err) {
        if (alive) setLoaded({ state: 'error', message: err instanceof Error ? err.message : BOOKING_WORDS.unreadable });
      }
    })();
    return () => { alive = false; };
  }, []);

  const th = 'px-3 py-2 text-left font-medium text-text-faint whitespace-nowrap';
  const td = 'px-3 py-2 align-top';
  const c = BOOKING_WORDS.columns;

  return (
    <div className="rounded-lg border border-border bg-white p-4" data-all-bookings>
      {loaded.state === 'loading' && <p className="text-sm text-text-faint">{BOOKING_WORDS.loading}</p>}
      {loaded.state === 'error' && <p className="text-sm text-brand-red" role="alert">{loaded.message}</p>}
      {loaded.state === 'done' && loaded.rows.length === 0 && <p className="text-sm text-text-faint">{BOOKING_WORDS.none}</p>}
      {loaded.state === 'done' && loaded.rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-border bg-white font-mono text-[10px] uppercase tracking-wider">
                <th className={th}>{c.booking}</th>
                <th className={th}>{c.dates}</th>
                <th className={th}>{c.status}</th>
                <th className={th}>{c.confirmation}</th>
                <th className={th}>{c.ticketing}</th>
                <th className={th}>{c.bank}</th>
                <th className={th}>{c.ledger}</th>
                <th className={th}>{c.budgetLine}</th>
                <th className={`${th} text-right`}>{c.price}</th>
                <th className={th}><span className="sr-only">{BOOKING_WORDS.receipt}</span></th>
              </tr>
            </thead>
            <tbody>
              {loaded.rows.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0" data-booking-row={b.id}>
                  <td className={td}>
                    <span className="text-xs text-text-faint">{b.laneWord}</span>
                    <div className="font-medium text-text-primary">{b.name}</div>
                    <div className="text-xs text-text-faint">{b.vendorRead}</div>
                  </td>
                  <td className={`${td} whitespace-nowrap text-text-muted`}>{b.dates}</td>
                  <td className={`${td} text-text-muted`}>
                    {b.status}
                    {b.cancellation && <div className="text-xs text-brand-amber">{b.cancellation}</div>}
                  </td>
                  <td className={`${td} font-mono text-xs text-text-muted`}>{b.confirmation}</td>
                  <td className={`${td} text-xs text-text-muted`}>{b.ticketing ?? BOOKING_WORDS.notApplicable}</td>
                  <td className={`${td} text-xs text-text-muted`}>{b.bank}</td>
                  <td className={`${td} text-xs text-text-muted`}>{b.ledger}</td>
                  <td className={`${td} text-xs text-text-muted`}>{b.budgetLine}</td>
                  <td className={`${td} whitespace-nowrap text-right font-mono text-text-primary`}>{b.price}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Link href={b.receiptHref} className="mr-2 rounded border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-row" data-booking-receipt={b.id}>
                      {BOOKING_WORDS.receipt}
                    </Link>
                    {b.tripHref && (
                      <Link href={b.tripHref} className="rounded border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-row" data-booking-trip={b.id}>
                        {BOOKING_WORDS.trip}
                      </Link>
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

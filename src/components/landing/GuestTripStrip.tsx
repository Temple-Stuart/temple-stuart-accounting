'use client';

// BOOK-3: "YOUR TRIP SO FAR" — the guest's session trip, rendered under the
// landing's booking section. Bloomberg chrome; rows + running total + the
// honest account pitch (the ruled line, verbatim). AUTHED USERS NEVER SEE
// THIS by construction: it mounts only inside Landing, which only the FD-2
// verified-guest arrival branch renders (page.tsx — an authed arrival gets
// <HomeClient/>, never the Landing); authed users have the real trip hub.
// Fail-honest: readGuestTrip validates every row (guestTrip.ts) — absent or
// unparseable storage renders NOTHING; rows are never invented.

import { useEffect, useState } from 'react';
import { readGuestTrip, GUEST_TRIP_EVENT, type GuestTripRecord } from '@/lib/guestTrip';

export default function GuestTripStrip({ onRequireAuth }: { onRequireAuth: () => void }) {
  const [records, setRecords] = useState<GuestTripRecord[]>([]);

  useEffect(() => {
    const sync = () => setRecords(readGuestTrip());
    sync(); // effect-only read keeps hydration safe (server renders nothing)
    window.addEventListener(GUEST_TRIP_EVENT, sync);
    return () => window.removeEventListener(GUEST_TRIP_EVENT, sync);
  }, []);

  if (records.length === 0) return null;

  // Per-currency totals over rows whose amount is known — a missing amount
  // renders a dash and is excluded from its total, never guessed.
  const totals = new Map<string, number>();
  for (const r of records) {
    if (r.amountUsd !== null) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amountUsd);
  }

  return (
    <section className="w-full border-b border-panel-border bg-panel">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
          Your trip so far
        </p>
        <div className="overflow-x-auto rounded-lg border border-panel-border bg-panel-surface">
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {records.map((r) => (
                <tr key={`${r.ts}-${r.confirmationCode ?? r.name}`} className="border-b border-panel-border">
                  <td className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/50 whitespace-nowrap">
                    {r.type}
                  </td>
                  <td className="px-3 py-2 text-xs text-white/80">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-white/60 whitespace-nowrap">
                    {r.confirmationCode ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-white whitespace-nowrap">
                    {r.amountUsd !== null
                      ? `${r.currency} ${r.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                </tr>
              ))}
              {[...totals.entries()].map(([cur, sum]) => (
                <tr key={cur} className="bg-panel">
                  <td colSpan={3} className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/60">
                    Total{totals.size > 1 ? ` (${cur})` : ''}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm font-bold text-white whitespace-nowrap">
                    {cur} {sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-xs text-white/60">
            This trip lives in your browser — create a free account to save it, budget it, and map
            it to your runway.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="self-start bg-white px-5 py-2 text-xs font-medium text-brand-purple hover:bg-bg-row sm:self-auto"
          >
            Create free account
          </button>
        </div>
      </div>
    </section>
  );
}

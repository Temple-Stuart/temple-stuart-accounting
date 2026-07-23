'use client';

// BOOK-1: the lobby books — the REAL travel search + booking components
// mounted directly on '/' (zero forks, zero duplicated search UIs; Alex's
// ruling). Guests type, search, see results, and complete flight + hotel
// bookings here without entering the app:
//   • flights book fully in-panel (FlightCheckoutPanel — Duffel Payments);
//   • hotels ride the existing hosted-payment → /booking/confirm flow (the
//     guest briefly visits the provider's card form + the confirm page —
//     the proven flow, unchanged);
//   • the hotel destination is chosen from the live country/city picker
//     inside PublicHotelSearch (the no-free-text invariant stands).
// Guest posture is passed EXPLICITLY: this section renders only on the
// verified-guest landing (FD-2 arrival branch), so authed={false} — save
// flows nudge sign-up (onRequireAuth = GuestLanding's real LoginBox opener,
// GuestLanding.tsx:31-39), no trips fetch ever fires, bookings are
// standalone. Cost posture is unchanged by mount location: every search
// route carries its own per-IP rateLimit + reserveTravelSearch daily cap
// server-side (e.g. flights/search/route.ts:26-49).

import PublicFlightSearch from '@/components/trips/PublicFlightSearch';
import PublicHotelSearch from '@/components/trips/PublicHotelSearch';

export default function LandingBookingSection({ onRequireAuth }: { onRequireAuth: () => void }) {
  return (
    <section className="w-full border-b border-panel-border bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-6">
        <div>
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Book now — no account needed
          </p>
          <h2 className="text-2xl font-light tracking-tight text-text-primary">
            Search real flights &amp; hotels. Book right here.
          </h2>
        </div>
        <PublicFlightSearch onRequireAuth={onRequireAuth} authed={false} />
        <PublicHotelSearch onRequireAuth={onRequireAuth} authed={false} />
      </div>
    </section>
  );
}

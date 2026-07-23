'use client';

// BOOK-1: the lobby books — the REAL travel search + booking components
// mounted directly on '/' (zero forks, zero duplicated search UIs; Alex's
// ruling). Guests type, search, see results, and complete flight + hotel
// bookings here without entering the app:
//   • flights book fully in-panel (FlightCheckoutPanel — Duffel Payments);
//   • hotels ride the existing hosted-payment → /booking/confirm flow;
//   • BOOK-2: activities + ground transit (real Viator search; Book routes
//     to sign-up — no in-house booking exists) and the visa check (official
//     government link only — the never-affiliate rule, VisaResultView.tsx
//     :10-12) complete the five pillars. All five ride this section's single
//     lazy chunk (the BOOK-1 dynamic pattern).
// TOGGLE-1: the five stacked sections become ONE strip with a five-way
// toggle — the deleted teaser's form factor complete (container + toggle
// classes recovered verbatim from LandingSearchTeaser.tsx@840a053b, exactly
// as COMPACT-1 recovered its field vocabulary). One pillar's form is visible
// at a time; the rest are CSS-hidden but stay MOUNTED (the ModuleLauncher
// tab-panel precedent, ModuleLauncher.tsx:659 `'block' : 'hidden'`) so
// in-flight searches, results, and open checkouts SURVIVE toggling. The
// wrapper owns the ONLY toggle logic (one useState); the five components are
// untouched. The strip mounts where the teaser mounted — inside the hero,
// directly under the CTA row (Landing.tsx).
// Guest posture is passed EXPLICITLY: this section renders only on the
// verified-guest landing (FD-2 arrival branch), so authed={false} — save
// flows nudge sign-up (onRequireAuth = GuestLanding's real LoginBox opener,
// GuestLanding.tsx:31-39), no trips fetch ever fires, bookings are
// standalone. Cost posture is unchanged by mount location: every search
// route carries its own per-IP rateLimit + reserveTravelSearch daily cap
// server-side (e.g. flights/search/route.ts:26-49).

// DS-1: the toggle mechanism moved to the shared <ToggleStrip> (src/components/
// ui/ToggleStrip.tsx) — the SAME primitive the app travel tab now consumes.
// This wrapper just supplies the landing's five guest panels + the value blurb;
// container class (mt-8 + DS.STRIP), chip idiom, default (first = flights), and
// the mount-all/CSS-hide behavior are byte-identical to the pre-extraction
// TOGGLE-1 output.
import ToggleStrip, { type ToggleMode } from '@/components/ui/ToggleStrip';
import { DS } from '@/lib/ds';
import PublicFlightSearch from '@/components/trips/PublicFlightSearch';
import PublicHotelSearch from '@/components/trips/PublicHotelSearch';
import PublicActivitySearch from '@/components/trips/PublicActivitySearch';
import PublicTransferSearch from '@/components/trips/PublicTransferSearch';
import PublicVisaCheck from '@/components/trips/PublicVisaCheck';

export default function LandingBookingSection({ onRequireAuth }: { onRequireAuth: () => void }) {
  const modes: ToggleMode[] = [
    { key: 'flights', label: 'Flights', panel: <PublicFlightSearch onRequireAuth={onRequireAuth} authed={false} /> },
    { key: 'hotels', label: 'Hotels', panel: <PublicHotelSearch onRequireAuth={onRequireAuth} authed={false} /> },
    { key: 'transit', label: 'Getting around', panel: <PublicTransferSearch onRequireAuth={onRequireAuth} /> },
    { key: 'activities', label: 'Things to do', panel: <PublicActivitySearch onRequireAuth={onRequireAuth} /> },
    { key: 'visa', label: 'Visa', panel: <PublicVisaCheck /> },
  ];

  return (
    <ToggleStrip
      className={`mt-8 ${DS.STRIP}`}
      modes={modes}
      header={
        /* LOBBY-POLISH-1: the value blurb — first child of the strip, above the
           chip row. Claims verified: booking = flights & hotels; the session trip
           strip renders below (GuestTripStrip). */
        <p className="mb-2 font-mono text-[11px] leading-relaxed text-white/70">
          Live searches — book real flights &amp; hotels right here, no account needed.
          Your bookings show up below as your trip.
        </p>
      }
    />
  );
}

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

import { useState } from 'react';
import PublicFlightSearch from '@/components/trips/PublicFlightSearch';
import PublicHotelSearch from '@/components/trips/PublicHotelSearch';
import PublicActivitySearch from '@/components/trips/PublicActivitySearch';
import PublicTransferSearch from '@/components/trips/PublicTransferSearch';
import PublicVisaCheck from '@/components/trips/PublicVisaCheck';

type LobbyMode = 'flights' | 'hotels' | 'transit' | 'activities' | 'visa';

const MODES: { key: LobbyMode; label: string }[] = [
  { key: 'flights', label: 'Flights' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'transit', label: 'Getting around' },
  { key: 'activities', label: 'Things to do' },
  { key: 'visa', label: 'Visa' },
];

export default function LandingBookingSection({ onRequireAuth }: { onRequireAuth: () => void }) {
  // TOGGLE-1: the wrapper's ONLY logic — which pillar's panel is visible.
  const [mode, setMode] = useState<LobbyMode>('flights');

  // The teaser's toggle idiom, verbatim (LandingSearchTeaser.tsx@840a053b).
  const toggleClass = (active: boolean) =>
    `px-3 py-1.5 font-mono text-xs font-medium ${
      active ? 'bg-white text-brand-purple' : 'border border-white/30 text-white/70 hover:bg-white/10'
    }`;

  // CSS show/hide — never unmount (in-flight results survive the toggle).
  const panelClass = (key: LobbyMode) => (mode === key ? 'block' : 'hidden');

  return (
    // The teaser's container, verbatim minus its max-w-3xl (five full booking
    // surfaces + result rows need the hero's content width).
    <div className="mt-8 rounded-lg border border-white/20 bg-white/5 p-4">
      {/* LOBBY-POLISH-1: the value blurb — first child of the strip container,
          ABOVE the chip row. Claims verified: booking = flights & hotels
          (the two in-house checkout flows); the session trip strip renders
          below after any booking (GuestTripStrip). The old "LIVE SEARCHES ·
          NO ACCOUNT NEEDED" micro-line FOLDED into this line (its two claims
          — live searches, no account — both survive here). */}
      <p className="mb-2 font-mono text-[11px] leading-relaxed text-white/70">
        Live searches — book real flights &amp; hotels right here, no account needed.
        Your bookings show up below as your trip.
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={toggleClass(mode === m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className={panelClass('flights')}>
        <PublicFlightSearch onRequireAuth={onRequireAuth} authed={false} />
      </div>
      <div className={panelClass('hotels')}>
        <PublicHotelSearch onRequireAuth={onRequireAuth} authed={false} />
      </div>
      <div className={panelClass('transit')}>
        <PublicTransferSearch onRequireAuth={onRequireAuth} />
      </div>
      <div className={panelClass('activities')}>
        <PublicActivitySearch onRequireAuth={onRequireAuth} />
      </div>
      <div className={panelClass('visa')}>
        <PublicVisaCheck />
      </div>
    </div>
  );
}

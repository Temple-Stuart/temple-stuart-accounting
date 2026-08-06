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
// PR-ELEV-1: the modes come from the ONE shared builder (8 chips — 5 live + 3
// "Soon"), so the guest landing and the app travel tab render the same strip
// and light up together as affiliate IDs land.
import { travelStripModes } from '@/components/trips/travelStripModes';

export default function LandingBookingSection({ onRequireAuth }: { onRequireAuth: () => void }) {
  const modes: ToggleMode[] = travelStripModes({ onRequireAuth, authed: false });

  return (
    <ToggleStrip
      className={`mt-8 ${DS.STRIP}`}
      modes={modes}
      header={
        /* LAND-MSG-1 → PR-STRIP-DESIGN-1: the long WHY paragraph compressed
           to ONE line — the per-mode explainer under the tabs carries the
           explaining now (the Kayak behavior). Claims verified, both
           pre-existing: the free-today clause is the deck's PRICE-1 green
           line near-verbatim (public search routes, guest booking); the
           account clause is the old blurb's own closing sentence compressed
           ("A free account just adds saving, budgeting, and runway on top"). */
        <div className="mb-2">
          <p className={`${DS.TYPE.microLabel} mb-1`}>Free travel search &amp; booking</p>
          <p className="font-mono text-[11px] leading-relaxed text-white/70">
            Free today: search &amp; book travel, no account required — a free account
            adds saving, budgeting, and runway.
          </p>
        </div>
      }
    />
  );
}

'use client';

// BOOK-1: the lobby books — the REAL travel search + booking components
// mounted directly on '/' (zero forks, zero duplicated search UIs; Alex's
// ruling). Guests type, search, see results, and complete flight + hotel
// bookings here without entering the app:
//   • flights book fully in-panel (LiteApiFlightCheckoutPanel — Nuitee-Stripe Elements);
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
// HOME-BRIEF-04 (Alex, 2026-11-10 19:00 · 19:03): THE EVENTS INSIDE THE EVENTS TAB, FIRST AND OPEN. The experiences
// catalog left its full-width purple band under this box; Landing.tsx hands it in as `events`, and it is the panel of
// the builder's Events mode — whose key, label, icon and headline stay as the builder made them. That mode is moved to
// the FRONT of the list, and the strip opens on its first mode, so the box opens on Events ("first = flights" above
// is history; Flights is second). The other modes keep the builder's order and their own panels, untouched — the
// builder's file is frozen (src/lib/travelBookingFlow.ts) and is not edited: only the list it returns is re-ordered
// here. The builder's own Events panel (one sentence and a jump link to the band) is not rendered on this page: there
// is no band to jump to. No 'events' mode from the builder → this throws, by name — never a box without the catalog.
import type { ReactNode } from 'react';
import ToggleStrip, { type ToggleMode } from '@/components/ui/ToggleStrip';
// PR-ELEV-1: the modes come from the ONE shared builder (8 chips — 5 live + 3
// "Soon"), so the guest landing and the app travel tab render the same strip
// and light up together as affiliate IDs land.
import { travelStripModes } from '@/components/trips/travelStripModes';

/** HOME-BRIEF-04 (2026-11-10): the builder's Events mode, by its key (travelStripModes.tsx). */
const EVENTS_KEY = 'events';

export default function LandingBookingSection({ onRequireAuth, events }: { onRequireAuth: () => void; events: ReactNode }) {
  // EVENTS-01b (2026-10-30): this strip sits in Landing.tsx, which mounts the experiences
  // section with id="events" directly under it — so the Events mode's jump link names it.
  // (experiences01.test.ts holds this literal equal to ExperiencesSection's EVENTS_ANCHOR.)
  // HOME-BRIEF-04 (2026-11-10): the section with id="events" is this strip's own Events panel now (`events`); the call
  // below is unchanged — the anchor still names where the experiences are on this surface.
  const modes: ToggleMode[] = travelStripModes({ onRequireAuth, authed: false, eventsAnchor: '#events' });
  const eventsMode = modes.find((m) => m.key === EVENTS_KEY);
  if (!eventsMode) throw new Error(`LandingBookingSection: travelStripModes returned no '${EVENTS_KEY}' mode (it returned ${modes.map((m) => m.key).join(', ') || 'none'}) — the experiences catalog has no tab to sit in`);
  // The Events mode first — the strip opens on its first mode — carrying the catalog as its panel; then the rest, in the builder's order.
  const ordered: ToggleMode[] = [{ ...eventsMode, panel: events }, ...modes.filter((m) => m.key !== EVENTS_KEY)];

  return (
    // LANDING-V5 (Alex's ruling; spec :93-178): the demo section carries ZERO
    // purple — the PR-STRIP-DESIGN-2 band + floating-card straddle die on
    // this mount. The toggler survives, seated with its panels in ONE white
    // hairline card on the cream page (the spec's card chrome, house
    // rounded-lg idiom). The band headline died with the band (the section
    // h2 above already titles the demo, spec :99); TRAVEL_TRUST_CHIPS were
    // band furniture (white ink) — their facts survive in the spec caption
    // row ('SEARCHING IS ALWAYS FREE', FlightPickerView) and the spec footer
    // row Landing.tsx mounts under this strip. The app travel tab
    // (ModuleLauncher) keeps its band — this PR reseats the LANDING mount
    // only. Wiring untouched: same modes builder, same props.
    <ToggleStrip
      className="mt-6 rounded-lg border border-border bg-white p-4"
      modes={ordered}
    />
  );
}

/**
 * travelStripModes (PR-ELEV-1) — THE one travel strip, built once, consumed by
 * BOTH surfaces (LandingBookingSection + ModuleLauncher's travel tab). Eight
 * modes: the five live chips exactly as they were, plus the three former
 * coming-soon tiles (Travel insurance / Stay connected / Events) as SELECTABLE
 * chips with a "Soon" badge whose panels carry the tiles' explainer content
 * verbatim (ComingSoonSection — reused as the soon-panel body, not rebuilt).
 *
 * STRUCTURAL LIGHT-UP (the PR-LANDING-1 ruling, now at chip level): when a
 * tile's affiliate ID lands, its mode's panel swaps from the ComingSoonSection
 * body to the live surface and the badge drops — key and position stay FROZEN,
 * and because both surfaces consume this one builder, the chip lights up on
 * the guest landing and the app travel tab AT ONCE.
 *
 * Per-surface differences ride `opts` (authed state, trip-commit wiring, the
 * unified-bar fan-out); a surface that doesn't use a prop simply omits it —
 * undefined props are byte-equivalent to the old per-surface inline mounts.
 */

import type { ToggleMode } from '@/components/ui/ToggleStrip';
// PR-STRIP-DESIGN-1: the tab icons — lucide is the house icon vocabulary
// (TripHeader/TripPlannerAI precedents), ~20px per the icon-tab spec.
import { Plane, BedDouble, Bus, Compass, FileCheck, Shield, Wifi, CalendarDays } from 'lucide-react';
import ComingSoonSection from '@/components/home/ComingSoonSection';
import PublicFlightSearch from './PublicFlightSearch';
import PublicHotelSearch from './PublicHotelSearch';
import PublicActivitySearch from './PublicActivitySearch';
import PublicTransferSearch from './PublicTransferSearch';
import PublicVisaCheck from './PublicVisaCheck';

export interface TravelStripOptions {
  onRequireAuth: () => void;
  /** Login state (flights/hotels save-to-trip flows). Landing passes false. */
  authed?: boolean | null;
  /** The selected trip (app surface only) — where a committed flight/stay saves. */
  currentTrip?: { id: string; name?: string } | null;
  /** Fired after a commit/booking so the trip budget re-fetches (app surface). */
  onCommitted?: () => void;
  /** PR-3 unified-bar fan-out (app surface): shared destination + nonce. */
  sharedCity?: string;
  sharedCountry?: string;
  searchNonce?: number;
}

/** The in-chip "Soon" marker — plain text inheriting the chip's own color so it
 *  reads correctly in both chip states (DS.toggleChip active/inactive). No new
 *  design vocabulary. */
const SOON_BADGE = (
  <span className="ml-1.5 align-middle text-[9px] font-semibold uppercase tracking-wider opacity-60">
    Soon
  </span>
);

/** The shared ~20px tab-icon sizing (PR-STRIP-DESIGN-1 spec). */
const ICON_CLASS = 'h-5 w-5';

export function travelStripModes(opts: TravelStripOptions): ToggleMode[] {
  const { onRequireAuth, authed, currentTrip, onCommitted, sharedCity, sharedCountry, searchNonce } = opts;
  // PR-STRIP-DESIGN-1: each LIVE mode's `explainer` is that component's own
  // TravelSectionShell line VERBATIM (the shell header hides under the strip
  // now — the line moved UP, it did not change): flights =
  // PublicFlightSearch.tsx shell line; hotels = PublicHotelSearch's; transit
  // = PublicTransferSearch's; activities = PublicActivitySearch's; visa =
  // PublicVisaCheck's. The three Soon modes carry NO strip explainer — their
  // ComingSoonSection panels self-explain verbatim (no duplicated line).
  return [
    { key: 'flights', label: 'Flights', icon: <Plane className={ICON_CLASS} strokeWidth={1.75} aria-hidden="true" />,
      explainer: 'Live fares — book right here, or create a free account to save flights to a trip.',
      panel: (
      <PublicFlightSearch
        onRequireAuth={onRequireAuth}
        authed={authed}
        currentTrip={currentTrip}
        onCommitted={onCommitted}
      />
    ) },
    { key: 'hotels', label: 'Hotels', icon: <BedDouble className={ICON_CLASS} strokeWidth={1.75} aria-hidden="true" />,
      explainer: 'Live stays with nightly prices — book a room now; a free account budgets it.',
      panel: (
      <PublicHotelSearch
        onRequireAuth={onRequireAuth}
        authed={authed}
        currentTrip={currentTrip}
        onCommitted={onCommitted}
      />
    ) },
    { key: 'transit', label: 'Getting around', icon: <Bus className={ICON_CLASS} strokeWidth={1.75} aria-hidden="true" />,
      explainer: 'Airport transfers & fast-track. Book on Viator.',
      panel: (
      <PublicTransferSearch
        onRequireAuth={onRequireAuth}
        sharedCity={sharedCity}
        sharedCountry={sharedCountry}
        searchNonce={searchNonce}
      />
    ) },
    { key: 'activities', label: 'Things to do', icon: <Compass className={ICON_CLASS} strokeWidth={1.75} aria-hidden="true" />,
      explainer: 'Real tours & experiences. Book on Viator.',
      panel: (
      <PublicActivitySearch
        onRequireAuth={onRequireAuth}
        sharedCity={sharedCity}
        sharedCountry={sharedCountry}
        searchNonce={searchNonce}
      />
    ) },
    { key: 'visa', label: 'Visa', icon: <FileCheck className={ICON_CLASS} strokeWidth={1.75} aria-hidden="true" />,
      explainer: 'The rule, how long you can stay, and the official place to apply.',
      panel: <PublicVisaCheck /> },
    // ── The three former tiles, now badged chips (explainers verbatim). ──────
    { key: 'insurance', label: 'Travel insurance', badge: SOON_BADGE, icon: <Shield className={ICON_CLASS} strokeWidth={1.75} aria-hidden="true" />, panel: (
      <ComingSoonSection
        title="Travel insurance"
        explainer="Cover your trip — medical, delays, lost bags — priced into your budget."
      />
    ) },
    { key: 'esim', label: 'Stay connected', badge: SOON_BADGE, icon: <Wifi className={ICON_CLASS} strokeWidth={1.75} aria-hidden="true" />, panel: (
      <ComingSoonSection
        title="Stay connected"
        explainer="Get data the moment you land, no hunting for a SIM."
      />
    ) },
    { key: 'events', label: 'Events', badge: SOON_BADGE, icon: <CalendarDays className={ICON_CLASS} strokeWidth={1.75} aria-hidden="true" />, panel: (
      <ComingSoonSection
        title="Events"
        explainer="Concerts, shows, and live events wherever you're headed."
      />
    ) },
  ];
}

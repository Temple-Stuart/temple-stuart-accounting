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

export function travelStripModes(opts: TravelStripOptions): ToggleMode[] {
  const { onRequireAuth, authed, currentTrip, onCommitted, sharedCity, sharedCountry, searchNonce } = opts;
  return [
    { key: 'flights', label: 'Flights', panel: (
      <PublicFlightSearch
        onRequireAuth={onRequireAuth}
        authed={authed}
        currentTrip={currentTrip}
        onCommitted={onCommitted}
      />
    ) },
    { key: 'hotels', label: 'Hotels', panel: (
      <PublicHotelSearch
        onRequireAuth={onRequireAuth}
        authed={authed}
        currentTrip={currentTrip}
        onCommitted={onCommitted}
      />
    ) },
    { key: 'transit', label: 'Getting around', panel: (
      <PublicTransferSearch
        onRequireAuth={onRequireAuth}
        sharedCity={sharedCity}
        sharedCountry={sharedCountry}
        searchNonce={searchNonce}
      />
    ) },
    { key: 'activities', label: 'Things to do', panel: (
      <PublicActivitySearch
        onRequireAuth={onRequireAuth}
        sharedCity={sharedCity}
        sharedCountry={sharedCountry}
        searchNonce={searchNonce}
      />
    ) },
    { key: 'visa', label: 'Visa', panel: <PublicVisaCheck /> },
    // ── The three former tiles, now badged chips (explainers verbatim). ──────
    { key: 'insurance', label: 'Travel insurance', badge: SOON_BADGE, panel: (
      <ComingSoonSection
        title="Travel insurance"
        explainer="Cover your trip — medical, delays, lost bags — priced into your budget."
      />
    ) },
    { key: 'esim', label: 'Stay connected', badge: SOON_BADGE, panel: (
      <ComingSoonSection
        title="Stay connected"
        explainer="Get data the moment you land, no hunting for a SIM."
      />
    ) },
    { key: 'events', label: 'Events', badge: SOON_BADGE, panel: (
      <ComingSoonSection
        title="Events"
        explainer="Concerts, shows, and live events wherever you're headed."
      />
    ) },
  ];
}

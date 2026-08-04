/**
 * TravelTilesRow (PR-LANDING-1) — the ordered coming-soon travel tiles
 * (Travel insurance, Stay connected, Events), extracted VERBATIM from the
 * three inline ModuleLauncher mounts (pre-extraction ModuleLauncher.tsx:
 * 848-859) so the guest landing and the app travel tab render the SAME row
 * from one source. Alex's ruling (2026-08-04): the guest home page carries
 * the FULL travel stack — tiles are not in-app-only; they render their honest
 * coming-soon state to guests and light up PER-TILE as affiliate IDs land
 * (the TILE-* PR arc), on both surfaces at once because both mount this one
 * component.
 *
 * Props-free + stateless BY CONSTRUCTION: ComingSoonSection is purely
 * presentational (no state, no fetch — ComingSoonSection.tsx), so this row is
 * too. The fragment wrapper adds no DOM node — the tiles stay plain siblings
 * exactly as the inline mounts were (each brings its own mt-4 via
 * TravelSectionShell).
 */

import ComingSoonSection from './ComingSoonSection';

export default function TravelTilesRow() {
  return (
    <>
      <ComingSoonSection
        title="Travel insurance"
        explainer="Cover your trip — medical, delays, lost bags — priced into your budget."
      />
      <ComingSoonSection
        title="Stay connected"
        explainer="Get data the moment you land, no hunting for a SIM."
      />
      <ComingSoonSection
        title="Events"
        explainer="Concerts, shows, and live events wherever you're headed."
      />
    </>
  );
}

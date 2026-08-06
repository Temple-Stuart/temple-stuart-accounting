'use client';

/**
 * ToggleStrip (DS-1) — the ONE-strip / N-chip / show-hide toggle, extracted
 * verbatim from LandingBookingSection (TOGGLE-1). One panel is visible at a
 * time; the rest are CSS-hidden but stay MOUNTED, so in-flight searches,
 * results, and open checkouts survive toggling (the ModuleLauncher tab-panel
 * precedent). The strip owns the ONLY view state — one `active` key; every
 * panel is built by the caller with its own props, so the same mechanism
 * serves the guest landing AND the authed app travel tab (the DS thesis).
 *
 * Chrome is codified in ds.ts: the container is DS.STRIP, the chips are
 * DS.toggleChip(active) — both byte-identical to the landing's verbatim
 * classes, so a consumer that passes the landing's modes + header renders
 * output identical to the pre-extraction LandingBookingSection.
 */

import { useState, type ReactNode } from 'react';
import { DS } from '@/lib/ds';

export interface ToggleMode {
  key: string;
  label: string;
  /** The surface shown when this chip is active. Built by the caller with its
   *  own props — all modes mount at once (CSS show/hide), so results survive. */
  panel: ReactNode;
  /** PR-ELEV-1: optional marker rendered IN-CHIP after the label (e.g. the
   *  "Soon" tag on not-yet-live modes). Caller-supplied node; the chip stays
   *  fully selectable — a soon chip opens its honest explainer panel. */
  badge?: ReactNode;
  /** PR-STRIP-DESIGN-1: optional icon (~20px lucide node). Present → this
   *  mode renders as an icon-above-label TAB (DS.iconTab); absent → the
   *  original text chip (DS.toggleChip) — existing consumers unchanged. */
  icon?: ReactNode;
  /** PR-STRIP-DESIGN-1: the Kayak-style per-mode line — ONE short sentence
   *  swapping with the active mode, rendered under the tab row in the
   *  NON-band strip only. PR-STRIP-DESIGN-4 (de-clutter ruling): the band
   *  does NOT render it — the band is headline + trust chips, nothing else;
   *  the strings stay documented on the modes and live on in their source
   *  components. */
  explainer?: string;
  /** PR-STRIP-DESIGN-2: the prominent per-mode headline (text-lg/xl white),
   *  rendered ON the band above the floating card, swapping with the active
   *  mode. Band-only — ignored without `band`. */
  headline?: string;
}

interface Props {
  modes: ToggleMode[];
  /** Optional content rendered ABOVE the chip row, inside the strip (the
   *  landing's value blurb; the app's unified search bar sits outside instead). */
  header?: ReactNode;
  /** The chip active on first render. Defaults to the first mode. */
  defaultKey?: string;
  /** Container class. Defaults to DS.STRIP. With `band`, this lands on the
   *  OUTER band div (margins only — e.g. the landing's mt-8); the floating
   *  card carries its own elevated class. */
  className?: string;
  /** PR-STRIP-DESIGN-2: the trip.com band composition — a purple gradient
   *  band (DS.BAND_BG, rounded-2xl) behind a FLOATING elevated card, with
   *  the per-mode headline swapping ON the band above the card. Off
   *  (default) → the original flat strip, byte-identical (the trade
   *  Scan/Lab/Record strip stays untouched by construction).
   *  PR-STRIP-DESIGN-3: band content CENTERS (headline bigger/bolder, tabs
   *  justify-center). PR-STRIP-DESIGN-4: the band renders EXACTLY headline +
   *  trust chips + card — no header/eyebrow/explainer layers. */
  band?: boolean;
  /** PR-STRIP-DESIGN-3: the trust-chips row (verified facts only, caller-
   *  built) — rendered centered on the band under the headline. Band-only;
   *  ignored without `band`. */
  trust?: ReactNode;
}

export default function ToggleStrip({ modes, header, defaultKey, className, band, trust }: Props) {
  const [active, setActive] = useState<string>(defaultKey ?? modes[0]?.key ?? '');
  const activeMode = modes.find((m) => m.key === active);

  // PR-STRIP-DESIGN-2: with the band, the strip content becomes a FLOATING
  // card — solid panel surface, the stronger white/20 hairline, shadow-lg
  // (all existing vocabulary; shadow-lg per the GuestLanding toast/pill
  // precedents). Without the band, exactly the original container.
  // PR-STRIP-DESIGN-3: band mode centers the tab row and moves `header`
  // onto the band (rendered above the headline, below).
  const card = (
    <div className={band ? 'rounded-lg border border-white/20 bg-panel p-4 shadow-lg' : (className ?? DS.STRIP)}>
      {!band && header}
      {/* PR-LABEL-WRAP: items-center → items-start so 1-line and 2-line tabs
          coexist off one shared icon top line (trip.com). */}
      <div className={`flex flex-wrap items-start gap-1.5${band ? ' justify-center' : ''}`}>
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setActive(m.key)}
            aria-pressed={active === m.key}
            className={m.icon ? DS.iconTab(active === m.key) : DS.toggleChip(active === m.key)}
          >
            {/* PR-STRIP-DESIGN-1: icon present → icon above label (the
                trip.com tab form factor); absent → the original chip
                content, byte-identical. PR-STRIP-DESIGN-3: the active tab's
                ICON lifts to the pop accent with the underline.
                PR-LABEL-WRAP: the label is a w-min block — min-content width
                breaks every multi-word label at its space (the trip.com
                "Tours & Activities" pattern); single-word labels render
                unchanged. The Soon badge HOISTED out of the label span to a
                sibling below it (inside w-min it became a phantom third
                line); its classes are untouched (travelStripModes
                SOON_BADGE). */}
            {m.icon ? (
              <>
                <span aria-hidden="true" className={active === m.key ? 'text-brand-purple-pop' : undefined}>
                  {m.icon}
                </span>
                <span className="w-min whitespace-normal text-center leading-tight">
                  {m.label}
                </span>
                {m.badge}
              </>
            ) : (
              <>
                {m.label}
                {m.badge}
              </>
            )}
          </button>
        ))}
      </div>

      {/* PR-STRIP-DESIGN-1: the per-mode explainer — one line, swaps with the
          active mode (the Kayak behavior). The vocabulary is the landing
          blurb's own (font-mono text-[11px] text-white/70).
          PR-STRIP-DESIGN-2: with the band it PROMOTES onto the band beneath
          the headline (below) — not rendered in-card there. */}
      {!band && activeMode?.explainer && (
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-white/70">
          {activeMode.explainer}
        </p>
      )}

      {modes.map((m) => (
        <div key={m.key} className={active === m.key ? 'block' : 'hidden'}>
          {m.panel}
        </div>
      ))}
    </div>
  );

  if (!band) return card;

  // PR-STRIP-DESIGN-2 → 3 → 4 → STRIP-FLAT-BAND → STRIP-STRADDLE: the band
  // CLOSES after the trust chips; the card is its NEXT SIBLING, not a child
  // (the trip.com straddle). A neutral root wrapper carries the mount's
  // className (e.g. the landing's mt-8) so the external contract is
  // unchanged and both mounts render identically. The band keeps the flat
  // pop fill with a pb-10/sm:pb-12 purple APRON; the card pulls up over it
  // (relative -mt-6/sm:-mt-8, full container width — flush with the band's
  // edges, purple showing only at the card's rounded top corners). Visible
  // apron between chips and card top = pb − overlap = 40−24 = 16px mobile,
  // 48−32 = 16px desktop. DOM order paints the card over the band;
  // `relative` makes it deterministic — no z-index needed (no stacking
  // context exists on the band or wrappers: no transform/filter/z-index,
  // verified this PR).
  return (
    <div className={className ?? ''}>
      {/* BAND-FAT (trip.com presence): headline 30/36 bold, taller top,
          deeper apron — visible apron = pb − overlap = 48−24 = 24px mobile,
          56−32 = 24px desktop (was 16px); the card sibling is untouched, so
          below-card clearance is unaffected. */}
      <div className="rounded-2xl pt-8 px-3 pb-12 sm:pt-10 sm:pb-14" style={{ background: DS.BAND_BG }}>
        {header}
        {activeMode?.headline && (
          <h3 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {activeMode.headline}
          </h3>
        )}
        {trust && <div className="mt-4">{trust}</div>}
      </div>
      <div className="relative -mt-6 sm:-mt-8">{card}</div>
    </div>
  );
}

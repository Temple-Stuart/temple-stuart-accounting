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
   *  swapping with the active mode. Absent → nothing renders (e.g. modes
   *  whose panel self-explains). PR-STRIP-DESIGN-2: with `band`, it renders
   *  beneath the headline ON the band; without, under the tab row as before. */
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
   *  the per-mode headline + explainer swapping ON the band above the card.
   *  Off (default) → the original flat strip, byte-identical (the trade
   *  Scan/Lab/Record strip stays untouched by construction).
   *  PR-STRIP-DESIGN-3: band content CENTERS (headline bigger/bolder, tabs
   *  justify-center) and `header` renders ON the band above the headline
   *  instead of inside the card. */
  band?: boolean;
  /** PR-STRIP-DESIGN-3: the trust-chips row (verified facts only, caller-
   *  built) — rendered centered on the band under the headline/explainer.
   *  Band-only; ignored without `band`. */
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
      <div className={`flex flex-wrap items-center gap-1.5${band ? ' justify-center' : ''}`}>
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
                ICON lifts to the pop accent with the underline. */}
            {m.icon ? (
              <>
                <span aria-hidden="true" className={active === m.key ? 'text-brand-purple-pop' : undefined}>
                  {m.icon}
                </span>
                <span>
                  {m.label}
                  {m.badge}
                </span>
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

  // PR-STRIP-DESIGN-2 → 3: the band composition, CENTERED — the caller's
  // header (eyebrow + trust anchor line) above, then the per-mode headline
  // (bigger, bolder), the promoted explainer, the trust-chips row, and the
  // floating card (whose forms stay left-aligned — they read left-to-right).
  return (
    <div className={`${className ?? ''} rounded-2xl p-4 sm:p-6`} style={{ background: DS.BAND_BG }}>
      {header}
      {activeMode?.headline && (
        <h3 className="text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {activeMode.headline}
        </h3>
      )}
      {activeMode?.explainer && (
        <p className="mt-1.5 text-center font-mono text-[11px] leading-relaxed text-white/70">
          {activeMode.explainer}
        </p>
      )}
      {trust && <div className="mt-3">{trust}</div>}
      <div className="mt-4">{card}</div>
    </div>
  );
}

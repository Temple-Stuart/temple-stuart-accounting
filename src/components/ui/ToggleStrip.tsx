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
   *  rendered under the tab row, swapping with the active mode. Absent →
   *  nothing renders (e.g. modes whose panel self-explains). */
  explainer?: string;
}

interface Props {
  modes: ToggleMode[];
  /** Optional content rendered ABOVE the chip row, inside the strip (the
   *  landing's value blurb; the app's unified search bar sits outside instead). */
  header?: ReactNode;
  /** The chip active on first render. Defaults to the first mode. */
  defaultKey?: string;
  /** Container class. Defaults to DS.STRIP; the landing passes `mt-8 ${DS.STRIP}`. */
  className?: string;
}

export default function ToggleStrip({ modes, header, defaultKey, className }: Props) {
  const [active, setActive] = useState<string>(defaultKey ?? modes[0]?.key ?? '');
  const activeMode = modes.find((m) => m.key === active);

  return (
    <div className={className ?? DS.STRIP}>
      {header}
      <div className="flex flex-wrap items-center gap-1.5">
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
                content, byte-identical. */}
            {m.icon ? (
              <>
                <span aria-hidden="true">{m.icon}</span>
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
          blurb's own (font-mono text-[11px] text-white/70). */}
      {activeMode?.explainer && (
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
}

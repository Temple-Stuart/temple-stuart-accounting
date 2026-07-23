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
            className={DS.toggleChip(active === m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {modes.map((m) => (
        <div key={m.key} className={active === m.key ? 'block' : 'hidden'}>
          {m.panel}
        </div>
      ))}
    </div>
  );
}

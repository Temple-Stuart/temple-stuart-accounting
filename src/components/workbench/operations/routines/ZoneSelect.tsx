/**
 * ZoneSelect — THE ONE ZONE PICKER (ROUTINE-02a, Alex, 2026-10-18; extracted
 * by MOVE-01, Alex, 2026-10-19 — 6 yes).
 *
 * A select over Intl's own list (rruleHelpers.ts TIME_ZONES): the viewer's
 * browser zone first, read once the component is on screen (an effect, so
 * the server render and the first paint agree), then every zone by region in
 * the list's order. A value not in the list stays visible as the first
 * option, named "<value> — not in the list, pick one" — never hidden, never
 * remapped; the route refuses it by name. An empty value with `unpickedWords`
 * shows those words as the first option (the move's "pick the new zone" —
 * no default). Nothing is stored in the browser.
 *
 * Mounted by RRULEBuilder (the routine's zone) and stops/MoveControl (the
 * new zone). The 02a pins on the builder's select moved here (routine02a).
 */

'use client';

import { useEffect, useState } from 'react';
import { TIME_ZONES, VIEWER_ZONE_WORDS, canonicalZone, unlistedZoneWords, zonesByRegion } from '@/lib/operations/rruleHelpers';

interface Props {
  readonly value: string;
  readonly onChange: (zone: string) => void;
  readonly className?: string;
  /** Shown as the first option while the value is '' — the picker has no default. */
  readonly unpickedWords?: string;
  readonly 'data-routine-timezone'?: boolean;
  readonly 'data-move-zone'?: boolean;
}

export default function ZoneSelect({ value, onChange, className, unpickedWords, ...rest }: Props) {
  // ROUTINE-02a: the viewer's zone, read once the component is on screen.
  const [viewerZone, setViewerZone] = useState<string | null>(null);
  useEffect(() => {
    setViewerZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  const zoneListed = canonicalZone(value) !== null;

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className} {...rest}>
      {!zoneListed && (value === '' && unpickedWords !== undefined
        ? <option value="" data-zone-unpicked>{unpickedWords}</option>
        : <option value={value} data-routine-timezone-unlisted>{unlistedZoneWords(value)}</option>)}
      {viewerZone !== null && TIME_ZONES.includes(viewerZone) && (
        <optgroup label={VIEWER_ZONE_WORDS} data-routine-timezone-viewer>
          <option value={viewerZone}>{viewerZone}</option>
        </optgroup>
      )}
      {zonesByRegion().map((g) => (
        <optgroup key={g.region} label={g.region}>
          {g.zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

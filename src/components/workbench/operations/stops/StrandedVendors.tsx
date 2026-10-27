/**
 * StrandedVendors — VENDOR-03 (Alex, 2026-10-27): the day's stranded vendors, under the full day card's plate.
 * It lives with the card's other writers (stops/ — StopVendor, StopForm): the day folder writes nothing (daycard01 T5).
 *
 * One line per row of the day report's plans.stranded (src/lib/operations/strandedVendors.ts — the words), each with
 * one control, "clear": Budget's own Clear (budget/VendorBox.tsx ClearVendor → clearVendor, the plan-vendors DELETE
 * at exactly the row's address, VENDOR-01's route). After a clear the card reads the report again (reload — the
 * report-reads counter, as the vendor box does); the row leaves when the report no longer lists it. A refused clear
 * prints the route's words beside it. No row → nothing renders (the card mounts this only when there is one).
 * Nothing is stored in the browser.
 */

'use client';

import type { StrandedVendor } from '@/lib/budget/planLines';
import { STRANDED_CLEAR_WORD, STRANDED_VENDORS_HEAD, strandedKeyOf, strandedVendorWords } from '@/lib/operations/strandedVendors';
import { ClearVendor } from '@/components/budget/VendorBox';
import { underStyle, useDeckBleed } from './DayDeck';

export default function StrandedVendors({ rows, reload }: { rows: readonly StrandedVendor[]; reload: () => void }) {
  // WIDTH-01 (2026-10-16): under the card, at the card's width on screen (stops/DayDeck.tsx underStyle), as everything under it.
  const bleed = useDeckBleed();
  if (rows.length === 0) return null;
  return (
    <div className="mx-auto space-y-1 text-xs" style={underStyle(bleed)} data-day-stranded>
      <p className="text-text-faint uppercase tracking-wide" data-day-stranded-head>{STRANDED_VENDORS_HEAD}</p>
      {rows.map((row) => (
        <div key={strandedKeyOf(row)} className="flex flex-wrap items-center gap-1.5" data-day-stranded-row={strandedKeyOf(row)}>
          <span className="text-brand-amber" data-day-stranded-words>{strandedVendorWords(row)}</span>
          <ClearVendor address={row.address} reload={reload} label={STRANDED_CLEAR_WORD} />
        </div>
      ))}
    </div>
  );
}

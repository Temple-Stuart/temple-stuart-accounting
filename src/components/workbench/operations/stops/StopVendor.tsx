/**
 * StopVendor — the stop's vendor, under the day card on the step view
 * (VENDOR-02, 2026-10-14).
 *
 * ROLE-01 mounted Budget's vendor box for a PLACE stop only (StopForm's
 * PlaceVendor). Alex's ruling: the box shows for EVERY stop that is a stop and
 * is priced — whatever its role — directly above the record row, labelled
 * VENDOR. What it shows is the rule's (day/dayCard.ts vendorSlot): the box on
 * the matched plan line; a place stop with no line, its one reason; anything
 * else, nothing.
 *
 * The box is Budget's own, unchanged (budget/DayPlanDrill.tsx VendorBox: pick
 * from the book's vendors, "+ add <name>", "This day" / "Every time", Change,
 * Clear), and every write goes through the two vendor routes it already calls
 * (plan-vendors, vendor-directory). After a write the box calls reload — the
 * card reads the report again; no optimistic copy. The directory is read by the
 * box's own child, mounted only when the box is shown — a reason, or nothing,
 * reads nothing. Nothing is stored in the browser.
 */

'use client';

import type { PlanLine } from '@/lib/budget/planLines';
import { VENDOR_LABEL_WORDS } from '@/lib/operations/stopRole';
import { VendorBox, useDirectory } from '@/components/budget/DayPlanDrill';
import { PLATE_WIDTH, type VendorSlot } from '../day/dayCard';

/** Budget's box on the matched line — the directory read here, so only while the box is shown. */
function Box({ line, bookName, reload }: { line: PlanLine; bookName: string; reload: () => void }) {
  const directory = useDirectory();
  return <VendorBox line={line} bookName={bookName} directory={directory} reload={reload} />;
}

export default function StopVendor({ slot, bookName, reload }: { slot: VendorSlot; bookName: string; reload: () => void }) {
  if (slot.kind === 'none') return null;
  return (
    <div className="mx-auto flex flex-wrap items-center gap-1.5 text-xs" style={{ width: PLATE_WIDTH }} data-stop-vendor>
      <span className="text-text-faint uppercase tracking-wide">{VENDOR_LABEL_WORDS}</span>
      {slot.kind === 'box'
        ? <Box line={slot.line} bookName={bookName} reload={reload} />
        : <span className="text-text-muted" data-stop-no-vendor>{slot.words}</span>}
    </div>
  );
}

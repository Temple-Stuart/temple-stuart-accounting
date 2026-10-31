import type { DayPlan, StrandedVendor } from '@/lib/budget/planLines';

/**
 * VENDOR-03 (Alex, 2026-10-27) — STRANDED VENDORS HAVE A HOME ON THE DAY CARD.
 *
 * A stranded vendor is an occurrence vendor whose instant falls on the day but matches no occurrence /budget builds
 * (src/lib/budget/planLines.ts dayPlanOf → plan.stranded, with its reason): the routine was ended, made inactive or
 * lost its money, or its schedule or zone changed. VENDOR-02 (2026-10-14) sent them to /budget, each with Clear;
 * BUDGET-02 (2026-10-20) took that list off /budget, and since then no screen showed them. Alex's ruling: the day
 * card's full-day view lists them under the plate, as a section "STRANDED VENDORS" — one line per row and one
 * control, "clear" (the plan-vendors DELETE at the row's address, VENDOR-01's route, through Budget's own writer).
 *
 * The read is the day report the card already holds (plans.stranded) — no new read. No row → no section; a failed
 * report → no section (its failure words show as today). Pure: the rows and the words; the card renders them.
 */

/** The section's head. */
export const STRANDED_VENDORS_HEAD = 'STRANDED VENDORS';
/** The one control on a row. */
export const STRANDED_CLEAR_WORD = 'clear';

/** The rows the section lists: the report's stranded vendors, or none — a report not read, or a plan not listed, lists none. */
export const strandedRowsOf = (plans: DayPlan | null): readonly StrandedVendor[] => (plans !== null && plans.listed ? plans.stranded : []);

/**
 * One row: "<vendor> — named for <label> (<line>) at <time> · <reason>". A plan with no line says its label alone; a
 * row with no time (its routine's zone cannot be read — the reason says so) says no "at".
 */
export function strandedVendorWords(row: StrandedVendor): string {
  const named = row.line === null ? row.label : `${row.label} (${row.line})`;
  const at = row.time === null ? '' : ` at ${row.time}`;
  return `${row.vendor.name} — named for ${named}${at} · ${row.reason}`;
}

/** A row's key: its address — one vendor per address (planned_item_vendors' unique key). */
export const strandedKeyOf = (row: StrandedVendor): string => `${row.address.kind}:${row.address.id}:${row.address.instant ?? 'every'}`;

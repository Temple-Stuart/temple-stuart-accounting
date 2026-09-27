/**
 * LINK-02 (2026-09-27) — A BUDGET LINE'S STATUS, FROM THE LINKS THE OWNER MADE.
 *
 * A trip's budget line (budget_line_items) is PLANNED spend. It reads:
 *   · "Saved"         — no booking is linked to it;
 *   · "Booked"        — a booking is linked, and at least one linked booking has
 *                       no accepted bank link for its charge yet;
 *   · "Booked · paid" — every linked booking has an accepted bank link for its charge.
 *
 * The links are the owner's (reservation_budget_links, written only by
 * POST /api/reservations/[id]/budget-link); "bank-confirmed" is an ACCEPTED charge
 * link a human made in Runway's match review (transaction_reservation_links,
 * status 'accepted', no money event). This leaf decides nothing else: it computes
 * no sum and compares no amounts — the planned amount and each booking's recorded
 * price are shown side by side by the screen, as recorded, never netted or converted.
 *
 * THIS FILE IS PURE: no prisma, no fetch, no clock, no React, no env, no imports.
 */

/** The three words a line's status can read — the screen types none of its own. */
export const LINE_STATUS = {
  saved: 'Saved',
  booked: 'Booked',
  paid: 'Booked · paid',
} as const;

export type LineStatus = (typeof LINE_STATUS)[keyof typeof LINE_STATUS];

/** The line, by its id. */
export interface StatusLine {
  id: string;
}

/** One owner-made link, and whether its booking's charge has an accepted bank link. */
export interface StatusLink {
  budgetLineItemId: string;
  reservationId: string;
  bankConfirmed: boolean;
}

/** The line's status from ITS links (links for other lines are ignored). */
export function lineStatusOf(line: StatusLine, links: readonly StatusLink[]): LineStatus {
  const mine = links.filter((l) => l.budgetLineItemId === line.id);
  if (mine.length === 0) return LINE_STATUS.saved;
  return mine.every((l) => l.bankConfirmed) ? LINE_STATUS.paid : LINE_STATUS.booked;
}

/** The screen's words around the status — so the page types none. */
export const LINE_WORDS = {
  bookedAs: 'Booked as',
  none: '—',
  priceNotStated: 'price not stated',
  bankConfirmed: 'bank-confirmed',
  notBankConfirmed: 'not bank-confirmed yet',
  control: 'Budget line',
  choose: 'Link to a budget line…',
  unlink: 'Unlink',
  noLines: 'this trip has no budget lines',
  noDescription: '(no description)',
  linesUnavailable: 'Budget lines unavailable:',
} as const;

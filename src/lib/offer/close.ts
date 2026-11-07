/**
 * HOME-05a (Alex, 2026-11-03) — THE 2026 CLOSE. The offer the home page makes:
 * Alex closes a customer's 2026 books. THIS FILE IS DATA AND PURE FUNCTIONS: no
 * fetch, no env, no clock, no React (the plans.ts rule). Zero imports: server- and
 * client-safe.
 *
 * ONE-FORM-01 (Alex, 2026-11-06): booked on the proposal form, not by email —
 * "incorporate bookkeeping services and done for you services ... all as one
 * proposal form ... since email is wack." The leaf's `email` and `subject` (the
 * mailto) are gone; `need` is the word the form and the proposals table hold for
 * this offer, the sixth value of proposals_need_chk
 * (prisma/migrations/20261106120000_one_form_01_close_need). The form's choice, the
 * route's enum and the home page's link all read it from here — typed once.
 *
 * HOME-PANELS-01 (Alex, 2026-11-07): PRICED BY PROPOSAL. The fixed price a month
 * (pricePerMonthUsd, 150) left the offer everywhere — the home page, the form and
 * this leaf; the price follows the customer's books (how many accounts, how many
 * transactions a month) and is set on the proposal, never typed here. The close is
 * the fifth door of the DONE-FOR-YOU panel now (src/components/landing/CloseOfferCard.tsx),
 * not its own act.
 *
 * THE SHAPE. One offer, exactly { year, bookBy, need }:
 *   · year — the books being closed;
 *   · bookBy — 'YYYY-MM-DD', the last day a new book is taken;
 *   · need — the form's word for this offer: lower-case letters, nothing else.
 * Every word the card and the form show is derived from it in
 * src/lib/offer/closeWords.ts. No Stripe price: booking is the proposal form at
 * PROPOSAL_FORM_PATH with this need picked.
 *
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts beside
 * the experiences law). It refuses by name: a bookBy not 'YYYY-MM-DD'; a year not
 * four digits, or not bookBy's year; a need that is not lower-case letters. It judges
 * no price (HOME-PANELS-01). No clock anywhere.
 */

export interface CloseOffer {
  /** The books being closed. */
  year: number;
  /** 'YYYY-MM-DD' — the last day a new book is taken. */
  bookBy: string;
  /** The proposal form's word for this offer (proposals.need). */
  need: string;
}

/** The proposal form — the one way to book (src/app/work-with-me; PUBLIC_PATHS). */
export const PROPOSAL_FORM_PATH = '/work-with-me';

export const CLOSE_OFFER: CloseOffer = {
  year: 2026,
  bookBy: '2026-12-15',
  need: 'close',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NEED = /^[a-z]+$/;

export class CloseOfferLawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloseOfferLawError';
  }
}

/** THE LAW. Throws on the first failure by default; returns the violations when asked not to throw. `offer` is injectable for tests. */
export function closeOfferLaw(opts: { throwOnFail?: boolean; offer?: CloseOffer } = {}): string[] {
  const violations: string[] = [];
  const offer = opts.offer ?? CLOSE_OFFER;
  const bookByIsDate = typeof offer.bookBy === 'string' && ISO_DATE.test(offer.bookBy);
  if (!bookByIsDate) violations.push(`close offer: bookBy "${String(offer.bookBy)}" is not YYYY-MM-DD`);
  if (!Number.isInteger(offer.year) || !/^\d{4}$/.test(String(offer.year))) {
    violations.push(`close offer: year ${String(offer.year)} is not four digits`);
  } else if (bookByIsDate && offer.bookBy.slice(0, 4) !== String(offer.year)) {
    violations.push(`close offer: year ${offer.year} is not bookBy's year (${offer.bookBy})`);
  }
  if (typeof offer.need !== 'string' || !NEED.test(offer.need)) violations.push(`close offer: need "${String(offer.need)}" is not lower-case letters`);
  if (violations.length && opts.throwOnFail !== false) throw new CloseOfferLawError(`CLOSE OFFER LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

closeOfferLaw();

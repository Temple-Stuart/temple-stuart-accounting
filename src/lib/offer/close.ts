/**
 * HOME-05a (Alex, 2026-11-03) — THE 2026 CLOSE. The offer the home page makes
 * after DONE-FOR-YOU: Alex closes a customer's 2026 books, priced per month
 * closed, booked by email. THIS FILE IS DATA AND PURE FUNCTIONS: no fetch, no
 * env, no clock, no React (the plans.ts rule). Zero imports: server- and
 * client-safe.
 *
 * THE SHAPE. One offer, exactly { year, pricePerMonthUsd, bookBy, email, subject }:
 *   · year — the books being closed;
 *   · pricePerMonthUsd — the one price, a positive whole number of dollars for
 *     each month closed (the twelve-month total is derived, never typed);
 *   · bookBy — 'YYYY-MM-DD', the last day a new book is taken;
 *   · email, subject — the one way to book: a mailto with this subject.
 * Every word the section shows is derived from it in src/lib/offer/closeWords.ts.
 * No Stripe price, no route, no form: booking is an email.
 *
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts beside
 * the experiences law). It refuses by name: a price that is not a positive
 * integer; a bookBy not 'YYYY-MM-DD'; a year not four digits, or not bookBy's
 * year; an email not name@domain.tld; an empty subject. No clock anywhere.
 */

export interface CloseOffer {
  /** The books being closed. */
  year: number;
  /** Dollars for each month closed — a positive whole number. */
  pricePerMonthUsd: number;
  /** 'YYYY-MM-DD' — the last day a new book is taken. */
  bookBy: string;
  email: string;
  /** The mailto's subject line. */
  subject: string;
}

export const CLOSE_OFFER: CloseOffer = {
  year: 2026,
  pricePerMonthUsd: 150,
  bookBy: '2026-12-15',
  email: 'astuart@templestuart.com',
  subject: '2026 close',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/;

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
  if (!Number.isInteger(offer.pricePerMonthUsd) || offer.pricePerMonthUsd <= 0) {
    violations.push(`close offer: pricePerMonthUsd ${String(offer.pricePerMonthUsd)} is not a positive integer`);
  }
  const bookByIsDate = typeof offer.bookBy === 'string' && ISO_DATE.test(offer.bookBy);
  if (!bookByIsDate) violations.push(`close offer: bookBy "${String(offer.bookBy)}" is not YYYY-MM-DD`);
  if (!Number.isInteger(offer.year) || !/^\d{4}$/.test(String(offer.year))) {
    violations.push(`close offer: year ${String(offer.year)} is not four digits`);
  } else if (bookByIsDate && offer.bookBy.slice(0, 4) !== String(offer.year)) {
    violations.push(`close offer: year ${offer.year} is not bookBy's year (${offer.bookBy})`);
  }
  if (typeof offer.email !== 'string' || !EMAIL.test(offer.email)) violations.push(`close offer: email "${String(offer.email)}" is not name@domain.tld`);
  if (typeof offer.subject !== 'string' || offer.subject.trim() === '') violations.push('close offer: subject is empty');
  if (violations.length && opts.throwOnFail !== false) throw new CloseOfferLawError(`CLOSE OFFER LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

closeOfferLaw();

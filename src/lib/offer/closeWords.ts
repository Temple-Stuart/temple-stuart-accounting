/**
 * HOME-05a (Alex, 2026-11-03) — THE WORDS the 2026 close is shown in. PURE: no
 * clock, no locale call, no fetch, no React. It reads the leaf (src/lib/offer/close.ts)
 * and the ONE dayWords in the codebase (src/lib/experienceWords.ts) — never a second
 * date formatter.
 *
 *   closeWords(offer, today)  every line the section shows, derived from the offer
 *                             and typed once, here:
 *     open (today ≤ bookBy)    the eyebrow, the h2, what it is, the price line, the
 *                              book-by line, what it is not, the remedy, and the
 *                              button's words and mailto href;
 *     closed (today > bookBy)  the eyebrow, the h2 and the one closed line — no
 *                              price, no remedy, no button.
 *   usd(n)                    "$1,800" — whole dollars, thousands grouped by a pure
 *                             formatter (no locale call).
 *
 * `today` and bookBy are 'YYYY-MM-DD', compared as strings (the calendar order). A
 * `today` of any other shape is a loud failure, never a guess at the state.
 */

import type { CloseOffer } from './close';
import { dayWords } from '../experienceWords';

export type CloseWords =
  | {
      state: 'open';
      /** The section's aria-label; the h2 is this with a full stop. */
      label: string;
      eyebrow: string;
      headline: string;
      what: string;
      price: string;
      bookBy: string;
      notTax: string;
      remedy: string;
      button: { words: string; href: string };
    }
  | { state: 'closed'; label: string; eyebrow: string; headline: string; closed: string };

export class CloseWordsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloseWordsError';
  }
}

/** Whole dollars with the thousands grouped: 150 → "$150", 1800 → "$1,800". */
export function usd(n: number): string {
  return `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function closeWords(offer: CloseOffer, today: string): CloseWords {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new CloseWordsError(`closeWords: today "${today}" is not YYYY-MM-DD`);
  const label = `Your ${offer.year} books, closed`;
  const top = { label, eyebrow: `WORK WITH ME · THE ${offer.year} CLOSE`, headline: `${label}.` };
  if (today > offer.bookBy) {
    return { state: 'closed', ...top, closed: `The ${offer.year} close stopped taking new books on ${dayWords(offer.bookBy)}.` };
  }
  return {
    state: 'open',
    ...top,
    what: `I catch up and close your ${offer.year} books: every bank and card account reconciled, every transaction categorized, and a year-end trial balance, profit and loss and balance sheet to hand to whoever files your taxes.`,
    price: `${usd(offer.pricePerMonthUsd)} for each month of ${offer.year} I close. All twelve months: ${usd(offer.pricePerMonthUsd * 12)}.`,
    bookBy: `Book by ${dayWords(offer.bookBy)}.`,
    notTax: "Bookkeeping, not tax filing or tax advice. I have six years in accounting and I'm a CPA candidate, not a licensed CPA.",
    remedy: 'If a month I closed has to be reopened because of my error, I correct it at no charge.',
    button: { words: `Email me to book: ${offer.email}`, href: `mailto:${offer.email}?subject=${encodeURIComponent(offer.subject)}` },
  };
}

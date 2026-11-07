/**
 * HOME-05a (Alex, 2026-11-03) — THE WORDS the 2026 close is shown in. PURE: no
 * clock, no locale call, no fetch, no React. It reads the leaf (src/lib/offer/close.ts)
 * and the ONE dayWords in the codebase (src/lib/experienceWords.ts) — never a second
 * date formatter.
 *
 *   closeWords(offer, today)  every line the section and the form show, derived from
 *                             the offer and typed once, here:
 *     open (today ≤ bookBy)    the eyebrow, the h2, what it is, the price line, the
 *                              book-by line, what it is not, the remedy, the button's
 *                              words and href, and — ONE-FORM-01 (Alex, 2026-11-06) —
 *                              the form's words: the choice ("Close my 2026 books") and
 *                              the done question's example;
 *     closed (today > bookBy)  the eyebrow, the h2 and the one closed line — no
 *                              price, no remedy, no button, no choice on the form.
 *   usd(n)                    "$1,800" — whole dollars, thousands grouped by a pure
 *                             formatter (no locale call).
 *
 * ONE-FORM-01: the button opens the proposal form with the close picked
 * (`/work-with-me?need=close` — PROPOSAL_FORM_PATH and offer.need, never typed) where
 * it was a mailto. The query key `need` is the form's own (WorkWithMeForm.tsx reads it
 * through src/app/work-with-me/page.tsx).
 *
 * `today` and bookBy are 'YYYY-MM-DD', compared as strings (the calendar order). A
 * `today` of any other shape is a loud failure, never a guess at the state.
 */

import { PROPOSAL_FORM_PATH, type CloseOffer } from './close';
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
      /** The proposal form's chip for this offer. */
      choice: string;
      /** The form's example answer to "what does done look like?" when the close is picked. */
      done: string;
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

/** The form, with this offer's choice picked: `/work-with-me?need=close`. */
export function closeFormHref(offer: CloseOffer): string {
  return `${PROPOSAL_FORM_PATH}?need=${encodeURIComponent(offer.need)}`;
}

/**
 * CRM-01a (Alex, 2026-11-07, ruling 6): the form's chip for this offer, on any day — a proposal that asked for the close
 * keeps its words after bookBy (the CRM prints them); closeWords' open state reads it, typed once here.
 */
export function closeChoiceWords(offer: CloseOffer): string {
  return `Close my ${offer.year} books`;
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
    button: { words: `Book the ${offer.year} close →`, href: closeFormHref(offer) },
    choice: closeChoiceWords(offer),
    done: `e.g. Every month of ${offer.year} closed, and the year-end statements with my tax preparer by the end of January.`,
  };
}

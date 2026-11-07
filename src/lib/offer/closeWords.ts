/**
 * HOME-05a (Alex, 2026-11-03) — THE WORDS the 2026 close is shown in. PURE: no
 * clock, no locale call, no fetch, no React. It reads the leaf (src/lib/offer/close.ts)
 * and the ONE dayWords in the codebase (src/lib/experienceWords.ts) — never a second
 * date formatter.
 *
 *   closeWords(offer, today)  every line the card and the form show, derived from the
 *                             offer and typed once, here:
 *     open (today ≤ bookBy)    the chip, the card's title (label), what it is, the
 *                              priced line, the book-by line, what it is not, the
 *                              remedy, and — ONE-FORM-01 (Alex, 2026-11-06) — the
 *                              form's words: the choice ("Close my 2026 books") and
 *                              the done question's example;
 *     closed (today > bookBy)  the chip, the title and the one closed line — no
 *                              priced line, no remedy, no choice on the form.
 *   closeFormHref(offer)      the form with the close picked — the card's href.
 *   closeChoiceWords(offer)   the form's chip for this offer, on any day.
 *
 * HOME-PANELS-01 (Alex, 2026-11-07): PRICED BY PROPOSAL — the price line and its
 * dollar formatter (usd) retired with the fixed price; `priced` is one sentence
 * saying the price follows the customer's books. The close is a card inside the
 * DONE-FOR-YOU panel now, so the act's eyebrow, h2 and button retired with the
 * act: `chip` ("THE 2026 CLOSE") is worn above the card, and the card itself is the
 * door (closeFormHref) — the panel's one button covers it.
 *
 * ONE-FORM-01: the door opens the proposal form with the close picked
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
      /** The card's title. */
      label: string;
      /** The chip above the card: "THE 2026 CLOSE". */
      chip: string;
      what: string;
      /** Priced by proposal — one sentence; no figure. */
      priced: string;
      bookBy: string;
      notTax: string;
      remedy: string;
      /** The proposal form's chip for this offer. */
      choice: string;
      /** The form's example answer to "what does done look like?" when the close is picked. */
      done: string;
    }
  | { state: 'closed'; label: string; chip: string; closed: string };

export class CloseWordsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloseWordsError';
  }
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
  const top = { label, chip: `THE ${offer.year} CLOSE` };
  if (today > offer.bookBy) {
    return { state: 'closed', ...top, closed: `The ${offer.year} close stopped taking new books on ${dayWords(offer.bookBy)}.` };
  }
  return {
    state: 'open',
    ...top,
    what: `I catch up and close your ${offer.year} books: every bank and card account reconciled, every transaction categorized, and a year-end trial balance, profit and loss and balance sheet to hand to whoever files your taxes.`,
    priced: 'Priced by proposal — the price follows your books: how many accounts, how many transactions a month.',
    bookBy: `Book by ${dayWords(offer.bookBy)}.`,
    notTax: "Bookkeeping, not tax filing or tax advice. I have six years in accounting and I'm a CPA candidate, not a licensed CPA.",
    remedy: 'If a month I closed has to be reopened because of my error, I correct it at no charge.',
    choice: closeChoiceWords(offer),
    done: `e.g. Every month of ${offer.year} closed, and the year-end statements with my tax preparer by the end of January.`,
  };
}

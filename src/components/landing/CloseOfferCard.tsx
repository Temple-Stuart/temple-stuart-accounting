'use client';

/**
 * CloseOfferCard (HOME-PANELS-01, Alex, 2026-11-07) — THE 2026 CLOSE as the FIFTH DOOR of
 * the DONE-FOR-YOU panel on the guest landing (Landing.tsx), under the four service
 * cards and above the panel's one button; PRICED BY PROPOSAL. It was its own act
 * (HOME-05a, 2026-11-03: CloseOfferSection.tsx — an eyebrow, an h2, a card with a fixed
 * price and its own button); the act, the price and the button are gone. ONE-FORM-01
 * (Alex, 2026-11-06): booked on the proposal form — the card itself is a door to
 * /work-with-me with the close picked (closeFormHref), like the four doors above it.
 * 'use client' only because Landing.tsx is one; this file holds no state and no effect.
 *
 * WHAT IT RENDERS — every word from closeWords(offer, today)
 * (src/lib/offer/closeWords.ts over src/lib/offer/close.ts), none typed here:
 *   open    the chip ("THE 2026 CLOSE", the PROFESSIONAL SERVICES chip's class), then ONE
 *           card that is a Link at least 44px tall (data-done-for-you="close", the
 *           service cards' class): the title in the service cards' title class, what it
 *           is, the priced line (a sentence — no figure), the book-by line, what it is
 *           not (the same type size as what it is), the remedy;
 *   closed  the chip, then a plain card — the title and the one closed line; no priced
 *           line, no link.
 * The anchor id="close" (CLOSE_ANCHOR) sits on the card in both states; nothing in src
 * links to it today.
 *
 * THE DAY RULE: `today` is the UTC calendar date src/app/page.tsx computed ONCE and
 * Landing passes down (EVENTS-01's chain); nothing here reads the clock. PAINT: the
 * DONE-FOR-YOU card's own idiom — its chip, its door cards and their title — house
 * tokens only, zero new hex. Nothing scrolls sideways.
 */

import Link from 'next/link';
import { CLOSE_OFFER, type CloseOffer } from '@/lib/offer/close';
import { closeFormHref, closeWords } from '@/lib/offer/closeWords';

/** The card's anchor. */
export const CLOSE_ANCHOR = 'close';

// THE CLASS GRAMMAR — one const, every string whole, house tokens only (the DONE-FOR-YOU card's).
const CLOSE = {
  /** The block under the services grid: the chip, then the card. */
  block: 'mt-4',
  /** The PROFESSIONAL SERVICES chip's class. */
  chip: 'rounded border border-border px-2 py-0.5 font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-secondary',
  /** The door — the service cards' class, at least 44px tall, full width. */
  door: 'mt-2 block min-h-[44px] rounded-lg border border-border bg-white p-4 text-text-primary hover:bg-brand-purple-wash',
  /** Closed: the same card, not a door. */
  closedCard: 'mt-2 min-h-[44px] rounded-lg border border-border bg-white p-4 text-text-primary',
  /** The service cards' title class. */
  title: 'text-sm font-medium',
  // What it is and what it is not share one type size (text-sm).
  what: 'mt-2 text-sm leading-relaxed text-text-primary',
  /** The what class with the price line's mt-4 (the notTax class verbatim): a sentence at the body size, no figure. */
  priced: 'mt-4 text-sm leading-relaxed text-text-primary',
  bookBy: 'mt-1 font-mono text-xs text-text-secondary',
  notTax: 'mt-4 text-sm leading-relaxed text-text-primary',
  remedy: 'mt-2 text-sm leading-relaxed text-text-secondary',
  closed: 'mt-2 text-sm leading-relaxed text-text-primary',
} as const;

/** The pure half: props in, markup out — the tests render it. */
export function CloseOfferCard({ offer, today }: { offer: CloseOffer; today: string }) {
  const w = closeWords(offer, today);
  return (
    <div className={CLOSE.block} data-close-block>
      <span className={CLOSE.chip} data-close-chip>{w.chip}</span>
      {w.state === 'open' ? (
        <Link id={CLOSE_ANCHOR} href={closeFormHref(offer)} className={CLOSE.door} data-done-for-you={offer.need} data-close="open">
          <div className={CLOSE.title} data-close-title>{w.label}</div>
          <p className={CLOSE.what} data-close-what>{w.what}</p>
          <p className={CLOSE.priced} data-close-priced>{w.priced}</p>
          <p className={CLOSE.bookBy} data-close-book-by>{w.bookBy}</p>
          <p className={CLOSE.notTax} data-close-not>{w.notTax}</p>
          <p className={CLOSE.remedy} data-close-remedy>{w.remedy}</p>
        </Link>
      ) : (
        <div id={CLOSE_ANCHOR} className={CLOSE.closedCard} data-close="closed">
          <div className={CLOSE.title} data-close-title>{w.label}</div>
          <p className={CLOSE.closed} data-close-closed>{w.closed}</p>
        </div>
      )}
    </div>
  );
}

/** The mount Landing takes: the ruled offer, the day Landing was handed. */
export default function CloseOfferMount({ today }: { today: string }) {
  return <CloseOfferCard offer={CLOSE_OFFER} today={today} />;
}

'use client';

/**
 * CloseOfferSection (HOME-05a, Alex, 2026-11-03) — THE CLOSE, on the guest landing
 * directly after the DONE-FOR-YOU act (Landing.tsx): the 2026 close offer, booked by
 * email. 'use client' only because Landing.tsx is one; this file holds no state and
 * no effect.
 *
 * WHAT IT RENDERS — every word from closeWords(CLOSE_OFFER, today)
 * (src/lib/offer/closeWords.ts over src/lib/offer/close.ts), none typed here:
 *   open    the eyebrow and the h2; then one white card — what it is, the price
 *           line, the book-by line, what it is not (the same type size as what it
 *           is), the remedy, and ONE button-styled mailto link at least 44px tall;
 *   closed  the eyebrow, the h2 and the one closed line — no price, no remedy, no
 *           button.
 *
 * THE DAY RULE: `today` is the UTC calendar date src/app/page.tsx computed ONCE and
 * Landing passes down (EVENTS-01's chain); nothing here reads the clock. PAINT: the
 * DONE-FOR-YOU act's idiom — the cream act with its own border-b, the eyebrow in the
 * mono faint voice, the h2 class for class, a white card — house tokens only, zero
 * new hex. Nothing scrolls sideways: the button's words wrap.
 */

import { CLOSE_OFFER, type CloseOffer } from '@/lib/offer/close';
import { closeWords } from '@/lib/offer/closeWords';

/** The act's anchor. */
export const CLOSE_ANCHOR = 'close';

// THE CLASS GRAMMAR — one const, every string whole, house tokens only (the DONE-FOR-YOU act's).
const CLOSE = {
  act: 'w-full border-b border-border bg-bg-terminal',
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 py-10',
  eyebrow: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  h2: 'mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple',
  card: 'mt-4 rounded-lg border border-border bg-white p-5',
  // What it is and what it is not share one type size (text-sm).
  what: 'text-sm leading-relaxed text-text-primary',
  price: 'mt-4 text-base font-semibold text-text-primary',
  bookBy: 'mt-1 font-mono text-xs text-text-secondary',
  notTax: 'mt-4 text-sm leading-relaxed text-text-primary',
  remedy: 'mt-2 text-sm leading-relaxed text-text-secondary',
  button: 'mt-5 inline-flex min-h-[44px] max-w-full items-center break-words border border-brand-purple/40 px-5 py-2 text-left text-sm font-medium text-brand-purple hover:bg-brand-purple-wash',
  closed: 'mt-4 text-sm leading-relaxed text-text-primary',
} as const;

/** The pure half: props in, markup out — the tests render it. */
export function CloseOfferView({ offer, today }: { offer: CloseOffer; today: string }) {
  const w = closeWords(offer, today);
  return (
    <section id={CLOSE_ANCHOR} aria-label={w.label} className={CLOSE.act} data-close={w.state}>
      <div className={CLOSE.inner}>
        <p className={CLOSE.eyebrow}>{w.eyebrow}</p>
        <h2 className={CLOSE.h2}>{w.headline}</h2>
        {w.state === 'open' ? (
          <div className={CLOSE.card}>
            <p className={CLOSE.what} data-close-what>{w.what}</p>
            <p className={CLOSE.price} data-close-price>{w.price}</p>
            <p className={CLOSE.bookBy} data-close-book-by>{w.bookBy}</p>
            <p className={CLOSE.notTax} data-close-not>{w.notTax}</p>
            <p className={CLOSE.remedy} data-close-remedy>{w.remedy}</p>
            <a href={w.button.href} className={CLOSE.button} data-close-book>{w.button.words}</a>
          </div>
        ) : (
          <p className={CLOSE.closed} data-close-closed>{w.closed}</p>
        )}
      </div>
    </section>
  );
}

export default function CloseOfferSection({ today }: { today: string }) {
  return <CloseOfferView offer={CLOSE_OFFER} today={today} />;
}

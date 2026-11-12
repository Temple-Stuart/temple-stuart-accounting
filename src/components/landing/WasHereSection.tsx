'use client';

/**
 * WasHereSection (WASHERE-01, Alex, 2026-10-31) — MY TRIP, the trip log: Our Story, the guest landing's last act (Landing.tsx
 * mounts it after About Us). Every stop of the trip is a card, in trip order, in ONE row that scrolls sideways.
 *
 * THE RULINGS IT STANDS ON, oldest first — each stands unless a later one says otherwise:
 *   · WASHERE-01…04 (2026-10-31 → 11-03): Alex's own stops, read in trip order (WASHERE-03); privacy (WASHERE-04).
 *   · TRIPPOST-01 (Alex, 2026-11-05): every stop opens its own page, /my-trip/<id> (src/app/my-trip/[id]).
 *   · TRIPCARDS-01 (Alex, 2026-11-05): "all i care to show on the card is destination, stay / bike / and flight in" — a card is
 *     the stop and what it cost, and the door to its page; everything else a stop holds (its post, Alex's line, the event it was
 *     around, DID and LEARNED, what was on, the booking button) lives on that page (src/components/trip/TripPostView.tsx). No
 *     empty photo box while a stop has no photo. (2026-11-06): "horizontal scroll cards rather than horizontal on screen and
 *     vertical stack what doesn't fit" — one row, each card one width, snapping to its start; only the row scrolls sideways.
 *   · TRIPCARDS-02 (Alex, 2026-11-08): the trip.com look — a dark card, its photo cut to 320px, the stop chip and a dark band
 *     drawn over the photo. IT LEFT WITH TRIPCARDS-03.
 *
 * TRIPCARDS-03 (Alex's brief, 2026-11-12 21:08 Manila; the board approved on the design canvas at 21:21) — THE STOP CARDS, AS
 * DRAWN. His brief, 21:08 Manila: "so these cards (a) dont follow the new asthetics of the page, and also when we made these, it
 * like cuts out parts of my photos and for example the sunset pic in bali, its cutting out surfers in the sunset which were a big
 * part of the image... (b) like how the other cards had the issue, the data just looks like kinda crammed and messy and shanty on
 * the card now...." His approval, 21:21 Manila: "omg yesssssssss that is fucking sexy, our story, yassss yassss yasssss! give me
 * the prmpt to turn this real!"
 * THE SPEC IS design-refs/tripcards-03/Section-Reference.html — "Every value in its stylesheet is the design, and its markup is the
 * page as it opens on 2026-11-12" — with its README beside it. This file draws that markup; the stylesheet is the reference's,
 * ported to src/app/globals.css behind the house prefix (.story → .ts-story). Top to bottom:
 *   · THE HEAD, in the page container: MY TRIP (the eyebrow, gold mono), Our Story (violet, at the pillars' size), the line; from
 *     768px, two round arrows on the right.
 *   · THE ROW, outside the page container — the full width of the section, its padding standing the first card under the heading.
 *     It snaps to a card's start when it comes to rest near one (proximity). No scrollbar is drawn.
 *   · A CARD: white. Its photo WHOLE at 3 : 2, with nothing drawn on it (every photo is 3 : 2 within 1% — the build reads each
 *     one's header and refuses one that is not: src/lib/photoSize.ts), opening the stop's page out of the tab order. The stop line:
 *     "Stop n", its chip — I'M HERE filled with a dot, COMING UP outlined, none once he has left (src/lib/wasHereWords.ts
 *     stopStatus, stopLabel) — and the photo's credit at its right. The city, the country, the dates. At its foot, the three
 *     costs — each amount painted by its line's kind, carried beside the words (paid in gold; none and unknown muted) — then Read
 *     the post →, the quiet pill. The stop he is at wears a violet ring. A stop with no photo yet has no image and no box: its
 *     place, at 30px, opens the card.
 *
 * TWO RULINGS REVERSE WITH THE APPROVED BOARD:
 *   · Read the post → leaves PRIMARY_CTA (src/lib/ds.ts), the public page's filled purple button, for the quiet pill. HOME-FINISH-01
 *     had put it there (Alex, 2026-11-08: "same thing on blog read the post button.... should be consistent, like lookup, purple").
 *   · The heading leaves HOME-FINISH-02's gold (Alex's brief, 2026-11-10 20:56: a section heading, in gold and one size up) for
 *     violet at the pillars' size, as the board draws it.
 *
 * THE ROW AT WORK (the README, "The row: arrows and keyboard"). The arrows, "Earlier stops" and "Later stops", each name the row
 * in aria-controls and move it by one card (a card's width and the gap) — smoothly, or at once under prefers-reduced-motion. At
 * either end an arrow says it can go no further, aria-disabled="true" (so it keeps the focus), updated on every scroll and every
 * resize. A card the keyboard reaches comes into view whole: standing past either edge of the row, it moves to the row's start, a
 * snap point. The keyboard meets the two arrows, then each card's Read the post →, in trip order; the photos are skipped.
 * STATE: the row's scroll position is the browser's. The two ends the arrows show are React state DERIVED from it on every scroll
 * and every resize — before the first measure, the reference's own markup (back at its end, forward not: the page as it opens).
 * Nothing is stored: no storage, no URL, no cookie.
 *
 * WORDS: every word is read from its home and the JSX types none — the section's own (the eyebrow, the line, Read the post →, and
 * the arrows' two, new with TRIPCARDS-03) as the constants below; the heading from src/lib/homeActWords.ts; a stop's from
 * src/lib/wasHere.ts through src/lib/wasHereWords.ts; what it cost from src/lib/tripCosts.ts through src/lib/tripPostWords.ts.
 * "My trip" is the act's aria-label, a hook, typed where it stands. THE DAY RULE: `today` is the UTC calendar date src/app/page.tsx
 * computed ONCE and passed down; nothing here reads the clock. PAINT: the port's classes only — no hex, no colour typed here. No
 * emoji, no countdown, no urgency words.
 */

import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import { WAS_HERE, type WasHereRow } from '@/lib/wasHere';
import { stayWords, stopLabel, stopStatus, stopWords, tripOrder } from '@/lib/wasHereWords';
// TRIPCARDS-01: what each stop cost — the stay, the motorbike, the flight in.
import { TRIP_COSTS, type TripCosts } from '@/lib/tripCosts';
import { stopCostRows, tripPostHref } from '@/lib/tripPostWords';

/** The act's anchor. FOOTER-01 (2026-11-09): its one home is src/lib/homeAnchors.ts — imported back here, still exported from here. */
import { MY_TRIP_ANCHOR } from '@/lib/homeAnchors';
import { OUR_STORY_HEADING } from '@/lib/homeActWords';
export { MY_TRIP_ANCHOR };
export const MY_TRIP_EYEBROW = 'MY TRIP';
export const MY_TRIP_HEADLINE = OUR_STORY_HEADING; // HOME-ORDER-01 (Alex, 2026-11-10): the heading's words, from src/lib/homeActWords.ts — "Where I've been, and where I'm going." stood here until then
export const MY_TRIP_LINE = "Stop by stop, dated, with the whole story where I've written it up.";
/** TRIPPOST-01: the card's link to its stop's page. */
export const READ_THE_POST = 'Read the post →';
/** TRIPCARDS-03 (2026-11-12): the arrows' words, each its button's aria-label — new with the board; their home is here, beside READ_THE_POST (the README's proposal). */
export const EARLIER_STOPS = 'Earlier stops';
export const LATER_STOPS = 'Later stops';
/** TRIPCARDS-03: the row's id — the one both arrows name in aria-controls (the reference's own). */
export const STORY_ROW_ID = 'story-row';

// THE CLASS GRAMMAR — one const, every class the port's (src/app/globals.css, the TRIPCARDS-03 block). TRIPCARDS-03 kept the keys
// that still fit and added the board's parts; TRIPCARDS-02's figure, photoLink, image, band, top, stopStatic and costValue left with
// the dark card.
const TRIP = {
  act: 'ts-story',
  inner: 'ts-story__inner',
  head: 'ts-story__head',
  words: 'ts-story__words',
  eyebrow: 'ts-story__eyebrow',
  h2: 'ts-story__title', // TRIPCARDS-03 (Alex, 2026-11-12 21:21, the approved board): violet at the pillars' size — HOME-FINISH-02's gold reversed ('mt-3 text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold' from 2026-11-10 20:56 until then)
  sub: 'ts-story__lede',
  arrows: 'ts-story__arrows',
  arrow: 'ts-story-arrow',
  // TRIPCARDS-01 (2026-11-06): one row that scrolls sideways. TRIPCARDS-03: outside the page container, its scrollbar hidden.
  list: 'ts-story-row',
  card: 'ts-story-card',
  // TRIPCARDS-03: the photo's frame is its link — 3 : 2, the photo whole, nothing on it.
  photo: 'ts-story-card__photo',
  body: 'ts-story-card__body',
  meta: 'ts-story-card__meta',
  stop: 'ts-story-card__stop',
  label: 'ts-story-chip',
  dot: 'ts-story-chip__dot',
  credit: 'ts-story-card__credit',
  place: 'ts-story-card__city',
  country: 'ts-story-card__country',
  stay: 'ts-story-card__dates',
  foot: 'ts-story-card__foot',
  // TRIPCARDS-01: what it cost — the label, the name (ending in "…" when long, its whole words in its title), the amount, never cut.
  costs: 'ts-story-costs',
  cost: 'ts-story-cost',
  costLabel: 'ts-story-cost__what',
  costName: 'ts-story-cost__name',
  costAmount: 'ts-story-cost__amount',
  // TRIPCARDS-03 (the approved board): Read the post → is the quiet pill — HOME-FINISH-01's PRIMARY_CTA (src/lib/ds.ts) reversed.
  link: 'ts-story-card__post',
} as const;

/** TRIPCARDS-03: where the row stands — at its start, back can go no further; at its end, forward can go no further. A pixel's slack, as the reference's script allows. */
export interface RowEnds {
  readonly start: boolean;
  readonly end: boolean;
}
export function rowEnds(scrollLeft: number, clientWidth: number, scrollWidth: number): RowEnds {
  return { start: scrollLeft <= 1, end: scrollLeft + clientWidth >= scrollWidth - 1 };
}
/** The page as it opens — the reference's own markup: the row at its start, so back at its end and forward not. The row is measured as soon as it is in the page. */
export const ROW_AS_IT_OPENS: RowEnds = { start: true, end: false };
/** TRIPCARDS-03: a card standing past either edge of the row (half a pixel's slack, as the reference's script allows) is brought into view whole. */
export function cardCut(card: { readonly left: number; readonly right: number }, row: { readonly left: number; readonly right: number }): boolean {
  return card.left < row.left - 0.5 || card.right > row.right + 0.5;
}
/** Smoothly — or at once, when the reader asks for less motion. */
const motion = (): ScrollBehavior => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
/** The row, when an effect or a handler runs — it is in the page by then; a missing row is a bug, and says so. */
function theRow(ref: { readonly current: HTMLDivElement | null }): HTMLDivElement {
  if (ref.current === null) throw new Error('was here: the row is not in the page');
  return ref.current;
}

/** TRIPCARDS-01: the stop's costs, or a loud failure — never a card without them; the registry law refuses a stop with no costs row at build. */
function costsFor(costs: readonly TripCosts[], id: string): TripCosts {
  const found = costs.find((c) => c.stopId === id);
  if (!found) throw new Error(`was here: "${id}" has no costs row (src/lib/tripCosts.ts)`);
  return found;
}

/** TRIPCARDS-01: what the stop cost — Stay, Motorbike, Flight in: the label, the name (or nothing), the amount (or n/a, or not in my log yet) — TRIPCARDS-03: the amount carries its line's kind. */
function Costs({ costs }: { costs: TripCosts }) {
  return (
    <dl className={TRIP.costs} data-was-here-costs={costs.stopId}>
      {stopCostRows(costs).map((c) => (
        <div key={c.what} className={TRIP.cost} data-was-here-cost={c.what}>
          <dt className={TRIP.costLabel}>{c.what}</dt>
          <dd className={TRIP.costName} title={c.detail === '' ? undefined : c.detail}>{c.detail}</dd>
          <dd className={TRIP.costAmount} data-kind={c.kind}>{c.amount}</dd>
        </div>
      ))}
    </dl>
  );
}

function Entry({ row, costs, stop, today }: { row: WasHereRow; costs: TripCosts; stop: number; today: string }) {
  const status = stopStatus(row, today);
  const label = stopLabel(row, today);
  const href = tripPostHref(row.id);
  return (
    <article className={TRIP.card} data-was-here={row.id} data-was-here-image={row.image === null ? 'none' : 'photo'} data-stop-status={status}>
      {row.image !== null && (
        // TRIPCARDS-01: the photo opens the stop's page too — out of the tab order; "Read the post" is the link a keyboard meets.
        <a href={href} tabIndex={-1} aria-hidden="true" className={TRIP.photo}>
          {/* A plain <img>, the Built-on wall's precedent (BuiltOnStrip.tsx REAL-MARKS — re-cited BUILTON-01, 2026-11-09: was Landing.tsx): a file under
              public/, served as-is, no optimizer and no remote loader. TRIPCARDS-03: no class — the port frames it at 3 : 2. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.image.src} alt={row.image.alt} loading="lazy" />
        </a>
      )}
      <div className={TRIP.body}>
        <div className={TRIP.meta}>
          <p className={TRIP.stop} data-was-here-stop={stop}>
            <span>{stopWords(stop)}</span>
            {label !== null && (
              <span className={TRIP.label} data-status={status} data-was-here-label>
                {status === 'now' && <span className={TRIP.dot} aria-hidden="true" />}
                {label}
              </span>
            )}
          </p>
          {row.image !== null && <span className={TRIP.credit}>{row.image.credit}</span>}
        </div>
        <h3 className={TRIP.place}>{row.city}</h3>
        <p className={TRIP.country}>{row.country}</p>
        <p className={TRIP.stay} data-was-here-stay>{stayWords(row)}</p>
        <div className={TRIP.foot}>
          <Costs costs={costs} />
          <a href={href} className={TRIP.link} data-was-here-post-link>{READ_THE_POST}</a>
        </div>
      </div>
    </article>
  );
}

/** Props in, markup out — the tests render it, at rest; in the page, the row's two ends follow its scroll position. */
export function WasHereView({ rows, costs, today }: { rows: readonly WasHereRow[]; costs: readonly TripCosts[]; today: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState<RowEnds>(ROW_AS_IT_OPENS);
  const settle = useCallback((row: HTMLElement): void => {
    const now = rowEnds(row.scrollLeft, row.clientWidth, row.scrollWidth);
    setEnds((was) => (was.start === now.start && was.end === now.end ? was : now));
  }, []);
  // On mount and on every resize; every scroll is the row's own onScroll, below.
  useEffect(() => {
    const row = theRow(rowRef);
    const onResize = (): void => settle(row);
    settle(row);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [settle]);
  /** One card, either way: a card's width and the gap. */
  const step = (direction: -1 | 1): void => {
    const row = theRow(rowRef);
    const card = row.firstElementChild;
    if (card === null) throw new Error('was here: the row holds no card');
    row.scrollBy({ left: direction * (card.getBoundingClientRect().width + parseFloat(getComputedStyle(row).columnGap)), behavior: motion() });
  };
  const bringIntoView = (event: FocusEvent<HTMLDivElement>): void => {
    const card = event.target.closest('[data-was-here]');
    if (card === null) return;
    if (cardCut(card.getBoundingClientRect(), event.currentTarget.getBoundingClientRect())) card.scrollIntoView({ block: 'nearest', inline: 'start', behavior: motion() });
  };
  return (
    <section id={MY_TRIP_ANCHOR} aria-label="My trip" className={TRIP.act} data-my-trip>
      <div className={TRIP.inner}>
        <div className={TRIP.head}>
          <div className={TRIP.words}>
            <p className={TRIP.eyebrow}>{MY_TRIP_EYEBROW}</p>
            <h2 className={TRIP.h2}>{MY_TRIP_HEADLINE}</h2>
            <p className={TRIP.sub}>{MY_TRIP_LINE}</p>
          </div>
          <div className={TRIP.arrows}>
            <button className={TRIP.arrow} type="button" aria-label={EARLIER_STOPS} aria-controls={STORY_ROW_ID} aria-disabled={ends.start} onClick={() => { if (!ends.start) step(-1); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button className={TRIP.arrow} type="button" aria-label={LATER_STOPS} aria-controls={STORY_ROW_ID} aria-disabled={ends.end} onClick={() => { if (!ends.end) step(1); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>
      <div ref={rowRef} className={TRIP.list} id={STORY_ROW_ID} data-was-here-rail onScroll={(event) => settle(event.currentTarget)} onFocus={bringIntoView}>
        {tripOrder(rows).map((row, i) => <Entry key={row.id} row={row} costs={costsFor(costs, row.id)} stop={i + 1} today={today} />)}
      </div>
    </section>
  );
}

export default function WasHereSection({ today }: { today: string }) {
  return <WasHereView rows={WAS_HERE} costs={TRIP_COSTS} today={today} />;
}

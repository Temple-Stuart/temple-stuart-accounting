'use client';

/**
 * WasHereSection (WASHERE-01, Alex, 2026-10-31) — MY TRIP, the trip log, on the
 * guest landing directly after the experiences (Landing.tsx). 'use client' only
 * because Landing.tsx is one; this file holds no state and no effect.
 *
 * WHY. The "I'm into…" filter serves the reader; "I was here" is Alex's own trip.
 * The card that EVENTS-01 featured inside the experiences left that section and is
 * an entry here — an act built to take many entries and a photo each as Alex adds
 * them. WASHERE-03: the log reads in trip order. WASHERE-04 (Alex, 2026-11-03):
 * privacy. TRIPPOST-01 (Alex, 2026-11-05): a stop opens its own page (/my-trip/<id>,
 * src/app/my-trip/[id]). TRIPCARDS-01 (Alex, 2026-11-06): the cards sit in ONE row that
 * scrolls sideways — "horizontal scroll cards rather than horizontal on screen and vertical
 * stack what doesn't fit" — each card one fixed width, snapping to its start; the row runs to
 * the act's edges and the page itself never scrolls sideways. The row's scrollbar is drawn
 * (a thin lavender thumb) so a mouse sees there is more; keys reach every card through its
 * links, and the browser scrolls each into view.
 *
 * TRIPCARDS-01 (Alex, 2026-11-05): "all i care to show on the card is destination, stay / bike /
 * and flight in". Every card is that and the door to its stop's page — the stops he has booked
 * ahead included. Everything else a stop holds (its post, Alex's line, the event it was around,
 * DID and LEARNED, what was on, the booking button) lives on that page
 * (src/components/trip/TripPostView.tsx).
 *
 * WHAT IT RENDERS — every word of a stop from src/lib/wasHere.ts through
 * src/lib/wasHereWords.ts, what it cost from src/lib/tripCosts.ts through
 * src/lib/tripPostWords.ts, never typed here:
 *   the eyebrow, the h2, the line (each typed once below; Alex rewrites the copy
 *   later); then tripOrder(WAS_HERE), each a card, in this order:
 *     · the image when present, linking the stop's page out of the tab order — and NO <img>,
 *       NO placeholder box while null. TRIPCARDS-02 (Alex, 2026-11-08): the trip.com look drawn on
 *       the canvas — the photo tall (one h-80 block), the stop chip on it, the place and the dates
 *       on a dark band across its foot, the credit on that band's right; with no photo, the chip,
 *       the place and the dates open the card. The same parts in the same order as TRIPCARDS-01d;
 *     · the stop number, derived from the order ("Stop 1", "Stop 2" …) — TRIPCARDS-01d (Alex,
 *       2026-11-06): on top of the place, under the photo credit in the DOM (TRIPCARDS-02 draws the
 *       credit on the band and the stop as a chip on the photo) — and on the same line the
 *       label from the server's day: I'M HERE while he is there, COMING UP before; none once he
 *       has left (Alex: lose "I was here");
 *     · city, country; the stay — "Since <day>" or the window's dateWords;
 *     · what it cost — Stay, Motorbike, Flight in: the name and the amount, "n/a" for none,
 *       "not in my log yet" for a figure he hasn't logged (tripPostWords.ts stopCostRows). One
 *       line each: a name too long for the card's width ends in "…" (the whole name in its
 *       title and on the stop's page), and the amount is never cut;
 *     · "Read the post →" to the stop's page — every stop.
 *
 * THE DAY RULE: `today` is the UTC calendar date src/app/page.tsx computed ONCE and
 * passed down; nothing here reads the clock. PAINT: house tokens only, zero new hex
 * — the cream act with dark cards (TRIPCARDS-02: bg-text-primary, the band solid because the
 * token carries no alpha; the words on them white, as PRIMARY_CTA's ink), the eyebrow in the
 * mono faint voice. One row of cards; only the row scrolls sideways.
 * No emoji, no countdown, no urgency words.
 */

import { PRIMARY_CTA } from '@/lib/ds';
import { WAS_HERE, type WasHereRow } from '@/lib/wasHere';
import { stayWords, stopLabel, stopWords, tripOrder } from '@/lib/wasHereWords';
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

// THE CLASS GRAMMAR — one const, every string whole, house tokens only (and white for the words on the dark card, TRIPCARDS-02).
const TRIP = {
  act: 'w-full border-b border-border bg-bg-terminal',
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 py-10',
  eyebrow: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  h2: 'mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple',
  sub: 'mt-2 text-sm text-text-secondary',
  // TRIPCARDS-01 (2026-11-06): one row that scrolls sideways, edge to edge of the act's box —
  // the negative margin meets the inner padding, so the page never scrolls; the thumb is drawn.
  list: '-mx-4 mt-6 flex snap-x snap-proximity gap-4 overflow-x-auto scroll-px-4 px-4 pb-3 lg:-mx-8 lg:scroll-px-8 lg:px-8 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent',
  // One width, snapping to its start; a column, so the row's cards share one height and every link sits on the bottom edge.
  // TRIPCARDS-02 (Alex, 2026-11-08): the trip.com look — a dark card, no border and no padding (each part keeps its own inset), its corners clipping the photo.
  card: 'w-[21rem] shrink-0 snap-start flex flex-col overflow-hidden rounded-lg bg-text-primary',
  // TRIPCARDS-02: a card WITH a photo opens with one block, 320px tall, holding in this DOM order the figure, the stop chip and the band.
  photo: 'relative h-80 shrink-0',
  figure: 'h-full',
  photoLink: 'block h-full',
  image: 'h-full w-full object-cover',
  // TRIPCARDS-02: the credit sits first (inside the figure) and is drawn on the band's last line, at its right.
  credit: 'absolute bottom-3 right-3.5 z-10 font-mono text-[10px] text-white/60',
  // TRIPCARDS-01d: the stop number leads the card's words (after the credit, in the DOM), the label beside it — TRIPCARDS-02: drawn as a chip on the photo's top left.
  stop: 'absolute left-3 top-3 inline-flex items-center gap-1.5 rounded bg-ts-white px-2 py-1 font-mono text-[11px] text-text-secondary',
  label: 'font-semibold uppercase tracking-wider text-brand-purple',
  // TRIPCARDS-02: the band across the photo's foot, solid (the canvas draws it at 84%; text-primary is a plain var, so no opacity
  // modifier) — the place, then the dates, their right padding clear of the credit.
  band: 'absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-text-primary px-3.5 py-3',
  place: 'text-lg font-semibold leading-snug text-white',
  stay: 'pr-28 font-mono text-xs text-white/85',
  // TRIPCARDS-02: a card WITHOUT a photo (Cebu today) — no block, no figure, no box: the same chip, static here, then the place and the dates.
  top: 'flex flex-col items-start gap-1 px-3.5 pt-3.5',
  stopStatic: 'mb-2 inline-flex items-center gap-1.5 rounded bg-ts-white px-2 py-1 font-mono text-[11px] text-text-secondary',
  foot: 'mx-3.5 mb-3.5 mt-auto pt-4',
  // HOME-FINISH-01 (Alex, 2026-11-08): the post link is the public page's one filled button (src/lib/ds.ts PRIMARY_CTA — 44px, label centred).
  link: PRIMARY_CTA,
  // TRIPCARDS-01: what it cost — a label column in the mono voice; beside it the name and the amount on ONE
  // line (the name may end in "…", the amount never shrinks). TRIPCARDS-02: inset on the dark card, its words white.
  costs: 'mx-3.5 mt-3.5 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5',
  costLabel: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-white/60',
  costValue: 'flex min-w-0 items-baseline gap-1 text-xs text-white',
  costName: 'truncate',
  costAmount: 'shrink-0 whitespace-nowrap font-mono text-xs text-white/80',
} as const;

/** TRIPCARDS-01: the stop's costs, or a loud failure — never a card without them; the registry law refuses a stop with no costs row at build. */
function costsFor(costs: readonly TripCosts[], id: string): TripCosts {
  const found = costs.find((c) => c.stopId === id);
  if (!found) throw new Error(`was here: "${id}" has no costs row (src/lib/tripCosts.ts)`);
  return found;
}

/** TRIPCARDS-01: what the stop cost — Stay, Motorbike, Flight in; the name, then the amount (or n/a, or not in my log yet). */
function Costs({ costs }: { costs: TripCosts }) {
  return (
    <dl className={TRIP.costs} data-was-here-costs={costs.stopId}>
      {stopCostRows(costs).map((c) => (
        <div key={c.what} className="contents" data-was-here-cost={c.what}>
          <dt className={TRIP.costLabel}>{c.what}</dt>
          <dd className={TRIP.costValue}>
            {c.detail !== '' && <><span className={TRIP.costName} title={c.detail}>{c.detail}</span><span aria-hidden="true">·</span></>}
            <span className={TRIP.costAmount}>{c.amount}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Entry({ row, costs, stop, today }: { row: WasHereRow; costs: TripCosts; stop: number; today: string }) {
  const label = stopLabel(row, today);
  const href = tripPostHref(row.id);
  // TRIPCARDS-02 (Alex, 2026-11-08): the stop, the place and the dates are the same parts in either layout — on the
  // photo (the chip at its top left, the place and the dates on its band) or, with no photo, opening the card.
  const stopLine = (className: string) => (
    <p className={className} data-was-here-stop={stop}>
      {stopWords(stop)}
      {label !== null && <><span aria-hidden="true"> · </span><span className={TRIP.label} data-was-here-label>{label}</span></>}
    </p>
  );
  const place = <h3 className={TRIP.place}>{row.city}, {row.country}</h3>;
  const stay = <p className={TRIP.stay} data-was-here-stay>{stayWords(row)}</p>;
  return (
    <article className={TRIP.card} data-was-here={row.id} data-was-here-image={row.image === null ? 'none' : 'photo'}>
      {row.image !== null ? (
        <div className={TRIP.photo}>
          <figure className={TRIP.figure}>
            {/* TRIPCARDS-01: the photo opens the stop's page too — out of the tab order; "Read the post" is the link a keyboard meets. */}
            <a href={href} tabIndex={-1} aria-hidden="true" className={TRIP.photoLink}>
              {/* A plain <img>, the Built-on wall's precedent (BuiltOnStrip.tsx REAL-MARKS — re-cited BUILTON-01, 2026-11-09: was Landing.tsx): a file under
                  public/, served as-is, no optimizer and no remote loader. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.image.src} alt={row.image.alt} loading="lazy" className={TRIP.image} />
            </a>
            <figcaption className={TRIP.credit}>{row.image.credit}</figcaption>
          </figure>
          {stopLine(TRIP.stop)}
          <div className={TRIP.band}>
            {place}
            {stay}
          </div>
        </div>
      ) : (
        <div className={TRIP.top}>
          {stopLine(TRIP.stopStatic)}
          {place}
          {stay}
        </div>
      )}
      <Costs costs={costs} />
      <div className={TRIP.foot}>
        <a href={href} className={TRIP.link} data-was-here-post-link>{READ_THE_POST}</a>
      </div>
    </article>
  );
}

/** The pure half: props in, markup out — the tests render it (TRIPCARDS-01: the costs come in beside the rows). */
export function WasHereView({ rows, costs, today }: { rows: readonly WasHereRow[]; costs: readonly TripCosts[]; today: string }) {
  return (
    <section id={MY_TRIP_ANCHOR} aria-label="My trip" className={TRIP.act} data-my-trip>
      <div className={TRIP.inner}>
        <p className={TRIP.eyebrow}>{MY_TRIP_EYEBROW}</p>
        <h2 className={TRIP.h2}>{MY_TRIP_HEADLINE}</h2>
        <p className={TRIP.sub}>{MY_TRIP_LINE}</p>
        <div className={TRIP.list} data-was-here-rail>
          {tripOrder(rows).map((row, i) => <Entry key={row.id} row={row} costs={costsFor(costs, row.id)} stop={i + 1} today={today} />)}
        </div>
      </div>
    </section>
  );
}

export default function WasHereSection({ today }: { today: string }) {
  return <WasHereView rows={WAS_HERE} costs={TRIP_COSTS} today={today} />;
}

'use client';

/**
 * WasHereSection (WASHERE-01, Alex, 2026-10-31) — MY TRIP, the trip log, on the
 * guest landing directly after the experiences (Landing.tsx). 'use client' only
 * because Landing.tsx is one; this file holds no state and no effect.
 *
 * WHY. The "I'm into…" filter serves the reader; "I was here" is Alex's own trip.
 * The card that EVENTS-01 featured inside the experiences left that section and is
 * an entry here — an act built to take many entries and a photo each as Alex adds
 * them. WASHERE-03: the log reads top-down as posts, in trip order, each stop with
 * what he did and learned. WASHERE-04 (Alex, 2026-11-03): privacy. TRIPPOST-01 (Alex,
 * 2026-11-05): the cards sit in a grid — one column, two from sm, three from lg — and a
 * stop Alex has written up opens its own page (/my-trip/<id>, src/app/my-trip/[id]).
 *
 * TRIPCARDS-01 (Alex, 2026-11-05): every card in the Canggu card's shape, the stops he has
 * booked ahead included, and every card opens its stop's page.
 *
 * WHAT IT RENDERS — every word of a stop from src/lib/wasHere.ts through
 * src/lib/wasHereWords.ts, what it cost from src/lib/tripCosts.ts through
 * src/lib/tripPostWords.ts, every word of an event from src/lib/experiences.ts
 * through src/lib/experienceWords.ts, never typed here:
 *   the eyebrow, the h2, the line (each typed once below; Alex rewrites the copy
 *   later); then tripOrder(WAS_HERE), each a card, in this order:
 *     · the image when present (an <img> at 3:2 with its credit under it), linking the
 *       stop's page out of the tab order — and NO <img>, NO placeholder box while null;
 *     · the label from the server's day — I'M HERE while he is there, COMING UP before;
 *       none once he has left (Alex: lose "I was here");
 *     · city, country; the stay — "Since <day>" or the window's dateWords;
 *     · the stop number, derived from the order ("Stop 1" … "Stop 10");
 *     · when the stop is written up (cardOf, src/lib/tripPostCards.ts — never the post body,
 *       src/lib/tripPosts.ts, so none of it ships in this page's JavaScript): the post's
 *       title as a link to its page and its one line;
 *     · what it cost — Stay, Motorbike, Flight in: the name and the amount, "n/a" for none,
 *       "not in my log yet" for a figure he hasn't logged (tripPostWords.ts stopCostRows);
 *     · when experienceId is set, the event's own block: category · series, its
 *       name, its venue, experienceLine(event, today);
 *     · Alex's line when he has written it (null renders nothing);
 *     · DID — the items joined by " · "; LEARNED — one <p> per paragraph. An
 *       empty list renders nothing — no empty eyebrow;
 *     · "Read the post →" to the stop's page — every stop. A stop's events (WHAT WAS ON)
 *       live on its page, not on the card — one home per event;
 *     · when experienceId is set, one link to the strip (#demo).
 *
 * THE DAY RULE: `today` is the UTC calendar date src/app/page.tsx computed ONCE and
 * passed down; nothing here reads the clock. PAINT: house tokens only, zero new hex
 * — the cream act with white cards and the lavender hairline (the DONE-FOR-YOU
 * idiom), the eyebrow in the mono faint voice. Cards stack; nothing scrolls sideways.
 * No emoji, no countdown, no urgency words.
 */

import { EXPERIENCES, experienceCategoryLabel, type Experience } from '@/lib/experiences';
import { experienceLine } from '@/lib/experienceWords';
import { WAS_HERE, type WasHereRow } from '@/lib/wasHere';
import { listWords, stayWords, stopLabel, stopWords, tripOrder } from '@/lib/wasHereWords';
// TRIPPOST-01: the card leaf and the words only — never src/lib/tripPosts.ts (the post body stays on its page).
import { cardOf, type TripPostCard } from '@/lib/tripPostCards';
// TRIPCARDS-01: what each stop cost — the stay, the motorbike, the flight in.
import { TRIP_COSTS, type TripCosts } from '@/lib/tripCosts';
import { stopCostRows, tripPostHref } from '@/lib/tripPostWords';

/** The act's anchor. */
export const MY_TRIP_ANCHOR = 'my-trip';
export const MY_TRIP_EYEBROW = 'MY TRIP';
export const MY_TRIP_HEADLINE = "Where I've been, and where I'm going.";
export const MY_TRIP_LINE = "Stop by stop, dated, with the whole story where I've written it up.";
/** TRIPPOST-01: the card's link to its post. */
export const READ_THE_POST = 'Read the post →';
export const MY_TRIP_LINK = 'Book the stay and the flight ↑';
export const DID = 'DID';
export const LEARNED = 'LEARNED';

// THE CLASS GRAMMAR — one const, every string whole, house tokens only.
const TRIP = {
  act: 'w-full border-b border-border bg-bg-terminal',
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 py-10',
  eyebrow: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  h2: 'mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple',
  sub: 'mt-2 text-sm text-text-secondary',
  // TRIPPOST-01: a grid — one column, two from sm, three from lg.
  list: 'mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
  card: 'rounded-lg border border-border bg-white p-5',
  image: 'aspect-[3/2] w-full rounded object-cover',
  credit: 'mt-1 font-mono text-[10px] text-text-faint',
  label: 'mt-4 font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-brand-purple',
  place: 'mt-1 text-lg font-semibold text-text-primary',
  stay: 'mt-1 font-mono text-xs text-text-secondary',
  stop: 'mt-1 font-mono text-xs text-text-faint',
  event: 'mt-4 rounded-lg border border-border-light bg-bg-row p-4',
  eventEyebrow: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-amber',
  eventName: 'mt-1 text-base font-semibold text-text-primary',
  eventVenue: 'mt-1 text-sm text-text-secondary',
  eventLine: 'mt-2 font-mono text-xs leading-relaxed text-text-primary',
  quote: 'mt-4 text-base text-text-primary',
  // WASHERE-03: the post's sections — the eyebrow in the mono faint voice, the words in the body voice.
  sectionEyebrow: 'mt-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  joined: 'mt-1 text-sm leading-relaxed text-text-primary',
  paragraph: 'mt-2 text-base leading-relaxed text-text-primary',
  link: 'mt-4 inline-flex min-h-[44px] items-center border border-brand-purple/40 px-5 text-sm font-medium text-brand-purple hover:bg-brand-purple-wash',
  // TRIPPOST-01: the post block — its title, its line, the stay, the link.
  postTitle: 'mt-4 inline-flex min-h-[44px] items-center text-base font-semibold text-brand-purple hover:text-brand-purple-hover',
  postLine: 'mt-1 text-sm leading-relaxed text-text-primary',
  // TRIPCARDS-01: what it cost — a label column in the mono faint voice, the name and the amount beside it.
  costs: 'mt-4 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5',
  costLabel: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  costValue: 'text-sm text-text-primary',
  costAmount: 'font-mono text-xs text-text-secondary',
} as const;

/** The event a stop names, or a loud failure — the registry law refuses a stale id at build. */
function eventOf(id: string): Experience {
  const found = EXPERIENCES.find((r) => r.id === id);
  if (!found) throw new Error(`was here: "${id}" is not an EXPERIENCES id`);
  return found;
}

/** TRIPCARDS-01: the stop's costs, or a loud failure — never a card without them; the registry law refuses a stop with no costs row at build. */
function costsFor(costs: readonly TripCosts[], id: string): TripCosts {
  const found = costs.find((c) => c.stopId === id);
  if (!found) throw new Error(`was here: "${id}" has no costs row (src/lib/tripCosts.ts)`);
  return found;
}

/** DID: one line, the items joined — nothing when the list is empty. */
function Joined({ eyebrow, items, hook }: { eyebrow: string; items: readonly string[]; hook: string }) {
  if (items.length === 0) return null;
  return (
    <div data-was-here-section={hook}>
      <p className={TRIP.sectionEyebrow}>{eyebrow}</p>
      <p className={TRIP.joined}>{listWords(items)}</p>
    </div>
  );
}

/** LEARNED: one <p> per paragraph — nothing when the list is empty. */
function Paragraphs({ eyebrow, items, hook }: { eyebrow: string; items: readonly string[]; hook: string }) {
  if (items.length === 0) return null;
  return (
    <div data-was-here-section={hook}>
      <p className={TRIP.sectionEyebrow}>{eyebrow}</p>
      {items.map((paragraph, i) => <p key={`${hook}-${i}`} className={TRIP.paragraph}>{paragraph}</p>)}
    </div>
  );
}

/** TRIPPOST-01: a written-up stop's block — the post's title linking its page, and its line. */
function PostBlock({ card }: { card: TripPostCard }) {
  return (
    <div data-was-here-post={card.stopId}>
      <a href={tripPostHref(card.stopId)} className={TRIP.postTitle} data-was-here-post-title>{card.title}</a>
      <p className={TRIP.postLine}>{card.cardLine}</p>
    </div>
  );
}

/** TRIPCARDS-01: what the stop cost — Stay, Motorbike, Flight in; the name, then the amount (or n/a, or not in my log yet). */
function Costs({ costs }: { costs: TripCosts }) {
  return (
    <dl className={TRIP.costs} data-was-here-costs={costs.stopId}>
      {stopCostRows(costs).map((c) => (
        <div key={c.what} className="contents" data-was-here-cost={c.what}>
          <dt className={TRIP.costLabel}>{c.what}</dt>
          <dd className={TRIP.costValue}>{c.detail === '' ? <span className={TRIP.costAmount}>{c.amount}</span> : <>{c.detail} · <span className={TRIP.costAmount}>{c.amount}</span></>}</dd>
        </div>
      ))}
    </dl>
  );
}

function Entry({ row, costs, stop, today }: { row: WasHereRow; costs: TripCosts; stop: number; today: string }) {
  const event = row.experienceId === null ? null : eventOf(row.experienceId);
  const card = cardOf(row.id);
  const label = stopLabel(row, today);
  const href = tripPostHref(row.id);
  return (
    <article className={TRIP.card} data-was-here={row.id} data-was-here-image={row.image === null ? 'none' : 'photo'}>
      {row.image !== null && (
        <figure>
          {/* TRIPCARDS-01: the photo opens the stop's page too — out of the tab order; "Read the post" is the link a keyboard meets. */}
          <a href={href} tabIndex={-1} aria-hidden="true">
            {/* A plain <img>, the Built-on wall's precedent (Landing.tsx REAL-MARKS): a file under
                public/, served as-is, no optimizer and no remote loader. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.image.src} alt={row.image.alt} loading="lazy" className={TRIP.image} />
          </a>
          <figcaption className={TRIP.credit}>{row.image.credit}</figcaption>
        </figure>
      )}
      {label !== null && <p className={TRIP.label} data-was-here-label>{label}</p>}
      <h3 className={TRIP.place}>{row.city}, {row.country}</h3>
      <p className={TRIP.stay} data-was-here-stay>{stayWords(row)}</p>
      <p className={TRIP.stop} data-was-here-stop={stop}>{stopWords(stop)}</p>
      {card !== null && <PostBlock card={card} />}
      <Costs costs={costs} />
      {event !== null && (
        <div className={TRIP.event} data-was-here-event={event.id}>
          <p className={TRIP.eventEyebrow}>{event.series === null ? experienceCategoryLabel(event.category) : `${experienceCategoryLabel(event.category)} · ${event.series}`}</p>
          <p className={TRIP.eventName}>{event.name}</p>
          <p className={TRIP.eventVenue}>{event.venue}</p>
          <p className={TRIP.eventLine} data-experience-line>{experienceLine(event, today)}</p>
        </div>
      )}
      {row.line !== null && <p className={TRIP.quote} data-was-here-line>{row.line}</p>}
      <Joined eyebrow={DID} items={row.did} hook="did" />
      <Paragraphs eyebrow={LEARNED} items={row.learned} hook="learned" />
      {/* TRIPCARDS-01: every stop's page — its events (WHAT WAS ON) live there, one home per event. */}
      <a href={href} className={TRIP.link} data-was-here-post-link>{READ_THE_POST}</a>
      {event !== null && <a href="#demo" className={TRIP.link}>{MY_TRIP_LINK}</a>}
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
        <div className={TRIP.list}>
          {tripOrder(rows).map((row, i) => <Entry key={row.id} row={row} costs={costsFor(costs, row.id)} stop={i + 1} today={today} />)}
        </div>
      </div>
    </section>
  );
}

export default function WasHereSection({ today }: { today: string }) {
  return <WasHereView rows={WAS_HERE} costs={TRIP_COSTS} today={today} />;
}

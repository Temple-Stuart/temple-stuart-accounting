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
 * what he worked from, did and learned.
 *
 * WHAT IT RENDERS — every word of a stop from src/lib/wasHere.ts through
 * src/lib/wasHereWords.ts, every word of an event from src/lib/experiences.ts
 * through src/lib/experienceWords.ts, never typed here:
 *   the eyebrow, the h2, the line (each typed once below; Alex rewrites the copy
 *   later); then tripOrder(WAS_HERE), each a card, in this order:
 *     · the image when present (an <img> at 3:2 with its credit under it) — and
 *       NO <img>, NO placeholder box while image is null;
 *     · the label — I'M HERE while end is null, I WAS HERE once it is set;
 *     · city, country; the stay — "Since <day>" or the window's dateWords;
 *     · the stop number, derived from the order ("Stop 1" … "Stop 7");
 *     · when experienceId is set, the event's own block: category · series, its
 *       name, its venue, experienceLine(event, today);
 *     · Alex's line when he has written it (null renders nothing);
 *     · WORKED FROM — the names joined by " · "; DID — the items joined; LEARNED —
 *       one <p> per paragraph. An empty list renders nothing — no empty eyebrow;
 *     · WHAT WAS ON — one pill per event, each linking its source (the EXPERIENCES
 *       pills' grammar, on the cream act's tokens); no events, no list;
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
import { WAS_HERE, type StopEvent, type WasHereRow } from '@/lib/wasHere';
import { listWords, onPill, stayWords, stopWords, tripOrder, wasHereLabel } from '@/lib/wasHereWords';

/** The act's anchor. */
export const MY_TRIP_ANCHOR = 'my-trip';
export const MY_TRIP_EYEBROW = 'MY TRIP';
export const MY_TRIP_HEADLINE = "Where I've been while building this.";
export const MY_TRIP_LINE = 'Stop by stop, dated.';
export const MY_TRIP_LINK = 'Book the stay and the flight ↑';
export const WORKED_FROM = 'WORKED FROM';
export const DID = 'DID';
export const LEARNED = 'LEARNED';
export const WHAT_WAS_ON = 'WHAT WAS ON';

// THE CLASS GRAMMAR — one const, every string whole, house tokens only.
const TRIP = {
  act: 'w-full border-b border-border bg-bg-terminal',
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 py-10',
  eyebrow: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  h2: 'mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple',
  sub: 'mt-2 text-sm text-text-secondary',
  list: 'mt-6 flex flex-col gap-4',
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
  // WASHERE-02: the EXPERIENCES pills' grammar (ExperiencesSection.tsx EXP.pill — the shape,
  // the 44px row, wrapping text), on this cream act's tokens instead of the band's.
  pillRow: 'mt-2 flex flex-wrap gap-2',
  pill: 'inline-flex min-h-[44px] items-center whitespace-normal break-words rounded border border-border bg-bg-row px-3 py-2 text-left font-mono text-xs leading-snug text-text-primary hover:bg-brand-purple-wash',
  link: 'mt-4 inline-flex min-h-[44px] items-center border border-brand-purple/40 px-5 text-sm font-medium text-brand-purple hover:bg-brand-purple-wash',
} as const;

/** The event a stop names, or a loud failure — the registry law refuses a stale id at build. */
function eventOf(id: string): Experience {
  const found = EXPERIENCES.find((r) => r.id === id);
  if (!found) throw new Error(`was here: "${id}" is not an EXPERIENCES id`);
  return found;
}

/** WORKED FROM and DID: one line, the items joined — nothing when the list is empty. */
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

/** WHAT WAS ON: one pill per event, each its source's link — nothing when there are none. */
function Pills({ rows, stop }: { rows: readonly StopEvent[]; stop: string }) {
  if (rows.length === 0) return null;
  return (
    <div data-was-here-list="on">
      <p className={TRIP.sectionEyebrow}>{WHAT_WAS_ON}</p>
      <div className={TRIP.pillRow}>
        {rows.map((ev) => (
          <a key={`${ev.name} · ${ev.start}`} href={ev.sourceUrl} rel="noopener" target="_blank" className={TRIP.pill} data-was-here-pill={`${stop} · ${ev.name}`}>
            {onPill(ev)}
          </a>
        ))}
      </div>
    </div>
  );
}

function Entry({ row, stop, today }: { row: WasHereRow; stop: number; today: string }) {
  const event = row.experienceId === null ? null : eventOf(row.experienceId);
  return (
    <article className={TRIP.card} data-was-here={row.id} data-was-here-image={row.image === null ? 'none' : 'photo'}>
      {row.image !== null && (
        <figure>
          {/* A plain <img>, the Built-on wall's precedent (Landing.tsx REAL-MARKS): a file under
              public/, served as-is, no optimizer and no remote loader. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.image.src} alt={row.image.alt} loading="lazy" className={TRIP.image} />
          <figcaption className={TRIP.credit}>{row.image.credit}</figcaption>
        </figure>
      )}
      <p className={TRIP.label} data-was-here-label>{wasHereLabel(row)}</p>
      <h3 className={TRIP.place}>{row.city}, {row.country}</h3>
      <p className={TRIP.stay} data-was-here-stay>{stayWords(row)}</p>
      <p className={TRIP.stop} data-was-here-stop={stop}>{stopWords(stop)}</p>
      {event !== null && (
        <div className={TRIP.event} data-was-here-event={event.id}>
          <p className={TRIP.eventEyebrow}>{event.series === null ? experienceCategoryLabel(event.category) : `${experienceCategoryLabel(event.category)} · ${event.series}`}</p>
          <p className={TRIP.eventName}>{event.name}</p>
          <p className={TRIP.eventVenue}>{event.venue}</p>
          <p className={TRIP.eventLine} data-experience-line>{experienceLine(event, today)}</p>
        </div>
      )}
      {row.line !== null && <p className={TRIP.quote} data-was-here-line>{row.line}</p>}
      <Joined eyebrow={WORKED_FROM} items={row.workedFrom} hook="worked-from" />
      <Joined eyebrow={DID} items={row.did} hook="did" />
      <Paragraphs eyebrow={LEARNED} items={row.learned} hook="learned" />
      <Pills rows={row.events} stop={row.id} />
      {event !== null && <a href="#demo" className={TRIP.link}>{MY_TRIP_LINK}</a>}
    </article>
  );
}

/** The pure half: props in, markup out — the tests render it. */
export function WasHereView({ rows, today }: { rows: readonly WasHereRow[]; today: string }) {
  return (
    <section id={MY_TRIP_ANCHOR} aria-label="My trip" className={TRIP.act} data-my-trip>
      <div className={TRIP.inner}>
        <p className={TRIP.eyebrow}>{MY_TRIP_EYEBROW}</p>
        <h2 className={TRIP.h2}>{MY_TRIP_HEADLINE}</h2>
        <p className={TRIP.sub}>{MY_TRIP_LINE}</p>
        <div className={TRIP.list}>
          {tripOrder(rows).map((row, i) => <Entry key={row.id} row={row} stop={i + 1} today={today} />)}
        </div>
      </div>
    </section>
  );
}

export default function WasHereSection({ today }: { today: string }) {
  return <WasHereView rows={WAS_HERE} today={today} />;
}

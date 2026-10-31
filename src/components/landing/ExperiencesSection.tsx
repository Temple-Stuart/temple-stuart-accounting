'use client';

/**
 * ExperiencesSection (EVENTS-01, Alex, 2026-10-30) — THE EXPERIENCES, directly
 * under the booking strip on the guest landing (Landing.tsx, after the LIVE DEMO
 * act): the marquee events a guest books a stay and a flight around.
 *
 * WHAT IT RENDERS, top to bottom — every word about an event comes from
 * src/lib/experiences.ts through src/lib/experienceWords.ts, never typed here:
 *   1. the eyebrow, the h2 and the one line;
 *   2. I'M INTO… — one chip per category, and the filter is FORCED: the section
 *      always shows exactly one category (EVENTS-01b — no all-categories view).
 *      THE URL IS THE ONLY STATE (the TAB13-03 rule): the choice is
 *      ?into=<category id>, read with useSearchParams and written with
 *      router.replace — no storage, no cookie. No param, or an empty one, → the
 *      FIRST category in EXPERIENCE_CATEGORIES (DEFAULT_INTO, derived from the
 *      list), its chip pressed; a valid id → that category, its chip pressed; an
 *      unknown value → no chip pressed and the line "<value> is not a category —
 *      pick one above." in place of COMING UP and THE LINEUP — a bad value gets a
 *      refusal, never a substitute category;
 *   3. THE FEATURED CARD — the one row the leaf marks featured; Alex's line typed
 *      once (I_WAS_HERE_LINE); its one link, to the strip (#demo);
 *   4. COMING UP — upcoming(rows, today, 6) over the chosen category with the featured
 *      row excluded (it is the card above, and it shows in every state); under the
 *      grid the one line pointing at the strip (EVENTS-02 replaces it with per-card
 *      prefill); nothing upcoming in the chosen category → said, never an empty grid;
 *   5. THE LINEUP — the chosen category's rows, EVERY row its own pill linking its
 *      date to its source (EVENTS-01b: nothing collapses — F1 shows all 24 cities);
 *   6. the closing line.
 *
 * THE DAY RULE: `today` is the UTC calendar date src/app/page.tsx computed ONCE and
 * passed down; nothing here reads the clock, so the server's words and the browser's
 * are the same words and hydration cannot drift at midnight. Every comparison is a
 * string compare on 'YYYY-MM-DD'.
 *
 * PAINT: house tokens only, zero new hex — the hero's aubergine band (bg-brand-purple,
 * text-white), the eyebrow in brand-amber, cards and pills on the band's own white/5
 * fill and white/15 hairline, in the DECK grammar's idiom (Landing.tsx DECK: one const,
 * every class string whole). Chips wrap; the grids are auto-fit over min(…, 100%);
 * nothing scrolls sideways. No image, no countdown, no urgency words, no emoji.
 *
 * ExperiencesView is the pure half — props in, markup out; the tests render it. The
 * default export reads the URL and hands it the choice.
 */

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  EXPERIENCES, EXPERIENCE_CATEGORIES, experienceCategoryLabel, isExperienceCategoryId,
  type Experience, type ExperienceCategoryId,
} from '@/lib/experiences';
import { experienceLine, lineupPill, upcoming } from '@/lib/experienceWords';

/** The section's anchor — the strip's Events mode and the chips' URL both name it. */
export const EVENTS_ANCHOR = 'events';
/** The one URL parameter: ?into=<category id>. */
export const INTO_PARAM = 'into';
/** How many upcoming cards COMING UP shows. */
export const COMING_UP_COUNT = 6;
/** EVENTS-01b: the category shown when the URL names none — the FIRST in the leaf's list, derived, never typed. */
export const DEFAULT_INTO: ExperienceCategoryId = EXPERIENCE_CATEGORIES[0].id;

export const EYEBROW = 'THE BEST EXPERIENCES ON EARTH · THEN THE STAY AND THE FLIGHT TO GET THERE';
export const HEADLINE = 'Book the experience, not just the destination.';
export const SUBHEAD = "Pick what you're into. See what's on and where. Book the stay and the flight around it, right here.";
export const INTO_LABEL = "I'M INTO…";
export const FEATURED_LABEL = 'I WAS HERE';
/** Alex's line, typed once. */
export const I_WAS_HERE_LINE = "I landed in Siargao in the middle of the WSL by luck. Don't get lucky. Book around it.";
export const FEATURED_LINK = 'Book the stay and the flight ↑';
export const COMING_UP_LABEL = 'COMING UP';
export const STRIP_LINE = 'To book around one of these, use the strip at the top: hotels, flights, getting around.';
export const LINEUP_LABEL = 'THE LINEUP';
export const CLOSING_LINE = "Dates come from each event's own calendar, with the day they were checked. Not announced means not announced. Tickets are sold by the events, not here.";

/** "<value> is not a category — pick one above." — the unknown ?into= value, refused by name, in place of COMING UP and THE LINEUP. */
export function notACategory(value: string): string {
  return `${value} is not a category — pick one above.`;
}

/** "Nothing announced yet in <category> — the rows below say when each one was checked." */
export function nothingUpcoming(categoryLabel: string): string {
  return `Nothing announced yet in ${categoryLabel} — the rows below say when each one was checked.`;
}

// THE CLASS GRAMMAR — the DECK idiom: one const, every string whole, house tokens only.
const EXP = {
  band: 'w-full bg-brand-purple text-white',
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14',
  eyebrow: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-brand-amber',
  h2: 'mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-ts-white',
  sub: 'mt-2 max-w-2xl text-sm text-white/70',
  label: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-white/60',
  chipRow: 'mt-3 flex flex-wrap gap-2',
  chipOn: 'min-h-[44px] rounded-full border border-white bg-white px-4 py-2 font-mono text-xs font-medium text-brand-purple',
  chipOff: 'min-h-[44px] rounded-full border border-white/40 px-4 py-2 font-mono text-xs font-medium text-white transition-colors hover:bg-white/10',
  refused: 'mt-2 font-mono text-xs text-brand-amber',
  card: 'rounded-lg border border-white/15 bg-white/5 p-5',
  cardEyebrow: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-amber',
  cardName: 'mt-1 text-lg font-semibold text-white',
  cardPlace: 'mt-1 text-sm text-white/80',
  cardLine: 'mt-2 font-mono text-xs leading-relaxed text-white/90',
  cardNotes: 'mt-1 text-xs text-white/60',
  quote: 'mt-4 text-base text-white/90',
  ghost: 'mt-5 inline-flex min-h-[44px] items-center border border-white/40 px-5 text-sm font-medium text-white hover:bg-white/10',
  grid: 'mt-3 grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]',
  line: 'mt-4 text-sm text-white/70',
  lineup: 'mt-5',
  pillRow: 'mt-2 flex flex-wrap gap-2',
  pill: 'inline-flex min-h-[44px] items-center whitespace-normal break-words rounded border border-white/15 bg-white/5 px-3 py-2 text-left font-mono text-xs leading-snug text-white/90 hover:bg-white/10',
  closing: 'mt-8 text-xs text-white/60',
} as const;

const eyebrowOf = (row: Experience): string =>
  row.series === null ? experienceCategoryLabel(row.category) : `${experienceCategoryLabel(row.category)} · ${row.series}`;
const placeOf = (row: Experience): string => `${row.venue} · ${row.city}, ${row.country}`;

/** EVENTS-01b: the URL's choice — exactly one category, or a value that names none (refused, no substitute). */
export type IntoChoice = { category: ExperienceCategoryId } | { refused: string };

export interface ExperiencesViewProps {
  rows: readonly Experience[];
  /** The UTC calendar date, 'YYYY-MM-DD', computed once on the server. */
  today: string;
  choice: IntoChoice;
  onPick: (id: ExperienceCategoryId) => void;
}

function Card({ row, today }: { row: Experience; today: string }) {
  return (
    <article className={EXP.card} data-coming-up={row.id}>
      <p className={EXP.cardEyebrow}>{eyebrowOf(row)}</p>
      <h3 className={EXP.cardName}>{row.name}</h3>
      <p className={EXP.cardPlace}>{placeOf(row)}</p>
      <p className={EXP.cardLine} data-experience-line>{experienceLine(row, today)}</p>
      {row.notes !== null && <p className={EXP.cardNotes}>{row.notes}</p>}
    </article>
  );
}

function Lineup({ label, rows, today }: { label: string; rows: readonly Experience[]; today: string }) {
  return (
    <div className={EXP.lineup} data-lineup={label}>
      <p className={EXP.cardEyebrow}>{label}</p>
      <div className={EXP.pillRow}>
        {rows.map((row) => (
          <a key={row.id} href={row.sourceUrl} rel="noopener" target="_blank" className={EXP.pill} data-pill={row.id}>
            {lineupPill(row, today)}
          </a>
        ))}
      </div>
    </div>
  );
}

/** The pure half: props in, markup out. */
export function ExperiencesView({ rows, today, choice, onPick }: ExperiencesViewProps) {
  const featured = rows.find((r) => r.featured);
  const into = 'category' in choice ? choice.category : null;
  const chosen = into === null ? [] : rows.filter((r) => r.category === into);
  const comingUp = upcoming(chosen.filter((r) => !r.featured), today, COMING_UP_COUNT);
  return (
    <section id={EVENTS_ANCHOR} aria-label="Book the experience" className={EXP.band} data-experiences>
      <div className={EXP.inner}>
        <p className={EXP.eyebrow}>{EYEBROW}</p>
        <h2 className={EXP.h2}>{HEADLINE}</h2>
        <p className={EXP.sub}>{SUBHEAD}</p>

        <p className={`mt-8 ${EXP.label}`}>{INTO_LABEL}</p>
        <div className={EXP.chipRow} role="group" aria-label={INTO_LABEL}>
          {EXPERIENCE_CATEGORIES.map((c) => (
            <button key={c.id} type="button" aria-pressed={into === c.id} onClick={() => onPick(c.id)} className={into === c.id ? EXP.chipOn : EXP.chipOff} data-into={c.id}>
              {c.label}
            </button>
          ))}
        </div>

        {featured && (
          <article className={`mt-8 ${EXP.card}`} data-featured={featured.id}>
            <p className={EXP.label}>{FEATURED_LABEL}</p>
            <p className={`mt-3 ${EXP.cardEyebrow}`}>{eyebrowOf(featured)}</p>
            <h3 className={EXP.cardName}>{featured.name}</h3>
            <p className={EXP.cardPlace}>{placeOf(featured)}</p>
            <p className={EXP.cardLine} data-experience-line>{experienceLine(featured, today)}</p>
            <p className={EXP.quote}>{I_WAS_HERE_LINE}</p>
            <a href="#demo" className={EXP.ghost}>{FEATURED_LINK}</a>
          </article>
        )}

        {into === null ? (
          <p className={`mt-10 ${EXP.refused}`} role="status" data-into-refused>{notACategory('refused' in choice ? choice.refused : '')}</p>
        ) : (
          <>
            <p className={`mt-10 ${EXP.label}`}>{COMING_UP_LABEL}</p>
            {comingUp.length > 0 ? (
              <>
                <div className={EXP.grid} data-coming-up-grid>
                  {comingUp.map((row) => <Card key={row.id} row={row} today={today} />)}
                </div>
                <p className={EXP.line}>{STRIP_LINE}</p>
              </>
            ) : (
              <p className={EXP.line} data-nothing-upcoming>{nothingUpcoming(experienceCategoryLabel(into))}</p>
            )}

            <p className={`mt-10 ${EXP.label}`}>{LINEUP_LABEL}</p>
            <Lineup label={experienceCategoryLabel(into)} rows={chosen} today={today} />
          </>
        )}

        <p className={EXP.closing}>{CLOSING_LINE}</p>
      </div>
    </section>
  );
}

/** The URL half: ?into=<category id> read and written; nothing stored anywhere else. */
function ExperiencesFromUrl({ today }: { today: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get(INTO_PARAM);
  // No param, or an empty one, → the first category; a valid id → it; anything else → refused by name.
  const choice: IntoChoice = raw === null || raw === '' ? { category: DEFAULT_INTO } : isExperienceCategoryId(raw) ? { category: raw } : { refused: raw };
  const pick = (id: ExperienceCategoryId) => {
    const next = new URLSearchParams(params.toString());
    next.set(INTO_PARAM, id);
    router.replace(`${window.location.pathname}?${next.toString()}#${EVENTS_ANCHOR}`, { scroll: false });
  };
  return <ExperiencesView rows={EXPERIENCES} today={today} choice={choice} onPick={pick} />;
}

export default function ExperiencesSection({ today }: { today: string }) {
  // useSearchParams wants a Suspense boundary (the CheckoutResultBanner precedent);
  // `/` is force-dynamic, so nothing here ever suspends on the server.
  return (
    <Suspense fallback={null}>
      <ExperiencesFromUrl today={today} />
    </Suspense>
  );
}

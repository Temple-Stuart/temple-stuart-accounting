'use client';

/**
 * ExperiencesSection (EVENTS-01, Alex, 2026-10-30) — THE EXPERIENCES, directly
 * under the booking strip on the guest landing (Landing.tsx, after the LIVE DEMO
 * act): the marquee events a guest books a stay and a flight around.
 *
 * WHAT IT RENDERS, top to bottom — every word about an event comes from
 * src/lib/experiences.ts through src/lib/experienceWords.ts, never typed here:
 *   1. the eyebrow, the h2 and the one line; HOME-LINES-01 (Alex, 2026-11-08): the h2 is the
 *      experience line (EXPERIENCE_LINE, src/lib/brandLines.ts — three lines, the third in the
 *      wash), the promise (PROMISE, the h2 until HOME-LINES-01) right under it, then the one line;
 *   2. I'M INTO… — one chip per category, and the filter is FORCED: the section
 *      always shows exactly one category (EVENTS-01b — no all-categories view).
 *      THE URL IS THE ONLY STATE (the TAB13-03 rule): the choice is
 *      ?into=<category id>, read with useSearchParams and written with
 *      router.replace — no storage, no cookie. No param, or an empty one, → the
 *      FIRST category in EXPERIENCE_CATEGORIES (DEFAULT_INTO, derived from the
 *      list), its chip pressed; a valid id → that category, its chip pressed; an
 *      unknown value → no chip pressed and the line "<value> is not a category —
 *      pick one above." in place of COMING UP — a bad value gets a refusal, never a
 *      substitute category. SEASONS-01 (Alex, 2026-11-08): the I'M INTO row holds the
 *      event categories; under it a second labelled row, SEASONS, holds the season
 *      categories — the same chips and one choice across both rows (?into=<id>);
 *   3. (WASHERE-01, 2026-10-31: the card EVENTS-01 pinned here with Alex's line LEFT
 *      this section — "I was here" is Alex's own trip and lives in the MY TRIP act,
 *      WasHereSection.tsx, below Stop 0 (STOP0-01, 2026-11-09: was "directly below"); the experiences are the reader's filter and
 *      nothing here is Alex's but item 5's one line, which points to his story (STOP0-01, 2026-11-09).)
 *   4. COMING UP — EVENTS-01c (Alex, 2026-11-06): "this part [THE LINEUP] can be removed and
 *      added to the COMING UP section … and just horizontal scroll cards". EVERY row of the
 *      chosen category is a card in ONE row that scrolls sideways (nothing collapses — F1
 *      shows all 24 cities): what is upcoming first, by start (upcoming(), unfiltered — Surf
 *      shows the Philippines Pro first while it is on), then the rest in the leaf's order, each
 *      saying it is not announced (experienceLine) — SEASONS-01 (2026-11-08): a typical season row
 *      is never upcoming and says its usual window instead ("Usually …"); the leaf keeps each season
 *      category in start order, so those cards read in the order the windows open. Every card links
 *      its source — EVENTS-03 (Alex, 2026-11-09): and says the day it was checked, checkedWords in
 *      its foot before the link, unless its line already says it (the not-announced words carry
 *      "(checked …)"; read off the line, never a list of statuses). Under the row
 *      the one line pointing at the strip (EVENTS-02 replaces it with per-card prefill);
 *      nothing upcoming in the chosen category → said above the row, and no strip line —
 *      EVENTS-03: on an event chip. A season chip (its group read from EXPERIENCE_CATEGORIES)
 *      says no such line — a usual window is a season, not an edition waiting to be announced —
 *      and shows the strip line whenever its row has cards;
 *   5. WHY EVENTS FIRST — STOP0-01 (Alex, 2026-11-08; board K tag 7): one line on every view, directly before
 *      the closing line — the label, the line and "Read my story ↓", a link to Stop 0 (#stop-0,
 *      StopZeroSection.tsx, directly below); its words from src/lib/stopZeroWords.ts;
 *   6. the closing line — CLOSING_LINE on an event chip and on the refused view; EVENTS-03:
 *      SEASONS_CLOSING_LINE on a season chip.
 *
 * THE DAY RULE: `today` is the UTC calendar date src/app/page.tsx computed ONCE and
 * passed down; nothing here reads the clock, so the server's words and the browser's
 * are the same words and hydration cannot drift at midnight. Every comparison is a
 * string compare on 'YYYY-MM-DD'.
 *
 * PAINT: house tokens only, zero new hex — the hero's aubergine band (bg-brand-purple,
 * text-white), the eyebrow in brand-amber, cards on the band's own white/5 fill and white/15
 * hairline, in the DECK grammar's idiom (Landing.tsx DECK: one const, every class string
 * whole). Chips wrap. COMING UP is one row that scrolls sideways, edge to edge of the band's
 * box (the negative margin meets the inner padding, so the page itself never scrolls), every
 * card one width, snapping to its start, a column so the row's cards share one height and
 * every source link sits on the bottom edge; the row's thumb is drawn, white/30 on the band
 * (WasHereSection's row, its twin on the cream act). No image, no countdown, no urgency
 * words, no emoji.
 *
 * ExperiencesView is the pure half — props in, markup out; the tests render it. The
 * default export reads the URL and hands it the choice.
 */

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  EXPERIENCES, EXPERIENCE_CATEGORIES, experienceCategoryLabel, isExperienceCategoryId,
  type Experience, type ExperienceCategory, type ExperienceCategoryId,
} from '@/lib/experiences';
import { dayWords, experienceLine, notAnnouncedLine, upcoming } from '@/lib/experienceWords';
import { EXPERIENCE_LINE } from '@/lib/brandLines';
import { EVENTS_STORY_LABEL, EVENTS_STORY_LINE, READ_MY_STORY, STOP_ZERO_ANCHOR } from '@/lib/stopZeroWords';

/** The section's anchor — the strip's Events mode and the chips' URL both name it. FOOTER-01 (2026-11-09): its one home is src/lib/homeAnchors.ts — imported back here, still exported from here. */
import { EVENTS_ANCHOR } from '@/lib/homeAnchors';
export { EVENTS_ANCHOR };
/** The one URL parameter: ?into=<category id>. */
export const INTO_PARAM = 'into';
/** EVENTS-01b: the category shown when the URL names none — the FIRST in the leaf's list, derived, never typed. */
export const DEFAULT_INTO: ExperienceCategoryId = EXPERIENCE_CATEGORIES[0].id;

export const EYEBROW = 'THE BEST EXPERIENCES ON EARTH · THEN THE STAY AND THE FLIGHT TO GET THERE';
/** HOME-LINES-01 (2026-11-08): the h2 until HOME-LINES-01 (then HEADLINE); now the promise under the experience line. */
export const PROMISE = 'Book the experience, not just the destination.';
export const SUBHEAD = "Pick what you're into. See what's on and where. Book the stay and the flight around it, right here.";
export const INTO_LABEL = "I'M INTO…";
/** SEASONS-01 (2026-11-08): the second chip row's label — the season categories. */
export const SEASONS_LABEL = 'SEASONS';
export const COMING_UP_LABEL = 'COMING UP';
export const STRIP_LINE = 'To book around one of these, use the strip at the top: hotels, flights, getting around.';
/** EVENTS-01c: each card's link to its row's source — the page its dates came from. */
export const SOURCE_LINK = 'Source ↗';
export const CLOSING_LINE = "Dates come from each event's own calendar, with the day they were checked. Not announced means not announced. Tickets are sold by the events, not here.";
/** EVENTS-03 (Alex, 2026-11-09): a season chip's closing line, in place of CLOSING_LINE — the events' words do not fit a place's season. */
export const SEASONS_CLOSING_LINE = "Each window comes from the place's own source, with the day it was checked. Usual months are a guide, not set dates.";

/** "<value> is not a category — pick one above." — the unknown ?into= value, refused by name, in place of COMING UP. */
export function notACategory(value: string): string {
  return `${value} is not a category — pick one above.`;
}

/** "Nothing announced yet in <category> — the cards below say when each one was checked." */
export function nothingUpcoming(categoryLabel: string): string {
  return `Nothing announced yet in ${categoryLabel} — the cards below say when each one was checked.`;
}

/** EVENTS-03 (Alex, 2026-11-09): "Checked Nov 8, 2026" — the day a row was checked, in the foot of every card whose line does not already say it. */
export function checkedWords(checkedOn: string): string {
  return `Checked ${dayWords(checkedOn)}`;
}

// THE CLASS GRAMMAR — the DECK idiom: one const, every string whole, house tokens only.
const EXP = {
  band: 'w-full bg-brand-purple text-white',
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14',
  eyebrow: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-brand-amber',
  h2: 'mt-3 text-3xl sm:text-5xl font-bold leading-tight tracking-tight text-ts-white',
  promise: 'mt-4 text-lg sm:text-xl font-semibold text-ts-white',
  sub: 'mt-2 max-w-2xl text-sm text-white/70',
  label: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-white/60',
  chipRow: 'mt-3 flex flex-wrap gap-2',
  chipOn: 'min-h-[44px] rounded-full border border-white bg-white px-4 py-2 font-mono text-xs font-medium text-brand-purple',
  chipOff: 'min-h-[44px] rounded-full border border-white/40 px-4 py-2 font-mono text-xs font-medium text-white transition-colors hover:bg-white/10',
  refused: 'mt-2 font-mono text-xs text-brand-amber',
  // EVENTS-01c: one width, snapping to its start; a column, so the row's cards share one height.
  card: 'w-[21rem] shrink-0 snap-start flex flex-col rounded-lg border border-white/15 bg-white/5 p-5',
  cardEyebrow: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-amber',
  cardName: 'mt-1 text-lg font-semibold text-white',
  cardPlace: 'mt-1 text-sm text-white/80',
  cardLine: 'mt-2 font-mono text-xs leading-relaxed text-white/90',
  cardNotes: 'mt-1 text-xs text-white/60',
  // EVENTS-03 (2026-11-09): the checked words and the source link on one line, wrapping on a narrow card.
  cardFoot: 'mt-auto flex flex-wrap items-center gap-x-3 pt-3',
  checked: 'font-mono text-xs text-white/60',
  source: 'inline-flex min-h-[44px] items-center font-mono text-xs text-white/80 underline-offset-4 hover:text-white hover:underline',
  // EVENTS-01c (2026-11-06): one row that scrolls sideways, edge to edge of the band's box — the
  // negative margin meets the inner padding, so the page never scrolls; the thumb is drawn.
  rail: '-mx-4 mt-3 flex snap-x snap-proximity gap-3 overflow-x-auto scroll-px-4 px-4 pb-3 lg:-mx-8 lg:scroll-px-8 lg:px-8 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent',
  line: 'mt-4 text-sm text-white/70',
  // STOP0-01 (2026-11-09): why events first, and the link to Stop 0 — directly before the closing line.
  story: 'mt-8 max-w-2xl text-sm text-white/80',
  storyLink: 'font-semibold text-white underline-offset-4 hover:underline',
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
  const line = experienceLine(row, today);
  // EVENTS-03 (2026-11-09): the not-announced words already say "(checked …)" — read off the line, never a list of statuses.
  const lineSaysChecked = line === notAnnouncedLine(row.checkedOn);
  return (
    <article className={EXP.card} data-coming-up={row.id}>
      <p className={EXP.cardEyebrow}>{eyebrowOf(row)}</p>
      <h3 className={EXP.cardName}>{row.name}</h3>
      <p className={EXP.cardPlace}>{placeOf(row)}</p>
      <p className={EXP.cardLine} data-experience-line>{line}</p>
      {row.notes !== null && <p className={EXP.cardNotes}>{row.notes}</p>}
      {/* EVENTS-01c: the lineup's links moved here — every card names the page its dates came from.
          EVENTS-03: and the day it was checked, before the link, unless its line already says it. */}
      <div className={EXP.cardFoot}>
        {!lineSaysChecked && <span className={EXP.checked} data-checked={row.id}>{checkedWords(row.checkedOn)}</span>}
        <a href={row.sourceUrl} rel="noopener" target="_blank" className={EXP.source} data-source={row.id}>{SOURCE_LINK}</a>
      </div>
    </article>
  );
}

/** The pure half: props in, markup out. */
export function ExperiencesView({ rows, today, choice, onPick }: ExperiencesViewProps) {
  const into = 'category' in choice ? choice.category : null;
  const chosen = into === null ? [] : rows.filter((r) => r.category === into);
  // EVENTS-01c: every row of the category — what is upcoming first, by start, then the rest in the leaf's order.
  const comingUp = upcoming(chosen, today, chosen.length);
  const cards = [...comingUp, ...chosen.filter((r) => !comingUp.includes(r))];
  // EVENTS-03 (Alex, 2026-11-09): a season chip has its own lines — its group read from EXPERIENCE_CATEGORIES, never a list of ids.
  const isSeason = EXPERIENCE_CATEGORIES.some((c) => c.id === into && c.group === 'season');
  // SEASONS-01 (2026-11-08): one chip, the same classes, in either row — the one choice is ?into=<id>.
  const chip = (c: ExperienceCategory) => (
    <button key={c.id} type="button" aria-pressed={into === c.id} onClick={() => onPick(c.id)} className={into === c.id ? EXP.chipOn : EXP.chipOff} data-into={c.id}>
      {c.label}
    </button>
  );
  return (
    <section id={EVENTS_ANCHOR} aria-label="Book the experience" className={EXP.band} data-experiences>
      <div className={EXP.inner}>
        <p className={EXP.eyebrow}>{EYEBROW}</p>
        <h2 className={EXP.h2}>
          {EXPERIENCE_LINE[0]}<br />
          {EXPERIENCE_LINE[1]}<br />
          <span className="text-brand-purple-wash">{EXPERIENCE_LINE[2]}</span>
        </h2>
        <p className={EXP.promise}>{PROMISE}</p>
        <p className={EXP.sub}>{SUBHEAD}</p>

        <p className={`mt-8 ${EXP.label}`}>{INTO_LABEL}</p>
        <div className={EXP.chipRow} role="group" aria-label={INTO_LABEL}>
          {EXPERIENCE_CATEGORIES.filter((c) => c.group === 'event').map(chip)}
        </div>
        <p className={`mt-6 ${EXP.label}`}>{SEASONS_LABEL}</p>
        <div className={EXP.chipRow} role="group" aria-label={SEASONS_LABEL}>
          {EXPERIENCE_CATEGORIES.filter((c) => c.group === 'season').map(chip)}
        </div>

        {into === null ? (
          <p className={`mt-10 ${EXP.refused}`} role="status" data-into-refused>{notACategory('refused' in choice ? choice.refused : '')}</p>
        ) : (
          <>
            <p className={`mt-10 ${EXP.label}`}>{COMING_UP_LABEL}</p>
            {/* EVENTS-03: a season chip says no "Nothing announced yet" — a usual window is a season, not an edition waiting to be announced. */}
            {comingUp.length === 0 && !isSeason && <p className={EXP.line} data-nothing-upcoming>{nothingUpcoming(experienceCategoryLabel(into))}</p>}
            <div className={EXP.rail} data-coming-up-rail>
              {cards.map((row) => <Card key={row.id} row={row} today={today} />)}
            </div>
            {/* EVENTS-03: on a season chip the strip line shows whenever the row has cards — a place can be booked around in its season. */}
            {(isSeason ? cards.length > 0 : comingUp.length > 0) && <p className={EXP.line}>{STRIP_LINE}</p>}
          </>
        )}

        {/* STOP0-01 (Alex, 2026-11-08; board K tag 7): on every view, directly before the closing line — the link scrolls to Stop 0. */}
        <p className={EXP.story}><span className={EXP.label}>{EVENTS_STORY_LABEL}</span> {EVENTS_STORY_LINE} <a href={`#${STOP_ZERO_ANCHOR}`} className={EXP.storyLink}>{READ_MY_STORY}</a></p>
        <p className={EXP.closing}>{isSeason ? SEASONS_CLOSING_LINE : CLOSING_LINE}</p>
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

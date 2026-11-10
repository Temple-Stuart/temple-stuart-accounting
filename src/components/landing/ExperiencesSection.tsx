'use client';

/**
 * ExperiencesSection (EVENTS-01, Alex, 2026-10-30) — THE EXPERIENCES, directly
 * under the booking strip on the guest landing (Landing.tsx, after the LIVE DEMO
 * act): the marquee events a guest books a stay and a flight around.
 *
 * HOME-BRIEF-05 (Alex, 2026-11-10 19:00: "start with events, and then once you select them, do flights, and hotels") —
 * STAY NEAR IT: every row whose city is fixed carries one action in its body, under its note — "Stay near it →" — which
 * opens the booking box's Hotels tab with the event's place set (the country always, the city when the hotel list holds
 * it; never a date, never a search). The words and the rule are src/lib/experienceWords.ts's (STAY_NEAR_WORDS,
 * canStayNear — read off the row's city, never a status). What a press DOES is the box's: the handler arrives through
 * StayNearContext, which LandingBookingSection.tsx provides. Rendered with no handler — the pure half on its own, every
 * test that renders it — a row draws no action. A <button> in the Source link's own look, with no aria-pressed: the
 * chips stay the only pressed things here. The foot is still the row's last child, unchanged.
 *
 * HOME-BRIEF-04 (Alex, 2026-11-10 19:00 · 19:03) — THE CATALOG LIVES INSIDE THE BOOKING BOX: it is the panel of the box's
 * Events tab, first in the row and open (Landing.tsx hands this component to LandingBookingSection.tsx as `events`).
 * The full-width purple band is gone. The same view — the same rows, chips, list, URL behaviour, data hooks and
 * id="events" — repainted for the white box: no band, no white ink; house tokens for a light surface (primary,
 * secondary and faint ink, the lavender hairline, the row cream on hover); the chosen chip is filled brand purple with
 * white words, the others are outlined; Source ↗ is brand purple. No full-width section classes: the panel sits inside
 * the box's own padding, under the tab row, behind the hairline every panel of the strip opens with. Its label line
 * (EYEBROW) and SUBHEAD are the panel's two opening lines. "Band", "the band's box", PAINT's aubergine and every seat
 * note below describe it as it stood until then — history.
 * THE ARRIVAL (after the look): the booking box is a client-only chunk that loads after the page (Landing.tsx, `ssr:
 * false`), so this block no longer exists when the browser looks for #events — a visitor arriving at /#events (the
 * footer's "Events" link on every public page, a reload after picking a chip) stayed at the top. The URL half takes
 * such an arrival to the block once, when it mounts (landOnEvents). The visitor's own URL names the place: no default,
 * nothing chosen for them, and no other hash is acted on.
 *
 * HOME-FINISH-02 (Alex, 2026-11-10 20:56) — THE PANEL OPENS AT "I'M INTO…": its two opening lines went — the label line
 * ("THE BEST EXPERIENCES ON EARTH · THEN THE STAY AND THE FLIGHT TO GET THERE", EYEBROW) and the line under it ("Pick what
 * you're into. See what's on and where. Book the stay and the flight around it, right here.", SUBHEAD) — because the
 * pillar's paragraph over the box says it (Landing.tsx, "Explore the World."). The chips' label lost the mt-8 that set
 * it under them. EYEBROW and SUBHEAD left with their last reader, and so did PROMISE ("Book the experience, not just the
 * destination."), which Landing.tsx read for the travel header until this brief. Every note below that names them is
 * history.
 *
 * HOME-BRIEF-03 (Alex, 2026-11-10 18:09 · 18:15) — ONE OFFERING WITH THE TRAVEL BLOCK ABOVE: this band repeats no headline.
 * The experience line and the promise are the travel block's header now (Landing.tsx reads EXPERIENCE_LINE from
 * src/lib/brandLines.ts and PROMISE from this file); the band renders its eyebrow, then SUBHEAD, then the chips and the
 * list. Item 1 below describes the band's own h2 and promise as they stood until then — history.
 *
 * HOME-BRIEF-02 (Alex's home page brief, 2026-11-10 16:27) — PRESENTATION ONLY; the rows, the categories, the date
 * rules and the filter are untouched:
 *   · COMING UP / WHEN TO GO is a COMPACT LIST, not a sideways row of cards: one row per event, the same rows in the
 *     same order, a hairline between them. A row reads its date line, the name, the place, the note when it has one,
 *     the checked words when the line does not already say them, and Source ↗ — stacked on a phone, across from md.
 *     The card's eyebrow (category · series) went with the card: the pressed chip says the category. Every data hook
 *     stays (data-coming-up-rail on the list, data-coming-up on a row, data-experience-line, data-checked,
 *     data-source), and the list is still keyed by the chip.
 *   · THREE TEXTS WENT: the strip line under the row (STRIP_LINE); the WHY EVENTS FIRST paragraph with its
 *     "Read my story ↓" link (and its three words in src/lib/stopZeroWords.ts); and the events' closing line is the one
 *     short line now — CLOSING_LINE. SEASONS_CLOSING_LINE stands.
 * Items 4 and 5 below, and PAINT's sideways row, describe the band as it stood until then — history.
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
 *      and shows the strip line whenever its row has cards. EVENTS-04 (Alex, 2026-11-09): a season chip's
 *      row is labelled WHEN TO GO (WHEN_TO_GO_LABEL) in place of COMING UP — an event chip says COMING UP as
 *      before, the refused view neither; an announced season whose published window has passed says "Next season
 *      not announced (checked …)" (seasonNotAnnouncedLine), and its card still says "checked" once; a picked chip's
 *      row opens at its first card (the row is keyed by the chip, so a new chip mounts a new row);
 *   5. WHY EVENTS FIRST — STOP0-01 (Alex, 2026-11-08; board K tag 7): one line on every view, directly before
 *      the closing line — the label, the line and "Read my story ↓", a link to Stop 0 (#stop-0,
 *      StopZeroSection.tsx, directly below); its words from src/lib/stopZeroWords.ts — EVENTS-04 (2026-11-09): the
 *      link never breaks across lines (EXP.storyLink's whitespace-nowrap);
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

import { Suspense, useEffect } from 'react';
import { createContext, useContext } from 'react'; // HOME-BRIEF-05 (2026-11-10): the stay-near handler's context — on a line of its own, so the line above keeps its text
import { useRouter, useSearchParams } from 'next/navigation';
import {
  EXPERIENCES, EXPERIENCE_CATEGORIES, experienceCategoryLabel, isExperienceCategoryId,
  type Experience, type ExperienceCategory, type ExperienceCategoryId,
} from '@/lib/experiences';
import { STAY_NEAR_WORDS, canStayNear, dayWords, experienceLine, notAnnouncedLine, seasonNotAnnouncedLine, upcoming } from '@/lib/experienceWords';

/** The section's anchor — the strip's Events mode and the chips' URL both name it. FOOTER-01 (2026-11-09): its one home is src/lib/homeAnchors.ts — imported back here, still exported from here. */
import { EVENTS_ANCHOR } from '@/lib/homeAnchors';
export { EVENTS_ANCHOR };
/** The one URL parameter: ?into=<category id>. */
export const INTO_PARAM = 'into';
/** EVENTS-01b: the category shown when the URL names none — the FIRST in the leaf's list, derived, never typed. */
export const DEFAULT_INTO: ExperienceCategoryId = EXPERIENCE_CATEGORIES[0].id;

// HOME-FINISH-02 (Alex, 2026-11-10 20:56): three words left here with their last readers — the panel's label line and the line under it
// (this panel's own two opening lines), and the promise Landing.tsx read for the travel header. The pillar's paragraph says it now.
export const INTO_LABEL = "I'M INTO…";
/** SEASONS-01 (2026-11-08): the second chip row's label — the season categories. */
export const SEASONS_LABEL = 'SEASONS';
export const COMING_UP_LABEL = 'COMING UP';
/** EVENTS-04 (Alex, 2026-11-09): a season chip's label over its row, in place of COMING UP — a place's season is when to go. */
export const WHEN_TO_GO_LABEL = 'WHEN TO GO';
/** EVENTS-01c: each row's link to its source — the page its dates came from. */
export const SOURCE_LINK = 'Source ↗';
/** HOME-BRIEF-02 (Alex, 2026-11-10): the one short line — "Dates come from each event's own calendar, with the day they were checked. Not announced means not announced." stood before it until then. */
export const CLOSING_LINE = 'Tickets are sold by the events, not here.';
/** EVENTS-03 (Alex, 2026-11-09): a season chip's closing line, in place of CLOSING_LINE — the events' words do not fit a place's season. */
export const SEASONS_CLOSING_LINE = "Each window comes from the place's own source, with the day it was checked. Usual months are a guide, not set dates.";

/** "<value> is not a category — pick one above." — the unknown ?into= value, refused by name, in place of COMING UP. */
export function notACategory(value: string): string {
  return `${value} is not a category — pick one above.`;
}

/** "Nothing announced yet in <category> — the list below says when each one was checked." HOME-BRIEF-03 (Alex, 2026-11-10): "the list below" — it read "the cards below say" until then, over what HOME-BRIEF-02 made a list. */
export function nothingUpcoming(categoryLabel: string): string {
  return `Nothing announced yet in ${categoryLabel} — the list below says when each one was checked.`;
}

/**
 * HOME-BRIEF-05 (2026-11-10): what a press of "Stay near it →" does — handed the row. The booking box provides it
 * (LandingBookingSection.tsx: it opens Hotels with the row's place). Null, the default, means nobody is listening: no
 * row draws the action.
 */
export const StayNearContext = createContext<((row: Experience) => void) | null>(null);

/** EVENTS-03 (Alex, 2026-11-09): "Checked Nov 8, 2026" — the day a row was checked, in the foot of every card whose line does not already say it. */
export function checkedWords(checkedOn: string): string {
  return `Checked ${dayWords(checkedOn)}`;
}

/**
 * HOME-BRIEF-04 (2026-11-10, after the look): THE ARRIVAL AT /#events. The catalog mounts inside the booking box, which loads after the
 * page, so the browser has already looked for the anchor and found nothing. When the URL's hash names this block, take the visitor to
 * it — once, on mount. Any other hash: nothing. The block is this component's own section, so a hash that names it with no such element
 * on the page is a broken page, said by name — never passed over. Pure but for the two things it is handed, so the tests call it.
 */
export function landOnEvents(hash: string, find: (id: string) => { scrollIntoView: () => void } | null): boolean {
  if (hash !== `#${EVENTS_ANCHOR}`) return false;
  const block = find(EVENTS_ANCHOR);
  if (block === null) throw new Error(`ExperiencesSection: the URL names #${EVENTS_ANCHOR} and no element on the page carries that id — the catalog's own section does`);
  block.scrollIntoView();
  return true;
}

// THE CLASS GRAMMAR — the DECK idiom: one const, every string whole, house tokens only.
// HOME-BRIEF-04 (Alex, 2026-11-10 19:00): repainted for the booking box's white surface. Until then: band 'w-full bg-brand-purple text-white'
// over inner 'max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14'; the eyebrow and the series name in brand-amber; every other ink a white
// (white/90 the date line, white/80 the place and the source link, white/70 the sub and the line, white/60 the labels, the notes, the
// checked words and the closing line); hairlines white/15; the chosen chip white with purple words, the others white/40-outlined.
const EXP = {
  // The panel of the Events tab: no band and no box of its own — the hairline and the spacing every panel of the strip opens with.
  panel: 'mt-6 border-t border-border pt-6',
  // HOME-FINISH-02 (2026-11-10): the keys of the panel's two opening lines (eyebrow, sub) left with the lines.
  label: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  chipRow: 'mt-3 flex flex-wrap gap-2',
  // The chosen chip: filled brand purple, white words. The others: outlined.
  chipOn: 'min-h-[44px] rounded-full border border-brand-purple bg-brand-purple px-4 py-2 font-mono text-xs font-medium text-white',
  chipOff: 'min-h-[44px] rounded-full border border-border px-4 py-2 font-mono text-xs font-medium text-text-primary transition-colors hover:bg-bg-row',
  refused: 'mt-2 font-mono text-xs text-text-primary',
  // HOME-BRIEF-02 (Alex, 2026-11-10): a compact list — a hairline above, below and between its rows; nothing scrolls sideways.
  // (EVENTS-01c's row of cards, one width, snapping, with its drawn thumb, stood here until then.) The key is still `rail`:
  // it is the element that carries data-coming-up-rail.
  rail: 'mt-3 divide-y divide-border border-y border-border',
  // One event, one row: stacked on a phone; from md the date line, then the name over the place, then the foot, on one baseline.
  row: 'flex flex-col gap-1 py-3 md:flex-row md:items-baseline md:gap-6',
  rowLine: 'font-mono text-xs leading-relaxed text-text-primary md:w-72 md:shrink-0',
  rowBody: 'min-w-0 md:flex-1',
  // HOME-BRIEF-03 (Alex, 2026-11-10): the series name, small, over the event's name — the card's top line wore these classes.
  rowSeries: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  rowName: 'text-sm font-semibold text-text-primary',
  rowPlace: 'text-sm text-text-secondary',
  rowNotes: 'mt-1 text-xs text-text-secondary',
  // EVENTS-03 (2026-11-09): the checked words and the source link on one line; from md they close the row, at its right edge.
  rowFoot: 'flex flex-wrap items-center gap-x-3 md:shrink-0 md:justify-end',
  checked: 'font-mono text-xs text-text-faint',
  source: 'inline-flex min-h-[44px] items-center font-mono text-xs text-brand-purple underline-offset-4 hover:text-brand-purple-hover hover:underline',
  line: 'mt-4 text-sm text-text-secondary',
  closing: 'mt-8 text-xs text-text-faint',
} as const;

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

/** HOME-BRIEF-02 (Alex, 2026-11-10): one event, one row of the list — when, what, where, the note, then the day it was checked and its source. */
function EventRow({ row, today }: { row: Experience; today: string }) {
  const onStayNear = useContext(StayNearContext);
  const line = experienceLine(row, today);
  // EVENTS-03 (2026-11-09): the not-announced words already say "(checked …)" — read off the line, never a list of statuses.
  // EVENTS-04 (2026-11-09): either sentence — the edition's or the season's.
  const lineSaysChecked = line === notAnnouncedLine(row.checkedOn) || line === seasonNotAnnouncedLine(row.checkedOn);
  return (
    <article className={EXP.row} data-coming-up={row.id}>
      <p className={EXP.rowLine} data-experience-line>{line}</p>
      <div className={EXP.rowBody}>
        {/* HOME-BRIEF-03 (Alex, 2026-11-10): a row that has a series shows it again — the series name alone (the card's top line carried
            it, after the category, until HOME-BRIEF-02); a row with no series shows nothing extra. */}
        {row.series !== null && <p className={EXP.rowSeries} data-series={row.id}>{row.series}</p>}
        <h3 className={EXP.rowName}>{row.name}</h3>
        <p className={EXP.rowPlace}>{placeOf(row)}</p>
        {row.notes !== null && <p className={EXP.rowNotes}>{row.notes}</p>}
        {/* HOME-BRIEF-05 (Alex, 2026-11-10): the row's one action, under its note — only where a handler listens and the row's city is fixed
            (canStayNear). The Source link's look; a button, not a link: it goes nowhere, it opens the Hotels tab. */}
        {onStayNear !== null && canStayNear(row) && (
          <button type="button" onClick={() => onStayNear(row)} className={EXP.source} data-stay-near={row.id}>{STAY_NEAR_WORDS}</button>
        )}
      </div>
      {/* EVENTS-01c: every row names the page its dates came from.
          EVENTS-03: and the day it was checked, before the link, unless its line already says it. */}
      <div className={EXP.rowFoot}>
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
    <section id={EVENTS_ANCHOR} aria-label="Book the experience" className={EXP.panel} data-experiences>
      <p className={EXP.label}>{INTO_LABEL}</p>
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
          <p className={`mt-10 ${EXP.label}`}>{isSeason ? WHEN_TO_GO_LABEL : COMING_UP_LABEL}</p>
          {/* EVENTS-03: a season chip says no "Nothing announced yet" — a usual window is a season, not an edition waiting to be announced. */}
          {comingUp.length === 0 && !isSeason && <p className={EXP.line} data-nothing-upcoming>{nothingUpcoming(experienceCategoryLabel(into))}</p>}
          <div key={into} className={EXP.rail} data-coming-up-rail>
            {cards.map((row) => <EventRow key={row.id} row={row} today={today} />)}
          </div>
        </>
      )}

      <p className={EXP.closing}>{isSeason ? SEASONS_CLOSING_LINE : CLOSING_LINE}</p>
    </section>
  );
}

/** The URL half: ?into=<category id> read and written; nothing stored anywhere else. */
function ExperiencesFromUrl({ today }: { today: string }) {
  const params = useSearchParams();
  const router = useRouter();
  // HOME-BRIEF-04 (after the look): an arrival at /#events is taken to the block when it mounts — once (landOnEvents, above).
  useEffect(() => {
    landOnEvents(window.location.hash, (id) => document.getElementById(id));
  }, []);
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

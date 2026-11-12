/**
 * EVENTS-03 (Alex, 2026-11-09 13:21: "right now the home page is not doing what the mock up said it would"; SEASONS-01's
 * judgement call 1, #1940) — every event and season card says the day it was checked, as the home page mockup draws it,
 * and the lines around the cards are true on every chip.
 *
 *   T1 the checked words — checkedWords(checkedOn) is "Checked <dayWords>": "Checked Nov 8, 2026";
 *   T2 Surf (an event chip, three cards upcoming on EVENTS-01's day) — every card whose line is not the not-announced line
 *      carries exactly one data-checked, in its foot, holding checkedWords(row.checkedOn), right before its Source ↗ link,
 *      the two on one line; every not-announced card carries none (its line already says "(checked …)"); the Source ↗
 *      link's markup is unchanged; the strip line and CLOSING_LINE as before;
 *   T3 the seven season chips — no "Nothing announced yet", the strip line once after the row, SEASONS_CLOSING_LINE (its
 *      ruled words) once and CLOSING_LINE absent; every card "Checked Nov 8, 2026" in its foot; none where its line is the
 *      not-announced line (Snow resorts on a day after every announced season has ended — still no "Nothing announced yet";
 *      EVENTS-04 (2026-11-09): those lines read "Next season not announced (checked …)");
 *      a season chip whose row is empty shows no strip line;
 *      HOME-BRIEF-02 (Alex, 2026-11-10): the strip line is gone from every view (T2-T4 hold it rendered nowhere), the
 *      events' closing line is its one short line, and a card is a row of the list — its foot still ends it;
 *   T4 Golf (an event chip, nothing upcoming) exactly as experiences01 has it, with CLOSING_LINE and no second "checked";
 *      the refused view with CLOSING_LINE;
 *   T5 the source — the season chip is known by its group, read from EXPERIENCE_CATEGORIES (no season id typed in the
 *      section); the second "checked" is read off the line, never a list of statuses; no clock, no locale.
 * No live call, no database, no clock: the days are written down, not read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code } from '../sourceText';
import { EXPERIENCES, EXPERIENCE_CATEGORIES, type Experience } from '../experiences';
import { dayWords, experienceLine, notAnnouncedLine, seasonNotAnnouncedLine } from '../experienceWords'; // EVENTS-04 (2026-11-09): the ended season's words (saysCheckedOnce)
import {
  ExperiencesView, CLOSING_LINE, SEASONS_CLOSING_LINE, SOURCE_LINK, checkedWords, nothingUpcoming, type IntoChoice,
} from '@/components/landing/ExperiencesSection';

Object.assign(globalThis, { React });

const SECTION = 'src/components/landing/ExperiencesSection.tsx';
/** EVENTS-01's day (experiences01's TODAY): three Surf cards upcoming, three not announced. */
const TODAY = '2026-10-30';
/** A day after every announced snow season has ended (the last, Niseko, closes 2027-05-05). */
const AFTER_THE_SNOW = '2027-06-01';
/** The day experiences01 renders Golf with nothing upcoming. */
const GOLF_DAY = '2027-12-31';
/** HOME-BRIEF-02 (Alex, 2026-11-10): the strip line left the section (its const with it) — its words, held here only to say they are rendered nowhere. */
const STRIP_LINE = 'To book around one of these, use the strip at the top: hotels, flights, getting around.';
/** The day the seven season categories' pages were read (CHECKED_SEASONS, src/lib/experiences.ts). */
const SEASONS_CHECKED = 'Checked Nov 8, 2026';

const SEASON_IDS = EXPERIENCE_CATEGORIES.filter((c) => c.group === 'season').map((c) => c.id);
const render = (choice: IntoChoice, today = TODAY, rows: readonly Experience[] = EXPERIENCES) =>
  renderToStaticMarkup(React.createElement(ExperiencesView, { rows, today, choice, onPick: () => {} }));
/** React's escaping of text: the ampersand, then the apostrophe. */
const asHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const cardsOf = (html: string) => [...html.matchAll(/data-coming-up="([^"]+)"/g)].map((m) => m[1]);
/** The inside of one card, by row id. */
const cardOf = (html: string, id: string) => {
  const m = new RegExp(`<article class="[^"]*" data-coming-up="${id}">([\\s\\S]*?)</article>`).exec(html);
  assert.ok(m, `${id}: its card is drawn`);
  return m[1];
};
const lineIn = (card: string) => /data-experience-line="true">([^<]*)</.exec(card)?.[1];
/**
 * A card's foot, which ends the card: the checked words (when the card carries them) in the card line's mono size, then
 * the Source ↗ link with its markup unchanged — nothing else. `checked` is undefined when the foot carries no checked words.
 */
const footOf = (card: string, id: string) => {
  // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the catalog sits in the booking box's white surface — the checked words in faint ink, Source ↗ in brand
  // purple. Until then, on the purple band: the span 'font-mono text-xs text-white/60' and the link 'inline-flex min-h-[44px] items-center
  // font-mono text-xs text-white/80 underline-offset-4 hover:text-white hover:underline'. The markup around the classes is unchanged.
  // HOME-TRAVEL-01 (Alex, 2026-11-12): the reference's classes (src/app/globals.css) — the span .ts-tm-checked, the link .ts-tm-link (44px tall, in
  // the links' violet), the foot .ts-tm-row__foot (flex, wrapping, centred: the two on one line). Until then: the span 'font-mono text-xs
  // text-text-faint', the link 'inline-flex min-h-[44px] items-center font-mono text-xs text-brand-purple underline-offset-4
  // hover:text-brand-purple-hover hover:underline', and the foot's classes held to include 'flex', 'flex-wrap' and 'items-center'.
  const m = new RegExp(
    `<div class="([^"]*)">(?:<span class="ts-tm-checked" data-checked="${id}">([^<]*)</span>)?`
    + `<a href="[^"]+" rel="noopener" target="_blank" class="ts-tm-link" data-source="${id}">${SOURCE_LINK}</a></div>$`,
  ).exec(card);
  assert.ok(m, `${id}: the foot ends the card — the checked words if any, then the Source ↗ link`);
  assert.deepEqual(m[1].split(' '), ['ts-tm-row__foot'], `${id}: the foot sets the two on one line (.ts-tm-row__foot)`); // HOME-BRIEF-02 (2026-11-10): 'mt-auto' left with the card — a row of the list has no bottom edge to push its foot to
  return { checked: m[2] };
};
/** The card says the day it was checked once: in its foot (`expected`), or — when its line already says it — nowhere else. */
const saysCheckedOnce = (card: string, id: string, line: string, checkedOn: string, expected: string) => {
  const foot = footOf(card, id);
  if (line === notAnnouncedLine(checkedOn) || line === seasonNotAnnouncedLine(checkedOn)) { // EVENTS-04 (2026-11-09): either sentence says "checked"
    assert.equal(foot.checked, undefined, `${id}: its line already says "(checked …)" — no second one`);
    assert.equal(count(card, 'data-checked'), 0, `${id}: no checked words anywhere on the card`);
    return 'line';
  }
  assert.equal(foot.checked, expected, `${id}: the foot carries "${expected}", right before the Source ↗ link`);
  assert.equal(count(card, 'data-checked='), 1, `${id}: exactly one data-checked`);
  return 'foot';
};
const rowsOf = (category: string) => EXPERIENCES.filter((r) => r.category === category);

// ── T1 · THE CHECKED WORDS ───────────────────────────────────────────────────

test('T1 the checked words: "Checked <dayWords>" — "Checked Nov 8, 2026"', () => {
  assert.equal(checkedWords('2026-11-08'), SEASONS_CHECKED);
  assert.equal(checkedWords('2026-10-30'), 'Checked Oct 30, 2026');
  assert.equal(checkedWords('2026-11-08'), `Checked ${dayWords('2026-11-08')}`);
});

// ── T2 · SURF, AN EVENT CHIP ─────────────────────────────────────────────────

test('T2 Surf: an upcoming card says the day it was checked once, in its foot before its Source ↗ link; a not-announced card says it only in its line', () => {
  const html = render({ category: 'surfing' });
  const surf = rowsOf('surfing');
  assert.deepEqual([...cardsOf(html)].sort(), surf.map((r) => r.id).sort(), 'every Surf row is a card');
  const where: string[] = [];
  for (const r of surf) {
    const card = cardOf(html, r.id);
    const line = experienceLine(r, TODAY);
    assert.equal(lineIn(card), asHtml(line), `${r.id}: its line, as experienceLine prints it`);
    where.push(saysCheckedOnce(card, r.id, line, r.checkedOn, checkedWords(r.checkedOn)));
  }
  assert.equal(where.filter((w) => w === 'foot').length, 3, 'the three upcoming Surf cards each say the day they were checked in the foot');
  assert.equal(where.filter((w) => w === 'line').length, 3, 'the three not-announced Surf cards say it in their line');
  assert.equal(count(html, STRIP_LINE), 0, 'HOME-BRIEF-02 (2026-11-10): the strip line is gone — once, until then');
  assert.equal(count(html, asHtml(CLOSING_LINE)), 1, 'the events’ closing line, once');
  assert.ok(!html.includes(asHtml(SEASONS_CLOSING_LINE)));
  assert.ok(!html.includes('data-nothing-upcoming'));
});

// ── T3 · THE SEVEN SEASON CHIPS ──────────────────────────────────────────────

test('T3 the season chips: no "Nothing announced yet", no strip line (HOME-BRIEF-02, 2026-11-10), the seasons’ closing line; every card says it was checked Nov 8, 2026', () => {
  assert.equal(SEASONS_CLOSING_LINE, "Each window comes from the place's own source, with the day it was checked. Usual months are a guide, not set dates.", 'the ruled words');
  assert.equal(SEASON_IDS.length, 7, 'seven season categories');
  for (const id of SEASON_IDS) {
    const html = render({ category: id });
    assert.ok(!html.includes('data-nothing-upcoming') && !html.includes('Nothing announced yet'), `${id}: no "Nothing announced yet"`);
    assert.equal(count(html, STRIP_LINE), 0, `${id}: no strip line — HOME-BRIEF-02 (2026-11-10): once, after the row, until then`);
    assert.equal(count(html, asHtml(SEASONS_CLOSING_LINE)), 1, `${id}: the seasons’ closing line once`);
    assert.ok(!html.includes(asHtml(CLOSING_LINE)), `${id}: not the events’ closing line`);
    const rows = rowsOf(id);
    assert.ok(rows.length >= 3, `${id}: three or more cards`);
    assert.deepEqual([...cardsOf(html)].sort(), rows.map((r) => r.id).sort(), `${id}: every row is a card`);
    for (const r of rows) saysCheckedOnce(cardOf(html, r.id), r.id, experienceLine(r, TODAY), r.checkedOn, SEASONS_CHECKED);
  }
  // Snow resorts after every announced season has ended: those lines say "(checked …)" themselves; the usual window still
  // carries its checked words; nothing is upcoming, and the season chip still says no "Nothing announced yet".
  const late = render({ category: 'snow_resorts' }, AFTER_THE_SNOW);
  const snow = rowsOf('snow_resorts');
  const where = snow.map((r) => saysCheckedOnce(cardOf(late, r.id), r.id, experienceLine(r, AFTER_THE_SNOW), r.checkedOn, SEASONS_CHECKED));
  assert.deepEqual(
    snow.filter((r, i) => where[i] === 'line').map((r) => r.id).sort(),
    snow.filter((r) => r.status === 'announced').map((r) => r.id).sort(),
    'every announced season has ended by then; the usual window still says it in the foot',
  );
  assert.ok(where.includes('line') && where.includes('foot'), 'some cards say it in their line, some in the foot');
  assert.ok(!late.includes('data-nothing-upcoming'), 'nothing upcoming on a season chip still says no "Nothing announced yet"');
  assert.equal(count(late, STRIP_LINE), 0, 'no strip line — HOME-BRIEF-02 (2026-11-10)');
  assert.equal(count(late, asHtml(SEASONS_CLOSING_LINE)), 1);
  // A season chip whose row is empty: no card, so no strip line — still no "Nothing announced yet", and the seasons' closing line.
  const bare = render({ category: 'wildlife' }, TODAY, EXPERIENCES.filter((r) => r.category !== 'wildlife'));
  assert.equal(cardsOf(bare).length, 0, 'no wildlife row, no card');
  assert.ok(!bare.includes(STRIP_LINE), 'no card to book around, so no strip line');
  assert.ok(!bare.includes('data-nothing-upcoming'));
  assert.equal(count(bare, asHtml(SEASONS_CLOSING_LINE)), 1);
});

// ── T4 · GOLF AND THE REFUSED VIEW ───────────────────────────────────────────

test('T4 Golf with nothing upcoming and the refused view read exactly as before, with the events’ closing line', () => {
  const empty = render({ category: 'golf' }, GOLF_DAY);
  // HOME-BRIEF-03 (Alex, 2026-11-10): "the list below says" — "the cards below say" until then.
  assert.match(empty, /data-nothing-upcoming="true">Nothing announced yet in Golf — the list below says when each one was checked\.</);
  assert.equal(nothingUpcoming('Golf'), 'Nothing announced yet in Golf — the list below says when each one was checked.');
  assert.ok(empty.indexOf('data-nothing-upcoming') < empty.indexOf('data-coming-up-rail'), 'said above the row');
  assert.ok(!empty.includes(STRIP_LINE), 'nothing to book around, so no strip line');
  assert.equal(cardsOf(empty).length, 5, 'every golf card still shows');
  assert.ok(cardsOf(empty).every((id) => /^Next edition not announced \(checked /.test(lineIn(cardOf(empty, id)) ?? '')), 'every golf window has passed');
  for (const id of cardsOf(empty)) assert.equal(footOf(cardOf(empty, id), id).checked, undefined, `${id}: its line says it was checked — no second one`);
  assert.equal(count(empty, 'data-checked'), 0);
  assert.equal(count(empty, asHtml(CLOSING_LINE)), 1);
  assert.ok(!empty.includes(asHtml(SEASONS_CLOSING_LINE)));

  const bad = render({ refused: 'nope' });
  assert.ok(bad.includes('data-into-refused'), 'the refusal');
  assert.equal(count(bad, asHtml(CLOSING_LINE)), 1, 'the events’ closing line under the refusal');
  assert.ok(!bad.includes(asHtml(SEASONS_CLOSING_LINE)) && !bad.includes(STRIP_LINE) && !bad.includes('data-checked') && !bad.includes('data-nothing-upcoming'));
});

// ── T5 · THE SOURCE ──────────────────────────────────────────────────────────

test('T5 the section knows a season chip by its group from EXPERIENCE_CATEGORIES, reads the second "checked" off the line, and reads no clock', () => {
  const section = code(SECTION);
  assert.match(section, /EXPERIENCE_CATEGORIES\.some\(\(c\) => c\.id === into && c\.group === 'season'\)/, 'the group, read from EXPERIENCE_CATEGORIES');
  for (const id of SEASON_IDS) assert.ok(!section.includes(`'${id}'`) && !section.includes(`"${id}"`), `${id} is not typed in the section`);
  assert.match(section, /const lineSaysChecked = line === notAnnouncedLine\(row\.checkedOn\) \|\| line === seasonNotAnnouncedLine\(row\.checkedOn\);/, 'the second "checked" is read off the line — either sentence'); // EVENTS-04 (2026-11-09)
  assert.doesNotMatch(section, /\.status\b/, 'never a list of statuses');
  assert.match(section, /export function checkedWords\(checkedOn: string\): string \{\s*return `Checked \$\{dayWords\(checkedOn\)\}`;\s*\}/);
  assert.doesNotMatch(section, /new Date\(|Date\.now\(|toLocale|\bIntl\./, 'no clock, no locale');
});

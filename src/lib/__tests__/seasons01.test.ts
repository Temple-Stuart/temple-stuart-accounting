/**
 * SEASONS-01 (Alex, 2026-11-08 15:11 + 16:18; board K tag 5) — a SEASONS row under I'M INTO: seven season
 * categories, each with the places to go and their window, read on each place's own source the day checked; a
 * usual window is worded "Usually …", never as an announced date.
 *
 *   T1 the groups — the nineteen categories are 'event', then the seven 'season' ones in K's order; surfing first;
 *   T2 the law — it refuses 'typical' without dates, 'typical' on a row that is not a season, 'season' on an event
 *      category, an event row in a season category, and a season whose status is neither announced nor typical;
 *   T3 the words — "Usually Dec – Mar · per <source>" and "Season <dates> · per <source>", whatever the sourceKind; a
 *      typical row prints its line on a day after its end; a typical row is never upcoming; fixed, window and swell rows
 *      print as before; the leaf, the words and the section read no clock and no locale (no Intl. either);
 *   T4 the rows — every season row passes the law, is a season read on its place's own page (opened, pinned below,
 *      one by one), carries the run date, and prints its line; three to six per category, each in start order;
 *   T5 the section — the I'M INTO row holds the nineteen event chips and the SEASONS row the seven season chips, under
 *      its own visible label, with the same chip classes; picking a season chip shows its cards, each with its own line.
 * No live call, no database, no clock: the run date is written down, not read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EXPERIENCES, EXPERIENCE_CATEGORIES, experiencesLaw, type Experience } from '../experiences';
import { experienceLine, isUpcoming, seasonNotAnnouncedLine, usualWindowWords } from '../experienceWords'; // EVENTS-04 (2026-11-09): the ended season's own words (:141)
import { ExperiencesView, INTO_LABEL, SEASONS_LABEL, type IntoChoice } from '@/components/landing/ExperiencesSection';
import { code } from '../sourceText';

Object.assign(globalThis, { React });

const RUN_DATE = '2026-11-08';
const SEASONS = [
  ['snow_resorts', 'Snow resorts'], ['wildlife', 'Wildlife'], ['wonders', 'Wonders of the world'], ['surf_seasons', 'Surf seasons'],
  ['dive_seasons', 'Dive seasons'], ['northern_lights', 'Northern lights'], ['cherry_blossoms', 'Cherry blossoms'],
] as const;
const SEASON_IDS: readonly string[] = SEASONS.map(([id]) => id);
const SEASON_ROWS = EXPERIENCES.filter((r) => SEASON_IDS.includes(r.category));

/** Every page a season row links — each opened on 2026-11-08 and its window read there (the PR's report lists them, with the
 *  sentence each window came from). Hanifaru Bay left Dive seasons in review: its page says diving there is no longer allowed. */
const OPENED: readonly string[] = [
  'https://www.skiarlberg.at/en/st-anton/tickets-season-times/season-times',
  'https://www.matterhornparadise.ch/en/information/tickets-prices/ski-passes',
  'https://www.valdisere.com/en/val-disere-in-winter/skiing-winter-fun/ski-area-french-alps/',
  'https://www.niseko.ne.jp/en/lift/',
  'https://aspen.com/articles/winter-season-dates-pass-deadlines/',
  'https://www.whistler.com/blog/post/what-to-expect-in-whistler-winter/',
  'https://www.travelmanitoba.com/blog/the-ultimate-guide-to-polar-bear-season-in-churchill-manitoba/',
  'https://www.visittromso.no/whale-watching',
  'https://descubreanp.conanp.gob.mx/en/conanp/ANP?suri=108',
  'https://www.tanzaniaparks.go.tz/en/serengeti',
  'https://exploreparks.dbca.wa.gov.au/park/ningaloo-marine-park',
  'https://www.nps.gov/katm/learn/photosmultimedia/brown-bear-frequently-asked-questions.htm',
  'https://www.peru.travel/stories/machu-picchu-complete-guide-to-fully-enjoy-your-trip',
  'https://international.visitjordan.com/blog/external/7625/best-time-to-go-to-petra-jordan/',
  'https://www.tajmahal.gov.in/faqs.aspx',
  'https://english.visitbeijing.com.cn/article/47OOgdysDoS',
  'https://zimbabwetourism.net/victoria-falls-mosi-a-tunya/',
  'https://oceansafety.hawaii.gov/hawaiis-surf-seasons/',
  'https://www.centerofportugal.com/article/nazare-big-waves',
  'https://www.hossegor.fr/en/stays-and-surf-schools/',
  'https://www.indonesia.travel/gb/en/destination/bali-nusa-tenggara/bali/bali---suluban-beach',
  'https://www.tahititourisme.com/preparing-you-trip/when-to-visit-the-islands-of-tahiti/',
  'https://www.southafrica.net/gl/en/travel/article/some-of-the-world-s-best-surfing-jeffreys-bay',
  'https://www.australia.com/en/places/cairns-and-surrounds/guide-to-the-great-barrier-reef.html',
  'https://www.indonesia.travel/gb/en/travel-ideas/marine/discover-raja-ampat-travel-inspiration-to-indonesias-heavenly-eastern-archipelago',
  'https://ecuador.travel/galapagos-y-sus-tortugas-gigantes-2/',
  'https://descubreanp.conanp.gob.mx/swb/conanp/ANP?suri=143',
  'https://www.visittromso.no/northern-lights/when-and-where',
  'https://www.explorefairbanks.com/explore-the-area/aurora-season/',
  'https://www.visitrovaniemi.fi/seasons/northern-lights-season/',
  'https://www.visiticeland.com/article/northern-lights-in-iceland/',
  'https://visitsweden.com/where-to-go/northern-sweden/arctic-sweden/abisko-and-northern-lights/',
  'https://spectacularnwt.com/activities/aurora/',
  'https://www.nps.gov/subjects/cherryblossom/bloom-watch.htm',
  'https://www.japan.travel/en/spot/1675/',
  'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=1580801',
  'https://www.spain.info/en/calendar/fiesta-cherry-blossom/',
  'https://www.destinationvancouver.com/inspirations/city/20-best-places-to-see-cherry-blossoms-around-vancouver',
  'https://www.bonn.de/bonn-erleben/besichtigen-entdecken/kirschbluete.php?loc=en',
];

/** The rows per season category, counted — three to six each, none under three (SEASONS-01, CLOSED 4). */
const PER_CATEGORY: Readonly<Record<string, number>> = {
  snow_resorts: 6, wildlife: 6, wonders: 5, surf_seasons: 6, dive_seasons: 4, northern_lights: 6, cherry_blossoms: 6,
};

/** A fixture season row — the law's and the words' refusals are proved on it, never on a live row. */
const TYPICAL: Experience = {
  id: 'fixture-aurora', category: 'northern_lights', series: null, name: 'The aurora season', venue: 'Fixture Fjord', city: 'Fixture',
  country: 'Norway', countryCode: 'NO', start: '2026-09-01', end: '2027-04-30', windowKind: 'season', status: 'typical',
  sourceKind: 'official', sourceName: 'Visit Fixture', sourceUrl: 'https://example.org/aurora', checkedOn: RUN_DATE, notes: null,
};
const ANNOUNCED: Experience = {
  ...TYPICAL, id: 'fixture-lifts', category: 'snow_resorts', name: 'The lifts run', start: '2026-11-26', end: '2027-04-19', status: 'announced', sourceName: 'Fixture Resort',
};
const lawOver = (...rows: Experience[]) => experiencesLaw({ throwOnFail: false, rows });
const refuses = (row: Experience, words: string) => {
  const v = lawOver(row);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};
const render = (choice: IntoChoice) => renderToStaticMarkup(React.createElement(ExperiencesView, { rows: EXPERIENCES, today: RUN_DATE, choice, onPick: () => {} }));
/** React's escaping of text and attributes: the ampersand, then the apostrophe. */
const asHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;');
const chipsIn = (html: string, label: string) => {
  const group = new RegExp(`role="group" aria-label="${asHtml(label)}">([\\s\\S]*?)</div>`).exec(html);
  assert.ok(group, `the ${label} row is drawn`);
  return [...group[1].matchAll(/data-into="([^"]+)">([^<]*)</g)].map((m) => [m[1], m[2]]);
};
const cardsOf = (html: string) => [...html.matchAll(/data-coming-up="([^"]+)"/g)].map((m) => m[1]);
const lineOf = (html: string, id: string) => new RegExp(`data-coming-up="${id}"[\\s\\S]*?data-experience-line="true">([^<]*)<`).exec(html)?.[1];

// ── T1 · THE GROUPS ──────────────────────────────────────────────────────────

test('T1 the groups: the nineteen categories are events, then the seven seasons in K\'s order; surfing stays first', () => {
  assert.deepEqual(EXPERIENCE_CATEGORIES.slice(0, 19).map((c) => c.group), Array(19).fill('event'));
  assert.deepEqual(EXPERIENCE_CATEGORIES.slice(19).map((c) => [c.id, c.label, c.group]), SEASONS.map(([id, label]) => [id, label, 'season']));
  assert.equal(EXPERIENCE_CATEGORIES.length, 26);
  assert.equal(EXPERIENCE_CATEGORIES[0].id, 'surfing', 'the default does not change');
});

// ── T2 · THE LAW ─────────────────────────────────────────────────────────────

test('T2 the law: a typical season and an announced season pass; it refuses typical without dates, typical off a season, a season on an event category, an event row in a season category, a season neither announced nor typical', () => {
  assert.deepEqual(lawOver(TYPICAL), []);
  assert.deepEqual(lawOver(ANNOUNCED), []);
  refuses({ ...TYPICAL, start: null, end: null }, 'status typical with null dates');
  refuses({ ...TYPICAL, windowKind: 'window' }, 'status typical on windowKind window');
  refuses({ ...TYPICAL, category: 'surfing' }, 'windowKind season on category surfing, which is not a season category');
  refuses({ ...ANNOUNCED, windowKind: 'fixed' }, 'windowKind fixed in season category snow_resorts');
  refuses({ ...ANNOUNCED, status: 'conflict' }, 'windowKind season with status conflict');
  refuses({ ...TYPICAL, status: 'not_announced', start: null, end: null }, 'windowKind season with status not_announced');
  refuses({ ...TYPICAL, category: 'surfing', windowKind: 'fixed' }, 'status typical on windowKind fixed');
});

// ── T3 · THE WORDS ───────────────────────────────────────────────────────────

test('T3 the words: "Usually <Mon> – <Mon> · per <source>" whatever today is, "Season <dates> · per <source>" for published dates, whatever the sourceKind; never upcoming when typical; fixed, window and swell rows unchanged; no clock, no locale', () => {
  assert.equal(experienceLine({ ...TYPICAL, start: '2026-12-01', end: '2027-03-31' }, RUN_DATE), 'Usually Dec – Mar · per Visit Fixture');
  assert.equal(experienceLine(TYPICAL, RUN_DATE), 'Usually Sep – Apr · per Visit Fixture');
  assert.equal(experienceLine(TYPICAL, '2027-06-01'), 'Usually Sep – Apr · per Visit Fixture', 'a usual window does not expire: printed on a day after its end');
  assert.equal(experienceLine(ANNOUNCED, RUN_DATE), 'Season Nov 26, 2026 – Apr 19, 2027 · per Fixture Resort');
  assert.equal(experienceLine(ANNOUNCED, '2027-04-20'), seasonNotAnnouncedLine(ANNOUNCED.checkedOn), 'published dates past their end read the season\'s not-announced words'); // EVENTS-04 (2026-11-09): was notAnnouncedLine
  // CLOSED 3 gives the season lines one wording: a source that is not the place's own still reads "per" — its notes name it (CLOSED 4).
  assert.equal(experienceLine({ ...TYPICAL, sourceKind: 'secondary' }, RUN_DATE), 'Usually Sep – Apr · per Visit Fixture');
  assert.equal(experienceLine({ ...ANNOUNCED, sourceKind: 'secondary' }, RUN_DATE), 'Season Nov 26, 2026 – Apr 19, 2027 · per Fixture Resort');
  assert.equal(usualWindowWords('2027-04-01', '2027-04-30'), 'Usually Apr', 'one month, said once');
  assert.ok(!isUpcoming(TYPICAL, RUN_DATE) && !isUpcoming(TYPICAL, '2026-09-01'), 'a typical row is never upcoming');
  assert.ok(isUpcoming(ANNOUNCED, RUN_DATE));
  const live = (id: string) => { const r = EXPERIENCES.find((x) => x.id === id); assert.ok(r, id); return r; };
  assert.equal(experienceLine(live('philippines-pro-2026'), '2026-10-30'), 'Window Oct 30 – Nov 10, 2026 · window being confirmed');
  assert.equal(experienceLine(live('x-games-aspen-2027'), RUN_DATE), 'Jan 29–31, 2027 · per Aspen Snowmass');
  assert.equal(experienceLine(live('nazare-big-wave-2026-27'), RUN_DATE), 'Window Nov 1, 2026 – Mar 31, 2027 · reported by The Inertia, not yet confirmed by the organizer · called on a swell');
  // CLOSED 3: the leaf, the words and the section read no clock and no locale — no new Date(, Date.now, toLocale or Intl.
  for (const f of ['src/lib/experiences.ts', 'src/lib/experienceWords.ts', 'src/components/landing/ExperiencesSection.tsx']) {
    assert.doesNotMatch(code(f), /new Date\(|Date\.now\(|toLocale|\bIntl\./, `${f} reads no clock and no locale`);
  }
});

// ── T4 · THE ROWS ────────────────────────────────────────────────────────────

test('T4 the rows: three to six per season category, in start order, every one a season read on its place\'s own page (opened, pinned above), carrying the run date, passing the law, printing its line', () => {
  for (const [id] of SEASONS) {
    const n = SEASON_ROWS.filter((r) => r.category === id).length;
    assert.equal(n, PER_CATEGORY[id], `${id}: ${PER_CATEGORY[id]} rows`);
    assert.ok(n >= 3 && n <= 6, `${id}: three to six`);
    // The review (2026-11-08): the cards after the upcoming ones keep the leaf's order, so the leaf runs each category by start.
    const starts = SEASON_ROWS.filter((r) => r.category === id).map((r) => r.start);
    assert.ok(starts.every((s) => s !== null), `${id}: every row dated`);
    assert.deepEqual(starts, [...starts].sort(), `${id}: in start order`);
  }
  assert.equal(SEASON_ROWS.length, 39);
  assert.deepEqual(experiencesLaw({ throwOnFail: false, rows: SEASON_ROWS }), []);
  for (const r of SEASON_ROWS) {
    assert.equal(r.windowKind, 'season', `${r.id}: a season`);
    assert.ok(r.status === 'typical' || r.status === 'announced', `${r.id}: typical or announced`);
    assert.equal(r.sourceKind, 'official', `${r.id}: the place's own source`);
    assert.equal(r.series, null, `${r.id}: no series`);
    assert.equal(r.checkedOn, RUN_DATE, `${r.id}: read on the run date`);
    assert.ok(r.sourceUrl.startsWith('https://') && OPENED.includes(r.sourceUrl), `${r.id}: an https page that was opened`);
    const line = experienceLine(r, RUN_DATE);
    if (r.status === 'typical') assert.match(line, /^Usually [A-Z][a-z]{2}( – [A-Z][a-z]{2})? · per .+$/, `${r.id}: "${line}"`);
    else assert.match(line, /^Season [A-Z][a-z]{2} \d{1,2}, \d{4} – [A-Z][a-z]{2} \d{1,2}, \d{4} · per .+$/, `${r.id}: "${line}"`);
  }
  assert.deepEqual([...OPENED].sort(), [...new Set(SEASON_ROWS.map((r) => r.sourceUrl))].sort(), 'every opened page is a row\'s page, and every row\'s page was opened');
  assert.deepEqual(SEASON_ROWS.filter((r) => r.status === 'announced').map((r) => r.id), ['zermatt-ski-season-2026-27', 'aspen-mountain-ski-season-2026-27', 'val-disere-ski-season-2026-27', 'niseko-ski-season-2026-27', 'st-anton-ski-season-2026-27'], 'the five resorts that published this season\'s dates');
  // The review (2026-11-08): Zermatt's page text names 03 May 2027, its winter passes end 02 May 2027 — the passes' day is printed, the other named.
  const zermatt = SEASON_ROWS.find((r) => r.id === 'zermatt-ski-season-2026-27')!;
  assert.equal(experienceLine(zermatt, RUN_DATE), 'Season Nov 1, 2026 – May 2, 2027 · per Matterhorn Ski Paradise');
  assert.ok(zermatt.notes !== null && zermatt.notes.includes('03 May 2027'), 'the page text\'s other day is named in the notes');
  assert.ok(!SEASON_ROWS.some((r) => r.id === 'hanifaru-bay-mantas-2026'), 'no dive card for a bay where diving is no longer allowed');
  assert.equal(experienceLine(SEASON_ROWS.find((r) => r.id === 'bonn-cherry-blossoms-2027')!, RUN_DATE), 'Usually Apr · per Bundesstadt Bonn', 'a window inside one month, said once');
});

// ── T5 · THE SECTION ─────────────────────────────────────────────────────────

test('T5 the section: I\'M INTO holds the nineteen event chips, SEASONS the seven season chips — one choice across both rows; a season chip shows its cards with their own lines', () => {
  assert.equal(SEASONS_LABEL, 'SEASONS');
  const home = render({ category: 'surfing' });
  assert.deepEqual(chipsIn(home, INTO_LABEL), EXPERIENCE_CATEGORIES.slice(0, 19).map((c) => [c.id, asHtml(c.label)]));
  assert.deepEqual(chipsIn(home, SEASONS_LABEL), SEASONS.map(([id, label]) => [id, asHtml(label)]));
  assert.ok(home.indexOf(`aria-label="${asHtml(INTO_LABEL)}"`) < home.indexOf(`aria-label="${SEASONS_LABEL}"`), 'SEASONS sits under I\'M INTO');
  // The label is drawn, not only named for a screen reader: a <p> with the I'M INTO label's classes, right above its row.
  const labelClass = (text: string) => new RegExp(`<p class="([^"]*)">${asHtml(text)}</p><div class="[^"]*" role="group" aria-label="${asHtml(text)}">`).exec(home)?.[1];
  const seasonsLabel = labelClass(SEASONS_LABEL);
  const intoLabel = labelClass(INTO_LABEL);
  assert.ok(seasonsLabel && intoLabel, 'both labels are drawn, each right above its row');
  assert.equal(seasonsLabel.replace(/^mt-\d+ /, ''), intoLabel.replace(/^mt-\d+ /, ''), 'the SEASONS label is drawn with the I\'M INTO label\'s classes');
  // The same chip classes in either row: one class for every unpressed chip, and a pressed season chip wears the pressed event chip's.
  const classOf = (html: string, id: string) => new RegExp(`aria-pressed="(?:true|false)" class="([^"]*)" data-into="${id}"`).exec(html)?.[1];
  const offEvent = classOf(home, 'golf');
  const onEvent = classOf(home, 'surfing');
  assert.ok(offEvent && onEvent && offEvent !== onEvent);
  for (const [id] of SEASONS) assert.equal(classOf(home, id), offEvent, `${id}: the unpressed chip class`);
  assert.equal(classOf(render({ category: 'wildlife' }), 'wildlife'), onEvent, 'a pressed season chip wears the pressed chip class');
  for (const [id] of SEASONS) {
    const html = render({ category: id as Experience['category'] });
    assert.deepEqual([...html.matchAll(/aria-pressed="true"[^>]*data-into="([^"]*)"/g)].map((m) => m[1]), [id], `${id}: its chip pressed, alone`);
    const rows = SEASON_ROWS.filter((r) => r.category === id);
    assert.deepEqual(cardsOf(html).sort(), rows.map((r) => r.id).sort(), `${id}: its cards`);
    for (const r of rows) assert.equal(lineOf(html, r.id), asHtml(experienceLine(r, RUN_DATE)), `${r.id}: its own line`);
  }
});

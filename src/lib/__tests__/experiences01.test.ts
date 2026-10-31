/**
 * EVENTS-01 (Alex, 2026-10-30) — the experiences leaf, its law, the words, the section
 * under the strip, the strip's Events mode and the pins that moved.
 * EVENTS-01b (Alex, 2026-10-30) — the filter is forced to one category (no all-categories
 * view: the default is the leaf's first category, a bad value is refused with no
 * substitute), every row is its own pill (the series summary and its fixtures left with the
 * function), a conflict pill says only that, and the strip's Events mode names its anchor
 * per surface (T6 renders the builder's two shapes).
 * WASHERE-01 (Alex, 2026-10-31) — `featured` left the rows: Alex's own stop is the trip
 * log's (wasHere01.test.ts). COMING UP is the category's upcoming rows unfiltered, so Surf
 * shows the Philippines Pro first while it is on; the refused state is the refusal only.
 *
 *   T1 the law — every refusal by name over injected rows; the live rows pass;
 *   T2 the rows — the count, three exact rows, the categories in the ruled order;
 *   T3 the words — dateWords, experienceLine, upcoming, the pills;
 *   T4 the section, rendered — COMING UP, the chips, the lineup,
 *      the refusal of an unknown ?into=, the empty state; its source reads no clock
 *      and carries no urgency word;
 *   T5 the mount and the day rule — Landing mounts the section once, after the demo's
 *      footer row and before the guest strip; today flows page → GuestLanding → Landing;
 *      the plan law's tells stay out of Landing's code;
 *   T6 the strip's Events mode — both shapes, rendered — its two callers and its dated re-pins.
 * No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import {
  EXPERIENCES, EXPERIENCE_CATEGORIES, EXPERIENCE_FIELDS, VENUE_NOT_FIXED, ExperiencesLawError,
  experiencesLaw, isExperienceCategoryId, type Experience,
} from '../experiences';
import { dateWords, dayWords, experienceLine, lineupPill, upcoming } from '../experienceWords';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';
import {
  ExperiencesView, DEFAULT_INTO, EVENTS_ANCHOR, CLOSING_LINE, STRIP_LINE, notACategory, nothingUpcoming,
} from '@/components/landing/ExperiencesSection';

Object.assign(globalThis, { React });

const LEAF = 'src/lib/experiences.ts';
const WORDS = 'src/lib/experienceWords.ts';
const SECTION = 'src/components/landing/ExperiencesSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const GUEST = 'src/components/landing/GuestLanding.tsx';
const PAGE = 'src/app/page.tsx';
const STRIP = 'src/components/trips/travelStripModes.tsx';
const LANDING_BOOKING = 'src/components/landing/LandingBookingSection.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const ROOT = resolve(__dirname, '../../..');
const PINS = 'src/lib/travelBookingFlow.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const TODAY = '2026-10-30';

const row = (id: string): Experience => {
  const found = EXPERIENCES.find((r) => r.id === id);
  if (!found) throw new Error(`${id} is not a row`);
  return found;
};
const render = (props: Partial<React.ComponentProps<typeof ExperiencesView>> = {}) =>
  renderToStaticMarkup(React.createElement(ExperiencesView, { rows: EXPERIENCES, today: TODAY, choice: { category: DEFAULT_INTO }, onPick: () => {}, ...props }));
const pillsOf = (html: string) => [...html.matchAll(/data-pill="([^"]+)"[^>]*>([^<]*)</g)].map((m) => [m[1], m[2]] as const);
const cardsOf = (html: string) => [...html.matchAll(/data-coming-up="([^"]+)"/g)].map((m) => m[1]);
const pressedOf = (html: string) => [...html.matchAll(/aria-pressed="true"[^>]*data-into="([^"]*)"/g)].map((m) => m[1]);

/** The contiguous comment block directly above a pin line (the hotel02 test's helper, verbatim). */
function noteBlockOver(pins: string, notes: string, pinLine: number): string {
  const codeLines = pins.split('\n');
  const noteLines = notes.split('\n');
  const block: string[] = [];
  for (let i = pinLine - 2; i >= 0 && codeLines[i].trim() === ''; i--) block.unshift(noteLines[i]);
  return block.join('\n');
}

// ── T1 · THE LAW ─────────────────────────────────────────────────────────────

const PHIL = row('philippines-pro-2026');
const BASE = row('sls-tokyo-2026');
const lawOver = (...rows: Experience[]) => experiencesLaw({ throwOnFail: false, rows });
const refuses = (rows: Experience[], words: string) => {
  const v = lawOver(...rows);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};

test('T1 the live rows pass the law, and the law throws by default on a failure', () => {
  assert.deepEqual(experiencesLaw({ throwOnFail: false }), []);
  assert.throws(() => experiencesLaw({ rows: [PHIL, { ...BASE, id: PHIL.id }] }), ExperiencesLawError);
  assert.deepEqual(lawOver(PHIL, BASE), []);
});

test('T1 every refusal, by name', () => {
  refuses([PHIL, BASE, { ...BASE }], 'duplicate id');
  refuses([PHIL, { ...BASE, category: 'chess' as Experience['category'] }], 'is not in EXPERIENCE_CATEGORIES');
  for (const field of ['name', 'venue', 'city', 'country', 'sourceName'] as const) refuses([PHIL, { ...BASE, [field]: '  ' }], `empty ${field}`);
  refuses([PHIL, { ...BASE, venue: VENUE_NOT_FIXED }], 'not fixed is allowed only while not_announced');
  refuses([PHIL, { ...BASE, city: VENUE_NOT_FIXED }], 'not fixed is allowed only while not_announced');
  assert.deepEqual(lawOver(PHIL, { ...BASE, venue: VENUE_NOT_FIXED, city: VENUE_NOT_FIXED, start: null, end: null, status: 'not_announced' }), [], 'not fixed is allowed while not_announced');
  refuses([PHIL, { ...BASE, countryCode: 'jp' }], 'not two upper-case letters');
  refuses([PHIL, { ...BASE, countryCode: 'JPN' }], 'not two upper-case letters');
  refuses([PHIL, { ...BASE, sourceUrl: 'http://www.streetleague.com/tokyo2026' }], 'does not start with https://');
  refuses([PHIL, { ...BASE, checkedOn: '30/10/2026' }], 'is not YYYY-MM-DD');
  refuses([PHIL, { ...BASE, checkedOn: '2026-13-01' }], 'is not YYYY-MM-DD');
  refuses([PHIL, { ...BASE, start: '2026-11-15' }], 'is after end');
  refuses([PHIL, { ...BASE, end: null }], 'not both YYYY-MM-DD (or both null)');
  refuses([PHIL, { ...BASE, start: '14 Nov 2026', end: '14 Nov 2026' }], 'not both YYYY-MM-DD (or both null)');
  refuses([PHIL, { ...BASE, start: null, end: null }], 'status announced with null dates');
  refuses([PHIL, { ...BASE, start: null, end: null, status: 'conflict' }], 'status conflict with null dates');
  refuses([PHIL, { ...BASE, status: 'not_announced' }], 'status not_announced with dates');
  refuses([PHIL, { ...BASE, windowKind: 'swell', status: 'conflict' }], 'windowKind swell on a row whose status is conflict');
  refuses([PHIL, { ...BASE, windowKind: 'swell', status: 'not_announced', start: null, end: null }], 'windowKind swell on a row whose status is not_announced');
  refuses([PHIL, BASE, { ...BASE, id: 'sls-tokyo-2026-again' }], 'shares (category, name, start)');
  refuses([PHIL, { ...BASE, extra: true } as unknown as Experience], 'exactly the seventeen ruled fields');
  assert.equal(EXPERIENCE_FIELDS.length, 17, 'WASHERE-01: the pinned-card field left the row');
});

// ── T2 · THE ROWS ────────────────────────────────────────────────────────────

test('T2 the categories, in the ruled order, with their EVENTS-01b labels; the default is the FIRST of them, derived, and it is surfing', () => {
  assert.deepEqual(EXPERIENCE_CATEGORIES.map((c) => [c.id, c.label]), [
    ['surfing', 'Surf'], ['snowboarding', 'Snow'], ['skate', 'Skate'], ['golf', 'Golf'], ['f1', 'F1'],
    ['moto', 'Moto'], ['tennis', 'Tennis'], ['fighting', 'Fighting'], ['music_art', 'Music & art'],
  ]);
  assert.ok(isExperienceCategoryId('f1') && !isExperienceCategoryId('nope') && !isExperienceCategoryId(null));
  assert.equal(DEFAULT_INTO, EXPERIENCE_CATEGORIES[0].id);
  assert.equal(DEFAULT_INTO, 'surfing', 'reordering EXPERIENCE_CATEGORIES changes the default — a conscious change');
  assert.match(code(SECTION), /export const DEFAULT_INTO: ExperienceCategoryId = EXPERIENCE_CATEGORIES\[0\]\.id;/, 'derived from the list, not typed');
});

test('T2 the rows: the ruling\'s DATA block transcribed whole, every checkedOn 2026-10-30, no pinned-card field', () => {
  // EVENTS-01 (2026-10-30): the ruling wrote "Row count: 73" above a DATA block that holds 74 rows
  // (6 surfing · 5 snowboarding · 4 skate · 5 golf · 24 f1 · 4 moto · 5 tennis · 11 fighting · 10 music_art).
  // The block is the data and was transcribed verbatim — no row dropped to meet the number; the number is
  // reported as the ruling's miscount, and this pin holds the block's own count.
  assert.equal(EXPERIENCES.length, 74);
  assert.ok(EXPERIENCES.every((r) => !('featured' in r)), 'WASHERE-01: no row carries the pinned-card field');
  assert.ok(EXPERIENCES.every((r) => r.checkedOn === '2026-10-30'));
  assert.equal(EXPERIENCES.filter((r) => r.category === 'f1').length, 24);
  assert.deepEqual(row('philippines-pro-2026'), {
    id: 'philippines-pro-2026', category: 'surfing', series: 'WSL Championship Tour', name: 'Philippines Pro presented by the Philippine Sports Commission',
    venue: 'Cloud 9', city: 'General Luna, Siargao', country: 'Philippines', countryCode: 'PH', start: '2026-10-30', end: '2026-11-10',
    windowKind: 'window', status: 'conflict', sourceKind: 'secondary', sourceName: 'Daily Tribune (WSL announcement)',
    sourceUrl: 'https://tribune.net.ph/2026/07/20/philippines-to-host-first-world-surf-league-championship-tour', checkedOn: '2026-10-30',
    notes: 'A Championship Tour stop from 2026; the WSL announcement gives Oct 31 – Nov 10 and two late reports give Oct 30 – Nov 8',
  });
  assert.deepEqual(row('tomorrowland-2027'), {
    id: 'tomorrowland-2027', category: 'music_art', series: 'Tomorrowland', name: 'Tomorrowland 2027', venue: 'De Schorre', city: 'Boom', country: 'Belgium',
    countryCode: 'BE', start: null, end: null, windowKind: 'fixed', status: 'not_announced', sourceKind: 'official', sourceName: 'Tomorrowland',
    sourceUrl: 'https://www.tomorrowland.com', checkedOn: '2026-10-30', notes: 'The 2026 dates were announced Dec 4, 2025',
  });
  assert.deepEqual(row('rizin-nye-2026'), {
    id: 'rizin-nye-2026', category: 'fighting', series: 'RIZIN', name: 'RIZIN NYE in Nagoya', venue: 'Vantelin Dome Nagoya', city: 'Nagoya', country: 'Japan',
    countryCode: 'JP', start: '2026-12-31', end: '2026-12-31', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'RIZIN',
    sourceUrl: 'https://www.rizin.tv/products/rizin-nye-in-nagoya', checkedOn: '2026-10-30', notes: 'In Nagoya this year, not Saitama',
  });
});

// ── T3 · THE WORDS ───────────────────────────────────────────────────────────

test('T3 dateWords: same month, cross-month, one day, cross-year, Feb 28 → Mar 1, Dec → Jan; malformed and reversed refused', () => {
  assert.equal(dateWords('2026-12-08', '2026-12-20'), 'Dec 8–20, 2026');
  assert.equal(dateWords('2026-10-31', '2026-11-10'), 'Oct 31 – Nov 10, 2026');
  assert.equal(dateWords('2026-11-14', '2026-11-14'), 'Nov 14, 2026');
  assert.equal(dateWords('2026-11-01', '2027-03-31'), 'Nov 1, 2026 – Mar 31, 2027');
  assert.equal(dateWords('2028-02-28', '2028-03-01'), 'Feb 28 – Mar 1, 2028');
  assert.equal(dateWords('2026-12-30', '2027-01-02'), 'Dec 30, 2026 – Jan 2, 2027');
  assert.equal(dayWords('2026-10-30'), 'Oct 30, 2026');
  assert.throws(() => dateWords('2026-11-10', '2026-10-31'), /is after end/);
  assert.throws(() => dateWords('31/10/2026', '2026-11-10'), /is not YYYY-MM-DD/);
  assert.throws(() => dayWords('2026-13-01'), /not a calendar date/);
});

test('T3 experienceLine: official, secondary, conflict, swell, window, not announced, and a window that has passed', () => {
  assert.equal(experienceLine(row('x-games-aspen-2027'), TODAY), 'Jan 29–31, 2027 · per Aspen Snowmass');
  assert.equal(experienceLine(row('masters-2027'), TODAY), 'Apr 8–11, 2027 · reported by Golf Digest (citing Augusta National), not yet confirmed by the organizer');
  assert.equal(experienceLine(row('philippines-pro-2026'), TODAY), 'Window Oct 30 – Nov 10, 2026 · window being confirmed');
  assert.equal(experienceLine(row('nazare-big-wave-2026-27'), TODAY), 'Window Nov 1, 2026 – Mar 31, 2027 · reported by The Inertia, not yet confirmed by the organizer · called on a swell');
  assert.equal(experienceLine(row('pipe-masters-2026'), TODAY), 'Window Dec 8–20, 2026 · reported by Freesurf Magazine, not yet confirmed by the organizer');
  assert.equal(experienceLine(row('tomorrowland-2027'), TODAY), 'Next edition not announced (checked Oct 30, 2026)');
  assert.equal(experienceLine(row('pipe-masters-2026'), '2026-12-21'), 'Next edition not announced (checked Oct 30, 2026)');
  assert.equal(experienceLine(row('pipe-masters-2026'), '2026-12-20'), 'Window Dec 8–20, 2026 · reported by Freesurf Magazine, not yet confirmed by the organizer', 'the last day is still the window');
});

test('T3 upcoming: announced and conflict rows whose end is today or later, by start, the first n', () => {
  assert.deepEqual(upcoming(EXPERIENCES, TODAY, 3).map((r) => r.id), ['philippines-pro-2026', 'ufc-fn-2026-10-31', 'nazare-big-wave-2026-27']);
  assert.equal(upcoming(EXPERIENCES, TODAY, 6).length, 6);
  assert.ok(upcoming(EXPERIENCES, '2026-11-14', EXPERIENCES.length).some((r) => r.id === 'sls-tokyo-2026'), 'on the day itself the window is open');
  assert.ok(!upcoming(EXPERIENCES, '2026-11-15', EXPERIENCES.length).some((r) => r.id === 'sls-tokyo-2026'), 'the day after it is not');
  assert.ok(!upcoming(EXPERIENCES, TODAY, EXPERIENCES.length).some((r) => r.status === 'not_announced'));
  const starts = upcoming(EXPERIENCES, TODAY, EXPERIENCES.length).map((r) => r.start as string);
  assert.deepEqual(starts, [...starts].sort());
});

test('T3 the lineup pills: dates and provenance, or "not announced"; a conflict pill says only that (EVENTS-01b)', () => {
  assert.equal(lineupPill(row('x-games-aspen-2027'), TODAY), 'MoonPay X Games Aspen 2027 · Aspen · Jan 29–31, 2027');
  assert.equal(lineupPill(row('pipe-masters-2026'), TODAY), 'Pipe Masters · Haleiwa, O\'ahu · Dec 8–20, 2026 · reported');
  const conflict = lineupPill(row('philippines-pro-2026'), TODAY);
  assert.equal(conflict, 'Philippines Pro presented by the Philippine Sports Commission · General Luna, Siargao · Oct 30 – Nov 10, 2026 · window being confirmed');
  assert.ok(!conflict.includes('reported'), 'a conflict is unconfirmed by definition — no "reported"');
  assert.equal(lineupPill(row('us-open-tennis-2027'), TODAY), 'US Open 2027 · not announced');
  assert.equal(lineupPill(row('pipe-masters-2026'), '2026-12-21'), 'Pipe Masters · not announced');
});

// ── T4 · THE SECTION, RENDERED ───────────────────────────────────────────────

test('T4 rendered with no choice named: Surf — three upcoming cards with the Philippines Pro first, nine chips with Surf pressed, six surf pills, the two lines, no all-categories word, nothing of Alex\'s', () => {
  const html = render();
  assert.match(html, /<section id="events" aria-label="Book the experience"/);
  assert.equal(EVENTS_ANCHOR, 'events');
  assert.doesNotMatch(html, /I WAS HERE|I&#x27;M HERE|data-featured|Siargao in the middle|href="#demo"/, 'WASHERE-01: the pinned card and Alex\'s line left for the trip log');
  assert.match(html, /Window Oct 30 – Nov 10, 2026 · window being confirmed/);
  assert.match(html, /Cloud 9 · General Luna, Siargao, Philippines/);
  assert.deepEqual(cardsOf(html), ['philippines-pro-2026', 'nazare-big-wave-2026-27', 'pipe-masters-2026'], 'the category\'s upcoming rows, unfiltered, by start');
  assert.equal((html.match(/aria-pressed="(true|false)"/g) ?? []).length, 9, 'nine categories, nothing else');
  assert.deepEqual(pressedOf(html), ['surfing']);
  assert.match(html, /aria-pressed="true"[^>]*data-into="surfing">Surf</);
  assert.ok(!html.includes('Everything'), 'the all-categories word is gone from the markup');
  assert.ok(!html.includes('data-into=""'));
  assert.ok(html.includes(STRIP_LINE));
  assert.ok(html.includes(CLOSING_LINE.replace("'", '&#x27;')));
  assert.equal((html.match(/data-lineup="/g) ?? []).length, 1);
  assert.match(html, /data-lineup="Surf"/);
  const pills = pillsOf(html);
  assert.deepEqual(pills.map(([id]) => id), ['philippines-pro-2026', 'pipe-masters-2026', 'nazare-big-wave-2026-27', 'us-open-of-surfing-2027', 'tahiti-pro-2027', 'rip-curl-pro-bells-2027']);
  assert.ok(pills[0][1].endsWith('· Oct 30 – Nov 10, 2026 · window being confirmed') && !pills[0][1].includes('reported'));
  assert.equal(pills.filter(([, words]) => words.endsWith('· not announced')).length, 3);
  assert.doesNotMatch(html, /data-series-pill/, 'nothing collapses');
  assert.match(html, /<a href="https:\/\/tribune\.net\.ph\/[^"]+" rel="noopener" target="_blank"[^>]*data-pill="philippines-pro-2026">/);
  assert.doesNotMatch(html, /data-into-refused/);
  assert.doesNotMatch(html, /<img|countdown|BUY NOW/i);
});

test('T4 rendered for f1, fighting and tennis: every row its own pill — 24 F1 cities, 11 fights, 5 tennis; six cards with Bahrain first', () => {
  const f1 = render({ choice: { category: 'f1' } });
  assert.equal(pillsOf(f1).length, 24);
  assert.deepEqual(cardsOf(f1), ['f1-2027-r01', 'f1-2027-r02', 'f1-2027-r03', 'f1-2027-r04', 'f1-2027-r05', 'f1-2027-r06']);
  assert.deepEqual(pressedOf(f1), ['f1']);
  assert.equal((f1.match(/data-lineup="/g) ?? []).length, 1);
  assert.equal(pillsOf(render({ choice: { category: 'fighting' } })).length, 11);
  const tennis = render({ choice: { category: 'tennis' } });
  assert.equal(pillsOf(tennis).length, 5);
  assert.match(tennis, />US Open 2027 · not announced</);
  assert.deepEqual(pressedOf(tennis), ['tennis']);
  assert.equal(cardsOf(tennis).length, 4, 'four tennis editions are upcoming');
});

test('T4 rendered for a value that names no category: the refusal only — in place of COMING UP and THE LINEUP, no chip pressed, no card above it; nothing upcoming said', () => {
  const bad = render({ choice: { refused: 'nope' } });
  assert.match(bad, /data-into-refused="true">nope is not a category — pick one above\.</);
  assert.equal(notACategory('nope'), 'nope is not a category — pick one above.');
  assert.deepEqual(pressedOf(bad), [], 'no substitute category');
  assert.equal((bad.match(/aria-pressed="false"/g) ?? []).length, 9);
  assert.doesNotMatch(bad, /data-featured|<article/, 'no card above the refusal');
  assert.equal(cardsOf(bad).length, 0);
  assert.equal(pillsOf(bad).length, 0);
  assert.doesNotMatch(bad, /data-coming-up-grid|data-lineup=|COMING UP|THE LINEUP/);
  assert.ok(bad.includes(CLOSING_LINE.replace("'", '&#x27;')));
  const empty = render({ choice: { category: 'golf' }, today: '2027-12-31' });
  assert.match(empty, /data-nothing-upcoming="true">Nothing announced yet in Golf — the rows below say when each one was checked\.</);
  assert.equal(nothingUpcoming('Golf'), 'Nothing announced yet in Golf — the rows below say when each one was checked.');
  assert.ok(!empty.includes(STRIP_LINE), 'the strip line sits under a grid, and there is none');
  assert.equal(pillsOf(empty).filter(([, words]) => words.endsWith('· not announced')).length, 5, 'every golf window has passed');
  // The URL half: no param, or an empty one, is the default — never a refusal.
  const section = code(SECTION);
  assert.match(section, /raw === null \|\| raw === '' \? \{ category: DEFAULT_INTO \}/);
  assert.match(section, /isExperienceCategoryId\(raw\) \? \{ category: raw \} : \{ refused: raw \}/);
});

test('T4 the section, the words and the leaf read no clock; the section carries no urgency word, no image and no emoji', () => {
  for (const f of [LEAF, WORDS, SECTION]) assert.doesNotMatch(code(f), /new Date\(|Date\.now\(|toLocale/, `${f} reads no clock and no locale`);
  const section = code(SECTION);
  assert.doesNotMatch(section, /BUY NOW|countdown|don.t miss out/i);
  assert.ok(!section.includes('Everything'), 'EVENTS-01b: no all-categories view, and not the word either');
  assert.doesNotMatch(section, /\bfree\b/i);
  assert.doesNotMatch(section, /<img|next\/image|localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(section, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'no emoji');
  assert.match(section, /useSearchParams\(\)/);
  assert.match(section, /router\.replace\(/);
  assert.match(section, /min-h-\[44px\]/);
  assert.match(section, /grid-cols-\[repeat\(auto-fit,minmax\(min\(300px,100%\),1fr\)\)\]/);
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b/, 'zero new hex');
});

// ── T5 · THE MOUNT AND THE DAY RULE ──────────────────────────────────────────

test('T5 Landing mounts the section once, after the demo\'s footer row and before the guest strip; the guest law\'s pinned lines are untouched', () => {
  const landing = code(LANDING);
  const mount = '<ExperiencesSection today={today} />';
  assert.equal((landing.match(/<ExperiencesSection today=\{today\}/g) ?? []).length, 1);
  const tripRow = landing.indexOf('One trip holds everything — plans, bookings, budget.');
  const mountAt = landing.indexOf(mount);
  const stripAt = landing.indexOf('<GuestTripStrip');
  assert.ok(tripRow > -1 && mountAt > tripRow && stripAt > mountAt, 'demo footer row → experiences → guest strip');
  assert.equal((landing.match(/<LandingBookingSection onRequireAuth=\{onRequireAuth\} \/>/g) ?? []).length, 1);
  assert.match(landing, /<GuestBookingLookup onOpened=\{\(\) => window\.location\.assign\('\/booking\/manage'\)\} \/>/);
  assert.match(landing, /import ExperiencesSection from '\.\/ExperiencesSection';/);
  assert.match(landing, /  today: string;\n\}/);
  assert.match(landing, /export default function Landing\(\{ onRequireAuth, onRequireLogin, logoAvailability, today \}: Props\)/);
  assert.match(comments(LANDING), /EXPERIENCES {9}— the events section under the strip \(EVENTS-01\)/);
  assert.match(comments(LANDING), /live demo \| experiences {2}→ the demo act's border-b \(EVENTS-01/);
});

test('T5 the day rule: page.tsx computes today once as the UTC calendar date and passes it down; nothing reads the clock below it', () => {
  const page = code(PAGE);
  assert.match(page, /const today = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);/);
  assert.equal((page.match(/new Date\(\)/g) ?? []).length, 1, 'once');
  assert.match(page, /return <GuestLanding offerAvailability=\{offerAvailability\} logoAvailability=\{logoAvailability\} today=\{today\} \/>;/);
  const guest = code(GUEST);
  assert.match(guest, /today: string;/);
  assert.match(guest, /<Landing\n\s+logoAvailability=\{logoAvailability\}\n\s+today=\{today\}/);
  assert.doesNotMatch(guest, /new Date\(/);
  assert.doesNotMatch(code(LANDING), /new Date\(/);
  const law = code(LAW);
  assert.match(law, /violations\.push\(\.\.\.experiencesLaw\(\{ throwOnFail: false \}\)\);/);
  assert.match(law, /<ExperiencesSection today=\\\{today\\\}/);
  assert.match(law, /const today = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);/);
});

test('T5 the plan law\'s tells stay out of Landing\'s code', () => {
  const landing = code(LANDING);
  for (const tell of ['SIX LIVES', 'PERSONAS', 'Who is this for?', 'heroCountsLine', 'statusCounts', 'numberWord', 'tools, counted']) {
    assert.ok(!landing.includes(tell), `Landing.tsx code carries "${tell}"`);
  }
});

// ── T6 · THE STRIP'S EVENTS MODE AND ITS RE-PIN ──────────────────────────────

/** travelStripModes.tsx:181–187 at main f1c63aef, verbatim (git show f1c63aef:src/components/trips/travelStripModes.tsx | sed -n '181,187p'). */
const F1C63AEF_EVENTS_MODE = [
  `    { key: 'events', label: 'Events', badge: SOON_BADGE, icon: <CalendarDays className={ICON_CLASS} strokeWidth={1.75} aria-hidden="true" />,`,
  `      headline: 'Events — coming soon.', panel: (`,
  `      <ComingSoonSection`,
  `        title="Events"`,
  `        explainer="Concerts, shows, and live events wherever you're headed."`,
  `      />`,
  `    ) },`,
].join('\n');

test('T6 the Events mode, both shapes: eventsAnchor null is the f1c63aef mode byte for byte (text and render); a string is the jump panel whose link names it; the other seven modes do not move', async () => {
  const strip = code(STRIP);
  assert.ok(strip.includes(F1C63AEF_EVENTS_MODE), 'the seven f1c63aef lines stand in the file verbatim');
  assert.match(strip, /eventsAnchor: `#\$\{string\}` \| null;/, 'required — no ?, no default');
  assert.doesNotMatch(strip, /eventsAnchor\?:|eventsAnchor = |eventsAnchor \?\?/);
  assert.match(strip, /\.\.\.\(eventsAnchor === null \? EVENTS_MODE_SOON : \[\{ key: 'events', label: 'Events', icon:/);
  // Rendered — the launcher's tree renders JSX at module scope (SOON_BADGE), so React is on the global before the dynamic import (the trips01 convention).
  const { travelStripModes } = await import('../../components/trips/travelStripModes');
  const { default: ComingSoonSection } = await import('../../components/home/ComingSoonSection');
  const soonModes = travelStripModes({ onRequireAuth: () => {}, eventsAnchor: null });
  const jumpModes = travelStripModes({ onRequireAuth: () => {}, eventsAnchor: '#events' });
  assert.deepEqual(soonModes.map((m) => [m.key, m.label]), jumpModes.map((m) => [m.key, m.label]));
  assert.deepEqual(soonModes.map((m) => m.key), ['flights', 'hotels', 'transit', 'activities', 'visa', 'insurance', 'esim', 'events']);
  const soon = soonModes.find((m) => m.key === 'events')!;
  const insurance = soonModes.find((m) => m.key === 'insurance')!;
  assert.equal(soon.headline, 'Events — coming soon.');
  assert.equal(soon.explainer, undefined);
  assert.equal(renderToStaticMarkup(soon.badge as React.ReactElement), renderToStaticMarkup(insurance.badge as React.ReactElement), 'the same SOON_BADGE node');
  assert.match(renderToStaticMarkup(soon.badge as React.ReactElement), />Soon</);
  assert.equal(
    renderToStaticMarkup(soon.panel as React.ReactElement),
    renderToStaticMarkup(React.createElement(ComingSoonSection, { title: 'Events', explainer: "Concerts, shows, and live events wherever you're headed." })),
    'the ComingSoonSection panel, byte for byte',
  );
  const jump = jumpModes.find((m) => m.key === 'events')!;
  assert.equal(jump.badge, undefined);
  assert.equal(jump.headline, 'Events — book around them.');
  const panel = renderToStaticMarkup(jump.panel as React.ReactElement);
  assert.match(panel, /data-events-mode="true"/);
  assert.match(panel, /The experiences are right below this strip\./);
  assert.match(panel, /<a href="#events"[^>]*>Jump to them ↓<\/a>/);
  assert.match(panel, /min-h-\[44px\]/);
  for (const key of ['insurance', 'esim']) {
    const a = soonModes.find((m) => m.key === key)!;
    const b = jumpModes.find((m) => m.key === key)!;
    assert.equal(renderToStaticMarkup(a.panel as React.ReactElement), renderToStaticMarkup(b.panel as React.ReactElement));
    assert.match(renderToStaticMarkup(a.badge as React.ReactElement), />Soon</);
  }
});

test('T6 the two callers name their surface: the guest landing passes #events (held equal to the section\'s anchor), the travel tab passes null; nothing else calls the builder', () => {
  assert.match(code(LANDING_BOOKING), /travelStripModes\(\{ onRequireAuth, authed: false, eventsAnchor: '#events' \}\)/);
  assert.equal('#events', `#${EVENTS_ANCHOR}`);
  assert.match(code(LAUNCHER), /\.\.\.travelStripModes\(\{\s*onRequireAuth,\s*authed,\s*currentTrip,\s*onCommitted: \(\) => setTripsRefresh\(\(n\) => n \+ 1\),\s*eventsAnchor: null,\s*\}\)/);
  const callers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = `${dir}/${name}`;
      if (statSync(abs).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(abs); continue; }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const rel = abs.replace(`${ROOT}/`, '');
      if (code(rel).includes('travelStripModes(')) callers.push(rel);
    }
  };
  walk(resolve(ROOT, 'src'));
  assert.deepEqual(callers.sort(), [LANDING_BOOKING, LAUNCHER, STRIP].sort(), 'the definition and exactly two callers');
});

test('T6 the pin holds, dated twice: the strip hashes to its EVENTS-01b pin; EVENTS-01\'s note still stands; each names the hash it had on main', () => {
  const pin = BOOKING_FLOW_FILES.find((p) => p.file === STRIP);
  assert.ok(pin, 'the strip is pinned');
  assert.equal(bookingFlowSha256(rejoin(code(STRIP), comments(STRIP))), pin.sha256);
  assert.notEqual(pin.sha256, '034fad01ae1bed8946ae5af5f2dacc239fe373ea3f69d5d7aedb129e89fd67b1', 'the hash moved with the bytes');
  assert.notEqual(pin.sha256, 'ed3e4fa32aae451885b69ba12055383b13960375d30acc611bf14d73c7a002fb', 'and again with EVENTS-01b');
  const pins = code(PINS);
  const notes = comments(PINS);
  const pinAt = pins.indexOf(`{ file: '${STRIP}', sha256: '`);
  const pinLine = pins.slice(0, pinAt).split('\n').length;
  const above = noteBlockOver(pins, notes, pinLine);
  assert.match(above, /EVENTS-01 \(2026-10-30\): re-pinned — [^\n]+\. Display is not booking; no prebook\/book\/pay\/cancel call changed\.\n[^\n]*Was 034fad01ae1bed8946ae5af5f2dacc239fe373ea3f69d5d7aedb129e89fd67b1 at main f1c63aef\./);
  assert.match(above, /ACTIVITY-01 \(2026-09-22\): re-dated — [^\n]+\n[^\n]*Was [0-9a-f]{64} at main dfc02881\./, 'the earlier note still stands over the pin');
  assert.match(above, /EVENTS-01b \(2026-10-30\): re-pinned — [^\n]+\. Display is not booking; no prebook\/book\/pay\/cancel call changed\.\n[^\n]*Was ed3e4fa32aae451885b69ba12055383b13960375d30acc611bf14d73c7a002fb at main c3a02894\./);
  assert.equal((notes.match(/EVENTS-01 \(2026-10-30\): re-pinned/g) ?? []).length, 1, 'one file re-pinned by EVENTS-01');
  assert.equal((notes.match(/EVENTS-01b \(2026-10-30\): re-pinned/g) ?? []).length, 1, 'one file re-pinned by EVENTS-01b');
  assert.match(BOOKING_FLOW_BASE, /the strip re-pinned by EVENTS-01 \(2026-10-30\), the Events mode points at the experiences section under it — display is not booking; the strip re-pinned by EVENTS-01b \(2026-10-30\), the Events mode names its anchor per surface — display is not booking/);
  for (const other of BOOKING_FLOW_FILES) {
    if (other.file === STRIP) continue;
    assert.equal(bookingFlowSha256(rejoin(code(other.file), comments(other.file))), other.sha256, `${other.file} is untouched`);
  }
});

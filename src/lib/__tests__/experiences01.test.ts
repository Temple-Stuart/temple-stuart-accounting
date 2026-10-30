/**
 * EVENTS-01 (Alex, 2026-10-30) — the experiences leaf, its law, the words, the section
 * under the strip, the strip's Events mode and the pins that moved.
 *
 *   T1 the law — every refusal by name over injected rows; the live rows pass;
 *   T2 the rows — the count, three exact rows, the categories in the ruled order;
 *   T3 the words — dateWords, experienceLine, upcoming, seriesSummary, the pills;
 *   T4 the section, rendered — the featured card, COMING UP, the chips, the lineup,
 *      the refusal of an unknown ?into=, the empty state; its source reads no clock
 *      and carries no urgency word;
 *   T5 the mount and the day rule — Landing mounts the section once, after the demo's
 *      footer row and before the guest strip; today flows page → GuestLanding → Landing;
 *      the plan law's tells stay out of Landing's code;
 *   T6 the strip's Events mode and its dated re-pin.
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
import {
  SERIES_COLLAPSE_OVER, dateWords, dayWords, experienceLine, lineupPill, seriesPill, seriesSummary, upcoming,
} from '../experienceWords';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';
import {
  ExperiencesView, EVENTS_ANCHOR, I_WAS_HERE_LINE, CLOSING_LINE, STRIP_LINE, notACategory, nothingUpcoming,
} from '@/components/landing/ExperiencesSection';

Object.assign(globalThis, { React });

const LEAF = 'src/lib/experiences.ts';
const WORDS = 'src/lib/experienceWords.ts';
const SECTION = 'src/components/landing/ExperiencesSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const GUEST = 'src/components/landing/GuestLanding.tsx';
const PAGE = 'src/app/page.tsx';
const STRIP = 'src/components/trips/travelStripModes.tsx';
const PINS = 'src/lib/travelBookingFlow.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const TODAY = '2026-10-30';

const row = (id: string): Experience => {
  const found = EXPERIENCES.find((r) => r.id === id);
  if (!found) throw new Error(`${id} is not a row`);
  return found;
};
const render = (props: Partial<React.ComponentProps<typeof ExperiencesView>> = {}) =>
  renderToStaticMarkup(React.createElement(ExperiencesView, { rows: EXPERIENCES, today: TODAY, into: null, badInto: null, onPick: () => {}, ...props }));

/** The contiguous comment block directly above a pin line (the hotel02 test's helper, verbatim). */
function noteBlockOver(pins: string, notes: string, pinLine: number): string {
  const codeLines = pins.split('\n');
  const noteLines = notes.split('\n');
  const block: string[] = [];
  for (let i = pinLine - 2; i >= 0 && codeLines[i].trim() === ''; i--) block.unshift(noteLines[i]);
  return block.join('\n');
}

// ── T1 · THE LAW ─────────────────────────────────────────────────────────────

const FEATURED = row('philippines-pro-2026');
const BASE = row('sls-tokyo-2026');
const lawOver = (...rows: Experience[]) => experiencesLaw({ throwOnFail: false, rows });
const refuses = (rows: Experience[], words: string) => {
  const v = lawOver(...rows);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};

test('T1 the live rows pass the law, and the law throws by default on a failure', () => {
  assert.deepEqual(experiencesLaw({ throwOnFail: false }), []);
  assert.throws(() => experiencesLaw({ rows: [FEATURED, { ...BASE, id: FEATURED.id }] }), ExperiencesLawError);
  assert.deepEqual(lawOver(FEATURED, BASE), []);
});

test('T1 every refusal, by name', () => {
  refuses([FEATURED, BASE, { ...BASE }], 'duplicate id');
  refuses([FEATURED, { ...BASE, category: 'chess' as Experience['category'] }], 'is not in EXPERIENCE_CATEGORIES');
  for (const field of ['name', 'venue', 'city', 'country', 'sourceName'] as const) refuses([FEATURED, { ...BASE, [field]: '  ' }], `empty ${field}`);
  refuses([FEATURED, { ...BASE, venue: VENUE_NOT_FIXED }], 'not fixed is allowed only while not_announced');
  refuses([FEATURED, { ...BASE, city: VENUE_NOT_FIXED }], 'not fixed is allowed only while not_announced');
  assert.deepEqual(lawOver(FEATURED, { ...BASE, venue: VENUE_NOT_FIXED, city: VENUE_NOT_FIXED, start: null, end: null, status: 'not_announced' }), [], 'not fixed is allowed while not_announced');
  refuses([FEATURED, { ...BASE, countryCode: 'jp' }], 'not two upper-case letters');
  refuses([FEATURED, { ...BASE, countryCode: 'JPN' }], 'not two upper-case letters');
  refuses([FEATURED, { ...BASE, sourceUrl: 'http://www.streetleague.com/tokyo2026' }], 'does not start with https://');
  refuses([FEATURED, { ...BASE, checkedOn: '30/10/2026' }], 'is not YYYY-MM-DD');
  refuses([FEATURED, { ...BASE, checkedOn: '2026-13-01' }], 'is not YYYY-MM-DD');
  refuses([FEATURED, { ...BASE, start: '2026-11-15' }], 'is after end');
  refuses([FEATURED, { ...BASE, end: null }], 'not both YYYY-MM-DD (or both null)');
  refuses([FEATURED, { ...BASE, start: '14 Nov 2026', end: '14 Nov 2026' }], 'not both YYYY-MM-DD (or both null)');
  refuses([FEATURED, { ...BASE, start: null, end: null }], 'status announced with null dates');
  refuses([FEATURED, { ...BASE, start: null, end: null, status: 'conflict' }], 'status conflict with null dates');
  refuses([FEATURED, { ...BASE, status: 'not_announced' }], 'status not_announced with dates');
  refuses([FEATURED, { ...BASE, windowKind: 'swell', status: 'conflict' }], 'windowKind swell on a row whose status is conflict');
  refuses([FEATURED, { ...BASE, windowKind: 'swell', status: 'not_announced', start: null, end: null }], 'windowKind swell on a row whose status is not_announced');
  refuses([FEATURED, BASE, { ...BASE, id: 'sls-tokyo-2026-again' }], 'shares (category, name, start)');
  refuses([BASE], 'featured rows');
  refuses([FEATURED, { ...BASE, featured: true }], 'featured rows');
  refuses([FEATURED, { ...BASE, extra: true } as unknown as Experience], 'exactly the eighteen ruled fields');
  assert.equal(EXPERIENCE_FIELDS.length, 18);
});

// ── T2 · THE ROWS ────────────────────────────────────────────────────────────

test('T2 the categories, in the ruled order, with their labels', () => {
  assert.deepEqual(EXPERIENCE_CATEGORIES.map((c) => [c.id, c.label]), [
    ['surfing', 'Surfing'], ['snowboarding', 'Snowboarding'], ['skate', 'Skate'], ['golf', 'Golf'], ['f1', 'F1'],
    ['moto', 'Moto'], ['tennis', 'Tennis'], ['fighting', 'Fighting'], ['music_art', 'Music & art'],
  ]);
  assert.ok(isExperienceCategoryId('f1') && !isExperienceCategoryId('nope') && !isExperienceCategoryId(null));
});

test('T2 the rows: the ruling\'s DATA block transcribed whole, one featured, every checkedOn 2026-10-30', () => {
  // EVENTS-01 (2026-10-30): the ruling wrote "Row count: 73" above a DATA block that holds 74 rows
  // (6 surfing · 5 snowboarding · 4 skate · 5 golf · 24 f1 · 4 moto · 5 tennis · 11 fighting · 10 music_art).
  // The block is the data and was transcribed verbatim — no row dropped to meet the number; the number is
  // reported as the ruling's miscount, and this pin holds the block's own count.
  assert.equal(EXPERIENCES.length, 74);
  assert.deepEqual(EXPERIENCES.filter((r) => r.featured).map((r) => r.id), ['philippines-pro-2026']);
  assert.ok(EXPERIENCES.every((r) => r.checkedOn === '2026-10-30'));
  assert.equal(EXPERIENCES.filter((r) => r.category === 'f1').length, 24);
  assert.deepEqual(row('philippines-pro-2026'), {
    id: 'philippines-pro-2026', category: 'surfing', series: 'WSL Championship Tour', name: 'Philippines Pro presented by the Philippine Sports Commission',
    venue: 'Cloud 9', city: 'General Luna, Siargao', country: 'Philippines', countryCode: 'PH', start: '2026-10-30', end: '2026-11-10',
    windowKind: 'window', status: 'conflict', sourceKind: 'secondary', sourceName: 'Daily Tribune (WSL announcement)',
    sourceUrl: 'https://tribune.net.ph/2026/07/20/philippines-to-host-first-world-surf-league-championship-tour', checkedOn: '2026-10-30',
    notes: 'A Championship Tour stop from 2026; the WSL announcement gives Oct 31 – Nov 10 and two late reports give Oct 30 – Nov 8', featured: true,
  });
  assert.deepEqual(row('tomorrowland-2027'), {
    id: 'tomorrowland-2027', category: 'music_art', series: 'Tomorrowland', name: 'Tomorrowland 2027', venue: 'De Schorre', city: 'Boom', country: 'Belgium',
    countryCode: 'BE', start: null, end: null, windowKind: 'fixed', status: 'not_announced', sourceKind: 'official', sourceName: 'Tomorrowland',
    sourceUrl: 'https://www.tomorrowland.com', checkedOn: '2026-10-30', notes: 'The 2026 dates were announced Dec 4, 2025', featured: false,
  });
  assert.deepEqual(row('rizin-nye-2026'), {
    id: 'rizin-nye-2026', category: 'fighting', series: 'RIZIN', name: 'RIZIN NYE in Nagoya', venue: 'Vantelin Dome Nagoya', city: 'Nagoya', country: 'Japan',
    countryCode: 'JP', start: '2026-12-31', end: '2026-12-31', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'RIZIN',
    sourceUrl: 'https://www.rizin.tv/products/rizin-nye-in-nagoya', checkedOn: '2026-10-30', notes: 'In Nagoya this year, not Saitama', featured: false,
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

test('T3 seriesSummary: F1 collapses to 24 rounds over Mar 12 – Dec 12, 2027; a series of three does not collapse', () => {
  const f1 = seriesSummary(EXPERIENCES.filter((r) => r.category === 'f1'), TODAY);
  assert.equal(f1.length, 1);
  assert.deepEqual(f1[0], {
    name: '2027 FIA Formula One World Championship', count: 24, unit: 'rounds', first: 'Mar 12–14, 2027', last: 'Dec 10–12, 2027',
    span: 'Mar 12 – Dec 12, 2027', sourceUrl: 'https://www.formula1.com/en/racing/2027',
  });
  assert.equal(seriesPill(f1[0]), '2027 FIA Formula One World Championship · 24 rounds · Mar 12 – Dec 12, 2027');
  assert.equal(SERIES_COLLAPSE_OVER, 3);
  assert.deepEqual(seriesSummary(EXPERIENCES.filter((r) => r.category === 'tennis'), TODAY), [], 'the Grand Slam has three upcoming rows — not collapsed');
  const fighting = seriesSummary(EXPERIENCES.filter((r) => r.category === 'fighting'), TODAY);
  assert.deepEqual(fighting.map((s) => [s.name, s.count, s.unit]), [['UFC', 6, 'events']]);
});

test('T3 the lineup pills: dates and provenance, or "not announced"', () => {
  assert.equal(lineupPill(row('x-games-aspen-2027'), TODAY), 'MoonPay X Games Aspen 2027 · Aspen · Jan 29–31, 2027');
  assert.equal(lineupPill(row('pipe-masters-2026'), TODAY), 'Pipe Masters · Haleiwa, O\'ahu · Dec 8–20, 2026 · reported');
  assert.equal(lineupPill(row('philippines-pro-2026'), TODAY), 'Philippines Pro presented by the Philippine Sports Commission · General Luna, Siargao · Oct 30 – Nov 10, 2026 · reported · window being confirmed');
  assert.equal(lineupPill(row('us-open-tennis-2027'), TODAY), 'US Open 2027 · not announced');
  assert.equal(lineupPill(row('pipe-masters-2026'), '2026-12-21'), 'Pipe Masters · not announced');
});

// ── T4 · THE SECTION, RENDERED ───────────────────────────────────────────────

test('T4 rendered for Everything: the featured card, six upcoming cards with Oct 31 first, ten chips, the F1 pill, the two lines', () => {
  const html = render();
  assert.match(html, /<section id="events" aria-label="Book the experience"/);
  assert.equal(EVENTS_ANCHOR, 'events');
  assert.match(html, /I WAS HERE/);
  assert.match(html, /data-featured="philippines-pro-2026"/);
  assert.match(html, /Window Oct 30 – Nov 10, 2026 · window being confirmed/);
  assert.match(html, /Cloud 9 · General Luna, Siargao, Philippines/);
  assert.ok(html.includes(I_WAS_HERE_LINE.replace("'", '&#x27;')), 'Alex\'s line, once');
  assert.match(html, /href="#demo"/);
  const cards = [...html.matchAll(/data-coming-up="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(cards.length, 6);
  assert.equal(cards[0], 'ufc-fn-2026-10-31', 'the featured row is the card above, so Oct 31 comes first');
  assert.ok(!cards.includes('philippines-pro-2026'));
  assert.equal((html.match(/aria-pressed="(true|false)"/g) ?? []).length, 10, 'Everything plus nine categories');
  assert.match(html, /aria-pressed="true"[^>]*data-into="">Everything</);
  assert.ok(html.includes(STRIP_LINE));
  assert.ok(html.includes(CLOSING_LINE.replace("'", '&#x27;')));
  assert.match(html, /data-series-pill="2027 FIA Formula One World Championship"[^>]*>2027 FIA Formula One World Championship · 24 rounds · Mar 12 – Dec 12, 2027</);
  assert.equal((html.match(/data-series-pill=/g) ?? []).length, 3, 'F1, UFC and Art Basel collapse; nothing else has more than three upcoming rows');
  assert.ok(!html.includes('data-pill="f1-2027-r01"'), 'a collapsed series draws no row pills');
  assert.match(html, /<a href="https:\/\/www\.tomorrowland\.com" rel="noopener" target="_blank"[^>]*data-pill="tomorrowland-2027">Tomorrowland 2027 · not announced</);
  assert.doesNotMatch(html, /data-into-refused/);
  assert.doesNotMatch(html, /<img|countdown|BUY NOW/i);
});

test('T4 rendered for ?into=tennis: only tennis — five pills, the US Open reading not announced; ?into=nope refused by name; nothing upcoming said', () => {
  const tennis = render({ into: 'tennis' });
  assert.equal((tennis.match(/data-pill="/g) ?? []).length, 5);
  assert.equal((tennis.match(/data-lineup="/g) ?? []).length, 1);
  assert.match(tennis, /data-lineup="Tennis"/);
  assert.match(tennis, />US Open 2027 · not announced</);
  assert.doesNotMatch(tennis, /data-series-pill/);
  assert.match(tennis, /aria-pressed="true"[^>]*data-into="tennis"/);
  assert.equal((tennis.match(/data-coming-up="/g) ?? []).length, 4, 'four tennis editions are upcoming');
  const bad = render({ badInto: 'nope' });
  assert.match(bad, /data-into-refused="true">nope is not a category</);
  assert.equal(notACategory('nope'), 'nope is not a category');
  assert.match(bad, /aria-pressed="true"[^>]*data-into="">Everything</, 'Everything shown beside the refusal');
  const empty = render({ into: 'golf', today: '2027-12-31' });
  assert.match(empty, /data-nothing-upcoming="true">Nothing announced yet in Golf — the rows below say when each one was checked\.</);
  assert.equal(nothingUpcoming('Golf'), 'Nothing announced yet in Golf — the rows below say when each one was checked.');
  assert.ok(!empty.includes(STRIP_LINE), 'the strip line sits under a grid, and there is none');
});

test('T4 the section, the words and the leaf read no clock; the section carries no urgency word, no image and no emoji', () => {
  for (const f of [LEAF, WORDS, SECTION]) assert.doesNotMatch(code(f), /new Date\(|Date\.now\(|toLocale/, `${f} reads no clock and no locale`);
  const section = code(SECTION);
  assert.doesNotMatch(section, /BUY NOW|countdown|don.t miss out/i);
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

test('T6 the Events mode: key and label kept, no badge, the new headline, its own panel with the jump link; insurance and esim unchanged', () => {
  const strip = code(STRIP);
  const from = strip.indexOf("{ key: 'events'");
  const to = strip.indexOf('    ) },', from);
  assert.ok(from > -1 && to > from);
  const events = strip.slice(from, to);
  assert.match(events, /\{ key: 'events', label: 'Events', icon:/);
  assert.doesNotMatch(events, /badge:|ComingSoonSection|coming soon/);
  assert.match(events, /headline: 'Events — book around them\.'/);
  assert.match(events, /The experiences are right below this strip\./);
  assert.match(events, /href="#events"/);
  assert.match(events, /min-h-\[44px\]/);
  assert.match(events, /Jump to them ↓/);
  for (const key of ['insurance', 'esim']) {
    const at = strip.indexOf(`{ key: '${key}'`);
    const block = strip.slice(at, strip.indexOf('    ) },', at));
    assert.match(block, /badge: SOON_BADGE/);
    assert.match(block, /<ComingSoonSection/);
  }
  assert.match(strip, /import ComingSoonSection from '@\/components\/home\/ComingSoonSection';/);
});

test('T6 the pin holds, dated: the strip hashes to its EVENTS-01 pin, the note names why and the hash it had on main f1c63aef', () => {
  const pin = BOOKING_FLOW_FILES.find((p) => p.file === STRIP);
  assert.ok(pin, 'the strip is pinned');
  assert.equal(bookingFlowSha256(rejoin(code(STRIP), comments(STRIP))), pin.sha256);
  assert.notEqual(pin.sha256, '034fad01ae1bed8946ae5af5f2dacc239fe373ea3f69d5d7aedb129e89fd67b1', 'the hash moved with the bytes');
  const pins = code(PINS);
  const notes = comments(PINS);
  const pinAt = pins.indexOf(`{ file: '${STRIP}', sha256: '`);
  const pinLine = pins.slice(0, pinAt).split('\n').length;
  const above = noteBlockOver(pins, notes, pinLine);
  assert.match(above, /EVENTS-01 \(2026-10-30\): re-pinned — [^\n]+\. Display is not booking; no prebook\/book\/pay\/cancel call changed\.\n[^\n]*Was 034fad01ae1bed8946ae5af5f2dacc239fe373ea3f69d5d7aedb129e89fd67b1 at main f1c63aef\./);
  assert.match(above, /ACTIVITY-01 \(2026-09-22\): re-dated — [^\n]+\n[^\n]*Was [0-9a-f]{64} at main dfc02881\./, 'the earlier note still stands over the pin');
  assert.equal((notes.match(/EVENTS-01 \(2026-10-30\): re-pinned/g) ?? []).length, 1, 'one file re-pinned by EVENTS-01');
  assert.match(BOOKING_FLOW_BASE, /the strip re-pinned by EVENTS-01 \(2026-10-30\), the Events mode points at the experiences section under it — display is not booking/);
  for (const other of BOOKING_FLOW_FILES) {
    if (other.file === STRIP) continue;
    assert.equal(bookingFlowSha256(rejoin(code(other.file), comments(other.file))), other.sha256, `${other.file} is untouched`);
  }
});

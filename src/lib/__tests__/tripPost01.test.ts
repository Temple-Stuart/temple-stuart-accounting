/**
 * TRIPPOST-01 (Alex, 2026-11-05) — the Canggu post on its own page; the trip cards in a grid,
 * the Canggu card opening it.
 *
 *   T1 the two laws — the live entries pass; each throws by default; every refusal by name over
 *      injected cards and posts;
 *   T2 the Canggu entry — thirty days Jul 1 → 30, each once, in four weeks of 7, 7, 7 and 9; 77
 *      chips; ten lessons; seven picks; the stay and the costs in cents;
 *   T3 the words — every line exact, the weekdays by arithmetic, the lookups; the words module and
 *      the date module read no clock and no locale; the words import the leaves as types only;
 *   T4 the view, rendered — the back link, the title, the photo (TRIPPHOTO-01), all thirty stories
 *      once, four weeks with only the first open, 77 chips, the three event links, the band's link,
 *      the order;
 *   T5 the route and the door — static params, dynamicParams = false, '/my-trip' public and
 *      nothing else with it, the page route listed, the law seated after the trip log's;
 *   T6 the cards — the grid; Canggu's post block and no DID, LEARNED or WHAT WAS ON; Da Nang and
 *      Bangkok keep their pills; the section never imports the post body.
 * TRIPCARDS-01 (Alex, 2026-11-05) — every stop has a page, and its card is "destination, stay /
 *   bike / and flight in": the costs leaf (a row for every stop) and its law; the card leaf gone —
 *   the post's title lives in the post (a post carries ten fields); the scooter left the Canggu
 *   post's own costs; a page for a stop not written up (booked ahead, or lived and not yet
 *   written); Alex's line, the event the stop was around (its window with no day in it) and
 *   DID / LEARNED on the stop's page, never the card; every card's costs and its "Read the
 *   post"; the labels from the server's day (T7).
 * No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code } from '../sourceText';
import { WAS_HERE, type WasHereRow } from '../wasHere';
import { onPill, stayWords } from '../wasHereWords';
import { existsSync } from 'node:fs';
import { experienceWindowLine, shortDayWords, weekdayWords } from '../experienceWords';
import { EXPERIENCES, type Experience } from '../experiences';
import { TRIP_POSTS, TRIP_POST_FIELDS, TripPostsLawError, postOf, tripPostsLaw, type TripPost } from '../tripPosts';
import { TRIP_COSTS, TRIP_COST_FIELDS, TripCostsLawError, costsOf, tripCostsLaw, type TripCosts } from '../tripCosts';
import {
  NOT_APPLICABLE, NOT_IN_LOG, STOP_COST_LABELS, UNWRITTEN_COST_NOTE, bookLine, chipLabel, costRows, dayLabel, postEyebrow, postMeta, stopCostRows, stopHeading, stopNumber,
  tripPostHref, unwrittenLine, weekCount, weekEyebrow, writtenLine,
} from '../tripPostWords';
import TripPostView, { BOOK_HREF, DID, LEARNED, POST_BACK, POST_BACK_HREF } from '@/components/trip/TripPostView';
import { WasHereView, MY_TRIP_LINE, READ_THE_POST } from '@/components/landing/WasHereSection';
import * as PostPage from '@/app/my-trip/[id]/page';

Object.assign(globalThis, { React });

const CARDS = 'src/lib/tripPostCards.ts'; // TRIPCARDS-01: gone — the post's title lives in the post.
const POSTS = 'src/lib/tripPosts.ts';
const WORDS = 'src/lib/tripPostWords.ts';
const DATE_WORDS = 'src/lib/experienceWords.ts';
const VIEW = 'src/components/trip/TripPostView.tsx';
const PAGE = 'src/app/my-trip/[id]/page.tsx';
const SECTION = 'src/components/landing/WasHereSection.tsx';
const MIDDLEWARE = 'src/middleware.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const TODAY = '2026-11-05';
const ID = 'canggu-2026-07';

const rowOf = (id: string): WasHereRow => {
  const found = WAS_HERE.find((r) => r.id === id);
  if (!found) throw new Error(`${id} is not a stop`);
  return found;
};
const POST: TripPost = TRIP_POSTS[0];
const ROW = rowOf(ID);
const costsFor = (id: string): TripCosts => {
  const found = costsOf(id);
  if (!found) throw new Error(`${id} has no costs`);
  return found;
};
const COSTS = costsFor(ID);
/** The event a stop names, as the page resolves it (TRIPCARDS-01). */
const eventFor = (id: string): Experience | null => {
  const r = rowOf(id);
  if (r.experienceId === null) return null;
  const found = EXPERIENCES.find((e) => e.id === r.experienceId);
  if (!found) throw new Error(`${id}: ${r.experienceId} is not an event`);
  return found;
};
/** Every stop, in trip order (TRIPCARDS-01: the three booked ahead after Siargao). */
const STOPS = ['canggu-2026-07', 'danang-2026-08', 'bangkok-2026-09', 'phuket-2026-10', 'chiangmai-2026-10', 'bangkok-2026-10-21', 'siargao-2026', 'cebu-2026-11', 'uluwatu-2026-11', 'pererenan-2026-12'];
const days = (post: TripPost) => post.weeks.flatMap((w) => w.days);
/** React's own escaping of text: & < > " ' (renderToStaticMarkup). */
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const pos = (hay: string, needle: string) => { const i = hay.indexOf(needle); assert.ok(i > -1, `${needle} is rendered`); return i; };

/** A small valid post the refusals mutate — two weeks of one day each. */
const FIX: TripPost = {
  stopId: 'lisbon-2026', title: 'Three weeks in Lisbon.', dek: 'Three weeks.', short: [{ label: 'Best day', value: 'the tram' }], lessons: [{ lead: 'Go early.', rest: 'The queue is long.' }],
  costs: [{ what: 'The tram pass', detail: 'Seven days', amountCents: 1250 }, { what: 'Bike', detail: 'Belém', amountCents: null }], costNote: 'From the log.',
  weeks: [
    { title: 'Arriving', days: [{ date: '2026-09-01', story: 'Landed.', chips: [{ kind: 'brunch', value: 'A café' }, { kind: 'dinner', value: 'A tasca' }] }] },
    { title: 'Leaving', days: [{ date: '2026-09-08', story: 'Left.', chips: [] }] },
  ],
  picks: [{ heading: 'Food', items: ['Pastel de nata'] }], writtenOn: '2026-09-21',
};
const postsOver = (...posts: TripPost[]) => tripPostsLaw({ throwOnFail: false, posts });
const refusesPost = (post: TripPost, words: string) => {
  const v = postsOver(post);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};
const withDay = (patch: Record<string, unknown>): TripPost => ({ ...FIX, weeks: [{ ...FIX.weeks[0], days: [{ ...FIX.weeks[0].days[0], ...patch } as TripPost['weeks'][0]['days'][0]] }, FIX.weeks[1]] });

// ── T1 · THE TWO LAWS ────────────────────────────────────────────────────────

test('T1 the live post and costs pass their laws; each law throws by default; the fixture passes; the card leaf is gone (TRIPCARDS-01)', () => {
  assert.deepEqual(tripPostsLaw({ throwOnFail: false }), []);
  assert.deepEqual(postsOver(FIX), []);
  assert.throws(() => tripPostsLaw({ posts: [{ ...FIX, dek: '' }] }), TripPostsLawError);
  assert.deepEqual(tripCostsLaw({ throwOnFail: false }), []);
  assert.throws(() => tripCostsLaw({ rows: [{ ...COSTS, stopId: '' }] }), TripCostsLawError);
  assert.deepEqual([...TRIP_COST_FIELDS], ['stopId', 'stay', 'moto', 'flightIn']);
  assert.deepEqual([...TRIP_POST_FIELDS], ['stopId', 'title', 'dek', 'short', 'lessons', 'costs', 'costNote', 'weeks', 'picks', 'writtenOn'], 'TRIPCARDS-01: the title moved in from the card leaf');
  assert.equal(existsSync(CARDS), false, 'TRIPCARDS-01: a card shows only the stop and its costs — the card leaf left with the post block');
});

test('T1 every costs refusal, by name (TRIPCARDS-01)', () => {
  const costsOver = (...rows: TripCosts[]) => tripCostsLaw({ throwOnFail: false, rows });
  const refusesCosts = (row: TripCosts, words: string) => {
    const v = costsOver(row);
    assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
  };
  refusesCosts({ ...COSTS, stopId: '' }, 'empty stopId');
  refusesCosts({ ...COSTS, grab: { kind: 'none' } } as unknown as TripCosts, 'a row carries exactly the four ruled fields');
  assert.ok(costsOver(COSTS, COSTS).some((l) => l.includes('duplicate stopId')));
  refusesCosts({ ...COSTS, moto: { kind: 'free' } } as unknown as TripCosts, 'moto kind "free" is not paid | none | unknown');
  refusesCosts({ ...COSTS, stay: { kind: 'paid', name: '', amountCents: 1 } }, 'stay has an empty name');
  for (const bad of [0, -1, 1.5, '70814']) refusesCosts({ ...COSTS, flightIn: { kind: 'paid', name: 'China Air', amountCents: bad as number } }, 'flightIn amountCents');
  refusesCosts({ ...COSTS, stay: { kind: 'paid', name: 'x', amountCents: 1, nights: 3 } } as unknown as TripCosts, 'a paid line is exactly kind, name, amountCents');
  refusesCosts({ ...COSTS, moto: { kind: 'none', name: 'Grab' } } as unknown as TripCosts, 'it carries its kind only');
  assert.deepEqual(costsOver({ stopId: 'x-2026', stay: { kind: 'unknown' }, moto: { kind: 'none' }, flightIn: { kind: 'unknown' } }), [], 'none and unknown carry their kind only');
});

test('T1 every post refusal, by name', () => {
  refusesPost({ ...FIX, stopId: '' }, 'empty stopId');
  refusesPost({ ...FIX, extra: 1 } as unknown as TripPost, 'a post carries exactly the ten ruled fields');
  refusesPost(Object.fromEntries(Object.entries(FIX).filter(([k]) => k !== 'title')) as unknown as TripPost, 'a post carries exactly the ten ruled fields');
  refusesPost({ ...FIX, title: ' ' }, 'empty title');
  assert.ok(postsOver(FIX, FIX).some((l) => l.includes('duplicate stopId')));
  refusesPost({ ...FIX, dek: '' }, 'empty dek');
  refusesPost({ ...FIX, costNote: '' }, 'empty costNote');
  refusesPost({ ...FIX, writtenOn: '2026-9-21' }, 'writtenOn "2026-9-21" is not YYYY-MM-DD');
  refusesPost({ ...FIX, short: [] }, 'no short entries');
  refusesPost({ ...FIX, short: [{ label: '', value: 'x' }] }, 'short[0] has an empty label');
  refusesPost({ ...FIX, short: [{ label: 'x', value: '' }] }, 'short[0] has an empty value');
  refusesPost({ ...FIX, lessons: [] }, 'no lessons');
  refusesPost({ ...FIX, lessons: [{ lead: '', rest: 'x' }] }, 'lessons[0] has an empty lead');
  refusesPost({ ...FIX, lessons: [{ lead: 'x', rest: '' }] }, 'lessons[0] has an empty rest');
  refusesPost({ ...FIX, costs: [{ what: '', detail: 'x', amountCents: 1 }] }, 'costs[0] has an empty what');
  refusesPost({ ...FIX, costs: [{ what: 'x', detail: '', amountCents: 1 }] }, 'costs[0] has an empty detail');
  for (const bad of [0, -5, 2.5]) refusesPost({ ...FIX, costs: [{ what: 'x', detail: 'y', amountCents: bad }] }, 'is neither null nor a positive whole number of cents');
  assert.deepEqual(postsOver({ ...FIX, costs: [] }), [], 'no costs after the stay is allowed');
  refusesPost({ ...FIX, weeks: [] }, 'no weeks');
  refusesPost({ ...FIX, weeks: [{ ...FIX.weeks[0], title: '' }, FIX.weeks[1]] }, 'week 1: empty title');
  refusesPost({ ...FIX, weeks: [{ title: 'Empty', days: [] }] }, 'week 1: no days');
  refusesPost(withDay({ date: '2026-09-1' }), 'is not YYYY-MM-DD');
  refusesPost({ ...FIX, weeks: [FIX.weeks[1], FIX.weeks[0]] }, 'day dates run strictly ascending across the post, each once');
  refusesPost({ ...FIX, weeks: [FIX.weeks[0], { title: 'Again', days: [{ ...FIX.weeks[0].days[0] }] }] }, 'day dates run strictly ascending across the post, each once');
  refusesPost({ ...FIX, writtenOn: '2026-09-05' }, 'is after writtenOn 2026-09-05');
  refusesPost(withDay({ story: '' }), 'empty story');
  refusesPost(withDay({ chips: [{ kind: 'lunch', value: 'x' }] }), 'chip kind "lunch" is not brunch | dinner | activity | entertainment');
  refusesPost(withDay({ chips: [{ kind: 'brunch', value: '' }] }), 'chips[0] has an empty value');
  refusesPost(withDay({ chips: [{ kind: 'dinner', value: 'a' }, { kind: 'dinner', value: 'b' }] }), 'two chips of kind "dinner"');
  refusesPost(withDay({ mood: 'good' }), 'a day whose keys are not exactly date, story, chips');
  refusesPost({ ...FIX, picks: [] }, 'no picks');
  refusesPost({ ...FIX, picks: [{ heading: '', items: ['x'] }] }, 'picks[0] has an empty heading');
  refusesPost({ ...FIX, picks: [{ heading: 'x', items: [] }] }, 'picks[0] has no items');
  refusesPost({ ...FIX, picks: [{ heading: 'x', items: ['a', ''] }] }, 'picks[0] item 1 is empty');
});

// ── T2 · THE CANGGU ENTRY ────────────────────────────────────────────────────

test('T2 the Canggu card and post: thirty days Jul 1 → 30 each once, four weeks of 7, 7, 7 and 9, 77 chips, ten lessons, seven picks, the post\'s own cost in cents', () => {
  assert.equal(TRIP_POSTS.length, 1);
  assert.equal(POST.stopId, ID);
  assert.equal(POST.title, 'Thirty days in Canggu with no plan.', 'TRIPCARDS-01: the title, moved in from the card leaf byte for byte');
  assert.equal(POST.dek, 'I showed up in Bali without a plan. Here’s every day of it: where I ate, what I did, what it cost, and what I’d do differently.');
  const dates = days(POST).map((d) => d.date);
  assert.equal(dates.length, 30);
  assert.deepEqual(dates, Array.from({ length: 30 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`));
  assert.deepEqual(POST.weeks.map((w) => [w.title, w.days.length]), [['Finding my feet', 7], ['Sick, then sunsets', 7], ['The gym, a Jakarta detour, and a new café', 7], ['The best food of the trip, then goodbye', 9]]);
  assert.equal(days(POST).reduce((n, d) => n + d.chips.length, 0), 77);
  assert.equal(POST.lessons.length, 10);
  assert.deepEqual(POST.lessons[0], { lead: 'Plan before you land.', rest: 'I left with no clear plan and spent too many days at a café trying to figure out what to do, when, and what it would cost.' });
  assert.deepEqual(POST.lessons[9], { lead: 'Give Uluwatu its own trip.', rest: 'One day there wasn’t enough.' });
  assert.deepEqual(POST.picks.map((p) => p.heading), ['Favorite restaurant', 'Breakfast and brunch', 'Dinner', 'Sunsets', 'At night', 'Shopping', 'Practical']);
  assert.deepEqual(POST.costs, [{ what: 'My next visa (Vietnam, for stop 2)', detail: 'Expedited, because I applied late · standard is $25', amountCents: 10000 }], 'TRIPCARDS-01: the scooter left for the stop\'s own costs');
  assert.equal(POST.writtenOn, '2026-11-05');
  assert.equal(days(POST)[0].story.startsWith('Landed in Bali around sunset'), true);
  assert.equal(days(POST)[29].story.endsWith('More on that in stop 2.'), true);
});

test('T2 what each stop cost — Alex\'s sheet, 2026-11-05: a row for every stop, in trip order, every figure in cents', () => {
  assert.deepEqual(TRIP_COSTS.map((c) => c.stopId), STOPS);
  const words = (l: TripCosts['stay']) => (l.kind === 'paid' ? `${l.name} ${l.amountCents}` : l.kind);
  assert.deepEqual(TRIP_COSTS.map((c) => [c.stopId, words(c.stay), words(c.moto), words(c.flightIn)]), [
    ['canggu-2026-07', 'The Daun 70814', 'Nyoman Motorbike (Nmax) 13179', 'China Air 83720'],
    ['danang-2026-08', 'Sky Village Đà Nẵng 98073', 'none', 'Vietjet 17610'],
    ['bangkok-2026-09', 'Premier Thonglor 100772', 'none', 'Thai Vietjet 14990'],
    ['phuket-2026-10', 'Amata Patong 56961', 'Joy Motorbike (ADV) 8000', 'AirAsia 5881'],
    ['chiangmai-2026-10', 'Hillside Condo 3 41337', 'none', 'Vietjet 11179'],
    ['bangkok-2026-10-21', 'Eleven Bangkok Sukhumvit 11 4398', 'none', 'Vietjet 4720'],
    ['siargao-2026', 'Rodeo Sun Hotel 63824', 'Kook Moto Rental (Fazzio) 6353', 'Philippine Airlines 26050'],
    ['cebu-2026-11', 'The Noble Cebu 21726', 'unknown', 'Philippine Airlines 10405'],
    ['uluwatu-2026-11', 'Bombora Surf Camp 40016', 'unknown', 'Philippine Airlines 26512'],
    ['pererenan-2026-12', 'Anaya Boutique Hotel 28590', 'unknown', 'unknown'],
  ]);
  for (const id of STOPS) assert.ok(costsOf(id) !== null, `${id} has its costs`);
  assert.equal(costsOf('nowhere-2026'), null);
});

// ── T3 · THE WORDS ───────────────────────────────────────────────────────────

test('T3 the weekdays by arithmetic, the short day, and every line the post and its card show', () => {
  for (const [iso, day] of [['2026-07-01', 'Wed'], ['2026-07-07', 'Tue'], ['2026-07-30', 'Thu'], ['2026-11-05', 'Thu'], ['2000-01-01', 'Sat'], ['2024-02-29', 'Thu'], ['2026-12-31', 'Thu']] as const) {
    assert.equal(weekdayWords(iso), day, iso);
  }
  assert.equal(shortDayWords('2026-07-01'), 'Jul 1');
  assert.equal(tripPostHref(ID), '/my-trip/canggu-2026-07');
  assert.equal(stopNumber(WAS_HERE, ID), 1);
  assert.equal(stopNumber(WAS_HERE, 'siargao-2026'), 7);
  assert.throws(() => stopNumber(WAS_HERE, 'nowhere-2026'), /is not a stop in the trip log/);
  assert.equal(postEyebrow(1), 'My trip · Stop 1');
  assert.equal(stopNumber(WAS_HERE, 'pererenan-2026-12'), 10);
  assert.deepEqual(postMeta(ROW), ['Canggu, Bali, Indonesia', 'Jul 1–30, 2026']);
  assert.equal(stopHeading(rowOf('cebu-2026-11')), 'Cebu, Philippines');
  assert.deepEqual(STOP_COST_LABELS, { stay: 'Stay', moto: 'Motorbike', flightIn: 'Flight in' });
  // TRIPCARDS-03 (Alex's brief, 2026-11-12): every row carries its line's kind beside its words — the card paints an amount by it, never by
  // the words; a post's own cost is paid, or unknown while its amount is not in the log. Until then the rows were { what, detail, amount }.
  assert.deepEqual(stopCostRows(COSTS), [
    { what: 'Stay', detail: 'The Daun', amount: '$708.14', kind: 'paid' },
    { what: 'Motorbike', detail: 'Nyoman Motorbike (Nmax)', amount: '$131.79', kind: 'paid' },
    { what: 'Flight in', detail: 'China Air', amount: '$837.20', kind: 'paid' },
  ]);
  assert.deepEqual(costRows(COSTS, POST), [...stopCostRows(COSTS), { what: 'My next visa (Vietnam, for stop 2)', detail: 'Expedited, because I applied late · standard is $25', amount: '$100.00', kind: 'paid' }]);
  assert.deepEqual(costRows(COSTS, { ...POST, costs: [{ what: 'A visa run', detail: 'Not booked yet', amountCents: null }] }).slice(3), [{ what: 'A visa run', detail: 'Not booked yet', amount: NOT_IN_LOG, kind: 'unknown' }], 'a post\'s cost with no amount in the log: unknown');
  assert.deepEqual(costRows(costsFor('bangkok-2026-09'), null), [
    { what: 'Stay', detail: 'Premier Thonglor', amount: '$1,007.72', kind: 'paid' },
    { what: 'Motorbike', detail: '', amount: NOT_APPLICABLE, kind: 'none' },
    { what: 'Flight in', detail: 'Thai Vietjet', amount: '$149.90', kind: 'paid' },
  ]);
  assert.deepEqual(stopCostRows(costsFor('pererenan-2026-12')).map((r) => r.kind), ['paid', 'unknown', 'unknown'], 'the kinds are the lines\'');
  assert.deepEqual(stopCostRows(costsFor('pererenan-2026-12')).map((r) => r.amount), ['$285.90', NOT_IN_LOG, NOT_IN_LOG]);
  assert.equal(NOT_IN_LOG, 'not in my log yet');
  assert.equal(NOT_APPLICABLE, 'n/a');
  assert.equal(unwrittenLine(rowOf('cebu-2026-11')), 'Coming up — booked as of Nov 5, 2026. I haven’t stayed here yet.', 'TRIPPHOTO-08: "stayed" — he spent days at Uluwatu and Pererenan from Canggu');
  assert.equal(unwrittenLine(rowOf('uluwatu-2026-11')), 'Coming up — booked as of Nov 5, 2026. I haven’t stayed here yet.');
  assert.equal(unwrittenLine(rowOf('danang-2026-08')), 'I haven’t written this stop up yet.');
  assert.equal(dayLabel('2026-07-01'), 'Wed Jul 1');
  assert.equal(weekEyebrow(1, POST.weeks[0]), 'Week 1 · Jul 1–7, 2026');
  assert.equal(weekEyebrow(4, POST.weeks[3]), 'Week 4 · Jul 22–30, 2026');
  assert.equal(weekCount(POST.weeks[0]), '7 days');
  assert.equal(weekCount(POST.weeks[3]), '9 days');
  assert.equal(weekCount({ title: 'One', days: [POST.weeks[0].days[0]] }), '1 day');
  assert.deepEqual((['brunch', 'dinner', 'activity', 'entertainment'] as const).map(chipLabel), ['Brunch', 'Dinner', 'Activity', 'Entertainment']);
  assert.equal(bookLine(ROW), 'Going to Canggu, Bali? Book the stay and the flight here.');
  assert.equal(writtenLine(POST), 'Written Nov 5, 2026');
  assert.equal(postOf(ID), POST);
  assert.equal(postOf('danang-2026-08'), null);
  // TRIPCARDS-01: the event a stop was around, on its page — the window's words with no day in them.
  const wsl = EXPERIENCES.find((e) => e.id === 'philippines-pro-2026')!;
  assert.equal(experienceWindowLine(wsl), 'Window Oct 30 – Nov 10, 2026 · window being confirmed');
  const unannounced = EXPERIENCES.find((e) => e.status === 'not_announced')!;
  assert.throws(() => experienceWindowLine(unannounced), /has no window to name/, 'no window, no guess');
});

test('T3 the words and the date module read no clock and no locale; the words import the leaves as types only; the leaves import nothing', () => {
  for (const f of [WORDS, DATE_WORDS, VIEW]) assert.doesNotMatch(code(f), /toLocale|new Date\(|Date\.now|Intl\./, `${f} reads no clock and no locale`);
  const words = code(WORDS);
  assert.doesNotMatch(words, /tripPostCards/, 'TRIPCARDS-01: the card leaf is gone');
  assert.match(words, /import type \{ TripPost, TripPostChipKind, TripPostWeek \} from '\.\/tripPosts';/);
  assert.doesNotMatch(words, /import \{[^}]*\} from '\.\/trip(Posts|PostCards)';/, 'never a value import of a leaf');
  assert.match(words, /import \{ functionalMoneyWords \} from '\.\/books\/functionalCurrency';/, 'the one money formatter');
  assert.match(words, /import type \{ TripCostLine, TripCosts \} from '\.\/tripCosts';/);
  assert.doesNotMatch(words, /import \{[^}]*\} from '\.\/tripCosts';/, 'never a value import of the costs leaf');
  for (const f of [POSTS, 'src/lib/tripCosts.ts']) assert.doesNotMatch(code(f), /\bimport\b|\brequire\(/, `${f} imports nothing`);
});

// ── T4 · THE VIEW, RENDERED ──────────────────────────────────────────────────

test('T4 the post rendered: the back link, the title, the photo, all thirty stories once, four weeks with only the first open, 77 chips, the three event links, the band, the order', () => {
  const page = renderToStaticMarkup(React.createElement(TripPostView, { row: ROW, costs: COSTS, post: POST, event: null, stop: stopNumber(WAS_HERE, ID) }));
  assert.match(page, /data-trip-post-kind="written"/);
  assert.doesNotMatch(page, /data-trip-post-section="(line|event|did|learned)"/, 'Canggu holds no line, no event and no lists of its own — its post holds its story');
  assert.equal(POST_BACK_HREF, '/#my-trip');
  assert.match(page, new RegExp(`<a href="/#my-trip" class="[^"]*" data-trip-post-back="true">${POST_BACK}</a>`));
  assert.match(page, /<h1 class="[^"]*">Thirty days in Canggu with no plan\.<\/h1>/);
  assert.ok(page.includes('>My trip · Stop 1<'));
  for (const part of postMeta(ROW)) assert.ok(page.includes(`<span>${html(part)}</span>`), part);
  assert.deepEqual([...page.matchAll(/data-trip-post-cost="true"><div><p class="[^"]*">([^<]*)<\/p>/g)].map((m) => m[1]), ['Stay', 'Motorbike', 'Flight in', 'My next visa (Vietnam, for stop 2)'], 'the stop\'s three, then the post\'s own');
  assert.ok(page.includes('>$837.20<') && page.includes('>$131.79<'));
  assert.doesNotMatch(page, /data-trip-post-unwritten/);
  for (const d of days(POST)) assert.equal(count(page, html(d.story)), 1, `${d.date}: its story, once`);
  assert.equal(count(page, '<details'), 4);
  assert.equal(count(page, ' open=""'), 1);
  assert.ok(pos(page, ' open=""') < pos(page, 'data-trip-post-week="2"'), 'the first week is the open one');
  assert.match(page, /<details class="[^"]*" open="" data-trip-post-week="1">/);
  assert.deepEqual([...page.matchAll(/data-trip-post-count="true">(\d+ days?) · /g)].map((m) => m[1]), ['7 days', '7 days', '7 days', '9 days']);
  assert.equal(count(page, 'data-trip-post-chip='), 77);
  assert.equal(count(page, 'data-trip-post-day='), 30);
  assert.ok(page.includes('>Wed Jul 1<') && page.includes('>Thu Jul 30<'));
  const links = [...page.matchAll(/<a href="([^"]+)" rel="noopener" target="_blank" class="[^"]*" data-trip-post-event="[^"]*">([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(links, ROW.events.map((ev) => [html(ev.sourceUrl), html(onPill(ev))]));
  assert.equal(links.length, 3);
  // TRIPPHOTO-01 (2026-11-05): the stop's photo under the header — Alex's own, its credit under it.
  assert.match(page, /<figure class="[^"]*" data-trip-post-section="photo"><img src="\/was-here\/canggu-2026-07\.jpg" alt="Sunset at Canggu: the sun sinking into a low cloud over the sea, a surfer in silhouette riding a wave" class="[^"]*"\/><figcaption class="[^"]*">Photo: Alex Stuart<\/figcaption><\/figure>/);
  assert.ok(pos(page, 'data-trip-post-section="header"') < pos(page, 'data-trip-post-section="photo"') && pos(page, 'data-trip-post-section="photo"') < pos(page, 'data-trip-post-section="short"'), 'header → photo → the short version');
  assert.equal(BOOK_HREF, '/#demo');
  assert.match(page, /<a href="\/#demo" class="[^"]*">Book the stay and the flight<\/a>/);
  assert.ok(page.includes('>Going to Canggu, Bali? Book the stay and the flight here.<'));
  assert.ok(page.includes('>Written Nov 5, 2026<'));
  const order = ['data-trip-post-back', 'data-trip-post-section="header"', 'data-trip-post-section="short"', 'data-trip-post-section="differently"', 'data-trip-post-section="cost"', 'data-trip-post-section="days"', 'data-trip-post-section="on"', 'data-trip-post-section="picks"', 'data-trip-post-section="book"', 'data-trip-post-section="written"'];
  const at = order.map((n) => pos(page, n));
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'the sections, top to bottom');
  assert.match(page, /Ice cream was a struggle\./, 'the Jul 9 story renders on the post page');
});

test('T4 a stop not written up yet: the place as the h1, the dates, the line that says which, the stop\'s three costs, what was on, the band — and none of a post\'s sections (TRIPCARDS-01)', () => {
  const render = (id: string) => renderToStaticMarkup(React.createElement(TripPostView, { row: rowOf(id), costs: costsFor(id), post: null, event: eventFor(id), stop: stopNumber(WAS_HERE, id) }));
  const danang = render('danang-2026-08');
  assert.match(danang, /data-trip-post-kind="stop"/);
  assert.match(danang, /<h1 class="[^"]*">Da Nang \/ Hoi An, Vietnam<\/h1>/);
  assert.ok(danang.includes('>My trip · Stop 2<') && danang.includes(`<span>${stayWords(rowOf('danang-2026-08'))}</span>`));
  assert.ok(danang.includes('data-trip-post-unwritten="true">I haven’t written this stop up yet.<'));
  assert.match(danang, /<img src="\/was-here\/danang-2026-08\.jpg"/);
  assert.deepEqual([...danang.matchAll(/data-trip-post-cost="true"><div><p class="[^"]*">([^<]*)<\/p>/g)].map((m) => m[1]), ['Stay', 'Motorbike', 'Flight in']);
  assert.ok(danang.includes('>n/a<') && danang.includes('>$980.73<') && danang.includes('>$176.10<'));
  assert.ok(danang.includes(`>${UNWRITTEN_COST_NOTE}<`));
  assert.equal(count(danang, 'data-trip-post-event='), 2, 'its two events live here now');
  for (const section of ['short', 'differently', 'days', 'picks', 'written', 'line', 'event', 'did', 'learned']) assert.doesNotMatch(danang, new RegExp(`data-trip-post-section="${section}"`), `no ${section} before he writes it`);
  assert.match(danang, /<a href="\/#demo" class="[^"]*">Book the stay and the flight<\/a>/);
  const cebu = render('cebu-2026-11');
  assert.ok(cebu.includes('data-trip-post-unwritten="true">Coming up — booked as of Nov 5, 2026. I haven’t stayed here yet.<'));
  assert.doesNotMatch(cebu, /<img|data-trip-post-section="on"/, 'booked ahead: no photo yet, no events yet');
  // TRIPPHOTO-08 / 09 (2026-11-06): Uluwatu's and Pererenan's pages carry his photos from his days there.
  assert.match(render('uluwatu-2026-11'), /<figure class="[^"]*" data-trip-post-section="photo"><img src="\/was-here\/uluwatu-2026-11\.jpg"/);
  assert.match(render('pererenan-2026-12'), /<figure class="[^"]*" data-trip-post-section="photo"><img src="\/was-here\/pererenan-2026-12\.jpg"/);
  assert.ok(cebu.includes('>The Noble Cebu<') && cebu.includes('>not in my log yet<'));
  // TRIPCARDS-01 (Alex, 2026-11-05): Siargao's event block and Alex's line left its card for this page — the booking band below them.
  const siargao = render('siargao-2026');
  const wsl = eventFor('siargao-2026')!;
  assert.ok(siargao.includes(`data-trip-post-section="line">${html(rowOf('siargao-2026').line!)}</p>`), 'Alex\'s line, as typed in the leaf');
  assert.match(siargao, /<div class="[^"]*" data-trip-post-section="event" data-trip-post-experience="philippines-pro-2026"><p class="[^"]*">Surf · WSL Championship Tour<\/p><p class="[^"]*">Philippines Pro presented by the Philippine Sports Commission<\/p><p class="[^"]*">Cloud 9<\/p><p class="[^"]*">Window Oct 30 – Nov 10, 2026 · window being confirmed<\/p><\/div>/);
  assert.ok(siargao.includes(`>${experienceWindowLine(wsl)}<`));
  assert.match(siargao, /<a href="\/#demo" class="[^"]*">Book the stay and the flight<\/a>/);
  const order = ['data-trip-post-section="header"', 'data-trip-post-section="photo"', 'data-trip-post-section="line"', 'data-trip-post-section="event"', 'data-trip-post-section="cost"', 'data-trip-post-section="book"'].map((n) => pos(siargao, n));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'header → photo → his line → the event → the costs → the band');
  // A stop holding both lists shows DID (joined) and LEARNED (a paragraph each) after its line — never an empty eyebrow.
  const lisbon: WasHereRow = { ...rowOf('danang-2026-08'), id: 'lisbon-2026', city: 'Lisbon', country: 'Portugal', countryCode: 'PT', start: '2026-09-01', end: '2026-09-20', line: 'Three weeks of pastel de nata.', image: null, events: [], did: ['the 28 tram', 'Belém by bike'], learned: ['Book the tram early.', 'Then the pastel.'] };
  const fixture = renderToStaticMarkup(React.createElement(TripPostView, { row: lisbon, costs: { ...COSTS, stopId: 'lisbon-2026' }, post: null, event: null, stop: 1 }));
  assert.match(fixture, /data-trip-post-section="did"><p class="[^"]*">DID<\/p><p class="[^"]*">the 28 tram · Belém by bike<\/p><\/section>/);
  assert.match(fixture, /data-trip-post-section="learned"><p class="[^"]*">LEARNED<\/p><p class="[^"]*">Book the tram early\.<\/p><p class="[^"]*">Then the pastel\.<\/p><\/section>/);
  const lines = ['data-trip-post-section="line"', 'data-trip-post-section="did"', 'data-trip-post-section="learned"', 'data-trip-post-section="cost"'].map((n) => pos(fixture, n));
  assert.deepEqual([...lines].sort((a, b) => a - b), lines, 'line → DID → LEARNED → the costs');
  assert.deepEqual([DID, LEARNED], ['DID', 'LEARNED']);
  assert.doesNotMatch(fixture, /data-trip-post-section="event"/, 'no event, no block');
});

// ── T5 · THE ROUTE AND THE DOOR ──────────────────────────────────────────────

test('T5 the route: static params for every stop, dynamicParams = false; \'/my-trip\' is public and covers nothing else; the page route is listed; the law sits after the trip log\'s', () => {
  assert.equal(PostPage.dynamicParams, false);
  assert.deepEqual(PostPage.generateStaticParams(), STOPS.map((id) => ({ id })), 'TRIPCARDS-01: every stop has its page');
  assert.match(code(PAGE), /notFound\(\)/);
  assert.match(code(PAGE), /if \(row === undefined\) return null;[\s\S]*if \(costs === null\) throw new Error\(/, 'an id that is not a stop 404s; a stop with no costs row fails loud — never a 404 that hides it');
  assert.match(code(PAGE), /if \(event === undefined\) throw new Error\(/, 'a stale event id fails loud — never a page without its block');
  assert.doesNotMatch(code(PAGE), /tripPostCards|cardOf/, 'TRIPCARDS-01: the title is the post\'s');
  const mw = code(MIDDLEWARE);
  const list = /const PUBLIC_PATHS = \[([\s\S]*?)\];/.exec(mw);
  assert.ok(list, 'PUBLIC_PATHS is declared');
  const paths = [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.equal(paths[paths.length - 1], '/my-trip', "'/my-trip' is the list's last entry");
  assert.ok(!paths.includes('/trip') && !paths.includes('/trips'), 'the signed-in trips are not public');
  assert.match(mw, /return PUBLIC_PATHS\.some\(p => pathname === p \|\| pathname\.startsWith\(p \+ '\/'\)\);/, "isPublic's rule: p or p + '/'");
  const isPublic = (pathname: string) => paths.some((p) => pathname === p || pathname.startsWith(p + '/'));
  assert.equal(isPublic('/my-trip/canggu-2026-07'), true);
  assert.equal(isPublic('/trips/abc'), false);
  assert.equal(isPublic('/trips'), false);
  assert.equal(isPublic('/my-tripx'), false);
  const law = code(LAW);
  assert.ok(law.includes("{ route: '/my-trip/[id]', why: "), 'the page route has its door listed');
  const tripLog = law.indexOf('violations.push(...wasHereLaw({ throwOnFail: false }));');
  const tripPost = law.indexOf('violations.push(...tripPostsLaw({ throwOnFail: false }), ...tripCostsLaw({ throwOnFail: false }));');
  assert.doesNotMatch(law, /tripPostCards|TRIP_POST_CARDS/, 'TRIPCARDS-01: the card leaf left the seat with its file');
  assert.match(law, /const costIds = TRIP_COSTS\.map\(\(c\) => c\.stopId\)\.sort\(\)\.join\(','\); if \(costIds !== stopIds\) violations\.push/, 'a costs row for every stop, and none for a stop that isn\'t one');
  assert.ok(tripLog > -1 && tripPost > tripLog, 'the trip log law, then the trip post law');
  assert.match(law, /existsSync\(resolve\(ROOT, 'src\/app\/my-trip\/\[id\]\/page\.tsx'\)\)/);
});

// ── T6 · THE CARDS ───────────────────────────────────────────────────────────

test('T6 the cards: a grid; every card the stop and what it cost — place, dates, stop, the three costs, "Read the post →" to its page — and nothing of the post, the event or the line; the section imports no post, no card leaf and no event', () => {
  const home = renderToStaticMarkup(React.createElement(WasHereView, { rows: WAS_HERE, costs: TRIP_COSTS, today: TODAY }));
  // TRIPCARDS-03 (2026-11-12): the row is the port's .ts-story-row (overflow-x: auto there). Until then: /<div class="[^"]*\boverflow-x-auto\b[^"]*" data-was-here-rail="true">/.
  assert.match(home, /<div class="ts-story-row" id="story-row" data-was-here-rail="true">/, 'TRIPCARDS-01 (2026-11-06): one row that scrolls sideways');
  assert.equal(MY_TRIP_LINE, "Stop by stop, dated, with the whole story where I've written it up.");
  assert.equal(READ_THE_POST, 'Read the post →');
  const cardHtml = (id: string) => { const at = home.indexOf(`data-was-here="${id}"`); const next = home.indexOf('data-was-here="', at + 1); return home.slice(at, next < 0 ? undefined : next); };
  assert.deepEqual([...home.matchAll(/data-was-here="([^"]+)"/g)].map((m) => m[1]), STOPS);
  for (const id of STOPS) {
    const card = cardHtml(id);
    assert.match(card, new RegExp(`<a href="/my-trip/${id}" class="[^"]*" data-was-here-post-link="true">Read the post →</a>`), `${id}: its page`);
    assert.deepEqual([...card.matchAll(/data-was-here-cost="([^"]+)"/g)].map((m) => m[1]), ['Stay', 'Motorbike', 'Flight in'], `${id}: its three costs`);
    assert.doesNotMatch(card, /data-was-here-pill|WHAT WAS ON|I WAS HERE|data-was-here-post=|data-was-here-event|data-was-here-line|href="#demo"/, `${id}: no pills, no post block, no event, no line, no strip link`);
  }
  const canggu = cardHtml(ID);
  // TRIPCARDS-01 (Alex, 2026-11-05): "this should have been removed" — the post's title and line are not on the card.
  assert.doesNotMatch(home, new RegExp(`${POST.title.replace('.', '\\.')}|Every day of it`), 'the post title and its line left the card');
  // TRIPCARDS-03 (2026-11-12): the card is white — the name and the amount each their own <dd>, the amount carrying its line's kind (the
  // port paints paid gold, none and unknown muted). Until then (TRIPCARDS-02, 2026-11-08: the dark card): the amount
  // <span class="shrink-0 whitespace-nowrap font-mono text-xs text-white/80">, the name <span class="truncate" title="…">, a · between,
  // in <dd class="flex min-w-0 items-baseline gap-1 text-xs text-white">.
  const amount = (kind: string, a: string) => `<dd class="ts-story-cost__amount" data-kind="${kind}">${a}</dd>`;
  const named = (name: string, a: string) => `<dd class="ts-story-cost__name" title="${name}">${name}</dd>${amount('paid', a)}`;
  assert.ok(canggu.includes(named('The Daun', '$708.14')));
  assert.ok(canggu.includes(named('Nyoman Motorbike (Nmax)', '$131.79')), 'Alex: no "Rental" — one line');
  assert.ok(canggu.includes(named('China Air', '$837.20')));
  assert.doesNotMatch(canggu, />DID<|>LEARNED<|data-was-here-label/, 'a stop he has left: no label');
  assert.ok(cardHtml('danang-2026-08').includes(`<dd class="ts-story-cost__name"></dd>${amount('none', 'n/a')}`), 'no motorbike: n/a');
  assert.ok(cardHtml('pererenan-2026-12').includes(amount('unknown', 'not in my log yet')));
  assert.doesNotMatch(home, /Ice cream was a struggle/, 'no post body on the home page');
  assert.throws(() => renderToStaticMarkup(React.createElement(WasHereView, { rows: WAS_HERE, costs: TRIP_COSTS.filter((c) => c.stopId !== 'cebu-2026-11'), today: TODAY })), /"cebu-2026-11" has no costs row/, 'a stop with no costs row fails loud — never a card without them');
  const section = code(SECTION);
  assert.doesNotMatch(section, /tripPostCards|@\/lib\/tripPosts'|@\/lib\/experiences'|experienceWords/, 'the section imports no post, no card leaf and no event');
  assert.match(section, /import \{ TRIP_COSTS, type TripCosts \} from '@\/lib\/tripCosts';/);
});

// ── T7 · THE LABELS, FROM THE SERVER'S DAY ───────────────────────────────────

test('T7 the label from the server\'s day: none once he has left, I\'M HERE while he is there, COMING UP before — and the travel day is the next stop\'s (TRIPCARDS-01)', () => {
  const labels = (today: string) => {
    const home = renderToStaticMarkup(React.createElement(WasHereView, { rows: WAS_HERE, costs: TRIP_COSTS, today }));
    return Object.fromEntries(STOPS.map((id) => {
      const at = home.indexOf(`data-was-here="${id}"`); const next = home.indexOf('data-was-here="', at + 1);
      const card = home.slice(at, next < 0 ? undefined : next);
      // TRIPCARDS-03 (2026-11-12): I'M HERE carries its dot before its words (until then: /data-was-here-label="true">([^<]*)</).
      return [id, /data-was-here-label="true">(?:<span class="[^"]*" aria-hidden="true"><\/span>)?([^<]*)</.exec(card)?.[1] ?? null];
    }));
  };
  const nov5 = labels('2026-11-05');
  assert.deepEqual(nov5, {
    'canggu-2026-07': null, 'danang-2026-08': null, 'bangkok-2026-09': null, 'phuket-2026-10': null, 'chiangmai-2026-10': null, 'bangkok-2026-10-21': null,
    'siargao-2026': 'I&#x27;M HERE', 'cebu-2026-11': 'COMING UP', 'uluwatu-2026-11': 'COMING UP', 'pererenan-2026-12': 'COMING UP',
  });
  const nov13 = labels('2026-11-13');
  assert.equal(nov13['siargao-2026'], null, 'the travel day out is the next stop\'s');
  assert.equal(nov13['cebu-2026-11'], 'I&#x27;M HERE');
  const dec12 = labels('2026-12-12');
  assert.ok(Object.values(dec12).every((l) => l === null), 'after the last stop, no label anywhere');
});

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
 * No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code } from '../sourceText';
import { WAS_HERE, type WasHereRow } from '../wasHere';
import { onPill } from '../wasHereWords';
import { shortDayWords, weekdayWords } from '../experienceWords';
import { TRIP_POST_CARDS, TRIP_POST_CARD_FIELDS, TripPostCardsLawError, cardOf, tripPostCardsLaw, type TripPostCard } from '../tripPostCards';
import { TRIP_POSTS, TRIP_POST_FIELDS, TripPostsLawError, postOf, tripPostsLaw, type TripPost } from '../tripPosts';
import {
  NOT_IN_LOG, WHERE_I_STAYED, bookLine, chipLabel, costRows, dayLabel, postEyebrow, postMeta, stayLine, stopNumber, tripPostHref, weekCount, weekEyebrow, writtenLine,
} from '../tripPostWords';
import TripPostView, { BOOK_HREF, POST_BACK, POST_BACK_HREF } from '@/components/trip/TripPostView';
import { WasHereView, MY_TRIP_LINE, READ_THE_POST } from '@/components/landing/WasHereSection';
import * as PostPage from '@/app/my-trip/[id]/page';

Object.assign(globalThis, { React });

const CARDS = 'src/lib/tripPostCards.ts';
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
const CARD: TripPostCard = TRIP_POST_CARDS[0];
const POST: TripPost = TRIP_POSTS[0];
const ROW = rowOf(ID);
const days = (post: TripPost) => post.weeks.flatMap((w) => w.days);
/** React's own escaping of text: & < > " ' (renderToStaticMarkup). */
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const pos = (hay: string, needle: string) => { const i = hay.indexOf(needle); assert.ok(i > -1, `${needle} is rendered`); return i; };

/** A small valid post the refusals mutate — two weeks of one day each. */
const FIX: TripPost = {
  stopId: 'lisbon-2026', dek: 'Three weeks.', short: [{ label: 'Best day', value: 'the tram' }], lessons: [{ lead: 'Go early.', rest: 'The queue is long.' }],
  costs: [{ what: 'The tram pass', detail: 'Seven days', amountCents: 1250 }, { what: 'Bike', detail: 'Belém', amountCents: null }], costNote: 'From the log.',
  weeks: [
    { title: 'Arriving', days: [{ date: '2026-09-01', story: 'Landed.', chips: [{ kind: 'brunch', value: 'A café' }, { kind: 'dinner', value: 'A tasca' }] }] },
    { title: 'Leaving', days: [{ date: '2026-09-08', story: 'Left.', chips: [] }] },
  ],
  picks: [{ heading: 'Food', items: ['Pastel de nata'] }], writtenOn: '2026-09-21',
};
const postsOver = (...posts: TripPost[]) => tripPostsLaw({ throwOnFail: false, posts });
const cardsOver = (...cards: TripPostCard[]) => tripPostCardsLaw({ throwOnFail: false, cards });
const refusesPost = (post: TripPost, words: string) => {
  const v = postsOver(post);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};
const refusesCard = (card: TripPostCard, words: string) => {
  const v = cardsOver(card);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};
const withDay = (patch: Record<string, unknown>): TripPost => ({ ...FIX, weeks: [{ ...FIX.weeks[0], days: [{ ...FIX.weeks[0].days[0], ...patch } as TripPost['weeks'][0]['days'][0]] }, FIX.weeks[1]] });

// ── T1 · THE TWO LAWS ────────────────────────────────────────────────────────

test('T1 the live card and post pass their laws; each law throws by default; the fixture passes', () => {
  assert.deepEqual(tripPostCardsLaw({ throwOnFail: false }), []);
  assert.deepEqual(tripPostsLaw({ throwOnFail: false }), []);
  assert.deepEqual(postsOver(FIX), []);
  assert.throws(() => tripPostCardsLaw({ cards: [{ ...CARD, title: '' }] }), TripPostCardsLawError);
  assert.throws(() => tripPostsLaw({ posts: [{ ...FIX, dek: '' }] }), TripPostsLawError);
  assert.deepEqual([...TRIP_POST_CARD_FIELDS], ['stopId', 'title', 'cardLine', 'stay']);
  assert.deepEqual([...TRIP_POST_FIELDS], ['stopId', 'dek', 'short', 'lessons', 'costs', 'costNote', 'weeks', 'picks', 'writtenOn']);
});

test('T1 every card refusal, by name', () => {
  refusesCard({ ...CARD, stopId: '' }, 'empty stopId');
  refusesCard({ ...CARD, extra: 1 } as unknown as TripPostCard, 'a card carries exactly the four ruled fields');
  assert.ok(cardsOver(CARD, CARD).some((l) => l.includes('duplicate stopId')));
  refusesCard({ ...CARD, title: ' ' }, 'empty title');
  refusesCard({ ...CARD, cardLine: '' }, 'empty cardLine');
  refusesCard({ ...CARD, stay: { ...CARD.stay, nights: 29 } as unknown as TripPostCard['stay'] }, 'a stay carries exactly name, area, amountCents');
  refusesCard({ ...CARD, stay: { ...CARD.stay, name: '' } }, 'empty stay name');
  refusesCard({ ...CARD, stay: { ...CARD.stay, area: '' } }, 'empty stay area');
  for (const bad of [0, -1, 1.5, '70814']) refusesCard({ ...CARD, stay: { ...CARD.stay, amountCents: bad as number } }, 'is not a positive whole number of cents');
});

test('T1 every post refusal, by name', () => {
  refusesPost({ ...FIX, stopId: '' }, 'empty stopId');
  refusesPost({ ...FIX, extra: 1 } as unknown as TripPost, 'a post carries exactly the nine ruled fields');
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

test('T2 the Canggu card and post: thirty days Jul 1 → 30 each once, four weeks of 7, 7, 7 and 9, 77 chips, ten lessons, seven picks, the stay and the costs in cents', () => {
  assert.equal(TRIP_POST_CARDS.length, 1);
  assert.equal(TRIP_POSTS.length, 1);
  assert.deepEqual(CARD, { stopId: ID, title: 'Thirty days in Canggu with no plan.', cardLine: 'Every day of it: where I ate, what I did, what it cost, and what I’d do differently.', stay: { name: 'The Daun', area: 'Canggu', amountCents: 70814 } });
  assert.equal(POST.stopId, ID);
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
  assert.deepEqual(POST.costs.map((c) => c.amountCents), [10000, null]);
  assert.equal(POST.writtenOn, '2026-11-05');
  assert.equal(days(POST)[0].story.startsWith('Landed in Bali around sunset'), true);
  assert.equal(days(POST)[29].story.endsWith('More on that in stop 2.'), true);
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
  assert.deepEqual(postMeta(ROW, CARD), ['Canggu, Bali, Indonesia', 'Jul 1–30, 2026', 'Stayed at The Daun · $708.14']);
  assert.equal(stayLine(CARD), 'Stayed at The Daun · $708.14');
  assert.deepEqual(costRows(ROW, CARD, POST), [
    { what: WHERE_I_STAYED, detail: 'The Daun, Canggu · Jul 1–30, 2026', amount: '$708.14' },
    { what: 'My next visa (Vietnam, for stop 2)', detail: 'Expedited, because I applied late · standard is $25', amount: '$100.00' },
    { what: 'Scooter (Nmax)', detail: 'Nyoman Motorbike Rental · Jul 3–30', amount: NOT_IN_LOG },
  ]);
  assert.equal(NOT_IN_LOG, 'not in my log yet');
  assert.equal(dayLabel('2026-07-01'), 'Wed Jul 1');
  assert.equal(weekEyebrow(1, POST.weeks[0]), 'Week 1 · Jul 1–7, 2026');
  assert.equal(weekEyebrow(4, POST.weeks[3]), 'Week 4 · Jul 22–30, 2026');
  assert.equal(weekCount(POST.weeks[0]), '7 days');
  assert.equal(weekCount(POST.weeks[3]), '9 days');
  assert.equal(weekCount({ title: 'One', days: [POST.weeks[0].days[0]] }), '1 day');
  assert.deepEqual((['brunch', 'dinner', 'activity', 'entertainment'] as const).map(chipLabel), ['Brunch', 'Dinner', 'Activity', 'Entertainment']);
  assert.equal(bookLine(ROW), 'Going to Canggu, Bali? Book the stay and the flight here.');
  assert.equal(writtenLine(POST), 'Written Nov 5, 2026');
  assert.equal(cardOf(ID), CARD);
  assert.equal(postOf(ID), POST);
  assert.equal(cardOf('danang-2026-08'), null);
  assert.equal(postOf('danang-2026-08'), null);
});

test('T3 the words and the date module read no clock and no locale; the words import the leaves as types only; the leaves import nothing', () => {
  for (const f of [WORDS, DATE_WORDS, VIEW]) assert.doesNotMatch(code(f), /toLocale|new Date\(|Date\.now|Intl\./, `${f} reads no clock and no locale`);
  const words = code(WORDS);
  assert.match(words, /import type \{ TripPostCard \} from '\.\/tripPostCards';/);
  assert.match(words, /import type \{ TripPost, TripPostChipKind, TripPostWeek \} from '\.\/tripPosts';/);
  assert.doesNotMatch(words, /import \{[^}]*\} from '\.\/trip(Posts|PostCards)';/, 'never a value import of a leaf');
  assert.match(words, /import \{ functionalMoneyWords \} from '\.\/books\/functionalCurrency';/, 'the one money formatter');
  for (const f of [CARDS, POSTS]) assert.doesNotMatch(code(f), /\bimport\b|\brequire\(/, `${f} imports nothing`);
});

// ── T4 · THE VIEW, RENDERED ──────────────────────────────────────────────────

test('T4 the post rendered: the back link, the title, the photo, all thirty stories once, four weeks with only the first open, 77 chips, the three event links, the band, the order', () => {
  const page = renderToStaticMarkup(React.createElement(TripPostView, { row: ROW, card: CARD, post: POST, stop: stopNumber(WAS_HERE, ID) }));
  assert.equal(POST_BACK_HREF, '/#my-trip');
  assert.match(page, new RegExp(`<a href="/#my-trip" class="[^"]*" data-trip-post-back="true">${POST_BACK}</a>`));
  assert.match(page, /<h1 class="[^"]*">Thirty days in Canggu with no plan\.<\/h1>/);
  assert.ok(page.includes('>My trip · Stop 1<'));
  for (const part of postMeta(ROW, CARD)) assert.ok(page.includes(`<span>${html(part)}</span>`), part);
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

// ── T5 · THE ROUTE AND THE DOOR ──────────────────────────────────────────────

test('T5 the route: static params from the posts, dynamicParams = false; \'/my-trip\' is public and covers nothing else; the page route is listed; the law sits after the trip log\'s', () => {
  assert.equal(PostPage.dynamicParams, false);
  assert.deepEqual(PostPage.generateStaticParams(), [{ id: ID }]);
  assert.match(code(PAGE), /notFound\(\)/);
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
  const tripPost = law.indexOf('violations.push(...tripPostCardsLaw({ throwOnFail: false }), ...tripPostsLaw({ throwOnFail: false }));');
  assert.ok(tripLog > -1 && tripPost > tripLog, 'the trip log law, then the trip post law');
  assert.match(law, /existsSync\(resolve\(ROOT, 'src\/app\/my-trip\/\[id\]\/page\.tsx'\)\)/);
});

// ── T6 · THE CARDS ───────────────────────────────────────────────────────────

test('T6 the cards: a grid; Canggu\'s post block and no DID, LEARNED or WHAT WAS ON; Da Nang and Bangkok keep their pills; the section never imports the post body', () => {
  const home = renderToStaticMarkup(React.createElement(WasHereView, { rows: WAS_HERE, today: TODAY }));
  assert.match(home, /class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"/);
  assert.equal(MY_TRIP_LINE, "Stop by stop, dated, with the whole story where I've written it up.");
  assert.equal(READ_THE_POST, 'Read the post →');
  const cardHtml = (id: string) => { const at = home.indexOf(`data-was-here="${id}"`); const next = home.indexOf('data-was-here="', at + 1); return home.slice(at, next < 0 ? undefined : next); };
  const canggu = cardHtml(ID);
  assert.match(canggu, /<a href="\/my-trip\/canggu-2026-07" class="[^"]*" data-was-here-post-title="true">Thirty days in Canggu with no plan\.<\/a>/);
  assert.ok(canggu.includes(`>${CARD.cardLine}<`));
  assert.ok(canggu.includes('>Stayed at The Daun · $708.14<'));
  assert.match(canggu, /<a href="\/my-trip\/canggu-2026-07" class="[^"]*" data-was-here-post-link="true">Read the post →<\/a>/);
  assert.doesNotMatch(canggu, />DID<|>LEARNED<|WHAT WAS ON|data-was-here-pill/);
  for (const id of ['danang-2026-08', 'bangkok-2026-09']) {
    const card = cardHtml(id);
    assert.match(card, /data-was-here-list="on"><p class="[^"]*">WHAT WAS ON<\/p>/, `${id} keeps its pills`);
    assert.doesNotMatch(card, /data-was-here-post/, `${id} has no post yet`);
  }
  assert.doesNotMatch(home, /Ice cream was a struggle/, 'no post body on the home page');
  const section = code(SECTION);
  assert.match(section, /import \{ cardOf, type TripPostCard \} from '@\/lib\/tripPostCards';/);
  assert.doesNotMatch(section, /from '@\/lib\/tripPosts'/, 'the section never imports the post body');
});

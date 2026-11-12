/**
 * WASHERE-01 (Alex, 2026-10-31) — the trip log is its own act: the leaf and its law,
 * the words, the section rendered, the mount and the law seat.
 * WASHERE-02 (Alex, 2026-10-31) — six earlier stops join, each with what was on.
 * WASHERE-03 (Alex, 2026-10-31) — the log reads top-down as posts: trip order with a
 * stop number; sections per stop, Canggu written;
 * the near-miss list cut — relation left the event, newestFirst / daysBetween /
 * missedWords / missedPill left the words with their fixtures (the 2026-07-30 →
 * 2026-08-01 = 2, 2026-10-08 → 2026-10-09 = 1, 2026-10-21 → 2026-11-23 = 33 and
 * 2028-02-28 → 2028-03-01 = 2 day counts; the "started the day after I left" /
 * "ended N days before I arrived" words; the near_miss-on-overlap and relation-enum
 * refusals; the Phuket, Chiang Mai and FADO near-miss pills); what-was-on trimmed to
 * eight; the "No event" line gone.
 * WASHERE-04 (Alex, 2026-11-03) — privacy.
 * TRIPPHOTO-01 (Alex, 2026-11-05) — Canggu's photo, his own: on its card, inside the link
 * to its post, its credit under it. TRIPPHOTO-02 (2026-11-05) — Da Nang's: on its card,
 * not a link (no post yet). TRIPPHOTO-03 (2026-11-05) — the first Bangkok stop's, the same
 * way; TRIPPHOTO-04 — Chiang Mai's; TRIPPHOTO-05 — Phuket's; TRIPPHOTO-06 — the second
 * Bangkok stop's; TRIPPHOTO-07 — Siargao's, the boatman's face left out of the crop: every
 * stop has its photo.
 * TRIPPOST-01 (Alex, 2026-11-05) — Canggu is written up: its two lists moved into its
 * post (src/lib/tripPosts.ts), its card carries the post block, its events live in the
 * post; the cards sit in a grid; the act line and MY_TRIP_LINE say so (tripPost01.test.ts
 * holds the post itself).
 * TRIPCARDS-01 (Alex, 2026-11-05) — every card is "destination, stay / bike / and flight in":
 * the photo, the label (none once he has left — "I was here" is gone — I'M HERE while he is
 * there, COMING UP before), the place, the dates, the stop number, the stop's three costs on one
 * line each, and "Read the post →" to its page (the photo opens it too). Nothing else: the post's
 * title and line, Alex's line, the event block, DID / LEARNED, the pills and the booking link
 * all live on the stop's page (tripPost01.test.ts). Siargao's stay closes Nov 13 and the three
 * stops booked ahead join — Cebu, Uluwatu, Pererenan — each with nothing in did or learned (a
 * planned stop, the law). TRIPCARDS-01 (Alex, 2026-11-06): the cards sit in ONE row that
 * scrolls sideways. TRIPPHOTO-08 / 09 (Alex, 2026-11-06): Uluwatu's and Pererenan's photos, his
 * own from days there during the Canggu stay; Cebu has none yet. TRIPCARDS-01d (Alex,
 * 2026-11-06): the stop number sits on top of the place, under the photo credit, the label
 * beside it. TRIPCARDS-02 (Alex, 2026-11-08): the trip.com look — the card dark, the photo tall
 * in one h-80 block holding the figure, the stop chip and a dark band with the place and the
 * dates (the credit drawn on the band's right); Cebu, with no photo, opens with the chip, the
 * place and the dates. The same data, the same words, the same order of parts.
 * TRIPCARDS-03 (Alex's brief, 2026-11-12 21:08 Manila; the board approved on the design canvas at 21:21) — the stop cards, as
 * drawn: the dark card, its 320px crop, the chip and the band on the photo and the drawn scrollbar leave. Each card is white, its
 * photo whole at 3 : 2 with nothing on it; the stop line (Stop n, its chip, the credit at its right); the city, the country, the
 * dates; the three costs, each amount carrying its line's kind; Read the post →, the quiet pill. The row stands outside the page
 * container. The same data, the same hooks, the same order of the parts these tests read; tripCards03.test.ts holds the port and
 * the markup against the reference.
 *
 *   T1 the law — every refusal by name over injected rows and events; the deleted
 *      refusals named absent; the live rows pass;
 *   T2 the rows — ten in trip order, the three booked ahead last; eight events; every
 *      stop's two lists empty (Canggu's moved into its post, TRIPPOST-01), a kept event
 *      byte for byte, every row at thirteen keys and byte for byte against its pinned
 *      digest (WASHERE-04);
 *   T3 the words — stopStatus and stopLabel from the server's day (one stop current on
 *      every day of the trip), the stay, tripOrder, stopWords, listWords, stopEventLine for
 *      every status × sourceKind, onPill, the three ruled pills from the live rows;
 *   T4 the section, rendered — the h2 "Our Story" (HOME-ORDER-01, 2026-11-10: Alex's heading, from
 *      src/lib/homeActWords.ts; "Where I've been, and where I'm going." until then,
 *      TRIPCARDS-01); ten cards Canggu → Pererenan in one sideways row with Stop 1 … Stop
 *      10, nine photos each inside the link to its stop's page, every card's three costs (one line each,
 *      the name's whole words in its title) and its "Read the post →", and nothing else — on the
 *      live rows and on fixtures that hold a line, two lists, an event and a stop's event; a
 *      stop with no costs row fails loud; no "No event" / JUST MISSED text anywhere, no clock;
 *      the look as drawn (TRIPCARDS-03; TRIPCARDS-02's dark card until then) — every card white,
 *      its photo whole in its frame with nothing drawn on it, the stop he is at ringed, Cebu with
 *      no frame and no credit;
 *   T5 the mount — after the experiences mount and the guest strip (HOME-ORDER-01,
 *      2026-11-10: Alex's order; before the strip until then); the header
 *      comment says a card per stop, each opening its page (TRIPCARDS-01); the law seat.
 * No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash } from 'node:crypto';
import { code, comments } from '../sourceText';
import {
  STOP_EVENT_FIELDS, WAS_HERE, WAS_HERE_FIELDS, WAS_HERE_IMAGE_SRC, WasHereLawError, wasHereLaw, type StopEvent, type WasHereRow,
} from '../wasHere';
import { listWords, onPill, stayWords, stopEventLine, stopLabel, stopStatus, stopWords, tripOrder } from '../wasHereWords';
import { TRIP_COSTS, type TripCosts } from '../tripCosts';
import { EXPERIENCES, EXPERIENCE_FIELDS } from '../experiences';
import {
  WasHereView, MY_TRIP_ANCHOR, MY_TRIP_EYEBROW, MY_TRIP_HEADLINE, MY_TRIP_LINE, READ_THE_POST,
} from '@/components/landing/WasHereSection';

Object.assign(globalThis, { React });

const LEAF = 'src/lib/wasHere.ts';
const WORDS = 'src/lib/wasHereWords.ts';
const SECTION = 'src/components/landing/WasHereSection.tsx';
const EXPERIENCES_SECTION = 'src/components/landing/ExperiencesSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const DECK = 'src/components/landing/PipelineDeck.tsx'; // PIPELINE-PAGE-01 (2026-11-09): the deck's own file — the 14 steps moved there whole from Landing.tsx
const LAW = 'scripts/assert-tool-registry.ts';
const TODAY = '2026-10-31';
const TRIP = ['canggu-2026-07', 'danang-2026-08', 'bangkok-2026-09', 'phuket-2026-10', 'chiangmai-2026-10', 'bangkok-2026-10-21', 'siargao-2026', 'cebu-2026-11', 'uluwatu-2026-11', 'pererenan-2026-12'];
/** TRIPCARDS-01 (2026-11-05): the stops booked ahead — no photo, no events, nothing in did or learned yet. */
const BOOKED = ['cebu-2026-11', 'uluwatu-2026-11', 'pererenan-2026-12'];
const LIVED = TRIP.filter((id) => !BOOKED.includes(id));
/** TRIPPHOTO-08 / 09: every stop but Cebu has its photo — Uluwatu and Pererenan from his days there during the Canggu stay. */
const WITH_PHOTO = TRIP.filter((id) => id !== 'cebu-2026-11');

const row = (id: string): WasHereRow => {
  const found = WAS_HERE.find((r) => r.id === id);
  if (!found) throw new Error(`${id} is not a row`);
  return found;
};
const SIARGAO: WasHereRow = {
  id: 'siargao-2026', city: 'General Luna, Siargao', country: 'Philippines', countryCode: 'PH', start: '2026-10-22', end: null,
  experienceId: 'philippines-pro-2026', line: "I landed in Siargao in the middle of the WSL by luck. Don't get lucky. Book around it.", image: null, writtenOn: '2026-10-31',
  did: [], learned: [], events: [],
};
const TRAM: StopEvent = {
  name: 'Tram 28 centenary parade', venue: null, area: 'Alfama', start: '2026-09-05', end: '2026-09-06', status: 'took_place',
  sourceKind: 'secondary', sourceName: 'Lisboa Cultura', sourceUrl: 'https://example.org/tram-28', checkedOn: '2026-09-21', notes: null,
};
const LISBON: WasHereRow = {
  id: 'lisbon-2026', city: 'Lisbon', country: 'Portugal', countryCode: 'PT', start: '2026-09-01', end: '2026-09-20', experienceId: null,
  line: 'Three weeks of pastel de nata.', image: { src: '/was-here/lisbon-2026.jpg', alt: 'The 28 tram climbing Alfama', credit: 'Photo: Alex Stuart' }, writtenOn: '2026-09-21',
  did: ['the 28 tram', 'Belém by bike'], learned: ['Book the tram early.', 'Then the pastel.'], events: [TRAM],
};
const QUIET: WasHereRow = { ...LISBON, id: 'porto-2026', city: 'Porto', start: '2026-06-01', end: '2026-06-10', experienceId: null, line: null, image: null, writtenOn: '2026-06-11', did: [], learned: [], events: [] };
/** TRIPCARDS-01: the fixtures' costs — a card fails loud without its stop's row. */
const FIXTURE_COSTS: readonly TripCosts[] = [
  { stopId: 'lisbon-2026', stay: { kind: 'paid', name: 'A flat in Alfama', amountCents: 90000 }, moto: { kind: 'none' }, flightIn: { kind: 'unknown' } },
  { stopId: 'porto-2026', stay: { kind: 'unknown' }, moto: { kind: 'none' }, flightIn: { kind: 'unknown' } },
];
// WASHERE-03's Canggu list, kept as the listWords fixture — the row's lists moved into its post (TRIPPOST-01).
const CANGGU_DID = ['Beachwalk mall', 'a day trip to Uluwatu', 'sunset dinners and drinks at Times Beach Warung', 'Hatch market in Uluwatu', 'mini golf at Shooters', 'Echo Beach for sunsets and surf', 'the G Swing', 'the Gajah Mina statue at Pererenan Beach', 'Finns Beach Club'];
const lawOver = (...rows: WasHereRow[]) => wasHereLaw({ throwOnFail: false, rows });
const refuses = (rows: WasHereRow[], words: string) => {
  const v = lawOver(...rows);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};
const withEvent = (base: WasHereRow, ev: Partial<StopEvent>): WasHereRow => ({ ...base, events: [{ ...TRAM, ...ev }] });
const render = (rows: readonly WasHereRow[] = WAS_HERE, today = TODAY, costs: readonly TripCosts[] = [...TRIP_COSTS, ...FIXTURE_COSTS]) => renderToStaticMarkup(React.createElement(WasHereView, { rows, costs, today }));
const cardOf = (html: string, id: string) => { const at = html.indexOf(`data-was-here="${id}"`); const next = html.indexOf('data-was-here="', at + 1); return html.slice(at, next < 0 ? undefined : next); };
const pillsOf = (html: string) => [...html.matchAll(/data-was-here-pill="[^"]+">([^<]*)</g)].map((m) => m[1]);
const sectionsOf = (html: string) => [...html.matchAll(/data-was-here-section="([^"]+)"/g)].map((m) => m[1]);
const pos = (html: string, needle: string) => { const i = html.indexOf(needle); assert.ok(i > -1, `${needle} is rendered`); return i; };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** React's escaping of an apostrophe, in text and in attributes. */
const asHtml = (s: string) => s.replace(/'/g, '&#x27;');
/**
 * A card's three costs as words — "<name> · <amount>", or the amount alone — and every name's title the same words. TRIPCARDS-03
 * (2026-11-12): the name and the amount are each their own <dd>, the amount carrying its line's kind, and a stop with no name has an
 * empty <dd> with no title. Until then the name and the amount were spans in one <dd>, read by
 * /<dd class="[^"]*">(?:<span class="truncate" title="([^"]*)">([^<]*)<\/span><span aria-hidden="true">·<\/span>)?<span class="[^"]*">([^<]*)<\/span><\/dd>/g.
 */
const costsOfCard = (html: string, id: string) => [...cardOf(html, id).matchAll(/<dd class="[^"]*"(?: title="([^"]*)")?>([^<]*)<\/dd><dd class="[^"]*" data-kind="[^"]*">([^<]*)<\/dd>/g)].map((m) => {
  assert.equal(m[1], m[2] === '' ? undefined : m[2], 'the name\'s title holds its whole words — and no name, no title');
  return m[2] === '' ? m[3] : `${m[2]} · ${m[3]}`;
});
/** A card's label (I'M HERE, COMING UP) or null — TRIPCARDS-03: I'M HERE carries its dot before its words. */
const labelOf = (card: string) => /data-was-here-label="true">(?:<span class="[^"]*" aria-hidden="true"><\/span>)?([^<]*)</.exec(card)?.[1] ?? null;
/** The next calendar day, by arithmetic — no clock. */
const nextDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const inMonth = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  const [ny, nm, nd] = d < inMonth ? [y, m, d + 1] : m < 12 ? [y, m + 1, 1] : [y + 1, 1, 1];
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
};

// ── T1 · THE LAW ─────────────────────────────────────────────────────────────

test('T1 the live rows pass the law; the law throws by default on a failure; a fixture with a photo, two sections and an event passes', () => {
  assert.deepEqual(wasHereLaw({ throwOnFail: false }), []);
  assert.deepEqual(lawOver(SIARGAO, LISBON, QUIET), []);
  assert.throws(() => wasHereLaw({ rows: [SIARGAO, { ...LISBON, id: SIARGAO.id }] }), WasHereLawError);
});

test('T1 every row refusal, by name — the keys at thirteen (WASHERE-04), the two lists of non-empty strings (WASHERE-03)', () => {
  refuses([SIARGAO, { ...LISBON, id: 'siargao-2026' }], 'duplicate id');
  for (const field of ['city', 'country'] as const) refuses([{ ...SIARGAO, [field]: '  ' }], `empty ${field}`);
  refuses([{ ...SIARGAO, line: '   ' }], 'empty line');
  assert.deepEqual(lawOver({ ...SIARGAO, line: null }), [], 'null is unwritten, not empty');
  refuses([{ ...SIARGAO, countryCode: 'ph' }], 'not two upper-case letters');
  refuses([{ ...SIARGAO, countryCode: 'PHL' }], 'not two upper-case letters');
  refuses([{ ...SIARGAO, start: '22/10/2026' }], 'start "22/10/2026" is not YYYY-MM-DD');
  refuses([{ ...SIARGAO, writtenOn: 'Oct 31' }], 'writtenOn "Oct 31" is not YYYY-MM-DD');
  // TRIPCARDS-01 (2026-11-05): a start after writtenOn is a stop booked ahead — allowed, with nothing in did or learned.
  assert.deepEqual(lawOver({ ...SIARGAO, start: '2026-11-02' }), [], 'a planned stop with empty lists passes — booked, not lived');
  refuses([{ ...SIARGAO, start: '2026-11-02', did: ['surf'] }], 'a planned stop (start 2026-11-02 after writtenOn 2026-10-31) with did or learned — nothing has happened there yet');
  refuses([{ ...SIARGAO, start: '2026-11-02', learned: ['Book early.'] }], 'a planned stop (start 2026-11-02 after writtenOn 2026-10-31) with did or learned');
  assert.doesNotMatch(code(LEAF), /is after writtenOn/, 'the old refusal is gone — a start after writtenOn is a planned stop now');
  refuses([{ ...LISBON, end: '2026-08-31' }], 'is before start');
  refuses([{ ...LISBON, end: '20 Sep 2026' }], 'end "20 Sep 2026" is not YYYY-MM-DD');
  refuses([SIARGAO, { ...LISBON, end: null }], 'one place at a time');
  refuses([{ ...LISBON, image: { src: '/photos/lisbon.jpg', alt: 'a', credit: 'b' } }], 'is not /was-here/<slug>.jpg or .webp');
  refuses([{ ...LISBON, image: { src: '/was-here/Lisbon 2026.png', alt: 'a', credit: 'b' } }], 'is not /was-here/<slug>.jpg or .webp');
  refuses([{ ...LISBON, image: { src: '/was-here/lisbon-2026.webp', alt: '', credit: 'b' } }], 'image alt is empty');
  refuses([{ ...LISBON, image: { src: '/was-here/lisbon-2026.webp', alt: 'a', credit: ' ' } }], 'image credit is empty');
  refuses([{ ...SIARGAO, extra: 1 } as unknown as WasHereRow], 'exactly the thirteen ruled fields');
  refuses([Object.fromEntries(Object.entries(SIARGAO).filter(([k]) => k !== 'events')) as WasHereRow], 'exactly the thirteen ruled fields');
  refuses([{ ...SIARGAO, events: 'none' } as unknown as WasHereRow], 'events is not a list');
  refuses([{ ...SIARGAO, did: 'surf' } as unknown as WasHereRow], 'did is not a list'); // WASHERE-04 (2026-11-03): privacy.
  refuses([{ ...SIARGAO, did: ['surf', ''] }], 'did[1] is empty — a list holds non-empty strings');
  refuses([{ ...SIARGAO, learned: [' '] }], 'learned[0] is empty');
  refuses([{ ...SIARGAO, learned: [42] } as unknown as WasHereRow], 'learned[0] is empty');
  assert.deepEqual(lawOver({ ...SIARGAO, did: ['two', 'three'], learned: ['four.'] }), [], 'non-empty strings pass');
  assert.equal(WAS_HERE_FIELDS.length, 13); // WASHERE-04 (2026-11-03): privacy.
  assert.deepEqual([...WAS_HERE_FIELDS], ['id', 'city', 'country', 'countryCode', 'start', 'end', 'experienceId', 'line', 'image', 'writtenOn', 'did', 'learned', 'events']);
  assert.equal(STOP_EVENT_FIELDS.length, 11);
  assert.ok(!(STOP_EVENT_FIELDS as readonly string[]).includes('relation'), 'relation left the event (WASHERE-03)');
  assert.ok(WAS_HERE_IMAGE_SRC.test('/was-here/siargao-2026.jpg') && !WAS_HERE_IMAGE_SRC.test('/was-here/siargao.PNG'));
});

test('T1 every event refusal, by name — overlap required of every event; the near_miss and relation refusals gone (WASHERE-03)', () => {
  for (const field of ['name', 'area', 'sourceName'] as const) refuses([withEvent(LISBON, { [field]: ' ' })], `empty event ${field}`);
  refuses([withEvent(LISBON, { venue: '' })], 'event venue is present and empty');
  assert.deepEqual(lawOver(withEvent(LISBON, { venue: null })), [], 'null is the page naming no venue');
  refuses([withEvent(LISBON, { start: '5 Sep' })], 'event start "5 Sep" is not YYYY-MM-DD');
  refuses([withEvent(LISBON, { end: '2026-9-6' })], 'event end "2026-9-6" is not YYYY-MM-DD');
  refuses([withEvent(LISBON, { checkedOn: '' })], 'event checkedOn "" is not YYYY-MM-DD');
  refuses([withEvent(LISBON, { start: '2026-09-07', end: '2026-09-06' })], 'event start 2026-09-07 is after end 2026-09-06');
  refuses([withEvent(LISBON, { sourceUrl: 'http://example.org/tram-28' })], 'does not start with https://');
  refuses([withEvent(LISBON, { status: 'rained' as StopEvent['status'] })], 'is not took_place | scheduled | postponed | cancelled');
  refuses([withEvent(LISBON, { sourceKind: 'rumour' as StopEvent['sourceKind'] })], 'is not official | secondary');
  refuses([withEvent(LISBON, { start: '2026-09-25', end: '2026-09-26', status: 'scheduled' })], 'an event (2026-09-25 – 2026-09-26) that does not overlap the stay (2026-09-01 – 2026-09-20) — every event was on during the stop');
  refuses([withEvent(LISBON, { start: '2026-08-30', end: '2026-08-31' })], 'an event (2026-08-30 – 2026-08-31) that does not overlap the stay (2026-09-01 – 2026-09-20)');
  refuses([withEvent(SIARGAO, { start: '2026-10-01', end: '2026-10-02' })], 'does not overlap the stay (2026-10-22 – now)');
  assert.deepEqual(lawOver(withEvent(LISBON, { start: '2026-09-20', end: '2026-09-21' })), [], 'the travel day out overlaps');
  assert.deepEqual(lawOver(withEvent(LISBON, { start: '2026-08-31', end: '2026-09-01' })), [], 'the travel day in overlaps');
  assert.deepEqual(lawOver(withEvent(SIARGAO, { start: '2026-11-20', end: '2026-11-21', status: 'scheduled' })), [], 'an open stay overlaps everything after its start');
  refuses([withEvent(LISBON, { end: '2026-09-22', start: '2026-09-18' })], 'status took_place on an event ending 2026-09-22, after the entry was written on 2026-09-21');
  refuses([{ ...LISBON, events: [TRAM, { ...TRAM, venue: 'elsewhere' }] }], 'shares (name, start)');
  refuses([withEvent(LISBON, { extra: 1 } as unknown as Partial<StopEvent>)], 'exactly the eleven ruled fields');
  refuses([withEvent(LISBON, { relation: 'during' } as unknown as Partial<StopEvent>)], 'exactly the eleven ruled fields');
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /near_miss|relation|STOP_EVENT_RELATIONS|StopEventRelation/, 'the near_miss-on-overlap and relation-enum refusals are gone with the key');
  assert.match(leaf, /const overlaps = ev\.end >= row\.start && \(row\.end === null \|\| ev\.start <= row\.end\);\s*if \(!overlaps\) violations\.push/, 'overlap is required of every event');
});

// ── T2 · THE ROWS ────────────────────────────────────────────────────────────

test('T2 ten rows in trip order, the three booked ahead last (TRIPCARDS-01); eight events; every stop\'s two lists empty — Canggu\'s moved into its post (TRIPPOST-01); a kept event byte for byte; every row at thirteen keys and byte for byte against its digest; each end the next start', () => {
  assert.equal(WAS_HERE.length, 10);
  assert.deepEqual(tripOrder(WAS_HERE).map((r) => r.id), TRIP);
  assert.equal(WAS_HERE.reduce((n, r) => n + r.events.length, 0), 8);
  assert.deepEqual(Object.fromEntries(WAS_HERE.map((r) => [r.id, r.events.map((ev) => ev.name)])), {
    'canggu-2026-07': ['Pesta Kesenian Bali XLVIII (Bali Arts Festival)', 'Rip Curl Cup Padang Padang 2026 — women\'s local trials', 'Rare Angon International Kite Festival 2026'],
    'danang-2026-08': ['Hoi An full-moon lantern night', 'Hoi An Creative Week 2026'],
    'bangkok-2026-09': ['Kodaline — Farewell Tour', 'ONE Fight Night 47: Stamp vs Flores', 'Post Malone — The BIG ASS Stadium World Tour'],
    'phuket-2026-10': [], 'chiangmai-2026-10': [], 'bangkok-2026-10-21': [], 'siargao-2026': [],
    'cebu-2026-11': [], 'uluwatu-2026-11': [], 'pererenan-2026-12': [],
  });
  assert.deepEqual(row('canggu-2026-07').events[1], {
    name: 'Rip Curl Cup Padang Padang 2026 — women\'s local trials', venue: 'Padang Padang Beach', area: 'Pecatu, Bukit Peninsula', start: '2026-07-21', end: '2026-07-21', status: 'took_place',
    sourceKind: 'official', sourceName: 'Rip Curl Indonesia', sourceUrl: 'https://www.ripcurl.co.id/blogs/ripcurlcup/taina-izquierdo-and-paris-nalendra-secure-their-spots-in-the-rip-curl-cup-padang-padang-2026-main-event',
    checkedOn: '2026-10-31', notes: 'Taina Izquierdo and Paris Nalendra qualified for the main event',
  }, 'a kept row, byte for byte, less the relation key');
  assert.deepEqual(row('bangkok-2026-09').events[2], {
    name: 'Post Malone — The BIG ASS Stadium World Tour', venue: 'Rajamangala National Stadium', area: 'Bangkok', start: '2026-09-22', end: '2026-09-22', status: 'postponed',
    sourceKind: 'secondary', sourceName: 'Time Out Bangkok', sourceUrl: 'https://www.timeout.com/bangkok/news/post-malone-bangkok-concert-postponed-082826',
    checkedOn: '2026-10-31', notes: 'Postponed indefinitely by Live Nation Tero on Aug 28; refunds through Oct 31',
  });
  assert.deepEqual(WAS_HERE.flatMap((r) => r.events).filter((ev) => ev.venue === null), [], 'the two venueless events were near misses — cut');
  // TRIPPOST-01 (2026-11-05): Canggu's two lists moved into its post (src/lib/tripPosts.ts) — every row's are empty now.
  for (const r of WAS_HERE) {
    assert.deepEqual([r.did, r.learned], [[], []], `${r.id}: no did or learned on the row`);
    if (r.id !== 'siargao-2026') assert.ok(r.line === null && r.experienceId === null, `${r.id}: no line, no experience`);
  }
  // TRIPPHOTO-01 (2026-11-05): Canggu's photo is Alex's own.
  assert.deepEqual(row('canggu-2026-07').image, { src: '/was-here/canggu-2026-07.jpg', alt: 'Sunset at Canggu: the sun sinking into a low cloud over the sea, a surfer in silhouette riding a wave', credit: 'Photo: Alex Stuart' });
  // TRIPPHOTO-02 (2026-11-05): Da Nang's photo; TRIPPHOTO-03: the first Bangkok stop's; TRIPPHOTO-04: Chiang Mai's; TRIPPHOTO-05: Phuket's; TRIPPHOTO-06: the second Bangkok stop's; TRIPPHOTO-07: Siargao's — every stop he has been to has one.
  assert.deepEqual(row('danang-2026-08').image, { src: '/was-here/danang-2026-08.jpg', alt: 'Da Nang\'s Dragon Bridge breathing fire at night, a crowd along the railing filming it, red lanterns under the bridge and the city lit up behind', credit: 'Photo: Alex Stuart' });
  assert.deepEqual(row('bangkok-2026-09').image, { src: '/was-here/bangkok-2026-09.jpg', alt: 'A giant golden seated Buddha lit up at night in Bangkok, seen in profile against a dark sky with the moon beside it', credit: 'Photo: Alex Stuart' });
  assert.deepEqual(row('chiangmai-2026-10').image, { src: '/was-here/chiangmai-2026-10.jpg', alt: 'Sunset over the mountains behind Chiang Mai, rays of light breaking through the clouds above the city', credit: 'Photo: Alex Stuart' });
  assert.deepEqual(row('phuket-2026-10').image, { src: '/was-here/phuket-2026-10.jpg', alt: 'A shaded dirt path with a rope fence above a turquoise cove in Phuket, green hills around the bay', credit: 'Photo: Alex Stuart' });
  assert.deepEqual(row('bangkok-2026-10-21').image, { src: '/was-here/bangkok-2026-10-21.jpg', alt: 'Wat Arun lit gold at night at the end of a Bangkok street, a cyclist riding toward it', credit: 'Photo: Alex Stuart' });
  assert.deepEqual(row('siargao-2026').image, { src: '/was-here/siargao-2026.jpg', alt: 'A surfer paddling beside an outrigger boat off Siargao, the island and a breaking reef on the horizon', credit: 'Photo: Alex Stuart' });
  assert.deepEqual(TRIP.filter((id) => row(id).image !== null), WITH_PHOTO, 'a photo for every stop he has been to, and for Uluwatu and Pererenan from his days there (TRIPPHOTO-08 / 09); none yet for Cebu');
  assert.deepEqual(LIVED.filter((id) => row(id).image === null), [], 'every stop he has stayed at has its photo');
  assert.deepEqual(row('uluwatu-2026-11').image, { src: '/was-here/uluwatu-2026-11.jpg', alt: 'A dirt road on the cliffs at Uluwatu, a scooter heading down it toward the sea, a hand-painted parking sign in the scrub and waves breaking on the reef', credit: 'Photo: Alex Stuart' });
  assert.deepEqual(row('pererenan-2026-12').image, { src: '/was-here/pererenan-2026-12.jpg', alt: 'Sunset over Pererenan Beach, people walking along the sand and the rocks, a beach bar under the palms', credit: 'Photo: Alex Stuart' });
  assert.deepEqual(WAS_HERE.map((r) => [r.id, r.writtenOn]), TRIP.map((id) => [id, BOOKED.includes(id) ? '2026-11-05' : '2026-10-31']), 'TRIPCARDS-01: the booked-ahead stops were entered on Nov 5');
  assert.ok(WAS_HERE.every((r) => r.events.every((ev) => ev.checkedOn === '2026-10-31')));
  // TRIPCARDS-01: a planned stop is one whose start is after its writtenOn — exactly the three, each with nothing lived yet.
  assert.deepEqual(WAS_HERE.filter((r) => r.start > r.writtenOn).map((r) => r.id), BOOKED);
  for (const id of BOOKED) assert.ok(row(id).events.length === 0 && row(id).line === null && row(id).experienceId === null, `${id}: booked ahead — no events, no line yet`);
  assert.deepEqual(WAS_HERE.filter((r) => r.end === null), [], 'TRIPCARDS-01: every stop has its end — which one is current is the server\'s day to say (stopStatus)');
  assert.deepEqual(row('siargao-2026'), { ...SIARGAO, end: '2026-11-13', image: row('siargao-2026').image }, 'the Siargao row as built, plus the two empty lists and its photo (TRIPPHOTO-07); its stay closes Nov 13, the day the flight to Cebu leaves (TRIPCARDS-01)');
  const ordered = tripOrder(WAS_HERE);
  for (let i = 1; i < ordered.length; i += 1) assert.equal(ordered[i - 1].end, ordered[i].start, `${ordered[i - 1].id} ends the day ${ordered[i].id} starts`);
  assert.deepEqual(ordered.map((r) => [r.id, r.city, r.countryCode, r.start, r.end]), [
    ['canggu-2026-07', 'Canggu, Bali', 'ID', '2026-07-01', '2026-07-30'], ['danang-2026-08', 'Da Nang / Hoi An', 'VN', '2026-07-30', '2026-08-28'],
    ['bangkok-2026-09', 'Bangkok', 'TH', '2026-08-28', '2026-09-25'], ['phuket-2026-10', 'Phuket', 'TH', '2026-09-25', '2026-10-08'],
    ['chiangmai-2026-10', 'Chiang Mai', 'TH', '2026-10-08', '2026-10-21'], ['bangkok-2026-10-21', 'Bangkok', 'TH', '2026-10-21', '2026-10-22'],
    ['siargao-2026', 'General Luna, Siargao', 'PH', '2026-10-22', '2026-11-13'], ['cebu-2026-11', 'Cebu', 'PH', '2026-11-13', '2026-11-20'],
    ['uluwatu-2026-11', 'Uluwatu, Bali', 'ID', '2026-11-20', '2026-12-01'], ['pererenan-2026-12', 'Pererenan Beach, Bali', 'ID', '2026-12-01', '2026-12-11'],
  ]);
  assert.ok(EXPERIENCES.some((e) => e.id === row('siargao-2026').experienceId), 'the event it names exists');
  // WASHERE-04 (2026-11-03): privacy. Every row carries the thirteen keys in the ruled order, and is byte for byte as pinned.
  for (const r of WAS_HERE) assert.deepEqual(Object.keys(r), [...WAS_HERE_FIELDS], `${r.id}: the thirteen keys, in order`);
  const DIGESTS: Readonly<Record<string, string>> = {
    'canggu-2026-07': 'a3c1f5cec1a605f2452f5004aa75d365a3b482b8f114791d7b290e306e732f2c', // TRIPPOST-01: its two lists emptied; TRIPPHOTO-01: its photo
    'danang-2026-08': '001beae2dd068c38ca31c6bbbb091140945326cb8b32e8d0623d2292a133265b', // TRIPPHOTO-02: its photo
    'bangkok-2026-09': '597272349a6f21ffa4c8de6fab0507c0a790a3e61851794861bfc554187e1fd6', // TRIPPHOTO-03: its photo
    'phuket-2026-10': '123c543f71ee2c676f9a16c13c7488a0d0babc60f1b3a2a35e2886e0db2b06a0', // TRIPPHOTO-05: its photo
    'chiangmai-2026-10': '153917683583fa2ef02b703c5c9ee58f26244af924e03a7250f5bba7b7900fcf', // TRIPPHOTO-04: its photo
    'bangkok-2026-10-21': '6fc949f32caca8e35ffa1cd30cde2edebca2cd7e8a4d157e0f4bf2945b76407b', // TRIPPHOTO-06: its photo
    'siargao-2026': '4cf5de0291bf7ac5d65dfe36d8576367ede4874e283e3192e11c3837ad956343', // TRIPPHOTO-07: its photo; TRIPCARDS-01: its end, Nov 13
    'cebu-2026-11': '33891cfe1120c18a40aa9ce242884ec5664ff5b7626e9245b509ba13124ed97d', // TRIPCARDS-01: booked ahead
    'uluwatu-2026-11': '7e75966cddcd231d3f10b5fc21b49b54e8a4defaf82566f5831e5d4d7861df3d', // TRIPCARDS-01: booked ahead; TRIPPHOTO-08: its photo
    'pererenan-2026-12': '70697d4b9cc46a3076bdebeedf4cb9786d6d7d7c74c8b8c2739be532ec0df748', // TRIPCARDS-01: booked ahead; TRIPPHOTO-09: its photo
  };
  assert.deepEqual(Object.keys(DIGESTS), TRIP);
  for (const r of WAS_HERE) assert.equal(createHash('sha256').update(JSON.stringify(r)).digest('hex'), DIGESTS[r.id], `${r.id}: byte for byte`);
});

// ── T3 · THE WORDS ───────────────────────────────────────────────────────────

test('T3 the words: the status and the label from the server\'s day (TRIPCARDS-01), the stay; tripOrder, stopWords, listWords (WASHERE-03); the near-miss words gone', () => {
  // TRIPCARDS-01 (Alex, 2026-11-05): lose "I was here" — no label once he has left; I'M HERE while there; COMING UP before.
  assert.deepEqual(['2026-08-31', '2026-09-01', '2026-09-19', '2026-09-20', TODAY].map((d) => stopStatus(LISBON, d)), ['next', 'now', 'now', 'past', 'past'], 'before · from its start · up to its end · the travel day out is the next stop\'s');
  assert.deepEqual(['2026-08-31', '2026-09-01', '2026-09-20'].map((d) => stopLabel(LISBON, d)), ['COMING UP', "I'M HERE", null]);
  assert.equal(stopLabel(SIARGAO, TODAY), "I'M HERE");
  assert.equal(stopStatus(SIARGAO, '2026-10-21'), 'next');
  assert.equal(stopStatus(SIARGAO, '2027-06-01'), 'now', 'an open stay (end null) is current from its start on');
  // The live trip, every day from Jul 1 to Dec 10: exactly one stop current — none before the first, none from Dec 11.
  const current = (d: string) => WAS_HERE.filter((r) => stopStatus(r, d) === 'now').map((r) => r.id);
  let days = 0;
  for (let d = '2026-07-01'; d < '2026-12-11'; d = nextDay(d), days += 1) assert.equal(current(d).length, 1, `${d}: one stop is current`);
  assert.equal(days, 163, 'Jul 1 → Dec 10, every day');
  for (const [d, id] of [['2026-07-01', 'canggu-2026-07'], ['2026-07-30', 'danang-2026-08'], ['2026-10-21', 'bangkok-2026-10-21'], ['2026-10-22', 'siargao-2026'], ['2026-11-05', 'siargao-2026'], ['2026-11-12', 'siargao-2026'], ['2026-11-13', 'cebu-2026-11'], ['2026-11-20', 'uluwatu-2026-11'], ['2026-12-01', 'pererenan-2026-12'], ['2026-12-10', 'pererenan-2026-12']] as const) assert.deepEqual(current(d), [id], d);
  assert.deepEqual(current('2026-06-30'), []);
  assert.deepEqual(current('2026-12-11'), [], 'after the last stop, none');
  assert.equal(stayWords(SIARGAO), 'Since Oct 22, 2026');
  assert.equal(stayWords(row('siargao-2026')), 'Oct 22 – Nov 13, 2026');
  assert.equal(stayWords(LISBON), 'Sep 1–20, 2026');
  assert.deepEqual(tripOrder([SIARGAO, LISBON, QUIET]).map((r) => r.id), ['porto-2026', 'lisbon-2026', 'siargao-2026']);
  const given = [SIARGAO, LISBON];
  tripOrder(given);
  assert.deepEqual(given.map((r) => r.id), ['siargao-2026', 'lisbon-2026'], 'a copy — the input is not sorted in place');
  assert.equal(stopWords(1), 'Stop 1');
  assert.equal(stopWords(7), 'Stop 7');
  assert.equal(stopWords(10), 'Stop 10');
  assert.equal(listWords(['one', 'two']), 'one · two');
  assert.equal(listWords(['one']), 'one');
  assert.equal(listWords(CANGGU_DID), 'Beachwalk mall · a day trip to Uluwatu · sunset dinners and drinks at Times Beach Warung · Hatch market in Uluwatu · mini golf at Shooters · Echo Beach for sunsets and surf · the G Swing · the Gajah Mina statue at Pererenan Beach · Finns Beach Club');
  const words = code(WORDS);
  assert.match(words, /import \{ dateWords, dayWords \} from '\.\/experienceWords';/, 'one dateWords in the codebase');
  assert.doesNotMatch(words, /toLocale|new Date\(|Date\.now|Intl\./);
  assert.doesNotMatch(words, /newestFirst|daysBetween|daysFromCivil|missedWords|missedPill|WasHereWordsError|near_miss|days after|days before/, 'deleted with their fixtures (WASHERE-03)');
  assert.doesNotMatch(words, /wasHereLabel|I WAS HERE/, 'TRIPCARDS-01: the old label left with "I was here"');
});

test('T3 stopEventLine for every status × sourceKind; onPill with the area when venue is null; the three ruled pills from the live rows', () => {
  const at = (status: StopEvent['status'], sourceKind: StopEvent['sourceKind']): StopEvent => ({ ...TRAM, status, sourceKind, sourceName: sourceKind === 'official' ? 'The Hall' : 'The Gazette' });
  assert.equal(stopEventLine(at('took_place', 'official')), 'Sep 5–6, 2026 · took place · per The Hall');
  assert.equal(stopEventLine(at('took_place', 'secondary')), 'Sep 5–6, 2026 · took place · reported by The Gazette');
  assert.equal(stopEventLine(at('scheduled', 'official')), 'Sep 5–6, 2026 · per The Hall');
  assert.equal(stopEventLine(at('scheduled', 'secondary')), 'Sep 5–6, 2026 · reported by The Gazette');
  assert.equal(stopEventLine(at('postponed', 'official')), 'Sep 5–6, 2026 · postponed · per The Hall');
  assert.equal(stopEventLine(at('postponed', 'secondary')), 'Sep 5–6, 2026 · postponed · reported by The Gazette');
  assert.equal(stopEventLine(at('cancelled', 'official')), 'Sep 5–6, 2026 · cancelled · per The Hall');
  assert.equal(stopEventLine(at('cancelled', 'secondary')), 'Sep 5–6, 2026 · cancelled · reported by The Gazette');
  assert.equal(onPill(TRAM), 'Tram 28 centenary parade · Alfama · Sep 5–6, 2026 · took place · reported by Lisboa Cultura', 'the area when venue is null');
  const ev = (stop: string, name: string) => { const e = row(stop).events.find((x) => x.name === name); if (!e) throw new Error(`${stop}: ${name} missing`); return e; };
  assert.equal(onPill(ev('canggu-2026-07', 'Rip Curl Cup Padang Padang 2026 — women\'s local trials')), 'Rip Curl Cup Padang Padang 2026 — women\'s local trials · Padang Padang Beach · Jul 21, 2026 · took place · per Rip Curl Indonesia');
  assert.equal(onPill(ev('bangkok-2026-09', 'Post Malone — The BIG ASS Stadium World Tour')), 'Post Malone — The BIG ASS Stadium World Tour · Rajamangala National Stadium · Sep 22, 2026 · postponed · reported by Time Out Bangkok');
  assert.equal(onPill(ev('danang-2026-08', 'Hoi An Creative Week 2026')), 'Hoi An Creative Week 2026 · Song Hoai Square and the Ancient Town · Aug 28 – Sep 2, 2026 · took place · per Da Nang tourism portal; Tuoi Tre News');
});

// ── T4 · THE SECTION, RENDERED ───────────────────────────────────────────────

test('T4 rendered with the live rows: the h2 "Our Story" (HOME-ORDER-01, 2026-11-10); ten cards Canggu → Pererenan in one row that scrolls sideways, Stop 1 … Stop 10; nine photos, each inside the link to its stop\'s page; every card\'s three costs on one line each and its "Read the post →"; no label once he has left — and nothing else on any card: no post block, no event block, no line, no pills, no sections, no strip link', () => {
  const html = render();
  assert.equal(MY_TRIP_ANCHOR, 'my-trip');
  assert.match(html, /<section id="my-trip" aria-label="My trip"/);
  assert.equal(MY_TRIP_LINE, "Stop by stop, dated, with the whole story where I've written it up."); // TRIPPOST-01
  assert.equal(MY_TRIP_HEADLINE, 'Our Story'); // HOME-ORDER-01 (2026-11-10): Alex's heading — OUR_STORY_HEADING, src/lib/homeActWords.ts. Until then: "Where I've been, and where I'm going." (TRIPCARDS-01, 2026-11-05: the stops booked ahead join).
  assert.match(html, /<h2 class="[^"]*">Our Story<\/h2><p class="[^"]*">Stop by stop, dated, with the whole story where I&#x27;ve written it up\.<\/p>/);
  assert.ok(html.includes(MY_TRIP_EYEBROW) && html.includes(asHtml(MY_TRIP_HEADLINE)) && html.includes(asHtml(MY_TRIP_LINE)));
  // TRIPCARDS-01 (Alex, 2026-11-06): "horizontal scroll cards" — one row, each card one width, snapping; only the row scrolls sideways.
  // TRIPCARDS-03 (2026-11-12): the row is the port's .ts-story-row, standing OUTSIDE the page container — the head's container closes
  // before it, so it runs the full width of the section — and each card the port's .ts-story-card (its width, its snap and its column
  // are the port's rules: tripCards03.test.ts holds them to the reference). Until then the row wore Tailwind's flex overflow-x-auto
  // snap-x snap-proximity gap-4 -mx-4 px-4 scroll-px-4 lg:-mx-8 lg:px-8 lg:scroll-px-8 [&::-webkit-scrollbar]:h-2
  // [&::-webkit-scrollbar-thumb]:bg-border inside the container, and each card w-[21rem] shrink-0 snap-start flex flex-col.
  const rail = /<div class="([^"]*)" id="story-row" data-was-here-rail="true">/.exec(html);
  assert.ok(rail && rail[1] === 'ts-story-row', 'the row is drawn — the port\'s');
  assert.ok(html.includes('</button></div></div></div><div class="ts-story-row" id="story-row" data-was-here-rail="true">'), 'the arrows, the head and the page container close before the row: it runs the section\'s full width');
  assert.doesNotMatch(html, /sm:grid-cols-2|lg:grid-cols-3|flex-wrap/, 'no grid of cards and no wrapping — one row');
  assert.ok(!rail[1].split(' ').includes('grid'), 'the row is a flex row, not a grid');
  for (const id of TRIP) assert.match(html, new RegExp(`<article class="ts-story-card" data-was-here="${id}"`), `${id}: the port's card — one width, snapping to its start, a column`);
  assert.doesNotMatch(html, /Newest first/);
  assert.deepEqual([...html.matchAll(/data-was-here="([^"]+)"/g)].map((m) => m[1]), TRIP);
  // TRIPCARDS-03: "Stop n" is the stop line's first span (until then the line's own text: /data-was-here-stop="(\d+)">([^<]*)</g).
  assert.deepEqual([...html.matchAll(/data-was-here-stop="(\d+)"><span>([^<]*)<\/span>/g)].map((m) => [m[1], m[2]]), TRIP.map((_, i) => [String(i + 1), `Stop ${i + 1}`]));
  // TRIPPHOTO-01 … 07; TRIPCARDS-01: every photo inside a link to its stop's page that stays out of the tab order.
  assert.equal((html.match(/<img /g) ?? []).length, 9, 'nine photos on the act — every stop but Cebu (TRIPPHOTO-01 … 09)');
  for (const id of WITH_PHOTO) {
    const image = row(id).image!;
    // TRIPCARDS-03 (2026-11-12): the photo WHOLE — its link is the frame (the port's .ts-story-card__photo, 3 : 2) and holds the img alone,
    // with no class of its own; the credit left the photo for the stop line's right. Until then (TRIPCARDS-02, 2026-11-08): <figure
    // class="h-full"><a … class="block h-full"><img … class="h-full w-full object-cover"/></a><figcaption …>Photo: Alex Stuart</figcaption></figure>.
    assert.match(cardOf(html, id), new RegExp(`<a href="/my-trip/${id}" tabindex="-1" aria-hidden="true" class="ts-story-card__photo"><img src="${esc(image.src)}" alt="${esc(asHtml(image.alt))}" loading="lazy"/></a>`), `${id}: its photo, whole, opens its page`);
    assert.ok(cardOf(html, id).includes('</p><span class="ts-story-card__credit">Photo: Alex Stuart</span></div>'), `${id}: its credit at the stop line's right`);
  }
  assert.deepEqual(TRIP.filter((id) => !/<img /.test(cardOf(html, id))), ['cebu-2026-11'], 'only Cebu has no photo yet');
  assert.doesNotMatch(cardOf(html, 'cebu-2026-11'), /<figure|<img|ts-story-card__photo|ts-story-card__credit/, 'no placeholder box and no credit while its image is null');
  // TRIPCARDS-01 (Alex, 2026-11-05): every card in the Canggu card's shape — its three costs, then "Read the post →" to its page.
  for (const id of TRIP) {
    const card = cardOf(html, id);
    assert.deepEqual([...card.matchAll(/data-was-here-cost="([^"]+)"><dt class="[^"]*">([^<]*)<\/dt>/g)].map((m) => [m[1], m[2]]), [['Stay', 'Stay'], ['Motorbike', 'Motorbike'], ['Flight in', 'Flight in']], `${id}: its three costs`);
    assert.match(card, new RegExp(`<a href="/my-trip/${id}" class="[^"]*" data-was-here-post-link="true">${esc(READ_THE_POST)}</a>`), `${id}: its page`);
    assert.ok(pos(card, 'data-was-here-stop=') < pos(card, 'data-was-here-costs=') && pos(card, 'data-was-here-costs=') < pos(card, 'data-was-here-post-link'), `${id}: stop → costs → the link`);
  }
  assert.equal((html.match(/data-was-here-post-link=/g) ?? []).length, 10, 'one "Read the post →" per card');
  assert.deepEqual(costsOfCard(html, 'canggu-2026-07'), ['The Daun · $708.14', 'Nyoman Motorbike (Nmax) · $131.79', 'China Air · $837.20'], 'Alex: drop "Rental" so it stays on one line');
  assert.deepEqual(costsOfCard(html, 'bangkok-2026-10-21'), ['Eleven Bangkok Sukhumvit 11 · $43.98', 'n/a', 'Vietjet · $47.20']);
  assert.deepEqual(costsOfCard(html, 'danang-2026-08'), ['Sky Village Đà Nẵng · $980.73', 'n/a', 'Vietjet · $176.10']);
  assert.deepEqual(costsOfCard(html, 'bangkok-2026-09'), ['Premier Thonglor · $1,007.72', 'n/a', 'Thai Vietjet · $149.90']);
  assert.deepEqual(costsOfCard(html, 'siargao-2026'), ['Rodeo Sun Hotel · $638.24', 'Kook Moto Rental (Fazzio) · $63.53', 'Philippine Airlines · $260.50']);
  assert.deepEqual(costsOfCard(html, 'cebu-2026-11'), ['The Noble Cebu · $217.26', 'not in my log yet', 'Philippine Airlines · $104.05']);
  assert.deepEqual(costsOfCard(html, 'pererenan-2026-12'), ['Anaya Boutique Hotel · $285.90', 'not in my log yet', 'not in my log yet']);
  // TRIPCARDS-01: the label from the server's day — none once he has left, I'M HERE while there, COMING UP before.
  assert.deepEqual(TRIP.map((id) => labelOf(cardOf(html, id))), [null, null, null, null, null, null, 'I&#x27;M HERE', 'COMING UP', 'COMING UP', 'COMING UP']);
  assert.doesNotMatch(html, /I WAS HERE/);
  const canggu = cardOf(html, 'canggu-2026-07');
  // TRIPCARDS-03 (2026-11-12): "the city, the country" — each its own line (until then one <h3>: />Canggu, Bali, Indonesia</).
  assert.match(canggu, />Canggu, Bali<\/h3><p class="ts-story-card__country">Indonesia<\/p>/);
  assert.match(canggu, /data-was-here-stay="true">Jul 1–30, 2026</);
  assert.match(canggu, /data-was-here-stop="1"><span>Stop 1<\/span>/);
  // TRIPCARDS-01 (Alex, 2026-11-05): "all i care to show on the card is destination, stay / bike / and flight in" — Canggu's post title and line left the card (its page carries the title).
  assert.doesNotMatch(html, /Thirty days in Canggu|Every day of it|data-was-here-post=|data-was-here-post-title|Stayed at/, 'no post block on any card');
  assert.ok(pos(canggu, 'data-was-here-stop') < pos(canggu, 'data-was-here-costs=') && pos(canggu, 'data-was-here-costs=') < pos(canggu, 'data-was-here-post-link'), 'stop → the costs → its page');
  // TRIPCARDS-01: no pills on any card — every stop's events (WHAT WAS ON) live on its page, one home per event.
  assert.deepEqual(pillsOf(html), []);
  assert.doesNotMatch(html, /WHAT WAS ON|data-was-here-list|data-was-here-pill|target="_blank"/, 'no event pill and no outside link on any card');
  assert.deepEqual(sectionsOf(html), [], 'no row carries DID or LEARNED (TRIPPOST-01)');
  assert.doesNotMatch(html, />DID<|>LEARNED</);
  // TRIPCARDS-01: Siargao's event block, Alex's line and the booking link left its card for its page.
  assert.doesNotMatch(html, /data-was-here-line|data-was-here-event|data-experience-line|href="#demo"|Book the stay|Siargao in the middle|Philippines Pro/, 'no line, no event block, no strip link on any card');
  const siargao = cardOf(html, 'siargao-2026');
  assert.equal(labelOf(siargao), 'I&#x27;M HERE');
  assert.match(siargao, /data-was-here-stay="true">Oct 22 – Nov 13, 2026</);
  // TRIPCARDS-03 (2026-11-12): the label is a chip beside the stop number — I'M HERE filled, with its dot — and the credit at the line's
  // right. Until then: data-was-here-stop="7">Stop 7<span aria-hidden="true"> · </span><span class="[^"]*" data-was-here-label="true">I&#x27;M HERE</span></p>.
  assert.match(siargao, /data-was-here-stop="7"><span>Stop 7<\/span><span class="ts-story-chip" data-status="now" data-was-here-label="true"><span class="ts-story-chip__dot" aria-hidden="true"><\/span>I&#x27;M HERE<\/span><\/p><span class="ts-story-card__credit">Photo: Alex Stuart<\/span>/, 'the label beside the stop number, the credit at the line\'s right');
  // Every card, the same parts in the same order — and its last child the link.
  for (const id of TRIP) {
    const card = cardOf(html, id);
    const parts = [...card.matchAll(/data-was-here-(label|stay|stop|costs|post-link)=/g)].map((m) => m[1]);
    // TRIPCARDS-01d (Alex, 2026-11-06): "Stop 1 / Canggu, Bali, Indonesia / July 1-30, 2026" — the stop number on top of the place, under the photo credit; the label beside it.
    assert.deepEqual(parts, ['stop', ...(['siargao-2026', ...BOOKED].includes(id) ? ['label'] : []), 'stay', 'costs', 'post-link'], `${id}: the stop and what it cost, nothing else`);
    // TRIPCARDS-03 (2026-11-12): the stop line opens the card's words, its credit at its right — then the city, the country, the dates.
    // Until then (TRIPCARDS-01d, the credit under the photo): credit → stop → place → dates.
    const order = ['data-was-here-stop=', ...(card.includes('<img ') ? ['class="ts-story-card__credit"'] : []), '<h3', 'class="ts-story-card__country"', 'data-was-here-stay='].map((needle) => pos(card, needle));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${id}: stop → credit → city → country → dates`);
    // TRIPCARDS-03: the foot — the costs, then the post — closes the card's body, and the body the card. Until then (TRIPCARDS-02,
    // 2026-11-08): /<div class="mx-3\.5 mb-3\.5 mt-auto pt-4"><a href="[^"]*" class="[^"]*" data-was-here-post-link="true">Read the post →<\/a><\/div><\/article>/.
    assert.match(card, /<div class="ts-story-card__foot"><dl class="ts-story-costs" data-was-here-costs="[^"]*">(?:(?!<\/dl>).)*<\/dl><a href="[^"]*" class="ts-story-card__post" data-was-here-post-link="true">Read the post →<\/a><\/div><\/div><\/article>/, `${id}: the costs, then the link, close the card, on its bottom edge`);
  }
  // TRIPCARDS-03 (2026-11-12): the city and the country each their own line; "Stop n" the stop line's first span. Until then the
  // place was one <h3> ('Cebu, Philippines', 'Uluwatu, Bali, Indonesia', 'Pererenan Beach, Bali, Indonesia') and the stop's text the line's own.
  for (const [id, city, country, stay, n] of [['cebu-2026-11', 'Cebu', 'Philippines', 'Nov 13–20, 2026', 8], ['uluwatu-2026-11', 'Uluwatu, Bali', 'Indonesia', 'Nov 20 – Dec 1, 2026', 9], ['pererenan-2026-12', 'Pererenan Beach, Bali', 'Indonesia', 'Dec 1–11, 2026', 10]] as const) {
    const card = cardOf(html, id);
    assert.ok(card.includes(`>${city}</h3><p class="ts-story-card__country">${country}</p>`), `${id}: ${city}, ${country}`);
    assert.ok(card.includes(`data-was-here-stay="true">${stay}<`), `${id}: ${stay}`);
    assert.ok(card.includes(`data-was-here-stop="${n}"><span>Stop ${n}</span>`), `${id}: Stop ${n}`);
  }
  assert.doesNotMatch(html, /JUST MISSED|No event I could verify|days after I left|days before I arrived|data-was-here-none/, 'the near-miss list and the "No event" line are gone');
  assert.doesNotMatch(html, /countdown|BUY NOW/i);
  assert.doesNotMatch(html, /\bfree\b/i);
});

test('T4 rendered fixtures: a stop that holds a photo, a line, two lists and an event shows only its photo (opening its page), the stop, its costs and its link; a stop around an event shows no event block; the label from the day; a stop with no costs row fails loud', () => {
  const html = render([SIARGAO, LISBON, QUIET]);
  assert.deepEqual([...html.matchAll(/data-was-here="([^"]+)"/g)].map((m) => m[1]), ['porto-2026', 'lisbon-2026', 'siargao-2026'], 'trip order, derived');
  assert.deepEqual([...html.matchAll(/data-was-here-stop="(\d+)"/g)].map((m) => m[1]), ['1', '2', '3']);
  const lisbon = cardOf(html, 'lisbon-2026');
  // TRIPCARDS-03 (2026-11-12): the photo whole in its frame, the link; the credit on the stop line. Until then (TRIPCARDS-02, 2026-11-08):
  // <figure class="h-full"><a … class="block h-full"><img … class="h-full w-full object-cover"/></a>, the credit in a <figcaption>.
  assert.match(lisbon, /<a href="\/my-trip\/lisbon-2026" tabindex="-1" aria-hidden="true" class="ts-story-card__photo"><img src="\/was-here\/lisbon-2026\.jpg" alt="The 28 tram climbing Alfama" loading="lazy"\/><\/a>/);
  assert.match(lisbon, /<span class="ts-story-card__credit">Photo: Alex Stuart</);
  assert.doesNotMatch(lisbon, /data-was-here-label/, 'a stop he has left carries no label (TRIPCARDS-01)');
  assert.match(lisbon, /data-was-here-stay="true">Sep 1–20, 2026</);
  assert.match(lisbon, /data-was-here-stop="2"><span>Stop 2<\/span>/);
  assert.deepEqual(costsOfCard(html, 'lisbon-2026'), ['A flat in Alfama · $900.00', 'n/a', 'not in my log yet']);
  assert.match(lisbon, /<a href="\/my-trip\/lisbon-2026" class="[^"]*" data-was-here-post-link="true">Read the post →<\/a>/);
  // TRIPCARDS-01: the line, DID, LEARNED and the stop's event are the stop page's (tripPost01.test.ts renders them there).
  assert.doesNotMatch(lisbon, /Three weeks of pastel de nata|the 28 tram ·|Book the tram early|Tram 28 centenary parade|>DID<|>LEARNED<|WHAT WAS ON|data-was-here-section|data-was-here-line|data-was-here-pill|data-was-here-event|href="#demo"/);
  assert.deepEqual(pillsOf(lisbon), []);
  const porto = cardOf(html, 'porto-2026');
  assert.match(porto, /data-was-here-stop="1"><span>Stop 1<\/span>/);
  assert.doesNotMatch(porto, /<img|<figure|ts-story-card__photo|data-was-here-section|data-was-here-line/, 'no image, no placeholder');
  assert.deepEqual(costsOfCard(html, 'porto-2026'), ['not in my log yet', 'n/a', 'not in my log yet']);
  const siargao = cardOf(html, 'siargao-2026');
  assert.equal(labelOf(siargao), 'I&#x27;M HERE', 'an open stay, current on the day');
  assert.doesNotMatch(siargao, /data-was-here-event|data-experience-line|Philippines Pro|Siargao in the middle|href="#demo"/, 'the event it was around and Alex\'s line are on its page, not its card');
  assert.doesNotThrow(() => render([{ ...SIARGAO, experienceId: 'not-an-event' }]), 'the card never reads the event — the stop page and the build law refuse a stale id');
  assert.deepEqual(sectionsOf(html), [], 'no section on any card');
  // TRIPCARDS-01: the same fixtures on other days — COMING UP before the stop, I'M HERE from its first day.
  assert.equal(labelOf(cardOf(render([SIARGAO, LISBON, QUIET], '2026-08-31'), 'lisbon-2026')), 'COMING UP');
  assert.equal(labelOf(cardOf(render([LISBON], '2026-09-01'), 'lisbon-2026')), 'I&#x27;M HERE');
  assert.throws(() => render([LISBON], TODAY, TRIP_COSTS), /"lisbon-2026" has no costs row/, 'a stop with no costs row fails loud — never a card without them (TRIPCARDS-01)');
  // A name too long for the card's width stays on one line — it ends in "…" there and keeps its whole words in its title.
  const long = 'A very long name for a guesthouse that would never fit on one line of a card';
  const longHtml = render([LISBON], TODAY, [{ ...FIXTURE_COSTS[0], stay: { kind: 'paid', name: long, amountCents: 90000 } }]);
  // TRIPCARDS-03 (2026-11-12): the name and the amount each their own <dd> — the port ends the name in "…" and never wraps or cuts the
  // amount (tripCards03.test.ts holds those rules). Until then (TRIPCARDS-02): <span class="truncate" title="…">…</span><span
  // aria-hidden="true">·</span><span class="shrink-0 whitespace-nowrap font-mono text-xs text-white/80">$900.00</span>.
  assert.ok(longHtml.includes(`<dd class="ts-story-cost__name" title="${long}">${long}</dd><dd class="ts-story-cost__amount" data-kind="paid">$900.00</dd>`), 'the name truncates, the amount never shrinks');
});

test('T4 TRIPCARDS-03 (Alex\'s brief, 2026-11-12; the board approved on the design canvas at 21:21): the look as drawn — every card the port\'s white card; a photo card opens with its photo whole in its frame, nothing drawn on it, then the body; the stop he is at ringed by its status, the others past or next; Cebu, with no photo, opens with its body — no frame, no credit, its stop line, then its place', () => {
  // Until then (TRIPCARDS-02, Alex, 2026-11-08) this test held the trip.com look: every card dark (bg-text-primary, never bg-white); on a
  // photo card the figure (its credit on the band), the stop chip and the band (the place, then the dates) inside ONE relative h-80 block,
  // before the costs; Cebu with no h-80 block and no figure, its chip static. The handoff's README: "What leaves: the dark card
  // (TRIPCARDS-02's trip.com look) and the 320px crop; the chip and the band on the photo".
  const html = render();
  for (const id of TRIP) {
    const article = new RegExp(`<article class="([^"]*)" data-was-here="${id}" data-was-here-image="(photo|none)" data-stop-status="(past|now|next)">`).exec(html);
    assert.ok(article, `${id}: its card`);
    assert.equal(article[1], 'ts-story-card', `${id}: the port's white card — no colour of its own, never the dark one`);
    assert.equal(article[2], WITH_PHOTO.includes(id) ? 'photo' : 'none', `${id}: data-was-here-image`);
    assert.equal(article[3], stopStatus(row(id), TODAY), `${id}: its status, from the server's day`);
  }
  assert.deepEqual(TRIP.filter((id) => cardOf(html, id).includes('data-stop-status="now"')), ['siargao-2026'], 'one card ringed — the stop he is at');
  for (const id of WITH_PHOTO) assert.match(cardOf(html, id), /^data-was-here="[^"]+" data-was-here-image="photo" data-stop-status="[a-z]+"><a href="[^"]+" tabindex="-1" aria-hidden="true" class="ts-story-card__photo"><img [^>]*\/><\/a><div class="ts-story-card__body">/, `${id}: the photo, whole in its frame, then the body`);
  assert.doesNotMatch(html, /h-80|<figure|<figcaption|absolute|bg-text-primary|text-white|object-cover/, 'no crop, nothing drawn over the photo, no dark card');
  assert.match(cardOf(html, 'cebu-2026-11'), /^data-was-here="cebu-2026-11" data-was-here-image="none" data-stop-status="next"><div class="ts-story-card__body"><div class="ts-story-card__meta"><p class="ts-story-card__stop" data-was-here-stop="8"><span>Stop 8<\/span><span class="ts-story-chip" data-status="next" data-was-here-label="true">COMING UP<\/span><\/p><\/div><h3 class="ts-story-card__city">Cebu<\/h3>/, 'Cebu: no frame and no credit — its stop line, then its place, open the card');
});

test('T4 the leaf, the words and the section read no clock; the section stores nothing and holds one piece of state — the row\'s two ends, which the arrows show (TRIPCARDS-03) — no typed date, no typed words of the post and no emoji; the near-miss and "No event" words are gone from it', () => {
  for (const f of [LEAF, WORDS, SECTION]) assert.doesNotMatch(code(f), /new Date\(|Date\.now\(|toLocale/, `${f} reads no clock`);
  const section = code(SECTION);
  // TRIPCARDS-03 (Alex's brief, 2026-11-12): the arrows say when the row can go no further, so its two ends are React state — derived
  // from the row's scroll position on every scroll and resize, through one effect (the first measure and the resize listener). Nothing
  // is stored, nothing is fetched, no URL is read. Until then the section held no state and no effect:
  // assert.doesNotMatch(section, /useState|useEffect|useSearchParams|useRouter|fetch\(/).
  assert.equal((section.match(/\buseState\b/g) ?? []).length, 2, 'one piece of state — its import and its one call');
  assert.match(section, /const \[ends, setEnds\] = useState<RowEnds>\(ROW_AS_IT_OPENS\);/, 'the row\'s two ends, at first the page as it opens');
  assert.equal((section.match(/\buseEffect\(/g) ?? []).length, 1, 'one effect');
  assert.doesNotMatch(section, /localStorage|sessionStorage|document\.cookie|useSearchParams|useRouter|usePathname|history\.|fetch\(/, 'nothing stored, no URL, no fetch');
  assert.doesNotMatch(section, /\d{4}-\d{2}-\d{2}|Oct \d|Nov \d|Jul \d|days after|days before/, 'no retyped date, no typed gap');
  assert.doesNotMatch(section, /Beachwalk|better plans|Stop [0-9]/, 'nothing of the post typed here — the leaf and the words module hold every word');
  assert.doesNotMatch(section, /JUST_MISSED|JUST MISSED|NO_EVENT_LINE|No event|near_miss|missedPill|newestFirst|Newest first|relation/, 'WASHERE-03');
  assert.match(section, /tripOrder\(rows\)\.map\(\(row, i\) => <Entry key=\{row\.id\} row=\{row\} costs=\{costsFor\(costs, row\.id\)\} stop=\{i \+ 1\} today=\{today\} \/>\)/, 'trip order, the stop number derived from it, its costs or a loud failure');
  assert.match(section, /return <WasHereView rows=\{WAS_HERE\} costs=\{TRIP_COSTS\} today=\{today\} \/>;/, 'TRIPCARDS-01: the live rows and their costs');
  assert.doesNotMatch(section, /not in my log yet|'n\/a'|\$\d|costsOf\(/, 'the cost words and every figure come from the words module and the costs leaf — no lookup that can come back empty');
  assert.doesNotMatch(section, /onPill|WHAT_WAS_ON|data-was-here-pill|wasHereLabel/, 'TRIPCARDS-01: the pills and the old label left the cards');
  assert.doesNotMatch(section, /@\/lib\/experiences|experienceLine|tripPostCards|@\/lib\/tripPosts'|#demo|row\.line|row\.did|row\.learned|row\.experienceId|row\.events/, 'TRIPCARDS-01: the card is the stop and what it cost — it reads nothing else of the row and no other leaf');
  assert.doesNotMatch(section, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'no emoji');
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b/, 'zero new hex');
  assert.match(section, /loading="lazy"/);
  assert.doesNotMatch(section, /target="_blank"/, 'no outside link on a card — the sources live on each stop\'s page (TRIPCARDS-01)');
  assert.doesNotMatch(code(LEAF), /\bimport\b|\brequire\(/, 'the leaf imports nothing');
});

// ── T5 · THE MOUNT, THE SEAT, THE EXPERIENCES WITHOUT featured ───────────────

test('T5 Landing mounts the log once, after the experiences mount and the guest strip (HOME-ORDER-01, 2026-11-10); the act line says a card per stop, each opening its page (TRIPCARDS-01); the seam ledger names it', () => {
  const landing = code(LANDING);
  assert.equal((landing.match(/<WasHereSection today=\{today\}/g) ?? []).length, 1);
  const events = landing.indexOf('<ExperiencesSection today={today} />');
  const mount = landing.indexOf('<WasHereSection today={today} />');
  // HOME-TRAVEL-01 (Alex, 2026-11-12): the guest's strip is the trip card under the booking box, inside the travel block — Landing mounts no strip.
  // Until then: strip = landing.indexOf('<GuestTripStrip') and 'experiences → guest strip → my trip'.
  assert.equal(landing.indexOf('<GuestTripStrip'), -1, 'no strip of its own');
  assert.ok(events > -1 && mount > events, 'experiences (and the trip card under them) → my trip'); // HOME-ORDER-01 (2026-11-10): Alex's order — the log sits under the guest strip now (the plans, DONE-FOR-YOU and Stop 0 between); 'experiences → my trip → guest strip' until then
  assert.match(landing, /import WasHereSection from '\.\/WasHereSection';/);
  const notes = comments(LANDING);
  assert.match(notes, /MY TRIP {13}— the trip log, a card per stop, each opening its stop's page \(TRIPCARDS-01\)/);
  assert.doesNotMatch(notes, /trip log, newest first|the trip log — Alex's own stops, newest first/, 'WASHERE-03');
  // HOME-PANELS-02 (2026-11-07): done-for-you sits under the trip now (the plans below it) — the rule is unchanged, the neighbour new.
  assert.match(comments(DECK), /my trip \| guest strip \/ done-for-you → my trip's border-b \(WASHERE-01/); // PIPELINE-PAGE-01 (2026-11-09): the seam ledger moved with the deck
  for (const phrase of [/THE PLANS\s+— four plan cards and one comparison table/, /id="modules" lives on THE PLANS act/, /said by the four plans below/]) assert.match(notes, phrase, 'cockpitPerf01\'s pins stand');
});

test('T5 the law seat: the leaf law re-run, every experienceId checked, every photo checked under public/ at 400 KB, the mount pinned; the experiences carry no featured and COMING UP is unfiltered', () => {
  const law = code(LAW);
  assert.match(law, /violations\.push\(\.\.\.wasHereLaw\(\{ throwOnFail: false \}\)\);/);
  assert.match(law, /!EXPERIENCES\.some\(\(e\) => e\.id === row\.experienceId\)/);
  assert.match(law, /which has no window — the stop page names the window \(TRIPCARDS-01\)/, 'an event a stop names has a window to show on its page');
  assert.match(law, /resolve\(ROOT, 'public', row\.image\.src\.replace\(\/\^\\\/\/, ''\)\)/);
  assert.match(law, /statSync\(abs\)\.size > 400 \* 1024/);
  assert.match(law, /<WasHereSection today=\\\{today\\\}/);
  assert.doesNotMatch(law, /r\.featured/);
  assert.equal(EXPERIENCE_FIELDS.length, 17);
  assert.ok(!(EXPERIENCE_FIELDS as readonly string[]).includes('featured'));
  const experiences = code(EXPERIENCES_SECTION);
  assert.doesNotMatch(experiences, /featured|I_WAS_HERE_LINE|I WAS HERE|href="#demo"/);
  assert.match(experiences, /const comingUp = upcoming\(chosen, today, chosen\.length\);/, 'unfiltered — every upcoming row (EVENTS-01c)');
});

/**
 * WASHERE-01 (Alex, 2026-10-31) — the trip log is its own act: the leaf and its law,
 * the words, the section rendered, the mount and the law seat.
 * WASHERE-02 (Alex, 2026-10-31) — six earlier stops join, each with what was on.
 * WASHERE-03 (Alex, 2026-10-31) — the log reads top-down as posts: trip order with a
 * stop number; three sections per stop (worked from, did, learned), Canggu written;
 * the near-miss list cut — relation left the event, newestFirst / daysBetween /
 * missedWords / missedPill left the words with their fixtures (the 2026-07-30 →
 * 2026-08-01 = 2, 2026-10-08 → 2026-10-09 = 1, 2026-10-21 → 2026-11-23 = 33 and
 * 2028-02-28 → 2028-03-01 = 2 day counts; the "started the day after I left" /
 * "ended N days before I arrived" words; the near_miss-on-overlap and relation-enum
 * refusals; the Phuket, Chiang Mai and FADO near-miss pills); what-was-on trimmed to
 * eight; the "No event" line gone.
 *
 *   T1 the law — every refusal by name over injected rows and events; the deleted
 *      refusals named absent; the live rows pass;
 *   T2 the rows — seven in trip order, eight events, Canggu's three lists verbatim,
 *      the other six empty, a kept event byte for byte;
 *   T3 the words — the label, the stay, tripOrder, stopWords, listWords, stopEventLine
 *      for every status × sourceKind, onPill, the three ruled pills from the live rows;
 *   T4 the section, rendered — seven cards Canggu → Siargao with Stop 1 … Stop 7,
 *      Canggu's three sections verbatim, eight pills every one a source link, a fixture
 *      with empty lists renders none of the three eyebrows, no "No event" / JUST MISSED
 *      text anywhere, no <img>, no clock;
 *   T5 the mount — after the experiences mount and before the guest strip; the header
 *      comment says "in trip order"; the law seat.
 * No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments } from '../sourceText';
import {
  STOP_EVENT_FIELDS, WAS_HERE, WAS_HERE_FIELDS, WAS_HERE_IMAGE_SRC, WasHereLawError, wasHereLaw, type StopEvent, type WasHereRow,
} from '../wasHere';
import { listWords, onPill, stayWords, stopEventLine, stopWords, tripOrder, wasHereLabel } from '../wasHereWords';
import { EXPERIENCES, EXPERIENCE_FIELDS } from '../experiences';
import { experienceLine } from '../experienceWords';
import {
  WasHereView, MY_TRIP_ANCHOR, MY_TRIP_EYEBROW, MY_TRIP_HEADLINE, MY_TRIP_LINE, MY_TRIP_LINK, WORKED_FROM, DID, LEARNED, WHAT_WAS_ON,
} from '@/components/landing/WasHereSection';

Object.assign(globalThis, { React });

const LEAF = 'src/lib/wasHere.ts';
const WORDS = 'src/lib/wasHereWords.ts';
const SECTION = 'src/components/landing/WasHereSection.tsx';
const EXPERIENCES_SECTION = 'src/components/landing/ExperiencesSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const TODAY = '2026-10-31';
const TRIP = ['canggu-2026-07', 'danang-2026-08', 'bangkok-2026-09', 'phuket-2026-10', 'chiangmai-2026-10', 'bangkok-2026-10-21', 'siargao-2026'];

const row = (id: string): WasHereRow => {
  const found = WAS_HERE.find((r) => r.id === id);
  if (!found) throw new Error(`${id} is not a row`);
  return found;
};
const SIARGAO: WasHereRow = {
  id: 'siargao-2026', city: 'General Luna, Siargao', country: 'Philippines', countryCode: 'PH', start: '2026-10-22', end: null,
  experienceId: 'philippines-pro-2026', line: "I landed in Siargao in the middle of the WSL by luck. Don't get lucky. Book around it.", image: null, writtenOn: '2026-10-31',
  workedFrom: [], did: [], learned: [], events: [],
};
const TRAM: StopEvent = {
  name: 'Tram 28 centenary parade', venue: null, area: 'Alfama', start: '2026-09-05', end: '2026-09-06', status: 'took_place',
  sourceKind: 'secondary', sourceName: 'Lisboa Cultura', sourceUrl: 'https://example.org/tram-28', checkedOn: '2026-09-21', notes: null,
};
const LISBON: WasHereRow = {
  id: 'lisbon-2026', city: 'Lisbon', country: 'Portugal', countryCode: 'PT', start: '2026-09-01', end: '2026-09-20', experienceId: null,
  line: 'Three weeks of pastel de nata.', image: { src: '/was-here/lisbon-2026.jpg', alt: 'The 28 tram climbing Alfama', credit: 'Photo: Alex Stuart' }, writtenOn: '2026-09-21',
  workedFrom: ['Second Home Lisboa'], did: ['the 28 tram', 'Belém by bike'], learned: ['Book the tram early.', 'Then the pastel.'], events: [TRAM],
};
const QUIET: WasHereRow = { ...LISBON, id: 'porto-2026', city: 'Porto', start: '2026-06-01', end: '2026-06-10', experienceId: null, line: null, image: null, writtenOn: '2026-06-11', workedFrom: [], did: [], learned: [], events: [] };
const CANGGU_DID = ['Beachwalk mall', 'a day trip to Uluwatu', 'sunset dinners and drinks at Times Beach Warung', 'Hatch market in Uluwatu', 'mini golf at Shooters', 'Echo Beach for sunsets and surf', 'the G Swing', 'the Gajah Mina statue at Pererenan Beach', 'Finns Beach Club'];
const CANGGU_LEARNED = [
  'I showed up here with zero plan and ended up missing out on so much I wanted to do. Most days I never got around to an activity — I spent them eating brunch and dinner at the coworking.',
  'The correction: better plans.',
];
const lawOver = (...rows: WasHereRow[]) => wasHereLaw({ throwOnFail: false, rows });
const refuses = (rows: WasHereRow[], words: string) => {
  const v = lawOver(...rows);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};
const withEvent = (base: WasHereRow, ev: Partial<StopEvent>): WasHereRow => ({ ...base, events: [{ ...TRAM, ...ev }] });
const render = (rows: readonly WasHereRow[] = WAS_HERE, today = TODAY) => renderToStaticMarkup(React.createElement(WasHereView, { rows, today }));
const cardOf = (html: string, id: string) => { const at = html.indexOf(`data-was-here="${id}"`); const next = html.indexOf('data-was-here="', at + 1); return html.slice(at, next < 0 ? undefined : next); };
const pillsOf = (html: string) => [...html.matchAll(/data-was-here-pill="[^"]+">([^<]*)</g)].map((m) => m[1]);
const sectionsOf = (html: string) => [...html.matchAll(/data-was-here-section="([^"]+)"/g)].map((m) => m[1]);
const pos = (html: string, needle: string) => { const i = html.indexOf(needle); assert.ok(i > -1, `${needle} is rendered`); return i; };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── T1 · THE LAW ─────────────────────────────────────────────────────────────

test('T1 the live rows pass the law; the law throws by default on a failure; a fixture with a photo, three sections and an event passes', () => {
  assert.deepEqual(wasHereLaw({ throwOnFail: false }), []);
  assert.deepEqual(lawOver(SIARGAO, LISBON, QUIET), []);
  assert.throws(() => wasHereLaw({ rows: [SIARGAO, { ...LISBON, id: SIARGAO.id }] }), WasHereLawError);
});

test('T1 every row refusal, by name — the keys at fourteen, the three lists of non-empty strings (WASHERE-03)', () => {
  refuses([SIARGAO, { ...LISBON, id: 'siargao-2026' }], 'duplicate id');
  for (const field of ['city', 'country'] as const) refuses([{ ...SIARGAO, [field]: '  ' }], `empty ${field}`);
  refuses([{ ...SIARGAO, line: '   ' }], 'empty line');
  assert.deepEqual(lawOver({ ...SIARGAO, line: null }), [], 'null is unwritten, not empty');
  refuses([{ ...SIARGAO, countryCode: 'ph' }], 'not two upper-case letters');
  refuses([{ ...SIARGAO, countryCode: 'PHL' }], 'not two upper-case letters');
  refuses([{ ...SIARGAO, start: '22/10/2026' }], 'start "22/10/2026" is not YYYY-MM-DD');
  refuses([{ ...SIARGAO, writtenOn: 'Oct 31' }], 'writtenOn "Oct 31" is not YYYY-MM-DD');
  refuses([{ ...SIARGAO, start: '2026-11-02' }], 'is after writtenOn');
  refuses([{ ...LISBON, end: '2026-08-31' }], 'is before start');
  refuses([{ ...LISBON, end: '20 Sep 2026' }], 'end "20 Sep 2026" is not YYYY-MM-DD');
  refuses([SIARGAO, { ...LISBON, end: null }], 'one place at a time');
  refuses([{ ...LISBON, image: { src: '/photos/lisbon.jpg', alt: 'a', credit: 'b' } }], 'is not /was-here/<slug>.jpg or .webp');
  refuses([{ ...LISBON, image: { src: '/was-here/Lisbon 2026.png', alt: 'a', credit: 'b' } }], 'is not /was-here/<slug>.jpg or .webp');
  refuses([{ ...LISBON, image: { src: '/was-here/lisbon-2026.webp', alt: '', credit: 'b' } }], 'image alt is empty');
  refuses([{ ...LISBON, image: { src: '/was-here/lisbon-2026.webp', alt: 'a', credit: ' ' } }], 'image credit is empty');
  refuses([{ ...SIARGAO, extra: 1 } as unknown as WasHereRow], 'exactly the fourteen ruled fields');
  refuses([Object.fromEntries(Object.entries(SIARGAO).filter(([k]) => k !== 'events')) as WasHereRow], 'exactly the fourteen ruled fields');
  refuses([{ ...SIARGAO, events: 'none' } as unknown as WasHereRow], 'events is not a list');
  refuses([{ ...SIARGAO, workedFrom: 'Zin Cafe' } as unknown as WasHereRow], 'workedFrom is not a list');
  refuses([{ ...SIARGAO, did: ['surf', ''] }], 'did[1] is empty — a list holds non-empty strings');
  refuses([{ ...SIARGAO, learned: [' '] }], 'learned[0] is empty');
  refuses([{ ...SIARGAO, learned: [42] } as unknown as WasHereRow], 'learned[0] is empty');
  assert.deepEqual(lawOver({ ...SIARGAO, workedFrom: ['one'], did: ['two', 'three'], learned: ['four.'] }), [], 'non-empty strings pass');
  assert.equal(WAS_HERE_FIELDS.length, 14);
  assert.deepEqual(WAS_HERE_FIELDS.slice(10), ['workedFrom', 'did', 'learned', 'events']);
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

test('T2 seven rows in trip order; eight events; Canggu\'s three lists verbatim, the other six empty; a kept event byte for byte; each end the next start', () => {
  assert.equal(WAS_HERE.length, 7);
  assert.deepEqual(tripOrder(WAS_HERE).map((r) => r.id), TRIP);
  assert.equal(WAS_HERE.reduce((n, r) => n + r.events.length, 0), 8);
  assert.deepEqual(Object.fromEntries(WAS_HERE.map((r) => [r.id, r.events.map((ev) => ev.name)])), {
    'canggu-2026-07': ['Pesta Kesenian Bali XLVIII (Bali Arts Festival)', 'Rip Curl Cup Padang Padang 2026 — women\'s local trials', 'Rare Angon International Kite Festival 2026'],
    'danang-2026-08': ['Hoi An full-moon lantern night', 'Hoi An Creative Week 2026'],
    'bangkok-2026-09': ['Kodaline — Farewell Tour', 'ONE Fight Night 47: Stamp vs Flores', 'Post Malone — The BIG ASS Stadium World Tour'],
    'phuket-2026-10': [], 'chiangmai-2026-10': [], 'bangkok-2026-10-21': [], 'siargao-2026': [],
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
  assert.deepEqual(row('canggu-2026-07').workedFrom, ['Zin Cafe & Coworking', 'B Work Bali']);
  assert.deepEqual(row('canggu-2026-07').did, CANGGU_DID);
  assert.deepEqual(row('canggu-2026-07').learned, CANGGU_LEARNED);
  for (const r of WAS_HERE) {
    if (r.id !== 'canggu-2026-07') assert.deepEqual([r.workedFrom, r.did, r.learned], [[], [], []], `${r.id}: nothing typed for Alex`);
    if (r.id !== 'siargao-2026') assert.ok(r.line === null && r.experienceId === null, `${r.id}: no line, no experience`);
  }
  assert.ok(WAS_HERE.every((r) => r.image === null && r.writtenOn === '2026-10-31'));
  assert.ok(WAS_HERE.every((r) => r.events.every((ev) => ev.checkedOn === '2026-10-31')));
  assert.deepEqual(row('siargao-2026'), SIARGAO, 'the Siargao row as built, plus the three empty lists');
  const ordered = tripOrder(WAS_HERE);
  for (let i = 1; i < ordered.length; i += 1) assert.equal(ordered[i - 1].end, ordered[i].start, `${ordered[i - 1].id} ends the day ${ordered[i].id} starts`);
  assert.deepEqual(ordered.map((r) => [r.id, r.city, r.countryCode, r.start, r.end]), [
    ['canggu-2026-07', 'Canggu, Bali', 'ID', '2026-07-01', '2026-07-30'], ['danang-2026-08', 'Da Nang / Hoi An', 'VN', '2026-07-30', '2026-08-28'],
    ['bangkok-2026-09', 'Bangkok', 'TH', '2026-08-28', '2026-09-25'], ['phuket-2026-10', 'Phuket', 'TH', '2026-09-25', '2026-10-08'],
    ['chiangmai-2026-10', 'Chiang Mai', 'TH', '2026-10-08', '2026-10-21'], ['bangkok-2026-10-21', 'Bangkok', 'TH', '2026-10-21', '2026-10-22'],
    ['siargao-2026', 'General Luna, Siargao', 'PH', '2026-10-22', null],
  ]);
  assert.ok(EXPERIENCES.some((e) => e.id === row('siargao-2026').experienceId), 'the event it names exists');
});

// ── T3 · THE WORDS ───────────────────────────────────────────────────────────

test('T3 the words: the label and the stay; tripOrder, stopWords, listWords (WASHERE-03); the near-miss words gone', () => {
  assert.equal(wasHereLabel(SIARGAO), "I'M HERE");
  assert.equal(stayWords(SIARGAO), 'Since Oct 22, 2026');
  assert.equal(wasHereLabel(LISBON), 'I WAS HERE');
  assert.equal(stayWords(LISBON), 'Sep 1–20, 2026');
  assert.deepEqual(tripOrder([SIARGAO, LISBON, QUIET]).map((r) => r.id), ['porto-2026', 'lisbon-2026', 'siargao-2026']);
  const given = [SIARGAO, LISBON];
  tripOrder(given);
  assert.deepEqual(given.map((r) => r.id), ['siargao-2026', 'lisbon-2026'], 'a copy — the input is not sorted in place');
  assert.equal(stopWords(1), 'Stop 1');
  assert.equal(stopWords(7), 'Stop 7');
  assert.equal(listWords(['Zin Cafe & Coworking', 'B Work Bali']), 'Zin Cafe & Coworking · B Work Bali');
  assert.equal(listWords(['one']), 'one');
  assert.equal(listWords(CANGGU_DID), 'Beachwalk mall · a day trip to Uluwatu · sunset dinners and drinks at Times Beach Warung · Hatch market in Uluwatu · mini golf at Shooters · Echo Beach for sunsets and surf · the G Swing · the Gajah Mina statue at Pererenan Beach · Finns Beach Club');
  const words = code(WORDS);
  assert.match(words, /import \{ dateWords, dayWords \} from '\.\/experienceWords';/, 'one dateWords in the codebase');
  assert.doesNotMatch(words, /toLocale|new Date\(|Date\.now|Intl\./);
  assert.doesNotMatch(words, /newestFirst|daysBetween|daysFromCivil|missedWords|missedPill|WasHereWordsError|near_miss|days after|days before/, 'deleted with their fixtures (WASHERE-03)');
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

test('T4 rendered with the live rows: seven cards Canggu → Siargao, Stop 1 … Stop 7, Canggu\'s three sections verbatim before WHAT WAS ON, eight pills every one a source link, the Siargao card with its block, line and link, no <img>', () => {
  const html = render();
  assert.equal(MY_TRIP_ANCHOR, 'my-trip');
  assert.match(html, /<section id="my-trip" aria-label="My trip"/);
  assert.equal(MY_TRIP_LINE, 'Stop by stop, dated.');
  assert.ok(html.includes(MY_TRIP_EYEBROW) && html.includes(MY_TRIP_HEADLINE.replace("'", '&#x27;')) && html.includes(MY_TRIP_LINE));
  assert.doesNotMatch(html, /Newest first/);
  assert.deepEqual([...html.matchAll(/data-was-here="([^"]+)"/g)].map((m) => m[1]), TRIP);
  assert.deepEqual([...html.matchAll(/data-was-here-stop="(\d+)">([^<]*)</g)].map((m) => [m[1], m[2]]), [['1', 'Stop 1'], ['2', 'Stop 2'], ['3', 'Stop 3'], ['4', 'Stop 4'], ['5', 'Stop 5'], ['6', 'Stop 6'], ['7', 'Stop 7']]);
  assert.doesNotMatch(html, /<img|<figure/, 'no photo on any row yet');
  const canggu = cardOf(html, 'canggu-2026-07');
  assert.match(canggu, /data-was-here-label="true">I WAS HERE</);
  assert.match(canggu, />Canggu, Bali, Indonesia</);
  assert.match(canggu, /data-was-here-stay="true">Jul 1–30, 2026</);
  assert.match(canggu, /data-was-here-stop="1">Stop 1</);
  assert.deepEqual(sectionsOf(canggu), ['worked-from', 'did', 'learned']);
  assert.match(canggu, /data-was-here-section="worked-from"><p class="[^"]*">WORKED FROM<\/p><p class="[^"]*">Zin Cafe &amp; Coworking · B Work Bali<\/p>/);
  assert.match(canggu, new RegExp(`data-was-here-section="did"><p class="[^"]*">DID</p><p class="[^"]*">${esc(listWords(CANGGU_DID))}</p>`));
  assert.match(canggu, new RegExp(`data-was-here-section="learned"><p class="[^"]*">LEARNED</p><p class="[^"]*">${esc(CANGGU_LEARNED[0])}</p><p class="[^"]*">${esc(CANGGU_LEARNED[1])}</p></div>`));
  assert.ok(pos(canggu, 'data-was-here-stay') < pos(canggu, 'data-was-here-stop') && pos(canggu, 'data-was-here-stop') < pos(canggu, 'data-was-here-section="worked-from"') && pos(canggu, 'data-was-here-section="worked-from"') < pos(canggu, 'data-was-here-section="did"') && pos(canggu, 'data-was-here-section="did"') < pos(canggu, 'data-was-here-section="learned"') && pos(canggu, 'data-was-here-section="learned"') < pos(canggu, 'data-was-here-list="on"'), 'stay → stop → worked from → did → learned → what was on');
  assert.match(canggu, /data-was-here-list="on"><p class="[^"]*">WHAT WAS ON<\/p>/);
  assert.deepEqual(pillsOf(canggu), [
    'Pesta Kesenian Bali XLVIII (Bali Arts Festival) · Taman Werdhi Budaya Art Centre · Jun 13 – Jul 11, 2026 · took place · reported by Antara',
    'Rip Curl Cup Padang Padang 2026 — women&#x27;s local trials · Padang Padang Beach · Jul 21, 2026 · took place · per Rip Curl Indonesia',
    'Rare Angon International Kite Festival 2026 · Mertasari Beach · Jul 23–26, 2026 · took place · reported by Antara Bali',
  ]);
  assert.doesNotMatch(canggu, /data-was-here-line|data-was-here-event|href="#demo"/, 'unwritten line, no event block, no link');
  assert.deepEqual(pillsOf(cardOf(html, 'danang-2026-08')), [
    'Hoi An full-moon lantern night · Hoi An Ancient Town · Aug 26, 2026 · per Hoi An&#x27;s monthly full-moon rule (Da Nang tourism portal)',
    'Hoi An Creative Week 2026 · Song Hoai Square and the Ancient Town · Aug 28 – Sep 2, 2026 · took place · per Da Nang tourism portal; Tuoi Tre News',
  ]);
  assert.deepEqual(pillsOf(cardOf(html, 'bangkok-2026-09')), [
    'Kodaline — Farewell Tour · UOB Live, EmSphere · Aug 28–29, 2026 · took place · per UOB Live',
    'ONE Fight Night 47: Stamp vs Flores · Lumpinee Boxing Stadium · Sep 5, 2026 · took place · per ONE Championship',
    'Post Malone — The BIG ASS Stadium World Tour · Rajamangala National Stadium · Sep 22, 2026 · postponed · reported by Time Out Bangkok',
  ]);
  assert.equal(pillsOf(html).length, 8);
  assert.equal((html.match(/<a href="https:\/\/[^"]+" rel="noopener" target="_blank"[^>]*data-was-here-pill=/g) ?? []).length, 8, 'every pill links its source');
  for (const id of ['phuket-2026-10', 'chiangmai-2026-10', 'bangkok-2026-10-21']) {
    const card = cardOf(html, id);
    assert.doesNotMatch(card, /data-was-here-list|data-was-here-pill|WHAT WAS ON|data-was-here-section|WORKED FROM|>DID<|LEARNED|data-was-here-line|data-was-here-event|href="#demo"/, `${id}: nothing but the stop`);
  }
  const siargao = cardOf(html, 'siargao-2026');
  assert.match(siargao, /data-was-here-label="true">I&#x27;M HERE</);
  assert.match(siargao, /data-was-here-stay="true">Since Oct 22, 2026</);
  assert.match(siargao, /data-was-here-stop="7">Stop 7</);
  assert.match(siargao, /data-was-here-event="philippines-pro-2026"/);
  const event = EXPERIENCES.find((e) => e.id === 'philippines-pro-2026')!;
  assert.ok(siargao.includes(`data-experience-line="true">${experienceLine(event, TODAY)}<`));
  assert.ok(siargao.includes(SIARGAO.line!.replace("'", '&#x27;')));
  assert.match(siargao, new RegExp(`<a href="#demo"[^>]*>${MY_TRIP_LINK}</a>`));
  assert.ok(pos(siargao, 'data-was-here-stop') < pos(siargao, 'data-was-here-event') && pos(siargao, 'data-was-here-event') < pos(siargao, 'data-was-here-line') && pos(siargao, 'data-was-here-line') < pos(siargao, 'href="#demo"'), 'stop → event block → line → link');
  assert.doesNotMatch(siargao, /data-was-here-list|data-was-here-pill|data-was-here-section|WHAT WAS ON/);
  assert.doesNotMatch(html, /JUST MISSED|No event I could verify|days after I left|days before I arrived|data-was-here-none/, 'the near-miss list and the "No event" line are gone');
  assert.doesNotMatch(html, /countdown|BUY NOW/i);
  assert.doesNotMatch(html, /\bfree\b/i);
});

test('T4 rendered fixtures: a photo, a written line and three sections in order; a row with empty lists renders none of the three eyebrows and no "No event" line', () => {
  const html = render([SIARGAO, LISBON, QUIET]);
  assert.deepEqual([...html.matchAll(/data-was-here="([^"]+)"/g)].map((m) => m[1]), ['porto-2026', 'lisbon-2026', 'siargao-2026'], 'trip order, derived');
  assert.deepEqual([...html.matchAll(/data-was-here-stop="(\d+)"/g)].map((m) => m[1]), ['1', '2', '3']);
  const lisbon = cardOf(html, 'lisbon-2026');
  assert.match(lisbon, /<img src="\/was-here\/lisbon-2026\.jpg" alt="The 28 tram climbing Alfama" loading="lazy" class="aspect-\[3\/2\] w-full rounded object-cover"\/>/);
  assert.match(lisbon, /<figcaption[^>]*>Photo: Alex Stuart</);
  assert.match(lisbon, /data-was-here-label="true">I WAS HERE</);
  assert.match(lisbon, /data-was-here-stay="true">Sep 1–20, 2026</);
  assert.match(lisbon, /data-was-here-stop="2">Stop 2</);
  assert.match(lisbon, /data-was-here-line="true">Three weeks of pastel de nata\.</);
  assert.match(lisbon, /data-was-here-section="worked-from"><p class="[^"]*">WORKED FROM<\/p><p class="[^"]*">Second Home Lisboa<\/p>/);
  assert.match(lisbon, /data-was-here-section="did"><p class="[^"]*">DID<\/p><p class="[^"]*">the 28 tram · Belém by bike<\/p>/);
  assert.match(lisbon, /data-was-here-section="learned"><p class="[^"]*">LEARNED<\/p><p class="[^"]*">Book the tram early\.<\/p><p class="[^"]*">Then the pastel\.<\/p><\/div>/);
  assert.deepEqual(pillsOf(lisbon), ['Tram 28 centenary parade · Alfama · Sep 5–6, 2026 · took place · reported by Lisboa Cultura']);
  assert.ok(pos(lisbon, 'data-was-here-line') < pos(lisbon, 'data-was-here-section="worked-from"') && pos(lisbon, 'data-was-here-section="learned"') < pos(lisbon, 'data-was-here-list="on"'), 'line → sections → what was on');
  assert.doesNotMatch(lisbon, /data-was-here-event|href="#demo"/);
  const porto = cardOf(html, 'porto-2026');
  assert.match(porto, /data-was-here-stop="1">Stop 1</);
  assert.doesNotMatch(porto, /data-was-here-section|WORKED FROM|>DID<|LEARNED|data-was-here-list|WHAT WAS ON|data-was-here-line|href="#demo"|No event/, 'empty lists render nothing — no empty eyebrow');
  assert.throws(() => render([{ ...SIARGAO, experienceId: 'not-an-event' }]), /is not an EXPERIENCES id/, 'a stale id fails loud, never a blank block');
  assert.deepEqual([WORKED_FROM, DID, LEARNED, WHAT_WAS_ON], ['WORKED FROM', 'DID', 'LEARNED', 'WHAT WAS ON']);
});

test('T4 the leaf, the words and the section read no clock; the section holds no state, no effect, no typed date, no typed words of the post and no emoji; the near-miss and "No event" words are gone from it', () => {
  for (const f of [LEAF, WORDS, SECTION]) assert.doesNotMatch(code(f), /new Date\(|Date\.now\(|toLocale/, `${f} reads no clock`);
  const section = code(SECTION);
  assert.doesNotMatch(section, /useState|useEffect|useSearchParams|useRouter|fetch\(/);
  assert.doesNotMatch(section, /\d{4}-\d{2}-\d{2}|Oct \d|Nov \d|Jul \d|days after|days before/, 'no retyped date, no typed gap');
  assert.doesNotMatch(section, /Zin Cafe|Beachwalk|better plans|Stop [0-9]/, 'nothing of the post typed here — the leaf and the words module hold every word');
  assert.doesNotMatch(section, /JUST_MISSED|JUST MISSED|NO_EVENT_LINE|No event|near_miss|missedPill|newestFirst|Newest first|relation/, 'WASHERE-03');
  assert.match(section, /tripOrder\(rows\)\.map\(\(row, i\) => <Entry key=\{row\.id\} row=\{row\} stop=\{i \+ 1\} today=\{today\} \/>\)/, 'trip order, the stop number derived from it');
  assert.doesNotMatch(section, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'no emoji');
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b/, 'zero new hex');
  assert.match(section, /loading="lazy"/);
  assert.match(section, /rel="noopener" target="_blank"/);
  assert.doesNotMatch(code(LEAF), /\bimport\b|\brequire\(/, 'the leaf imports nothing');
});

// ── T5 · THE MOUNT, THE SEAT, THE EXPERIENCES WITHOUT featured ───────────────

test('T5 Landing mounts the log once, after the experiences mount and before the guest strip; the act line says "in trip order"; the seam ledger names it', () => {
  const landing = code(LANDING);
  assert.equal((landing.match(/<WasHereSection today=\{today\}/g) ?? []).length, 1);
  const events = landing.indexOf('<ExperiencesSection today={today} />');
  const mount = landing.indexOf('<WasHereSection today={today} />');
  const strip = landing.indexOf('<GuestTripStrip');
  assert.ok(events > -1 && mount > events && strip > mount, 'experiences → my trip → guest strip');
  assert.match(landing, /import WasHereSection from '\.\/WasHereSection';/);
  const notes = comments(LANDING);
  assert.match(notes, /MY TRIP {13}— the trip log, in trip order \(WASHERE-01\)/);
  assert.doesNotMatch(notes, /trip log, newest first|the trip log — Alex's own stops, newest first/, 'WASHERE-03');
  assert.match(notes, /my trip \| guest strip \/ plans → my trip's border-b \(WASHERE-01/);
  for (const phrase of [/THE PLANS\s+— four plan cards and one comparison table/, /id="modules" lives on THE PLANS act/, /said by the four plans below/]) assert.match(notes, phrase, 'cockpitPerf01\'s pins stand');
});

test('T5 the law seat: the leaf law re-run, every experienceId checked, every photo checked under public/ at 400 KB, the mount pinned; the experiences carry no featured and COMING UP is unfiltered', () => {
  const law = code(LAW);
  assert.match(law, /violations\.push\(\.\.\.wasHereLaw\(\{ throwOnFail: false \}\)\);/);
  assert.match(law, /!EXPERIENCES\.some\(\(e\) => e\.id === row\.experienceId\)/);
  assert.match(law, /resolve\(ROOT, 'public', row\.image\.src\.replace\(\/\^\\\/\/, ''\)\)/);
  assert.match(law, /statSync\(abs\)\.size > 400 \* 1024/);
  assert.match(law, /<WasHereSection today=\\\{today\\\}/);
  assert.doesNotMatch(law, /r\.featured/);
  assert.equal(EXPERIENCE_FIELDS.length, 17);
  assert.ok(!(EXPERIENCE_FIELDS as readonly string[]).includes('featured'));
  const experiences = code(EXPERIENCES_SECTION);
  assert.doesNotMatch(experiences, /featured|I_WAS_HERE_LINE|I WAS HERE|href="#demo"/);
  assert.match(experiences, /const comingUp = upcoming\(chosen, today, COMING_UP_COUNT\);/, 'unfiltered');
});

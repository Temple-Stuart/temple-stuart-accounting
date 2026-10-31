/**
 * WASHERE-01 (Alex, 2026-10-31) — the trip log is its own act: the leaf and its law,
 * the words, the section rendered, the mount and the law seat.
 * WASHERE-02 (Alex, 2026-10-31) — six earlier stops join, each with what was on and
 * what it just missed: the row grows (line nullable, events), the law grows per event,
 * the words gain daysBetween / stopEventLine / missedWords, the card gains two lists.
 *
 *   T1 the law — every refusal by name over injected rows and events; the live rows pass;
 *   T2 the rows — seven, newest first, 30 events verbatim where it matters;
 *   T3 the words — the label, the stay, newest first; daysBetween, stopEventLine for every
 *      status × sourceKind, missedWords both ways and the one-day case, the pills;
 *   T4 the section, rendered — seven cards in order, the five pills verbatim, Canggu's
 *      list, no line element while line is null, the Siargao card unchanged, the
 *      "No event" line only for a fixture, every pill an <a rel="noopener" target="_blank">,
 *      no <img>, no clock;
 *   T5 the mount — after the experiences mount and before the guest strip; the law seat.
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
import { daysBetween, missedPill, missedWords, newestFirst, onPill, stayWords, stopEventLine, wasHereLabel } from '../wasHereWords';
import { EXPERIENCES, EXPERIENCE_FIELDS } from '../experiences';
import { experienceLine } from '../experienceWords';
import {
  WasHereView, MY_TRIP_ANCHOR, MY_TRIP_EYEBROW, MY_TRIP_HEADLINE, MY_TRIP_LINE, MY_TRIP_LINK, NO_EVENT_LINE, WHAT_WAS_ON, JUST_MISSED,
} from '@/components/landing/WasHereSection';

Object.assign(globalThis, { React });

const LEAF = 'src/lib/wasHere.ts';
const WORDS = 'src/lib/wasHereWords.ts';
const SECTION = 'src/components/landing/WasHereSection.tsx';
const EXPERIENCES_SECTION = 'src/components/landing/ExperiencesSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const TODAY = '2026-10-31';

const row = (id: string): WasHereRow => {
  const found = WAS_HERE.find((r) => r.id === id);
  if (!found) throw new Error(`${id} is not a row`);
  return found;
};
const SIARGAO: WasHereRow = {
  id: 'siargao-2026', city: 'General Luna, Siargao', country: 'Philippines', countryCode: 'PH', start: '2026-10-22', end: null,
  experienceId: 'philippines-pro-2026', line: "I landed in Siargao in the middle of the WSL by luck. Don't get lucky. Book around it.", image: null, writtenOn: '2026-10-31', events: [],
};
const TRAM: StopEvent = {
  name: 'Tram 28 centenary parade', venue: null, area: 'Alfama', start: '2026-09-05', end: '2026-09-06', relation: 'during', status: 'took_place',
  sourceKind: 'secondary', sourceName: 'Lisboa Cultura', sourceUrl: 'https://example.org/tram-28', checkedOn: '2026-09-21', notes: null,
};
const FADO: StopEvent = {
  name: 'Fado on the river', venue: 'Cais do Sodré', area: 'Lisbon', start: '2026-09-25', end: '2026-09-26', relation: 'near_miss', status: 'scheduled',
  sourceKind: 'official', sourceName: 'Câmara de Lisboa', sourceUrl: 'https://example.org/fado', checkedOn: '2026-09-21', notes: 'a fixture',
};
const LISBON: WasHereRow = {
  id: 'lisbon-2026', city: 'Lisbon', country: 'Portugal', countryCode: 'PT', start: '2026-09-01', end: '2026-09-20', experienceId: null,
  line: 'Three weeks of pastel de nata.', image: { src: '/was-here/lisbon-2026.jpg', alt: 'The 28 tram climbing Alfama', credit: 'Photo: Alex Stuart' }, writtenOn: '2026-09-21', events: [TRAM, FADO],
};
const QUIET: WasHereRow = { ...LISBON, id: 'porto-2026', city: 'Porto', start: '2026-06-01', end: '2026-06-10', experienceId: null, line: null, image: null, writtenOn: '2026-06-11', events: [] };
const lawOver = (...rows: WasHereRow[]) => wasHereLaw({ throwOnFail: false, rows });
const refuses = (rows: WasHereRow[], words: string) => {
  const v = lawOver(...rows);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};
const withEvent = (base: WasHereRow, ev: Partial<StopEvent>, from: StopEvent = TRAM): WasHereRow => ({ ...base, events: [{ ...from, ...ev }] });
const render = (rows: readonly WasHereRow[] = WAS_HERE, today = TODAY) => renderToStaticMarkup(React.createElement(WasHereView, { rows, today }));
const cardOf = (html: string, id: string) => { const at = html.indexOf(`data-was-here="${id}"`); const next = html.indexOf('data-was-here="', at + 1); return html.slice(at, next < 0 ? undefined : next); };
const pillsOf = (html: string) => [...html.matchAll(/data-was-here-pill="[^"]+">([^<]*)</g)].map((m) => m[1]);

// ── T1 · THE LAW ─────────────────────────────────────────────────────────────

test('T1 the live rows pass the law; the law throws by default on a failure; a fixture with a photo and two events passes', () => {
  assert.deepEqual(wasHereLaw({ throwOnFail: false }), []);
  assert.deepEqual(lawOver(SIARGAO, LISBON, QUIET), []);
  assert.throws(() => wasHereLaw({ rows: [SIARGAO, { ...LISBON, id: SIARGAO.id }] }), WasHereLawError);
});

test('T1 every row refusal, by name', () => {
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
  refuses([{ ...SIARGAO, extra: 1 } as unknown as WasHereRow], 'exactly the eleven ruled fields');
  refuses([{ ...SIARGAO, events: 'none' } as unknown as WasHereRow], 'events is not a list');
  assert.equal(WAS_HERE_FIELDS.length, 11);
  assert.equal(STOP_EVENT_FIELDS.length, 12);
  assert.ok(WAS_HERE_IMAGE_SRC.test('/was-here/siargao-2026.jpg') && !WAS_HERE_IMAGE_SRC.test('/was-here/siargao.PNG'));
});

test('T1 every event refusal, by name (WASHERE-02)', () => {
  for (const field of ['name', 'area', 'sourceName'] as const) refuses([withEvent(LISBON, { [field]: ' ' })], `empty event ${field}`);
  refuses([withEvent(LISBON, { venue: '' })], 'event venue is present and empty');
  assert.deepEqual(lawOver(withEvent(LISBON, { venue: null })), [], 'null is the page naming no venue');
  refuses([withEvent(LISBON, { start: '5 Sep' })], 'event start "5 Sep" is not YYYY-MM-DD');
  refuses([withEvent(LISBON, { end: '2026-9-6' })], 'event end "2026-9-6" is not YYYY-MM-DD');
  refuses([withEvent(LISBON, { checkedOn: '' })], 'event checkedOn "" is not YYYY-MM-DD');
  refuses([withEvent(LISBON, { start: '2026-09-07', end: '2026-09-06' })], 'event start 2026-09-07 is after end 2026-09-06');
  refuses([withEvent(LISBON, { sourceUrl: 'http://example.org/tram-28' })], 'does not start with https://');
  refuses([withEvent(LISBON, { relation: 'maybe' as StopEvent['relation'] })], 'is not during | near_miss');
  refuses([withEvent(LISBON, { status: 'rained' as StopEvent['status'] })], 'is not took_place | scheduled | postponed | cancelled');
  refuses([withEvent(LISBON, { sourceKind: 'rumour' as StopEvent['sourceKind'] })], 'is not official | secondary');
  refuses([withEvent(LISBON, { start: '2026-09-25', end: '2026-09-26' })], 'relation during on an event (2026-09-25 – 2026-09-26) that does not overlap the stay (2026-09-01 – 2026-09-20)');
  refuses([withEvent(LISBON, { start: '2026-08-30', end: '2026-08-31' })], 'does not overlap the stay');
  refuses([withEvent(LISBON, { start: '2026-09-20', end: '2026-09-21' }, FADO)], 'relation near_miss on an event (2026-09-20 – 2026-09-21) that overlaps the stay');
  refuses([withEvent(LISBON, { start: '2026-08-31', end: '2026-09-01' }, FADO)], 'relation near_miss on an event (2026-08-31 – 2026-09-01) that overlaps the stay');
  refuses([withEvent({ ...SIARGAO, events: [] }, { start: '2026-11-20', end: '2026-11-21', relation: 'near_miss', status: 'scheduled' })], 'relation near_miss on an event (2026-11-20 – 2026-11-21) that overlaps the stay (2026-10-22 – now)');
  refuses([withEvent(LISBON, { end: '2026-09-22', start: '2026-09-18' })], 'status took_place on an event ending 2026-09-22, after the entry was written on 2026-09-21');
  refuses([{ ...LISBON, events: [TRAM, { ...TRAM, venue: 'elsewhere' }] }], 'shares (name, start)');
  refuses([withEvent(LISBON, { extra: 1 } as unknown as Partial<StopEvent>)], 'exactly the twelve ruled fields');
});

// ── T2 · THE ROWS ────────────────────────────────────────────────────────────

test('T2 seven rows, newest first by start; 30 events where the ruling counts them; every row image null, writtenOn 2026-10-31; the six new rows unwritten; each end the next start', () => {
  assert.equal(WAS_HERE.length, 7);
  assert.deepEqual(newestFirst(WAS_HERE).map((r) => r.id), ['siargao-2026', 'bangkok-2026-10-21', 'chiangmai-2026-10', 'phuket-2026-10', 'bangkok-2026-09', 'danang-2026-08', 'canggu-2026-07']);
  assert.equal(WAS_HERE.reduce((n, r) => n + r.events.length, 0), 30);
  assert.deepEqual(Object.fromEntries(WAS_HERE.map((r) => [r.id, r.events.length])), { 'canggu-2026-07': 10, 'danang-2026-08': 5, 'bangkok-2026-09': 9, 'phuket-2026-10': 2, 'chiangmai-2026-10': 2, 'bangkok-2026-10-21': 2, 'siargao-2026': 0 });
  assert.ok(WAS_HERE.every((r) => r.image === null && r.writtenOn === '2026-10-31'));
  assert.ok(WAS_HERE.every((r) => r.events.every((ev) => ev.checkedOn === '2026-10-31')));
  for (const r of WAS_HERE) if (r.id !== 'siargao-2026') assert.ok(r.line === null && r.experienceId === null, `${r.id}: nothing typed for Alex`);
  assert.deepEqual(row('siargao-2026'), SIARGAO, 'the Siargao row as built, plus events: []');
  const oldest = [...WAS_HERE].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < oldest.length; i += 1) assert.equal(oldest[i - 1].end, oldest[i].start, `${oldest[i - 1].id} ends the day ${oldest[i].id} starts`);
  assert.deepEqual(oldest.map((r) => [r.id, r.city, r.countryCode, r.start, r.end]), [
    ['canggu-2026-07', 'Canggu, Bali', 'ID', '2026-07-01', '2026-07-30'], ['danang-2026-08', 'Da Nang / Hoi An', 'VN', '2026-07-30', '2026-08-28'],
    ['bangkok-2026-09', 'Bangkok', 'TH', '2026-08-28', '2026-09-25'], ['phuket-2026-10', 'Phuket', 'TH', '2026-09-25', '2026-10-08'],
    ['chiangmai-2026-10', 'Chiang Mai', 'TH', '2026-10-08', '2026-10-21'], ['bangkok-2026-10-21', 'Bangkok', 'TH', '2026-10-21', '2026-10-22'],
    ['siargao-2026', 'General Luna, Siargao', 'PH', '2026-10-22', null],
  ]);
  const venueless = WAS_HERE.flatMap((r) => r.events).filter((ev) => ev.venue === null).map((ev) => ev.name);
  assert.deepEqual(venueless, ['Ubud Village Jazz Festival 2026', 'Yi Peng and Loy Krathong 2026']);
  assert.ok(EXPERIENCES.some((e) => e.id === row('siargao-2026').experienceId), 'the event it names exists');
});

// ── T3 · THE WORDS ───────────────────────────────────────────────────────────

test('T3 the words: I\'M HERE / Since Oct 22, 2026 while end is null; I WAS HERE / dateWords once end is set; newest first', () => {
  assert.equal(wasHereLabel(SIARGAO), "I'M HERE");
  assert.equal(stayWords(SIARGAO), 'Since Oct 22, 2026');
  assert.equal(wasHereLabel(LISBON), 'I WAS HERE');
  assert.equal(stayWords(LISBON), 'Sep 1–20, 2026');
  assert.deepEqual(newestFirst([LISBON, SIARGAO]).map((r) => r.id), ['siargao-2026', 'lisbon-2026']);
  const words = code(WORDS);
  assert.match(words, /import \{ dateWords, dayWords \} from '\.\/experienceWords';/, 'one dateWords in the codebase');
  assert.doesNotMatch(words, /toLocale|new Date\(|Date\.now|Intl\./);
});

test('T3 daysBetween: the ruled fixtures, a civil count with no Date', () => {
  assert.equal(daysBetween('2026-07-30', '2026-08-01'), 2);
  assert.equal(daysBetween('2026-10-08', '2026-10-09'), 1);
  assert.equal(daysBetween('2026-10-21', '2026-11-23'), 33);
  assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2);
  assert.equal(daysBetween('2027-02-28', '2027-03-01'), 1);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2026-08-01', '2026-07-30'), -2);
  assert.throws(() => daysBetween('30/07/2026', '2026-08-01'), /is not YYYY-MM-DD/);
});

test('T3 stopEventLine for every status × sourceKind; missedWords both ways and the one-day case; an overlap is refused', () => {
  const at = (status: StopEvent['status'], sourceKind: StopEvent['sourceKind']): StopEvent => ({ ...TRAM, status, sourceKind, sourceName: sourceKind === 'official' ? 'The Hall' : 'The Gazette' });
  assert.equal(stopEventLine(at('took_place', 'official')), 'Sep 5–6, 2026 · took place · per The Hall');
  assert.equal(stopEventLine(at('took_place', 'secondary')), 'Sep 5–6, 2026 · took place · reported by The Gazette');
  assert.equal(stopEventLine(at('scheduled', 'official')), 'Sep 5–6, 2026 · per The Hall');
  assert.equal(stopEventLine(at('scheduled', 'secondary')), 'Sep 5–6, 2026 · reported by The Gazette');
  assert.equal(stopEventLine(at('postponed', 'official')), 'Sep 5–6, 2026 · postponed · per The Hall');
  assert.equal(stopEventLine(at('postponed', 'secondary')), 'Sep 5–6, 2026 · postponed · reported by The Gazette');
  assert.equal(stopEventLine(at('cancelled', 'official')), 'Sep 5–6, 2026 · cancelled · per The Hall');
  assert.equal(stopEventLine(at('cancelled', 'secondary')), 'Sep 5–6, 2026 · cancelled · reported by The Gazette');
  assert.equal(missedWords({ ...FADO, start: '2026-09-21', end: '2026-09-22' }, LISBON), 'started the day after I left');
  assert.equal(missedWords(FADO, LISBON), 'started 5 days after I left');
  assert.equal(missedWords({ ...FADO, start: '2026-08-30', end: '2026-08-31' }, LISBON), 'ended the day before I arrived');
  assert.equal(missedWords({ ...FADO, start: '2026-08-20', end: '2026-08-25' }, LISBON), 'ended 7 days before I arrived');
  assert.throws(() => missedWords({ ...FADO, start: '2026-09-10', end: '2026-09-12' }, LISBON), /overlaps the stay/);
  assert.equal(onPill(TRAM), 'Tram 28 centenary parade · Alfama · Sep 5–6, 2026 · took place · reported by Lisboa Cultura', 'the area when venue is null');
  assert.equal(missedPill(FADO, LISBON), 'Fado on the river · Cais do Sodré · Sep 25–26, 2026 · started 5 days after I left');
});

test('T3 the five ruled pills, from the live rows', () => {
  const ev = (stop: string, name: string) => { const e = row(stop).events.find((x) => x.name === name); if (!e) throw new Error(`${stop}: ${name} missing`); return e; };
  assert.equal(onPill(ev('canggu-2026-07', 'Rip Curl Cup Padang Padang 2026 — women\'s local trials')), 'Rip Curl Cup Padang Padang 2026 — women\'s local trials · Padang Padang Beach · Jul 21, 2026 · took place · per Rip Curl Indonesia');
  assert.equal(missedPill(ev('phuket-2026-10', 'Phuket Vegetarian Festival 2026'), row('phuket-2026-10')), 'Phuket Vegetarian Festival 2026 · Jui Tui Shrine and forty more · Oct 9–18, 2026 · started the day after I left');
  assert.equal(missedPill(ev('chiangmai-2026-10', 'Yi Peng and Loy Krathong 2026'), row('chiangmai-2026-10')), 'Yi Peng and Loy Krathong 2026 · Chiang Mai · Nov 23–25, 2026 · started 33 days after I left');
  assert.equal(onPill(ev('bangkok-2026-09', 'Post Malone — The BIG ASS Stadium World Tour')), 'Post Malone — The BIG ASS Stadium World Tour · Rajamangala National Stadium · Sep 22, 2026 · postponed · reported by Time Out Bangkok');
  assert.equal(onPill(ev('danang-2026-08', 'Hoi An Creative Week 2026')), 'Hoi An Creative Week 2026 · Song Hoai Square and the Ancient Town · Aug 28 – Sep 2, 2026 · took place · per Da Nang tourism portal; Tuoi Tre News');
});

// ── T4 · THE SECTION, RENDERED ───────────────────────────────────────────────

test('T4 rendered with the live rows: seven cards newest first, the five pills verbatim, Canggu\'s lists, no line element while unwritten, the Siargao card unchanged, every pill a source link, no <img>', () => {
  const html = render();
  assert.equal(MY_TRIP_ANCHOR, 'my-trip');
  assert.match(html, /<section id="my-trip" aria-label="My trip"/);
  assert.ok(html.includes(MY_TRIP_EYEBROW) && html.includes(MY_TRIP_HEADLINE.replace("'", '&#x27;')) && html.includes(MY_TRIP_LINE));
  assert.deepEqual([...html.matchAll(/data-was-here="([^"]+)"/g)].map((m) => m[1]), ['siargao-2026', 'bangkok-2026-10-21', 'chiangmai-2026-10', 'phuket-2026-10', 'bangkok-2026-09', 'danang-2026-08', 'canggu-2026-07']);
  assert.doesNotMatch(html, /<img|<figure/, 'no photo on any row yet');
  const pills = pillsOf(html);
  assert.equal(pills.length, 30);
  for (const words of [
    'Rip Curl Cup Padang Padang 2026 — women&#x27;s local trials · Padang Padang Beach · Jul 21, 2026 · took place · per Rip Curl Indonesia',
    'Phuket Vegetarian Festival 2026 · Jui Tui Shrine and forty more · Oct 9–18, 2026 · started the day after I left',
    'Yi Peng and Loy Krathong 2026 · Chiang Mai · Nov 23–25, 2026 · started 33 days after I left',
    'Post Malone — The BIG ASS Stadium World Tour · Rajamangala National Stadium · Sep 22, 2026 · postponed · reported by Time Out Bangkok',
    'Hoi An Creative Week 2026 · Song Hoai Square and the Ancient Town · Aug 28 – Sep 2, 2026 · took place · per Da Nang tourism portal; Tuoi Tre News',
  ]) assert.ok(pills.includes(words), `pill: ${words}`);
  const canggu = cardOf(html, 'canggu-2026-07');
  assert.match(canggu, /data-was-here-list="on"[\s\S]*WHAT WAS ON[\s\S]*data-was-here-list="missed"[\s\S]*JUST MISSED/);
  assert.deepEqual(pillsOf(canggu), [
    'Pesta Kesenian Bali XLVIII (Bali Arts Festival) · Taman Werdhi Budaya Art Centre · Jun 13 – Jul 11, 2026 · took place · reported by Antara',
    'Penglipuran Village Festival XIII · Penglipuran Traditional Village · Jul 9–11, 2026 · took place · reported by RRI',
    'Festival Seni Bali Jani VIII · Taman Werdhi Budaya Art Centre · Jul 11–25, 2026 · took place · reported by Antara',
    'Rip Curl Cup Padang Padang 2026 — women&#x27;s local trials · Padang Padang Beach · Jul 21, 2026 · took place · per Rip Curl Indonesia',
    'Rare Angon International Kite Festival 2026 · Mertasari Beach · Jul 23–26, 2026 · took place · reported by Antara Bali',
    'Lovina Festival 2026 · Lovina Beach · Jul 24–29, 2026 · took place · reported by RRI; Antara Bali',
    'Mekotek, on Kuningan day · Desa Munggu · Jun 27, 2026 · ended 4 days before I arrived',
    'Rip Curl Cup Padang Padang 2026 — main event · Padang Padang Beach · Aug 1–31, 2026 · started 2 days after I left',
    'Ubud Village Jazz Festival 2026 · Ubud, Gianyar · Aug 7–8, 2026 · started 8 days after I left',
    'Your Paradise Bali 2026 · Tropical Temptation Beach Club, Melasti Beach · Aug 7–9, 2026 · started 8 days after I left',
  ]);
  assert.doesNotMatch(canggu, /data-was-here-line|data-was-here-event|href="#demo"|data-was-here-none/, 'unwritten, no event block, no link, no "No event" line');
  const siargao = cardOf(html, 'siargao-2026');
  assert.match(siargao, /data-was-here-label="true">I&#x27;M HERE</);
  assert.match(siargao, /data-was-here-stay="true">Since Oct 22, 2026</);
  assert.match(siargao, /data-was-here-event="philippines-pro-2026"/);
  const event = EXPERIENCES.find((e) => e.id === 'philippines-pro-2026')!;
  assert.ok(siargao.includes(`data-experience-line="true">${experienceLine(event, TODAY)}<`));
  assert.ok(siargao.includes(SIARGAO.line!.replace("'", '&#x27;')));
  assert.match(siargao, new RegExp(`<a href="#demo"[^>]*>${MY_TRIP_LINK}</a>`));
  assert.doesNotMatch(siargao, /data-was-here-list|data-was-here-pill|data-was-here-none|WHAT WAS ON|JUST MISSED/, 'the Siargao card is unchanged');
  assert.doesNotMatch(html, new RegExp(NO_EVENT_LINE), 'no row has it today');
  assert.equal((html.match(/<a href="https:\/\/[^"]+" rel="noopener" target="_blank"[^>]*data-was-here-pill=/g) ?? []).length, 30, 'every pill links its source');
  for (const id of ['bangkok-2026-10-21', 'chiangmai-2026-10', 'phuket-2026-10', 'bangkok-2026-09', 'danang-2026-08']) assert.doesNotMatch(cardOf(html, id), /data-was-here-line|data-was-here-none/);
  assert.match(cardOf(html, 'bangkok-2026-10-21'), /JUST MISSED/);
  assert.doesNotMatch(cardOf(html, 'bangkok-2026-10-21'), /WHAT WAS ON/, 'a list with no rows renders nothing');
  assert.doesNotMatch(html, /countdown|BUY NOW/i);
  assert.doesNotMatch(html, /\bfree\b/i);
});

test('T4 rendered fixtures: a photo and a written line; the "No event" line only for a stop with no events and no experienceId', () => {
  const html = render([SIARGAO, LISBON, QUIET]);
  assert.deepEqual([...html.matchAll(/data-was-here="([^"]+)"/g)].map((m) => m[1]), ['siargao-2026', 'lisbon-2026', 'porto-2026']);
  const lisbon = cardOf(html, 'lisbon-2026');
  assert.match(lisbon, /<img src="\/was-here\/lisbon-2026\.jpg" alt="The 28 tram climbing Alfama" loading="lazy" class="aspect-\[3\/2\] w-full rounded object-cover"\/>/);
  assert.match(lisbon, /<figcaption[^>]*>Photo: Alex Stuart</);
  assert.match(lisbon, /data-was-here-label="true">I WAS HERE</);
  assert.match(lisbon, /data-was-here-stay="true">Sep 1–20, 2026</);
  assert.match(lisbon, /data-was-here-line="true">Three weeks of pastel de nata\.</);
  assert.deepEqual(pillsOf(lisbon), ['Tram 28 centenary parade · Alfama · Sep 5–6, 2026 · took place · reported by Lisboa Cultura', 'Fado on the river · Cais do Sodré · Sep 25–26, 2026 · started 5 days after I left']);
  assert.ok(lisbon.indexOf('data-was-here-line') < lisbon.indexOf('data-was-here-list="on"'), 'the lists come after the line');
  assert.doesNotMatch(lisbon, /data-was-here-event|href="#demo"|data-was-here-none/);
  const porto = cardOf(html, 'porto-2026');
  assert.match(porto, new RegExp(`data-was-here-none="true">${NO_EVENT_LINE}<`));
  assert.doesNotMatch(porto, /data-was-here-list|data-was-here-line|href="#demo"/);
  assert.equal((html.match(new RegExp(NO_EVENT_LINE, 'g')) ?? []).length, 1, 'only the stop with nothing');
  assert.throws(() => render([{ ...SIARGAO, experienceId: 'not-an-event' }]), /is not an EXPERIENCES id/, 'a stale id fails loud, never a blank block');
  assert.equal(WHAT_WAS_ON, 'WHAT WAS ON'); assert.equal(JUST_MISSED, 'JUST MISSED');
});

test('T4 the leaf, the words and the section read no clock; the section holds no state, no effect, no typed date and no emoji', () => {
  for (const f of [LEAF, WORDS, SECTION]) assert.doesNotMatch(code(f), /new Date\(|Date\.now\(|toLocale/, `${f} reads no clock`);
  const section = code(SECTION);
  assert.doesNotMatch(section, /useState|useEffect|useSearchParams|useRouter|fetch\(/);
  assert.doesNotMatch(section, /\d{4}-\d{2}-\d{2}|Oct \d|Nov \d|days after|days before/, 'no retyped date, no typed gap');
  assert.doesNotMatch(section, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'no emoji');
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b/, 'zero new hex');
  assert.match(section, /loading="lazy"/);
  assert.match(section, /rel="noopener" target="_blank"/);
  assert.doesNotMatch(code(LEAF), /\bimport\b|\brequire\(/, 'the leaf imports nothing');
});

// ── T5 · THE MOUNT, THE SEAT, THE EXPERIENCES WITHOUT featured ───────────────

test('T5 Landing mounts the log once, after the experiences mount and before the guest strip; the act list and the seam ledger name it', () => {
  const landing = code(LANDING);
  assert.equal((landing.match(/<WasHereSection today=\{today\}/g) ?? []).length, 1);
  const events = landing.indexOf('<ExperiencesSection today={today} />');
  const mount = landing.indexOf('<WasHereSection today={today} />');
  const strip = landing.indexOf('<GuestTripStrip');
  assert.ok(events > -1 && mount > events && strip > mount, 'experiences → my trip → guest strip');
  assert.match(landing, /import WasHereSection from '\.\/WasHereSection';/);
  const notes = comments(LANDING);
  assert.match(notes, /MY TRIP {13}— the trip log, newest first \(WASHERE-01\)/);
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

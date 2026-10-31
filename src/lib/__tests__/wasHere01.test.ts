/**
 * WASHERE-01 (Alex, 2026-10-31) — the trip log is its own act: the leaf and its law,
 * the words, the section rendered, the mount and the law seat.
 *
 *   T1 the law — every refusal by name over injected rows; the live row passes;
 *   T2 the one row — the DATA, verbatim;
 *   T3 the words — the label, the stay, newest first;
 *   T4 the section, rendered — one card with no <img> and no empty box while image is
 *      null; the event block through experienceLine, never a retyped date; the link;
 *      with a photo, the <img> and its credit; the source reads no clock;
 *   T5 the mount — after the experiences mount and before the guest strip; the law seat
 *      and its three checks; the experiences lost `featured`.
 * No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments } from '../sourceText';
import { WAS_HERE, WAS_HERE_FIELDS, WAS_HERE_IMAGE_SRC, WasHereLawError, wasHereLaw, type WasHereRow } from '../wasHere';
import { newestFirst, stayWords, wasHereLabel } from '../wasHereWords';
import { EXPERIENCES, EXPERIENCE_FIELDS } from '../experiences';
import { experienceLine } from '../experienceWords';
import { WasHereView, MY_TRIP_ANCHOR, MY_TRIP_EYEBROW, MY_TRIP_HEADLINE, MY_TRIP_LINE, MY_TRIP_LINK } from '@/components/landing/WasHereSection';

Object.assign(globalThis, { React });

const LEAF = 'src/lib/wasHere.ts';
const WORDS = 'src/lib/wasHereWords.ts';
const SECTION = 'src/components/landing/WasHereSection.tsx';
const EXPERIENCES_SECTION = 'src/components/landing/ExperiencesSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const TODAY = '2026-10-31';

const SIARGAO: WasHereRow = {
  id: 'siargao-2026', city: 'General Luna, Siargao', country: 'Philippines', countryCode: 'PH', start: '2026-10-22', end: null,
  experienceId: 'philippines-pro-2026', line: "I landed in Siargao in the middle of the WSL by luck. Don't get lucky. Book around it.", image: null, writtenOn: '2026-10-31',
};
const LISBON: WasHereRow = {
  id: 'lisbon-2026', city: 'Lisbon', country: 'Portugal', countryCode: 'PT', start: '2026-09-01', end: '2026-09-20', experienceId: null,
  line: 'Three weeks of pastel de nata.', image: { src: '/was-here/lisbon-2026.jpg', alt: 'The 28 tram climbing Alfama', credit: 'Photo: Alex Stuart' }, writtenOn: '2026-09-21',
};
const lawOver = (...rows: WasHereRow[]) => wasHereLaw({ throwOnFail: false, rows });
const refuses = (rows: WasHereRow[], words: string) => {
  const v = lawOver(...rows);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};
const render = (rows: readonly WasHereRow[] = WAS_HERE, today = TODAY) => renderToStaticMarkup(React.createElement(WasHereView, { rows, today }));

// ── T1 · THE LAW ─────────────────────────────────────────────────────────────

test('T1 the live row passes the law; the law throws by default on a failure; a two-row fixture with a photo passes', () => {
  assert.deepEqual(wasHereLaw({ throwOnFail: false }), []);
  assert.deepEqual(lawOver(SIARGAO, LISBON), []);
  assert.throws(() => wasHereLaw({ rows: [SIARGAO, { ...LISBON, id: SIARGAO.id }] }), WasHereLawError);
});

test('T1 every refusal, by name', () => {
  refuses([SIARGAO, { ...LISBON, id: 'siargao-2026' }], 'duplicate id');
  for (const field of ['city', 'country', 'line'] as const) refuses([{ ...SIARGAO, [field]: '  ' }], `empty ${field}`);
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
  refuses([{ ...SIARGAO, extra: 1 } as unknown as WasHereRow], 'exactly the ten ruled fields');
  assert.equal(WAS_HERE_FIELDS.length, 10);
  assert.ok(WAS_HERE_IMAGE_SRC.test('/was-here/siargao-2026.jpg') && !WAS_HERE_IMAGE_SRC.test('/was-here/siargao.PNG'));
});

// ── T2 · THE ONE ROW ─────────────────────────────────────────────────────────

test('T2 the one row, verbatim: Siargao since Oct 22, still there, around the Philippines Pro, no photo yet', () => {
  assert.equal(WAS_HERE.length, 1);
  assert.deepEqual(WAS_HERE[0], SIARGAO);
  assert.ok(EXPERIENCES.some((e) => e.id === WAS_HERE[0].experienceId), 'the event it names exists');
});

// ── T3 · THE WORDS ───────────────────────────────────────────────────────────

test('T3 the words: I\'M HERE / Since Oct 22, 2026 while end is null; I WAS HERE / dateWords once end is set; newest first', () => {
  assert.equal(wasHereLabel(SIARGAO), "I'M HERE");
  assert.equal(stayWords(SIARGAO), 'Since Oct 22, 2026');
  assert.equal(wasHereLabel(LISBON), 'I WAS HERE');
  assert.equal(stayWords(LISBON), 'Sep 1–20, 2026');
  assert.deepEqual(newestFirst([LISBON, SIARGAO]).map((r) => r.id), ['siargao-2026', 'lisbon-2026']);
  assert.deepEqual(newestFirst([SIARGAO, LISBON]).map((r) => r.id), ['siargao-2026', 'lisbon-2026']);
  const words = code(WORDS);
  assert.match(words, /import \{ dateWords, dayWords \} from '\.\/experienceWords';/, 'one dateWords in the codebase');
  assert.doesNotMatch(words, /toLocale|new Date\(|Intl\./);
});

// ── T4 · THE SECTION, RENDERED ───────────────────────────────────────────────

test('T4 rendered with the one row: the act, the words, one card — no <img> and no empty box, the event block through experienceLine, Alex\'s line, the link to #demo', () => {
  const html = render();
  assert.equal(MY_TRIP_ANCHOR, 'my-trip');
  assert.match(html, /<section id="my-trip" aria-label="My trip"/);
  assert.ok(html.includes(MY_TRIP_EYEBROW) && html.includes(MY_TRIP_HEADLINE.replace("'", '&#x27;')) && html.includes(MY_TRIP_LINE));
  assert.equal((html.match(/data-was-here="/g) ?? []).length, 1);
  assert.match(html, /data-was-here="siargao-2026" data-was-here-image="none"/);
  assert.doesNotMatch(html, /<img|<figure|aspect-\[3\/2\]/, 'no image and no placeholder box while image is null');
  assert.match(html, /data-was-here-label="true">I&#x27;M HERE</);
  assert.match(html, />General Luna, Siargao, Philippines</);
  assert.match(html, /data-was-here-stay="true">Since Oct 22, 2026</);
  assert.match(html, /data-was-here-event="philippines-pro-2026"/);
  assert.match(html, />Surf · WSL Championship Tour</);
  assert.match(html, />Philippines Pro presented by the Philippine Sports Commission</);
  assert.match(html, />Cloud 9</);
  const event = EXPERIENCES.find((e) => e.id === 'philippines-pro-2026')!;
  assert.ok(html.includes(`data-experience-line="true">${experienceLine(event, TODAY)}<`), 'the event line is the words module\'s, not a retyped date');
  assert.match(html, /data-experience-line="true">Window Oct 30 – Nov 10, 2026 · window being confirmed</);
  assert.ok(html.includes(SIARGAO.line.replace("'", '&#x27;')));
  assert.match(html, new RegExp(`<a href="#demo"[^>]*>${MY_TRIP_LINK}</a>`));
  assert.doesNotMatch(html, /countdown|BUY NOW/i);
  assert.doesNotMatch(html, /\bfree\b/i);
});

test('T4 rendered with a photo and a past stop: the <img> at 3:2 with its credit, I WAS HERE, the window, no event block and no link; newest first', () => {
  const html = render([SIARGAO, LISBON]);
  const order = [...html.matchAll(/data-was-here="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['siargao-2026', 'lisbon-2026']);
  const lisbon = html.slice(html.indexOf('data-was-here="lisbon-2026"'));
  assert.match(lisbon, /<img src="\/was-here\/lisbon-2026\.jpg" alt="The 28 tram climbing Alfama" loading="lazy" class="aspect-\[3\/2\] w-full rounded object-cover"\/>/);
  assert.match(lisbon, /<figcaption[^>]*>Photo: Alex Stuart</);
  assert.match(lisbon, /data-was-here-label="true">I WAS HERE</);
  assert.match(lisbon, /data-was-here-stay="true">Sep 1–20, 2026</);
  assert.doesNotMatch(lisbon, /data-was-here-event|href="#demo"/);
  assert.throws(() => render([{ ...SIARGAO, experienceId: 'not-an-event' }]), /is not an EXPERIENCES id/, 'a stale id fails loud, never a blank block');
});

test('T4 the leaf, the words and the section read no clock; the section holds no state, no effect, no typed date and no emoji', () => {
  for (const f of [LEAF, WORDS, SECTION]) assert.doesNotMatch(code(f), /new Date\(|Date\.now\(|toLocale/, `${f} reads no clock`);
  const section = code(SECTION);
  assert.doesNotMatch(section, /useState|useEffect|useSearchParams|useRouter|fetch\(/);
  assert.doesNotMatch(section, /\d{4}-\d{2}-\d{2}|Oct \d|Nov \d/, 'no retyped date');
  assert.doesNotMatch(section, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'no emoji');
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b/, 'zero new hex');
  assert.match(section, /loading="lazy"/);
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

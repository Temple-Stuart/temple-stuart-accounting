/**
 * STOP0-01 (Alex, 2026-11-08 15:11 + 16:18; board K tags 7-8) — Stop 0: Alex's letter in his own words and a short dated
 * timeline, a section between the events and MY TRIP; and one line at the foot of the events band that links to it.
 *
 *   T1 the words — every export of src/lib/stopZeroWords.ts is its exact ruled string; FIRST_COMMIT_ON is 2025-09-04;
 *   T2 the timeline — stopZeroTimeline(WAS_HERE) is the six rows, the first commit's day printed "Sep 4, 2025" and Stop 1
 *      derived from the trip log's first row in trip order ("Jul 1, 2026" · "Stop 1: Canggu, Bali." today); a fixture whose
 *      first stop is another city and day changes the last row and nothing else; an empty log throws;
 *   T3 the section, rendered — id="stop-0", the eyebrow, the h2, five paragraphs, the quote, the signature, six timeline
 *      rows, in that order, in the ruled classes; the letter and the card side by side from lg up; the whole markup
 *      equal to that and nothing else (no photo, no number, nothing between);
 *   T4 the source — the section and the band type none of the words (they import them, whitespace collapsed so a word
 *      broken across lines is still found) and never retype the anchor; the section has no state, no fetch, no clock and
 *      no hex; the leaf is pure;
 *   T5 Landing — mounts the section once, directly between the experiences mount and the MY TRIP mount (nothing but a
 *      comment between), and its import shares a line with the ExperiencesSection import;
 *   T6 the events band — "#stop-0" once, in the ruled line directly before the closing line, on an event chip, on a
 *      season chip and on the refused view.
 * Source is read through code() only (the reader law). No line number, no line count, no clock, no live call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code } from '../sourceText';
import { WAS_HERE, type WasHereRow } from '../wasHere';
import { dayWords } from '../experienceWords';
import { stopWords, tripOrder } from '../wasHereWords';
import { EXPERIENCES, EXPERIENCE_CATEGORIES } from '../experiences';
import {
  STOP_ZERO_ANCHOR, STOP_ZERO_EYEBROW, STOP_ZERO_HEADLINE, STOP_ZERO_LETTER, STOP_ZERO_QUOTE, STOP_ZERO_SIGNATURE,
  STOP_ZERO_TIMELINE_LABEL, FIRST_COMMIT_ON, stopZeroTimeline, EVENTS_STORY_LABEL, EVENTS_STORY_LINE, READ_MY_STORY,
} from '../stopZeroWords';
import StopZeroSection from '@/components/landing/StopZeroSection';
import { ExperiencesView, CLOSING_LINE, SEASONS_CLOSING_LINE, type IntoChoice } from '@/components/landing/ExperiencesSection';

Object.assign(globalThis, { React });

const WORDS = 'src/lib/stopZeroWords.ts';
const SECTION = 'src/components/landing/StopZeroSection.tsx';
const EXPERIENCES_SECTION = 'src/components/landing/ExperiencesSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';

const EXPERIENCES_MOUNT = '<ExperiencesSection today={today} />';
const STOP_ZERO_MOUNT = '<StopZeroSection />';
const MY_TRIP_MOUNT = '<WasHereSection today={today} />';
/** code() blanks a JSX comment's words and keeps its braces. */
const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;

/** React's escaping of text: the ampersand, then the apostrophe. */
const asHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

/** The timeline as it stands today — the last two rows written here only to be compared with what the leaf derives. */
const SIX = [
  { when: '2000', what: 'First time snowboarding. 2nd grade.' },
  { when: '2001', what: 'My first AIM account. 3rd grade.' },
  { when: '2002', what: 'My first snowboard. 4th grade.' },
  { when: '2003', what: 'Transworld Snowboarding → googled a resort → found the blogs. 5th grade.' },
  { when: 'Sep 4, 2025', what: 'The first commit on this system.' },
  { when: 'Jul 1, 2026', what: 'Stop 1: Canggu, Bali.' },
];

// ── T1 · THE WORDS ───────────────────────────────────────────────────────────

test('T1 every export of the words module is its exact ruled string', () => {
  assert.equal(STOP_ZERO_ANCHOR, 'stop-0');
  assert.equal(STOP_ZERO_EYEBROW, 'STOP 0');
  assert.equal(STOP_ZERO_HEADLINE, 'None of the blogs actually told me how to do it.');
  assert.deepEqual(STOP_ZERO_LETTER, [
    "I've been reading travel blogs since 2003. That year I got a subscription to Transworld Snowboarding, saw a resort that looked better than the one I grew up riding, and googled it. The world of travel and lifestyle blogs opened up. Twenty-three years later, I still read them.",
    "Snowboarding wasn't the only thing. I wanted to see wildlife, the wonders of the world, music and arts festivals, the biggest sporting events. Every one of them has blogs. They write about the experience, hand you a bunch of affiliate links, and take a slice when you book.",
    "None of them showed me how to actually do it. How to get your bank data. How to turn it into a financial statement. How to see your income and expenses. How to know what living at home costs, so you have a benchmark to weigh your travel against. How to set up a system to earn income abroad.",
    "So instead of venting about it, I cashed in my retirement, went out to live it, made a ton of mistakes, and built the system as I went.",
    "Even if nobody reads this, it's my letter to myself. And once something's in writing, if it's wrong, I have to keep looking at it until I go back and fix it. That's how the process gets better.",
  ]);
  assert.equal(STOP_ZERO_QUOTE, "“I don't just want to sell you the dream. I want to guide you into living it.”");
  assert.equal(STOP_ZERO_SIGNATURE, '— Alex');
  assert.equal(STOP_ZERO_TIMELINE_LABEL, 'HOW I GOT HERE');
  assert.equal(FIRST_COMMIT_ON, '2025-09-04');
  assert.equal(EVENTS_STORY_LABEL, 'WHY EVENTS FIRST');
  assert.equal(EVENTS_STORY_LINE, 'In 5th grade I saw a resort in Transworld Snowboarding that looked better than mine, googled it, and found the travel blogs. The experience came first. The trip came second.');
  assert.equal(READ_MY_STORY, 'Read my story ↓');
});

// ── T2 · THE TIMELINE ────────────────────────────────────────────────────────

test('T2 the timeline: six rows, the first commit\'s day and Stop 1 derived; another first stop changes the last row; an empty log throws', () => {
  assert.deepEqual(stopZeroTimeline(WAS_HERE), SIX);
  assert.equal(dayWords(FIRST_COMMIT_ON), 'Sep 4, 2025', 'the first commit\'s day, printed by dayWords');
  const first = tripOrder(WAS_HERE)[0];
  assert.deepEqual(stopZeroTimeline(WAS_HERE)[5], { when: dayWords(first.start), what: `${stopWords(1)}: ${first.city}.` }, 'Stop 1 is the first row in trip order');
  // A first stop in another city on another day, appended last so only trip order can put it first.
  const lisbon: WasHereRow = { ...WAS_HERE[0], id: 'lisbon-2025-12', city: 'Lisbon, Portugal', countryCode: 'PT', country: 'Portugal', start: '2025-12-01', end: '2025-12-31' };
  const moved = stopZeroTimeline([...WAS_HERE, lisbon]);
  assert.deepEqual(moved[5], { when: 'Dec 1, 2025', what: 'Stop 1: Lisbon, Portugal.' }, 'the last row follows the trip log — never typed');
  assert.deepEqual(moved.slice(0, 5), SIX.slice(0, 5), 'the other five rows do not move');
  assert.throws(() => stopZeroTimeline([]), /the trip log has no stop/, 'an empty log has no Stop 1 — said, not skipped');
});

// ── T3 · THE SECTION, RENDERED ───────────────────────────────────────────────

test('T3 the section renders id="stop-0", the eyebrow, the h2, five paragraphs, the quote, the signature and six timeline rows, in order, in the ruled classes — and nothing else', () => {
  const html = renderToStaticMarkup(React.createElement(StopZeroSection));
  const head = `<section id="${STOP_ZERO_ANCHOR}" aria-label="Stop 0" class="w-full border-b border-border bg-bg-terminal"><div class="max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14"><div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">`;
  const eyebrow = 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint';
  const letter = [
    `<div><p class="${eyebrow}">${STOP_ZERO_EYEBROW}</p>`,
    `<h2 class="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">${STOP_ZERO_HEADLINE}</h2>`,
    ...STOP_ZERO_LETTER.map((p) => `<p class="mt-4 max-w-2xl text-base leading-relaxed text-text-primary">${asHtml(p)}</p>`),
    `<blockquote class="mt-6 max-w-2xl text-xl font-semibold leading-snug text-brand-purple">${asHtml(STOP_ZERO_QUOTE)}</blockquote>`,
    `<p class="mt-4 font-mono text-xs text-text-secondary">${STOP_ZERO_SIGNATURE}</p></div>`,
  ].join('');
  const rows = SIX.map((r) => `<li class="mt-3 flex gap-3"><span class="w-24 shrink-0 font-mono text-xs text-brand-purple">${r.when}</span><span class="text-sm text-text-primary">${r.what}</span></li>`).join('');
  const card = `<div class="self-start rounded-lg border border-border bg-white p-5"><p class="${eyebrow}">${STOP_ZERO_TIMELINE_LABEL}</p><ol>${rows}</ol></div>`;
  // The whole section, byte for byte: the act, its inner box, the grid (two columns from lg up), the letter, then the card — nothing else, nothing between.
  assert.equal(html, `${head}${letter}${card}</div></div></section>`);
  assert.equal(count(html, 'id="stop-0"'), 1, 'id="stop-0"');
  assert.equal(count(html, 'text-base leading-relaxed text-text-primary'), 5, 'five paragraphs');
  assert.equal(count(html, '<blockquote'), 1, 'one quote');
  assert.equal(count(html, '<li '), 6, 'six timeline rows');
});

// ── T4 · THE SOURCE ──────────────────────────────────────────────────────────

test('T4 the section and the band type none of the words; the section holds no state, no fetch, no clock and no hex; the leaf is pure', () => {
  const section = code(SECTION);
  const band = code(EXPERIENCES_SECTION);
  // Whitespace collapsed, so a word retyped as JSX text broken across lines is still found.
  const flatSection = section.replace(/\s+/g, ' ');
  const flatBand = band.replace(/\s+/g, ' ');
  const words = [STOP_ZERO_EYEBROW, STOP_ZERO_HEADLINE, ...STOP_ZERO_LETTER, STOP_ZERO_QUOTE, STOP_ZERO_SIGNATURE, STOP_ZERO_TIMELINE_LABEL, ...SIX.map((r) => r.what), EVENTS_STORY_LABEL, EVENTS_STORY_LINE, READ_MY_STORY];
  for (const w of words) {
    assert.ok(!flatSection.includes(w), `StopZeroSection does not type "${w.slice(0, 40)}"`);
    assert.ok(!flatBand.includes(w), `ExperiencesSection does not type "${w.slice(0, 40)}"`);
  }
  for (const year of ['2000', '2001', '2002', '2003']) assert.ok(!section.includes(year), `the section does not type ${year}`);
  assert.match(section, /import \{\s*STOP_ZERO_ANCHOR, STOP_ZERO_EYEBROW, STOP_ZERO_HEADLINE, STOP_ZERO_LETTER, STOP_ZERO_QUOTE, STOP_ZERO_SIGNATURE,\s*STOP_ZERO_TIMELINE_LABEL, stopZeroTimeline,\s*\} from '@\/lib\/stopZeroWords';/);
  assert.match(section, /const timeline = stopZeroTimeline\(WAS_HERE\);/, 'the rows from the trip log, through the leaf');
  assert.match(band, /import \{ EVENTS_STORY_LABEL, EVENTS_STORY_LINE, READ_MY_STORY, STOP_ZERO_ANCHOR \} from '@\/lib\/stopZeroWords';/);
  assert.ok(!section.includes('stop-0') && !band.includes('stop-0'), 'the anchor is the leaf\'s, never retyped — in either file, in any form');
  assert.match(section, /<section id=\{STOP_ZERO_ANCHOR\} aria-label="Stop 0" className="w-full border-b border-border bg-bg-terminal">/, 'the section takes its id from the leaf');
  assert.match(band, /<a href=\{`#\$\{STOP_ZERO_ANCHOR\}`\} className=\{EXP\.storyLink\}>\{READ_MY_STORY\}<\/a>/, 'the link takes its href from the leaf');
  assert.doesNotMatch(section, /\buse(State|Effect|Reducer|Ref|Router|SearchParams)\b|\bfetch\s*\(|new Date\(|Date\.now\(|toLocale|\bIntl\.|localStorage|sessionStorage|document\.cookie/, 'no state, no fetch, no clock, no storage');
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b/, 'zero new hex');
  const leaf = code(WORDS);
  assert.doesNotMatch(leaf, /from 'react'|\bfetch\s*\(|new Date\(|Date\.now\(|toLocale|\bIntl\.|process\.env/, 'the leaf is pure');
  assert.match(leaf, /\{ when: dayWords\(FIRST_COMMIT_ON\), what: 'The first commit on this system\.' \}/, 'the first commit\'s day, derived');
  assert.match(leaf, /const first = tripOrder\(rows\)\[0\];/);
  assert.match(leaf, /\{ when: dayWords\(first\.start\), what: `\$\{stopWords\(1\)\}: \$\{first\.city\}\.` \}/, 'Stop 1, derived');
});

// ── T5 · LANDING ─────────────────────────────────────────────────────────────

test('T5 Landing mounts the section once, directly between the experiences and MY TRIP, and its import rides the ExperiencesSection import\'s line', () => {
  const landing = code(LANDING);
  assert.equal(count(landing, STOP_ZERO_MOUNT), 1, 'mounted once');
  assert.equal(count(landing, '<StopZeroSection'), 1);
  const experiences = landing.indexOf(EXPERIENCES_MOUNT);
  const stopZero = landing.indexOf(STOP_ZERO_MOUNT);
  const myTrip = landing.indexOf(MY_TRIP_MOUNT);
  assert.ok(experiences > -1 && stopZero > experiences && myTrip > stopZero, 'experiences → stop 0 → my trip');
  assert.match(landing.slice(experiences + EXPERIENCES_MOUNT.length, stopZero), ONLY_COMMENTS, 'the experiences → stop 0: a comment between, nothing else');
  assert.match(landing.slice(stopZero + STOP_ZERO_MOUNT.length, myTrip), ONLY_COMMENTS, 'stop 0 → my trip: a comment between, nothing else');
  const imports = landing.split('\n').filter((l) => l.includes("import StopZeroSection from './StopZeroSection';"));
  assert.equal(imports.length, 1, 'imported once');
  assert.match(imports[0], /^import ExperiencesSection from '\.\/ExperiencesSection'; import StopZeroSection from '\.\/StopZeroSection';\s*$/, 'the import shares the ExperiencesSection import\'s line');
});

// ── T6 · THE EVENTS BAND ─────────────────────────────────────────────────────

test('T6 the events band links "#stop-0" once, in the ruled line directly before the closing line — on an event chip, on a season chip and on the refused view', () => {
  const story = `<p class="mt-8 max-w-2xl text-sm text-white/80"><span class="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-white/60">${EVENTS_STORY_LABEL}</span> ${EVENTS_STORY_LINE} <a href="#${STOP_ZERO_ANCHOR}" class="font-semibold text-white underline-offset-4 hover:underline">${READ_MY_STORY}</a></p>`;
  const closing = (line: string) => `<p class="mt-8 text-xs text-white/60">${asHtml(line)}</p>`;
  const season = EXPERIENCE_CATEGORIES.find((c) => c.group === 'season');
  assert.ok(season, 'a season category to render');
  const views: Array<[string, IntoChoice, string]> = [
    ['Surf, an event chip', { category: 'surfing' }, CLOSING_LINE],
    [`${season.label}, a season chip`, { category: season.id }, SEASONS_CLOSING_LINE],
    ['the refused view', { refused: 'nope' }, CLOSING_LINE],
  ];
  for (const [what, choice, line] of views) {
    const html = renderToStaticMarkup(React.createElement(ExperiencesView, { rows: EXPERIENCES, today: '2026-10-30', choice, onPick: () => {} }));
    assert.equal(count(html, `href="#${STOP_ZERO_ANCHOR}"`), 1, `${what}: "#stop-0" once`);
    assert.equal(count(html, READ_MY_STORY), 1, `${what}: "Read my story ↓" once`);
    assert.ok(html.endsWith(`${story}${closing(line)}</div></section>`), `${what}: the story line, then the closing line, last in the band`);
  }
});

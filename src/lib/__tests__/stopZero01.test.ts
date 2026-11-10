/**
 * STOP0-01 (Alex, 2026-11-08 15:11 + 16:18; board K tags 7-8) — Stop 0: Alex's letter in his own words and a short dated
 * timeline, a section between the events and MY TRIP; and one line at the foot of the events band that links to it.
 * HOME-BRIEF-02 (Alex's home page brief, 2026-11-10 16:27): the section is ABOUT US now — his finalized text in one
 * column under the heading "About Us"; the letter and the timeline went. T1, T3 and T4 hold the new content; T2 retired
 * with the timeline; T5 is as it was.
 *
 *   T1 the words — src/lib/stopZeroWords.ts exports exactly the ruled list; the anchor, the place, the dates and the three
 *      sections (heading, paragraphs, quote) are Alex's text, exact and in order; the heading is "About Us";
 *   T2 RETIRED (HOME-BRIEF-02, 2026-11-10) — it held the timeline, which is gone;
 *   T3 the section, rendered — id="stop-0" once, the h2, the place, the dates in italics, then the three sections in
 *      order, each its h3, its paragraphs and its quote LAST; twenty paragraphs, three quotes; the whole markup equal to
 *      that and nothing else (no grid, no card, no timeline, no list);
 *   T4 the source — the section and the band type none of the words (they import them, whitespace collapsed so a word
 *      broken across lines is still found) and never retype the anchor; the section has no state, no fetch, no clock and
 *      no hex; the leaf is pure and imports nothing; nothing of the old story is left in either;
 *   T5 Landing — mounts the section once, directly between the DONE-FOR-YOU section and the MY TRIP mount (nothing but a
 *      comment between each — HOME-ORDER-01, 2026-11-10: Alex's order; directly under the experiences mount until then),
 *      and its import shares a line with the ExperiencesSection import;
 *   T6 the events band — "#stop-0" once, in the ruled line directly before the closing line, on an event chip, on a
 *      season chip and on the refused view.
 * Source is read through code() only (the reader law). No line number, no line count, no clock, no live call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code } from '../sourceText';
import { EXPERIENCES, EXPERIENCE_CATEGORIES } from '../experiences';
import * as stopZeroWords from '../stopZeroWords';
import { STOP_ZERO_ANCHOR, STOP_ZERO_DATES, STOP_ZERO_PLACE, STOP_ZERO_STORY, EVENTS_STORY_LABEL, EVENTS_STORY_LINE, READ_MY_STORY } from '../stopZeroWords';
import { ABOUT_US_HEADING } from '../homeActWords';
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
const DONE_FOR_YOU_OPEN = '<section className="w-full border-b border-border bg-bg-terminal">'; // HOME-ORDER-01 (2026-11-10): Stop 0's upper neighbour
/** code() blanks a JSX comment's words and keeps its braces. */
const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;

/** React's escaping of text: the ampersand, then the apostrophe. */
const asHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

// ── T1 · THE WORDS ───────────────────────────────────────────────────────────

test('T1 the words module exports exactly the ruled list, and every word is Alex\'s text — exact and in order (HOME-BRIEF-02, 2026-11-10)', () => {
  // HOME-BRIEF-02 (2026-11-10): the old story's exports are gone — STOP_ZERO_EYEBROW, STOP_ZERO_HEADLINE, STOP_ZERO_LETTER, STOP_ZERO_QUOTE,
  // STOP_ZERO_SIGNATURE, STOP_ZERO_TIMELINE_LABEL, FIRST_COMMIT_ON and stopZeroTimeline — and three new ones hold his finalized text, typed
  // here a second time so that a changed word fails by name.
  assert.deepEqual(Object.keys(stopZeroWords).sort(), ['EVENTS_STORY_LABEL', 'EVENTS_STORY_LINE', 'READ_MY_STORY', 'STOP_ZERO_ANCHOR', 'STOP_ZERO_DATES', 'STOP_ZERO_PLACE', 'STOP_ZERO_STORY']);
  assert.equal(STOP_ZERO_ANCHOR, 'stop-0');
  assert.equal(ABOUT_US_HEADING, 'About Us');
  assert.equal(STOP_ZERO_PLACE, 'Stop 0 | Los Angeles, California 🇺🇸');
  assert.equal(STOP_ZERO_DATES, 'January to June 2026');
  assert.deepEqual(STOP_ZERO_STORY, [
    {
      heading: 'Why I Built Temple Stuart',
      paragraphs: [
        "I've wanted to travel the world, build businesses, and work for myself for as long as I can remember.",
        "I've been reading travel blogs since 2003, exploring everything from natural wonders to festivals, sporting events, and destinations around the world.",
        "There's no shortage of people telling you where to go, what to see, and which links to click.",
        'But I kept wondering how to actually build a life that could afford those experiences.',
      ],
      quote: '“Everyone was showing me the life they were living. I wanted to understand how to build one of my own.”',
    },
    {
      heading: 'The Idea Behind Temple Stuart',
      paragraphs: [
        'I wanted to understand what living at home actually cost me, what I could afford elsewhere, and how to build a business that could finance it all.',
        "And I realized these weren't just travel problems.",
        "Whether you're managing personal finances, running a business, trading stocks, or planning a trip, you should be able to plan ahead, budget for it, and compare those plans with what actually happened.",
        'So I decided to build Temple Stuart.',
        "I cashed in my retirement savings to go all in. On New Year's Eve, instead of going out drinking and talking about my goals, I stayed home and started working on them.",
        'For the next six months, I focused on building connected bookkeeping, trading, and travel systems, all tied to a calendar.',
        'I wanted to separate personal, business, and trading finances, distinguish personal travel from business travel, and use actual financial records to make more informed plans and budgets.',
      ],
      quote: '“One connected system for managing your money, planning your future, and measuring the outcomes of your decisions.”',
    },
    {
      heading: 'Our Story Is Still Being Written',
      paragraphs: [
        'By June 30, my financial records had shown me something interesting.',
        'I could spend less money traveling the world than I was spending just to pay rent in Los Angeles.',
        "Unfortunately, my system wasn't quite ready. The travel booking platform couldn't handle my first trip, the trading algorithm wasn't ready for daily use, and bookkeeping still needed work.",
        'But I left anyway.',
        "I wanted to test what I'd built, learn from firsthand experience, and improve the system based on what actually worked.",
        "Besides, I'd rather spend my money living the life I wanted than sitting around watching other people live theirs.",
        "Every destination after Los Angeles is another chapter in the story of Temple Stuart. I'll be documenting what I planned, what I spent, what worked, what didn't, and how those experiences influence the business I'm building.",
        'Maybe you want to travel the world, start a business, manage your investments, or simply understand your finances better.',
        'Whatever your goal, I want Temple Stuart to help you make more informed decisions about how to get there.',
      ],
      quote: "“I don't just want to sell the dream. I want to guide people into living it for themselves.”",
    },
  ]);
  assert.deepEqual(STOP_ZERO_STORY.map((part) => part.paragraphs.length), [4, 7, 9], 'four, seven and nine paragraphs');
  for (const part of STOP_ZERO_STORY) assert.match(part.quote, /^“[^“”]+”$/, 'a quote is one line inside its own marks');
  assert.equal(EVENTS_STORY_LABEL, 'WHY EVENTS FIRST');
  assert.equal(EVENTS_STORY_LINE, 'In 5th grade I saw a resort in Transworld Snowboarding that looked better than mine, googled it, and found the travel blogs. The experience came first. The trip came second.');
  assert.equal(READ_MY_STORY, 'Read my story ↓');
});

// ── T2 · THE TIMELINE — RETIRED ──────────────────────────────────────────────
// HOME-BRIEF-02 (Alex's home page brief, 2026-11-10): T2 held the timeline — six rows, the first commit's day and Stop 1 derived from the
// trip log, an empty log throwing. The timeline went with the old story (stopZeroTimeline, FIRST_COMMIT_ON and HOW I GOT HERE are no longer
// in src/lib/stopZeroWords.ts), so there is nothing left for it to hold. T3 holds that the section draws no list; T4 that the leaf derives
// nothing and imports nothing.

// ── T3 · THE SECTION, RENDERED ───────────────────────────────────────────────

test('T3 the section renders id="stop-0" once, the h2 "About Us", the place, the dates in italics, then the three sections — each its h3, its paragraphs and its quote last — in one column, and nothing else (HOME-BRIEF-02, 2026-11-10)', () => {
  const html = renderToStaticMarkup(React.createElement(StopZeroSection));
  const head = `<section id="${STOP_ZERO_ANCHOR}" aria-label="About us" class="w-full border-b border-border bg-bg-terminal"><div class="max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14">`;
  const top = [
    `<h2 class="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">${ABOUT_US_HEADING}</h2>`,
    `<p class="mt-3 text-sm font-semibold text-text-primary">${asHtml(STOP_ZERO_PLACE)}</p>`,
    `<p class="mt-1 text-sm italic text-text-secondary">${asHtml(STOP_ZERO_DATES)}</p>`,
  ].join('');
  const parts = STOP_ZERO_STORY.map((part) => [
    `<div class="mt-10"><h3 class="max-w-2xl text-lg font-semibold text-text-primary">${asHtml(part.heading)}</h3>`,
    ...part.paragraphs.map((p) => `<p class="mt-4 max-w-2xl text-base leading-relaxed text-text-primary">${asHtml(p)}</p>`),
    `<blockquote class="mt-6 max-w-2xl text-xl font-semibold leading-snug text-brand-purple">${asHtml(part.quote)}</blockquote></div>`,
  ].join('')).join('');
  // The whole section, byte for byte: the act, its inner box, the heading, the place, the dates, the three sections — nothing else, nothing between.
  assert.equal(html, `${head}${top}${parts}</div></section>`);
  assert.equal(count(html, 'id="stop-0"'), 1, 'id="stop-0" once');
  assert.equal(count(html, '<h2'), 1, 'one h2');
  assert.match(html, /<h2 class="[^"]*">About Us<\/h2><p class="[^"]*">Stop 0 \| Los Angeles, California 🇺🇸<\/p><p class="[^"]*\bitalic\b[^"]*">January to June 2026<\/p>/, 'the heading, the place, then the dates in italics');
  assert.deepEqual([...html.matchAll(/<h3 class="[^"]*">([^<]*)<\/h3>/g)].map((m) => m[1]), ['Why I Built Temple Stuart', 'The Idea Behind Temple Stuart', 'Our Story Is Still Being Written'], 'the three headings, in his order');
  assert.equal(count(html, 'text-base leading-relaxed text-text-primary'), 20, 'twenty paragraphs: four, seven, nine');
  assert.equal(count(html, '<blockquote'), 3, 'three quotes');
  assert.equal(count(html, '</blockquote></div>'), 3, 'each quote is the last thing in its section');
  for (const gone of ['<ol', '<li', 'grid', 'rounded-lg', 'HOW I GOT HERE', '— Alex', 'STOP 0', 'None of the blogs']) assert.equal(count(html, gone), 0, `no "${gone}" — no grid, no card, no timeline, nothing of the old story`);
});

// ── T4 · THE SOURCE ──────────────────────────────────────────────────────────

test('T4 the section and the band type none of the words; the section holds no state, no fetch, no clock and no hex; the leaf is pure and imports nothing; nothing of the old story is left (HOME-BRIEF-02, 2026-11-10)', () => {
  const section = code(SECTION);
  const band = code(EXPERIENCES_SECTION);
  // Whitespace collapsed, so a word retyped as JSX text broken across lines is still found.
  const flatSection = section.replace(/\s+/g, ' ');
  const flatBand = band.replace(/\s+/g, ' ');
  const words = [ABOUT_US_HEADING, STOP_ZERO_PLACE, STOP_ZERO_DATES, ...STOP_ZERO_STORY.flatMap((part) => [part.heading, ...part.paragraphs, part.quote]), EVENTS_STORY_LABEL, EVENTS_STORY_LINE, READ_MY_STORY];
  assert.equal(words.length, 3 + 3 + 20 + 3 + 3, 'the heading, the place, the dates; three headings, twenty paragraphs, three quotes; the band\'s three');
  for (const w of words) {
    assert.ok(!flatSection.includes(w), `StopZeroSection does not type "${w.slice(0, 40)}"`);
    assert.ok(!flatBand.includes(w), `ExperiencesSection does not type "${w.slice(0, 40)}"`);
  }
  assert.match(section, /import \{ ABOUT_US_HEADING \} from '@\/lib\/homeActWords';/, 'the heading, from the headings leaf');
  assert.match(section, /import \{ STOP_ZERO_ANCHOR, STOP_ZERO_DATES, STOP_ZERO_PLACE, STOP_ZERO_STORY \} from '@\/lib\/stopZeroWords';/, 'the text, from its leaf');
  assert.match(band, /import \{ EVENTS_STORY_LABEL, EVENTS_STORY_LINE, READ_MY_STORY, STOP_ZERO_ANCHOR \} from '@\/lib\/stopZeroWords';/);
  assert.ok(!section.includes('stop-0') && !band.includes('stop-0'), 'the anchor is the leaf\'s, never retyped — in either file, in any form');
  assert.match(section, /<section id=\{STOP_ZERO_ANCHOR\} aria-label="About us" className="w-full border-b border-border bg-bg-terminal">/, 'the section takes its id from the leaf');
  assert.match(band, /<a href=\{`#\$\{STOP_ZERO_ANCHOR\}`\} className=\{EXP\.storyLink\}>\{READ_MY_STORY\}<\/a>/, 'the link takes its href from the leaf');
  assert.match(section, /<h2 className=\{STOP\.h2\}>\{ABOUT_US_HEADING\}<\/h2>/, 'the h2 is the headings leaf\'s');
  assert.match(section, /<blockquote className=\{STOP\.quote\}>\{part\.quote\}<\/blockquote>\s*<\/div>/, 'the quote is the last thing its section draws');
  assert.doesNotMatch(section, /\buse(State|Effect|Reducer|Ref|Router|SearchParams)\b|\bfetch\s*\(|new Date\(|Date\.now\(|toLocale|\bIntl\.|localStorage|sessionStorage|document\.cookie/, 'no state, no fetch, no clock, no storage');
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b/, 'zero new hex');
  assert.doesNotMatch(section, /stopZeroTimeline|WAS_HERE|<ol\b|<li\b|\bgrid\b|STOP\.card/, 'no timeline, no list, no grid, no card');
  const leaf = code(WORDS);
  assert.doesNotMatch(leaf, /from 'react'|\bfetch\s*\(|new Date\(|Date\.now\(|toLocale|\bIntl\.|process\.env/, 'the leaf is pure');
  assert.doesNotMatch(leaf, /\bimport\b|\brequire\(/, 'the leaf imports nothing — the timeline\'s three imports went with it');
  assert.doesNotMatch(leaf, /STOP_ZERO_(EYEBROW|HEADLINE|LETTER|QUOTE|SIGNATURE|TIMELINE_LABEL)|FIRST_COMMIT_ON|stopZeroTimeline/, 'the old story\'s exports are gone');
});

// ── T5 · LANDING ─────────────────────────────────────────────────────────────

test('T5 Landing mounts the section once, directly between DONE-FOR-YOU and MY TRIP (HOME-ORDER-01, 2026-11-10), and its import rides the ExperiencesSection import\'s line', () => {
  const landing = code(LANDING);
  assert.equal(count(landing, STOP_ZERO_MOUNT), 1, 'mounted once');
  assert.equal(count(landing, '<StopZeroSection'), 1);
  // HOME-ORDER-01 (2026-11-10): Alex's order — Stop 0 sits directly under the DONE-FOR-YOU section now, still directly above MY TRIP. Until then it sat
  // directly under the experiences mount ('the experiences → stop 0: a comment between, nothing else').
  const experiences = landing.indexOf(EXPERIENCES_MOUNT);
  assert.equal(count(landing, DONE_FOR_YOU_OPEN), 1, 'the DONE-FOR-YOU section, once');
  const doneForYou = landing.indexOf(DONE_FOR_YOU_OPEN);
  const doneForYouEnd = landing.indexOf('</section>', doneForYou) + '</section>'.length;
  const stopZero = landing.indexOf(STOP_ZERO_MOUNT);
  const myTrip = landing.indexOf(MY_TRIP_MOUNT);
  assert.ok(experiences > -1 && doneForYou > experiences && doneForYouEnd > doneForYou && stopZero > doneForYouEnd && myTrip > stopZero, 'experiences → … → DONE-FOR-YOU → stop 0 → my trip');
  assert.match(landing.slice(doneForYouEnd, stopZero), ONLY_COMMENTS, "DONE-FOR-YOU's </section> → stop 0: a comment between, nothing else");
  assert.match(landing.slice(stopZero + STOP_ZERO_MOUNT.length, myTrip), ONLY_COMMENTS, 'stop 0 → my trip: a comment between, nothing else');
  const imports = landing.split('\n').filter((l) => l.includes("import StopZeroSection from './StopZeroSection';"));
  assert.equal(imports.length, 1, 'imported once');
  assert.match(imports[0], /^import ExperiencesSection from '\.\/ExperiencesSection'; import StopZeroSection from '\.\/StopZeroSection';\s*$/, 'the import shares the ExperiencesSection import\'s line');
});

// ── T6 · THE EVENTS BAND ─────────────────────────────────────────────────────

test('T6 the events band links "#stop-0" once, in the ruled line directly before the closing line — on an event chip, on a season chip and on the refused view', () => {
  const story = `<p class="mt-8 max-w-2xl text-sm text-white/80"><span class="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-white/60">${EVENTS_STORY_LABEL}</span> ${EVENTS_STORY_LINE} <a href="#${STOP_ZERO_ANCHOR}" class="font-semibold text-white underline-offset-4 hover:underline whitespace-nowrap">${READ_MY_STORY}</a></p>`; // EVENTS-04 (2026-11-09): the link gains whitespace-nowrap — "Read my story ↓" on one line (Alex's ruling: re-pin this line)
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

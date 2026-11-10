/**
 * HOME-ORDER-01 (Alex, 2026-11-10 16:27: "What We Do → About Us → Our Story") — the home page's blocks stand in Alex's
 * order, under two headings. A MOVE of existing JSX: every block whole, with the comment above it; nothing copied.
 *
 *   T1 the twelve, each once, in the order: header · hero · "What We Do" · the how-to · DONE-FOR-YOU · the travel block ·
 *      the booking box (the experiences inside it) · the guest's strip · Stop 0 · MY TRIP · the door · footer —
 *      HOME-FINISH-02 (Alex, 2026-11-10 20:56): PLAN → BUILD → EXPLORE. Until then eleven, in the order header · hero · the
 *      travel block · the booking box (the experiences
 *      inside it, its Events panel — HOME-BRIEF-04: a band of their own, under the travel block, until then) · the guest's
 *      strip · the how-to · DONE-FOR-YOU · Stop 0 · MY TRIP · the door · footer (HOME-BRIEF-04, 2026-11-10: the plans
 *      mount left the page — the how-to is the Software Plans and sits in its seat, with its door; twelve until then.
 *      HOME-BRIEF-03, 2026-11-10: the how-to joined, between the plans and the services section — eleven until then);
 *   T2 "What We Do" — HOME-FINISH-02: the h2 that carries data-act-heading stands ALONE in the page's container, in
 *      gold and one size up, directly above the how-to; the travel block opens at its id row, its label and headline as
 *      they were (until then: the travel section's FIRST child, in the page's purple heading classes, above the id row);
 *   T3 the two headings come from the leaf (src/lib/homeActWords.ts — pure, no directive); Landing.tsx and
 *      WasHereSection.tsx import them and type neither; the trip log's h2 renders the leaf's word;
 *   T4 id={DEMO_ANCHOR} still renders once in Landing, on the travel block's eyebrow row.
 * Source is read through code() only (the reader law). No line number, no clock, no live call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code } from '../sourceText';
import { OUR_STORY_HEADING, WHAT_WE_DO_HEADING } from '../homeActWords';

const LANDING = 'src/components/landing/Landing.tsx';
const TRIP = 'src/components/landing/WasHereSection.tsx';
const LEAF = 'src/lib/homeActWords.ts';

const TRAVEL_OPEN = '<section aria-label="Live demo — travel" className="max-w-7xl mx-auto px-4 lg:px-8 border-b border-border">';
// HOME-FINISH-02 (Alex, 2026-11-10 20:56): the heading in gold, one size up, alone in the page's container. Until then it was the travel section's
// first child: '<h2 className="pt-8 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple" data-act-heading>{WHAT_WE_DO_HEADING}</h2>'.
const HEADING = '<h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold" data-act-heading>{WHAT_WE_DO_HEADING}</h2>';
const HEADING_BOX = '<div className="max-w-7xl mx-auto px-4 lg:px-8 pt-10">';
const HOW_TO = '<HowToSection onRequireAuth={onRequireAuth} />';
const ID_ROW = '<div id={DEMO_ANCHOR} className="flex items-baseline justify-between gap-3 pt-6">';
/**
 * The twelve, in Alex's order. HOME-FINISH-02 (Alex, 2026-11-10 20:56): PLAN → BUILD → EXPLORE — the how-to and DONE-FOR-YOU moved above the travel
 * block, and "What We Do" joined the list as a place of its own (until then the eleven ran: the travel block · the booking box · the guest's strip ·
 * the how-to · DONE-FOR-YOU). HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the plans mount left — ['the plans', "<PlansSection door={{ kind: 'button',
 * onClick: () => onRequireAuth() }} />"] stood between the guest's strip and the how-to — and the how-to, '<HowToSection />' until then, is
 * handed the door. (HOME-BRIEF-03, 2026-11-10: the how-to joined — eleven before it, twelve with it.)
 */
const MOUNTS: ReadonlyArray<readonly [string, string]> = [
  ['the header', '<LandingHeader onRequireLogin={onRequireLogin} onRequireAuth={onRequireAuth} />'],
  ['the hero', '<section className="bg-brand-purple text-white pb-14 pt-12">'],
  ['What We Do', HEADING],
  ['the how-to', HOW_TO], // HOME-BRIEF-03 (Alex, 2026-11-10): the services display; HOME-BRIEF-04: the Software Plans itself, in the plans' seat; HOME-FINISH-02: first under "What We Do"
  ['DONE-FOR-YOU', '<section id={SERVICES_ANCHOR} className="w-full border-b border-border bg-bg-terminal">'], // HOME-FINISH-02 (2026-11-10): the section carries its anchor — '<section className="w-full border-b border-border bg-bg-terminal">' until then
  ['the travel block', TRAVEL_OPEN],
  // HOME-BRIEF-04 (Alex, 2026-11-10 19:00 · 19:03): the purple band is gone — the experiences are the booking box's Events panel, inside the travel
  // block. Until then this entry was ['the experiences', '<ExperiencesSection today={today} />'], a block of its own between the travel block and the strip.
  ['the booking box, the experiences inside it', '<LandingBookingSection onRequireAuth={onRequireAuth} events={<ExperiencesSection today={today} />} />'],
  ["the guest's strip", '<GuestTripStrip onRequireAuth={onRequireAuth} />'],
  ['Stop 0', '<StopZeroSection />'],
  ['MY TRIP', '<WasHereSection today={today} />'],
  ['the door', '<section aria-label="How it all connects" className="max-w-7xl mx-auto px-4 lg:px-8 py-9 border-b border-border">'],
  ['the footer', '<LandingFooter />'],
];
/** code() blanks a JSX comment's words and keeps its braces. */
const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;
const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
/** Whitespace collapsed, so a word broken across lines is still found. */
const flat = (s: string): string => s.replace(/\s+/g, ' ');

test('T1 the twelve, each once, in Alex\'s order (HOME-FINISH-02: plan → build → explore): header · hero · "What We Do" · the how-to · DONE-FOR-YOU · travel · the booking box with the experiences inside it · guest strip · Stop 0 · MY TRIP · the door · footer', () => {
  const landing = code(LANDING);
  assert.equal(MOUNTS.length, 12);
  assert.equal(count(landing, 'PlansSection'), 0, 'the plans are mounted nowhere on this page — /pricing keeps them');
  assert.equal(count(landing, '<ExperiencesSection'), 1, 'the experiences are mounted once — in the booking box, never as a band of their own');
  for (const [name, mount] of MOUNTS) assert.equal(count(landing, mount), 1, `${name}: mounted exactly once`);
  const at = MOUNTS.map(([, mount]) => landing.indexOf(mount));
  assert.deepEqual(at, [...at].sort((a, b) => a - b), MOUNTS.map(([name]) => name).join(' → '));
  assert.equal(new Set(at).size, 12, 'twelve places');
});

test('T2 "What We Do" (HOME-FINISH-02): the data-act-heading h2 stands alone in the page\'s container, in gold and one size up, directly above the how-to; the travel block opens at its id row; its own label and headline follow', () => {
  const landing = code(LANDING);
  assert.equal(count(landing, HEADING), 1, 'the heading, once, as ruled');
  assert.equal(count(landing, 'data-act-heading'), 1, 'one act heading in this file');
  // HOME-FINISH-02 (Alex, 2026-11-10 20:56): the heading left the travel section. Until then: 'the section opens → the heading → the id row', with
  // nothing between the section's opening tag and the heading, and a comment between the heading and the id row.
  const alone = `${HEADING_BOX}\n        ${HEADING}\n      </div>`;
  assert.equal(count(landing, alone), 1, 'alone in the page\'s container: max-w-7xl mx-auto px-4 lg:px-8 pt-10');
  const hero = landing.indexOf('<section className="bg-brand-purple text-white pb-14 pt-12">');
  const box = landing.indexOf(alone);
  const howTo = landing.indexOf(HOW_TO);
  assert.ok(hero > -1 && box > landing.indexOf('</section>', hero) && howTo > box, 'under the hero, above the how-to');
  assert.match(landing.slice(box + alone.length, howTo), ONLY_COMMENTS, 'the heading → the how-to: comments between, nothing else');
  assert.match(landing.slice(landing.indexOf('</section>', hero) + '</section>'.length, box), ONLY_COMMENTS, 'the hero → the heading: comments between, nothing else');
  const travel = landing.indexOf(TRAVEL_OPEN);
  const idRow = landing.indexOf(ID_ROW);
  assert.ok(travel > howTo && idRow > travel, 'the travel block stands below the how-to');
  assert.match(landing.slice(travel + TRAVEL_OPEN.length, idRow), ONLY_COMMENTS, 'the travel section opens at its id row: a comment between, nothing else');
  // the block's own label and headline stand inside the travel section. HOME-BRIEF-02 (Alex, 2026-11-10): the label reads
  // TRAVEL BOOKING & EXPERIENCES — 'LIVE DEMO — TRAVEL' until then; the headline is unchanged.
  const travelEnd = landing.indexOf('</section>', travel);
  assert.ok(!landing.slice(travel, travelEnd).includes('data-act-heading'), 'the act heading is no longer in the travel section');
  const label = landing.indexOf('>TRAVEL BOOKING &amp; EXPERIENCES</p>');
  const headline = landing.indexOf('Search &amp; book travel — free today, no account needed.');
  assert.ok(label > idRow && headline > label && travelEnd > headline, 'the label, then the headline, inside the travel section');
  assert.equal(count(landing, 'TRAVEL BOOKING &amp; EXPERIENCES'), 1);
  assert.equal(count(landing, 'LIVE DEMO — TRAVEL'), 0, 'the old label is rendered nowhere');
  assert.equal(count(landing, 'Search &amp; book travel — free today, no account needed.'), 1);
});

test('T3 the two headings come from the leaf — pure, no directive; Landing.tsx and WasHereSection.tsx import them and type neither; the trip log\'s h2 renders the leaf\'s word', () => {
  assert.equal(WHAT_WE_DO_HEADING, 'What We Do');
  assert.equal(OUR_STORY_HEADING, 'Our Story');
  const leaf = code(LEAF);
  assert.match(leaf, /^export const WHAT_WE_DO_HEADING = 'What We Do';$/m);
  assert.match(leaf, /^export const OUR_STORY_HEADING = 'Our Story';$/m);
  assert.doesNotMatch(leaf, /\bimport\b|\brequire\(|['"]use client['"]|['"]use server['"]/, 'the leaf imports nothing and carries no directive');
  const landing = code(LANDING);
  const trip = code(TRIP);
  assert.match(landing, /^import \{ WHAT_WE_DO_HEADING \} from '@\/lib\/homeActWords';$/m);
  assert.match(trip, /^import \{ OUR_STORY_HEADING \} from '@\/lib\/homeActWords';$/m);
  assert.match(trip, /^export const MY_TRIP_HEADLINE = OUR_STORY_HEADING;\s*$/m, 'the trip log\'s headline is the leaf\'s word');
  assert.equal(count(trip, '<h2 className={TRIP.h2}>{MY_TRIP_HEADLINE}</h2>'), 1, 'and its h2 renders it');
  for (const [file, source] of [[LANDING, landing], [TRIP, trip]] as const) {
    for (const words of [WHAT_WE_DO_HEADING, OUR_STORY_HEADING]) assert.ok(!flat(source).includes(words), `${file} does not type "${words}"`);
  }
});

test('T4 id={DEMO_ANCHOR} still renders once in Landing — on the travel block\'s eyebrow row, inside the travel section', () => {
  const landing = code(LANDING);
  assert.equal(count(landing, 'id={DEMO_ANCHOR}'), 1, 'the anchor, once');
  assert.equal(count(landing, ID_ROW), 1, 'on the eyebrow row');
  const travel = landing.indexOf(TRAVEL_OPEN);
  const idRow = landing.indexOf(ID_ROW);
  assert.ok(travel > -1 && idRow > travel && idRow < landing.indexOf('</section>', travel), 'inside the travel section');
  assert.match(landing, /^import \{ DEMO_ANCHOR \} from '@\/lib\/homeAnchors';/m, 'from its one home');
});

/**
 * HOME-ORDER-01 (Alex, 2026-11-10 16:27: "What We Do → About Us → Our Story") — the home page's blocks stand in Alex's
 * order, under two headings. A MOVE of existing JSX: every block whole, with the comment above it; nothing copied.
 *
 *   T1 the eleven mounts, each once, in the order: header · hero · the travel block · the experiences · the guest's
 *      strip · the how-to · DONE-FOR-YOU · Stop 0 · MY TRIP · the door · footer (HOME-BRIEF-04, 2026-11-10: the plans
 *      mount left the page — the how-to is the Software Plans and sits in its seat, with its door; twelve until then.
 *      HOME-BRIEF-03, 2026-11-10: the how-to joined, between the plans and the services section — eleven until then);
 *   T2 "What We Do" — the h2 that carries data-act-heading is the travel section's FIRST child, in the page's own heading
 *      classes, above the id row; the block's own label and headline still follow it;
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
const HEADING = '<h2 className="pt-8 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple" data-act-heading>{WHAT_WE_DO_HEADING}</h2>';
const ID_ROW = '<div id={DEMO_ANCHOR} className="flex items-baseline justify-between gap-3 pt-6">';
/**
 * The eleven, in Alex's order. HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the plans mount left — ['the plans', "<PlansSection door={{ kind: 'button',
 * onClick: () => onRequireAuth() }} />"] stood between the guest's strip and the how-to — and the how-to, '<HowToSection />' until then, is
 * handed the door. (HOME-BRIEF-03, 2026-11-10: the how-to joined — eleven before it, twelve with it.)
 */
const MOUNTS: ReadonlyArray<readonly [string, string]> = [
  ['the header', '<LandingHeader onRequireLogin={onRequireLogin} onRequireAuth={onRequireAuth} />'],
  ['the hero', '<section className="bg-brand-purple text-white pb-14 pt-12">'],
  ['the travel block', TRAVEL_OPEN],
  ['the experiences', '<ExperiencesSection today={today} />'],
  ["the guest's strip", '<GuestTripStrip onRequireAuth={onRequireAuth} />'],
  ['the how-to', '<HowToSection onRequireAuth={onRequireAuth} />'], // HOME-BRIEF-03 (Alex, 2026-11-10): the services display; HOME-BRIEF-04: the Software Plans itself, in the plans' seat
  ['DONE-FOR-YOU', '<section className="w-full border-b border-border bg-bg-terminal">'],
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

test('T1 the eleven mounts, each once, in Alex\'s order: header · hero · travel · experiences · guest strip · the how-to (the Software Plans, HOME-BRIEF-04) · DONE-FOR-YOU · Stop 0 · MY TRIP · the door · footer', () => {
  const landing = code(LANDING);
  assert.equal(MOUNTS.length, 11);
  assert.equal(count(landing, 'PlansSection'), 0, 'the plans are mounted nowhere on this page — /pricing keeps them');
  for (const [name, mount] of MOUNTS) assert.equal(count(landing, mount), 1, `${name}: mounted exactly once`);
  const at = MOUNTS.map(([, mount]) => landing.indexOf(mount));
  assert.deepEqual(at, [...at].sort((a, b) => a - b), MOUNTS.map(([name]) => name).join(' → '));
  assert.equal(new Set(at).size, 11, 'eleven places');
});

test('T2 "What We Do": the data-act-heading h2 is the travel section\'s first child, in the page\'s heading classes, above the id row; the block\'s own label and headline follow', () => {
  const landing = code(LANDING);
  assert.equal(count(landing, HEADING), 1, 'the heading, once, as ruled');
  assert.equal(count(landing, 'data-act-heading'), 1, 'one act heading in this file');
  const travel = landing.indexOf(TRAVEL_OPEN);
  const heading = landing.indexOf(HEADING);
  const idRow = landing.indexOf(ID_ROW);
  assert.ok(travel > -1 && heading > travel && idRow > heading, 'the section opens → the heading → the id row');
  assert.match(landing.slice(travel + TRAVEL_OPEN.length, heading), /^\s*$/, 'nothing stands between the section\'s opening tag and the heading');
  assert.match(landing.slice(heading + HEADING.length, idRow), ONLY_COMMENTS, 'the heading → the id row: a comment between, nothing else');
  // the block's own label and headline stand under the heading, inside the same section. HOME-BRIEF-02 (Alex, 2026-11-10): the label reads
  // TRAVEL BOOKING & EXPERIENCES — 'LIVE DEMO — TRAVEL' until then; the headline is unchanged.
  const travelEnd = landing.indexOf('</section>', travel);
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

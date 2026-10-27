/**
 * DECK-01 (Alex, 2026-10-16) — THE DAY CARD AS A SWIPE DECK, THE JOURNAL ON ITS
 * OWN UNDER IT, DECLUTTERED.
 *
 * "Up top, we keep the day toggle, but for the steps, can we make the cards
 * horizontal swipable, like a tinder swipe card, with button on left and right of
 * card for when on computer. Also all cards look great, but vision card, it
 * cluttered, and also we can pull this out of the stack, and put it under the
 * stack by itself."
 *
 * The words (dayCard.ts, journal.ts) are DRIVEN; the deck (stops/DayDeck.tsx),
 * the card (day/DayCard.tsx) and the journal plate are anchored to their source
 * with comments stripped (TEST-TRUTH-01). Every plate, figure and rule is
 * unchanged — their own tests still drive them; this file pins what moved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  DECK_FULL_CARD_WORDS, DECK_NEXT_WORDS, DECK_PREVIOUS_WORDS, DECK_WORDS, PLATE_SCALE_MAX, PLATE_WIDTH, SWIPE_HINT_WORDS,
  badStepWords, deckCardWords, journalHeaderWords, journalImageName, openJournalWords, openStepWords, stepHeaderWords,
} from '@/components/workbench/operations/day/dayCard';
import { DECK_BLEED_QUERY, DECK_GAP, DECK_PEEK, deckScaleOf, frameScaleOf, underStyle } from '@/components/workbench/operations/stops/DayDeck';
import { NO_JOURNAL_YESTERDAY_WORDS, NO_PLAN_YESTERDAY_WORDS, answersOf, leftOverWords, noJournalWords, yesterdayStepsWords } from '../operations/journal';
import { CARD_IMAGE_PIXEL_RATIO, cardImageName } from '@/components/workbench/operations/cardImage';

const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const RULES = 'src/components/workbench/operations/day/dayCard.ts';
const DECK = 'src/components/workbench/operations/stops/DayDeck.tsx';
const JOURNAL = 'src/lib/operations/journal.ts';
const STOP_ROLE = 'src/lib/operations/stopRole.ts';
const JOURNAL_FORM = 'src/components/workbench/operations/stops/JournalForm.tsx';
const STOP_FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const STOP_VENDOR = 'src/components/workbench/operations/stops/StopVendor.tsx';
const LAYOUT = 'src/components/ui/AppLayout.tsx';

function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}

/** The card's source, comments stripped, and its parts: the journal plate, the stop card, the full card, under the deck, the journal section. */
function card() {
  const c = code(CARD);
  const at = (s: string, from = 0) => { const i = c.indexOf(s, from); assert.notEqual(i, -1, `${JSON.stringify(s)} is in the card`); return i; };
  return {
    c,
    journalPlate: c.slice(at('function JournalPlate('), at('function PlateHeader(')),
    stopPlate: c.slice(at('const stopPlate = (f: Focus) => {'), at('const fullPlate = (')),
    fullPlate: c.slice(at('const fullPlate = ('), at('const under = ')),
    under: c.slice(at('</DayDeck>')),
    journalSection: c.slice(at('data-day-journal-section>'), at('data-day-foot>')),
  };
}

// ── T1 · THE WORDS ───────────────────────────────────────────────────────────

test('T1 the deck’s words, the journal card’s words, YESTERDAY’s one line — every printed sentence a constant or a words function', () => {
  assert.equal(SWIPE_HINT_WORDS, 'swipe or tap a stop to record it', 'the full card’s hint: the new way in');
  assert.deepEqual([DECK_WORDS, DECK_PREVIOUS_WORDS, DECK_NEXT_WORDS, DECK_FULL_CARD_WORDS], ['the day’s cards', 'previous card', 'next card', 'the day']);
  assert.equal(deckCardWords(1, 10, DECK_FULL_CARD_WORDS), 'card 1 of 10 — the day', 'the position marker names the card');
  assert.equal(deckCardWords(3, 10, 'Brunch'), 'card 3 of 10 — Brunch');
  // A stop card's header counts the deck's stops (the caller hands N = deckStops.length); the rule is unchanged.
  assert.equal(stepHeaderWords(2, 9, '07:30'), '2 OF 9 · 07:30');
  assert.equal(stepHeaderWords(1, 1, null), '1 OF 1 · —');
  assert.equal(badStepWords('12', 9), '?step=12 is not one of this day\'s 9 stops — showing the whole card');
  // The journal card: the time alone in the header, its own door from the full card's row, its own file name.
  assert.equal(journalHeaderWords('06:00'), '06:00');
  assert.equal(journalHeaderWords(null), '—', 'no time — the same mark the step header prints');
  assert.equal(openJournalWords('Vision journal'), 'Open the journal card: Vision journal');
  assert.equal(openStepWords(3, 'Brunch'), 'Open step 3: Brunch', 'a stop row’s door, named for the deck’s card');
  assert.equal(journalImageName('2026-10-13'), 'temple-stuart-2026-10-13-journal.png');
  assert.notEqual(journalImageName('2026-10-13'), cardImageName('2026-10-13', null), 'never the full card’s name');
  // YESTERDAY, one line of counts.
  assert.equal(leftOverWords(2), '2 left over');
  assert.equal(leftOverWords(1), '1 left over');
  const six = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.equal(yesterdayStepsWords(answersOf({ plan_steps: six, plan_done: [true, true, false, true, true, false] })), '4 of 6 steps done · 2 left over');
  assert.equal(yesterdayStepsWords(answersOf({ plan_steps: six, plan_done: [true, true, true, true, true, true] })), 'all 6 steps done');
  assert.equal(yesterdayStepsWords(answersOf({ plan_steps: ['a'], plan_done: [false] })), '0 of 1 steps done · 1 left over');
  assert.equal(yesterdayStepsWords(answersOf({ goals: ['g'] })), NO_PLAN_YESTERDAY_WORDS);
  assert.equal(yesterdayStepsWords(null), NO_JOURNAL_YESTERDAY_WORDS);
  assert.doesNotMatch(yesterdayStepsWords(answersOf({ plan_steps: six, plan_done: [true, false, false, false, false, false] })), /[a-f] · [a-f]|left over:/, 'the steps themselves are not listed');
  assert.match(code(JOURNAL), /export const leftOverWords = \(k: number\): string => `\$\{k\} left over`;/);
  // JOURNAL-05 (Alex, 2026-10-19): the counts line is stepsCountWords — one line for the morning's YESTERDAY and the evening's TODAY'S TICKS; the words are the same.
  assert.match(code(JOURNAL), /const stepsCountWords = \(y: Extract<YesterdaySteps, \{ kind: 'steps' \}>\): string =>\n\s*\(y\.leftOver\.length === 0 \? `all \$\{y\.of\} steps done` : `\$\{y\.done\} of \$\{y\.of\} steps done · \$\{leftOverWords\(y\.leftOver\.length\)\}`\);/, 'the counts, from the one rule (openSteps) — its leftOver list is still what the form and the prompt read');
  assert.match(code(JOURNAL), /if \(y\.kind === 'no plan'\) return NO_PLAN_YESTERDAY_WORDS;\n\s*return stepsCountWords\(y\);/, 'YESTERDAY prints that line');
  assert.equal(noJournalWords('Tue Oct 14'), 'nothing typed for Tue Oct 14', 'nothing typed — the one line in place of TODAY, BLOCKERS and PLAN');
  // The words that left: the plate prints no '—' for an unanswered block, lists no left-over step, and the hint is the deck's.
  assert.doesNotMatch(code(JOURNAL), /\bUNANSWERED_WORD\b|\bLEFT_OVER_WORD\b|'left over:'/, 'UNANSWERED_WORD and LEFT_OVER_WORD are deleted');
  assert.match(code(JOURNAL), /export const PLAN_PROMPT_LEFT_OVER = 'Yesterday — left over:';/, 'the plan prompt’s own heading stands — it still lists the steps');
  assert.doesNotMatch(code(STOP_ROLE), /\bTAP_A_STOP_WORDS\b|'tap a stop to record it'/, 'TAP_A_STOP_WORDS is deleted — the hint lives with the deck’s words');
  for (const f of [CARD, JOURNAL_FORM, DECK]) assert.doesNotMatch(code(f), /\bUNANSWERED_WORD\b|\bLEFT_OVER_WORD\b|\bTAP_A_STOP_WORDS\b/, `${f} reads none of them`);
  assert.match(code(RULES), /export const SWIPE_HINT_WORDS = 'swipe or tap a stop to record it';/);
  assert.match(comments(JOURNAL), /DECK-01 \(Alex, 2026-10-16\)/);
  assert.match(comments(STOP_ROLE), /DECK-01 \(Alex, 2026-10-16\): TAP_A_STOP_WORDS/);
  assert.match(comments(RULES), /DECK-01/);
});

// ── T2 · THE DECK ────────────────────────────────────────────────────────────

test('T2 the deck: CSS scroll snap, no dependency, controlled by ?step=, ‹ › and ← →, the next card peeking, a position marker, reduced motion honoured; it reads and writes nothing', () => {
  const d = code(DECK);
  // Outside the day folder (daycard01 T5 holds the folder to three files); two imports — React and the card's words — and nothing else.
  assert.deepEqual([...d.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['react', '../day/dayCard'], 'no library: the browser’s own scroll snap');
  // WIDTH-01 (Alex, 2026-10-16): PLATE_SCALE_MAX joined the import — the cap on the scale (T6).
  assert.match(d, /import \{ DECK_NEXT_WORDS, DECK_PREVIOUS_WORDS, DECK_WORDS, PLATE_SCALE_MAX, PLATE_WIDTH, deckCardWords \} from '\.\.\/day\/dayCard';/);
  assert.doesNotMatch(code('package.json'), /swiper|embla|keen-slider|react-slick|framer-motion|react-spring|use-gesture|react-swipeable/, 'no dependency added');
  assert.doesNotMatch(d, /\bfetch\s*\(|method:|localStorage|sessionStorage|document\.cookie|useRouter|useSearchParams|StageStrip|ProofStrip/, 'reads nothing, writes nothing, stores nothing, routes nothing');
  assert.match(d, /^'use client';/m);
  // Controlled: the caller says the card in view and is told when it moves.
  assert.match(d, /export default function DayDeck\(\{ cards, index, onIndexChange, children \}: \{\n\s*cards: readonly DeckCard\[\];\n\s*\n?\s*index: number;\n\s*onIndexChange: \(index: number\) => void;\n\s*\n?\s*children: readonly ReactNode\[\];\n\}\)/, 'the deck’s contract');
  assert.match(d, /export interface DeckCard \{\n\s*readonly key: string;\n\s*\n?\s*readonly words: string;\n\}/);
  // The swipe: the browser's scroll snap — every card snaps to the centre, one at a time; no scrollbar.
  assert.match(d, /style=\{\{ overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', gap: DECK_GAP, paddingLeft: sidePadding, paddingRight: sidePadding, scrollbarWidth: 'none', height, transition: reducedMotion\(\) \? undefined : 'height 220ms ease' \}\}/, 'the scroller');
  assert.match(d, /style=\{\{ width: slideWidth, height: [^}]*, scrollSnapAlign: 'center', scrollSnapStop: 'always' \}\}/, 'each card snaps to the centre, one swipe one card');
  // The next card peeks: the card is the deck's width less a peek at each edge; the padding centres it. Nothing typed but the two constants.
  assert.equal(DECK_PEEK, 28);
  assert.equal(DECK_GAP, 12);
  // WIDTH-01 (Alex, 2026-10-16): the scale may pass 1 — the deck's width less the peeks over the plate's, capped at PLATE_SCALE_MAX (deckScaleOf, T6).
  assert.match(d, /const scale = deckWidth === null \? 1 : deckScaleOf\(deckWidth\);\n\s*const slideWidth = Math\.round\(PLATE_WIDTH \* scale\);\n\s*const stride = slideWidth \+ DECK_GAP;\n\s*const sidePadding = deckWidth === null \? 0 : Math\.max\(0, Math\.floor\(\(deckWidth - slideWidth\) \/ 2\)\);/, 'the scale: the card fits the deck less the peek, down or up, never past the cap');
  // The plate itself stays PLATE_WIDTH wide — a transform scales it, so "download image" renders it full size whatever the screen.
  assert.match(d, /<div ref=\{\(el\) => \{ inner\.current\[i\] = el; \}\} style=\{\{ width: PLATE_WIDTH, transform: scale === 1 \? undefined : `scale\(\$\{scale\}\)`, transformOrigin: 'top left' \}\}>\n\s*\{children\[i\]\}/, 'the plate at its width, scaled by a transform');
  assert.equal((d.match(/new ResizeObserver\(/g) ?? []).length, 3, 'measured, never guessed: the deck’s width, each card’s height, the frame');
  // A swipe settles on a card: the scroll rests, the card under the centre is the one in view — the caller is told once.
  assert.match(d, /const onScroll = \(\) => \{\n\s*if \(settle\.current !== null\) window\.clearTimeout\(settle\.current\);\n\s*settle\.current = window\.setTimeout\(\(\) => \{\n\s*const el = scroller\.current;\n\s*if \(el === null\) return;\n\s*const i = Math\.max\(0, Math\.min\(cards\.length - 1, Math\.round\(el\.scrollLeft \/ stride\)\)\);\n\s*if \(i !== shown\.current\) \{\n\s*shown\.current = i;\n\s*onIndexChange\(i\);\n\s*\}\n\s*\}, 90\);\n\s*\};/, 'the settle');
  // The caller moved the card (a link, a reload, a tap on a row): scrolled to — instantly on the first paint, smoothly after.
  assert.match(d, /if \(shown\.current !== index \|\| instant\) \{\n\s*shown\.current = index;\n\s*scrollTo\(index, !instant\);\n\s*\}/);
  assert.match(d, /el\.scrollTo\(\{ left: i \* stride, behavior: smooth && !reducedMotion\(\) \? 'smooth' : 'auto' \}\);/, 'motion follows prefers-reduced-motion');
  assert.match(d, /const reducedMotion = \(\): boolean => typeof window !== 'undefined' && window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches;/);
  // ‹ › at the card's edges, disabled at the ends; ← → while the deck has focus (a real tab stop); a dot per card.
  assert.match(d, /<button type="button" className=\{`\$\{arrow\} left-1`\} aria-label=\{DECK_PREVIOUS_WORDS\} disabled=\{index === 0\} onClick=\{\(\) => step\(-1\)\} data-day-deck-previous>‹<\/button>/);
  assert.match(d, /<button type="button" className=\{`\$\{arrow\} right-1`\} aria-label=\{DECK_NEXT_WORDS\} disabled=\{index >= cards\.length - 1\} onClick=\{\(\) => step\(1\)\} data-day-deck-next>›<\/button>/);
  assert.match(d, /const onKeyDown = \(e: KeyboardEvent<HTMLDivElement>\) => \{\n\s*if \(e\.key === 'ArrowLeft'\) \{ e\.preventDefault\(\); step\(-1\); \}\n\s*if \(e\.key === 'ArrowRight'\) \{ e\.preventDefault\(\); step\(1\); \}\n\s*\};/);
  assert.match(d, /tabIndex=\{0\}\n\s*role="region"\n\s*aria-roledescription="carousel"\n\s*aria-label=\{DECK_WORDS\}\n\s*onScroll=\{onScroll\}\n\s*onKeyDown=\{onKeyDown\}\n\s*data-day-deck-scroller/);
  assert.match(d, /const step = \(direction: -1 \| 1\) => \{\n\s*const i = Math\.max\(0, Math\.min\(cards\.length - 1, shown\.current \+ direction\)\);\n\s*if \(i === shown\.current\) return;\n\s*shown\.current = i;\n\s*scrollTo\(i, true\);\n\s*onIndexChange\(i\);\n\s*\};/, 'a button or a key: one card, told once');
  assert.match(d, /aria-label=\{deckCardWords\(i \+ 1, cards\.length, card\.words\)\}\n\s*aria-current=\{i === index \? 'true' : undefined\}\n\s*onClick=\{\(\) => jump\(i\)\}\n\s*data-day-deck-dot=\{i\}/, 'the position marker: a dot per card, the one in view current, each a door');
  assert.match(d, /aria-label=\{deckCardWords\(i \+ 1, cards\.length, card\.words\)\}\n\s*aria-hidden=\{i !== index\}\n\s*data-day-deck-card=\{i\}/, 'a card out of view is hidden from the reader');
  // WIDTH-01 (Alex, 2026-10-16): at lg and up the deck bleeds DECK_PEEK into the gutter on each side (T6); the attribute says which regime.
  assert.match(d, /<div className="relative" style=\{\{ marginLeft: bleed \? -DECK_PEEK : 0, marginRight: bleed \? -DECK_PEEK : 0 \}\} data-day-deck data-day-deck-index=\{index\} data-day-deck-of=\{cards\.length\} data-day-deck-scale=\{scale\.toFixed\(3\)\} data-day-deck-bleed=\{bleed \? 'true' : 'false'\}>/);
  // The glyphs are the only text the deck prints of its own; every sentence is a constant or a words function.
  assert.deepEqual([...d.matchAll(/>([^<>{}\n]+)</g)].map((m) => m[1]), ['‹', '›']);
  // The frame: a plate on its own (the journal card, the loading plate) scaled the same way, centred.
  assert.match(d, /export function PlateFrame\(\{ children \}: \{ children: ReactNode \}\) \{/);
  // WIDTH-01 (Alex, 2026-10-16): the frame's card is the deck's card's width in the same regime (frameScaleOf, T6).
  assert.match(d, /const scale = width === null \? 1 : frameScaleOf\(width, bleed\);/);
  assert.match(d, /<div ref=\{inner\} style=\{\{ width: PLATE_WIDTH, transform: scale === 1 \? undefined : `scale\(\$\{scale\}\)`, transformOrigin: 'top left' \}\}>\{children\}<\/div>/);
  assert.match(d, /className="w-full flex justify-center" data-day-plate-frame data-day-plate-scale=\{scale\.toFixed\(3\)\}/);
  // The paint: the app's tokens; the one solid fill is the current dot (9 px, no ink on it).
  const classes = [...d.matchAll(/className="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).concat([...d.matchAll(/className=\{`([^`]*)`\}/g)].flatMap((m) => m[1].replace(/\$\{[^}]*\}/g, '').split(/\s+/)));
  const arrow = /const arrow = '([^']*)';/.exec(d);
  assert.ok(arrow !== null);
  const colour = classes.concat(arrow![1].split(/\s+/)).filter((k) => /^(?:[a-z-]+:)?(text|bg|border|ring)-/.test(k));
  const allowed = /^(text-text-primary|text-lg|border-border|border|bg-ts-white|hover:bg-bg-row|focus-visible:ring-2|focus-visible:ring-brand-purple)$/;
  assert.deepEqual(colour.filter((k) => !allowed.test(k)), [], 'every colour class is a token');
  assert.match(d, /className=\{`rounded-full border border-border \$\{i === index \? 'bg-brand-purple border-brand-purple' : 'bg-ts-white hover:bg-bg-row'\}`\}\n\s*style=\{\{ width: 9, height: 9 \}\}/, 'the current dot purple, the others white');
  assert.equal((d.match(/bg-brand-purple/g) ?? []).length, 1, 'one fill — the dot');
  assert.match(comments(DECK), /DECK-01, Alex, 2026-10-16/);
});

// ── T3 · THE CARD: THE TOP, THE DECK, ONE SET OF CONTROLS UNDER IT ──────────

test('T3 the card: the day controls stay and push; the deck holds the full card then one card per stop (the journal excepted); ?step= follows the card with a replace; one set of controls under the deck follows the card in view', () => {
  const { c, fullPlate, stopPlate, under } = card();
  // R1 THE TOP: ‹ date › today — pushes, as before; "all", "‹ step" and "step ›" are gone.
  assert.match(c, /<div className="flex flex-wrap items-center gap-1\.5 text-xs" data-day-controls>\n\s*<button type="button" className=\{chip\} aria-label="Back one day" onClick=\{\(\) => go\(hrefFor\(shiftDay\(day, -1\), null\)\)\}>‹<\/button>\n\s*<span className="font-mono text-text-primary" data-day-day>\{day\}<\/span>\n\s*<button type="button" className=\{chip\} aria-label="Forward one day" onClick=\{\(\) => go\(hrefFor\(shiftDay\(day, 1\), null\)\)\}>›<\/button>\n\s*<button type="button" className=\{chip\} disabled=\{day === today\} onClick=\{\(\) => go\(hrefFor\(today, null\)\)\}>\{TODAY_WORD\}<\/button>\n\s*<\/div>/, 'the day controls, and nothing else');
  assert.doesNotMatch(c, />all<\/button>|‹ step<\/button>|step ›<\/button>|aria-label="Back one step"|aria-label="Forward one step"/);
  assert.match(c, /const go = \(href: string\) => router\.push\(href\);/);
  assert.equal((c.match(/go\(hrefFor\(/g) ?? []).length, 3, 'three pushes: ‹, ›, today');
  // R2 THE DECK: one, mounted once the reads are in; the full card first, then one card per stop in the table's order, the journal stop excepted.
  // WIDTH-01 (Alex, 2026-10-16): the width of what sits under a card is the deck's rule too (underStyle, useDeckBleed — T6).
  assert.match(c, /import DayDeck, \{ PlateFrame, underStyle, useDeckBleed, type DeckCard \} from '\.\.\/stops\/DayDeck';/, 'the deck lives outside the day folder');
  assert.match(c, /const deckStops = result\.stops\.map\(\(stop, j\) => \(\{ stop, at: j \+ 1 \}\)\)\.filter\(\(x\) => x\.stop\.role !== 'journal'\);\n\s*const deckNumberOf = new Map\(deckStops\.map\(\(x, i\) => \[x\.stop\.key, i \+ 1\]\)\);\n\s*const journalStop = result\.stops\.find\(\(s\) => s\.role === 'journal'\) \?\? null;/, 'the deck’s stops, their card numbers, the journal stop');
  assert.match(c, /const cards: DeckCard\[\] = \[\{ key: 'all', words: DECK_FULL_CARD_WORDS \}, \.\.\.deckStops\.map\(\(\{ stop \}\) => \(\{ key: stop\.key, words: boldOf\(stop\) \}\)\)\];/, 'the cards, named for the marker');
  assert.match(c, /\{loaded && \(\n\s*<DayDeck cards=\{cards\} index=\{deckIndex\} onIndexChange=\{\(i\) => show\(i === 0 \? null : i\)\}>\n\s*\{\[\n\s*<Plate key="all" plateRef=\{\(el\) => \{ plateRefs\.current\[0\] = el; \}\} right=\{headerWords\(stayState, day\)\}>\{fullPlate\}<\/Plate>,\n\s*\.\.\.deckStops\.map\(\(\{ stop, at \}, i\) => \(\n\s*<Plate key=\{stop\.key\} plateRef=\{\(el\) => \{ plateRefs\.current\[i \+ 1\] = el; \}\} step=\{i \+ 1\} right=\{stepHeaderWords\(i \+ 1, N, stop\.time\)\}>\n\s*\{stopPlate\(focusOf\(at\)\)\}\n\s*<\/Plate>\n\s*\)\),\n\s*\]\}\n\s*<\/DayDeck>\n\s*\)\}/, 'the deck: the full card, then a stop card per deck stop — n OF N of the deck, each the same plate');
  assert.equal((c.match(/<DayDeck /g) ?? []).length, 1, 'one deck');
  // JOURNAL-05 (Alex, 2026-10-19): a fifth — the evening card's plate, under the morning form.
  assert.equal((c.match(/<Plate /g) ?? []).length, 5, 'the loading plate, the full card, the stop cards, the journal card, the evening card — the one Plate');
  assert.match(c, /const plateRefs = useRef<\(HTMLDivElement \| null\)\[\]>\(\[\]\);\n\s*const journalPlateRef = useRef<HTMLDivElement \| null>\(null\);\n\s*const journalCardRef = useRef<HTMLDivElement>\(null\);/, 'a ref per card, so "download image" renders the one in view');
  // Before the reads are in: the one plate with its loading line, in the frame (scaled on a phone as the deck scales) — no deck yet.
  assert.match(c, /\{!loaded && \(\n\s*<PlateFrame>\n\s*<Plate plateRef=\{\(el\) => \{ plateRefs\.current\[0\] = el; \}\} right=\{headerWords\(stayState, day\)\}>\n\s*<p className="pt-4 text-text-muted" style=\{\{ fontSize: 23 \}\} data-day-loading>loading the day…<\/p>\n\s*<\/Plate>\n\s*<\/PlateFrame>\n\s*\)\}/);
  // ?step=n is the deck's card n (1-based; 0 is the full card), judged once loaded, never clamped; a bad one named with the deck's count.
  assert.match(c, /const deckStop = loaded && n !== null && Number\.isInteger\(n\) && n >= 1 && n <= deckStops\.length \? deckStops\[n - 1\] : null;/);
  assert.match(c, /const N = deckStops\.length;\n\s*const deckIndex = deckStop === null \? 0 : \(n as number\);/);
  assert.match(c, /data-day-bad-step>\{badStepWords\(badStep, N\)\}/, 'the bad step counts the deck’s stops');
  // The so-far sums stay the itinerary's: a card's focus is focusStop at the stop's place on the day (at), the rule unchanged.
  assert.match(c, /const focus = deckStop === null \? null : focusOf\(deckStop\.at\);/);
  assert.match(code(RULES), /export function focusStop\(result: DayStops, n: number\): Focus \| null \{/, 'focusStop unchanged');
  // The deck moves with a REPLACE — a swipe, a button, a key, a dot or a row never fills the back button; a link or a reload opens the same card.
  assert.match(c, /const show = \(step: number \| null\) => router\.replace\(hrefFor\(day, step\), \{ scroll: false \}\);/);
  assert.equal((c.match(/router\.replace\(/g) ?? []).length, 1);
  assert.equal((c.match(/show\(/g) ?? []).length, 2, 'the deck’s onIndexChange and a row’s door');
  // A row of the full card opens its stop's card (the journal row the journal card, scrolled to — motion honoured).
  assert.match(fullPlate, /const card = deckNumberOf\.get\(s\.key\);\n\s*const open = card === undefined \? showJournal : \(\) => show\(card\);/);
  assert.match(fullPlate, /data-day-stop-card=\{card === undefined \? 'journal' : card\}\n\s*onClick=\{open\}/);
  assert.match(fullPlate, /aria-label=\{card === undefined \? openJournalWords\(boldOf\(s\)\) : openStepWords\(card, boldOf\(s\)\)\}/);
  assert.match(c, /const showJournal = \(\) => \{\n\s*const el = journalCardRef\.current;\n\s*if \(el === null\) return;\n\s*window\.scrollTo\(\{ top: window\.scrollY \+ el\.getBoundingClientRect\(\)\.top - JOURNAL_SCROLL_MARGIN, behavior: reducedMotion\(\) \? 'auto' : 'smooth' \}\);\n\s*\};/, 'the page scrolls to the journal card’s measured place, motion honoured');
  assert.match(c, /const JOURNAL_SCROLL_MARGIN = 8;/);
  assert.doesNotMatch(c, /scrollIntoView/);
  assert.match(c, /const reducedMotion = \(\): boolean => typeof window !== 'undefined' && window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches;/);
  assert.match(fullPlate, /\{result\.stops\.length > 0 && \(/, 'the full card’s table still lists every stop, the journal’s row too');
  // R3 THE CARDS ARE THE SAME: the stop card draws its own stop (f) and its own bars; the full card is the one body; nothing is gated on a role.
  assert.doesNotMatch(stopPlate + fullPlate, /role ===|role !==/, 'no role gate on either body — the journal is not in the deck');
  assert.match(stopPlate, /const d = deltaWords\(f\.stop\.actualCents, f\.stop\.cents\);\n\s*const bars = barsOf\(f\);/);
  assert.equal((c.match(/stopPlate\(/g) ?? []).length, 1);
  assert.equal((c.match(/\{fullPlate\}/g) ?? []).length, 1);
  // The hint says the new way in, under the full card only, outside it.
  assert.match(under, /\{loaded && focus === null && N > 0 && <p className="mx-auto text-xs text-text-muted" style=\{under\} data-day-hint>\{SWIPE_HINT_WORDS\}<\/p>\}/);
  // R4 ONE SET OF CONTROLS under the deck, following the card in view: the view is the card's own URL; the image is the plate in view, full size.
  assert.match(c, /const view = hrefFor\(day, deckStop === null \? null : deckIndex\);\n\s*const journalView = `\$\{hrefFor\(day, null\)\}#journal`;/);
  const reel = /<div className="flex flex-wrap items-center gap-1\.5" data-day-reel>([\s\S]*?)<\/div>/.exec(under);
  assert.ok(reel !== null, 'one row under the deck');
  assert.deepEqual([...reel![1].matchAll(/data-day-([a-z-]+)>\{([A-Z_]+)\}<\/button>/g)].map((m) => [m[1], m[2]]), [['download-image', 'DOWNLOAD_IMAGE_WORDS'], ['copy-caption', 'COPY_CAPTION_WORDS'], ['download-tag', 'DOWNLOAD_TAG_WORDS'], ['copy-script', 'COPY_SCRIPT_WORDS']]);
  assert.match(reel![1], /onClick=\{\(\) => downloadImage\(plateRefs\.current\[deckIndex\] \?\? null, cardImageName\(day, focus === null \? null : \{ index: deckIndex, label: boldOf\(focus\.stop\) \}\), view\)\} data-day-download-image>/, 'the plate in view, named for the deck’s card');
  assert.match(reel![1], /\{focus === null && <button type="button" className=\{chip\} disabled=\{caption === null \|\| !caption\.ok\} onClick=\{\(\) => copyReel\('caption', caption, view\)\} data-day-copy-caption>/, 'copy caption on the full card');
  assert.match(reel![1], /\{focus !== null && <button type="button" className=\{chip\} disabled=\{tag === null \|\| tagBusy\} aria-busy=\{tagBusy\} onClick=\{downloadTag\} data-day-download-tag>/, 'download tag on a stop card');
  assert.match(reel![1], /<button type="button" className=\{chip\} disabled=\{script === null \|\| !script\.ok\} onClick=\{\(\) => copyReel\('script', script, view\)\} data-day-copy-script>/, 'copy script on both');
  assert.match(c, /cardTagName\(day, \{ index: deckIndex, label: boldOf\(focus\.stop\) \}\)/, 'the tag named for the deck’s card');
  inOrder(under, ['data-day-image>', 'data-day-fine-print>', 'data-day-hint>', '{loaded && focus !== null && (', '<StopVendor key={focus.stop.key}', '{loaded && recordsOk && focus !== null && focus.stop.address !== null && (', '<StopForm key={`${focus.stop.key}:', 'data-day-journal-section>', 'data-day-foot>'], 'under the deck: the buttons, the fine print, the hint; the vendor box and the record row for the stop in view; the journal card; the sentences');
  assert.match(comments(CARD), /DECK-01 \(Alex, 2026-10-16\) — THE DECK/);
});

// ── T4 · THE JOURNAL CARD ON ITS OWN UNDER THE DECK ─────────────────────────

test('T4 the journal card: under the deck and its controls, always shown on a day with a journal stop — its plate with the time alone, download image · copy script (no tag), its record row, its form; no vendor box', () => {
  const { c, journalSection, stopPlate, fullPlate } = card();
  assert.match(c, /\{loaded && journalStop !== null && \(\n\s*<div ref=\{journalCardRef\} className="space-y-2 pt-3" style=\{\{ scrollMarginTop: JOURNAL_SCROLL_MARGIN \}\} id="journal" data-day-journal-section>/, 'shown whenever the day has a journal stop — whatever card the deck is on');
  inOrder(journalSection, ['<PlateFrame>', '<Plate plateRef={(el) => { journalPlateRef.current = el; }} journal right={journalHeaderWords(journalStop.time)}>', 'data-day-bold>{boldOf(journalStop)}', '<JournalPlate key={day} day={day} journal={journalRead} yesterday={yesterdayRead}', '</Plate>', '</PlateFrame>', 'data-day-journal-image>', 'data-day-journal-reel>', 'data-day-download-image>', 'data-day-copy-script>', 'data-day-image-failed>', 'data-day-reel-waits>', 'data-day-reel-no-stay>', 'data-day-reel-words>', '<StopForm key={`${journalStop.key}:', '<JournalForm key={`${day}:'], 'the plate, its buttons and their words, the record row, the form');
  const reel = /<div className="flex flex-wrap items-center gap-1\.5" data-day-journal-reel>([\s\S]*?)<\/div>/.exec(journalSection);
  assert.ok(reel !== null);
  assert.deepEqual([...reel![1].matchAll(/data-day-([a-z-]+)>\{([A-Z_]+)\}<\/button>/g)].map((m) => [m[1], m[2]]), [['download-image', 'DOWNLOAD_IMAGE_WORDS'], ['copy-script', 'COPY_SCRIPT_WORDS']], 'no tag (no money, no vendor), no caption (the day’s)');
  assert.match(reel![1], /onClick=\{\(\) => downloadImage\(journalPlateRef\.current, journalImageName\(day\), journalView\)\} data-day-download-image>/, 'its own plate, its own file name');
  assert.match(reel![1], /disabled=\{journalScript === null \|\| !journalScript\.ok\} onClick=\{\(\) => copyReel\('script', journalScript, journalView\)\} data-day-copy-script>/);
  assert.match(c, /const stopWait = reelReadsWords\(\{ \.\.\.reelReads, journal: null \}\);/, 'a stop’s script waits on no journal answer');
  // WORK-03 (Alex, 2026-10-26): the block reaches the reel — every stop's script hands in the stop's done tasks (null for a journal stop, reelDoneOf); the one rule still.
  assert.match(c, /const journalScript: ReelText \| null = journalStop === null \|\| stopWait !== null \? null : stopScriptText\(day, reelStay, journalStop, reelDoneOf\(reelDay, journalStop\)\);/, 'the journal stop’s script — the one rule every stop’s script is');
  assert.match(journalSection, /\{imageFailed !== null && imageFailed\.view === journalView && <p className="text-brand-red" data-day-image-failed>\{imageFailed\.words\}<\/p>\}/);
  assert.match(journalSection, /\{reelWords !== null && reelWords\.view === journalView && <p/);
  assert.match(journalSection, /\{recordsOk && journalStop\.address !== null && \(\n\s*<StopForm key=\{`\$\{journalStop\.key\}:\$\{journalStop\.record === null \? 'none' : journalStop\.record\.id\}`\} stop=\{journalStop\} day=\{day\} viewerZone=\{zone\} onChanged=\{\(\) => setRecordReads\(\(n\) => n \+ 1\)\} \/>\n\s*\)\}/, 'its record row, keyed as every stop’s');
  assert.match(journalSection, /\{journalRead !== null && journalRead\.ok && \(\n\s*<JournalForm key=/, 'its form — never while the journal could not be read');
  assert.doesNotMatch(journalSection, /<StopVendor|data-day-vendor|data-day-download-tag|data-day-copy-caption|data-day-fine-print|data-day-provenance|data-day-hint|stopPlate|fullPlate|data-day-step=/, 'no vendor box, no tag, no caption, no fine print, no stop card parts');
  assert.doesNotMatch(stopPlate + fullPlate, /JournalPlate|journalStop/, 'the journal plate is on no card of the deck');
  assert.equal((c.match(/<JournalPlate /g) ?? []).length, 1, 'one journal plate');
  assert.equal((c.match(/<StopForm /g) ?? []).length, 2, 'the stop in view’s record row, and the journal’s');
  assert.equal((c.match(/<StopVendor /g) ?? []).length, 1, 'the stop in view’s vendor box alone');
  // The header: the time alone — the journal is no step of the deck.
  assert.match(code(RULES), /export const journalHeaderWords = \(time: string \| null\): string => \(time === null \? '—' : time\);/);
  assert.doesNotMatch(journalSection, /stepHeaderWords/);
  // The plate is the one Plate, marked as the journal card.
  assert.match(c, /data-day-card data-day-step=\{step\} data-day-journal-card=\{journal \? 'true' : undefined\}>/);
});

// ── T5 · THE JOURNAL DECLUTTERED ────────────────────────────────────────────

test('T5 the journal plate, decluttered: YESTERDAY one line of counts; nothing typed is one line; a block with no answer is left out — no "—"', () => {
  const { journalPlate: p } = card();
  // YESTERDAY: the one line (the read's own state while it is not in) — no step listed.
  // JOURNAL-05 (Alex, 2026-10-19): ONE line above the counts, only when yesterday's row has a next — "Last night: …" (data-day-yesterday-next); the counts line stands.
  assert.match(p, /<div className="flex flex-col" style=\{\{ gap: 3 \}\} data-day-journal-yesterday>\n\s*<div className="font-bold text-text-faint" style=\{plateLabel\}>\{YESTERDAY_WORD\}<\/div>\n\s*\{yesterday === null && <div [^>]*data-day-yesterday-loading>\{YESTERDAY_LOADING_WORDS\}<\/div>\}\n\s*\{yesterday !== null && !yesterday\.ok && <div [^>]*data-day-yesterday-journal-failed>\{yesterday\.words\}<\/div>\}\n\s*\{yesterday !== null && yesterday\.ok && yRow !== null && yRow\.next !== null && <div [^>]*data-day-yesterday-next>\{lastNightWords\(yRow\.next\)\}<\/div>\}\n\s*\{yesterday !== null && yesterday\.ok && <div [^>]*data-day-yesterday-steps>\{yesterdayStepsWords\(yRow\)\}<\/div>\}\n\s*<\/div>/, 'YESTERDAY: last night’s next, then the one line of counts');
  assert.doesNotMatch(p, /leftOver|openSteps|yRow\.plan_steps|data-day-yesterday-step\b|data-day-yesterday-left/, 'the steps left over are not listed on the plate');
  // Nothing typed: the one line in place of TODAY, BLOCKERS and PLAN; the read's own state said first.
  assert.match(p, /\{journal === null && <div [^>]*data-day-journal-loading>\{JOURNAL_LOADING_WORDS\}<\/div>\}\n\s*\{journal !== null && !journal\.ok && <div [^>]*data-day-journal-failed>\{journal\.words\}<\/div>\}\n\s*\{journal !== null && journal\.ok && row === null && <div [^>]*data-day-journal-none>\{noJournalWords\(dayShortWords\(day\)\)\}<\/div>\}\n\s*\{row !== null && a\.goals\.length > 0 && \(/, 'in flight, failed, nothing typed — then the blocks');
  // Once something is typed: each block only with an answer.
  assert.match(p, /\{row !== null && a\.goals\.length > 0 && \(\n\s*<div className="flex flex-col" style=\{\{ gap: 3 \}\} data-day-journal-today>/);
  assert.match(p, /\{row !== null && a\.blocker !== null && \(\n\s*<div className="flex flex-col" style=\{\{ gap: 3 \}\} data-day-journal-blockers>/);
  assert.match(p, /\{row !== null && a\.plan_steps\.length > 0 && \(\n\s*<div className="flex flex-col" style=\{\{ gap: 3 \}\} data-day-journal-plan-block>/);
  assert.doesNotMatch(p, /'—'|UNANSWERED_WORD|goals-none|steps-none|blocker-none|a\.goals\.length === 0|a\.plan_steps\.length === 0|a\.blocker === null/, 'no "—", no empty block');
  // The same four blocks, the same words functions, the ticks unchanged.
  for (const kept of ['{TODAY_BLOCK_WORD}', '{BLOCKERS_BLOCK_WORD}', '{PLAN_BLOCK_WORD}', 'data-day-journal-goal>{goalWords(goal)}', 'data-day-journal-blocker>{a.blocker}', '{planStepWords(i + 1, step, a.plan_done[i])}', 'data-day-journal-plan-done>{planDoneWords(', 'onClick={() => tick(i)}']) assert.ok(p.includes(kept), `the plate keeps ${kept}`);
  assert.match(comments(CARD), /DECK-01 \(Alex, 2026-10-16\) — DECLUTTERED/);
});

// ── T6 · WIDTH-01: THE CARD FILLS THE SECTION, SCALED; THE IMAGE STAYS THE REEL'S SIZE ──

test('T6 WIDTH-01 (Alex, 2026-10-16): on screen a card is scaled to its frame — up to PLATE_SCALE_MAX — and the deck bleeds into the gutter at lg; what sits under a card takes its width; the plate and its image stay the reel’s size', () => {
  const d = code(DECK);
  const c = code(CARD);
  // R1 the scale may pass 1, capped by the one named constant; the plate's own width never changes.
  assert.equal(PLATE_SCALE_MAX, 2);
  assert.equal(PLATE_WIDTH, 640);
  assert.equal(deckScaleOf(696), 1, 'a deck of the plate plus the two peeks: 1');
  assert.equal(deckScaleOf(358), 0.471875, 'a 390 px phone less the 16 px gutters: down');
  assert.equal(deckScaleOf(1272), 1.9, 'a 1216 px section bled by the two peeks: up');
  assert.equal(deckScaleOf(5000), PLATE_SCALE_MAX, 'never past the cap');
  assert.equal(frameScaleOf(1216, true), 1.9, 'bled, the frame’s card is the frame’s width — the deck’s card’s width in the same section');
  assert.equal(frameScaleOf(1272, false), 1.9, 'not bled, the frame less the peeks — the deck’s card’s width in the same section');
  assert.equal(frameScaleOf(358, false), 0.471875);
  assert.equal(frameScaleOf(5000, true), PLATE_SCALE_MAX);
  assert.match(d, /export const deckScaleOf = \(deckWidth: number\): number => Math\.min\(PLATE_SCALE_MAX, \(deckWidth - 2 \* DECK_PEEK\) \/ PLATE_WIDTH\);/);
  assert.match(d, /export const frameScaleOf = \(frameWidth: number, bleed: boolean\): number => Math\.min\(PLATE_SCALE_MAX, \(bleed \? frameWidth : frameWidth - 2 \* DECK_PEEK\) \/ PLATE_WIDTH\);/);
  assert.equal((d.match(/Math\.min\(PLATE_SCALE_MAX, /g) ?? []).length, 2, 'the cap in the two scales and nowhere else');
  assert.doesNotMatch(d, /Math\.min\(1, /, 'no scale is held at 1 any more');
  assert.match(d, /const bleed = useDeckBleed\(\);\n\n\s*const scale = deckWidth === null \? 1 : deckScaleOf\(deckWidth\);/, 'the deck’s scale');
  // The plate stays PLATE_WIDTH inside the transform wrappers (T2) — "download image" renders the plate, so the PNG is the reel's size on every screen.
  assert.equal((d.match(/style=\{\{ width: PLATE_WIDTH, transform: scale === 1 \? undefined : `scale\(\$\{scale\}\)`, transformOrigin: 'top left' \}\}/g) ?? []).length, 2, 'the deck’s plates and the frame’s plate: at their width, the scale a transform');
  assert.equal(CARD_IMAGE_PIXEL_RATIO * PLATE_WIDTH, 1920, 'the image: 1920 px wide');
  assert.match(c, /await downloadCardImage\(plate, name\);/, 'the image is the plate — the ref the Plate hands back — never the scaled wrapper');
  assert.match(c, /onClick=\{\(\) => downloadImage\(plateRefs\.current\[deckIndex\] \?\? null, cardImageName\(day, /);
  // 2 B — at lg and up (the layout's px-8 gutter) the deck bleeds DECK_PEEK into the gutter on each side, so the card in view is the section's own width; below lg the inset stays.
  assert.equal(DECK_BLEED_QUERY, '(min-width: 1024px)');
  assert.match(code(LAYOUT), /'max-w-7xl mx-auto w-full min-w-0 px-4 lg:px-8 py-6 sm:py-8'/, 'the layout’s gutter: 16 px, 32 px from lg — the breakpoint the query names');
  assert.match(d, /export function useDeckBleed\(\): boolean \{\n\s*const \[bleed, setBleed\] = useState\(false\);\n\s*useEffect\(\(\) => \{\n\s*const query = window\.matchMedia\(DECK_BLEED_QUERY\);\n\s*const read = \(\) => setBleed\(query\.matches\);\n\s*read\(\);\n\s*query\.addEventListener\('change', read\);\n\s*return \(\) => query\.removeEventListener\('change', read\);\n\s*\}, \[\]\);\n\s*return bleed;\n\}/, 'read on mount and on every change, never at render; nothing stored');
  assert.match(d, /style=\{\{ marginLeft: bleed \? -DECK_PEEK : 0, marginRight: bleed \? -DECK_PEEK : 0 \}\} data-day-deck /, 'the bleed: the deck’s width is measured inside the margins, so the card is the section’s width exactly');
  // R2 what sits under a card takes the card's width — one left edge and one width with the tables.
  assert.deepEqual(underStyle(true), { width: '100%', maxWidth: PLATE_WIDTH * PLATE_SCALE_MAX });
  assert.deepEqual(underStyle(false), { width: `calc(100% - ${2 * DECK_PEEK}px)`, maxWidth: PLATE_WIDTH * PLATE_SCALE_MAX });
  assert.match(c, /const bleed = useDeckBleed\(\);/);
  assert.match(c, /const under = underStyle\(bleed\);/);
  for (const [file, attr] of [[STOP_FORM, 'data-stop-form'], [JOURNAL_FORM, 'data-journal-form'], [STOP_VENDOR, 'data-stop-vendor']] as const) {
    const f = code(file);
    assert.match(f, /import \{ underStyle, useDeckBleed \} from '\.\/DayDeck';/, `${attr}: the width is the deck’s rule`);
    assert.match(f, /const bleed = useDeckBleed\(\);/, `${attr}: the regime read once, by the hook`);
    assert.match(f, new RegExp(`style=\\{underStyle\\(bleed\\)\\} ${attr}>`), `${attr} at the card’s width`);
    assert.doesNotMatch(f, /width: PLATE_WIDTH/, `${attr}: no fixed width left`);
  }
  // R4 nothing else: no width typed but the one query; the plate's width is the one constant.
  assert.doesNotMatch(d.replace(DECK_BLEED_QUERY, '') + c, /\b1280\b|\b1024\b|\b1920\b/, 'no width typed');
  assert.match(comments(DECK), /WIDTH-01 \(Alex, 2026-10-16\)/);
  assert.match(comments(RULES), /WIDTH-01 \(Alex, 2026-10-16\)/);
});

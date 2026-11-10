/**
 * PIPELINE-PAGE-01 (Alex, ruled 2026-10-30; 2026-11-08 15:11 "my holy grail"; board K) — THE 14 STEPS ON THEIR OWN PAGE.
 * The pipeline header and its fourteen steps moved whole and unchanged from the home page (Landing.tsx) to
 * src/components/landing/PipelineDeck.tsx, rendered by /how-it-works; where they stood, one door: "How it all
 * connects: the 14 steps →". Old links to a step keep opening it.
 *
 *   T1 the home page renders no deck — no deck-NN id, no 'aria-label="The pipeline"', no step state, none of the deck's
 *      own imports — and keeps what only it reads (the cost receipts, the demo modal's helper, the drift guard);
 *   T2 PipelineDeck.tsx carries the 14 section ids in DECK_STEP_IDS order, the state and the hash effect moved verbatim,
 *      every export still exported; it renders the header and fourteen collapsed steps, the header's sub from the leaf;
 *   T3 the page mounts LandingHeader, PipelineDeck and LandingFooter once each, in that order; its title and description
 *      come from the words leaf, the description the header's own sub; nothing lives under the route but the page;
 *   T4 the door left the home page (HOME-FINISH-02, 2026-11-10): no door act and no link to the 14 steps in Landing's own
 *      body — the footer's THE RECORD keeps it; the path's import stays for the old links. (Until then — the door: one
 *      cream act where the header stood (HOME-ORDER-01, 2026-11-10: directly after the MY TRIP mount —
 *      directly after the plans mount until then), one link — href PIPELINE_PATH
 *      ('/how-it-works'), words PIPELINE_DOOR, class PRIMARY_CTA — neither typed in Landing.tsx;)
 *   T5 the old links: the home page's one effect sends exactly #deck-01 … #deck-14 to /how-it-works with that hash, by
 *      window.location.replace, and nothing else;
 *   T6 public, with the security review: '/how-it-works' in PUBLIC_PATHS ('/my-trip' still last) and in GUEST_ROUTES on
 *      the line that holds '/work-with-me'; the page, the deck and the leaf carry no fetch, no /api/, no prisma, no
 *      process.env; the leaf has no imports and no directive;
 *   T7 the laws read the deck's file — the proof law's import, the kind-views law, the plan law's clause 1;
 *   T8 Built on renders on /how-it-works once — after the deck, before the footer; its marks read the page's
 *      logoAvailability; the home page renders none (BUILTON-01 (2026-11-09): it rendered on /, after the door, until it moved whole).
 * Source is read through code() and comments() only (the reader law). No clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments } from '../sourceText';
import PipelineDeck, { DECK_STEP_IDS, DECK_TODAY, NEW_PROVIDER_IS, s14Law } from '@/components/landing/PipelineDeck';
import { PIPELINE_DOOR, PIPELINE_HEADER_SUB, PIPELINE_PAGE_TITLE, PIPELINE_PATH } from '@/components/landing/pipelineWords';

Object.assign(globalThis, { React });

const LANDING = 'src/components/landing/Landing.tsx';
const DECK = 'src/components/landing/PipelineDeck.tsx';
const WORDS = 'src/components/landing/pipelineWords.ts';
const PAGE = 'src/app/how-it-works/page.tsx';
const STRIP = 'src/components/landing/BuiltOnStrip.tsx'; // BUILTON-01 (2026-11-09): Built on's own file — T8 reads it
const MIDDLEWARE = 'src/middleware.ts';
const LAW = 'scripts/assert-tool-registry.ts';

const FOURTEEN = ['deck-01', 'deck-02', 'deck-03', 'deck-04', 'deck-05', 'deck-06', 'deck-07', 'deck-08', 'deck-09', 'deck-10', 'deck-11', 'deck-12', 'deck-13', 'deck-14'];
const PLANS_MOUNT = "<PlansSection door={{ kind: 'button', onClick: () => onRequireAuth() }} />";
const HOW_TO_MOUNT = '<HowToSection onRequireAuth={onRequireAuth} />'; // HOME-BRIEF-04 (2026-11-10): the home page's offer, in the plans' seat
const MY_TRIP_MOUNT = '<WasHereSection today={today} />'; // HOME-ORDER-01 (2026-11-10): the door's upper neighbour
// HOME-FINISH-02 (2026-11-10): the door left the home page, and its two pins left this file with it — DOOR_OPEN ('<section aria-label="How it all
// connects" className="max-w-7xl mx-auto px-4 lg:px-8 py-9 border-b border-border">') and DOOR_LINK ('<Link href={PIPELINE_PATH}
// className={PRIMARY_CTA}>{PIPELINE_DOOR}</Link>').
const FOOTER_MOUNT = '<LandingFooter />';
const BUILT_ON_OPEN = '<section className="w-full border-y border-border bg-bg-terminal">';
/** code() blanks a JSX comment's words and keeps its braces — the guest law's own allowance. */
const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;
const count = (hay: string, needle: string): number => hay.split(needle).length - 1;

// ── T1 · THE HOME PAGE RENDERS NO DECK ───────────────────────────────────────

test('T1 the home page renders no deck: no deck-NN id, no pipeline header, no step state, none of the deck\'s own imports — and keeps what only it reads', () => {
  const landing = code(LANDING);
  assert.doesNotMatch(landing, /deck-\d\d/, 'no deck-NN id or hash literal');
  assert.ok(!landing.includes('aria-label="The pipeline"'), 'no pipeline header');
  assert.doesNotMatch(landing, /\bopenSteps\b|\btoggleStep\b|\bDECK_TODAY\b|\bDECK\.\w|\bs14Law\b|\bNEW_PROVIDER_IS\b|\bGoldSegments\b/, 'no step state, no deck const');
  for (const gone of ["from '@/lib/problemSheet'", "from '@/lib/answers'", "from '@/lib/providers'", "from '@/lib/toolRegistry'", "from '@/lib/kindViews'", 'Fragment']) {
    assert.ok(!landing.includes(gone), `Landing.tsx no longer imports ${gone}`);
  }
  assert.match(landing, /^import \{ useEffect, useState \} from 'react';$/m, 'react: the old-links effect and the demo modal\'s flag');
  // HOME-FINISH-02 (Alex, 2026-11-10 20:56): the commission line moved inside the booking box (LandingBookingSection.tsx renders it), so its import
  // left Landing.tsx. Until then: assert.match(landing, /^import \{ COMMISSION_LINE \} from '@\/lib\/disclosureWords';\s*$/m, 'the commission
  // import, whole, alone on its line now').
  assert.ok(!landing.includes('disclosureWords'), 'the commission import left with the line — the box reads the leaf now');
  // what only the home page reads stays there, exported as before
  for (const kept of ['export const REFERENCED_MARKS: Set<string> = (() => {', 'export const ZERO_COST_BY_MODULE: Record<string, string> = ', 'export function ModuleCostBreakdown(', 'function DimCell(', 'function youTubeEmbedUrl(', 'walkthrough ledger drift:']) {
    assert.equal(count(landing, kept), 1, `Landing.tsx keeps ${kept}`);
  }
  assert.doesNotMatch(code(DECK), /ModuleCostBreakdown|REFERENCED_MARKS|ZERO_COST_BY_MODULE|DimCell|youTubeEmbedUrl|WALKTHROUGH_LEDGER/, 'the deck reads none of them');
  assert.match(comments(LANDING), /PIPELINE-PAGE-01 \(Alex, ruled 2026-10-30; 2026-11-08 15:11\): the pipeline header and 01–14 left this file for\n \* src\/components\/landing\/PipelineDeck\.tsx, rendered by \/how-it-works/);
});

// ── T2 · THE DECK'S OWN FILE ─────────────────────────────────────────────────

test('T2 PipelineDeck.tsx: the 14 ids in DECK_STEP_IDS order, the state and the hash effect verbatim, every export still exported; it renders the header and fourteen collapsed steps', () => {
  const deck = code(DECK);
  assert.match(deck, /^'use client';/, 'a client module — it holds the state');
  assert.deepEqual([...DECK_STEP_IDS], FOURTEEN, 'DECK_STEP_IDS: the fourteen, in order');
  assert.deepEqual([...deck.matchAll(/<section id="(deck-\d\d)"/g)].map((m) => m[1]), [...DECK_STEP_IDS], 'the sections, in DECK_STEP_IDS order');
  assert.deepEqual([...deck.matchAll(/<div id="(deck-\d\d)-body"/g)].map((m) => m[1]), [...DECK_STEP_IDS], 'each step\'s body, in the same order');
  assert.equal(count(deck, '<section aria-label="The pipeline"'), 1, 'the header, once');
  assert.ok(deck.indexOf('<section aria-label="The pipeline"') < deck.indexOf('<section id="deck-01"'), 'the header over 01');
  // the state and the hash effect, moved verbatim
  for (const line of [
    'const [openSteps, setOpenSteps] = useState<boolean[]>(() => DECK_STEP_IDS.map(() => false));',
    'const target = (DECK_STEP_IDS as readonly string[]).indexOf(window.location.hash.slice(1));',
    'if (target >= 0) setOpenSteps((prev) => prev.map((open, i) => (i === target ? true : open)));',
    'setOpenSteps((prev) => prev.map((open, i) => (i === index ? !open : open)));',
  ]) assert.equal(count(deck, line), 1, line);
  assert.equal(count(deck, 'export default function PipelineDeck() {'), 1);
  // every export still exported, and the one new one
  assert.equal(typeof s14Law, 'function');
  assert.deepEqual(s14Law({ throwOnFail: false }), [], 'the proof law holds from its new address');
  assert.equal(typeof NEW_PROVIDER_IS, 'string');
  assert.equal(typeof DECK_TODAY.s08, 'string');
  assert.match(code(WORDS), /^export const DECK_STEP_IDS = \[$/m, 'defined in the words leaf — the home page\'s old-links effect reads it there'); // BUILTON-01 (2026-11-09): moved from the deck to pipelineWords.ts
  assert.match(deck, /^import \{ DECK_STEP_IDS, PIPELINE_HEADER_SUB \} from '\.\/pipelineWords';$/m); // BUILTON-01 (2026-11-09): the deck's re-export —
  assert.match(deck, /^export \{ DECK_STEP_IDS \};$/m, 'still exported from the deck'); // every import of it from the deck keeps working
  // the header's sub renders from the leaf, word for word
  assert.equal(count(deck, '{PIPELINE_HEADER_SUB}'), 1);
  assert.ok(!deck.includes(PIPELINE_HEADER_SUB), 'the sentence is not typed in the deck');
  const html = renderToStaticMarkup(React.createElement(PipelineDeck));
  assert.ok(html.startsWith('<section aria-label="The pipeline"'), 'the page\'s first act is the header');
  assert.ok(html.includes(`<p class="mt-[22px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">${PIPELINE_HEADER_SUB}</p>`), 'the sub, in the header\'s own class');
  for (const words of ['THE PIPELINE — 14 STEPS', 'DATE · TIME · MONEY', DECK_TODAY.intro]) assert.equal(count(html, words), 1, words);
  assert.deepEqual([...html.matchAll(/<section id="(deck-\d\d)"/g)].map((m) => m[1]), FOURTEEN, 'fourteen steps, in order');
  assert.equal(count(html, ' class="hidden"'), 14, 'all fourteen collapsed on first paint');
});

// ── T3 · THE PAGE ────────────────────────────────────────────────────────────

test('T3 /how-it-works mounts LandingHeader, PipelineDeck and LandingFooter once each, in order; its title and description from the leaf; nothing under the route but the page', () => {
  const page = code(PAGE);
  const at = (s: string): number => { assert.equal(count(page, s), 1, `${s} once`); return page.indexOf(s); };
  const order = ['<LandingHeader />', '<PipelineDeck />', '<LandingFooter />'].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'header → the deck → footer');
  assert.match(page, /export const metadata: Metadata = \{\n {2}title: PIPELINE_PAGE_TITLE,\n {2}description: PIPELINE_HEADER_SUB,\n\};/);
  assert.equal(PIPELINE_PAGE_TITLE, 'How it all connects — the 14 steps | Temple Stuart');
  assert.doesNotMatch(page, /'use client'|generateMetadata|dynamic =|revalidate/, 'a static server page');
  assert.deepEqual(readdirSync(resolve(process.cwd(), 'src/app/how-it-works')), ['page.tsx'], 'no route handler, no layout — the page alone');
});

// ── T4 · THE DOOR ────────────────────────────────────────────────────────────

test('T4 the door left the home page (HOME-FINISH-02, 2026-11-10): no door act and no link to the 14 steps in Landing\'s own body — the footer\'s THE RECORD keeps it; MY TRIP is the last act over the footer; the path\'s import stays for the old links', () => {
  // HOME-FINISH-02 (Alex's layout ends at Our Story; the chat's pick, shown to him at 21:25 on 2026-11-10). Until then this test read 'T4 the door:
  // one cream act directly after MY TRIP (HOME-ORDER-01, 2026-11-10), one link — PIPELINE_PATH, PIPELINE_DOOR, PRIMARY_CTA — none of it typed in
  // Landing.tsx': DOOR_OPEN once ('the act, once, in the house idiom'), DOOR_LINK once and alone inside it ('the act holds the one link and nothing
  // else'), 'my trip → the door: a comment between, nothing else', and the import "import { PIPELINE_DOOR, PIPELINE_PATH } from './pipelineWords';".
  // (HOME-ORDER-01, 2026-11-10: MY TRIP sat directly above the door; the plans mount did until then. HOME-BRIEF-04, 2026-11-10: the plans mount
  // left the home page and the how-to took its seat.)
  const landing = code(LANDING);
  assert.equal(PIPELINE_PATH, '/how-it-works');
  assert.equal(PIPELINE_DOOR, 'How it all connects: the 14 steps →', 'the leaf\'s words stand — pipelineWords.ts is untouched');
  assert.equal(count(landing, 'aria-label="How it all connects"'), 0, 'no door act on the home page');
  assert.ok(!landing.includes('PIPELINE_DOOR'), 'Landing reads the door\'s words no more');
  assert.equal(count(landing, 'href={PIPELINE_PATH}'), 0, 'and its own body links to the 14 steps nowhere — the footer does');
  assert.match(landing, /^import \{ PIPELINE_PATH \} from '\.\/pipelineWords';$/m, 'the path stays: the old #deck-NN links still redirect (T5)');
  assert.equal(landing.indexOf(PLANS_MOUNT), -1, 'the plans mount is gone from this page');
  const offer = landing.indexOf(HOW_TO_MOUNT);
  const myTrip = landing.indexOf(MY_TRIP_MOUNT);
  const footer = landing.indexOf(FOOTER_MOUNT);
  assert.ok(offer > -1 && myTrip > offer && footer > myTrip, 'the how-to → MY TRIP → the footer');
  assert.ok(!landing.slice(myTrip + MY_TRIP_MOUNT.length, footer).includes('<section'), 'MY TRIP is the last act: no section between it and the footer');
  assert.ok(!landing.includes("'/how-it-works'") && !landing.includes('How it all connects:'), 'the path and the words live in the leaf');
  assert.match(comments(LANDING), / \* {3}HOW IT ALL CONNECTS — the door to the 14 steps \(PIPELINE-PAGE-01, 2026-11-09: in the seat THE PIPELINE header held/, 'the act list\'s line, in place, dated');
  assert.match(comments(LANDING), / \* {3}\(HOME-FINISH-02, 2026-11-10: that door left this page with its act — the footer's THE RECORD keeps it/, 'and under it, dated: it left');
});

// ── T5 · THE OLD LINKS ───────────────────────────────────────────────────────

test('T5 the old links: the home page\'s one effect sends exactly #deck-01 … #deck-14 to /how-it-works with that hash, by replace, and nothing else', () => {
  const landing = code(LANDING);
  assert.equal(count(landing, 'useEffect('), 1, 'one effect on the home page');
  assert.equal(count(landing, 'window.location.replace('), 1, 'one replace');
  assert.ok(landing.includes([
    '  useEffect(() => {',
    '    const hash = window.location.hash.slice(1);',
    '    if ((DECK_STEP_IDS as readonly string[]).includes(hash)) window.location.replace(`${PIPELINE_PATH}#${hash}`);',
    '  }, []);',
  ].join('\n')), 'the effect, whole: a step hash or nothing');
  assert.match(landing, /^import \{ DECK_STEP_IDS \} from '\.\/pipelineWords';$/m, 'the ids from the words leaf — never retyped'); // BUILTON-01 (2026-11-09): from the leaf, not the deck's file
  // The decision the pinned line makes, over the ids it reads: exactly the fourteen, each to its own hash on the page.
  const sentTo = (hash: string): string | null => ((DECK_STEP_IDS as readonly string[]).includes(hash) ? `${PIPELINE_PATH}#${hash}` : null);
  for (const id of FOURTEEN) assert.equal(sentTo(id), `/how-it-works#${id}`, `#${id}`);
  for (const other of ['', 'deck-00', 'deck-15', 'deck-5', 'DECK-05', 'deck-05-body', 'demo', 'events', 'stop-0', 'my-trip', 'modules']) assert.equal(sentTo(other), null, `#${other} stays`);
  // and on the new page the deck's own effect opens the step the hash names (T2's moved lines)
  assert.match(comments(LANDING), /a redirect\n\s+\/\/ for a moved page — no data path, no default, nothing chosen for the visitor\. Any other hash/);
});

// ── T6 · PUBLIC, WITH THE SECURITY REVIEW ────────────────────────────────────

test('T6 public: \'/how-it-works\' in PUBLIC_PATHS (\'/my-trip\' still last) and in GUEST_ROUTES on the \'/work-with-me\' line; the page, the deck and the leaf carry no fetch, /api/, prisma or process.env', () => {
  const mw = code(MIDDLEWARE);
  const list = /const PUBLIC_PATHS = \[([\s\S]*?)\];/.exec(mw);
  assert.ok(list, 'PUBLIC_PATHS is declared');
  const paths = [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.equal(paths.filter((p) => p === '/how-it-works').length, 1, 'listed once');
  assert.equal(paths[paths.indexOf('/how-it-works') - 1], '/how-pricing-works', 'beside the other static marketing page');
  assert.equal(paths[paths.length - 1], '/my-trip', "'/my-trip' stays last (tripPost01, intakeForm01)");
  const isPublic = (pathname: string) => paths.some((p) => pathname === p || pathname.startsWith(p + '/'));
  assert.ok(isPublic('/how-it-works'));
  assert.ok(!isPublic('/how-it-worksx') && !isPublic('/how-it'), 'the entry covers the page and nothing beside it');
  assert.match(comments(MIDDLEWARE), /PIPELINE-PAGE-01 \(Alex, 2026-11-09\): \/how-it-works[\s\S]*?no route handler under\n\s+\/\/ it, no fetch, no paid API, no database read, no env read, no session read/);
  const lawLine = code(LAW).split('\n').filter((l) => l.includes("{ route: '/work-with-me', why:"));
  assert.equal(lawLine.length, 1, 'the /work-with-me line');
  // HOME-FINISH-02 (2026-11-10): the home page's own door left the page, so the why names the footer's THE RECORD — on every page that mounts the
  // footer. Until then: why: "the 14 steps — the home page's door where the deck stood (Landing.tsx, PIPELINE-PAGE-01) and the footer's THE RECORD
  // (FOOTER-01); PUBLIC_PATHS".
  assert.ok(lawLine[0].includes(`{ route: '/how-it-works', why: "the 14 steps — the footer's THE RECORD, on every page that mounts the footer (LandingFooter.tsx, FOOTER-01; HOME-FINISH-02, 2026-11-10: the home page's own door where the deck stood — Landing.tsx, PIPELINE-PAGE-01 — left the page); PUBLIC_PATHS" }`), 'GUEST_ROUTES, on that line — TRIPPOST-01\'s and CRM-02\'s way');
  for (const f of [PAGE, DECK, WORDS]) {
    const src = code(f);
    for (const tell of ['fetch(', '/api/', 'prisma', 'process.env']) assert.ok(!src.includes(tell), `${f} carries no ${tell}`);
  }
  assert.doesNotMatch(code(WORDS), /^import |'use client'/m, 'the leaf: no imports, no directive — the server page reads it');
});

// ── T7 · THE LAWS READ THE DECK'S FILE ───────────────────────────────────────

test('T7 the laws read the deck\'s file: the proof law\'s import, the kind-views law, the plan law\'s clause 1', () => {
  const law = code(LAW);
  assert.match(law, /^import \{ s14Law \} from '\.\.\/src\/components\/landing\/PipelineDeck';\s*$/m);
  assert.ok(!law.includes("from '../src/components/landing/Landing'"), 'nothing imports the home page');
  assert.match(law, /^const deckSrc = codeOf\('src\/components\/landing\/PipelineDeck\.tsx'\);\s*$/m);
  assert.match(law, /^if \(!deckSrc\.includes\('\{KIND_VIEWS_HONEST_LINE\}'\)\) violations\.push\("kind views: the deck's step 5 must render KIND_VIEWS_HONEST_LINE \(never a retyped line\)"\);$/m);
  assert.match(law, /^ {2}for \(const f of \[\.\.\.PLAN_SURFACES, 'src\/components\/landing\/PipelineDeck\.tsx'\]\) \{\s*$/m);
  assert.match(law, /\(PipelineDeck\.tsx s14Law\); a failed check is a failed build\./);
  assert.equal(count(code(DECK), '{KIND_VIEWS_HONEST_LINE}'), 1, 'step 5 renders it, in the deck\'s file');
});

// ── T8 · BUILT ON, UNDER THE 14 STEPS ────────────────────────────────────────
// BUILTON-01 (2026-11-09): re-pointed — Built on moved whole from / (after the door) to /how-it-works (after the deck, before the
// footer), in its own file; BUILT_ON_OPEN stays the strip's opening tag.

test('T8 Built on renders on /how-it-works once — after the deck, before the footer; its marks read the page\'s logoAvailability; the home page renders none', () => {
  const strip = code(STRIP);
  assert.equal(count(strip, BUILT_ON_OPEN), 1, 'the strip, once');
  assert.equal(count(strip, 'BUILT_ON.map('), 1);
  assert.match(strip, />\n\s+Built on\n\s+<\/p>/, 'its eyebrow');
  assert.match(strip, /logoAvailability\[e\.logo\.slug\] === true/, 'its marks still read logoAvailability');
  const page = code(PAGE);
  const mount = '<BuiltOnStrip logoAvailability={logoAvailability} />';
  assert.equal(count(page, mount), 1, 'mounted once');
  assert.equal(count(page, 'const logoAvailability = '), 1, 'the page computes it once');
  const deck = page.indexOf('<PipelineDeck />');
  const builtOn = page.indexOf(mount);
  const footer = page.indexOf('<LandingFooter />');
  assert.ok(deck > 0 && builtOn > deck && footer > builtOn, 'the deck → Built on → the footer');
  assert.match(page.slice(deck + '<PipelineDeck />'.length, builtOn), ONLY_COMMENTS, 'the deck → Built on: comments between, nothing else');
  const landing = code(LANDING);
  assert.equal(count(landing, BUILT_ON_OPEN), 0, 'the home page renders none');
  assert.ok(!landing.includes('BUILT_ON') && !landing.includes('logoAvailability'), 'nor reads its data');
});

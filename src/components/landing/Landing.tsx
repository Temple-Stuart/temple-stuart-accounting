'use client';

/**
 * Landing — the guest sales floor, mounted only by GuestLanding on bare '/'
 * (page.tsx branches authed arrivals to HomeClient). House Bloomberg aesthetic,
 * zero new hex; every colour is a token.
 *
 * THE ACTS, in document order:
 *   hero (full-bleed aubergine band)
 *   LIVE DEMO — TRAVEL  — travel search/booking, real and public
 *   PERSONAS            — one system · six lives, "Who is this for?"
 *                         (structure restored from bc1a6fef by
 *                         PR-PERSONAS-RESTORE; copy PR-PERSONAS-COPY; seated
 *                         here by PR-REORDER — the who-first order)
 *   [PR-MODULES placeholder — "the what", content TBD]
 *   DONE-FOR-YOU        — the professional-services panel
 *   THE PIPELINE header — names the 14-step run (essay front matter, PR-CHROME)
 *   01 / IDENTIFY THE PROBLEM — the six-source fan + the twenty-five-tool sheet
 *   02 / PICK THE PROVIDERS   — the eleven-provider roster + the open doors (PR-STEP-2)
 *   03 / IMPORT THE DATA      — the raw import table, twelve arrivals, the promises
 *   04 / LABEL THE DATA       — one rule per feed, thirteen rows, four kinds
 *   05 / MAP THE DATA TO ITS TABLE — five tables; the kind is the address
 *   06 / SEPARATE WHAT HAPPENED TO YOU FROM WHAT YOU DID — observed vs authored
 *   07 / RUN THE LOOP         — discover → decide → commit → record
 *   08 / STORE EVERYTHING YOU DO IN ONE MASTER TABLE
 *   09 / MATCH WHAT HAPPENED TO WHAT YOU DID — the deposit meets the invoice
 *   10 / LET THE RULES WRITE THE LINES
 *   11 / TURN THE LINES INTO ANSWERS
 *   12 / OPEN THE TWO WINDOWS — the Ledger and the Calendar
 *   13 / WATCH ONE DOLLAR RUN THE WHOLE MACHINE
 *   14 / PROVE EVERY NUMBER   — click any number, walk it back
 *   [PR-WHY placeholder — content TBD]
 *   Built on            — the vendor marquee
 *
 * PR-DECK: 01–13 are the pipeline deck. PR-VOICE reconciled every rendered
 * string to the common-tongue essay (temple-stuart-full-system-writeup.md,
 * NOT in this repo) — headlines/subs that stay are the deck's poster
 * compressions; everything else is essay-verbatim, '(N) ' prefixes included.
 * Never rephrase in place — a copy change is an essay change first.
 * DECK LAW #7, SHOW DON'T ECHO: where a visual carries a piece of the essay
 * (09's cards, 10's drawn sale lines, 12's calendar), the visual IS that
 * piece — never render the same content as both drawing and text.
 * PR-COLLAPSE: each step is a disclosure —
 * header button (label + '+'/'−' glyph, the retired personas accordion's
 * shape, 5010ca1f) over a hidden-class body; all 14 collapsed by default, a
 * #deck-NN hash opens its step on load. RUST NOTE: the deck's "rust" group-label
 * colour has no token in this palette; brand-amber (#d97706) is the mapping,
 * chosen over inventing a hex. If Design lands a true rust token, swap
 * text-brand-amber across the deck in one pass.
 *
 * REVENUE FIRST, THEN THE TEACHING SEQUENCE. The two acts under the hero are
 * not slides — they are live surfaces a guest can transact on without an
 * account: travel search/booking is public (middleware.ts:70-94) and the
 * services panel takes a proposal. They carry NO step number for exactly that
 * reason; only the numbered run below them is a sequence, and its numbering
 * starts at 01 and stays contiguous. Do not renumber the revenue acts back in,
 * and do not number another one without deciding whether it is a step.
 *
 * ADDING A TEACHING SLIDE is a three-part edit and nothing more: the next
 * number in the run, a border-t (no NUMBERED act carries a border-b, so every
 * boundary INSIDE the run is closed by the lower section — but see the seam
 * ledger in the problem act for the one exception, 01 itself, which carries no
 * border at all), and its data as module-scope consts beside the others. 04 / THE
 * ROUTING was added that way — three consts, one border-t — and 05 / THE
 * HANDOFF after it with one const and one border-t. Neither changed an
 * existing border.
 *
 * MODULES-RETIRED (6a439eaf). The nine-module deck — pillar cards, the
 * nine-row module sheet, the segment control, the personas rail and the
 * merged '02 / THE NINE MODULES' stage that replaced them all — was DELETED.
 * It was built on a superseded model and a teaching sequence replaces it. Gone
 * with it: DECK_CATEGORIES, PILLAR_CARDS, REPLACED_APPS, FAMILY_OFFSETS,
 * FRAME_LINKS, GROUP_RATIONALE, the whole stage/autoplay state machine, and
 * the lucide + GLIMPSES imports that served only them. Do not reconstruct any
 * of it from this comment; read the git history instead.
 * PERSONAS-RESTORED (PR-PERSONAS-RESTORE): the personas rail alone came BACK
 * from bc1a6fef (the last commit that carried it — 6a439eaf's parent): the
 * PERSONAS const, the openPersona accordion state, and the ACT 2 block,
 * remounted between DONE-FOR-YOU and the pipeline header with exactly one
 * adaptation — its historical border-t became border-b for the new seat
 * (see the seam ledger); PR-REORDER later moved the act ABOVE done-for-you
 * for the who-first order, its border-b travelling with it. GROUP_RATIONALE stays dead: only the deleted stage
 * ever rendered it. PERSONAS-COPY (PR-PERSONAS-COPY) then rewrote the six
 * rows and the act label to the 13-step vocabulary per the 2026-08 persona
 * research pack — the STRUCTURE is still bc1a6fef's; the historical copy
 * lives in git history.
 *
 * id="modules" lives on the LIVE DEMO — TRAVEL section, and rode that
 * section's move up the page. It is a commerce contract, not decoration: the
 * Stripe checkout
 * cancel_url, the /pricing 308 redirect, the module page's Select link and the
 * shopping View Plans button all resolve to it. Moving or dropping it breaks
 * the buy path — see the ANCHOR-REHOME note on that section.
 *
 * WHAT THE DECK'S RETIREMENT DID NOT SETTLE: six other files still describe
 * this page as THE pricing surface (ModulePageClient.tsx:19,33 ·
 * pricingModel.ts:3 · pricing-costs.ts:329 · tiers.ts:6 · app/page.tsx:35 ·
 * AppLayout.tsx:60). With the deck gone that claim has no surface behind it.
 * Reported, deliberately NOT fixed here — what replaces it is a product
 * decision, not a cleanup.
 *
 * STILL TRUE FROM THE FD-1d SPLIT: header/footer are extracted to
 * LandingHeader/LandingFooter (shared with the /modules pages) and the CPA
 * disclaimer rides the shared footer; descriptors import from the ONE source
 * (src/lib/tabDescriptors.ts).
 *
 * PRESERVED UNMOUNTED, exported, consumed by HPW-1 — not dead by accident:
 * ModuleCostBreakdown + helpers, REFERENCED_MARKS, ZERO_COST_BY_MODULE.
 * transparencyLedger is untouched. The demo modal is preserved the same way
 * but is currently UNREACHABLE — its only opener died with the deck; see the
 * showDemo declaration.
 */

import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
// MODULES-RETIRED: the lucide category icons left with DECK_CATEGORIES, and
// GLIMPSES left with the stage — the merged modules section was their only
// consumer. The TAB_PRICING import had already retired with the Act-4 bundle
// bar; the pricing surface is /how-pricing-works until buy affordances return.
//
// PIPE_PHASES AND WALKTHROUGH_LEDGER STAY, and are NOT dead. The landing no
// longer renders either — the step rail that read them is gone — but the
// module-scope assert directly below still consults both, and it is the only
// thing in the repo that fails loud when pipePhases.ts and walkthroughLedger.ts
// drift out of lockstep. Removing these two imports would delete that guard by
// accident. PipePhase went with the stage's phase array; PipePillarId stays
// because the assert keys on it.
import { PIPE_PHASES, type PipePillarId } from '@/lib/pipePhases';
import { WALKTHROUGH_LEDGER } from '@/lib/walkthroughLedger';

if (process.env.NODE_ENV !== 'production') {
  for (const pid of Object.keys(PIPE_PHASES) as PipePillarId[]) {
    if (PIPE_PHASES[pid].length !== WALKTHROUGH_LEDGER[pid].steps.length) {
      throw new Error(`walkthrough ledger drift: ${pid} has ${PIPE_PHASES[pid].length} phases but ${WALKTHROUGH_LEDGER[pid].steps.length} ledger steps`);
    }
  }
}
import {
  ALLOCATION_ROWS, NO_COST_STRIP,
  ENTITY_DIM, ACCOUNT_DIM, SUB_DIM, OBJECT_DIM, VENDOR_DIM,
  type ScheduleAllocationRow,
} from '@/config/transparencyLedger';
// LANDING-V4: the TAB_DESCRIPTORS import retired with the summary slides'
// prose — the descriptor strings still render on /modules/<id>.
import { DEMO_VIDEO_URL } from '@/config/demoVideo';
// PR-ELEV-2d: the Built-on wall data + per-vendor logo rules live in the
// server-safe leaf (page.tsx fs-checks the same entries' logo files).
// BUILTON-MARQUEE: WALL_SECTIONS retired with the category blocks — the
// marquee flattens BUILT_ON's own (already category-ordered) run.
import { BUILT_ON } from '@/lib/builtOnWall';

/** LOBBY-DECK-1b: a YouTube watch/short URL → its /embed/ form for the modal
 *  iframe. Anything else (e.g. a plain file URL) returns null and plays via a
 *  native <video> tag instead — both URL kinds Alex may set are covered. */
function youTubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

/** FD-1f v3: a stacked CODE + MEANING cell — the schedule teaches the taxonomy. */
function DimCell({ code, label }: { code: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-xs text-white whitespace-nowrap">{code}</div>
      <div className="text-[10px] leading-tight text-white/50">{label}</div>
    </div>
  );
}
import dynamic from 'next/dynamic';
import LandingHeader from './LandingHeader';
import LandingFooter from './LandingFooter';
// BOOK-1: the live booking section (the REAL PublicFlightSearch +
// PublicHotelSearch), lazy-mounted (the FD-1 next/dynamic precedent) so the
// guest first paint stays light — the search stack's chunk loads after, and
// CountryCityPicker's mount fetch fires only then. This REPLACES the
// LAND-SEARCH-1 teaser: the mounted components' own controls ARE the
// landing's search controls (zero duplicated search UIs — the ruled
// conversion shape), so the teaser and its ls* prefill handoff died.
// TOGGLE-1 mounts it INSIDE the hero, where the teaser sat.
// BOOK-3: the session-trip strip (guest-only by construction — Landing renders
// only on the FD-2 verified-guest branch).
import GuestTripStrip from './GuestTripStrip';
// PR-ELEV-1: the coming-soon tiles became badged "Soon" chips INSIDE the
// booking strip (travelStripModes) — the separate tile row is gone.

// TOGGLE-1: the section is now ONE toggle strip mounted INSIDE the hero
// (where the LAND-SEARCH-1 teaser sat, pre-BOOK-1 Landing.tsx:325-328), so
// the loading fallback is the same strip shape in the same spot.
const LandingBookingSection = dynamic(() => import('./LandingBookingSection'), {
  ssr: false,
  loading: () => (
    <div className="mt-8 rounded-lg border border-white/20 bg-white/5 p-4 text-sm text-white/50">
      Loading live searches…
    </div>
  ),
});

// PROBLEM-DIAGRAM: the six kinds of places money lives, for the 01 / THE
// PROBLEM diagram. ONE array because the diagram renders its labels TWICE —
// once per breakpoint SVG, each at its own absolute offsets — and the same
// six strings typed twice is exactly the drift the no-drift law forbids.
// Stored in sentence case; the mono lockup uppercases via CSS, never a
// retyped string. These six were deliberately never a shared symbol with the
// retired REPLACED_APPS family names, which grouped the apps you replace where
// this names where money lives; that array died with the modules section and
// this one is now the sole owner of the vocabulary.
const PROBLEM_SOURCES = [
  'The Work',
  'Money In',
  'Money Out',
  'What You Own',
  'What You Owe',
  'The Proof',
] as const;

// PROBLEM-SHEET: the twenty-five tools those six places actually take, one
// column per PROBLEM_SOURCES entry and ORDER-PARALLEL to it — index i here is
// the sheet column belonging to fan label i. Shape: six { header, tools }.
//
// THE HEADERS ARE ABBREVIATED ON PURPOSE and deliberately do NOT match
// PROBLEM_SOURCES. The fan's HTML labels on the left carry the full names
// ('What You Own'); these are the tab names a person would actually type
// across the top of a spreadsheet ('OWN'). That mismatch IS the drawing — the
// left column names the place, the sheet names the tab. Do not "fix" either
// side to the other; squaring them would flatten the whole point of the figure.
//
// THE COLUMNS ARE DELIBERATELY UNEQUAL — 3 / 4 / 6 / 5 / 3 / 4, twenty-five in
// total. The ragged bottom is honest: some kinds of places take six tools and
// some take three. NEVER pad a column to square the grid — the empty cells are
// the finding, not a rendering defect.
//
// SOLE OWNER of the twenty-five, as of the modules retirement. This was
// deliberately never coupled to the retired REPLACED_APPS — the same reasoning
// as PROBLEM_SOURCES above — and that decision is why the deck could be deleted
// without touching a line of this slide. Keep it uncoupled: a future module
// list is a different question from what a business is replacing.
const PROBLEM_SHEET = [
  { header: 'WORK', tools: ['Calendar', 'Tasks', 'Time'] },
  { header: 'IN', tools: ['CRM', 'Contracts', 'Invoicing', 'Payments'] },
  { header: 'OUT', tools: ['Bill Pay', 'Payroll', 'Expenses', 'Travel', 'Mileage', 'Budget'] },
  { header: 'OWN', tools: ['Banking', 'Fixed Assets', 'Retirement', 'Brokerage', 'Trade Log'] },
  { header: 'OWE', tools: ['Debt', 'Sales Tax', 'Ent Filings'] },
  { header: 'PROOF', tools: ['Bookkeeping', 'Tax', 'Compliance', 'FP&A'] },
] as const;

// PROBLEM-SHEET / MOBILE SPLIT: six 56px columns cannot fit a 280px viewBox, so
// the phone draws TWO stacked grids of three columns instead of one of six.
// DERIVED BY SLICE from PROBLEM_SHEET, never a retyped second copy of the tool
// names (the no-drift law) — and each grid is paired here with its own `top` so
// the split and its geometry can only move together. `top` is the y of that
// grid's outer rect; EVERY other coordinate in the mobile sheet is computed
// from it (header rule top+30, interior rules top+50..top+130 by 20, header
// baseline top+18, data baselines top+43 by 20). Grid A keeps the original
// grid's y=230 so the dashed fan's convergence point is untouched; Grid B sits
// 30px below A's bottom edge.
const PROBLEM_SHEET_SM = [
  { top: 230, cols: PROBLEM_SHEET.slice(0, 3) },
  { top: 410, cols: PROBLEM_SHEET.slice(3) },
] as const;

// PROBLEM-CAPTION: the line that sits under the sheet. It is rendered TWICE —
// on desktop INSIDE the sheet column, so it inherits the table's left edge,
// and on mobile under the stacked grids — so the string lives here once
// rather than being typed twice (the no-drift law). PR-D1 collapsed the old
// A SPREADSHEET kicker + note pair into one sentence; PR-VOICE swapped that
// sentence for the essay's full one, verbatim. CAPTION-ANCHOR: the
// caption used to be a lone <p> child of the section with no left offset at
// all, so it began at the page margin while A SPREADSHEET faked its alignment
// with a pl-[560px] hand-copied from the sheet's rect x. Both magic numbers
// are gone: on desktop the caption is simply a child of the column the table
// fills.
const PROBLEM_SHEET_CAPTION = 'So today, to see your full picture, you copy numbers out of each one into a spreadsheet and connect them by hand; and that spreadsheet is only as current as the last time you typed into it.';

// PR-STEP2-VIZ: PROVIDER_ROSTER + PROVIDER_DOORS retired — SHOW DON'T ECHO
// (Deck Law #7): the provider menu below carries the eleven providers AND
// the open doors in one drawing, so the eleven-line roster and the doors
// gloss died as text. The offerings sentence died with them — its one fact
// the table cannot draw (the SnapTrade connector) survives as the table's
// footnote, essay verbatim. The essay's Step 2 line (11) took the three-AIs
// wording in the same breath. The retired strings live in git history.

// PROVIDER-MENU (PR-STEP2-VIZ): the 02 / PICK THE PROVIDERS visual, as
// [job, today, next] — eleven jobs, who feeds each today, which doors are
// already open for later. Rows are the essay's Step 2 list restated as
// jobs, same order. '—' is deck content — a job with no open door yet —
// and renders in the faint tier; never fill it. A new provider is one cell
// edit here (a provider is just rows in a table — added, never built).
const PROVIDER_MENU = [
  ['banks & accounts', 'plaid', 'teller'],
  ['card money', 'stripe', 'square'],
  ['trades & market data', 'tastytrade', 'schwab · ibkr · alpaca · tradier · snaptrade'],
  ['flights', 'duffel', 'amadeus'],
  ['hotels', 'liteapi', 'amadeus'],
  ['activities', 'viator', '—'],
  ['locations', 'google places', '—'],
  ['company numbers', 'finnhub', 'polygon'],
  ['the economy', 'fred', '—'],
  ['filings', 'sec', '—'],
  ['our AI', 'anthropic · openai · xai grok', '—'],
] as const;

// IMPORT-COLUMNS (PR-DECK): the field table of the 03 / THE IMPORT slide,
// reconciled to the deck's plain-language vocabulary (provider · connection ·
// resource · their id · our id · payload · fingerprint · asked · arrived ·
// read · status). Four rust-labelled bands, each row a [name, desc] pair —
// the deck gives each field ONE description, so the old holds/why split is
// gone. Order is the reading order of the slide and carries the argument;
// never sort or regroup for tidiness.
//
// PR-VOICE: every gloss is the essay's own wording — the timing rows carry
// the essay's 'when we asked / when it arrived / when we read it'.
//
// THE PAYLOAD ROW carries the slide's emphasis as a third tuple slot: the
// shouted tail of its description renders in the deck's rust (brand-amber),
// per the token note in the header comment. The caps ARE the copy.
const IMPORT_COLUMNS: ReadonlyArray<{ band: string; rows: ReadonlyArray<readonly string[]> }> = [
  {
    band: 'WHERE IT CAME FROM',
    rows: [
      ['provider', 'stripe · plaid · sec · fred — which company sent it'],
      ['connection', 'because you might have two or more banks'],
    ],
  },
  {
    band: 'WHAT IT IS',
    rows: [
      ['resource', 'their own word: payout · transaction · quote'],
      ['their id', 'so we tie the row back to the provider and never import the same thing twice'],
      ['our id', 'two providers could accidentally use the same id'],
    ],
  },
  {
    band: 'WHAT THEY ACTUALLY SENT',
    rows: [
      ['payload', 'saved word for word — ', 'THE REASON THIS TABLE EXISTS'],
      ['fingerprint', 'a code made from the payload — proves we never changed it'],
    ],
  },
  {
    band: 'WHEN AND HOW FAR',
    rows: [
      ['asked', 'when we asked'],
      ['arrived', 'when it arrived'],
      ['read', 'when we read it'],
      ['status', 'pending, done, or failed'],
    ],
  },
];

// IMPORT-ARRIVALS (PR-STEP-2): twelve rows that landed, ONE PER SPEAKING
// PROVIDER, as [provider·connection, resource, received, status] — the same
// eleven providers Step 02's menu speaks to today, in the menu's row order
// (its TODAY column; PR-STEP2-VIZ retired the roster). Plaid rows
// TWICE with two different connections (chase / boa) because that is the
// deck's own teaching — 'because you might have two or more banks' — and
// only plaid renders a connection: the others have one, so the cell is just
// the provider. The old external_id column left with the fifth column; the
// two name tags stay taught in the field table above. Times are invented
// display data consistent with the original four (stripe/plaid/tastytrade/sec
// keep the times they always showed); statuses are all DONE except sec — the
// one arrival still in flight, and the renderer inks PENDING in the deck's
// rust.
const IMPORT_ARRIVALS = [
  ['plaid · chase', 'transaction', '09:14:06Z', 'DONE'],
  ['plaid · boa', 'transaction', '09:14:09Z', 'DONE'],
  ['stripe', 'payout', '09:14:02Z', 'DONE'],
  ['tastytrade', 'quote', '10:31:00Z', 'DONE'],
  ['duffel', 'booking', '10:33:27Z', 'DONE'],
  ['liteapi', 'stay', '10:36:44Z', 'DONE'],
  ['viator', 'activity', '10:39:12Z', 'DONE'],
  ['google places', 'place', '10:42:58Z', 'DONE'],
  ['finnhub', 'fundamentals', '10:47:31Z', 'DONE'],
  ['fred', 'series', '10:53:20Z', 'DONE'],
  ['sec', 'filing', '11:02:44Z', 'PENDING'],
  ['anthropic', 'classification', '11:15:09Z', 'DONE'],
] as const;

// ROUTING-RULES (PR-DECK → PR-STEP-2): the whole routing decision, for the
// 04 / THE ROUTING slide, as [provider, resource, kind, means]. THIRTEEN ROWS
// — the eleven providers Step 02 names, four kinds, providers repeating
// because a feed sends more than one shape. The MEANS column speaks only on a
// kind's FIRST appearance ('something that happened' · 'one of your accounts'
// · 'a fact about the world' · 'math we did — never a source'); the empty
// strings on repeat rows are deck content, not gaps — do not fill them.
//
// THE FOUR ROUTABLE KINDS ARE A CLOSED SET — EVENT, REGISTRY, REFERENCE,
// DERIVED. FOUR HERE, FIVE IN HANDOFF_KINDS BELOW, AND THE GAP IS THE POINT:
// nothing ever arrives as a posting — the system writes postings from events.
// Do not add a POSTING row here to make the two lists match.
//
// THE anthropic ROW IS THE POINT and the renderer keys off its provider name,
// not a flag here, so this stays plain data. Its means is the deck's warning
// — a classification is math we did, never a source another table trusts.
const ROUTING_RULES = [
  ['stripe', 'payout', 'EVENT', 'something that happened'],
  ['plaid', 'transaction', 'EVENT', ''],
  ['plaid', 'account', 'REGISTRY', 'one of your accounts'],
  ['tastytrade', 'quote', 'REFERENCE', 'a fact about the world'],
  ['tastytrade', 'fill', 'EVENT', ''],
  ['sec', 'filing', 'REFERENCE', ''],
  ['fred', 'series', 'REFERENCE', ''],
  ['duffel', 'booking', 'EVENT', ''],
  ['liteapi', 'stay', 'EVENT', ''],
  ['viator', 'activity', 'EVENT', ''],
  ['google places', 'place', 'REFERENCE', ''],
  ['finnhub', 'fundamentals', 'REFERENCE', ''],
  ['anthropic', 'classification', 'DERIVED', 'math we did — never a source'],
] as const;

// The provider whose row the routing table fills. Named here rather than typed
// into the renderer so the emphasis and the data cannot drift apart.
const ROUTING_DERIVED_ROW = 'anthropic';

// PR-DECK: ROUTING_TESTS retired — the deck's 04 closes on one statement line
// ('When a new provider shows up, we add rows — not code, and not new
// tables.') typed at the render, not a trio. The three tests live in git
// history if a surface ever wants them back.

// HANDOFF-KINDS (PR-DECK): the five tables a kind can address, for the
// 05 / THE HANDOFF slide, as [kind, holds]. The deck writes the kinds
// lowercase here — on 04 they are addresses, not shouted vocabulary — and
// collapses the old kind/table pair into one word, since the kind IS the
// table name. Kind words are the one non-money place gold is allowed.
//
// FIVE KINDS HERE, FOUR IN ROUTING_RULES, AND THAT IS CORRECT — nothing ever
// ARRIVES as a posting: postings are what the system writes from events. The
// deck's notice block under the table says exactly this on screen.
//
// ORDER IS THE ARGUMENT, not the alphabet: world data first (reference), then
// who you are (registry), then what happened (event), then what that did to
// the money (posting), then what you concluded (derived).
//
// NO ROW IS EMPHASISED, deliberately — the five kinds are peers.
const HANDOFF_KINDS = [
  ['reference', 'facts about the world'],
  ['registry', 'your accounts and your people'],
  ['event', 'what happened'],
  ['posting', 'debits and credits'],
  ['derived', 'math we did'],
] as const;

// PR-VOICE: the import slide's closing list — the essay's three numbered
// promises, verbatim, rendered under the 'This table is to show us that:'
// framing line. The '(N) ' prefixes are content (the essay's own
// enumeration), not styling.
const IMPORT_TRIO = [
  '(1) Nothing was ever edited; if a provider corrects something, the correction is a new row.',
  '(2) Nothing was ever asked twice; if our reading of a row fails, we just read our stored copy again.',
  "(3) Nothing was ever claimed; the fingerprint proves we stored exactly what they sent, but that doesn't necessarily mean they were right!",
] as const;

// ─────────────────────────────────────────────────────────────────────────
// PR-DECK 05–13: the deck's back nine, all data module-scope per the house
// convention. Every string VERBATIM from the approved deck copy. Where a
// string carries inline gold (dollar amounts, debit/credit values — the only
// things gold may ink besides kind words), it is stored PRE-SPLIT as
// [text, isGold] segment pairs; the break points are the deck's, not
// punctuation-derived.
// ─────────────────────────────────────────────────────────────────────────

// DECK-06 (PR-VOICE → PR-LANES): the observed and authored columns, each a
// rust header over the essay's own sentences — one <p> per line, in the
// column's prose tier. (The const keeps its historical LANE_COLUMNS name —
// the lane metaphor died as rendered copy in PR-LANES; the identifier is
// code, not copy.) AUTHORED's last
// three lines are the essay's framing + (1)(2) draft/commit enumeration; the
// '(N) ' prefixes are content, not styling.
const LANE_COLUMNS = [
  {
    header: 'OBSERVED',
    lines: [
      'Look at everything we imported so far: deposits, charges, fills, quotes. (A fill is the broker saying your trade happened.)',
      'All of it happened TO you. The world told you, and it arrived finished. You can never edit the past. We call these observed.',
    ],
  },
  {
    header: 'AUTHORED',
    lines: [
      'But running a business is not just watching! You book flights. You send invoices. You place trades. You file paperwork. These are things YOU make happen. We call these authored.',
      'An authored thing does not arrive finished:',
      '(1) It starts as a draft.',
      '(2) It becomes real only when you commit; you pull the trigger, and the outside world moves.',
    ],
  },
] as const;

// DECK-07 (PR-VOICE): the four beats of the loop band, [beat, caption] —
// captions are the essay's own beat lines, chains gloss inline. Punctuation
// is the essay's.
const LOOP_BEATS = [
  ['DISCOVER', 'look at your options. Live flight prices. Option chains (the menu of trades you could make). The invoices coming due.'],
  ['DECIDE', 'pick one. The pick becomes a draft; a cart, a trade card, a draft invoice.'],
  ['COMMIT', 'pull the trigger. The flight books and a confirmation code comes back. The order goes to the broker. Invoice #14 goes out the door.'],
  ['RECORD', 'it is written down forever.'],
] as const;

// DECK-07: the three-tool loop table, [beat, travel, trading, invoicing].
const LOOP_ROWS = [
  ['DISCOVER', 'live flight prices', 'option chains', 'invoices coming due'],
  ['DECIDE', 'a cart', 'a trade card', 'a draft invoice'],
  ['COMMIT', 'the flight books, a confirmation code comes back', 'the order goes to the broker', 'invoice #14 goes out the door'],
  ['RECORD', 'booking recorded', 'order recorded', 'invoice recorded'],
] as const;

// DECK-08 (PR-VOICE): the four things every document carries, [name, desc] —
// the essay's (1)–(4) items, split at the essay's own semicolon so the
// column gap plays the semicolon (the same arrangement every two-column
// row in this deck uses). Item (4) has no tail in the essay, so its desc is
// empty — content, not a gap.
const MASTER_ROWS = [
  ['(1) What it is', 'a booking, an invoice, a trade.'],
  ['(2) Its life story', 'draft → committed → settled, or void, if it dies.'],
  ['(3) Its pieces', 'the flights in a booking, the items on an invoice.'],
  ['(4) Who did it, and when.', ''],
] as const;

// DECK-09: the two match cards, [name, amount, date] — amounts gold.
const MATCH_CARDS = [
  { label: 'OBSERVED', name: 'deposit', amount: '$500.00', date: 'Sep 22' },
  { label: 'AUTHORED', name: 'invoice #14', amount: '$500.00', date: 'due Sep 22' },
] as const;

// DECK-10: the posting rules, [event, debit, credit] — debit/credit values
// gold at the render.
const POSTING_RULES = [
  ['invoice issued', 'A/R', 'Revenue'],
  ['payment received', 'Cash', 'A/R'],
  ['stripe payout', 'Cash + Fees', 'Clearing'],
  ['bill paid', 'A/P', 'Cash'],
  ['payroll run', 'Wages + employer taxes', 'Cash + withholdings'],
] as const;

// DECK-10 (PR-VOICE): the worked sale — the essay's 'Now watch it work'
// sentence introduces the three drawn lines, which render ONCE with the
// essay's (1)(2)(3) prefixes (Deck Law #7, show don't echo — no separate
// text list). Sentence segments are [text, isGold]; lines are
// [account, amount].
const SALE_SENTENCE: ReadonlyArray<readonly [string, boolean]> = [
  ['Now watch it work. One sale for ', false], ['$100.00', true],
  ['. Stripe keeps a ', false], ['$3.20', true],
  [' fee. ', false], ['$96.80', true],
  [' lands in the bank. The rule writes three lines:', false],
];
const SALE_LINES = [
  ['(1) Revenue', '100.00'],
  ['(2) Fees', '3.20'],
  ['(3) Cash', '96.80'],
] as const;

// DECK-11: four questions and their math, the math pre-split so the deck's
// money words ink gold. Row 3 has no money word and that is the deck's own
// shape, not an omission.
const ANSWER_ROWS: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, boolean]>]> = [
  ['What do I owe in tax?', [['Income', true], [' so far × the rules.', false]]],
  ['How long can I last?', [['Cash', true], [' ÷ what I burn each month.', false]]],
  ['How is my trading doing?', [['Wins, losses, and open risk; from fills, positions, and live quotes.', false]]],
  ['How is my business doing?', [['Money in', true], [' minus ', false], ['money out', true], ['.', false]]],
];

// DECK-12: the mini ledger, [date, line, debit, credit] — amounts gold, empty
// side empty. The sale's three lines ride the deck's own Sep 22 (invoice #14's
// date); the travel line rides the trip's Sep 20 start. CONSTRUCTED VALUE,
// FLAGGED: the deck names the travel line but gives it no figure — 480.00 is
// a placeholder awaiting Alex's real deck figure. Swap it here only.
const LEDGER_ROWS = [
  ['Sep 22', 'Revenue', '', '100.00'],
  ['Sep 22', 'Fees', '3.20', ''],
  ['Sep 22', 'Cash', '96.80', ''],
  ['Sep 20', 'Travel', '480.00', ''],
] as const;

// DECK-12: the two-week calendar strip. Day numbers derive from the deck's
// own dates — the trip bar (Sep 20–27) occupies the back 57.15% of 14 equal
// days, so day one is Sep 14. Geometry is Design's: bars 6px aubergine at the
// given percent offsets, dots 6px gold centred on their day column.
const CAL_DAYS = ['14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27'] as const;
const CAL_BARS = [
  { label: 'Trip — Sep 20–27', left: 42.85, width: 57.15, y: 16 },
  { label: 'Deep work — 9a–1p', left: 7.14, width: 35.7, y: 54 },
] as const;
const CAL_DOTS = [
  { label: 'Estimated tax — Sep 15', day: 2 },
  { label: 'Invoice #14 due — Sep 22', day: 9 },
] as const;
// PR-VOICE: the four deadline segments are the essay's glossed entries,
// verbatim minus the '(N) ' prefixes (the strip's gold dots are the
// joiners, so the enumeration needs no numbers).
const CAL_DEADLINES = [
  'Estimated tax — pay tax as you earn, four times a year — April 15, June 15, September 15, January 15.',
  "The S-corp return — the business's own tax form — March 16.",
  '1099s and W-2s — the forms that say who got paid what — February 2.',
  'The extended 1040 — your personal tax form, on its extension date — October 15.',
] as const;

// DECK-13: the hero thread — eight beats of one $500 sale, [n, action,
// artifactSegments]. Debit/credit values and amounts gold via the segments.
const THREAD_ROWS: ReadonlyArray<readonly [string, string, ReadonlyArray<readonly [string, boolean]>]> = [
  ['1', 'You sign a client', [['the contract lands in registry.', false]]],
  ['2', 'The obligation comes due', [['a draft invoice appears.', false]]],
  ['3', 'You send invoice #14; commit!', [['A rule writes: debit ', false], ['A/R 500.00', true], [', credit ', false], ['Revenue 500.00', true], ['.', false]]],
  ['4', 'The client pays', [['a deposit arrives, stored and fingerprinted.', false]]],
  ['5', 'The system finds it', [['deposit matched to invoice #14.', false]]],
  ['6', 'Rules fire again', [['debit ', false], ['Cash 500.00', true], [', credit ', false], ['A/R 500.00', true], ['.', false]]],
  ['7', 'Math runs', [['tax owed ticks up, runway ticks up.', false]]],
  ['8', 'You look', [['four lines on the Ledger, two dots on the Calendar.', false]]],
];

// DECK-13: the four-door table. Row 6 (LINES WRITTEN) pre-splits its cells so
// debit/credit VALUES ink gold while the words stay put; the PROJECTS cell is
// the deliberate exception — 'none — no money moved' stays gray, per the deck.
const DOOR_COLS = ['TRAVEL', 'TRADING', 'TIME → PAYROLL', 'PROJECTS'] as const;
type DoorCell = string | ReadonlyArray<readonly [string, boolean]>;
const DOOR_ROWS: ReadonlyArray<readonly [string, DoorCell, DoorCell, DoorCell, DoorCell]> = [
  ['DISCOVER', 'live fares arrive', 'scan the chains', 'approved hours pile up', 'goals meet the audit'],
  ['DECIDE', 'a cart', 'a trade card', 'a payroll run drafts', 'a task is accepted'],
  ['COMMIT', 'book it — a confirmation code comes back', 'order goes to the broker', 'run it', 'the build fires'],
  ['THE WORLD ANSWERS (OBSERVED)', 'the card charge arrives', 'the fill arrives', 'the bank withdrawal arrives', 'the finished build comes back'],
  ['MATCH', 'charge ↔ booking', 'fill ↔ order', 'withdrawal ↔ payroll run', 'task ↔ finished build'],
  ['LINES WRITTEN',
    [['debit ', false], ['Travel', true], [', credit ', false], ['Card', true]],
    [['debit ', false], ['Position', true], [', credit ', false], ['Cash', true]],
    [['debit ', false], ['Wages + taxes', true], [', credit ', false], ['Cash + withholdings', true]],
    'none — no money moved'],
  ['MATH RUNS', 'deductible portion, runway', 'P&L (profit and loss), win rate, open risk', 'the true cost of labor', "progress, what's stuck"],
  ['YOU LOOK', 'a trip bar, plus lines', 'fill dots, plus lines', 'a pay-day dot, plus lines', 'a due-date dot — no lines'],
];

// DECK-13 (PR-VOICE): the two truths under 'Two more truths from this
// table:'. Truth (1) absorbed the old trade-close strip, in the essay's own
// sentence, amounts and debit/credit values gold; truth (2) needs no gold —
// it is about lines NOT being written.
const TRADE_CLOSE: ReadonlyArray<readonly [string, boolean]> = [
  ['(1) When a trade closes, the gain gets its own line. Sell for ', false],
  ['5,300.00', true],
  [' what you bought for ', false],
  ['5,000.00', true],
  [', and the rule writes: debit ', false],
  ['Cash 5,300.00', true],
  [', credit ', false],
  ['Position 5,000.00', true],
  [', credit ', false],
  ['Gain 300.00', true],
  ['.', false],
];
// VOICE-2: the withholdings parenthetical moved to 09's four-gloss line —
// glossed at its first on-screen use, the payroll rule row.
const HOURS_TRUTH = '(2) Your hours never write a line by themselves. They only reach the books when a payroll run commits, exactly as Step 10 promised.';

// DECK-14 (PR-VOICE): the reverse walk, [layer, artifact] — labels gold
// mono, artifacts mono aubergine. The essay's '(N) The layer:' phrasing maps
// onto the two columns: the prefix rides the label cell, the colon is the
// column gap, and the artifact carries the essay's punctuation — including
// 'still matches!' (the essay's exclamation replaced the old ✓ glyph).
const PROOF_WALK = [
  ['(1) THE NUMBER', '$96.80 on your runway screen.'],
  ['(2) THE LINE', 'debit Cash 96.80.'],
  ['(3) THE MATCH', 'linked to payout po_1QmX8fK2.'],
  ['(4) THE ARRIVAL', 'the payload, word for word, received 09:14:02Z.'],
  ['(5) THE FINGERPRINT', 'still matches!'],
] as const;
const PROOF_TRIO = [
  'Nothing was edited.',
  'Nothing was asked twice.',
  'Nothing is claimed without the fingerprint.',
] as const;

// DECK CLASS GRAMMAR — the section grammar of acts 01–04, extracted once so
// nine new acts cannot drift from it or from each other. These are the exact
// class strings the reconciled acts carry inline; every full class name here
// is a literal (Tailwind scans source text — the chipClass/pad/rule locals
// below are the precedent for string-const classes).
const DECK = {
  section: 'max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px] border-t border-border',
  eyebrow: 'font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint',
  h2: 'mt-[26px] text-[27px] leading-[1.2] lg:text-[38px] tracking-[-0.025em] text-brand-purple',
  sub: 'mt-[22px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary',
  // The deck's rust group label — brand-amber per the header-comment mapping.
  rust: 'font-mono text-[10px] lg:text-[11px] uppercase tracking-[0.20em] text-brand-amber',
  table: 'w-full table-fixed border-separate border-spacing-0 border border-border',
  th: 'bg-bg-row px-[11px] py-[9px] lg:px-5 lg:py-3 text-left align-top font-mono text-[10px] lg:text-[11px] font-normal uppercase tracking-[0.18em] text-text-faint border-b border-b-border',
  pad: 'px-[11px] py-[9px] lg:px-5 lg:py-[11px]',
  rule: 'border-b-[0.75px] border-b-text-faint',
  statement: 'text-[12px] lg:text-[14px] text-text-faint',
  trio: 'text-[13px] leading-[1.5] lg:text-[16.5px] text-brand-purple',
  hairline: 'mt-10 lg:mt-[76px] h-px w-full bg-border',
  q: 'mt-[22px] lg:mt-9 text-[17px] lg:text-[28px] text-brand-purple',
  // PR-COLLAPSE → PR-CHROME: the step-header disclosure button is a compact
  // BAR now — bg-bg-row fill, 1px border-border, px-4 py-3 (the personas
  // accordion's own 12px rhythm, 5010ca1f) — so collapsed steps read as one
  // gray stack. The bar's border replaced the old stepRule hairline; label
  // and glyph inside are byte-identical. Every utility already rides
  // elsewhere in this file.
  stepButton: 'flex w-full items-baseline justify-between gap-3 border border-border bg-bg-row px-4 py-3 text-left',
  // A COLLAPSED step's section contributes only its bar plus this 8px gap —
  // no act padding, no border-t (the bar's own border is the rule; see the
  // seam ledger). Expanded sections keep their full act classes.
  sectionBar: 'max-w-7xl mx-auto px-4 lg:px-8 pb-2',
} as const;

// PR-COLLAPSE: the 14 deck steps' section ids, order-parallel to the acts.
// Each header button's aria-controls points at `${id}-body`, and a URL hash
// naming a section id expands that step on load. The ids are NEW with this
// feature (the deck sections carried only aria-labels before), so no
// existing anchor moved; id="modules" / id="demo" are untouched.
// PR-STEP-2: deck-02 is the inserted providers step; 03–14 are the old
// 02–13 shifted by one, so an OLD #deck-NN link now opens the step BEFORE
// the one it used to name — accepted, the ids follow the essay's numbering.
const DECK_STEP_IDS = [
  'deck-01', 'deck-02', 'deck-03', 'deck-04', 'deck-05', 'deck-06', 'deck-07',
  'deck-08', 'deck-09', 'deck-10', 'deck-11', 'deck-12', 'deck-13', 'deck-14',
] as const;

/** PR-DECK: inline [text, isGold] segments — the only way gold ever enters a
 *  sentence (amounts and debit/credit values), so the split stays data. */
function GoldSegments({ segments }: { segments: ReadonlyArray<readonly [string, boolean]> }) {
  return (
    <>
      {segments.map(([text, gold], i) => (
        gold ? <span key={i} className="text-brand-gold">{text}</span> : <Fragment key={i}>{text}</Fragment>
      ))}
    </>
  );
}

// PROBLEM-FAN / DESKTOP GEOMETRY. The whole desktop drawing in one object, so
// the viewBox, the paths and the label offsets cannot drift apart. Design's
// figures: origins at x=148, a horizontal run to the bend at x=268, then one
// angle to the join at (505, 166). The join stops SHORT of the sheet on
// purpose — the lines AIM at it, they do not land on it — and 505 also keeps
// the 1px stroke's outer half (505.5) inside the 507 box, the right-edge clip
// lesson from GRID-SCALE below.
const PROBLEM_FAN_LG = { w: 507, h: 310, originX: 148, bendX: 268, joinX: 505, joinY: 166 } as const;

// The six DESKTOP line-origin y values — first at 21, pitch 55. This array is
// the SINGLE SOURCE for both the fan's six paths AND the six HTML labels
// pinned over them: the paths read it directly, and each label's offset is
// y / PROBLEM_FAN_LG.h expressed as a percentage. There is nothing left to
// keep in sync by hand, which is what the old two-array arrangement asked for
// and what the note below still asks of the MOBILE pair.
//
// WHY PERCENTAGES, AND WHY AN INLINE style. The desktop SVG is no longer
// rendered 1:1 — it is fluid (w-full over a fixed viewBox), because a fixed
// 1216px row overflows every viewport under 1280 while `lg:` starts at 1024.
// Once the drawing scales, a px offset is only correct at one width, but
// y / 310 is correct at EVERY width, since the wrapper's height is exactly the
// scaled SVG's height. Percentages cannot be literal Tailwind classes here
// (`top-[${y}%]` would never compile — Tailwind scans source text, it does not
// evaluate it; the REPAINT-1 landmine note in tailwind.config.ts is the same
// lesson), so the offset goes through an inline style — the house escape hatch
// for computed positioning (CalendarGrid.tsx:747,767,779 do exactly this).
const PROBLEM_LABEL_TOP_LG = [21, 76, 131, 186, 241, 296] as const;

// The six MOBILE label offsets, order-parallel to PROBLEM_SOURCES. LITERAL
// class strings, never interpolated (same Tailwind-scans-source lesson as
// above). The mobile SVG IS still rendered 1:1 at its viewBox size, so these
// stay exact pixel matches to its line origins, with no scaling to reason
// about: 6 rows of 26px. Scaling that drawing without scaling this array would
// silently unpin every mobile label from its line.
// (No lg: prefix needed — the array is used inside a container that is already
// breakpoint-gated, so the class only applies where it is visible.)
const PROBLEM_LABEL_TOP_SM = [
  'top-[13px]', 'top-[39px]', 'top-[65px]', 'top-[91px]', 'top-[117px]', 'top-[143px]',
] as const;

// FD-1i: the SUMMARY deck's content — LIFTED ONLY, zero invented copy (the
// FD-1b bullet-lift precedent). PLAIN-SHOWCASE exception: the TRAVEL entry
// now carries Alex's ruled plain-language copy (PR-SLIDE-TRAVEL-REAL) rather
// than a lift — the showcase was brought to parity in the same ruling; the
// other eight pillars remain verbatim lifts. Per pillar: the module deck's
// dark-hero eyebrow + headline, then 3 verbatim slide titles. Provenance
// (file:line, verified at lift time):
//   Travel:     eyebrow/headline TravelShowcaseSections.tsx:324-325;
//               lines :342, :363, :370
//   Runway:     eyebrow/headline RunwayShowcaseSections.tsx:344-345;
//               lines :362, :397, :411
//   Books:      eyebrow/headline TabShowcases.tsx:237-238;
//               lines :247, :268, :289
//   Trade:      eyebrow/headline TabShowcases.tsx:134-135;
//               lines :162, :176, :190
//   Tax:        eyebrow/headline TabShowcases.tsx:340-341;
//               lines :364, :371, :385
//   Compliance: eyebrow/headline ComplianceShowcaseSections.tsx:327-328;
//               lines :345, :359, :387
//   Routines:   eyebrow/headline RoutinesShowcaseSections.tsx:366-367;
//               lines :384, :405, :412
//   Projects:   eyebrow/headline ProjectsShowcaseSections.tsx:270-271;
//               lines :288, :309, :330
//   Content:    eyebrow/headline ContentShowcaseSections.tsx:228-229;
//               lines :246, :253, :267
// Lines were chosen to NOT repeat the retired selection deck's PILLAR_CARDS
// bullets — the two decks told different halves of each pillar's story. That
// deck is gone; the constraint is recorded because these strings still read as
// one half of a pair.
// PR-ELEV-2c: entries MAY carry an optional demoImage — rendered as the
// slide's framed RIGHT column (PR-DECK-CLEAN-3, Nuitée-style; absent → text
// spans full width).
// PR-DEMO-1 → LANDING-04-ILLOS: all nine slots carry CODE-DRAWN SVG
// PIPELINE illustrations (public/demo/<pillar-id>.svg) — each shows that
// module's REAL stages left-to-right (stage names read from the module's own
// StageStrip config or source component; provenance in each SVG's header
// comment), in the Direction-C palette. The dark-era UI mockups and travel's
// stale pre-repaint PNG capture retired with them. Illustrative sample values
// only (a count, a chip, one dollar figure per frame — the eyebrow now says
// these are illustrations); never invented revenue/user/performance numbers.
// REAL SCREENSHOTS MAY REPLACE ANY FILE AT THE SAME PATH — drop the capture
// in, keep the filename, and flip the eyebrow line back.
// WALKTHROUGH-STAGE: SUMMARY_BY_ID deleted — the old deck's eyebrow/headline/
// lines went runtime-unconsumed at the merged-modules rebuild and its last
// live field (demoImage, the stage frame <img>) retires with Treatment A
// (per-step glimpses supersede the single frame — README round-5 note). The
// svg FILES stay in public/demo per the spec; the strings live in git
// history if a surface ever wants them back.

// PERSONAS-PAYOFFS → PERSONAS-COPY (PR-PERSONAS-COPY): rows rewritten to the
// 13-step vocabulary from the 2026-08 persona research pack (every claim
// cited there); mono fragments only from the essay word list, max two per
// row. Segment boundaries are the slate's — never resplit them.
const PERSONAS: ReadonlyArray<{ label: string; segments: ReadonlyArray<{ text: string; mono?: true }> }> = [
  { label: 'FOUNDER', segments: [
    { text: 'Building a company? See your ' },
    { text: 'runway', mono: true },
    { text: ' at any moment, and click any number back to the raw bank bytes when investors ask.' },
    { text: ' Every dollar keeps its ' },
    { text: 'fingerprint', mono: true },
    { text: '.' },
  ] },
  { label: 'TRADER', segments: [
    { text: 'Trading your own money? Every fill finds its order and lands in your ' },
    { text: 'books', mono: true },
    { text: ', so your ' },
    { text: 'return', mono: true },
    { text: ' is ready all year.' },
    { text: ' No April spreadsheet panic.' },
  ] },
  { label: 'CREATOR', segments: [
    { text: 'Filming what you do? Your ' },
    { text: 'Calendar', mono: true },
    { text: ' plans your shoots, and the tax you owe updates as the money lands.' },
    { text: ' More posting, less panic.' },
  ] },
  { label: 'NOMAD', segments: [
    { text: 'Living out of a suitcase? Book the trip inside the system, and the card charge ' },
    { text: 'matches', mono: true },
    { text: ' its booking by itself.' },
    { text: ' Nothing lost between countries.' },
  ] },
  { label: 'SMALL BUSINESS OWNER', segments: [
    { text: 'Running the whole thing yourself? ' },
    { text: 'Posting', mono: true },
    { text: ' rules write every debit and credit, so you never type a journal entry.' },
    { text: ' No more spreadsheet tabs.' },
  ] },
  { label: 'STUDENT', segments: [
    { text: 'First real paycheck? Watch one $500 travel your whole ' },
    { text: 'Ledger', mono: true },
    { text: ' — every term explained the first time you see it.' },
    { text: " The class most schools still don't require." },
  ] },
];

// FD-1n: the footnote marks ACTUALLY referenced by the allocation rows
// (amount footnotes + the ᵉ riding split percentages) — the merged registry
// renders only these, derived, never hardcoded.
// LOBBY-DECK-1: unmounted on the landing (the footnote registry left with the
// sheet); exported/preserved for HPW-1.
export const REFERENCED_MARKS: Set<string> = (() => {
  const s = new Set<string>();
  for (const r of ALLOCATION_ROWS) {
    r.footnotes.forEach((m) => s.add(m));
    if (r.splitPct.includes('ᵉ')) s.add('ᵉ');
  }
  return s;
})();

// PRICE-1: the FD-1o "our cost: …" deck micro-line was REMOVED — accurate but
// incomprehensible on a sales card (PRICING-AUDIT-1). The full cost receipts
// live where they always did: /how-pricing-works (the transparency door link
// under the deck).

// FD-1n: the $0-strip fold-ins — the strip died as a section; its two facts
// render inside the ruled expansions (TT → Trade, GOV → Compliance). Mapped
// by VENDOR KEY per Alex's ruling, NOT by the strip's internal allocatedTo
// (whose 'Trading' name is legacy vocabulary FD-1l never touched — data is
// 0 lines this PR; flagged in the FD-1n report).
// LOBBY-DECK-1: unmounted on the landing; exported/preserved for HPW-1.
export const ZERO_COST_BY_MODULE: Record<string, string> = { trade: 'TT', compliance: 'GOV' };

/** FD-1n: one module's cost receipt — the FD-1k per-project grouping scoped
 *  to a single project name, inline under the module's sheet row. Same ten
 *  columns, same DimCell renders, its own overflow-x wrapper.
 *  LOBBY-DECK-1: does NOT render on the landing anymore (the deck replaced
 *  the sheet + its costs ▾ expanders) — PRESERVED unmounted and exported so
 *  the receipt machinery survives intact for HPW-1. */
export function ModuleCostBreakdown({ projectName, zeroCostVendor }: { projectName: string; zeroCostVendor?: string }) {
  const rows = ALLOCATION_ROWS.filter((r) => r.target.name === projectName);
  const entered = rows.filter((r) => r.amountUsd !== null);
  const total = entered.reduce((s, r) => s + (r.amountUsd as number), 0);
  const zeroFact = zeroCostVendor ? NO_COST_STRIP.find((f) => f.vendor === zeroCostVendor) : undefined;
  return (
    <div className="px-4 pb-4">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
        Entered ${total.toFixed(2)} · {entered.length} of {rows.length} amounts
      </p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-panel-border bg-panel-surface">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-panel-border text-left font-mono text-[10px] uppercase tracking-wider text-white/40">
              <th className="px-3 py-2 font-semibold">Entity</th>
              <th className="px-3 py-2 font-semibold">Account</th>
              <th className="px-3 py-2 font-semibold">Sub</th>
              <th className="px-3 py-2 font-semibold">Object</th>
              <th className="px-3 py-2 font-semibold">Vendor</th>
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 font-semibold">Basis</th>
              <th className="px-3 py-2 font-semibold">Cadence</th>
              <th className="px-3 py-2 font-semibold">Split</th>
              <th className="px-3 py-2 font-semibold text-right">Amount (USD/mo)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: ScheduleAllocationRow) => (
              <tr key={`${r.vendor}-${r.target.type}-${r.target.name}`} className="border-b border-panel-border last:border-0">
                <td className="px-3 py-2 align-top"><DimCell code={r.entity} label={ENTITY_DIM[r.entity]} /></td>
                <td className="px-3 py-2 align-top"><DimCell code={r.account} label={ACCOUNT_DIM[r.account]} /></td>
                <td className="px-3 py-2 align-top"><DimCell code={r.sub} label={SUB_DIM[r.account]?.[r.sub] ?? ''} /></td>
                <td className="px-3 py-2 align-top"><DimCell code={r.object} label={OBJECT_DIM[r.object]} /></td>
                <td className="px-3 py-2 align-top"><DimCell code={r.vendor} label={VENDOR_DIM[r.vendor]} /></td>
                <td className="px-3 py-2 align-top text-xs leading-relaxed text-white/70">{r.description}</td>
                <td className="px-3 py-2 align-top font-mono text-[10px] uppercase tracking-wider text-white/60 whitespace-nowrap">{r.basis}</td>
                <td className="px-3 py-2 align-top text-xs text-white/60 whitespace-nowrap">{r.cadence}</td>
                <td className="px-3 py-2 align-top font-mono text-xs text-white/70 whitespace-nowrap">{r.splitPct}</td>
                <td className="px-3 py-2 align-top text-right font-mono text-xs font-semibold text-white whitespace-nowrap">
                  {r.amountUsd !== null ? `$${r.amountUsd.toFixed(2)}` : `—${r.footnotes.join('')}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {zeroFact && (
        <p className="mt-2 text-[11px] leading-relaxed text-white/50">
          <span className="font-mono text-white">{zeroFact.vendor}</span>{' '}
          <span className="text-white/60">{zeroFact.vendorLabel}</span> ·{' '}
          <span className="font-mono font-bold text-white">$0</span> — {zeroFact.description}
        </p>
      )}
    </div>
  );
}

interface Props {
  /** The register-ask funnel — the hero CTA + every in-page save/auth nudge.
   *  FD-2 supplies the real register-modal opener; the preview wrapper a stub. */
  onRequireAuth: () => void;
  /** ROUTE-1 (ruling b): the header's "Log in" opener — the SAME LoginBox in
   *  LOGIN mode (returning users). Optional so the preview wrapper needs no
   *  change; absent → LandingHeader falls back to its '/' link mode. */
  onRequireLogin?: () => void;
  /** Per-entitlement-key availability, SERVER-computed by the mount route
   *  (page.tsx:83-85 env-presence read). Missing key → unavailable. */
  entitlementAvailability: Record<string, boolean>;
  /** PR-ELEV-2d: per logo slug, does public/logos/<slug>.svg exist? SERVER-
   *  computed (page.tsx fs check over BUILT_ON's logo slots). Missing/false
   *  → the text-only card, exactly as before — never a broken <img>. */
  logoAvailability: Record<string, boolean>;
  /** PR-PRICE-3: the deck's buy path — /pricing died, so Select/Continue no
   *  longer link out; they hand the entitlement key to GuestLanding, which
   *  owns the account-first + checkout-entitlement resume (every Landing
   *  viewer is a guest by construction — page.tsx:77 branches authed viewers
   *  to HomeClient, where LockedTabCard is the buy surface). */
  onBuyModule: (key: string) => void;
}

// REPAINT-2 (Direction C): the local HERO_BG radial-glow const DIED — the
// hero is a SOLID aubergine band (bg-brand-purple) on the cream page. The
// ELEV-2c/CARD-POP glow recipe died with it: every former CARD_BG mount in
// this file is a flat card + lavender hairline now (deck/services = bg-white,
// summary slides = bg-ts-white card cream, wall tiles = solid aubergine).

// entitlementAvailability + onBuyModule stay in Props — the FD-2 mount
// contract still passes them (page.tsx → GuestLanding, outside this PR's
// fence) — but Landing no longer consumes them. Their last consumer was the
// Act-4 bundle bar, and the modules retirement removed the last surface that
// could have picked them back up, so the destructure takes only what is used.
// The buy path returns with the next purchase affordance; the checkout links
// that survive all leave the page (see the id="modules" note).
// REAL-MARKS: logoAvailability is CONSUMED again — the marquee chips carry
// the lit-logo two-state render (the wall's own logic, relocated), so the
// server fs-check → availability → chip pipeline is live end to end.
// (entitlementAvailability/onBuyModule remain passed-but-unconsumed.)
export default function Landing({ onRequireAuth, onRequireLogin, logoAvailability }: Props) {
  // LOBBY-DECK-1b: the demo modal's open flag.
  // UNREACHABLE AS OF THE MODULES RETIREMENT, DECLARED — the only
  // setShowDemo(true) in the file was the merged section's header button, which
  // died with that section, so nothing can flip this to true and the modal
  // below can no longer render. It is left mounted, not deleted, following this
  // file's existing preserved-unmounted convention (ModuleCostBreakdown,
  // ZERO_COST_BY_MODULE, REFERENCED_MARKS) so the next surface that wants a
  // demo opener has it ready. It is NOT wired and NOT a fallback: whoever
  // restores an opener restores the behaviour. Flagged rather than silently
  // left looking live.
  const [showDemo, setShowDemo] = useState(false);

  // PERSONAS-MOBILE: below lg the persona rows collapse to a one-open-at-a-
  // time accordion — FOUNDER (index 0) open by default; tapping the open row
  // closes it. Desktop is untouched: the toggle renders as the inert label
  // (lg:pointer-events-none) and every sentence stays lg:block.
  const [openPersona, setOpenPersona] = useState<number | null>(0);

  // PR-COLLAPSE: one open flag per deck step, independent toggles (any
  // number can be open). ALL 14 ship collapsed — the URL-hash effect below
  // is the only thing that opens a step automatically. Show/hide is
  // instant — the body div takes the `hidden` class, no animation, and the
  // copy stays in the DOM (the personas-accordion arrangement, 5010ca1f).
  const [openSteps, setOpenSteps] = useState<boolean[]>(() => DECK_STEP_IDS.map(() => false));
  // A URL hash naming a step's section id expands that step after mount.
  // The hash never reaches the server, so this cannot be an SSR branch —
  // first paint is always the deterministic default above.
  useEffect(() => {
    const target = (DECK_STEP_IDS as readonly string[]).indexOf(window.location.hash.slice(1));
    if (target >= 0) setOpenSteps((prev) => prev.map((open, i) => (i === target ? true : open)));
  }, []);
  const toggleStep = (index: number) =>
    setOpenSteps((prev) => prev.map((open, i) => (i === index ? !open : open)));

  return (
    <div className="min-h-screen bg-bg-terminal text-text-primary">
      {/* HEADER-CTA: onRequireAuth passed through so the header's Create
          account button is the SAME register opener as the hero CTA. */}
      <LandingHeader onRequireLogin={onRequireLogin} onRequireAuth={onRequireAuth} />

      {/* ── Hero — the house Bloomberg treatment; copy + CTAs verbatim.
            REPAINT-2: a SOLID aubergine full-bleed band (the glow died). ──── */}
      <section className="bg-brand-purple text-white pb-14 pt-12">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="max-w-3xl">
            {/* HERO-PRESENCE: the idea-state badge pill — first element in the
                hero; the ✦ glyph wears the pop accent. */}
            <a
              href="https://github.com/Temple-Stuart/temple-stuart-accounting/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 mb-6"
            >
              {/* REPAINT-2: the pop glyph re-inks lavender — pop is invisible
                  on the aubergine band. */}
              <span className="text-brand-purple-wash" aria-hidden="true">✦</span>
              Source-available · BSL 1.1
            </a>
            <h1 className="text-4xl sm:text-6xl font-bold leading-tight tracking-tight mb-6 text-ts-white">
              Track your money.<br />
              Plan your time.<br />
              {/* REPAINT-2 (E): the gradient clip died. The separable final
                  segment wears the LAVENDER tint (brand-purple-wash #eae7f2)
                  — brand-purple-hover (#4e3e85) measures ~1.4:1 against the
                  aubergine band, illegible; the wash holds the family and
                  reads. Copy untouched. */}
              <span className="text-brand-purple-wash">Live smarter.</span>
            </h1>
            {/* LAND-MSG-1: the hero previously jumped tagline → CTAs with
                nothing telling a novice what this IS. One plain sentence,
                Alex's framing near-verbatim. Claims verified: bookkeeping is
                GAAP double-entry (tab:books unlocks), and the platform spans
                nine modules — money, calendar, travel, trading, tax in one
                app rather than separate tools. */}
            <p className="mb-6 max-w-xl text-base text-white/70">
              Track your money the way an accountant would — one app, not ten.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* HERO-REPO-1 (Alex's rationale): the hosted product leads —
                  "Create free account" is the promoted white CTA. The repo
                  joins as the bordered-ghost secondary: cloning requires
                  provisioning every API (Duffel / LiteAPI / Plaid / Stripe /
                  Anthropic / …) — most won't, many can't, and Alex sells setup
                  for those who want it; open-sourcing extends the honesty
                  thesis to the code. "See how it works ↓" left the hero (the
                  booking strip sits right below anyway; the demo trigger moved
                  to the pillar-deck header). */}
              {/* REPAINT-2: the gradient died — the primary CTA is the
                  MONEY_ACTION gold (bg-brand-gold + /90 hover) at the hero's
                  own size/padding. */}
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-6 py-3 bg-brand-gold text-white font-medium hover:bg-brand-gold/90 text-sm text-center"
              >
                Create free account
              </button>
              <a
                href="https://github.com/Temple-Stuart/temple-stuart-accounting"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 border border-white/40 text-white font-medium hover:bg-white/10 text-sm text-center"
              >
                Clone it on GitHub ↗
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* ── TOGGLE-1: the lobby books — the five-way toggle strip, mounted
            where the teaser sat (directly under the CTA row; pre-BOOK-1
            Landing.tsx:325-328). Full content width — the strip holds
            whole booking surfaces + result rows, not just a form.
            REPAINT-2: the mount moved OUT of the hero section (one JSX seat
            down, same props, zero wiring) — the hero is a solid aubergine
            band now, so the strip sits on the cream page where its own
            aubergine band (ds.BAND_BG) reads as a band. DECLARED INTERIM:
            the strip's INTERIOR (travel pickers/results) stays dark until
            Slice 4's trips pass. */}
      {/* DEMO-SECTION (390 audit finding 8): div → section + aria-label so
          the demo region is a real landmark. Classes carried verbatim —
          Tailwind utilities are tag-agnostic and nothing selects div#demo
          (both ids here are href targets only).

          ANCHOR: id="modules" lives here. It is NOT decorative — four live
          inbound paths resolve to it and would 404-to-top without it:
          the Stripe checkout cancel_url (api/stripe/checkout/route.ts:53),
          the /pricing 308 permanent redirect (app/pricing/page.tsx:28), the
          module page's Select buy link (ModulePageClient.tsx:139) and the
          shopping View Plans button (app/shopping/page.tsx:307). It travelled
          with this section when the revenue acts moved under the hero, so those
          links now land higher up the page than they used to — closer to the
          fold, which is the right direction for a buy path, not a regression.
          id="demo" is NOT dropped — an element carries one id, so it sits on
          the eyebrow row a few px below. It has no href pointing at it in src/
          today (the nav's Live-demo link retired, LandingHeader.tsx:35), but an
          external bookmark costs nothing to keep alive.

          UNNUMBERED BY RULING: this is a live surface, not a step in the
          teaching sequence, so the eyebrow reads LIVE DEMO — TRAVEL with no
          number. The numbered acts start below it at 01.

          SEAM: border-b, and it closes from BELOW on purpose. Above is the
          hero, whose aubergine-to-cream edge is the page's one deliberate
          zero-rule boundary, so a border-t here would be the defect the seam
          ledger warns about. Closing from below also single-rules the
          GuestTripStrip case — see the ledger on the problem section. */}
      <section id="modules" aria-label="Live demo — travel" className="max-w-7xl mx-auto px-4 lg:px-8 border-b border-border">
        {/* LANDING-V2 (spec :96-97): the demo's numbered eyebrow row — 03,
            label otherwise verbatim; right slot = the existing /modules/travel
            door. */}
        <div id="demo" className="flex items-baseline justify-between gap-3 pt-6">
          <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint">LIVE DEMO — TRAVEL</p>
          <Link href="/modules/travel" className="font-mono text-xs lg:text-[10px] tracking-wider text-brand-purple hover:text-brand-purple-hover">
            EXPLORE TRAVEL →
          </Link>
        </div>
        {/* LANDING-V3 (spec :99): the demo h2, spec wording verbatim. */}
        <h2 className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">
          Search &amp; book travel — free today, no account needed.
        </h2>
        <LandingBookingSection onRequireAuth={onRequireAuth} />
        {/* LANDING-V5 (spec :174-177): the demo section's footer row — the
            spec's own strings verbatim (the left line already lives in
            the retired SUMMARY_BY_ID's travel lines (git history); NO ACCOUNT NEEDED is the spec's mono
            right slot). */}
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 pb-2">
          <span className="text-[13px] text-text-faint">One trip holds everything — plans, bookings, budget.</span>
          <span className="font-mono text-xs lg:text-[10.5px] tracking-wider text-text-faint">NO ACCOUNT NEEDED</span>
        </div>
      </section>
      {/* PR-ELEV-1: the coming-soon tiles live INSIDE the strip above as
          badged "Soon" chips (travelStripModes) — the PR-LANDING-1 tile
          row below the strip is gone; the both-surfaces-at-once light-up
          ruling now holds at chip level via the shared builder. */}

      {/* ── BOOK-3: the guest's session trip — renders only when records
            exist (fail-honest empty state = nothing). ─────────────────────── */}
      <GuestTripStrip onRequireAuth={onRequireAuth} />

        {/* ACT 2 — PERSONAS (value cases): hook question + one outcome
            sentence per row; module-name fragments wear the mono purple
            idiom mid-sentence. Rows: border-light rules (§0's inner
            hairline — the exact #EBE4F7 token). The '·' in the act label
            wears gold. PERSONAS-CHROME: the act adopts the standard act
            grammar — DONE-FOR-YOU's eyebrow/h2/py-10 classes verbatim,
            left-aligned, rows full container width; the sentence tier is
            slide 09's body tier. Row texts and the label are FROZEN; the
            outer div's border-b (the personas|done-for-you rule since
            PR-REORDER moved this act above DONE-FOR-YOU) is untouched. */}
        <div className="w-full border-b border-border">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
            <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              ONE SYSTEM <span className="text-brand-gold">·</span> SIX LIVES
            </p>
            <h2 className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">
              Who is this for?
            </h2>
            <div className="mt-5">
              {PERSONAS.map((row, index) => {
                const open = openPersona === index;
                return (
                  <div key={row.label} className="border-t border-border-light py-3 first:border-t-0 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-baseline lg:gap-4">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenPersona(open ? null : index)}
                      className="flex w-full items-baseline justify-between py-3 lg:pointer-events-none lg:py-0"
                    >
                      <span className="font-mono text-xs font-semibold tracking-wider text-text-muted">{row.label}</span>
                      <span aria-hidden="true" className="font-mono text-[14px] text-text-faint lg:hidden">{open ? '−' : '+'}</span>
                    </button>
                    <p className={`${open ? 'block' : 'hidden'} lg:block mt-1 text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary lg:mt-0`}>
                      {row.segments.map((seg, i) =>
                        seg.mono ? (
                          <span key={i} className="font-mono text-[12.5px] font-semibold text-brand-purple">{seg.text}</span>
                        ) : (
                          <Fragment key={i}>{seg.text}</Fragment>
                        ),
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      {/* MODULES ACT LANDS HERE — "the what" (PR-MODULES, content TBD) */}

      {/* ── LANDING-V4 (Alex's ruling, reversing the V2 seat): DONE-FOR-YOU is
            its own section — no right slot. Body = the PROFESSIONAL SERVICES
            panel relocated WHOLESALE from the 05 grid (markup byte-identical
            inside), seated in the old deck-table's white-card container idiom.

            UNNUMBERED BY RULING: a guest can submit a proposal here without an
            account, so this is a revenue surface, not a step. It lost its
            '04 / ' prefix when it moved up with the demo; the numbered acts
            below it start at 01 and the sequence is contiguous without it.

            SEAM: border-b ONLY — the border-t is deliberately gone. The act
            directly above (the personas act since PR-REORDER) already closes
            that boundary with its own border-b, and a border-t here would
            have made it the page's only two-rule seam. This section's bottom
            edge closes done-for-you|pipeline header. ───────────────────── */}
      <section className="w-full border-b border-border bg-bg-terminal">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            DONE-FOR-YOU
          </p>
          {/* HEADLINE: the travel act's h2 treatment, class for class —
              mt-3 text-2xl sm:text-3xl font-medium tracking-tight
              text-brand-purple. The two revenue acts under the hero are a
              pair and now read as one: eyebrow, headline, then the surface.
              WEIGHT AND BREAKPOINT, BOTH DELIBERATE. font-medium is 500, and
              the sm: prefix is not the lg:-only idiom the numbered slides
              keep — both are correct HERE because this act sits above the
              teaching run and matches its sibling instead. sm: is already
              this section's own idiom (the services grid below is
              sm:grid-cols-2), so nothing new is introduced; swapping it for
              lg: would leave this headline a size behind travel's between
              640 and 1023px, which is the one thing the match exists to
              prevent.
              NO MARGIN BELOW, also matching: the travel h2 carries only mt-3
              and lets the element after it supply the gap. The services card
              below keeps its own mt-4, untouched. */}
          <h2 className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">
            Need help setting it up? Send a proposal.
          </h2>
          <div className="mt-4 rounded-lg border border-border bg-white p-5">
            <div className="mt-4">
              <span className="rounded border border-border px-2 py-0.5 font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                PROFESSIONAL SERVICES
              </span>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">Your own hosted copy — every API wired, custom to your business, you own everything.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {([
                  ['Full setup', 'Your own hosted copy, every API wired, you own everything.'],
                  ['Monthly maintenance', 'I keep it updated and running.'],
                  ['Custom builds', 'Need a feature? I build it.'],
                  ['Embed a module', 'Want just one piece (the booking engine, the books, the scanner) inside your existing system? I do that too.'],
                ] as const).map(([title, desc]) => (
                  <div key={title} className="rounded-lg border border-border bg-white p-4 text-text-primary">
                    <div className="text-sm font-medium">{title}</div>
                    <p className="mt-1 text-xs text-text-muted">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link
                  href="/work-with-me"
                  className="border border-brand-purple/40 px-6 py-2 text-center text-xs font-medium text-brand-purple hover:bg-brand-purple-wash"
                >
                  Send a project proposal →
                </Link>
                <span className="ml-auto font-mono text-xs italic text-text-faint">Scoped by proposal</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE PIPELINE HEADER (PR-CHROME → PR-PIPE-TITLE → PR-STEP-2).
            Names the 14-step run so the collapsed bars below read as one unit, and
            says what the pipeline IS — the data pipe the whole system runs
            on. The headline and sub are the essay's front matter, VERBATIM
            (the essay updated to the data-pipe-and-foundation claim in the
            same breath as this PR); the two mono lines are the run's name
            and the essay's Date · Time · Money subtitle in the label tier.
            Act grammar, existing classes only.
            SEAM: this act takes border-b — done-for-you's border-b closes
            done-for-you|header from above, and this act's border-b closes
            header|01, which preserves 01's own no-border exception exactly
            as the seam ledger records it. One rule per boundary, both
            boundaries. */}
      <section aria-label="The pipeline" className="max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px] border-b border-border">
        <p className={DECK.eyebrow}>THE PIPELINE — 14 STEPS</p>
        <p className={`mt-2 ${DECK.eyebrow}`}>DATE · TIME · MONEY</p>
        <h2 className={DECK.h2}>
          One data pipe runs the whole system.
        </h2>
        <p className={DECK.sub}>
          Fourteen steps turn raw data into one Ledger and one Calendar — the foundation everything else is built on. Written so anyone can understand it — and build it.
        </p>
      </section>

      {/* ── PROBLEM-01 / SIX-SOURCE DIAGRAM. This is where the TEACHING
            SEQUENCE starts — the two acts above it are live revenue surfaces
            and carry no step number, so 01 is still the first number a reader
            meets even though it is no longer the first act on the page.
            Act grammar unchanged: the kicker, h2 and act padding are the hero
            act's classes verbatim, and the section still draws NO border of
            its own — the done-for-you act above closes that seam from below.

            SEAM LEDGER (one rule per boundary, and exactly one). Re-derived
            for the revenue-first order; the previous ledger described the old
            one and every line of it had moved.
              header | hero            → the header's border-b
              hero | live demo         → ZERO, BY DESIGN. The only such seam on
                                         the page: a full-bleed aubergine band
                                         whose bottom edge IS the boundary. A
                                         border-border hairline against dark
                                         reads as a defect, so the colour change
                                         closes it and nothing else does. This
                                         rule follows the hero, so it now
                                         governs the demo act rather than this
                                         one.
              live demo | personas     → the demo act's border-b (PR-REORDER
                                         moved personas above done-for-you —
                                         the who-first order; the strip case
                                         below still single-rules both seams)
              personas | done-for-you  → the personas act's border-b (it
                                         carries NO border-t — its historical
                                         border-t became border-b at the
                                         PR-PERSONAS-RESTORE remount, and that
                                         rule travels with the act; the
                                         PR-MODULES placeholder comment between
                                         them is not DOM)
              done-for-you | pipeline header → done-for-you's border-b
              pipeline header | 01 problem   → the header's border-b (PR-CHROME
                                         seated the header act between them;
                                         01's no-border exception survives
                                         unchanged)
              01 problem | 02 providers → the providers act's border-t
                                         (PR-STEP-2 inserted 02 the ruled
                                         way: one border-t, no existing
                                         border touched)
              02 providers | 03 import → the import act's border-t
              03 import | 04 routing   → the routing act's border-t
              04 routing | 05 handoff  → the handoff act's border-t
              05 … 14 (the deck run)   → each act's own border-t WHEN EXPANDED
                                         — PR-DECK appended the back nine the
                                         ruled way, one border-t per new act.
                                         PR-CHROME: a COLLAPSED step renders
                                         only its bar (DECK.sectionBar has no
                                         border-t); the bar's own 1px border
                                         is that boundary's one rule, so the
                                         law holds in both states
              14 proof | built on      → built-on's border-t (the proof act
                                         ends the teaching run and, like every
                                         numbered act, draws no bottom rule of
                                         its own)
              built on | footer        → built-on's border-b
            NO NUMBERED ACT CARRIES A border-b — 01 through 05 specifically;
            done-for-you and built-on both do, which is why the run's boundaries
            behave differently from the page's. That is what makes the run
            extensible: every boundary INSIDE the teaching sequence is closed by
            the LOWER section's border-t, so a slide appended OR INSERTED needs
            exactly one class and disturbs nothing else. Adding the handoff act
            demonstrated the append case; PR-STEP-2's providers act demonstrated
            the insert case — its border-t closes problem|providers, and the
            import act's border-t, which used to close problem|import, closes
            providers|import without being touched.
            THE ONE EXCEPTION IS 01 ITSELF: this act has no border class at all,
            because the act above it closes its own bottom edge — done-for-you
            originally, the pipeline header's border-b since PR-CHROME (see
            the ledger above). So 02, 03 and 04
            take border-t and 01 takes nothing. Do not "make it consistent" by
            adding a border-t here — that would double the rule against
            done-for-you's border-b.
            THE GuestTripStrip CASE, now resolved. That strip renders only for a
            guest who has session trip records, carries its OWN border-b, and
            sits between the demo and personas acts (PR-REORDER swapped the
            lower neighbor from done-for-you to personas; the logic is
            unchanged). Closing the demo act from BELOW rather than giving the
            act beneath a border-t is what makes both cases single-ruled: with
            the strip, demo|strip is the demo's border-b and strip|personas is
            the strip's own; without it, demo|personas is the demo's border-b.
            A border-t on the personas act would have made strip|personas the
            page's only two-rule seam. Do not add one.
            GEOMETRY, DECLARED: the content-width acts rule at content width
            (max-w-7xl), the full-bleed acts rule edge to edge. So the demo's
            border-b and the providers, import and routing acts' border-t are
            inset, and
            done-for-you's and built-on's are not. This act draws no rule of its
            own at all, so it contributes none.

            GOLD RULING SUPERSEDED. The 2026-08-18 ruling ("the section's ONE
            gold moment"; "both problem-section questions render gold") is
            RETIRED together with the questions it governed. This act is
            deliberately colourless: THIS ACT CARRIES ZERO BRAND-GOLD, by
            design and not by oversight. That is the whole of the ruling, and it
            is the only part that is checkable from this file alone.
            NO "FIRST GOLD ON THE PAGE" CLAIM IS MADE HERE, because every
            version of that claim has turned out false. Gold already appears
            ABOVE this act in three places, two of them outside this file:
            the header's CTA fill (LandingHeader.tsx:80,87), the hero's
            MONEY_ACTION CTA fill (this file, the hero act), and — whenever a
            guest has trip records — GuestTripStrip's money numerals, which are
            text-brand-gold, i.e. gold INK, not just fill
            (GuestTripStrip.tsx:53,65). What IS true and worth recording: among
            the NUMBERED teaching acts, gold enters at 02 and continues into 03.
            Check the other files before writing a page-wide colour claim.

            FIRST DIAGRAM SVG IN THE REPO. Every other <svg> in src/ is an
            icon or a spinner, so there was no diagram precedent to follow and
            this establishes one. It follows the house icon idiom
            (HomeClient.tsx:301-305, Header.tsx:35-37): stroke/fill =
            "currentColor", the colour supplied by a Tailwind text-* token on
            a wrapping <g>. NO hex — BacktestPanel.tsx:80 and
            strategy-builder.ts:1384 hardcode token values and are drift bugs,
            not precedent. currentColor carries ONE colour per subtree, so
            elements are grouped by COLOUR, not by meaning. On DESKTOP that now
            costs a single group: the SVG draws only the dashed fan and BY HAND,
            both faint, because the sheet left the drawing entirely (see below).
            The MOBILE SVG still draws its sheet and keeps the four-group split:
            the bg-row <g> holds the header bands ALONE and comes first so every
            rule and every name draws over them; the faint <g> holds the fan,
            BY HAND, the sheets' inner rules and their column headers; a
            brand-purple <g> holds the tool names; the muted <g> holds each
            sheet's outer border and header rule.

            TWO SVGs, BREAKPOINT-SWAPPED — not one responsive viewBox. These
            are two different drawings, not one drawing at two sizes: desktop
            runs the lines rightward and converges on the sheet's LEFT edge,
            mobile runs them downward and converges on its TOP edge. One
            viewBox cannot express both, and stretching either into the
            other's aspect would skew the dash pattern and the angles — which
            are the whole point of the figure. Each SVG renders at its viewBox
            size 1:1 (no scaling at all), and that is what lets the six HTML
            labels be positioned in exact pixels against the line origins.

            The six labels and A SPREADSHEET are real HTML text in the mono
            lockup (:853's idiom), never SVG <text> — selectable, findable and
            translatable.

            THE SVG-<text> EXCEPTION IS RETIRED ON DESKTOP. It was granted
            because thirty-one strings inside a drawn grid would have needed
            thirty-one absolute pixel offsets over the SVG. That reasoning died
            with the grid: the desktop sheet is a real HTML <table>, which sizes
            itself from padding and line-height, so all thirty-one coordinates
            disappear rather than moving into HTML. The desktop SVG is back to
            what the rule always wanted — a drawing and nothing else — and the
            table's contents are selectable, findable and translatable like
            every other string in the section. The exception survives on MOBILE
            only, where the two stacked sheets are still drawn.

            The six family labels stay HTML absolutely positioned over the fan,
            which is what the rule was written for. BY HAND, part of the drawing
            itself, is still inside the SVG. ─────────────────────────────────────────── */}
      <section id="deck-01" aria-label="The problem" className={openSteps[0] ? 'max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px]' : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[0]}
          aria-controls="deck-01-body"
          onClick={() => toggleStep(0)}
          className={DECK.stepButton}
        >
          <span className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">01 / IDENTIFY THE PROBLEM</span>
          <span aria-hidden="true" className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">{openSteps[0] ? '−' : '+'}</span>
        </button>
        <div id="deck-01-body" className={openSteps[0] ? undefined : 'hidden'}>
          <h2 className="mt-[18px] text-[27px] lg:text-[38px] font-medium tracking-[-0.025em] text-brand-purple">
            Twenty-five tools.<br />None of them knows what the others did.
          </h2>
          <p className="mt-4 max-w-[680px] text-[15px] leading-[1.6] text-text-secondary">
            Your business is one system. Your software isn&apos;t.
          </p>

          {/* DESKTOP FAN — viewBox 900×224, rendered 1:1. Origins sit at x=168,
              clear of the label column; each line runs right to x=336 then
              angles to one point on the sheet's left edge (560, 112). The two
              middle lines run nearly level while the outer four angle hard —
              that spread IS the convergence.
  FLUID, NOT 1:1. Design measured a 1728px artboard; scaled
              to this site's 1216px of content that is 507 diagram + 73 gap + 636
              sheet. But 1216px of content only exists at viewport >= 1280, while
              `lg:` starts at 1024 — at 1024 the container is 960px, so a fixed
              row would have scrolled sideways by 256px across the whole band.
              The row is therefore proportional: 41.6941% / 5.8388% / 52.4671%,
              the exact ratios of 507 / 71 / 638 over 1216, summing to 100%. At
              the 1280 reference every part lands on Design's integer px; below
              it the whole figure scales, diagram and sheet together.
              TYPE SCALES WITH THE BOX. A fluid box holding fixed 11px type is
              not fluid — measured, "Fixed Assets" stops fitting its column below
              about 1205px of viewport, wrapping to two lines and blowing the 26px
              row rhythm. So the sheet column is a container-query context and the
              table's type and padding are cqw fractions of it: 11px -> 1.72414cqw,
              9px -> 1.41066cqw, 7px -> 1.09718cqw, 10px -> 1.5674cqw, 12px ->
              1.88088cqw, 8px -> 1.25392cqw, each x/638 as a percentage. Rule
              weights alone stay in px, per Design's own 0.75-not-0.5 ruling.
              THE JOIN STOPS SHORT. The fan converges at (505, 166) and the sheet
              begins a gap away; Design leaves the lines aiming at the sheet
              rather than landing on it, and that gap is the point. */}
          <div className="mt-6 hidden lg:mt-8 lg:flex lg:items-start">
            {/* DIAGRAM — 507 of the 1216 row. The SVG is fluid (w-full over a
                fixed viewBox), so it holds Design's proportions at every width
                and hits her exact 507x310 at the 1280 reference. */}
            <div className="relative w-[41.6941%]">
              <svg role="img" viewBox={`0 0 ${PROBLEM_FAN_LG.w} ${PROBLEM_FAN_LG.h}`} className="h-auto w-full">
                <title>Six kinds of places, copied by hand into one spreadsheet</title>
                <g className="text-text-faint" stroke="currentColor" fill="none">
                  {PROBLEM_LABEL_TOP_LG.map((y) => (
                    <path
                      key={y}
                      d={`M${PROBLEM_FAN_LG.originX} ${y} H${PROBLEM_FAN_LG.bendX} L${PROBLEM_FAN_LG.joinX} ${PROBLEM_FAN_LG.joinY}`}
                      strokeWidth={1}
                      strokeDasharray="3 5"
                    />
                  ))}
                  <text x={430} y={70} textAnchor="middle" fontSize={10} letterSpacing={1.4} className="font-mono" fill="currentColor" stroke="none">BY HAND</text>
                </g>
              </svg>
              {PROBLEM_SOURCES.map((label, i) => (
                <p
                  key={label}
                  className="absolute left-0 -translate-y-1/2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-purple"
                  style={{ top: `${(PROBLEM_LABEL_TOP_LG[i] / PROBLEM_FAN_LG.h) * 100}%` }}
                >
                  {label}
                </p>
              ))}
            </div>

            {/* GAP — 71 of 1216. Design's 73 less the 2px the table's border-box
                conversion needs; whitespace is the cheapest place to find 2px and
                it keeps the column grid at exactly 106. */}
            <div className="w-[5.8388%]" aria-hidden="true" />

            {/* SHEET — 638 of 1216 (Design's 636 CONTENT + the table's 1px left
                and right borders, since Preflight puts every box in border-box).
                The column is the container-query context: the table's type and
                padding are cqw fractions of it, so the sheet scales in lockstep
                with the diagram instead of holding 11px type inside a shrinking
                box. Rule weights stay in px — Design's own ruling that 0.75
                must not go sub-pixel applies at every width, not just 1280. */}
            <div className="w-[52.4671%] [container-type:inline-size]">
              <table className="w-full table-fixed border-separate border-spacing-0 border border-border">
                <thead>
                  <tr>
                    {PROBLEM_SHEET.map((col, c) => (
                      <th
                        key={col.header}
                        scope="col"
                        className={`whitespace-nowrap bg-bg-row px-[1.5674cqw] py-[1.09718cqw] text-left align-middle font-mono text-[1.41066cqw] font-semibold uppercase leading-[1.25392cqw] tracking-[0.12em] text-text-faint border-b border-b-border ${c < 5 ? 'border-r-[0.75px] border-r-text-faint' : ''}`}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4, 5].map((r) => (
                    <tr key={r}>
                      {PROBLEM_SHEET.map((col, c) => (
                        <td
                          key={col.header}
                          className={`whitespace-nowrap px-[1.5674cqw] py-[1.09718cqw] align-middle font-mono text-[1.72414cqw] leading-[1.88088cqw] text-brand-purple ${r < 5 ? 'border-b-[0.75px] border-b-text-faint' : ''} ${c < 5 ? 'border-r-[0.75px] border-r-text-faint' : ''}`}
                        >
                          {col.tools[r] ?? '\u00A0'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* CAPTION-ANCHOR: a child of the sheet column, so the line starts
                  at the table's left edge with no offset of its own. */}
              <p className="mt-5 text-[15px] leading-[1.6] text-text-secondary">
                {PROBLEM_SHEET_CAPTION}
              </p>
            </div>
          </div>

          {/* MOBILE FAN — viewBox 280×570, rendered 1:1 (280 clears the 288px
              content width of a 320px viewport). Each line leaves its own label
              at x=100 and angles DOWN to one point on the sheet's top edge
              (140, 230). THE FAN IS UNTOUCHED by the sheet rewrite: same six
              origins, same convergence point, same weights — only the viewBox
              FLOOR moved, and a viewBox growing downward cannot move anything
              already drawn above it.
              TWO STACKED GRIDS, NOT ONE OF SIX. Six columns do not fit 280px —
              240px of sheet would give 40px a column, under what the longer names
              need at fontSize 7 — so the phone splits the sheet: Grid A
              (WORK · IN · OUT) keeps the original grid's box at y=230 so the
              convergence point still lands on a real top edge, and Grid B
              (OWN · OWE · PROOF) sits 30px below A's bottom edge, at y=410. Each
              is 240 / 3 = 80px a column (dividers at x=100/180, text at
              24 + c*80), with the same header band, the same six 20px data rows
              and the same rule weights as desktop. Both grids share x=20, so the
              spreadsheet caption's pl-[20px] still aligns to both and does not
              move. Every coordinate derives from each grid's `top` — the split
              and its geometry live together in PROBLEM_SHEET_SM. */}
          <div className="relative mt-6 lg:hidden">
            <svg role="img" viewBox="0 0 280 570" className="h-[570px] w-[280px]">
              <title>Six kinds of places, copied by hand into one spreadsheet</title>
              <g className="text-bg-row" fill="currentColor" stroke="none">
                {PROBLEM_SHEET_SM.map(({ top }) => (
                  <rect key={top} x={20} y={top} width={240} height={30} />
                ))}
              </g>
              <g className="text-text-faint" stroke="currentColor" fill="none">
                {[13, 39, 65, 91, 117, 143].map((y) => (
                  <path key={y} d={`M100 ${y} L140 230`} strokeWidth={1} strokeDasharray="3 4" />
                ))}
                <text x={200} y={185} textAnchor="middle" fontSize={10} letterSpacing={1.4} className="font-mono" fill="currentColor" stroke="none">BY HAND</text>
                {PROBLEM_SHEET_SM.flatMap(({ top, cols }) => [
                  ...[1, 2, 3, 4, 5].map((r) => (
                    <line key={`h${top}-${r}`} x1={20} y1={top + 30 + r * 20} x2={260} y2={top + 30 + r * 20} strokeWidth={0.75} />
                  )),
                  ...[100, 180].map((x) => (
                    <line key={`v${top}-${x}`} x1={x} y1={top} x2={x} y2={top + 150} strokeWidth={0.75} />
                  )),
                  ...cols.map((col, c) => (
                    <text key={`t${top}-${col.header}`} x={24 + c * 80} y={top + 18} fontSize={7} letterSpacing={0.6} fill="currentColor" stroke="none">{col.header}</text>
                  )),
                ])}
              </g>
              <g className="text-brand-purple" fill="currentColor" stroke="none">
                {PROBLEM_SHEET_SM.flatMap(({ top, cols }) =>
                  cols.flatMap((col, c) =>
                    col.tools.map((tool, r) => (
                      <text key={`${col.header}-${tool}`} x={24 + c * 80} y={top + 43 + r * 20} fontSize={7}>{tool}</text>
                    )),
                  ),
                )}
              </g>
              <g className="text-text-muted" stroke="currentColor" fill="none" strokeWidth={1}>
                {PROBLEM_SHEET_SM.flatMap(({ top }) => [
                  <rect key={`r${top}`} x={20} y={top} width={240} height={150} />,
                  <line key={`hr${top}`} x1={20} y1={top + 30} x2={260} y2={top + 30} />,
                ])}
              </g>
            </svg>
            {PROBLEM_SOURCES.map((label, i) => (
              <p
                key={label}
                className={`absolute left-0 -translate-y-1/2 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-brand-purple ${PROBLEM_LABEL_TOP_SM[i]}`}
              >
                {label}
              </p>
            ))}
          </div>
          <p className="mt-2 max-w-[680px] pl-[20px] text-[15px] leading-[1.6] text-text-secondary lg:hidden">
            {PROBLEM_SHEET_CAPTION}
          </p>
          {/* PR-VOICE: the essay's problem pair, below the table on both
              breakpoints (the caption above carries the essay's spreadsheet
              sentence). */}
          <p className={`mt-6 ${DECK.statement}`}>The problem is none of these tools knows what the others did.</p>
          <p className={`mt-2 ${DECK.statement}`}>They don&apos;t talk to each other.</p>
          <p className="mt-6 text-[17px] lg:text-[20px] text-brand-purple">So who sends you all that data?</p>
          <div className="mt-4 h-[30px] lg:h-10 w-px bg-border" aria-hidden="true" />
        </div>
      </section>

      {/* ── PROVIDERS-02 / PICK THE PROVIDERS (PR-STEP-2 → PR-STEP2-VIZ).
            The step's visual: the provider MENU — THE JOB | TODAY | NEXT —
            replaces the eleven-line roster, the offerings sentence and the
            doors gloss (SHOW DON'T ECHO, Deck Law #7: the table IS that
            content, drawn once). Around it, essay verbatim: the sub, the
            pick-yours statement, the framing line, the more-join line, the
            closer — and the one line under the table is the essay's
            SnapTrade clause, verbatim, the ONLY place Robinhood may ever
            appear. Act grammar is the import act's, class for class; the
            table is the routing act's grammar via the DECK tokens
            (table/th/pad/rule) — provider names in the routing table's mono
            tier: TODAY and open NEXT doors purple, jobs and '—' cells the
            faint tier. NEXT is the wide column (w-[40%]): its longest cell
            is the five-name trades row, sized the way the routing act sized
            'classification'. All three columns survive mobile — the menu IS
            the slide's argument; multi-name cells wrap at their spaces.
            Nothing here is money and nothing is a kind word, so NO GOLD on
            this slide; rust never enters either — there is no band label
            and no live status. */}
      <section id="deck-02" aria-label="The providers" className={openSteps[1] ? 'max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px] border-t border-border' : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[1]}
          aria-controls="deck-02-body"
          onClick={() => toggleStep(1)}
          className={DECK.stepButton}
        >
          <span className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">02 / PICK THE PROVIDERS</span>
          <span aria-hidden="true" className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">{openSteps[1] ? '−' : '+'}</span>
        </button>
        <div id="deck-02-body" className={openSteps[1] ? undefined : 'hidden'}>
          <h2 className="mt-[26px] text-[27px] leading-[1.2] lg:text-[38px] tracking-[-0.025em] text-brand-purple">
            Every job has more than one company.<br />You pick yours.
          </h2>
          <p className="mt-[22px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">
            A tool is a job. A provider is a company you hire to feed that job.
          </p>
          {/* PR-STEP2-VIZ: the essay's pick-yours statement, verbatim. */}
          <p className={`mt-[14px] ${DECK.statement}`}>You pick yours. Your neighbor picks theirs. The system does not care; a provider is just rows in a table, so a new one is added, never built.</p>

          {/* THE MENU — the framing line in the label-above-table idiom the
              import act's arrivals strip uses, then the table itself. */}
          <p className={`mt-10 lg:mt-[76px] ${DECK.statement}`}>Here is who we speak to today:</p>
          <table className={`mt-[14px] lg:mt-[18px] ${DECK.table}`}>
            <thead>
              <tr>
                {([
                  ['THE JOB', 'w-[30%]'], ['TODAY', 'w-[30%]'], ['NEXT', 'w-[40%]'],
                ] as const).map(([head, w]) => (
                  <th key={head} scope="col" className={`${w} ${DECK.th}`}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROVIDER_MENU.map(([job, today, next], r) => {
                const rule = r === PROVIDER_MENU.length - 1 ? '' : DECK.rule;
                return (
                  <tr key={job}>
                    <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-text-faint`}>{job}</td>
                    <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-purple`}>{today}</td>
                    <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] ${next === '—' ? 'text-text-faint' : 'text-brand-purple'}`}>{next}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* The table's footnote — the essay's SnapTrade clause, verbatim. */}
          <p className={`mt-[14px] ${DECK.statement}`}>one connector called SnapTrade reaches Robinhood, Webull, and Public too.</p>

          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>More join over time. Each one is one new row!</p>
          <p className="mt-[22px] lg:mt-9 text-[17px] lg:text-[28px] text-brand-purple">So how do we actually get their data?</p>
        </div>
      </section>

      {/* ── IMPORT-03 / THE RAW IMPORT TABLE (PR-DECK reconcile). Act grammar
            unchanged: same container, same act padding, border-t closing the
            problem|import seam (see the seam ledger above).

            RUST REPLACES GOLD ON THE LABELS. The deck's token law — gold inks
            dollar amounts, debit/credit values and kind words ONLY — moved the
            band labels and TWELVE ARRIVALS to the deck's rust (brand-amber; the
            mapping is recorded in the file header). Gold still enters the
            numbered run at this act's arrivals? No — nothing here is money, so
            gold now first inks at 04's KIND column.

            THE FIELD TABLE IS TWO COLUMNS, NO HEADER ROW. The deck gives each
            field one plain-language description and names no column headers,
            so the old NAME/HOLDS/WHY thead died with the old vocabulary. The
            colgroup carries the fixed-layout widths the thead used to.

            EVERYTHING IS WEIGHT 400; HORIZONTAL RULES ONLY (border-b, never
            border-r; border-separate + border-spacing-0 so percentage columns
            stay predictable). BAND ROWS CARRY NO RULE BENEATH THEM — the rule
            that closes a group is the previous ROW's border-b, and the last
            data row drops its rule for the table's own outer border. The
            payload row's emphasis is the rust tail of its own description
            (IMPORT_COLUMNS third tuple slot) — no fill, no weight change. */}
      <section id="deck-03" aria-label="The import" className={openSteps[2] ? 'max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px] border-t border-border' : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[2]}
          aria-controls="deck-03-body"
          onClick={() => toggleStep(2)}
          className={DECK.stepButton}
        >
          <span className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">03 / IMPORT THE DATA</span>
          <span aria-hidden="true" className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">{openSteps[2] ? '−' : '+'}</span>
        </button>
        <div id="deck-03-body" className={openSteps[2] ? undefined : 'hidden'}>
          <h2 className="mt-[26px] text-[27px] leading-[1.2] lg:text-[38px] tracking-[-0.025em] text-brand-purple">
            Store what arrived.<br />Then decide what it means.
          </h2>
          <p className="mt-[22px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">
            Now we ask the providers we picked for their data.
          </p>
          {/* PR-VOICE → PR-STEP-2: the essay's arrival intro, above the
              field table. The provider-jobs sentence left with PR-STEP-2 —
              Step 02 owns provider glosses now. */}
          <p className={`mt-[14px] ${DECK.statement}`}>Every provider sends back an answer, and those answers are stored as an arrival.</p>
          <p className={`mt-2 ${DECK.statement}`}>Each arrival is stored as one row, in one table, before anyone decides what any of the data actually means.</p>

          {/* TABLE 1 — the field table, two columns, no thead (the deck names no
              headers). The colgroup carries the fixed-layout widths the thead
              used to; band rows are full-width colSpan cells in the deck's rust.
              The payload row's rust tail rides the row's own third tuple slot. */}
          <table className="mt-10 lg:mt-[76px] w-full table-fixed border-separate border-spacing-0 border border-border">
            <colgroup>
              <col className="w-[34%] lg:w-[25%]" />
              <col />
            </colgroup>
            {IMPORT_COLUMNS.map((group, b) => (
              <tbody key={group.band}>
                <tr>
                  <td colSpan={2} className="px-[11px] pt-[17px] pb-[7px] lg:px-5 lg:pt-6 lg:pb-[9px] align-top font-mono text-[10px] lg:text-[11px] uppercase tracking-[0.20em] text-brand-amber">{group.band}</td>
                </tr>
                {group.rows.map((row, r) => {
                  const [name = '', desc = '', emphasis] = row;
                  const isLast = b === IMPORT_COLUMNS.length - 1 && r === group.rows.length - 1;
                  const rule = isLast ? '' : 'border-b-[0.75px] border-b-text-faint';
                  const pad = 'px-[11px] py-[9px] lg:px-5 lg:py-[11px]';
                  return (
                    <tr key={name}>
                      <td className={`${pad} ${rule} align-top font-mono text-[11.5px] lg:text-[14px] text-brand-purple`}>{name}</td>
                      <td className={`${pad} ${rule} align-top text-[11px] leading-[1.4] lg:text-[13.5px] lg:leading-[1.45] text-text-faint`}>
                        {desc}
                        {emphasis !== undefined && <span className="font-mono text-brand-amber">{emphasis}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>

          <p className="mt-10 lg:mt-[76px] font-mono text-[10px] lg:text-[11px] uppercase tracking-[0.20em] text-brand-amber">TWELVE ARRIVALS, ONE TABLE</p>

          {/* TABLE 2 — the twelve arrivals, four columns
              (provider·connection | resource | time | status), no thead (the
              deck names no headers here either; the rust label above is the
              table's name). Mobile keeps provider, resource and status and
              drops the time — the one column that cannot shorten. Fixed-layout
              widths ride the first row's tds now that there is no header row.
              Status values are the deck's uppercase, and PENDING inks rust —
              the one arrival still in flight. */}
          <table className="mt-[14px] lg:mt-[18px] w-full table-fixed border-separate border-spacing-0 border border-border">
            <tbody>
              {IMPORT_ARRIVALS.map((row, r) => (
                <tr key={row[0]}>
                  {row.map((cell, c) => (
                    <td
                      key={cell}
                      className={`${c === 2 ? 'hidden lg:table-cell lg:w-[25%]' : 'w-[33.33%] lg:w-[25%]'} px-[11px] py-[9px] lg:px-5 lg:py-[11px] align-top font-mono text-[11px] lg:text-[13px] ${c === 0 ? 'text-brand-purple' : c === 3 && cell === 'PENDING' ? 'text-brand-amber' : 'text-text-faint'} ${r === IMPORT_ARRIVALS.length - 1 ? '' : 'border-b-[0.75px] border-b-text-faint'}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-10 lg:mt-[76px] h-px w-full bg-border" aria-hidden="true" />
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>This table is to show us that:</p>
          <div className="mt-[14px]">
            {IMPORT_TRIO.map((claim, i) => (
              <p key={claim} className={`${i === 0 ? '' : 'mt-3 lg:mt-[14px]'} text-[13px] leading-[1.5] lg:text-[16.5px] text-brand-purple`}>{claim}</p>
            ))}
          </div>
          <p className="mt-[22px] lg:mt-9 text-[17px] lg:text-[28px] text-brand-purple">Now — what kind of thing is each one?</p>
        </div>
      </section>

      {/* ── ROUTING-04 / THE ROUTING TABLE. Act grammar copied from the import
            act above, class for class: same max-w-7xl container, same px, same
            pt-9 lg:pt-[60px] pb-9 lg:pb-[60px], same eyebrow/headline/support
            sizes, and a border-t which is the page's rule for the
            import|routing seam. Everything is weight 400 — which is why every
            th carries an explicit font-normal: Preflight does not reset the
            UA's `th { font-weight: bold }`, so a th without it ships at 700.

            ONE TABLE, FOUR EQUAL QUARTERS, ruled horizontally only. No interior
            verticals on this slide either — the same calm the import tables
            read with — so cells set border-b and never border-r.
            border-separate + border-spacing-0 rather than the house
            border-collapse, because collapsed borders are half-inside the box
            and make percentage columns unpredictable.

            THE anthropic ROW is the emphasis and differs in EXACTLY ONE way:
            bg-bg-row across its cells. No weight change, no size change, no
            border accent, no gold beyond the KIND column every row already
            has. The point lands because the row is filled, not because it
            shouts.

            MOBILE COLUMNS ARE NOT EQUAL THIRDS, deliberately: 30 / 40 / 30.
            Equal thirds were measured and 'classification' — the longest
            resource name, one unbreakable token — overflowed its cell by 1.1px
            at 375. The four quarters the spec fixes are a DESKTOP measurement;
            below lg the three surviving columns are sized to what they hold,
            which is what a table does. Do not 'tidy' these back to 33.33%
            without re-measuring the longest token first.

            MOBILE reuses the import act's old payload pattern rather than
            inventing a second one: MEANS is dropped, and the derived row's
            'math we did — never a source' follows as its own colSpan={3} row
            with the same fill and no rule between, so the two read as one
            block. (The other kinds' first-appearance means are desktop-only —
            the deck's own mobile treatment drops the column.) NO PHANTOM
            COLUMN: the only colSpan here lives on an lg:hidden ROW, and a row
            with display:none leaves the table model entirely, so desktop counts
            four columns from the header and mobile counts three. ─────────── */}
      <section id="deck-04" aria-label="The routing" className={openSteps[3] ? 'max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px] border-t border-border' : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[3]}
          aria-controls="deck-04-body"
          onClick={() => toggleStep(3)}
          className={DECK.stepButton}
        >
          <span className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">04 / LABEL THE DATA</span>
          <span aria-hidden="true" className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">{openSteps[3] ? '−' : '+'}</span>
        </button>
        <div id="deck-04-body" className={openSteps[3] ? undefined : 'hidden'}>
          <h2 className="mt-[26px] text-[27px] leading-[1.2] lg:text-[38px] tracking-[-0.025em] text-brand-purple">
            One rule per feed.<br />Written down.
          </h2>
          <p className="mt-[22px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">
            Now we examine the data that we just imported in Step 3, and we give every feed a label.
          </p>
          {/* PR-VOICE → PR-STEP-2: the essay's feed gloss. The
              Duffel/Anthropic caption left with PR-STEP-2 — Step 02 owns
              provider glosses now, so no provider is introduced here. */}
          <p className={`mt-[14px] ${DECK.statement}`}>A feed is one provider-and-resource pair; like Stripe&apos;s payouts, or Plaid&apos;s transactions, or TastyTrade&apos;s quotes.</p>

          <table className="mt-10 lg:mt-[76px] w-full table-fixed border-separate border-spacing-0 border border-border">
            <thead>
              <tr>
                {([
                  ['PROVIDER', 'w-[30%]'], ['RESOURCE', 'w-[40%]'], ['KIND', 'w-[30%]'], ['MEANS', 'hidden lg:table-cell'],
                ] as const).map(([head, sm]) => (
                  <th
                    key={head}
                    scope="col"
                    className={`${sm} lg:w-[25%] bg-bg-row px-[11px] py-[9px] lg:px-5 lg:py-3 text-left align-top font-mono text-[10px] lg:text-[11px] font-normal uppercase tracking-[0.18em] text-text-faint border-b border-b-border`}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROUTING_RULES.map(([provider, resource, kind, means], r) => {
                const isDerived = provider === ROUTING_DERIVED_ROW;
                const isLast = r === ROUTING_RULES.length - 1;
                // Rule policy, kept from the pre-deck import pattern: a normal
                // row rules at both breakpoints; a derived row keeps its rule on
                // desktop and drops it on mobile, where MEANS follows as a
                // second row the two must read as one block; the last row rules
                // at neither, because the table's outer border closes it.
                // THE isDerived BRANCH IS INERT TODAY and that is not a mistake:
                // anthropic is both the derived row AND the last row, so isLast
                // wins and this row takes no rule at either breakpoint — the
                // correct result. It is kept rather than simplified away because
                // the moment a rule is appended after anthropic the branch has to
                // fire, and losing it would silently put a hairline between the
                // derived row and its own continuation row on mobile, breaking
                // the one-block reading with nothing to catch it. The import act's
                // 'payload' sits mid-table, so there the branch is live.
                const rule = isLast ? '' : isDerived ? 'lg:border-b-[0.75px] lg:border-b-text-faint' : 'border-b-[0.75px] border-b-text-faint';
                const fill = isDerived ? 'bg-bg-row' : '';
                const pad = 'px-[11px] py-[9px] lg:px-5 lg:py-[11px]';
                return (
                  <Fragment key={`${provider}-${resource}`}>
                    <tr>
                      <td className={`${pad} ${fill} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-purple`}>{provider}</td>
                      <td className={`${pad} ${fill} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-purple`}>{resource}</td>
                      <td className={`${pad} ${fill} ${rule} align-top font-mono text-[11px] lg:text-[13px] uppercase text-brand-gold`}>{kind}</td>
                      <td className={`hidden lg:table-cell ${pad} ${fill} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-text-faint`}>{means}</td>
                    </tr>
                    {isDerived && (
                      <tr className="lg:hidden">
                        <td colSpan={3} className={`${fill} ${isLast ? '' : 'border-b-[0.75px] border-b-text-faint'} px-[11px] pt-0 pb-[9px] align-top font-mono text-[11px] leading-[1.4] text-text-faint`}>{means}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {/* PR-VOICE: the essay's fifth-kind tease and the rule block, after
              the routing table. */}
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>And there is a fifth kind; but no feed ever earns it. We will meet it soon.</p>
          <p className={`mt-2 ${DECK.statement}`}>Here is what makes this step different from every software you have ever met: each kind is given by a rule, and a rule is one written row in a table. Anyone can read it. Anyone can argue with it. It is not a guess buried in code.</p>
          <div className="mt-8 lg:mt-12 h-px w-full bg-border" aria-hidden="true" />
          <p className="mt-[22px] lg:mt-8 text-[12px] lg:text-[14px] text-text-faint">
            When a new provider shows up, we add rows; not code, and not new tables.
          </p>
          <p className="mt-[22px] lg:mt-9 text-[17px] lg:text-[28px] text-brand-purple">So how many tables are there?</p>
        </div>
      </section>

      {/* ── HANDOFF-05 / FIVE. THE KIND IS THE ADDRESS (PR-DECK reconcile).
            Act grammar unchanged: same container, act padding, border-t
            closing the routing|handoff seam. Everything is weight 400 — every
            th carries an explicit font-normal because Preflight does not reset
            the UA's `th { font-weight: bold }`.

            TWO COLUMNS NOW. The deck collapsed the old kind/table pair into
            one lowercase word (the kind IS the table's name on this slide, so
            a second column would repeat it) and renamed the prose column
            HOLDS. KIND stays gold — kind words are gold's one non-money
            licence — and the aria-hidden arrow stays presentation, not data,
            right-aligned in the KIND cell so kind→holds reads as one movement.

            NO ROW IS EMPHASISED — the five kinds are peers.

            THE ENDING GREW A NOTICE BLOCK: statement, then three
            statement-tier lines the deck uses to set up 05 and 09 (posting is
            the one table nobody sends you), then the closing question. */}
      <section id="deck-05" aria-label="The handoff" className={openSteps[4] ? 'max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px] border-t border-border' : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[4]}
          aria-controls="deck-05-body"
          onClick={() => toggleStep(4)}
          className={DECK.stepButton}
        >
          <span className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">05 / MAP THE DATA TO ITS TABLE</span>
          <span aria-hidden="true" className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">{openSteps[4] ? '−' : '+'}</span>
        </button>
        <div id="deck-05-body" className={openSteps[4] ? undefined : 'hidden'}>
          <h2 className="mt-[26px] text-[27px] leading-[1.2] lg:text-[38px] tracking-[-0.025em] text-brand-purple">
            Five.<br />The kind is the address.
          </h2>
          <p className="mt-[22px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">
            Now we take every labeled arrival and move it into a table; one table per kind.
          </p>

          <table className="mt-10 lg:mt-[76px] w-full table-fixed border-separate border-spacing-0 border border-border">
            <thead>
              <tr>
                {([
                  ['KIND', 'w-[32%] lg:w-[16%]'], ['HOLDS', 'w-[68%] lg:w-[84%]'],
                ] as const).map(([head, w]) => (
                  <th
                    key={head}
                    scope="col"
                    className={`${w} bg-bg-row px-[11px] py-[9px] lg:px-5 lg:py-3 text-left align-top font-mono text-[10px] lg:text-[11px] font-normal uppercase tracking-[0.18em] text-text-faint border-b border-b-border`}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HANDOFF_KINDS.map(([kind, holds], r) => {
                const rule = r === HANDOFF_KINDS.length - 1 ? '' : 'border-b-[0.75px] border-b-text-faint';
                const pad = 'px-[11px] py-[9px] lg:px-5 lg:py-[11px]';
                return (
                  <tr key={kind}>
                    <td className={`${pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-gold`}>
                      <span className="flex items-baseline justify-between gap-2">
                        {kind}
                        <span aria-hidden="true" className="text-text-muted">→</span>
                      </span>
                    </td>
                    <td className={`${pad} ${rule} align-top text-[11px] leading-[1.4] lg:text-[13px] lg:leading-normal text-text-faint`}>{holds}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-10 lg:mt-[76px] h-px w-full bg-border" aria-hidden="true" />
          <p className="mt-[22px] lg:mt-8 text-[17px] lg:text-[28px] text-brand-purple">
            Twenty-five tools, five tables; because we sorted by what a thing is, not by which tool it came from.
          </p>
          <div className="mt-[14px] lg:mt-5">
            <p className="text-[12px] lg:text-[14px] text-text-faint">But notice something strange here!</p>
            <p className="mt-2 text-[12px] lg:text-[14px] text-text-faint">(1) Providers only ever fill three of the five: reference, registry, and event.</p>
            <p className="mt-2 text-[12px] lg:text-[14px] text-text-faint">(2) Derived is filled only by our own math.</p>
            <p className="mt-2 text-[12px] lg:text-[14px] text-text-faint">(3) And posting? Nothing from the outside world ever lands there. Nobody sends you debits and credits. Remember that; it matters soon.</p>
          </div>
          <p className="mt-[22px] lg:mt-9 text-[17px] lg:text-[28px] text-brand-purple">Everything so far arrived from the world. So where do the things you do live?</p>
        </div>
      </section>

      {/* ── DECK-06 / OBSERVED VS AUTHORED. First of the PR-DECK back nine. From
            here down, the act grammar rides the module-scope DECK const so
            nine acts cannot drift from 01–04 or from each other. Bare
            two-column prose — the deck gives 05 no table. border-t closes
            handoff|06 per the seam ledger. */}
      <section id="deck-06" aria-label="Observed vs authored" className={openSteps[5] ? DECK.section : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[5]}
          aria-controls="deck-06-body"
          onClick={() => toggleStep(5)}
          className={DECK.stepButton}
        >
          <span className={DECK.eyebrow}>06 / SEPARATE WHAT HAPPENED TO YOU FROM WHAT YOU DID</span>
          <span aria-hidden="true" className={DECK.eyebrow}>{openSteps[5] ? '−' : '+'}</span>
        </button>
        <div id="deck-06-body" className={openSteps[5] ? undefined : 'hidden'}>
          <h2 className={DECK.h2}>
            Some things happen to you.<br />Some things you make happen.
          </h2>
          <p className={DECK.sub}>
            Every piece of data in the whole system is one of these two flavors. That&apos;s the whole trick.
          </p>

          <div className="mt-10 lg:mt-[76px] grid gap-8 lg:grid-cols-2 lg:gap-12">
            {LANE_COLUMNS.map((lane) => (
              <div key={lane.header}>
                <p className={DECK.rust}>{lane.header}</p>
                {lane.lines.map((line, i) => (
                  <p key={line} className={`${i === 0 ? 'mt-[10px]' : 'mt-3'} text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary`}>{line}</p>
                ))}
              </div>
            ))}
          </div>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={DECK.q}>So how exactly do you make something happen?</p>
        </div>
      </section>

      {/* ── DECK-07 / THE LOOP. The four-beat band is Design's spec: four
            equal flex columns, 32px arrow slots between — a 1px lavender
            shaft (bg-border) plus a 5×5 chevron of two 1px #B9B2C6 strokes
            rotated 45° (no token covers #B9B2C6; exact hex per the deck's
            token law), shaft centred on the beat-name line. Mobile stacks the
            beats and drops the arrows. */}
      <section id="deck-07" aria-label="The loop" className={openSteps[6] ? DECK.section : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[6]}
          aria-controls="deck-07-body"
          onClick={() => toggleStep(6)}
          className={DECK.stepButton}
        >
          <span className={DECK.eyebrow}>07 / RUN THE LOOP</span>
          <span aria-hidden="true" className={DECK.eyebrow}>{openSteps[6] ? '−' : '+'}</span>
        </button>
        <div id="deck-07-body" className={openSteps[6] ? undefined : 'hidden'}>
          <h2 className={DECK.h2}>
            Every tool runs the same four beats.<br />Discover. Decide. Commit. Record.
          </h2>
          <p className={DECK.sub}>
            Book a flight, place a trade, send an invoice; same loop, different nouns.
          </p>

          <div className="mt-10 lg:mt-[76px] flex flex-col gap-6 lg:flex-row lg:gap-0">
            {LOOP_BEATS.map(([beat, caption], i) => (
              <Fragment key={beat}>
                {i > 0 && (
                  <div aria-hidden="true" className="relative hidden w-8 shrink-0 lg:block">
                    <span className="absolute left-0 right-[2px] top-[8px] h-px bg-border" />
                    <span className="absolute right-[2px] top-[8px] h-[5px] w-[5px] -translate-y-1/2 rotate-45 border-r border-t border-[#B9B2C6]" />
                  </div>
                )}
                <div className="lg:flex-1">
                  <p className="font-mono text-[13px] font-semibold tracking-[0.12em] text-brand-purple">{beat}</p>
                  <p className="mt-2 text-[11px] text-text-faint">{caption}</p>
                </div>
              </Fragment>
            ))}
          </div>

          <table className={`mt-10 lg:mt-[76px] ${DECK.table}`}>
            <thead>
              <tr>
                <th scope="col" className={`w-[22%] lg:w-[16%] ${DECK.th}`} />
                {(['TRAVEL', 'TRADING', 'INVOICING'] as const).map((head) => (
                  <th key={head} scope="col" className={DECK.th}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LOOP_ROWS.map(([beat, travel, trading, invoicing], r) => {
                const rule = r === LOOP_ROWS.length - 1 ? '' : DECK.rule;
                return (
                  <tr key={beat}>
                    <th scope="row" className={`${DECK.pad} ${rule} text-left align-top font-mono text-[10px] lg:text-[11px] font-normal uppercase tracking-[0.18em] text-text-faint`}>{beat}</th>
                    {[travel, trading, invoicing].map((cell, c) => (
                      <td key={c} className={`${DECK.pad} ${rule} align-top text-[11px] leading-[1.4] lg:text-[13px] lg:leading-normal text-text-faint`}>{cell}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>Twenty-five tools. Twenty-five loops. One shape!</p>
          <p className={DECK.q}>Twenty-five loops. Where do all the commits land?</p>
        </div>
      </section>

      {/* ── DECK-08 / THE MASTER TABLE. The 03 field-table idiom: two
            columns, no thead (the deck names no headers), one rust label
            above, colgroup carrying the fixed-layout widths. */}
      <section id="deck-08" aria-label="The master table" className={openSteps[7] ? DECK.section : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[7]}
          aria-controls="deck-08-body"
          onClick={() => toggleStep(7)}
          className={DECK.stepButton}
        >
          <span className={DECK.eyebrow}>08 / STORE EVERYTHING YOU DO IN ONE MASTER TABLE</span>
          <span aria-hidden="true" className={DECK.eyebrow}>{openSteps[7] ? '−' : '+'}</span>
        </button>
        <div id="deck-08-body" className={openSteps[7] ? undefined : 'hidden'}>
          <h2 className={DECK.h2}>
            One table holds<br />everything you do.
          </h2>
          <p className={DECK.sub}>
            Every authored thing — a booking, an invoice, a trade, a filing, a budget — is stored as one document in one master table.
          </p>

          {/* VOICE-2 / SHOW DON'T ECHO: the rust label IS the framing line —
              text echoing text is the same offence as text echoing a drawing,
              so the statement-tier duplicate died. */}
          <p className={`mt-10 lg:mt-[76px] ${DECK.rust}`}>EVERY DOCUMENT CARRIES THE SAME FOUR THINGS</p>
          <table className={`mt-[14px] lg:mt-[18px] ${DECK.table}`}>
            <colgroup>
              <col className="w-[34%] lg:w-[25%]" />
              <col />
            </colgroup>
            <tbody>
              {MASTER_ROWS.map(([name, desc], r) => {
                const rule = r === MASTER_ROWS.length - 1 ? '' : DECK.rule;
                return (
                  <tr key={name}>
                    <td className={`${DECK.pad} ${rule} align-top font-mono text-[11.5px] lg:text-[14px] text-brand-purple`}>{name}</td>
                    <td className={`${DECK.pad} ${rule} align-top text-[11px] leading-[1.4] lg:text-[13.5px] lg:leading-[1.45] text-text-faint`}>{desc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>Different names, same shape. That is why one table can hold them all!</p>
          <p className={DECK.q}>You committed. The world moved. But how do you know the money really landed?</p>
        </div>
      </section>

      {/* ── DECK-09 / THE MATCH. Design's match visual: grid 1fr | 260px |
            1fr. Cards are border-border (the 1px lavender) on bg-ts-white
            (the token the spec's #FFFDF9 resolves to), 12×16 padding, three
            mono-12 spans space-between; rust label 10px above each. Centre:
            MATCH mono 10/600/0.12em aubergine flanked by hairlines with 10px
            gaps; caption 11px faint centred 8px beneath. The centre column's
            lg padding-top optically centres MATCH on the card row. Mobile
            stacks the three cells; the flanking hairlines are desktop-only. */}
      <section id="deck-09" aria-label="The match" className={openSteps[8] ? DECK.section : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[8]}
          aria-controls="deck-09-body"
          onClick={() => toggleStep(8)}
          className={DECK.stepButton}
        >
          <span className={DECK.eyebrow}>09 / MATCH WHAT HAPPENED TO WHAT YOU DID</span>
          <span aria-hidden="true" className={DECK.eyebrow}>{openSteps[8] ? '−' : '+'}</span>
        </button>
        <div id="deck-09-body" className={openSteps[8] ? undefined : 'hidden'}>
          <h2 className={DECK.h2}>
            The deposit meets the invoice.<br />The fill meets the order.
          </h2>
          <p className={DECK.sub}>
            Now observed meets authored.
          </p>

          <div className="mt-10 lg:mt-[76px] grid gap-6 lg:grid-cols-[1fr_260px_1fr] lg:gap-0">
            <div>
              <p className={DECK.rust}>{MATCH_CARDS[0].label}</p>
              <div className="mt-[10px] flex items-baseline justify-between gap-2 border border-border bg-ts-white px-4 py-3">
                <span className="font-mono text-[12px] text-brand-purple">{MATCH_CARDS[0].name}</span>
                <span className="font-mono text-[12px] text-brand-gold">{MATCH_CARDS[0].amount}</span>
                <span className="font-mono text-[12px] text-text-muted">{MATCH_CARDS[0].date}</span>
              </div>
            </div>
            <div className="lg:px-[10px] lg:pt-[33px]">
              <div className="flex items-center gap-[10px]">
                <span className="hidden h-px flex-1 bg-border lg:block" aria-hidden="true" />
                <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-brand-purple">MATCH</span>
                <span className="hidden h-px flex-1 bg-border lg:block" aria-hidden="true" />
              </div>
              <p className="mt-2 text-[11px] text-text-faint lg:text-center">amount + date + reference → one match.</p>
            </div>
            <div>
              <p className={DECK.rust}>{MATCH_CARDS[1].label}</p>
              <div className="mt-[10px] flex items-baseline justify-between gap-2 border border-border bg-ts-white px-4 py-3">
                <span className="font-mono text-[12px] text-brand-purple">{MATCH_CARDS[1].name}</span>
                <span className="font-mono text-[12px] text-brand-gold">{MATCH_CARDS[1].amount}</span>
                <span className="font-mono text-[12px] text-text-muted">{MATCH_CARDS[1].date}</span>
              </div>
            </div>
          </div>

          <div className={DECK.hairline} aria-hidden="true" />
          {/* PR-VOICE + Deck Law #7 (show don't echo): the cards and the
              centre caption CARRY the invoice/deposit story and the three
              checks — the text below never restates them. */}
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>Click; one match.</p>
          <p className={`mt-2 ${DECK.statement}`}>The deposit found its invoice. The fill found its order. The card charge found its booking. Nobody hunted through statements!</p>
          <p className={`mt-2 ${DECK.statement}`}>(A piece of this is already alive today: card charges find their bookings on their own.)</p>
          <p className={`mt-2 ${DECK.statement}`}>Matched means real; the world just confirmed what you did.</p>
          <p className={DECK.q}>Matched and real. So who writes the debits and credits?</p>
        </div>
      </section>

      {/* ── DECK-10 / THE POSTING. Definition strip (the border-y strip
            idiom), the rules table with gold debit/credit values, the worked
            sale, and the no-money strip. Gold here is exactly its licence:
            dollar amounts and debit/credit values. */}
      <section id="deck-10" aria-label="The posting" className={openSteps[9] ? DECK.section : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[9]}
          aria-controls="deck-10-body"
          onClick={() => toggleStep(9)}
          className={DECK.stepButton}
        >
          <span className={DECK.eyebrow}>10 / LET THE RULES WRITE THE LINES</span>
          <span aria-hidden="true" className={DECK.eyebrow}>{openSteps[9] ? '−' : '+'}</span>
        </button>
        <div id="deck-10-body" className={openSteps[9] ? undefined : 'hidden'}>
          <h2 className={DECK.h2}>
            Nobody sends them.<br />Rules write them.
          </h2>
          <p className={DECK.sub}>
            It is the same trick as Step 4. A rule is one written row that makes one decision. There, the rules gave kinds. Here, the rules write lines.
          </p>

          <div className="mt-10 lg:mt-[76px] border-y border-border py-[14px]">
            <p className="text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">Every time money moves, the rule writes two lines:</p>
            <p className="mt-2 text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">(1) a credit, for where the money came from,</p>
            <p className="mt-2 text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">(2) a debit, for where it went.</p>
            <p className="mt-2 text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">You never type them!</p>
            <p className="mt-2 font-mono text-[11px] lg:text-[12px] text-text-faint">Four quick glosses before we go on: A/R means money owed TO you. A/P means money YOU owe. Clearing means a holding bin that must end at zero. Withholdings means tax held back from a paycheck before it reaches anyone.</p>
          </div>

          <table className={`mt-10 lg:mt-[76px] ${DECK.table}`}>
            <thead>
              <tr>
                {([
                  ['EVENT', 'w-[40%] lg:w-[36%]'], ['DEBIT', 'w-[30%] lg:w-[32%]'], ['CREDIT', 'w-[30%] lg:w-[32%]'],
                ] as const).map(([head, w]) => (
                  <th key={head} scope="col" className={`${w} ${DECK.th}`}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {POSTING_RULES.map(([event, debit, credit], r) => {
                const rule = r === POSTING_RULES.length - 1 ? '' : DECK.rule;
                return (
                  <tr key={event}>
                    <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-purple`}>{event}</td>
                    <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-gold`}>{debit}</td>
                    <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-gold`}>{credit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className={`mt-10 lg:mt-[76px] ${DECK.rust}`}>ONE SALE, THREE LINES</p>
          <p className="mt-[14px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">
            <GoldSegments segments={SALE_SENTENCE} />
          </p>
          <div className="mt-[14px]">
            {SALE_LINES.map(([account, amount]) => (
              <p key={account} className="flex max-w-[260px] items-baseline justify-between font-mono text-[12px] leading-[1.9] lg:text-[13px]">
                <span className="text-brand-purple">{account}</span>
                <span className="text-brand-gold">{amount}</span>
              </p>
            ))}
          </div>
          <p className={`mt-[14px] ${DECK.statement}`}>And the deposit matches the bank to the penny!</p>

          <p className={`mt-10 lg:mt-[76px] ${DECK.rust}`}>WHO NEVER TOUCHES MONEY</p>
          <p className="mt-[14px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">
            {'One more truth: some tools never touch money. Calendar, Tasks, Time, CRM, Compliance, Budget, and FP&A never write a line. Your hours reach the books one way only; through Payroll.'}
          </p>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={DECK.q}>So what do all those lines add up to?</p>
        </div>
      </section>

      {/* ── DECK-11 / THE ANSWERS. QUESTION | THE MATH; the math's money
            words ink gold via the pre-split segments. The emphasis line is
            the deck's standalone rust. */}
      <section id="deck-11" aria-label="The answers" className={openSteps[10] ? DECK.section : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[10]}
          aria-controls="deck-11-body"
          onClick={() => toggleStep(10)}
          className={DECK.stepButton}
        >
          <span className={DECK.eyebrow}>11 / TURN THE LINES INTO ANSWERS</span>
          <span aria-hidden="true" className={DECK.eyebrow}>{openSteps[10] ? '−' : '+'}</span>
        </button>
        <div id="deck-11-body" className={openSteps[10] ? undefined : 'hidden'}>
          <h2 className={DECK.h2}>
            Every answer is math<br />on the lines.
          </h2>
          <p className={DECK.sub}>
            Four questions, answered at any moment.
          </p>

          <table className={`mt-10 lg:mt-[76px] ${DECK.table}`}>
            <thead>
              <tr>
                {([
                  ['QUESTION', 'w-[46%] lg:w-[40%]'], ['THE MATH', 'w-[54%] lg:w-[60%]'],
                ] as const).map(([head, w]) => (
                  <th key={head} scope="col" className={`${w} ${DECK.th}`}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ANSWER_ROWS.map(([question, math], r) => {
                const rule = r === ANSWER_ROWS.length - 1 ? '' : DECK.rule;
                return (
                  <tr key={question}>
                    <td className={`${DECK.pad} ${rule} align-top text-[11px] leading-[1.4] lg:text-[13px] lg:leading-normal text-brand-purple`}>{question}</td>
                    <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-text-faint`}><GoldSegments segments={math} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* PR-VOICE: the essay line renders once, in the statement tier;
              the rust caps line stays as the poster emphasis of it. */}
          <p className={`mt-10 lg:mt-[76px] ${DECK.statement}`}>Never typed. Never stale. This is the product!</p>
          <p className="mt-[14px] font-mono text-[11px] lg:text-[13px] uppercase tracking-[0.20em] text-brand-amber">THIS IS THE PRODUCT.</p>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={DECK.q}>Four answers. Where do you look?</p>
        </div>
      </section>

      {/* ── DECK-12 / THE TWO WINDOWS. Left: the mini ledger — the sale's
            three lines plus the travel line (LEDGER_ROWS carries the one
            flagged constructed figure). Right: Design's two-week calendar
            strip, fluid percentages over the given pixel geometry: day header
            of 14 equal columns on bg-bg-row (the header cream), 132px body
            with day gridlines in the same cream, 6px square aubergine bars,
            6px gold dots — the dots (here and in the deadline strip) are the
            deck's one licensed radius. Bar/dot offsets are inline styles, the
            house escape hatch for computed positioning (the PROBLEM fan's
            label tops, CalendarGrid.tsx:747). The deadline strip runs full
            width below both windows. */}
      <section id="deck-12" aria-label="The two windows" className={openSteps[11] ? DECK.section : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[11]}
          aria-controls="deck-12-body"
          onClick={() => toggleStep(11)}
          className={DECK.stepButton}
        >
          <span className={DECK.eyebrow}>12 / OPEN THE TWO WINDOWS</span>
          <span aria-hidden="true" className={DECK.eyebrow}>{openSteps[11] ? '−' : '+'}</span>
        </button>
        <div id="deck-12-body" className={openSteps[11] ? undefined : 'hidden'}>
          <h2 className={DECK.h2}>
            One Ledger. One Calendar.<br />All twenty-five.
          </h2>
          <p className={DECK.sub}>
            There are two windows, and every one of the twenty-five tools shows up in both:
          </p>

          <div className="mt-10 lg:mt-[76px] grid gap-10 lg:grid-cols-2 lg:gap-12">
            <div>
              <p className={DECK.rust}>THE LEDGER</p>
              <table className={`mt-[10px] ${DECK.table}`}>
                <thead>
                  <tr>
                    {([
                      ['DATE', 'w-[22%]'], ['LINE', 'w-[30%]'], ['DEBIT', 'w-[24%]'], ['CREDIT', 'w-[24%]'],
                    ] as const).map(([head, w]) => (
                      <th key={head} scope="col" className={`${w} ${DECK.th}`}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LEDGER_ROWS.map(([date, line, debit, credit], r) => {
                    const rule = r === LEDGER_ROWS.length - 1 ? '' : DECK.rule;
                    return (
                      <tr key={line}>
                        <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[12px] text-text-muted`}>{date}</td>
                        <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-purple`}>{line}</td>
                        <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-gold`}>{debit}</td>
                        <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-gold`}>{credit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <p className={DECK.rust}>THE CALENDAR</p>
              <div className="mt-[10px] border border-border">
                <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] border-b border-border bg-bg-row">
                  {CAL_DAYS.map((d) => (
                    <span key={d} className="py-1 text-center font-mono text-[9px] text-text-muted">{d}</span>
                  ))}
                </div>
                <div className="relative h-[132px]">
                  {Array.from({ length: 13 }, (_, i) => (
                    <span key={i} aria-hidden="true" className="absolute top-0 h-full w-px bg-bg-row" style={{ left: `${((i + 1) / 14) * 100}%` }} />
                  ))}
                  {CAL_BARS.map((bar) => (
                    <Fragment key={bar.label}>
                      <span
                        aria-hidden="true"
                        className="absolute h-[6px] bg-brand-purple"
                        style={{ left: `calc(${bar.left}% + 6px)`, width: `calc(${bar.width}% - 12px)`, top: bar.y }}
                      />
                      <span
                        className="absolute whitespace-nowrap font-mono text-[10px] text-brand-purple"
                        style={{ left: `calc(${bar.left}% + 6px)`, top: bar.y + 11 }}
                      >
                        {bar.label}
                      </span>
                    </Fragment>
                  ))}
                  {CAL_DOTS.map((dot) => (
                    <Fragment key={dot.label}>
                      <span
                        aria-hidden="true"
                        className="absolute h-[6px] w-[6px] rounded-full bg-brand-gold"
                        style={{ left: `calc(${((dot.day - 0.5) / 14) * 100}% - 3px)`, top: 96 }}
                      />
                      <span
                        className="absolute whitespace-nowrap font-mono text-[10px] text-text-secondary"
                        style={{ left: `calc(${((dot.day - 0.5) / 14) * 100}% + 9px)`, top: 94 }}
                      >
                        {dot.label}
                      </span>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className={`mt-8 lg:mt-12 ${DECK.statement}`}>Bars are things that last. Dots are things that happen.</p>

          <p className={`mt-8 lg:mt-12 ${DECK.rust}`}>THE REAL DEADLINES</p>
          <div className="mt-[10px] flex flex-wrap items-center gap-x-[14px] gap-y-2 border-y border-border py-[14px]">
            {CAL_DEADLINES.map((seg, i) => (
              <Fragment key={seg}>
                {i > 0 && <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-brand-gold" />}
                <span className="font-mono text-[11px] lg:text-[12px] text-text-secondary">{seg}</span>
              </Fragment>
            ))}
          </div>

          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>Twenty-five tools. Two windows!</p>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={DECK.q}>Can you watch one dollar run the whole machine?</p>
        </div>
      </section>

      {/* ── DECK-13 / THE THREADS. The hero thread rides Design's connector
            grid: a 20px gutter with a 1px lavender spine at x=2 and 5×5
            aubergine node squares; artifact cells rule with border-light (the
            token for the spec's #EBE4F7). Mobile stacks artifact under action
            inside the same grid via explicit col/row starts. The four-door
            table scrolls horizontally below lg (the house overflow-x-auto
            idiom — ModuleCostBreakdown above): dropping three of four doors
            would lose the slide. */}
      <section id="deck-13" aria-label="The threads" className={openSteps[12] ? DECK.section : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[12]}
          aria-controls="deck-13-body"
          onClick={() => toggleStep(12)}
          className={DECK.stepButton}
        >
          <span className={DECK.eyebrow}>13 / WATCH ONE DOLLAR RUN THE WHOLE MACHINE</span>
          <span aria-hidden="true" className={DECK.eyebrow}>{openSteps[12] ? '−' : '+'}</span>
        </button>
        <div id="deck-13-body" className={openSteps[12] ? undefined : 'hidden'}>
          <h2 className={DECK.h2}>
            One $500 sale runs the machine.<br />Then four more doors open.
          </h2>

          <div className="relative mt-10 lg:mt-[76px]">
            <span aria-hidden="true" className="absolute bottom-[20px] left-[2px] top-[20px] w-px bg-border" />
            {THREAD_ROWS.map(([n, action, artifact]) => (
              <div key={n} className="relative grid grid-cols-[20px_28px_1fr] lg:grid-cols-[20px_40px_340px_1fr]">
                <span aria-hidden="true" className="absolute left-0 top-[19px] h-[5px] w-[5px] bg-brand-purple" />
                <span />
                <p className="py-[14px] font-mono text-[11px] lg:text-[12px] text-text-muted">{n}</p>
                <p className="py-[14px] pr-4 text-[12px] leading-[1.5] lg:text-[13px] text-text-secondary">{action}</p>
                <p className="col-start-3 row-start-2 border-b border-border-light pb-[14px] font-mono text-[11px] leading-[1.5] lg:text-[12px] text-brand-purple lg:col-start-4 lg:row-start-1 lg:py-[14px]">
                  <GoldSegments segments={artifact} />
                </p>
              </div>
            ))}
          </div>
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>Nobody typed a debit anywhere in this story!</p>

          {/* PR-VOICE: the essay's door-opening framing, directly above the
              four-door table's rust label. */}
          <p className={`mt-10 lg:mt-[76px] ${DECK.statement}`}>Now open the other doors. Same machine, same eight beats; only the nouns change.</p>
          <p className={`mt-[14px] ${DECK.rust}`}>SAME MACHINE, SAME EIGHT BEATS</p>
          <div className="mt-[14px] overflow-x-auto lg:mt-[18px]">
            <table className={`min-w-[760px] ${DECK.table}`}>
              <thead>
                <tr>
                  <th scope="col" className={`w-[16%] ${DECK.th}`}>BEAT</th>
                  {DOOR_COLS.map((head) => (
                    <th key={head} scope="col" className={`w-[21%] ${DECK.th}`}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DOOR_ROWS.map(([beat, ...cells], r) => {
                  const rule = r === DOOR_ROWS.length - 1 ? '' : DECK.rule;
                  return (
                    <tr key={beat}>
                      <th scope="row" className={`${DECK.pad} ${rule} text-left align-top font-mono text-[10px] lg:text-[11px] font-normal uppercase tracking-[0.18em] text-text-faint`}>{beat}</th>
                      {cells.map((cell, c) => (
                        <td key={c} className={`${DECK.pad} ${rule} align-top text-[11px] leading-[1.4] lg:text-[13px] lg:leading-normal ${typeof cell === 'string' ? 'text-text-faint' : 'font-mono text-text-faint'}`}>
                          {typeof cell === 'string' ? cell : <GoldSegments segments={cell} />}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className={`mt-[22px] lg:mt-8 ${DECK.trio}`}>Read the last column twice! A project runs the whole loop — discover, decide, commit, match — and writes zero lines, because no money moved. The loop is bigger than money; money is just the loops that get a shadow.</p>
          {/* PR-VOICE: the two truths ride the old trade-close strip — truth
              (1) absorbed its content. */}
          <p className={`mt-[14px] ${DECK.statement}`}>Two more truths from this table:</p>
          <div className="mt-[10px] border-y border-border py-[14px]">
            <p className="font-mono text-[11px] leading-[1.6] lg:text-[12px] text-text-secondary">
              <GoldSegments segments={TRADE_CLOSE} />
            </p>
            <p className="mt-2 font-mono text-[11px] leading-[1.6] lg:text-[12px] text-text-secondary">{HOURS_TRUTH}</p>
          </div>
          <p className={`mt-[14px] ${DECK.statement}`}>The travel match is already alive today: card charges find their bookings on their own.</p>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={DECK.q}>Beautiful. But why should you believe any of it?</p>
        </div>
      </section>

      {/* ── DECK-14 / THE PROOF. The reverse walk reuses 13's connector
            treatment on a 20px | 180px | 1fr grid; layer labels gold mono
            with NO bottom rule (Design's exception), artifacts mono aubergine
            ruled with border-light. Ends on the deck's closing LINE — 24px
            roman, deliberately NOT a question and NOT the question size pair;
            nothing on this page is italic, so roman is the default it ships
            with. */}
      <section id="deck-14" aria-label="The proof" className={openSteps[13] ? DECK.section : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[13]}
          aria-controls="deck-14-body"
          onClick={() => toggleStep(13)}
          className={DECK.stepButton}
        >
          <span className={DECK.eyebrow}>14 / PROVE EVERY NUMBER</span>
          <span aria-hidden="true" className={DECK.eyebrow}>{openSteps[13] ? '−' : '+'}</span>
        </button>
        <div id="deck-14-body" className={openSteps[13] ? undefined : 'hidden'}>
          <h2 className={DECK.h2}>
            Click any number.<br />Walk it back.
          </h2>
          <p className={DECK.sub}>
            Every figure traces to the exact words the provider sent — and the fingerprint still matches.
          </p>

          <div className="relative mt-10 lg:mt-[76px]">
            <span aria-hidden="true" className="absolute bottom-[20px] left-[2px] top-[20px] w-px bg-border" />
            {PROOF_WALK.map(([layer, artifact]) => (
              <div key={layer} className="relative grid grid-cols-[20px_1fr] lg:min-h-[49px] lg:grid-cols-[20px_180px_1fr]">
                <span aria-hidden="true" className="absolute left-0 top-[19px] h-[5px] w-[5px] bg-brand-purple" />
                <span />
                <p className="pt-[14px] font-mono text-[10px] lg:text-[11px] uppercase tracking-[0.18em] text-brand-gold lg:py-[14px]">{layer}</p>
                <p className="col-start-2 row-start-2 border-b border-border-light pb-[14px] pt-1 font-mono text-[11px] lg:text-[13px] text-brand-purple lg:col-start-3 lg:row-start-1 lg:py-[14px]">{artifact}</p>
              </div>
            ))}
          </div>

          <div className={DECK.hairline} aria-hidden="true" />
          <div className="mt-[22px] lg:mt-8">
            {PROOF_TRIO.map((claim, i) => (
              <p key={claim} className={`${i === 0 ? '' : 'mt-3 lg:mt-[14px]'} ${DECK.trio}`}>{claim}</p>
            ))}
          </div>
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>That is why you can believe the screen: every number walks back to the exact words the provider sent.</p>
          <p className="mt-[22px] lg:mt-9 text-[17px] lg:text-[24px] text-brand-purple">Twenty-five tools. And now every one knows what the others did.</p>
        </div>
      </section>

      {/* WHY ACT LANDS HERE — (PR-WHY, content TBD) */}

      {/* ── BUILTON-MARQUEE: the "Built on" wall's five-category card grid
            became ONE auto-scrolling text-mark strip (professional-site
            style). WORDING LAW (locked): "Built on" / "integrates with"
            ONLY — never "partners", "trusted by", or any endorsement
            framing. CLAIMABILITY RULE unchanged: wired clients only —
            BUILT_ON is the same leaf data, every entry a chip, none
            invented, none dropped. REAL-MARKS: each chip leads with the
            vendor's mark on a mini aubergine plate (the wall's own ground —
            the shipped files are white dark-bg variants, rendered AS-IS,
            never recolored); a missing file renders the letter tile
            (relocated two-state logic, cite at the render). The leaf's
            marks rulings (NEVER-LIGHT / pending slots) still govern which
            files may ever land.
            MECHANICS: CSS-only — the ts-marquee keyframes (globals.css,
            the repo's first) slide a DOUBLED chip run by -50% in 50s;
            hover pauses via animation-play-state; prefers-reduced-motion
            kills the animation and the wrapper becomes a contained
            horizontal scroll (overflow-x-auto). Hard edges — the house has
            no CSS mask precedent (audit-cited), none invented. The second
            run is aria-hidden (screen readers read each vendor once).
            Vercel attribution: kept verbatim per the ruling — with
            text-only chips no Vercel/Next.js image marks render, so the
            line now over-attributes harmlessly (declared). ─────────────── */}
      <section className="w-full border-y border-border bg-bg-terminal">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
            Built on
          </p>
          <p className="text-sm text-text-secondary mt-1">Every tool this platform runs on.</p>
          <div className="group mt-6 overflow-hidden motion-reduce:overflow-x-auto">
            <div className="flex w-max animate-[ts-marquee_50s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
              {[0, 1].map((run) => (
                <div key={run} aria-hidden={run === 1 || undefined} className="flex w-max items-center gap-3 pr-3">
                  {BUILT_ON.map((e) => {
                    // REAL-MARKS: the old wall's two-state logic RELOCATED
                    // verbatim (271d60b1 Landing.tsx:1125 — lit mark vs
                    // letter tile; :1150 — the Stripe href-when-lit
                    // mandate), not new fallback. The mark plate is the old
                    // wall's own ground, miniaturized: every shipped file is
                    // the white dark-bg variant (builtOnWall.ts drop
                    // convention), so the mark renders AS-IS on aubergine —
                    // never recolored. Letter tile = the old white/80 ink on
                    // the same plate. A file dropped at
                    // public/logos/<slug>.svg lights its chip, zero code.
                    const logoLive = e.logo !== undefined && logoAvailability[e.logo.slug] === true;
                    const chipClass = 'flex items-center gap-2 whitespace-nowrap rounded border border-border bg-white py-1.5 pl-1.5 pr-3 font-mono text-xs';
                    const chipBody = (
                      <>
                        <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded bg-brand-purple px-1.5">
                          {logoLive && e.logo ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={`/logos/${e.logo.slug}.svg`} alt={e.logo.alt} className="h-5 w-auto max-w-[72px] object-contain" />
                          ) : (
                            <span className="text-xs font-semibold leading-none text-white/80">{e.name[0]}</span>
                          )}
                        </span>
                        <span className="font-semibold text-brand-purple">{e.name}</span>
                        <span className="text-text-muted">· {e.tag}</span>
                      </>
                    );
                    return logoLive && e.logo?.href ? (
                      <a
                        key={`${run}-${e.name}`}
                        href={e.logo.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={chipClass}
                      >
                        {chipBody}
                      </a>
                    ) : (
                      <span key={`${run}-${e.name}`} className={chipClass}>
                        {chipBody}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── LOBBY-DECK-1b: the demo modal — the house dialog idiom
            (CheckoutPanel.tsx:300 backdrop). YouTube URLs embed via iframe;
            any other URL plays through a native <video>. Backdrop click or
            ✕ closes. Unreachable while DEMO_VIDEO_URL is null. ─────────────── */}
      {showDemo && DEMO_VIDEO_URL !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowDemo(false)}
        >
          <div
            className="w-full max-w-3xl rounded-lg border border-border bg-white p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                The demo
              </p>
              <button
                type="button"
                aria-label="Close the demo"
                onClick={() => setShowDemo(false)}
                className="text-text-muted transition-colors hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            {youTubeEmbedUrl(DEMO_VIDEO_URL) ? (
              <iframe
                src={youTubeEmbedUrl(DEMO_VIDEO_URL) as string}
                title="Demo video"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full rounded"
              />
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={DEMO_VIDEO_URL} controls autoPlay className="aspect-video w-full rounded" />
            )}
          </div>
        </div>
      )}

      <LandingFooter />
    </div>
  );
}

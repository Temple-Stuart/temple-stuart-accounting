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
 *   01 / IDENTIFY THE PROBLEM, THE TOOLS, THE FAMILIES — AND SORT THEM IN — four moves drawn: the raw list, the family sheet, the flow arcs
 *   02 / LOOK AT THE TOOLS AND PICK THE PROVIDERS BEHIND THEM — the provider menu + the open doors
 *   03 / IMPORT THE DATA AND SEE HOW IT ARRIVES — the raw import table, twelve arrivals, the promises
 *   04 / LABEL EVERY FEED BY ITS KIND — the fold drawn, one rule per feed, twenty rows, five kinds
 *   05 / CREATE ONE TABLE PER KIND AND MAP THE DATA IN — six tables; the kind picks the table
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
import { PROBLEM_SHEET } from '@/lib/problemSheet';
import { ANSWER_ROWS, ANSWER_INPUTS } from '@/lib/answers';
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

// PR-S1-VIZ: PROBLEM_SOURCES retired — the fan died with the CD-S1 ruling
// and the six family names moved into PROBLEM_SHEET's headers (below), which
// are now their sole owner. The old headers-abbreviated-on-purpose law
// (place-name left, tab-name top, the mismatch was the drawing) is OVERRULED
// by the founder's CD-S1 mockup: the sheet's header band carries the FULL
// family names, because the sheet is now moves (c)/(d)'s destination, not a
// spreadsheet pastiche. PROBLEM_FAN_LG, PROBLEM_LABEL_TOP_LG and
// PROBLEM_LABEL_TOP_SM died with the fan. History holds all four.

// PROBLEM-SHEET (PR-S1-VIZ): the twenty-five tools under their six family
// names — headers uppercase literals (the desktop th also carries the
// uppercase class; the mobile SVG draws the string raw, so the const is the
// single uppercase source).
//
// THE COLUMNS ARE DELIBERATELY UNEQUAL — 3 / 4 / 6 / 5 / 3 / 4, twenty-five in
// total. The ragged bottom is honest: some kinds of places take six tools and
// some take three. NEVER pad a column to square the grid — the empty cells are
// the finding, not a rendering defect.
//
// SOLE OWNER of the twenty-five and of the family vocabulary, as of the
// modules retirement and the fan retirement. S1_TOOL_LIST below is the SAME
// twenty-five in the founder's raw-list order — set-equal by construction,
// verified by the PR script; a new tool lands in BOTH or the check fails.
// NAV-01a: PROBLEM_SHEET lives in the shared leaf src/lib/problemSheet.ts now
// (imported at the top) — the deck, the tool registry, and the build-time
// registry assert read the ONE const. Bytes unchanged; only the address moved.

// S1-TOOL-LIST (PR-S1-VIZ): move (b) — the raw twenty-five in the founder's
// ruled order, BEFORE sorting. Set-equal to PROBLEM_SHEET's cells (the PR
// script proves it); the scramble against the sheet's family order is the
// drawing — the list is the pile, the sheet is the pile sorted.
const S1_TOOL_LIST = [
  'CRM', 'Bookkeeping', 'Bill Pay', 'Calendar', 'Banking', 'Debt',
  'Contracts', 'Payroll', 'Fixed Assets', 'Tasks', 'Tax', 'Sales Tax',
  'Invoicing', 'Retirement', 'Compliance', 'Expenses', 'Time', 'Payments',
  'Travel', 'Brokerage', 'Ent Filings', 'Mileage', 'Trade Log', 'Budget',
  'FP&A',
] as const;

// S1-CORRIDOR (PR-S1-ARROWS): the flow overlay's ONE height in px, shared
// by the overlay SVG's rendered height AND the sheet column's top padding —
// both read this const through inline style (the house escape hatch for
// computed geometry; Tailwind cannot compile interpolated classes). Because
// the drawing surface ENDS exactly where the table begins, no path can ever
// cross the table body or the caption — the corridor-bottom == header-top
// equality is structural, not a discipline. 64px = the (b) tag row (~15px)
// + its 6px margin + enough air above the card's top edge for the arcs to
// cruise at y=8 and dive at y=36.
const S1_CORRIDOR_PX = 64;

// S1-FLOWS (PR-S1-ARROWS): move (d) — five dotted paths, all ORIGINATING in
// one small zone at the list card's top-right corner (sx 366, sy staggered
// 26..42 in corridor space), each rising to the y=8 cruise, travelling
// right, then turning DOWN to terminate at its target column's center on
// the corridor's bottom edge (== the family header band's top edge), where
// the marker points straight down. Targets per the mockup: THE WORK ·
// MONEY IN · MONEY OUT · WHAT YOU OWN · THE PROOF (cols 0,1,2,3,5 — five
// DISTINCT columns; THE OWE column deliberately unserved, per mockup).
const S1_FLOWS = [
  { sy: 26, col: 0 },
  { sy: 30, col: 1 },
  { sy: 34, col: 2 },
  { sy: 38, col: 3 },
  { sy: 42, col: 5 },
] as const;

// PROBLEM-SHEET / MOBILE SPLIT: six columns cannot fit a 280px viewBox, so
// the phone draws TWO stacked grids of three columns instead of one of six.
// DERIVED BY SLICE from PROBLEM_SHEET, never a retyped second copy (the
// no-drift law) — each grid paired with its own `top` so the split and its
// geometry move together. EVERY other coordinate derives from `top` (header
// rule top+30, interior rules top+50..top+130 by 20, header baseline top+18,
// data baselines top+43 by 20). PR-S1-VIZ: the fan died, so the tops no
// longer anchor to a convergence point — Grid A sits at 0, Grid B 30px below
// A's bottom edge (0+150+30), in a 280x330 viewBox. PR-S2: the same
// slices also draw slide 02's mobile walk grids (with fate marks).
const PROBLEM_SHEET_SM = [
  { top: 0, cols: PROBLEM_SHEET.slice(0, 3) },
  { top: 180, cols: PROBLEM_SHEET.slice(3) },
] as const;

// PR-S1-PROSE: PROBLEM_SHEET_CAPTION retired — the spreadsheet sentence now
// lives inside the slide's single merged problem paragraph (essay v14
// Step 1), rendered once below the visual row. History holds the const.

// PR-STEP2-VIZ: PROVIDER_ROSTER + PROVIDER_DOORS retired — SHOW DON'T ECHO
// (Deck Law #7): the provider menu below carries the providers AND
// the open doors in one drawing, so the eleven-line roster and the doors
// gloss died as text. The offerings sentence died with them — its one fact
// the table cannot draw (the SnapTrade connector) survives as the table's
// footnote, essay verbatim. The essay's Step 2 line (11) took the three-AIs
// wording in the same breath. The retired strings live in git history.

// PROVIDER-MENU (PR-STEP2-VIZ): the slide-02 provider-menu visual, as
// [job, today, next] — thirteen jobs, who feeds each today, which doors are
// already open for later. PR-S2-LINES: rows sit in the WALK-LANDING order
// (the pull-out column's targets, top to bottom) — the essay's
// who-we-speak-to list carries the same order, LiteAPI's one entry
// seating both flights and hotels. '—' is deck content — a job with no
// open door yet —
// and renders in the faint tier; never fill it. A new provider is one cell
// edit here (a provider is just rows in a table — added, never built).
// PR-S2: the menu renders ONCE PER BREAKPOINT — the walk's right panel
// on desktop, the full-width DECK.table on mobile.
const PROVIDER_MENU = [
  ['banks & accounts', 'plaid', 'teller'],
  ['card money', 'stripe', 'square'],
  ['trades & market data', 'tastytrade', 'schwab · ibkr · alpaca · tradier · snaptrade'],
  ['company numbers', 'finnhub', 'polygon'],
  ['the economy', 'fred', '—'],
  ['filings', 'sec', '—'],
  ['flights', 'liteapi', 'amadeus'],
  ['hotels', 'liteapi', 'amadeus'],
  ['activities', 'viator', '—'],
  ['locations', 'google places', '—'],
  ['visas', 'travel buddy', '—'],
  ['our AI', 'anthropic · openai · xai grok · voyage', '—'],
  ['the law itself', 'ecfr · us code · federal register · irs', '—'],
] as const;

// ── PR-S2 / THE WALK. Step 2's visual: the walk from Step 1's finished
// table to the provider menu, DRAWN, not listed (SHOW DON'T ECHO, Deck
// Law #7 — the essay's (1)-(9) walk renders nowhere as text). Facts and
// geometry from the approved CD-S2 BuildSpec (v3, PR-S2-LINES: the
// pull-out re-cut — a list between two tables, the slide-01 idiom; no
// arrows leave the sheet; sixteen arcs, ZERO crossings, script-proven).

// S2-MOVERS: the nine tools that take providers — the walk's “yes”
// answers. The PR script proves: movers ⊂ PROBLEM_SHEET cells,
// |movers| == 9, cells − movers == 16 (the tinted stay-homes).
const S2_MOVERS = new Set<string>([
  'Payments', 'Expenses', 'Travel', 'Banking', 'Retirement',
  'Brokerage', 'Trade Log', 'Debt', 'Compliance',
]);

// S2-FATES: the sixteen [tool, job] pairs — ONE const drives the desktop
// arcs AND the mobile fate lines (the no-drift law). Every job string
// matches a PROVIDER_MENU row's job cell verbatim (script-proved).
const S2_FATES = [
  ['Payments', 'card money'],
  ['Expenses', 'banks & accounts'],
  ['Banking', 'banks & accounts'],
  ['Retirement', 'banks & accounts'],
  ['Debt', 'banks & accounts'],
  ['Trade Log', 'trades & market data'],
  ['Brokerage', 'trades & market data'],
  ['Brokerage', 'company numbers'],
  ['Brokerage', 'the economy'],
  ['Brokerage', 'filings'],
  ['Travel', 'flights'],
  ['Travel', 'hotels'],
  ['Travel', 'activities'],
  ['Travel', 'locations'],
  ['Travel', 'visas'],
  ['Compliance', 'the law itself'],
] as const;

// S2-GEOM: the corridor law, horizontal (S1_CORRIDOR_PX precedent, above):
// the overlay's viewBox, both panels' inline geometry and every path
// coordinate read THIS object, so arc-landing-x == menu-left-edge and
// path-anchor == row-center are structural, not a discipline. Panels sit
// at percentages of W and the overlay stretches with
// preserveAspectRatio="none", so the x-equalities hold at ANY column
// width; the vertical scale stays 1:1 because the row's height IS H.
// Cells are fixed-height through HEAD_H/ROW_H (border-box, so borders
// never add to the pitch) — the same numbers the anchor math reads.
// PR-S2-LINES: PORT_X died — the arc-source x is DERIVED below as
// COL_X + COL_W, the pull-out column's right edge (== 630).
const S2_GEOM = {
  W: 1216, H: 380, TABLE_W: 430, COL_X: 470, COL_W: 160, MENU_X: 792,
  MENU_W: 424, HEAD_H: 26, ROW_H: 24,
} as const;

// S2-PORTS (PR-S2-LINES): the pull-out column — THE NINE THAT MOVE —
// top to bottom in the founder's locked order; ONE const is the column's
// row data AND the arc sources. With the menu reordered to land the walk,
// landing-y is monotone across ascending source rows and both fans land
// on CONTIGUOUS menu blocks, so the sixteen arcs cross ZERO times — the
// PR script proves it pairwise. No arrows leave the sheet: the nine are
// outlined there and pulled out here by NAME.
const S2_PORTS = [
  'Banking', 'Expenses', 'Retirement', 'Debt', 'Payments',
  'Trade Log', 'Brokerage', 'Travel', 'Compliance',
] as const;

// S2-CONVERGE: shared landing rows fan their arrowheads so four heads
// never stack — px offsets off the landing row's center, ordered by
// pull-out row so the converge fan cannot self-cross.
const S2_CONVERGE: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'banks & accounts': { Banking: -7, Expenses: -2, Retirement: 2, Debt: 7 },
  'trades & market data': { 'Trade Log': -4, Brokerage: 4 },
};

// Derived geometry — every coordinate computed from S2_GEOM plus the data
// consts above; no hand-typed path numbers anywhere. A port is simply the
// pull-out row's right-edge center — same s2RowCenter the menu rows use,
// so source-anchor == row-center is structural.
const s2RowCenter = (i: number) => S2_GEOM.HEAD_H + i * S2_GEOM.ROW_H + S2_GEOM.ROW_H / 2;
const s2PortX = S2_GEOM.COL_X + S2_GEOM.COL_W;
const s2PortY = (tool: string) => s2RowCenter(S2_PORTS.indexOf(tool as (typeof S2_PORTS)[number]));
const s2MenuY = (job: string) => s2RowCenter(PROVIDER_MENU.findIndex(([j]) => j === job));

// ── PR-S3 / THE ASK. Step 3's visual: the menu's picked providers on
// the left, each one's answer landing as ONE ROW in the arrivals table
// on the right — the drawing IS the hinge (Law 7). Geometry from the
// approved CD-S3 BuildSpec; both lists share ONE order (the menu's), so
// the nineteen arrows cross ZERO times by construction — the PR script
// proves it pairwise; plaid's pair shares its source.

// S3-PROVIDERS: the left list's eighteen rows, DERIVED from the menu's
// TODAY column — flattened in menu row order, liteapi deduped — never
// retyped (the no-drift law; the PR script proves 18, ruled order).
const S3_PROVIDERS = [...new Set(PROVIDER_MENU.flatMap(([, today]) => today.split(' · ')))];

// S3-GEOM (PR-S3-ONE-TABLE): the corridor law, widened to the full
// container — the two tables became ONE, so the arrivals table carries
// its own legend as a THREE-TIER header (T1 group bands · T2 part names
// · T3 glosses) and takes the rest of the row. The derived equalities
// are code, not discipline: S3_HEAD_H is the tier sum; S3_LIST_TOP =
// S3_HEAD_H − 2 is the LEVEL-ARROW LAW — list row i's center
// (S3_LIST_TOP + 26 + 24i + 12) equals table row (i+1)'s center
// (S3_HEAD_H + 24(i+1) + 12) identically, so all seventeen single
// arrows and plaid→boa run DEAD LEVEL, plaid→chase rises exactly one
// pitch, and the list's bottom edge lands flush with the table's.
const S3_GEOM = {
  W: 1216, LIST_W: 150, TABLE_X: 240, T1: 22, T2: 20, T3: 44, ROW_H: 24,
} as const;
const S3_HEAD_H = S3_GEOM.T1 + S3_GEOM.T2 + S3_GEOM.T3;
const S3_LIST_TOP = S3_HEAD_H - 2;
const S3_TABLE_W = S3_GEOM.W - S3_GEOM.TABLE_X;
const s3RowCenter = (j: number) => S3_HEAD_H + j * S3_GEOM.ROW_H + S3_GEOM.ROW_H / 2;
const s3ListCenter = (i: number) => S3_LIST_TOP + 26 + i * S3_GEOM.ROW_H + S3_GEOM.ROW_H / 2;

// IMPORT-COLUMNS (PR-DECK): the field table of the 03 / THE IMPORT slide,
// reconciled to the deck's plain-language vocabulary (provider · connection ·
// resource · their id · our id · payload · fingerprint · asked · arrived ·
// read · status). Four sand-banded groups (PR-S3-COHESION: the labels
// ride the DECK.th band, no longer rust), each row a [name, desc] pair —
// PR-S3-ONE-TABLE: this const is now the ONE table's three-tier header
// (bands · names · glosses) on desktop AND the phone card's left half;
// the provider and resource glosses carry the founder's ruled
// shortenings ('which company sent it' / 'their own word' — the old
// example lists were redundant above real data columns) —
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
      ['provider', 'which company sent it'],
      ['connection', 'because you might have two or more banks'],
    ],
  },
  {
    band: 'WHAT IT IS',
    rows: [
      ['resource', 'their own word'],
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

// IMPORT-ARRIVALS (PR-S3 → PR-S3-ONE-TABLE): NINETEEN rows × ELEVEN
// fields — [provider, connection, resource, their id, our id, payload,
// fingerprint, asked, arrived, read, status] — the ONE table's body, in
// S3_PROVIDERS order (the menu's). Three status stories: DONE ×17 (all
// three times, ascending within the row), sec PENDING (asked + arrived,
// read —), and viator FAILED (asked only — its their id, payload,
// fingerprint, arrived and read are '—': nothing arrived, so nothing is
// claimed). Stripe keeps po_1QmX8fK2 · arr_0003 · c9d1…4f2a ·
// 09:14:01/02/03Z — the arrival slide 14 walks back to. our id runs
// arr_0001…arr_0019 in row order; their ids follow each provider's real
// id convention (FRED's GDPC1 and the Federal Register's 2026-18432 are
// the genuine shapes); times and ids are invented display data per the
// shipped precedent, the stripe echoes pinned. The payload cell is the
// '{ … }' glyph — the word-for-word answer is the point, not its bytes.
// PENDING and FAILED ink rust.
const IMPORT_ARRIVALS = [
  ['plaid', 'chase', 'transaction', 'tx_9KmXw24Lp', 'arr_0001', '{ … }', 'a3f8…09be', '09:13:45Z', '09:13:47Z', '09:13:48Z', 'DONE'],
  ['plaid', 'boa', 'transaction', 'tx_7BqRt81Vn', 'arr_0002', '{ … }', '7c42…d1e0', '09:13:53Z', '09:13:55Z', '09:13:56Z', 'DONE'],
  ['stripe', '—', 'payout', 'po_1QmX8fK2', 'arr_0003', '{ … }', 'c9d1…4f2a', '09:14:01Z', '09:14:02Z', '09:14:03Z', 'DONE'],
  ['tastytrade', '—', 'quote', 'qt_0831_SPY', 'arr_0004', '{ … }', '5b9a…22c7', '09:30:58Z', '09:31:00Z', '09:31:02Z', 'DONE'],
  ['finnhub', '—', 'fundamentals', 'AAPL-Q2-2026', 'arr_0005', '{ … }', 'e610…8fd3', '09:47:10Z', '09:47:13Z', '09:47:14Z', 'DONE'],
  ['fred', '—', 'series', 'GDPC1', 'arr_0006', '{ … }', '91d4…7a6c', '09:53:18Z', '09:53:20Z', '09:53:21Z', 'DONE'],
  ['sec', '—', 'filing', '0000320193-26', 'arr_0007', '{ … }', '4e7f…c058', '10:02:41Z', '10:02:44Z', '—', 'PENDING'],
  ['liteapi', '—', 'booking', 'bk_HTZ29X', 'arr_0008', '{ … }', 'b820…3391', '10:33:24Z', '10:33:27Z', '10:33:29Z', 'DONE'],
  ['viator', '—', 'activity', '—', 'arr_0009', '—', '—', '10:39:12Z', '—', '—', 'FAILED'],
  ['google places', '—', 'place', 'ChIJN1t_9zs', 'arr_0010', '{ … }', 'd3b7…104f', '10:42:55Z', '10:42:58Z', '10:42:59Z', 'DONE'],
  ['travel buddy', '—', 'visa', 'visa_US_PT', 'arr_0011', '{ … }', '08e2…b56a', '10:51:33Z', '10:51:36Z', '10:51:37Z', 'DONE'],
  ['anthropic', '—', 'classification', 'msg_01XkQz', 'arr_0012', '{ … }', 'f19c…62d8', '11:15:07Z', '11:15:09Z', '11:15:10Z', 'DONE'],
  ['openai', '—', 'insight', 'chatcmpl-9xQ2', 'arr_0013', '{ … }', '73ab…f0e4', '11:15:10Z', '11:15:12Z', '11:15:13Z', 'DONE'],
  ['xai grok', '—', 'sentiment', 'grok_7f2q1', 'arr_0014', '{ … }', 'c507…89b1', '11:15:15Z', '11:15:18Z', '11:15:19Z', 'DONE'],
  ['voyage', '—', 'embedding', 'emb_44219', 'arr_0015', '{ … }', '2df6…a743', '11:15:22Z', '11:15:25Z', '11:15:26Z', 'DONE'],
  ['ecfr', '—', 'title', '26-CFR-1.61', 'arr_0016', '{ … }', '8b31…5c9e', '11:40:00Z', '11:40:03Z', '11:40:05Z', 'DONE'],
  ['us code', '—', 'title', '26-USC-61', 'arr_0017', '{ … }', 'ae64…01f7', '11:40:28Z', '11:40:31Z', '11:40:32Z', 'DONE'],
  ['federal register', '—', 'document', '2026-18432', 'arr_0018', '{ … }', '39c8…d6b2', '11:41:04Z', '11:41:07Z', '11:41:08Z', 'DONE'],
  ['irs', '—', 'bulletin', 'IRB-2026-35', 'arr_0019', '{ … }', '1e05…78ca', '11:42:53Z', '11:42:56Z', '11:42:57Z', 'DONE'],
] as const;

// Derived from the arrivals (PR-S3-ONE-TABLE): the row's height; the
// phone card's opened row (plaid · chase == IMPORT_ARRIVALS[0], never
// retyped); and the flat field index pairing IMPORT_COLUMNS' part rows
// with the 11-tuple's slots (the PR script proves the alignment).
const S3_H = S3_HEAD_H + IMPORT_ARRIVALS.length * S3_GEOM.ROW_H;
const S3_OPEN_ROW = IMPORT_ARRIVALS[0];
const s3FieldIndex = (b: number, r: number) => IMPORT_COLUMNS.slice(0, b).reduce((n, g) => n + g.rows.length, 0) + r;

// ROUTING-RULES (PR-DECK → PR-STEP-2 → PR-SIX → PR-S4): THE RULE BOOK —
// one row per feed, TWENTY ROWS in S4_FEEDS order (the eighteen folded
// feeds plus plaid's two ruled extras, account and holding, so every
// earnable kind is seen), as [provider, resource, kind, means]. The MEANS
// column speaks only on a kind's FIRST appearance ('something that
// happened' · 'one of your accounts' · 'how things stood at one moment' ·
// 'a fact about the world' · 'math we did — never a source'); the empty
// strings on repeat rows are deck content, not gaps — do not fill them.
// Kinds count EVENT 3 · REGISTRY 1 · SNAPSHOT 1 · REFERENCE 11 ·
// DERIVED 4 — script-proved, and row i names feed i exactly.
//
// THE FIVE ROUTABLE KINDS ARE A CLOSED SET — EVENT, REGISTRY, SNAPSHOT,
// REFERENCE, DERIVED. FIVE HERE, SIX IN HANDOFF_KINDS BELOW, AND THE GAP IS
// THE POINT:
// nothing ever arrives as a posting — the system writes postings from events.
// Do not add a POSTING row here to make the two lists match.
const ROUTING_RULES = [
  ['plaid', 'transaction', 'EVENT', 'something that happened'],
  ['plaid', 'account', 'REGISTRY', 'one of your accounts'],
  ['plaid', 'holding', 'SNAPSHOT', 'how things stood at one moment'],
  ['stripe', 'payout', 'EVENT', ''],
  ['tastytrade', 'quote', 'REFERENCE', 'a fact about the world'],
  ['finnhub', 'fundamentals', 'REFERENCE', ''],
  ['fred', 'series', 'REFERENCE', ''],
  ['sec', 'filing', 'REFERENCE', ''],
  ['liteapi', 'booking', 'EVENT', ''],
  ['viator', 'activity', 'REFERENCE', ''],
  ['google places', 'place', 'REFERENCE', ''],
  ['travel buddy', 'visa', 'REFERENCE', ''],
  ['anthropic', 'classification', 'DERIVED', 'math we did — never a source'],
  ['openai', 'insight', 'DERIVED', ''],
  ['xai grok', 'sentiment', 'DERIVED', ''],
  ['voyage', 'embedding', 'DERIVED', ''],
  ['ecfr', 'title', 'REFERENCE', ''],
  ['us code', 'title', 'REFERENCE', ''],
  ['federal register', 'document', 'REFERENCE', ''],
  ['irs', 'bulletin', 'REFERENCE', ''],
] as const;

// PR-S4: ROUTING_DERIVED_ROW retired — the old table's anthropic emphasis
// died with the table; the rule book's rows are peers, and DERIVED's
// first-appearance MEANS carries the warning. History holds the const.

// ── PR-S4 / THE FOLD AND THE RULE. Step 4's drawing: Step 3's arrivals
// (identity columns) FOLD into feeds — plaid's two connections converge —
// and each feed lands its rule row in the rule book, KIND in gold.
// Geometry from the approved CD-S4 BuildSpec with the founder's OPTION
// built: plaid's account and holding feeds ride beneath the fold, marked,
// so all five earnable kinds ink on the slide.

// S4-FEEDS: the fold IS code — dedup IMPORT_ARRIVALS by (provider,
// resource) in row order (18, script-proved), then the two ruled extras
// slot in beneath the fold. ONE list drives the feeds panel, the rule
// book's order and both arrow rails.
const s4Folded = IMPORT_ARRIVALS.reduce<ReadonlyArray<readonly [string, string]>>(
  (acc, row) => (acc.some(([p, r]) => p === row[0] && r === row[2]) ? acc : [...acc, [row[0], row[2]] as const]),
  [],
);
const S4_EXTRAS = [['plaid', 'account'], ['plaid', 'holding']] as const;
const S4_FEEDS = [...s4Folded.slice(0, 1), ...S4_EXTRAS, ...s4Folded.slice(1)];

// S4-GEOM: the S2/S3 sibling. All three panels share HEAD + ROW_H and sit
// top-aligned, so a feed's center is one pitch below its arrival's (the
// uniform drop the extras buy) and the rule rail runs DEAD LEVEL row for
// row; R_X + R_W == W, and the drawing's height is the twenty-row
// panels' — both derived, not typed.
const S4_GEOM = {
  W: 1216, L_W: 270, F_X: 404, F_W: 190, R_X: 728, R_W: 488,
  HEAD: 26, ROW_H: 24,
} as const;
const S4_H = S4_GEOM.HEAD + S4_FEEDS.length * S4_GEOM.ROW_H;
const s4RowCenter = (i: number) => S4_GEOM.HEAD + i * S4_GEOM.ROW_H + S4_GEOM.ROW_H / 2;
// plaid's converging pair fans its heads at feed 0 so they never stack.
const S4_CONVERGE: Readonly<Record<string, number>> = { chase: -3, boa: 3 };

// PR-DECK: ROUTING_TESTS retired — the deck's 04 closes on one statement line
// ('When a new provider shows up, we add rows — not code, and not new
// tables.') typed at the render, not a trio. The three tests live in git
// history if a surface ever wants them back.

// HANDOFF-KINDS (PR-DECK → PR-SIX → PR-S5): the six tables a kind can
// address, for 05 / THE ADDRESS, as [kind, holds]. The deck writes the
// kinds lowercase here — on 05 they are addresses, not shouted
// vocabulary — and collapses the old kind/table pair into one word, since
// the kind IS the table name. Kind words are the one non-money place gold
// is allowed.
//
// SIX KINDS HERE, FIVE IN ROUTING_RULES, AND THAT IS CORRECT — nothing ever
// ARRIVES as a posting: postings are what the system writes from events.
// Posting's own box says exactly this on screen, in the essay's words.
//
// ORDER IS THE ARGUMENT, not the alphabet — the essay's Step 5 list: world
// data first (reference), then who you are (registry), then what happened
// (event), then what you concluded (derived), then how things stood
// (snapshot), and last the table nothing from outside ever fills (posting).
//
// NO ROW IS EMPHASISED, deliberately — the six kinds are peers.
const HANDOFF_KINDS = [
  ['reference', 'facts about the world'],
  ['registry', 'your accounts and your people'],
  ['event', 'what happened'],
  ['derived', 'math we did'],
  ['snapshot', 'how things stood at one moment'],
  ['posting', 'debits and credits'],
] as const;

// ── PR-S5 / THE ADDRESS → PR-S5-SORT. Step 5's drawing: the rule book's
// twenty rows fan into six kind-table boxes — the boxes ARE the old
// handoff table now, so HANDOFF_KINDS has exactly one renderer again.
// PR-S5-SORT re-cut the drawing for legibility: slide 05 shows the book
// SORTED by kind, one arrow per rule, zero crossings. The trunk harness
// (S5_LANES, the FX/CTRL fan zone, s5RowsOf, the ten forced crossings)
// died with this cut; history holds it.

// S5-BOXES: [kind, holds, count] — the box list. Gloss strings ride
// HANDOFF_KINDS untouched; each kind's count is its rule rows in
// ROUTING_RULES, DERIVED, never retyped (posting: zero by construction —
// no POSTING row exists, the closed-set law above). The verify script
// asserts the counts sum to ROUTING_RULES.length.
const S5_BOXES = HANDOFF_KINDS.map(
  ([kind, holds]) => [kind, holds, ROUTING_RULES.filter(([, , k]) => k.toLowerCase() === kind).length] as const,
);
// where each kind's band begins in the sorted book (cumulative counts).
const S5_STARTS = S5_BOXES.map((_, b) => S5_BOXES.slice(0, b).reduce((s, [, , n]) => s + n, 0));
// S5-SORTED: the book as slide 05 shows it — the same twenty rows,
// stable-sorted into HANDOFF_KINDS order so each kind's rows sit beside
// their table. DERIVED from the two consts, never retyped; ROUTING_RULES
// itself is untouched — slide 04 still renders the wire order.
const S5_SORTED = HANDOFF_KINDS.flatMap(([kind]) => ROUTING_RULES.filter(([, , k]) => k.toLowerCase() === kind));

// S5-GEOM (PR-H6R): the S2/S3/S4 sibling. Rule book x 0..RB_W, HEAD +
// 20·ROW_H tall; six boxes at BX_L — BOX_H tall, POST_H for posting's
// taller dashed card; BX_L + BX_W == W. BRK is the block-bracket spine x
// (ticks at BRK−6, stem to BRK+12); the connector's control x is the
// corridor midpoint between the stem and the boxes.
const S5_GEOM = {
  W: 1216, RB_W: 380, HEAD: 26, ROW_H: 24,
  BX_L: 896, BX_W: 320, BOX_H: 66, POST_H: 100, BRK: 392,
} as const;
const s5RowY = (r: number) => S5_GEOM.HEAD + r * S5_GEOM.ROW_H + S5_GEOM.ROW_H / 2;
const s5BoxH = (kind: string) => (kind === 'posting' ? S5_GEOM.POST_H : S5_GEOM.BOX_H);

// THE LAYOUT LAW (PR-H6R → EVEN SPAN, ruled): the sorted book's
// kind-blocks must be contiguous, and the six boxes SPAN the table's data
// rows exactly — reference's top flush with the first data row's top,
// posting's bottom flush with the last data row's bottom — with EQUAL
// GAPS solved from the differing box heights (posting is taller), never
// equal centers. Box order still matches block order, so the five
// connectors stay monotonic. The build REFUSES — this throws at module
// load, so prerender fails — if the blocks break contiguity, a box would
// overrun the table bottom (negative gap), the span fails to close
// flush, or any two connectors would cross. ONE connector per block:
// five, and none for posting.
const S5_LAYOUT = (() => {
  const blocks: Array<readonly [string, number, number]> = [];
  S5_BOXES.forEach(([kind, , n], b) => {
    if (n === 0) return;
    const r0 = S5_STARTS[b];
    if (!S5_SORTED.slice(r0, r0 + n).every(([, , k]) => k.toLowerCase() === kind)) throw new Error(`slide 05: ${kind} rows are not one contiguous block`);
    blocks.push([kind, r0, r0 + n - 1] as const);
  });
  const top = S5_GEOM.HEAD;
  const bottom = S5_GEOM.HEAD + S5_SORTED.length * S5_GEOM.ROW_H;
  const boxSum = S5_BOXES.reduce((s, [kind]) => s + s5BoxH(kind), 0);
  const gap = (bottom - top - boxSum) / (S5_BOXES.length - 1);
  if (gap < 0) throw new Error('slide 05: the boxes overrun the rule book — a box would extend below the table');
  const centers: number[] = [];
  let y = top;
  S5_BOXES.forEach(([kind]) => {
    centers.push(y + s5BoxH(kind) / 2);
    y += s5BoxH(kind) + gap;
  });
  if (y - gap !== bottom) throw new Error('slide 05: the even span does not close flush with the table bottom');
  for (let x = 0; x < blocks.length; x += 1) {
    for (let z = x + 1; z < blocks.length; z += 1) {
      const sx = (s5RowY(blocks[x][1]) + s5RowY(blocks[x][2])) / 2;
      const sz = (s5RowY(blocks[z][1]) + s5RowY(blocks[z][2])) / 2;
      if ((sx - sz) * (centers[x] - centers[z]) <= 0) throw new Error('slide 05: connectors would cross — reorder the blocks');
    }
  }
  return { blocks, centers } as const;
})();
const S5_H = S5_LAYOUT.centers[S5_LAYOUT.centers.length - 1] + S5_GEOM.POST_H / 2;

// PR-S3-COHESION: IMPORT_TRIO retired — the essay merged the three
// promises (and the census + handshake lines) into Step 3's single tail
// paragraph, rendered once in the slide-01 body tier below the card.
// History holds the const.

// ─────────────────────────────────────────────────────────────────────────
// PR-DECK 05–13: the deck's back nine, all data module-scope per the house
// convention. Every string VERBATIM from the approved deck copy. Where a
// string carries inline gold (dollar amounts, debit/credit values — the only
// things gold may ink besides kind words), it is stored PRE-SPLIT as
// [text, isGold] segment pairs; the break points are the deck's, not
// punctuation-derived.
// ─────────────────────────────────────────────────────────────────────────

// DECK-06 (PR-S6-CORRIDOR → PR-DATAFLOW): the fork drawn as DATA FLOW in
// the 1–5 grammar — every item the system holds renders BY NAME, one
// arrow per item through its pulled-out source into its lane. The
// question-in-a-box hinge and the group brackets died (the drawing IS
// the hinge; Deck Law 7, SHOW DON'T ECHO). LANE_COLUMNS' prose and the
// S6_SIXTEEN block died earlier or here; history holds them all.

// the six kind groups, [name, holds, lane] — glosses ride HANDOFF_KINDS
// by name, never retyped; an unknown name throws at module load. The
// group order keeps the two destinations CONTIGUOUS (world-given above,
// you-made below) — the no-crossing law depends on it.
const s6Gloss = (name: string) => {
  const hit = HANDOFF_KINDS.find(([k]) => k === name);
  if (!hit) throw new Error(`slide 06: ${name} is not a HANDOFF kind`);
  return hit[1];
};
const S6_TABLES = ([
  ['reference', 'observed'], ['registry', 'observed'], ['event', 'observed'],
  ['snapshot', 'observed'], ['derived', 'authored'], ['posting', 'authored'],
] as const).map(([name, lane]) => [name, s6Gloss(name), lane] as const);
// the items, DERIVED (anti-drift): each kind's feeds from ROUTING_RULES;
// the sixteen stay-homes = PROBLEM_SHEET's cells minus S2_MOVERS — the
// layout law asserts |sixteen| == 16.
const s6FeedsOf = (kind: string) => ROUTING_RULES.filter(([, , k]) => k.toLowerCase() === kind).map(([p, r]) => `${p} · ${r}`);
const S6_STAYHOME = PROBLEM_SHEET.flatMap(({ tools }) => tools).filter((t) => !S2_MOVERS.has(t));
// the left column's seven groups: the six kinds (posting shown empty),
// then THE SIXTEEN — a label is gold only when it IS a kind/table name.
const S6_GROUPS = [
  ...S6_TABLES.map(([kind, , lane]) => ({ label: kind, isKind: true, lane, items: s6FeedsOf(kind) })),
  { label: 'THE SIXTEEN', isKind: false, lane: 'authored' as const, items: S6_STAYHOME },
] as const;
// the two lanes, [key, header, gloss] — headers render RUST, never gold.
const S6_LANES = [
  ['observed', 'OBSERVED', 'the world handed it to you — it arrived finished, you can\'t edit it'],
  ['authored', 'AUTHORED', 'you made it happen'],
] as const;

// S6-GEOM: left list x 0..L_W; the SOURCE pull-out at M_X (the fold
// applied to source — the step-4 idiom); the two landing lanes at R_X..W
// (the step-2 landing-block idiom).
const S6_GEOM = {
  W: 1216, L_W: 300, M_X: 380, M_W: 90, R_X: 640,
  HEAD: 22, ROW_H: 20, LANE_HEAD: 44, LANE_GAP: 16,
} as const;

// THE LAYOUT LAW (PR-DATAFLOW): flattens the groups into the row grid,
// computes every arrow — left item row, dead level through its source
// cell, then into its OWN landing row in its lane. Landings are
// per-item, so no heads ever share a row (asserted — the S2_CONVERGE
// fan case never arises). THROWS at build if the stay-homes are not
// sixteen, the lane blocks break contiguity, the counts are not 16/20,
// a landing row is shared, or any two arrows would cross. A green build
// is the proof.
const S6_LAYOUT = (() => {
  if (S6_STAYHOME.length !== 16) throw new Error(`slide 06: the stay-homes must number sixteen — got ${S6_STAYHOME.length}`);
  let y = S6_GEOM.HEAD;
  const headerYs: number[] = [];
  const itemRows: Array<{ name: string; lane: 'observed' | 'authored'; ly: number }> = [];
  S6_GROUPS.forEach((g) => {
    headerYs.push(y);
    y += S6_GEOM.ROW_H;
    g.items.forEach((name) => {
      itemRows.push({ name, lane: g.lane, ly: y + S6_GEOM.ROW_H / 2 });
      y += S6_GEOM.ROW_H;
    });
  });
  const leftH = y;
  const nObs = itemRows.filter((r) => r.lane === 'observed').length;
  const nAuth = itemRows.length - nObs;
  if (nObs !== 16 || nAuth !== 20) throw new Error(`slide 06: expected 16 world-given and 20 you-made items, got ${nObs}/${nAuth}`);
  const firstAuth = itemRows.findIndex((r) => r.lane === 'authored');
  if (itemRows.slice(0, firstAuth).some((r) => r.lane !== 'observed') || itemRows.slice(firstAuth).some((r) => r.lane !== 'authored')) throw new Error('slide 06: the lane blocks are not contiguous — reorder the groups');
  const laneTop = { observed: 0, authored: S6_GEOM.LANE_HEAD + nObs * S6_GEOM.ROW_H + S6_GEOM.LANE_GAP };
  const landed = { observed: 0, authored: 0 };
  const arrows = itemRows.map((r) => {
    const ry = laneTop[r.lane] + S6_GEOM.LANE_HEAD + landed[r.lane] * S6_GEOM.ROW_H + S6_GEOM.ROW_H / 2;
    landed[r.lane] += 1;
    return { ...r, ry, source: r.lane === 'observed' ? 'world' : 'you' };
  });
  if (new Set(arrows.map((a) => a.ry)).size !== arrows.length) throw new Error('slide 06: two arrows share a landing row');
  for (let a = 0; a < arrows.length; a += 1) {
    for (let b = a + 1; b < arrows.length; b += 1) {
      if ((arrows[a].ly - arrows[b].ly) * (arrows[a].ry - arrows[b].ry) <= 0) throw new Error('slide 06: arrows would cross — reorder the items');
    }
  }
  const laneH = { observed: S6_GEOM.LANE_HEAD + nObs * S6_GEOM.ROW_H, authored: S6_GEOM.LANE_HEAD + nAuth * S6_GEOM.ROW_H };
  return { headerYs, arrows, laneTop, laneH, leftH, nObs, nAuth } as const;
})();
const S6_H = Math.max(S6_LAYOUT.leftH, S6_LAYOUT.laneTop.authored + S6_LAYOUT.laneH.authored);

// DECK-07 (PR-DATAFLOW → PR-ALL-25): ALL twenty-five tools run the loop.
// The drawing's source is LOOP_BY_TOOL, keyed by PROBLEM_SHEET name; the
// five-tool LOOP_TOOLS / LOOP_ROWS retired INTO it, their cells carried
// over verbatim (byte-gated by the PR script) — the old TRADING column
// lives at Brokerage, since the sheet splits the trade into Brokerage
// (place it) and Trade Log (log it). Bookkeeping's commit is honestly an
// internal post to the ledger. The four beats are the loop's own names —
// the moves block and the h2 carry the same four words.
const S7_BEATS = ['DISCOVER', 'DECIDE', 'COMMIT', 'RECORD'] as const;
// LOOP-BY-TOOL: [discover, decide, commit, record] — the founder's data
// model; nouns tune on Preview. The S7_LAYOUT law asserts the keys equal
// PROBLEM_SHEET's cells EXACTLY (25/25 — any drift throws at build).
const LOOP_BY_TOOL: Readonly<Record<string, readonly [string, string, string, string]>> = {
  CRM: ['leads coming in', 'a draft contact', 'the contact is saved, the deal opens', 'contact recorded'],
  Bookkeeping: ['transactions waiting to be booked', 'a draft entry, an account picked', 'the entry posts to the ledger', 'entry recorded'],
  'Bill Pay': ['bills coming due', 'a draft payment', 'the payment sends, the bill is paid', 'payment recorded'],
  Calendar: ['open time on the calendar', 'a draft event', 'the event is set, invites go out', 'event recorded'],
  Banking: ['your balances', 'a draft transfer', 'the transfer sends between accounts', 'transfer recorded'],
  Debt: ['what\'s owed and when', 'a draft payment', 'the payment goes to the lender', 'payment recorded'],
  Contracts: ['terms on the table', 'a draft contract', 'it\'s signed, both parties bound', 'contract recorded'],
  Payroll: ['hours and wages due', 'a draft payroll run', 'the run pays out, people get paid', 'payroll recorded'],
  'Fixed Assets': ['what you bought', 'a draft asset entry', 'the asset is placed in service', 'asset recorded'],
  Tasks: ['what needs doing', 'a draft task', 'the task is committed to the plan', 'task recorded'],
  Tax: ['the year\'s numbers', 'a draft return', 'the return files with the IRS', 'return recorded'],
  'Sales Tax': ['sales by jurisdiction', 'a draft filing', 'the filing goes to the state', 'filing recorded'],
  Invoicing: ['invoices coming due', 'a draft invoice', 'invoice #14 goes out the door', 'invoice recorded'],
  Retirement: ['room to contribute', 'a draft contribution', 'the contribution moves to the account', 'contribution recorded'],
  Compliance: ['controls due for review', 'a draft attestation', 'the attestation is signed', 'attestation recorded'],
  Expenses: ['receipts to log', 'a draft expense', 'the expense is submitted', 'expense recorded'],
  Time: ['hours worked', 'a draft time entry', 'the hours are logged to the project', 'time recorded'],
  Payments: ['what you\'re owed', 'a draft payment request', 'the payment collects', 'payment recorded'],
  Travel: ['live flight prices', 'a cart', 'the flight books, a confirmation code comes back', 'booking recorded'],
  Brokerage: ['option chains', 'a trade card', 'the order goes to the broker', 'order recorded'],
  'Ent Filings': ['filings coming due', 'a draft filing', 'it files with the state, a confirmation comes back', 'filing recorded'],
  Mileage: ['miles driven', 'a draft trip', 'the trip is logged', 'trip recorded'],
  'Trade Log': ['fills from the broker', 'a draft trade record', 'the trade is logged with entry and exit', 'trade record recorded'],
  Budget: ['last period\'s spend', 'a draft budget', 'the budget is set for the period', 'budget recorded'],
  'FP&A': ['the trend lines', 'a draft forecast', 'the forecast is published', 'forecast recorded'],
};

// S7-GEOM: the S6/S8 tight pitch — twenty-five rows read as one flow.
const S7_GEOM = { W: 1216, T_W: 116, C_W: 50, HEAD: 22, ROW_H: 20 } as const;
const S7_STAGE_W = (S7_GEOM.W - S7_GEOM.T_W - 4 * S7_GEOM.C_W) / 4;
const s7StageX = (s: number) => S7_GEOM.T_W + S7_GEOM.C_W + s * (S7_STAGE_W + S7_GEOM.C_W);

// THE LAYOUT LAW (S7 → ALL-25): rows from PROBLEM_SHEET in its order;
// LOOP_BY_TOOL must cover exactly those keys; every row must carry all
// four cells (missing throws); one DEAD-LEVEL arrow per tool, proven
// pairwise — level arrows on distinct row centers cannot cross. A green
// build is the proof.
const S7_LAYOUT = (() => {
  if (S7_BEATS.length !== 4) throw new Error('slide 07: the loop has four beats');
  const tools = PROBLEM_SHEET.flatMap(({ tools: t }) => t as readonly string[]);
  if (tools.length !== 25) throw new Error(`slide 07: the sheet must hold twenty-five tools — got ${tools.length}`);
  const missing = tools.filter((t) => !(t in LOOP_BY_TOOL));
  const extra = Object.keys(LOOP_BY_TOOL).filter((k) => !tools.includes(k));
  if (missing.length || extra.length) throw new Error(`slide 07: LOOP_BY_TOOL drifted from the sheet — missing [${missing.join(', ')}], extra [${extra.join(', ')}]`);
  const rows = tools.map((tool, i) => {
    const cells = LOOP_BY_TOOL[tool];
    if (cells.length !== 4 || cells.some((c) => !c)) throw new Error(`slide 07: ${tool} is missing a beat cell`);
    return { tool, cells, y: S7_GEOM.HEAD + i * S7_GEOM.ROW_H + S7_GEOM.ROW_H / 2 };
  });
  for (let a = 0; a < rows.length; a += 1) {
    for (let b = a + 1; b < rows.length; b += 1) {
      if ((rows[a].y - rows[b].y) * (rows[a].y - rows[b].y) <= 0) throw new Error('slide 07: arrows would cross or overlap — the rows must keep distinct centers');
    }
  }
  return { rows } as const;
})();
const S7_H = S7_GEOM.HEAD + S7_LAYOUT.rows.length * S7_GEOM.ROW_H;

// DECK-08 (PR-VOICE → PR-S8-DATAFLOW): the four things every document
// carries, [name, desc]. The static two-column field table died (SHOW
// DON'T ECHO — the master table is DRAWN now); MASTER_ROWS survives as
// the SOURCE of the drawn table's four field headers — the name column
// with its '(N) ' prefix and trailing period stripped — so the fields
// cannot drift from the essay's items. The descs render nowhere.
const MASTER_ROWS = [
  ['(1) What it is', 'a booking, an invoice, a trade.'],
  ['(2) Its life story', 'draft → committed → settled, or void, if it dies.'],
  ['(3) Its pieces', 'the flights in a booking, the items on an invoice.'],
  ['(4) Who did it, and when.', ''],
] as const;

// S8-DOCUMENTS: the founder's data model — [what it is, its pieces],
// keyed by PROBLEM_SHEET tool name. The S8_LAYOUT law asserts the keys
// equal PROBLEM_SHEET's cells EXACTLY (25, no missing, no extra, no
// misspelling — any drift throws at build). Nouns tune on Preview.
const TOOL_DOCUMENTS: Readonly<Record<string, readonly [string, string]>> = {
  CRM: ['a contact', 'the deals, the notes'],
  Bookkeeping: ['a ledger entry', 'the debits and credits'],
  'Bill Pay': ['a bill payment', 'the bill, the amount, the payee'],
  Calendar: ['an event', 'the time, the attendees'],
  Banking: ['a transfer', 'the from, the to, the amount'],
  Debt: ['a debt payment', 'the principal, the interest'],
  Contracts: ['a contract', 'the parties, the terms'],
  Payroll: ['a payroll run', 'the employees, the wages'],
  'Fixed Assets': ['an asset', 'the cost, the depreciation'],
  Tasks: ['a task', 'the steps, the due date'],
  Tax: ['a tax return', 'the forms, the schedules'],
  'Sales Tax': ['a sales-tax filing', 'the jurisdictions, the amounts'],
  Invoicing: ['an invoice', 'the line items'],
  Retirement: ['a contribution', 'the account, the amount'],
  Compliance: ['an attestation', 'the controls, the evidence'],
  Expenses: ['an expense', 'the receipt, the category'],
  Time: ['a time entry', 'the hours, the project'],
  Payments: ['a payment', 'the payer, the amount'],
  Travel: ['a booking', 'the flights, the nights'],
  Brokerage: ['a trade', 'the legs'],
  'Ent Filings': ['a filing', 'the forms'],
  Mileage: ['a trip', 'the miles, the purpose'],
  'Trade Log': ['a trade record', 'the entry, the exit, the P&L'],
  Budget: ['a budget', 'the lines, the period'],
  'FP&A': ['a forecast', 'the assumptions, the scenarios'],
};
// the two SAME-ON-EVERY-ROW fields — the repetition IS the teaching:
// different names, same shape.
const S8_LIFE = 'draft → committed → settled';
const S8_WHO = 'you · the moment you committed';

// S8-GEOM: the records list, the WHAT-IT-IS pull-out, the master table —
// all three panels top-aligned on one row grid, so every arrow runs DEAD
// LEVEL (the S6 tight pitch; 25 rows read as one table).
const S8_GEOM = { W: 1216, L_W: 150, M_X: 230, M_W: 170, R_X: 470, HEAD: 22, ROW_H: 20 } as const;

// THE LAYOUT LAW (S8): the 25 rows come from PROBLEM_SHEET in its order;
// TOOL_DOCUMENTS must cover exactly those keys; every row must resolve
// all four fields (the two per-tool fields non-empty, the two shared
// fields constant); one dead-level arrow per record, proven pairwise —
// level arrows on distinct row centers cannot cross. THROWS at build on
// any violation; a green build is the proof.
const S8_LAYOUT = (() => {
  const tools = PROBLEM_SHEET.flatMap(({ tools: t }) => t as readonly string[]);
  if (tools.length !== 25) throw new Error(`slide 08: the sheet must hold twenty-five tools — got ${tools.length}`);
  const missing = tools.filter((t) => !(t in TOOL_DOCUMENTS));
  const extra = Object.keys(TOOL_DOCUMENTS).filter((k) => !tools.includes(k));
  if (missing.length || extra.length) throw new Error(`slide 08: TOOL_DOCUMENTS drifted from the sheet — missing [${missing.join(', ')}], extra [${extra.join(', ')}]`);
  const fields = MASTER_ROWS.map(([name]) => name.replace(/^\(\d\) /, '').replace(/\.$/, '').toUpperCase());
  if (fields.length !== 4) throw new Error('slide 08: a document carries four fields');
  const rows = tools.map((tool, i) => {
    const doc = TOOL_DOCUMENTS[tool];
    if (!doc[0] || !doc[1] || !S8_LIFE || !S8_WHO) throw new Error(`slide 08: ${tool} does not resolve all four fields`);
    return { tool, what: doc[0], pieces: doc[1], y: S8_GEOM.HEAD + i * S8_GEOM.ROW_H + S8_GEOM.ROW_H / 2 };
  });
  for (let a = 0; a < rows.length; a += 1) {
    for (let b = a + 1; b < rows.length; b += 1) {
      if ((rows[a].y - rows[b].y) * (rows[a].y - rows[b].y) <= 0) throw new Error('slide 08: arrows would cross or overlap — the rows must keep distinct centers');
    }
  }
  return { rows, fields } as const;
})();
const S8_H = S8_GEOM.HEAD + S8_LAYOUT.rows.length * S8_GEOM.ROW_H;

// DECK-09 (PR-S9-DATAFLOW): MATCH_CARDS' single deposit/invoice example
// retired — the match is DRAWN now, all fourteen money movers at once
// (SHOW DON'T ECHO). History holds the const.

// S9-MATCHES: observed event → tool, keyed by PROBLEM_SHEET name in the
// founder's ruled row order (object insertion order IS the drawing's
// order). The authored side derives from TOOL_DOCUMENTS' what-it-is noun
// — never retyped. The S9_LAYOUT law asserts every key is a sheet tool
// that resolves in TOOL_DOCUMENTS, and that the derived no-match set is
// exactly eleven. Repeated events ('a bank debit' × 5) are distinct rows
// — distinct matches.
const MATCHES: Readonly<Record<string, string>> = {
  Invoicing: 'a deposit',
  Payments: 'a deposit',
  Brokerage: 'a fill',
  Travel: 'a card charge',
  Expenses: 'a card charge',
  'Fixed Assets': 'a card charge',
  'Bill Pay': 'a bank debit',
  Payroll: 'a bank debit',
  Debt: 'a bank debit',
  'Sales Tax': 'a bank debit',
  'Ent Filings': 'a bank debit',
  Retirement: 'a transfer',
  Banking: 'a transfer',
  Tax: 'a payment or refund',
};
// the KEY pulled out of both sides — the same on every row; the
// repetition is the teaching (the S8 idiom).
const S9_KEY = 'amount · date · reference';

// S9-GEOM: observed events, the KEY pull-out (the MATCH divider rides
// its band), the documents found — all top-aligned on one row grid, so
// every arrow runs DEAD LEVEL (the S6-S8 tight pitch).
const S9_GEOM = { W: 1216, L_W: 240, M_X: 360, M_W: 240, R_X: 720, HEAD: 22, ROW_H: 20 } as const;

// THE LAYOUT LAW (S9): fourteen rows from MATCHES in its ruled order;
// every key must be a PROBLEM_SHEET tool that resolves in
// TOOL_DOCUMENTS; the derived no-match set must be exactly eleven; one
// dead-level arrow per match, proven pairwise — level arrows on distinct
// row centers cannot cross. THROWS at build on any violation; a green
// build is the proof. Travel is the live-today row — the drawing and
// the hedge agree.
const S9_LAYOUT = (() => {
  const tools = PROBLEM_SHEET.flatMap(({ tools: t }) => t as readonly string[]);
  const keys = Object.keys(MATCHES);
  if (keys.length !== 14) throw new Error(`slide 09: expected fourteen money movers — got ${keys.length}`);
  const bad = keys.filter((k) => !tools.includes(k) || !(k in TOOL_DOCUMENTS));
  if (bad.length) throw new Error(`slide 09: MATCHES keys must be sheet tools with documents — bad [${bad.join(', ')}]`);
  const unmatched = tools.filter((t) => !(t in MATCHES));
  if (unmatched.length !== 11) throw new Error(`slide 09: expected eleven no-match tools — got ${unmatched.length}`);
  const rows = keys.map((tool, i) => ({
    tool,
    observed: MATCHES[tool],
    doc: TOOL_DOCUMENTS[tool][0],
    live: tool === 'Travel',
    y: S9_GEOM.HEAD + i * S9_GEOM.ROW_H + S9_GEOM.ROW_H / 2,
  }));
  for (let a = 0; a < rows.length; a += 1) {
    for (let b = a + 1; b < rows.length; b += 1) {
      if ((rows[a].y - rows[b].y) * (rows[a].y - rows[b].y) <= 0) throw new Error('slide 09: arrows would cross or overlap — the rows must keep distinct centers');
    }
  }
  return { rows, unmatched } as const;
})();
const S9_H = S9_GEOM.HEAD + S9_LAYOUT.rows.length * S9_GEOM.ROW_H;

// DECK-10 (PR-S10-DATAFLOW): the posting rules, re-keyed by MATCHES tool
// → [event, debit account, credit account] — slide 9's matched movers are
// exactly the events a rule fires for; the S10_LAYOUT law asserts the
// keys match 14/14 and that every row carries both accounts. The old
// rule book's five rows carry verbatim (these are Alex's books — he
// tunes accounts on Preview): four live here; the fifth, the
// stripe-payout row, lives on as SALE_RULE under the worked sale (it is
// what the three drawn lines demonstrate). Debit/credit account words
// keep the gold money licence at the render. Feeds the middle panel
// only — the static rules table retired (SHOW DON'T ECHO).
const POSTING_RULES: Readonly<Record<string, readonly [string, string, string]>> = {
  Invoicing: ['invoice issued', 'A/R', 'Revenue'],
  Payments: ['payment received', 'Cash', 'A/R'],
  Brokerage: ['fill', 'Investments', 'Cash'],
  Travel: ['booking charged', 'Travel', 'Card Payable'],
  Expenses: ['expense charged', 'Expense', 'Card Payable'],
  'Fixed Assets': ['asset bought', 'Fixed Assets', 'Cash'],
  'Bill Pay': ['bill paid', 'A/P', 'Cash'],
  Payroll: ['payroll run', 'Wages + employer taxes', 'Cash + withholdings'],
  Debt: ['debt payment', 'Loan Payable + Interest', 'Cash'],
  'Sales Tax': ['sales tax paid', 'Sales Tax Payable', 'Cash'],
  'Ent Filings': ['filing fee paid', 'Filing Fees', 'Cash'],
  Retirement: ['contribution', 'Retirement', 'Cash'],
  Banking: ['transfer', 'Cash (to)', 'Cash (from)'],
  Tax: ['tax paid', 'Tax Expense', 'Cash'],
};

// the worked sale's rule — the old rule book's stripe-payout row, verbatim.
const SALE_RULE = ['stripe payout', 'Cash + Fees', 'Clearing'] as const;

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

// S10-GEOM: matched events, THE RULE pull-out, the posting table filling
// — all top-aligned on one row grid, so every arrow runs DEAD LEVEL (the
// S6–S9 tight pitch). HEAD is tall enough for the posting panel's
// three-line header; all three panels share it so the rows stay aligned.
const S10_GEOM = { W: 1216, L_W: 320, M_X: 420, M_W: 280, R_X: 800, HEAD: 50, ROW_H: 20 } as const;

// THE LAYOUT LAW (S10): fourteen rows from MATCHES in its ruled order —
// slide 9's matches ARE slide 10's inputs. POSTING_RULES' keys must
// equal MATCHES' keys both ways; every rule must carry both accounts;
// the derived no-money set (PROBLEM_SHEET − MATCHES) must be exactly
// eleven — the same eleven slide 9 named. One dead-level arrow per
// event, proven pairwise — level arrows on distinct row centers cannot
// cross. THROWS at build on any violation; a green build is the proof.
const S10_LAYOUT = (() => {
  const matched = Object.keys(MATCHES);
  const ruled = Object.keys(POSTING_RULES);
  if (matched.length !== 14 || ruled.length !== 14) throw new Error(`slide 10: expected fourteen matched events and fourteen rules — got ${matched.length}/${ruled.length}`);
  const bad = matched.filter((k) => !(k in POSTING_RULES)).concat(ruled.filter((k) => !(k in MATCHES)));
  if (bad.length) throw new Error(`slide 10: POSTING_RULES keys must equal MATCHES keys — bad [${bad.join(', ')}]`);
  const empty = matched.filter((k) => !POSTING_RULES[k][1] || !POSTING_RULES[k][2]);
  if (empty.length) throw new Error(`slide 10: every rule needs both accounts — missing on [${empty.join(', ')}]`);
  const noMoney = PROBLEM_SHEET.flatMap(({ tools: t }) => t as readonly string[]).filter((t) => !(t in MATCHES));
  if (noMoney.length !== 11) throw new Error(`slide 10: expected eleven no-money tools — got ${noMoney.length}`);
  const rows = matched.map((tool, i) => ({
    tool,
    event: POSTING_RULES[tool][0],
    debit: POSTING_RULES[tool][1],
    credit: POSTING_RULES[tool][2],
    y: S10_GEOM.HEAD + i * S10_GEOM.ROW_H + S10_GEOM.ROW_H / 2,
  }));
  for (let a = 0; a < rows.length; a += 1) {
    for (let b = a + 1; b < rows.length; b += 1) {
      if (rows[a].y === rows[b].y) throw new Error('slide 10: arrows would cross or overlap — the rows must keep distinct centers');
    }
  }
  return { rows, noMoney } as const;
})();
const S10_H = S10_GEOM.HEAD + S10_LAYOUT.rows.length * S10_GEOM.ROW_H;

// NAV-01c: ANSWER_ROWS (the four questions and their math lines) and
// ANSWER_INPUTS (the lines each answer reads) moved to the shared leaf
// src/lib/answers.ts — one source, as PROBLEM_SHEET moved (NAV-01a): the deck
// renders them, /answers renders them, the build-time law reads them. Imported
// at the top beside PROBLEM_SHEET; the S11 / S13 / S14 laws below are unchanged.

// S11-GEOM: the lines (grouped by answer), THE MATH pull-out (one lens
// per group, spanning its rows), the four answer cards. Rows on one
// grid; heads fan on the landing in row order — the S2_CONVERGE pattern
// — so converging heads never stack.
const S11_GEOM = { W: 1216, L_W: 300, M_X: 380, M_W: 280, R_X: 740, CARD_W: 300, CARD_H: 44, HEAD: 22, GROUP_HEAD: 18, ROW_H: 20, FAN: 7 } as const;

// THE LAYOUT LAW (S11): rows derive from ANSWER_INPUTS in ANSWER_ROWS
// order; every answer must carry an entry (4/4); every input must
// resolve — a POSTING_RULES account or a ROUTING_RULES feed — else
// throw. Groups tile contiguously and answers land in group order, so
// sources and landings keep ONE order; the pairwise test proves no two
// arrows cross. THROWS at build on any violation; green build = proof.
const S11_LAYOUT = (() => {
  const questions = ANSWER_ROWS.map(([q]) => q);
  if (questions.length !== 4 || Object.keys(ANSWER_INPUTS).length !== 4 || questions.some((q) => !(q in ANSWER_INPUTS)))
    throw new Error('slide 11: every answer needs its lines — ANSWER_INPUTS must cover ANSWER_ROWS 4/4');
  const accounts = new Set<string>(Object.values(POSTING_RULES).flatMap(([, d, c]) => [d, c]));
  const feeds = new Set<string>(ROUTING_RULES.map(([p, r]) => `${p} ${r}`));
  const bad = questions.flatMap((q) => ANSWER_INPUTS[q].filter((s) => !accounts.has(s) && !feeds.has(s)));
  if (bad.length) throw new Error(`slide 11: every line must be a POSTING_RULES account or a ROUTING_RULES feed — bad [${bad.join(', ')}]`);
  let yy = S11_GEOM.HEAD;
  const groups = questions.map((question, gi) => {
    const items = ANSWER_INPUTS[question];
    const top = yy;
    const h = S11_GEOM.GROUP_HEAD + items.length * S11_GEOM.ROW_H;
    const ay = top + h / 2;
    const rows = items.map((name, i) => ({
      name,
      ly: top + S11_GEOM.GROUP_HEAD + i * S11_GEOM.ROW_H + S11_GEOM.ROW_H / 2,
      ty: ay + (i - (items.length - 1) / 2) * S11_GEOM.FAN,
    }));
    yy += h;
    return { question, gi, top, h, ay, rows, math: ANSWER_ROWS[gi][1] };
  });
  for (const g of groups) {
    for (const r of g.rows) {
      if (r.ly <= g.top || r.ly >= g.top + g.h || r.ty <= g.top || r.ty >= g.top + g.h)
        throw new Error(`slide 11: group is not contiguous — a row or landing escapes its block (${g.question})`);
    }
  }
  const arrows = groups.flatMap((g) => g.rows.map((r) => ({ ...r, gi: g.gi })));
  for (let a = 0; a < arrows.length; a += 1) {
    for (let b = a + 1; b < arrows.length; b += 1) {
      if (arrows[a].ly === arrows[b].ly || (arrows[a].ly < arrows[b].ly) !== (arrows[a].ty < arrows[b].ty))
        throw new Error('slide 11: arrows would cross — sources and landings must keep one order');
    }
  }
  return { groups, arrows, h: yy } as const;
})();
const S11_H = S11_LAYOUT.h;

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

// S12-ITEMS (PR-S12-DATAFLOW): every dated thing the pipe made, derived
// from the four existing consts — the ledger lines (moments, on their
// dates), the calendar bars (spans, start→end derived from their percent
// geometry), the dots (moments, on their days), the real deadlines
// (moments, name and date split from the essay sentences; their dates
// live outside the two-week window by nature, so the in-range assert
// covers the window items and the deadlines assert a derived date and
// land under the real-deadlines strip instead). Sorted by date (window day
// order; deadlines after, in CAL_DEADLINES order); the sort is the
// no-crossing law's spine. Nothing retyped: names, dates and amounts all
// come from the consts.
type S12Item = {
  readonly name: string;
  readonly date: string;
  readonly kind: 'a moment' | 'a span';
  readonly isLine: boolean;
  readonly key: number;
  readonly row: readonly [string, string, string, string] | null;
};
const S12_ITEMS: readonly S12Item[] = (() => {
  const days = CAL_DAYS as readonly string[];
  const items: S12Item[] = [];
  for (const [date, line, debit, credit] of LEDGER_ROWS) {
    const idx = days.indexOf(date.split(' ')[1]);
    if (idx < 0) throw new Error(`slide 12: ledger date outside the window — ${date}`);
    items.push({ name: line, date, kind: 'a moment', isLine: true, key: idx, row: [date, line, debit, credit] });
  }
  for (const bar of CAL_BARS) {
    const start = Math.round((bar.left * days.length) / 100);
    const end = Math.round(((bar.left + bar.width) * days.length) / 100) - 1;
    if (start < 0 || end > days.length - 1 || start > end) throw new Error(`slide 12: bar outside the window — ${bar.label}`);
    items.push({ name: bar.label, date: `Sep ${days[start]}–${days[end]}`, kind: 'a span', isLine: false, key: start, row: null });
  }
  for (const dot of CAL_DOTS) {
    const idx = dot.day - 1;
    if (idx < 0 || idx > days.length - 1) throw new Error(`slide 12: dot outside the window — ${dot.label}`);
    items.push({ name: dot.label, date: `Sep ${days[idx]}`, kind: 'a moment', isLine: false, key: idx, row: null });
  }
  CAL_DEADLINES.forEach((s, i) => {
    const cut = s.indexOf(' — ');
    const back = s.lastIndexOf(' — ');
    if (cut < 0 || back <= cut) throw new Error(`slide 12: a deadline needs a name and a date — ${s}`);
    const name = s.slice(0, cut);
    const date = s.slice(back + 3).replace(/\.$/, '');
    if (!name || !date) throw new Error(`slide 12: a deadline needs a name and a date — ${s}`);
    items.push({ name, date, kind: 'a moment', isLine: false, key: 100 + i, row: null });
  });
  return items.slice().sort((a, b) => a.key - b.key);
})();

// S12-GEOM: calendar window LEFT, the dated things + WHEN in the CENTER,
// ledger window RIGHT. The calendar set exits left, the ledger set exits
// right — the two arrow sets live in separate half-planes, so they can
// never meet; within each set sources and landings share one date order,
// so each corridor is monotone. (Both windows stacked on one side cannot
// be crossing-free: one line item's calendar arrow must cross another's
// ledger arrow — the half-planes are load-bearing, not styling.)
const S12_GEOM = { W: 1216, CAL_W: 380, C_X: 460, C_W: 360, L_X: 900, HEAD: 22, ROW_H: 20, DAY_H: 18, BODY_H: 132, DLL_H: 16, DL_H: 16, SLOT0: 44, SLOT: 16, LED_TOP: 40, LED_HEAD: 18, LED_ROW: 20 } as const;

// THE LAYOUT LAW (S12): every dated thing rides once; window items keep
// dates inside CAL_DAYS (asserted at derive); the ledger landing and the
// calendar entries are both date-monotonic; every item lands in the
// calendar window and every line also lands in the ledger; the pairwise
// one-order test proves each corridor crossing-free, and the half-plane
// split is asserted from the geometry. THROWS at build on any violation;
// a green build is the proof.
const S12_LAYOUT = (() => {
  const n = S12_ITEMS.length;
  if (n !== LEDGER_ROWS.length + CAL_BARS.length + CAL_DOTS.length + CAL_DEADLINES.length)
    throw new Error(`slide 12: every dated thing rides once — got ${n}`);
  const rows = S12_ITEMS.map((it, i) => ({ ...it, ly: S12_GEOM.HEAD + i * S12_GEOM.ROW_H + S12_GEOM.ROW_H / 2 }));
  const windowed = rows.filter((r) => r.key < 100);
  const deadlines = rows.filter((r) => r.key >= 100);
  rows.forEach((r, i) => {
    if (r.key >= 100 && i < n - deadlines.length) throw new Error('slide 12: window items must precede the deadlines');
  });
  const dlTop = S12_GEOM.HEAD + S12_GEOM.DAY_H + S12_GEOM.BODY_H + S12_GEOM.DLL_H;
  const calArrows = windowed
    .map((r, k) => ({ ...r, ty: S12_GEOM.SLOT0 + k * S12_GEOM.SLOT }))
    .concat(deadlines.map((r, j) => ({ ...r, ty: dlTop + j * S12_GEOM.DL_H + S12_GEOM.DL_H / 2 })));
  if (calArrows.length !== n) throw new Error('slide 12: an item lands nowhere');
  const lines = rows.filter((r) => r.isLine).map((r) => {
    if (!r.row) throw new Error(`slide 12: a ledger line lost its row — ${r.name}`);
    return { ...r, row: r.row };
  });
  if (lines.length !== LEDGER_ROWS.length) throw new Error('slide 12: every ledger line lands in the ledger');
  for (let a = 1; a < lines.length; a += 1) {
    if (lines[a].key < lines[a - 1].key) throw new Error('slide 12: the ledger landing must be date-monotonic');
  }
  for (let a = 1; a < calArrows.length; a += 1) {
    if (calArrows[a].ty <= calArrows[a - 1].ty) throw new Error('slide 12: the calendar entries must be date-monotonic');
  }
  const ledArrows = lines.map((r, k) => ({ ...r, ty: S12_GEOM.LED_TOP + S12_GEOM.LED_HEAD + k * S12_GEOM.LED_ROW + S12_GEOM.LED_ROW / 2 }));
  for (const set of [calArrows, ledArrows]) {
    for (let a = 0; a < set.length; a += 1) {
      for (let b = a + 1; b < set.length; b += 1) {
        if (set[a].ly === set[b].ly || (set[a].ly < set[b].ly) !== (set[a].ty < set[b].ty))
          throw new Error('slide 12: arrows would cross — sources and landings must keep one order');
      }
    }
  }
  if (S12_GEOM.CAL_W >= S12_GEOM.C_X || S12_GEOM.C_X + S12_GEOM.C_W >= S12_GEOM.L_X)
    throw new Error('slide 12: the two windows must keep their half-planes');
  const h = Math.max(S12_GEOM.HEAD + n * S12_GEOM.ROW_H, dlTop + CAL_DEADLINES.length * S12_GEOM.DL_H);
  return { rows, calArrows, ledArrows, lines, deadlines, h } as const;
})();
const S12_H = S12_LAYOUT.h;

// DECK-13 (PR-S13-ALL-25): the five doors became the full sheet — every
// one of the twenty-five tools runs the same eight beats, fourteen throw
// a shadow, eleven don't (the 14/11 split slide 9 proved). DOOR_COLS and
// S13_LANES retired: the lanes ARE PROBLEM_SHEET's cells now, in sheet
// order (the slide-8 idiom) — tools as rows, beats as columns, one
// dead-level arrow per lane. Same derivations, same hero dollar;
// S13_LAYOUT keeps heroRows/heroDate/amount so slide 14's law reads it
// untouched. History holds the five-lane consts.

// S13-BEATS: [step tag, name, source] — the tag names the slide each
// cell's derivation comes from; the first three names ARE S7_BEATS.
const S13_BEATS = [
  ['07', S7_BEATS[0], 'LOOP_BY_TOOL'],
  ['07', S7_BEATS[1], 'LOOP_BY_TOOL'],
  ['07', S7_BEATS[2], 'LOOP_BY_TOOL'],
  ['09', 'THE WORLD ANSWERS (OBSERVED)', 'MATCHES'],
  ['09', 'MATCH', 'MATCHES × TOOL_DOCUMENTS'],
  ['10', 'LINES WRITTEN', 'POSTING_RULES × LEDGER_ROWS'],
  ['11', 'MATH RUNS', 'ANSWER_INPUTS × S13_LENS'],
  ['12', 'YOU LOOK', 'S12_ITEMS × S13_LANDINGS'],
] as const;

// S13-LENS: question → the short word MATH RUNS renders. The law asserts
// the keys equal ANSWER_ROWS' questions 4/4; the MATH cells themselves
// are always derived from ANSWER_INPUTS, never listed.
const S13_LENS: Readonly<Record<string, string>> = {
  'What do I owe in tax?': 'tax',
  'How long can I last?': 'runway',
  'How is my trading doing?': 'trading',
  'How is my business doing?': 'the business',
};

// S13-LANDINGS: lane tool → the S12_ITEMS names it lands on, resolved BY
// NAME by the law (a name that resolves nowhere throws). Empty = the lane
// has no slide-12 landing yet and must supply a YOU LOOK shape.
const S13_LANDINGS: Readonly<Record<string, readonly string[]>> = {
  Invoicing: ['Revenue', 'Fees', 'Cash', 'Invoice #14 due — Sep 22'],
  Travel: ['Travel', 'Trip — Sep 20–27'],
  Brokerage: [],
  Payroll: [],
  Tasks: [],
};

// S13-OWN: supplied ONLY where no derivation exists — one entry. Tasks
// (the Truth Machine) has no MATCHES key, so it supplies its observed
// noun; the law throws on any other entry, and on a supplied cell any
// derivation can produce. The old YOU LOOK shapes died — no shapes for
// things slide 12 doesn't draw; lanes without landings render the faint
// long dash.
const S13_OWN: Readonly<Record<string, { readonly observed: string }>> = {
  Tasks: { observed: 'the finished build' },
};

// DECK-13 (PR-VOICE → PR-S13-DATAFLOW): truth (1), the trade close. The
// two rule-book accounts now DERIVE from POSTING_RULES.Brokerage — the
// old strip retyped an account name the rule book never wrote — and the
// sentence says 'the close writes' (the rule book carries no
// close rule, so the strip claims none). The gain leg stays. Amounts
// carried verbatim from the old strip.
const TRADE_CLOSE: ReadonlyArray<readonly [string, boolean]> = [
  ['(1) When a trade closes, the gain gets its own line. Sell for ', false],
  ['5,300.00', true],
  [' what you bought for ', false],
  ['5,000.00', true],
  [', and the close writes: debit ', false],
  [`${POSTING_RULES.Brokerage[2]} 5,300.00`, true],
  [', credit ', false],
  [`${POSTING_RULES.Brokerage[1]} 5,000.00`, true],
  [', credit ', false],
  ['Gain 300.00', true],
  ['.', false],
];
// VOICE-2: the withholdings parenthetical moved to 09's four-gloss line —
// glossed at its first on-screen use, the payroll rule row.
const HOURS_TRUTH = '(2) Your hours never write a line by themselves. They only reach the books when a payroll run commits, exactly as Step 10 promised.';

// S13-GEOM: a gutter of tool names, then eight beat columns with arrow
// gaps between them (the slide-7 corridor idiom, widened to the full
// walk). 144 + 8 × (18 + 116) = 1216 — the columns land flush.
const S13_GEOM = { W: 1216, G_W: 144, COL_W: 116, GAP: 18, HEAD: 34, ROW_H: 40 } as const;

// THE LAYOUT LAW (S13): the lanes are PROBLEM_SHEET's cells 25/25, each
// with a loop and a document; a lane matches money iff it writes lines,
// fourteen do and eleven don't; the hero bindings are unchanged (the
// invoice dot's date, the sale's three lines, the sale sentence's gold
// amount) so slide 14 keeps passing untouched; supplied cells only where
// ruled (Tasks OBSERVED); twenty-five distinct row centers carry level
// arrows — zero crossings by construction; every cell wraps within
// three lines at the column budget (7px mono ≈ 4.2px per char). The law
// RECORDS money lanes whose accounts reach zero answers instead of
// throwing — that is the rule book's own wording, reported not bent.
// THROWS at build on any violation; a green build is the proof.
const S13_LAYOUT = (() => {
  type Seg = readonly [string, boolean];
  type Cell = { readonly segs: readonly Seg[]; readonly faint: boolean; readonly tag: string | null; readonly supplied: boolean };
  if (S13_BEATS.length !== 8) throw new Error('slide 13: eight beats');
  if (S13_BEATS[0][1] !== S7_BEATS[0] || S13_BEATS[1][1] !== S7_BEATS[1] || S13_BEATS[2][1] !== S7_BEATS[2])
    throw new Error('slide 13: the first three beats are Step 7 beats');
  const chars = Math.floor((S13_GEOM.COL_W - 12) / 4.2);
  const NUMS = ['zero', 'one', 'two', 'three', 'four', 'five'] as const;
  const tools = PROBLEM_SHEET.flatMap(({ tools: t }) => t as readonly string[]);
  if (tools.length !== 25) throw new Error(`slide 13: the full sheet is twenty-five — got ${tools.length}`);
  const amount = `$${SALE_LINES[0][1]}`;
  const firstGold = SALE_SENTENCE.find(([, gold]) => gold);
  if (!firstGold || firstGold[0] !== amount) throw new Error(`slide 13: the h2 dollar must be the sale sentence's — ${amount}`);
  const heroItem = S12_ITEMS.find((it) => it.name.includes('Invoice #14'));
  if (!heroItem) throw new Error('slide 13: the hero needs its invoice dot in S12_ITEMS');
  const heroDate = heroItem.date;
  const heroRows = LEDGER_ROWS.filter(([d]) => d === heroDate);
  if (heroRows.length !== SALE_LINES.length) throw new Error(`slide 13: the hero lines must be the sale's three — got ${heroRows.length}`);
  heroRows.forEach(([, line, debit, credit], i) => {
    const [saleAccount, saleAmount] = SALE_LINES[i];
    if (saleAccount.replace(/^\(\d\) /, '') !== line || (debit || credit) !== saleAmount)
      throw new Error(`slide 13: hero line ${i + 1} drifts from the sale — ${line}`);
  });
  const questions = ANSWER_ROWS.map(([q]) => q);
  if (Object.keys(S13_LENS).length !== questions.length || questions.some((q) => !(q in S13_LENS)))
    throw new Error('slide 13: S13_LENS must cover ANSWER_ROWS 4/4');
  if ('Time' in POSTING_RULES || !('Payroll' in POSTING_RULES))
    throw new Error('slide 13: hours reach the books through Payroll only');
  if (!TRADE_CLOSE.some(([t, g]) => g && t.startsWith(`${POSTING_RULES.Brokerage[2]} `)) ||
      !TRADE_CLOSE.some(([t, g]) => g && t.startsWith(`${POSTING_RULES.Brokerage[1]} `)))
    throw new Error('slide 13: the trade close must write the rule book accounts');
  const ownKeys = Object.keys(S13_OWN);
  if (ownKeys.length !== 1 || ownKeys[0] !== 'Tasks' || !S13_OWN.Tasks.observed)
    throw new Error('slide 13: supplied cells only where ruled — Tasks OBSERVED alone');
  if ('Tasks' in MATCHES) throw new Error('slide 13: Tasks derives — its supplied noun is refused');
  const wrapCount = (text: string) => {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > chars && line) { lines.push(line); line = word; } else { line = next; }
    }
    if (line) lines.push(line);
    return lines.length;
  };
  let money = 0;
  const zeroMathMoney: string[] = [];
  const lanes = tools.map((tool, i) => {
    if (!(tool in LOOP_BY_TOOL) || !(tool in TOOL_DOCUMENTS))
      throw new Error(`slide 13: every lane needs a loop and a document — ${tool}`);
    if ((tool in MATCHES) !== (tool in POSTING_RULES))
      throw new Error(`slide 13: a lane matches money iff it writes lines — ${tool}`);
    if (tool in MATCHES) money += 1;
    const own = tool in S13_OWN ? S13_OWN[tool] : undefined;
    const observed = tool in MATCHES ? MATCHES[tool] : own?.observed;
    const live = S9_LAYOUT.rows.some((r) => r.tool === tool && r.live);
    const isHero = tool === 'Invoicing';
    const label: readonly Seg[] = isHero
      ? [['Invoicing — THE ', false], [amount, true], [' SALE', false]]
      : [[tool, false]];
    const cells: Cell[] = [
      { segs: [[LOOP_BY_TOOL[tool][0], false]], faint: false, tag: null, supplied: false },
      { segs: [[LOOP_BY_TOOL[tool][1], false]], faint: false, tag: null, supplied: false },
      { segs: [[LOOP_BY_TOOL[tool][2], false]], faint: false, tag: null, supplied: false },
      observed
        ? { segs: [[`${observed} arrives`, false]], faint: false, tag: null, supplied: !(tool in MATCHES) }
        : { segs: [['—', false]], faint: true, tag: null, supplied: false },
      observed
        ? { segs: [[`${observed} ↔ ${TOOL_DOCUMENTS[tool][0]}`, false]], faint: false, tag: live ? '· LIVE TODAY' : null, supplied: false }
        : { segs: [['—', false]], faint: true, tag: null, supplied: false },
    ];
    if (isHero) {
      const segs: Seg[] = [];
      heroRows.forEach(([, line, debit, credit], k) => {
        segs.push([`${k > 0 ? ' · ' : ''}${debit ? 'debit' : 'credit'} `, false]);
        segs.push([`${line} ${debit || credit}`, true]);
      });
      cells.push({ segs, faint: false, tag: null, supplied: false });
    } else if (tool in POSTING_RULES) {
      cells.push({ segs: [['debit ', false], [POSTING_RULES[tool][1], true], [', credit ', false], [POSTING_RULES[tool][2], true]], faint: false, tag: null, supplied: false });
    } else {
      cells.push({ segs: [['none — no money moved', false]], faint: true, tag: null, supplied: false });
    }
    const laneAccounts = isHero ? heroRows.map(([, line]) => line)
      : tool in POSTING_RULES ? [POSTING_RULES[tool][1], POSTING_RULES[tool][2]] : null;
    const qs = laneAccounts ? questions.filter((q) => ANSWER_INPUTS[q].some((acc) => laneAccounts.includes(acc))) : [];
    if (qs.length > 0) {
      cells.push({ segs: [[qs.map((q) => S13_LENS[q]).join(' · '), false]], faint: false, tag: null, supplied: false });
    } else {
      if (laneAccounts) zeroMathMoney.push(tool);
      cells.push({ segs: [['—', false]], faint: true, tag: null, supplied: false });
    }
    const landings = tool in S13_LANDINGS ? S13_LANDINGS[tool] : [];
    if (landings.length > 0) {
      const resolved = landings.map((nm) => {
        const it = S12_ITEMS.find((x) => x.name === nm);
        if (!it) throw new Error(`slide 13: a landing must resolve in S12_ITEMS — ${nm}`);
        return it;
      });
      const lineCount = resolved.filter((it) => it.isLine).length;
      if (lineCount >= NUMS.length) throw new Error('slide 13: too many hero lines to name');
      const parts = lineCount > 0 ? [`${NUMS[lineCount]} line${lineCount === 1 ? '' : 's'} on the ledger`] : [];
      for (const it of resolved) {
        if (!it.isLine) parts.push(`a ${it.kind === 'a span' ? 'bar' : 'dot'} on the calendar (${it.date})`);
      }
      cells.push({ segs: [[parts.join(' · '), false]], faint: false, tag: null, supplied: false });
    } else {
      cells.push({ segs: [['—', false]], faint: true, tag: null, supplied: false });
    }
    for (const cell of cells) {
      const text = cell.segs.map(([t]) => t).join('') + (cell.tag ? ` ${cell.tag}` : '');
      if (wrapCount(text) > 3) throw new Error(`slide 13: a cell overflows its column — ${text.slice(0, 40)}`);
    }
    return { tool, label, y: S13_GEOM.HEAD + i * S13_GEOM.ROW_H + S13_GEOM.ROW_H / 2, cells };
  });
  if (money !== 14 || tools.length - money !== 11)
    throw new Error(`slide 13: fourteen money lanes, eleven without — got ${money}/${tools.length - money}`);
  for (let a = 0; a < lanes.length; a += 1) {
    for (let b = a + 1; b < lanes.length; b += 1) {
      if (lanes[a].y === lanes[b].y) throw new Error('slide 13: level arrows need distinct row centers');
    }
  }
  const colXs = S13_BEATS.map((_, s) => S13_GEOM.G_W + S13_GEOM.GAP + s * (S13_GEOM.COL_W + S13_GEOM.GAP));
  if (colXs[colXs.length - 1] + S13_GEOM.COL_W !== S13_GEOM.W) throw new Error('slide 13: the columns must land flush on the right edge');
  const supplied = lanes.flatMap((l) => l.cells.map((c, bi) => (c.supplied ? `${l.tool} ${S13_BEATS[bi][1]}` : null)).filter((s): s is string => s !== null));
  return { lanes, colXs, heroDate, heroRows, amount, supplied, zeroMathMoney, chars, h: S13_GEOM.HEAD + tools.length * S13_GEOM.ROW_H } as const;
})();
const S13_H = S13_LAYOUT.h;

// DECK-14 (PR-S14-DATAFLOW): PROOF_WALK retired — five retyped rows,
// including a payout id, a timestamp and a fingerprint the deck already
// carries as its own worked import (IMPORT_ARRIVALS, step 3). The walk
// is now seven hops, every record DERIVED from the consts slides
// 11/12/10/09/08/03 render from, each paired with the check the
// S14_LAYOUT law RUNS at build — a failed check is a failed build, so
// the drawing can never show a false proof. PROOF_TRIO stays verbatim.
const PROOF_TRIO = [
  'Nothing was edited.',
  'Nothing was asked twice.',
  'Nothing is claimed without the fingerprint.',
] as const;

// S14-WALK: [step tag, layer, source] — the tag names the slide each
// record walks back through; the source names the consts it derives from.
const S14_WALK = [
  ['11', 'THE NUMBER', 'SALE_LINES × ANSWER_INPUTS'],
  ['12', 'THE LINE', 'LEDGER_ROWS'],
  ['10', 'THE RULE', 'SALE_RULE'],
  ['09', 'THE MATCH', 'MATCHES × TOOL_DOCUMENTS × S9_KEY'],
  ['08', 'THE DOCUMENT', 'TOOL_DOCUMENTS × MASTER_ROWS'],
  ['03', 'THE ARRIVAL', 'IMPORT_ARRIVALS × IMPORT_COLUMNS × ROUTING_RULES'],
  ['03', 'THE FINGERPRINT', 'IMPORT_ARRIVALS'],
] as const;

// S14-CHECKS: the design-voice line per hop. Each is PAIRED with an
// assertion the law runs — the CHECK column renders from the law's own
// returned list, so it cannot show a check that did not pass.
const S14_CHECKS = [
  "Cash is on that answer's input list, and on no other's",
  'the ledger row equals sale line (3), account and amount',
  "the rule's debit side names Cash",
  'the invoice has a match side and a document side',
  'the document carries all four fields',
  'one stripe payout arrival · DONE · payload present · feed labeled by kind',
  'the row carries a fingerprint, made on arrival: asked ≤ arrived ≤ read',
] as const;

// S14-GEOM: one lane on the 13/14 connector — a beat gutter, THE RECORD,
// THE CHECK; fixed row pitch so the seven nodes land deterministically.
const S14_GEOM = { W: 1216, G_W: 170, R_W: 560, HEAD: 24, ROW_H: 40, NODE_TOP: 10 } as const;

// THE LAYOUT LAW (S14): seven hops, seven checks, names paired 1:1;
// every record derived; every check thrown on failure — the number's
// question is unique, the line equals the sale's Cash line, the rule
// debits Cash, the match has both sides, the document carries all four
// fields, exactly one stripe payout arrival (DONE, payload present,
// kind labeled), the fingerprint exists and asked ≤ arrived ≤ read.
// Binds 14's dollar to 13's hero row and the rule to the feed that
// carried it. Wrap metric: 7px mono ≈ 4.2px per char; a record or
// check wider than three lines at its column's budget throws.
const S14_LAYOUT = (() => {
  type Seg = readonly [string, boolean];
  if (S14_WALK.length !== 7 || S14_CHECKS.length !== 7) throw new Error('slide 14: seven hops, seven checks');
  // hop 1 — THE NUMBER
  const cashSale = SALE_LINES.find(([acct]) => acct.replace(/^\(\d\) /, '') === 'Cash');
  if (!cashSale) throw new Error('slide 14: the sale must land in Cash');
  const amount = `$${cashSale[1]}`;
  const cashQuestions = ANSWER_ROWS.map(([q]) => q).filter((q) => ANSWER_INPUTS[q].includes('Cash'));
  if (cashQuestions.length !== 1) throw new Error(`slide 14: exactly one answer reads Cash — got ${cashQuestions.length}`);
  const question = cashQuestions[0];
  const heroCash = S13_LAYOUT.heroRows.find(([, line]) => line === 'Cash');
  if (!heroCash || `$${heroCash[2] || heroCash[3]}` !== amount) throw new Error('slide 14: 13 and 14 must walk the same dollar');
  // hop 2 — THE LINE
  const ledger = LEDGER_ROWS.find(([d, l]) => d === S13_LAYOUT.heroDate && l === 'Cash');
  if (!ledger) throw new Error('slide 14: the Cash line must sit on the hero date');
  const [ledDate, ledLine, ledDebit, ledCredit] = ledger;
  if (ledLine !== cashSale[0].replace(/^\(\d\) /, '') || (ledDebit || ledCredit) !== cashSale[1])
    throw new Error('slide 14: the ledger row must equal sale line (3), account and amount');
  // hop 3 — THE RULE
  if (!SALE_RULE[1].includes('Cash')) throw new Error('slide 14: the rule must debit Cash');
  // hop 4 — THE MATCH
  if (!('Invoicing' in MATCHES) || !('Invoicing' in TOOL_DOCUMENTS)) throw new Error('slide 14: the invoice needs a match side and a document side');
  // hop 5 — THE DOCUMENT
  if (MASTER_ROWS.length !== 4) throw new Error('slide 14: the document carries four fields');
  if (!TOOL_DOCUMENTS.Invoicing[0] || !TOOL_DOCUMENTS.Invoicing[1] || !S8_LIFE || !S8_WHO)
    throw new Error('slide 14: the document fields must all be present');
  // hop 6 — THE ARRIVAL
  const arrivals = IMPORT_ARRIVALS.filter((r) => r[0] === 'stripe' && r[2] === 'payout');
  if (arrivals.length !== 1) throw new Error(`slide 14: exactly one stripe payout arrival — got ${arrivals.length}`);
  // widened: the as-const tuple union would let the DONE narrowing mark
  // the payload/fingerprint guards impossible — they are runtime guards.
  const arrival: readonly string[] = arrivals[0];
  const [provider, , resource, theirId, , payload, fingerprint, asked, arrived, read, status] = arrival;
  if (status !== 'DONE') throw new Error('slide 14: the arrival must be DONE');
  if (payload === '—') throw new Error('slide 14: the arrival must carry its payload');
  const payloadRow = IMPORT_COLUMNS.flatMap((band) => band.rows).find((row) => row[0] === 'payload');
  if (!payloadRow) throw new Error('slide 14: the one table must gloss its payload column');
  const gloss = payloadRow[1].replace(/ — $/, '');
  const routing = ROUTING_RULES.find(([p, r]) => p === provider && r === resource);
  if (!routing || !routing[2]) throw new Error('slide 14: the feed must be labeled by kind in the rule book');
  const kind = routing[2];
  if (SALE_RULE[0] !== `${provider} ${resource}`) throw new Error('slide 14: the rule that wrote the line and the feed that carried it must be the same feed');
  // hop 7 — THE FINGERPRINT
  if (fingerprint === '—') throw new Error('slide 14: the arrival must carry its fingerprint');
  if (!(asked <= arrived && arrived <= read)) throw new Error('slide 14: the fingerprint must be made on arrival — asked ≤ arrived ≤ read');
  const records: ReadonlyArray<readonly Seg[]> = [
    [[amount, true], [` on "${question}"`, false]],
    [[`${ledDate} · ${ledDebit ? 'debit' : 'credit'} `, false], [`${ledLine} ${ledDebit || ledCredit}`, true]],
    [[`${SALE_RULE[0]} → debit `, false], [SALE_RULE[1], true], [', credit ', false], [SALE_RULE[2], true]],
    [[`${MATCHES.Invoicing} ↔ ${TOOL_DOCUMENTS.Invoicing[0]} · on ${S9_KEY}`, false]],
    [[`${TOOL_DOCUMENTS.Invoicing[0]} · ${S8_LIFE} · ${TOOL_DOCUMENTS.Invoicing[1]} · ${S8_WHO}`, false]],
    [[`${provider} ${resource} `, false], [theirId, true], [` · arrived ${arrived} · ${gloss} · ${kind}`, false]],
    [[fingerprint, true], [` · made from the payload at ${arrived}`, false]],
  ];
  const rCols = Math.floor((S14_GEOM.R_W - 26) / 4.2);
  const cCols = Math.floor((S14_GEOM.W - S14_GEOM.G_W - S14_GEOM.R_W - 16) / 4.2);
  const wrapCount = (text: string, cols: number) => {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > cols && line) { lines.push(line); line = word; } else { line = next; }
    }
    if (line) lines.push(line);
    return lines.length;
  };
  const hops = S14_WALK.map(([tag, layer], i) => {
    const record = records[i];
    const check = S14_CHECKS[i];
    if (wrapCount(record.map(([t]) => t).join(''), rCols) > 3) throw new Error(`slide 14: a record overflows its column — hop ${layer}`);
    if (wrapCount(check, cCols) > 3) throw new Error(`slide 14: a check overflows its column — hop ${layer}`);
    return { tag, layer, record, check, y: S14_GEOM.HEAD + i * S14_GEOM.ROW_H + S14_GEOM.NODE_TOP };
  });
  if (hops.length !== 7 || new Set(hops.map((h) => h.y)).size !== 7) throw new Error('slide 14: seven nodes on one lane, distinct pitch');
  return { hops, amount, question, arrival: { theirId, arrived, fingerprint }, h: S14_GEOM.HEAD + S14_WALK.length * S14_GEOM.ROW_H } as const;
})();
const S14_H = S14_LAYOUT.h;

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
  table: 'w-full table-fixed border-separate border-spacing-0 border border-border bg-white',
  th: 'bg-bg-row px-[11px] py-[9px] lg:px-5 lg:py-3 text-left align-top font-mono text-[10px] lg:text-[11px] font-normal uppercase tracking-[0.18em] text-text-faint border-b border-b-border',
  pad: 'px-[11px] py-[9px] lg:px-5 lg:py-[11px]',
  rule: 'border-b-[0.75px] border-b-text-faint',
  statement: 'text-[12px] lg:text-[14px] text-text-secondary',
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

// PR-S1-VIZ: PROBLEM_FAN_LG, PROBLEM_LABEL_TOP_LG, PROBLEM_LABEL_TOP_SM
// retired with the fan — see the S1-VIZ render comment. History holds them.

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
                  provisioning every API (LiteAPI / Plaid / Stripe /
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
        {/* PR-MOVES-2: the essay's machine-step law, verbatim, gloss tier. */}
        <p className={`mt-[14px] ${DECK.statement}`}>Each number is a machine step — a stage the data passes through. Inside a step there can be moves, lettered (a), (b), (c): the things a person does. We walk them one by one.</p>
      </section>

      {/* ── PROBLEM-01 / THE FOUR MOVES DRAWN (PR-S1-VIZ). This is where the TEACHING
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
            the NUMBERED teaching acts, gold now enters at 01 — the (b)/(c)/(d)
            letter tags and the moves block's letters, ruled by the CD-S1
            mockup. Check the other files before writing a page-wide colour
            claim.

            THE FAN IS RETIRED (PR-S1-VIZ) and with it BY HAND, the six-label
            rail and both convergence drawings. What remains follows the house
            SVG idiom (stroke/fill = "currentColor", colour via a Tailwind
            text-* token on a wrapping <g>; NO hex): the desktop overlay draws
            only the five move-(d) arcs in one brand-purple subtree, and the
            MOBILE SVG draws only the two stacked family grids with the same
            four-group colour split as before (bg-row bands first, faint rules
            + headers, purple tool names, muted outer borders). The desktop
            sheet stays a real HTML <table> — selectable, findable,
            translatable — and the SVG-<text> exception survives on MOBILE
            only, where the grids are still drawn. */}
      <section id="deck-01" aria-label="The problem" className={openSteps[0] ? 'max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px]' : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[0]}
          aria-controls="deck-01-body"
          onClick={() => toggleStep(0)}
          className={DECK.stepButton}
        >
          <span className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">01 / IDENTIFY THE PROBLEM, THE TOOLS, THE FAMILIES — AND SORT THEM IN</span>
          <span aria-hidden="true" className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">{openSteps[0] ? '−' : '+'}</span>
        </button>
        <div id="deck-01-body" className={openSteps[0] ? undefined : 'hidden'}>
          <h2 className="mt-[18px] text-[27px] lg:text-[38px] font-medium tracking-[-0.025em] text-brand-purple">
            Twenty-five tools.<br />None of them knows what the others did.
          </h2>
          <p className="mt-4 max-w-[680px] text-[15px] leading-[1.6] text-text-secondary">
            Your life is one system. Your software isn&apos;t.
          </p>
          {/* PR-MOVES → PR-MOVES-2: the essay's four-moves block, verbatim. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is four moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> The problem gets named.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> The tools to solve it get listed.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> The families to sort the tools into get created.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(d)</span> Each tool gets moved from the list into the table, under its family.</p>

          {/* ── S1-VIZ (PR-S1-VIZ, per the approved CD-S1 mockup 1a): the four
              moves DRAWN. The fan is retired — the visual is move (b) as a
              bordered card (the raw twenty-five, S1_TOOL_LIST, routing-card
              grammar: DECK.th header band, faint numbers, purple mono names),
              move (c) as the family sheet (full family names in the header
              band, cqw type untouched — the sheet column is still its own
              container-query context, so the table scales with its new 66%
              exactly as it did with the old 52%), and move (d) as dotted
              arcs from the list's right edge to five distinct family
              columns' tops. Letter tags in faint mono mark (b), (c) and (d)
              on the drawing; (a) has no tag — the headline carries it.
              ARC GEOMETRY (PR-S1-ARROWS, the corridor law): the overlay is
              the CORRIDOR ONLY — viewBox 0 0 1216 S1_CORRIDOR_PX, rendered
              at inset-x-0 top-0 with height S1_CORRIDOR_PX, and the sheet
              column carries paddingTop S1_CORRIDOR_PX from the SAME const,
              so the drawing surface ends exactly where the family header
              band begins: corridor-bottom == header-top by construction and
              no path can cross the table body or the caption. All five
              paths originate in one small zone at the list card's top-right
              corner (sx=366 ≈ 30% of 1216; sy 26..42), rise to the y=8
              cruise, run right (cubic: C c1x 8, c2x 8, tx 36 — controls
              clamped to the midpoint so the nearest column's controls never
              cross), then a
              straight vertical drop L tx S1_CORRIDOR_PX to terminate at the
              target column's center on the band's top edge — tx = 413 +
              col*133.8 + 66.9 (sheet at 34%, six equal columns of 66%).
              Heads are one shared SVG <marker> (id s1-arrow, 7px solid
              triangle, orient auto on a vertical final segment = pointing
              straight down, tip exactly on the band edge). ~1px stroke,
              2-4 dash, no glow, no gradient. The stroke is brand-purple —
              the mockup's aubergine IS the token; no raw hex.
              MOBILE stacks list → family grids → the merged paragraph and
              drops the overlay; stacking classes:
              container `relative mt-6 lg:mt-8 lg:flex lg:items-start`, list
              `w-full lg:w-[30%]`, gap `hidden lg:block lg:w-[4%]`, sheet
              column `hidden lg:block lg:w-[66%]`, mobile grids `mt-6
              lg:hidden`. PR-S1-PROSE: the (c)/(d) drawing tags died — the
              moves block is the only home for the four letters; (b) stays
              on the list card. ───────────────────────────────────────── */}
          <div className="relative mt-6 lg:mt-8 lg:flex lg:items-start">
            <svg viewBox={`0 0 1216 ${S1_CORRIDOR_PX}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 hidden w-full text-brand-purple lg:block" style={{ height: S1_CORRIDOR_PX }}>
              <defs>
                <marker id="s1-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {S1_FLOWS.map(({ sy, col }) => {
                const sx = 366;
                const tx = Math.round(413 + col * 133.8 + 66.9);
                const mid = Math.round((sx + tx) / 2);
                const c1x = Math.min(sx + 80, mid);
                const c2x = Math.max(tx - 100, mid);
                const d = `M${sx} ${sy} C ${c1x} 8, ${c2x} 8, ${tx} 36 L ${tx} ${S1_CORRIDOR_PX}`;
                return (
                  <path key={col} d={d} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s1-arrow)" />
                );
              })}
            </svg>

            {/* MOVE (b) — the raw list. */}
            <div className="w-full lg:w-[30%]">
              <p className="font-mono text-[10px] font-semibold text-text-faint" aria-hidden="true">(b)</p>
              <div className="mt-1.5 border border-border bg-white">
                <p className={DECK.th}>TOOLS</p>
                <div className="px-[11px] py-[7px] lg:px-4 lg:py-2">
                  {S1_TOOL_LIST.map((tool, i) => (
                    <p key={tool} className="flex items-baseline gap-2 py-[2px] font-mono text-[10.5px] leading-[1.35]">
                      <span className="text-text-faint">{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-brand-purple">{tool}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden lg:block lg:w-[4%]" aria-hidden="true" />

            {/* MOVES (c)/(d) — the family sheet, desktop. */}
            <div className="relative hidden lg:block lg:w-[66%] [container-type:inline-size]" style={{ paddingTop: S1_CORRIDOR_PX }}>
              <table className="w-full table-fixed border-separate border-spacing-0 border border-border bg-white">
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
            </div>
          </div>

          {/* MOBILE SHEET — the two stacked grids, fan-free (PR-S1-VIZ): same
              header band, rules and type as before, in a 280x330 viewBox whose
              tops live in PROBLEM_SHEET_SM. */}
          <div className="mt-6 lg:hidden">
            <svg role="img" viewBox="0 0 280 330" className="h-[330px] w-[280px]">
              <title>The twenty-five tools sorted into six families</title>
              <g className="text-bg-row" fill="currentColor" stroke="none">
                {PROBLEM_SHEET_SM.map(({ top }) => (
                  <rect key={top} x={20} y={top} width={240} height={30} />
                ))}
              </g>
              <g className="text-text-faint" stroke="currentColor" fill="none">
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
          </div>
          {/* PR-S1-PROSE: the essay's merged problem paragraph, verbatim —
              one body-tier <p> below the visual row on both breakpoints;
              the old problem pair and the spreadsheet caption render
              nowhere else. */}
          <p className="mt-8 max-w-[680px] text-[15px] leading-[1.6] text-text-secondary">The problem is none of these tools knows what the others did. They don&apos;t talk to each other. So today, to see your full picture, you copy numbers out of each one into a spreadsheet and connect them by hand; and that spreadsheet is only as current as the last time you typed into it.</p>
          <p className="mt-6 text-[17px] lg:text-[20px] text-brand-purple">So who sends you all that data?</p>
          <div className="mt-4 h-[30px] lg:h-10 w-px bg-border" aria-hidden="true" />
        </div>
      </section>

      {/* ── PROVIDERS-02 / THE WALK (PR-STEP-2 → PR-STEP2-VIZ →
            PR-ARTICULATION → PR-S2: bar reads LOOK AT THE TOOLS AND PICK
            THE PROVIDERS BEHIND THEM). Step 2 in full: the essay's four
            moves under the sub, then the WALK DRAWN — the essay's (1)-(9)
            answers render nowhere as text (SHOW DON'T ECHO, Deck Law #7):
            Step 1's sheet condensed on the left (no arrows leave it; the
            nine movers outlined), the pull-out column between — THE NINE
            THAT MOVE — and the provider menu REORDERED to land the walk
            on the right; sixteen short dotted arcs pull-out → menu with
            ZERO crossings, sixteen stay-homes tinted bg-bg-row — the
            born-here treatment — and 'our AI' unserved by design. The menu renders ONCE PER BREAKPOINT: the walk's right
            panel on desktop, the full-width DECK.table with its framing
            line on mobile (multi-name cells wrap at their spaces there).
            Geometry is the S2_GEOM corridor law (see the consts).
            PR-S2-PROSE: the slide ends in ONE BREATH — around the
            drawing, essay verbatim: the sub, the merged Step 2 paragraph
            (slide-01 body tier), the closer. The key is pure chrome
            (TINTED = STAY HOME, no trailing sentence), and the SnapTrade
            footnote sits under the menu at BOTH breakpoints — the ONLY
            place Robinhood may ever appear. TODAY and open NEXT doors
            purple; jobs read purple since PR-PALETTE (data cells are the
            dark tier) and '—' cells stay faint (empty markers are chrome).
            Nothing in the DRAWING is money or a kind word, and the moves
            letter tags read faint since PR-PALETTE — gold marks the kind
            and only the kind; rust never enters
            — there is no band label and no live status. */}
      <section id="deck-02" aria-label="The providers" className={openSteps[1] ? 'max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px] border-t border-border' : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[1]}
          aria-controls="deck-02-body"
          onClick={() => toggleStep(1)}
          className={DECK.stepButton}
        >
          <span className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">02 / LOOK AT THE TOOLS AND PICK THE PROVIDERS BEHIND THEM</span>
          <span aria-hidden="true" className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">{openSteps[1] ? '−' : '+'}</span>
        </button>
        <div id="deck-02-body" className={openSteps[1] ? undefined : 'hidden'}>
          <h2 className="mt-[26px] text-[27px] leading-[1.2] lg:text-[38px] tracking-[-0.025em] text-brand-purple">
            Every job has more than one company.<br />You pick yours.
          </h2>
          <p className="mt-[22px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">
            A tool is a job. A provider is a company you hire to feed that job.
          </p>
          {/* PR-S2: the essay's Step 2 moves block, verbatim — slide-01
              grammar, letters in the faint mono tier (the moves block is
              the only home for letters; no letters enter the drawing). */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is four moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> Start from the table Step 1 built.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Go tool by tool and ask one question: does this tool&apos;s data arrive from outside — someone else telling you what happened?</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> If yes, pick the company that sends it. That company is a provider.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(d)</span> If no, the tool stays home: the system will be that tool, and its data gets born here.</p>

          {/* THE WALK, desktop (PR-S2-LINES) — four absolute layers in one
              relative row of height S2_GEOM.H: Step 1's sheet condensed
              (left; stay-homes tinted, the nine movers OUTLINED — no
              arrows leave it), the pull-out column (middle — THE NINE
              THAT MOVE, the slide-01 list-between-two-tables idiom), the
              provider menu reordered to land the walk (right), and the
              overlay: sixteen short arcs pull-out → menu, ZERO crossings;
              'our AI' takes NO arrow. */}
          <div className="relative mt-10 hidden lg:mt-8 lg:block" style={{ height: S2_GEOM.H, maxWidth: S2_GEOM.W }}>
            <div className="absolute left-0 top-0" style={{ width: `${(S2_GEOM.TABLE_W / S2_GEOM.W) * 100}%` }}>
              <table className="w-full table-fixed border-separate border-spacing-0 border border-border bg-white">
                <thead>
                  <tr>
                    {PROBLEM_SHEET.map((col, c) => (
                      <th key={col.header} scope="col" style={{ height: S2_GEOM.HEAD_H }} className={`overflow-hidden whitespace-nowrap bg-bg-row px-[6px] text-left align-middle font-mono text-[6.5px] font-semibold uppercase tracking-[0.12em] text-text-faint border-b border-b-border ${c < 5 ? 'border-r-[0.75px] border-r-text-faint' : ''}`}>{col.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4, 5].map((r) => (
                    <tr key={r}>
                      {PROBLEM_SHEET.map((col, c) => {
                        const tool = col.tools[r];
                        return (
                          <td key={col.header} style={{ height: S2_GEOM.ROW_H }} className={`overflow-hidden whitespace-nowrap px-[6px] align-middle font-mono text-[8.5px] text-brand-purple ${tool && !S2_MOVERS.has(tool) ? 'bg-bg-row ' : ''}${tool && S2_MOVERS.has(tool) ? 'ring-1 ring-inset ring-brand-purple ' : ''}${r < 5 ? 'border-b-[0.75px] border-b-text-faint ' : ''}${c < 5 ? 'border-r-[0.75px] border-r-text-faint' : ''}`}>{tool ?? '\u00A0'}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S2_GEOM.COL_X / S2_GEOM.W) * 100}%`, width: `${(S2_GEOM.COL_W / S2_GEOM.W) * 100}%` }}>
              <p style={{ height: S2_GEOM.HEAD_H }} className="flex items-center overflow-hidden whitespace-nowrap bg-bg-row px-[6px] font-mono text-[7px] font-normal uppercase tracking-[0.14em] text-text-faint border-b border-b-border">THE NINE THAT MOVE</p>
              {S2_PORTS.map((tool, i) => (
                <p key={tool} style={{ height: S2_GEOM.ROW_H }} className={`flex items-center overflow-hidden whitespace-nowrap px-[6px] font-mono text-[8.5px] text-brand-purple ${i < S2_PORTS.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{tool}</p>
              ))}
            </div>
            <div className="absolute top-0" style={{ left: `${(S2_GEOM.MENU_X / S2_GEOM.W) * 100}%`, width: `${(S2_GEOM.MENU_W / S2_GEOM.W) * 100}%` }}>
              <table className="w-full table-fixed border-separate border-spacing-0 border border-border bg-white">
                <colgroup>
                  <col style={{ width: 118 }} />
                  <col style={{ width: 172 }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    {(['THE JOB', 'TODAY', 'NEXT'] as const).map((head) => (
                      <th key={head} scope="col" style={{ height: S2_GEOM.HEAD_H }} className="overflow-hidden whitespace-nowrap bg-bg-row px-[6px] text-left align-middle font-mono text-[7px] font-normal uppercase tracking-[0.14em] text-text-faint border-b border-b-border">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PROVIDER_MENU.map(([job, today, next], r) => {
                    const rule = r === PROVIDER_MENU.length - 1 ? '' : 'border-b-[0.75px] border-b-text-faint ';
                    return (
                      <tr key={job}>
                        <td style={{ height: S2_GEOM.ROW_H }} className={`${rule}overflow-hidden px-[6px] align-middle font-mono text-[8px] leading-[1.2] text-brand-purple`}>{job}</td>
                        <td style={{ height: S2_GEOM.ROW_H }} className={`${rule}overflow-hidden px-[6px] align-middle font-mono text-[8px] leading-[1.2] text-brand-purple`}>{today}</td>
                        <td style={{ height: S2_GEOM.ROW_H }} className={`${rule}overflow-hidden px-[6px] align-middle font-mono text-[8px] leading-[1.2] ${next === '—' ? 'text-text-faint' : 'text-brand-purple'}`}>{next}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* The menu's footnote — the essay's SnapTrade clause,
                  verbatim; the gloss tier at the panel's compact size. */}
              <p className="mt-1 text-[12px] leading-[1.5] text-text-faint">one connector called SnapTrade reaches Robinhood, Webull, and Public too.</p>
            </div>
            <svg viewBox={`0 0 ${S2_GEOM.W} ${S2_GEOM.H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-brand-purple">
              <defs>
                <marker id="s2-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {S2_FATES.map(([tool, job]) => {
                const py = s2PortY(tool);
                const ly = s2MenuY(job) + (S2_CONVERGE[job]?.[tool] ?? 0);
                const mx = (s2PortX + S2_GEOM.MENU_X) / 2;
                const d = `M${s2PortX} ${py} C ${mx} ${py}, ${mx} ${ly}, ${S2_GEOM.MENU_X} ${ly}`;
                return <path key={`${tool}-${job}`} d={d} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s2-arrow)" />;
              })}
            </svg>
          </div>

          {/* THE KEY — pure chrome beside the drawing; the one-breath
              paragraph below carries the words now. Renders once, both
              breakpoints: under the row on desktop, above the stack on
              mobile. */}
          <p className="mt-[22px] lg:mt-6 text-[12px] lg:text-[14px] text-text-faint">
            <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 border border-border bg-bg-row align-[-1px]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]">TINTED = STAY HOME</span>
          </p>

          {/* THE WALK, mobile — stacked: the sheet as two three-family
              grids (PROBLEM_SHEET_SM's split) with per-tool fate marks —
              stay-homes tinted, movers marked → — then the nine fate
              lines (derived from S2_FATES; sheet order == the essay's walk
              order), then the menu. Arrows collapse to marks; fates never
              disappear. */}
          <div className="mt-10 lg:hidden">
            {PROBLEM_SHEET_SM.map(({ top, cols }) => {
              const rows = Math.max(...cols.map((col) => col.tools.length));
              return (
                <div key={top} className={`grid grid-cols-3 border border-border bg-white ${top === 0 ? '' : 'mt-2.5'}`}>
                  {cols.map((col, ci) => (
                    <div key={col.header} className={ci < cols.length - 1 ? 'border-r-[0.75px] border-r-text-faint' : ''}>
                      <p className="overflow-hidden whitespace-nowrap border-b border-b-border bg-bg-row px-[6px] py-[5px] font-mono text-[8px] uppercase tracking-[0.08em] text-text-faint">{col.header}</p>
                      {Array.from({ length: rows }, (_, r) => {
                        const tool = col.tools[r];
                        return (
                          <p key={r} className={`flex items-center justify-between px-[6px] py-[3px] font-mono text-[10.5px] leading-[1.35] text-brand-purple ${tool && !S2_MOVERS.has(tool) ? 'bg-bg-row ' : ''}${r < rows - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                            <span className="overflow-hidden whitespace-nowrap">{tool ?? '\u00A0'}</span>
                            {tool && S2_MOVERS.has(tool) ? <span aria-hidden="true">→</span> : null}
                          </p>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="mt-4">
              {PROBLEM_SHEET.flatMap((col) => col.tools.filter((tool) => S2_MOVERS.has(tool))).map((tool) => (
                <p key={tool} className="py-[2px] font-mono text-[10.5px] leading-[1.35] text-brand-purple">
                  {tool} <span aria-hidden="true" className="text-text-faint">→</span> {S2_FATES.filter(([t]) => t === tool).map(([, job]) => job).join(' · ')}
                </p>
              ))}
            </div>
            {/* THE MENU — the framing line in the label-above-table idiom
                the import act's arrivals strip uses, then the full menu.
                On desktop the menu renders as the walk's right panel
                instead — once per breakpoint, never twice; the SnapTrade
                footnote sits beneath the menu on BOTH breakpoints. */}
            <p className={`mt-10 ${DECK.statement}`}>Here is who we speak to today:</p>
            <table className={`mt-[14px] ${DECK.table}`}>
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
                      <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-purple`}>{job}</td>
                      <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] text-brand-purple`}>{today}</td>
                      <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] lg:text-[13px] ${next === '—' ? 'text-text-faint' : 'text-brand-purple'}`}>{next}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* The menu's footnote — the essay's SnapTrade clause,
                verbatim, gloss tier. */}
            <p className="mt-[14px] text-[12px] lg:text-[14px] text-text-faint">one connector called SnapTrade reaches Robinhood, Webull, and Public too.</p>
          </div>

          {/* PR-S2-PROSE: slide 02 ends in ONE BREATH — the essay's
              merged Step 2 paragraph, verbatim, in the slide-01 body tier.
              The count line, the AI parenthetical, the born-here
              paragraph, the pick-yours statement and the more-join line
              render nowhere else as standalones; the SnapTrade footnote
              moved under the menu at both breakpoints. */}
          <p className="mt-8 max-w-[680px] text-[15px] leading-[1.6] text-text-secondary">Nine tools take providers. Sixteen stay home. Count them; it is twenty-five. For the sixteen, nobody sends an API — not for your tasks, your invoices, your budget. So this system does not import those tools; it IS those tools, and their data gets born here. Our AI belongs to no tool; it serves every step. For the nine, you pick yours and your neighbor picks theirs. The system does not care; a provider is just rows in a table, so a new one is added, never built. More join over time. Each one is one new row!</p>
          <p className="mt-[22px] lg:mt-9 text-[17px] lg:text-[28px] text-brand-purple">So how do we actually get their data?</p>
        </div>
      </section>

      {/* ── IMPORT-03 / THE RAW IMPORT TABLE (PR-DECK reconcile). Act grammar
            unchanged: same container, same act padding, border-t closing the
            problem|import seam (see the seam ledger above).

            RUST REPLACES GOLD ON THE LABELS. The deck's token law — gold inks
            dollar amounts, debit/credit values and kind words ONLY — moved the
            arrivals caption to the deck's rust (brand-amber; the mapping is
            recorded in the file header). PR-S3-COHESION: the field card's
            group labels left rust for the sand band (the DECK.th header-band
            idiom) — rust in this act is the caption, the payload gloss tail,
            PENDING and FAILED. Gold still enters the numbered run at this act's
            arrivals? No — nothing here is money, so gold now first inks at
            04's KIND column.

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
          <span className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">03 / IMPORT THE DATA AND SEE HOW IT ARRIVES</span>
          <span aria-hidden="true" className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">{openSteps[2] ? '−' : '+'}</span>
        </button>
        <div id="deck-03-body" className={openSteps[2] ? undefined : 'hidden'}>
          <h2 className="mt-[26px] text-[27px] leading-[1.2] lg:text-[38px] tracking-[-0.025em] text-brand-purple">
            Store what arrived.<br />Then decide what it means.
          </h2>
          <p className="mt-[22px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">
            Now we ask the providers we picked for their data.
          </p>
          {/* PR-S3: the essay's Step 3 moves block, verbatim — slide-01
              grammar, letters in the faint mono tier. The two old arrival
              intro lines died into moves (c)/(d) — zero renders. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is four moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> Start from the menu Step 2 built — the providers in the TODAY column.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Ask each provider for its data.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> The answer comes back, and it gets stored as one row, word for word, before anyone decides what it means. That row is an arrival.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(d)</span> Each row gets stamped: who sent it, what it is, its fingerprint, when we asked, when it arrived, when we read it, and how far it got.</p>

          {/* PR-S3-ONE-TABLE: the bridge — the essay's read-across line,
              verbatim, statement tier, above the table. Desktop-only:
              the phone cannot name every part at the top, so its
              counterpart is the declared line in the mobile stack. */}
          <p className={`mt-10 hidden lg:mt-8 lg:block ${DECK.statement}`}>Every part of a row is named at the top of the table, and nineteen rows are shown. Read across plaid&apos;s row — from your Chase connection — and you have read one whole arrival.</p>

          {/* THE ASK, desktop caption — the arrivals caption in the act's
              rust chrome, aligned over the table panel (marginLeft from
              S3_GEOM — exact at full width, drifting only where the row
              shrinks below S3_GEOM.W). */}
          <p className="mt-5 hidden font-mono text-[11px] uppercase tracking-[0.20em] text-brand-amber lg:block" style={{ marginLeft: S3_GEOM.TABLE_X }}>ONE ARRIVAL PER PROVIDER — AN EXAMPLE</p>

          {/* THE ONE TABLE, desktop (PR-S3-ONE-TABLE) — the two tables
              became one: the providers list (top offset S3_LIST_TOP —
              the level-arrow law) feeds nineteen dotted arcs into a
              table whose THREE-TIER header IS the legend: tier 1 the
              four group bands spanning 2/3/2/4 columns (172/294/158px +
              the rest — the column sums), tier 2 the eleven part names
              (purple mono), tier 3 each column's gloss (faint, wrapped;
              the payload tail rust) — all read from IMPORT_COLUMNS, one
              source. Nineteen 11-field rows beneath; plaid · chase
              ringed (the essay's read-across row); PENDING and FAILED
              ink rust. 18 of 19 arrows run dead level; plaid→chase
              rises one pitch; zero crossings. */}
          <div className="relative mt-[14px] hidden lg:mt-3 lg:block" style={{ height: S3_H, maxWidth: S3_GEOM.W }}>
            <div className="absolute left-0 border border-border bg-white" style={{ top: S3_LIST_TOP, width: `${(S3_GEOM.LIST_W / S3_GEOM.W) * 100}%` }}>
              <p className="flex h-[26px] items-center overflow-hidden whitespace-nowrap bg-bg-row px-[6px] font-mono text-[7px] font-normal uppercase tracking-[0.14em] text-text-faint border-b border-b-border">THE PROVIDERS WE PICKED</p>
              {S3_PROVIDERS.map((p, i) => (
                <p key={p} style={{ height: S3_GEOM.ROW_H }} className={`flex items-center overflow-hidden whitespace-nowrap px-[6px] font-mono text-[8.5px] text-brand-purple ${i < S3_PROVIDERS.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{p}</p>
              ))}
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S3_GEOM.TABLE_X / S3_GEOM.W) * 100}%`, width: `${(S3_TABLE_W / S3_GEOM.W) * 100}%` }}>
              <div style={{ height: S3_GEOM.T1 }} className="grid grid-cols-[172px_294px_158px_1fr] items-center overflow-hidden bg-bg-row font-mono text-[6.5px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">
                {IMPORT_COLUMNS.map((group, b) => (
                  <span key={group.band} className={`overflow-hidden whitespace-nowrap px-[8px] ${b < IMPORT_COLUMNS.length - 1 ? 'border-r-[0.75px] border-r-text-faint' : ''}`}>{group.band}</span>
                ))}
              </div>
              <div style={{ height: S3_GEOM.T2 }} className="grid grid-cols-[92px_80px_88px_130px_76px_64px_94px_76px_76px_76px_1fr] items-center overflow-hidden border-b-[0.75px] border-b-text-faint font-mono text-[7px] text-brand-purple">
                {IMPORT_COLUMNS.flatMap((group) => group.rows).map(([name]) => (
                  <span key={name} className="overflow-hidden whitespace-nowrap px-[6px]">{name}</span>
                ))}
              </div>
              <div style={{ height: S3_GEOM.T3 }} className="grid grid-cols-[92px_80px_88px_130px_76px_64px_94px_76px_76px_76px_1fr] overflow-hidden border-b border-b-border text-[6px] leading-[1.35] text-text-faint">
                {IMPORT_COLUMNS.flatMap((group) => group.rows).map(([name, desc, emphasis]) => (
                  <span key={name} className="overflow-hidden px-[6px] py-[3px]">
                    {desc}
                    {emphasis !== undefined && <span className="font-mono text-brand-amber">{emphasis}</span>}
                  </span>
                ))}
              </div>
              {IMPORT_ARRIVALS.map((row, j) => (
                <div key={row[4]} style={{ height: S3_GEOM.ROW_H }} className={`grid grid-cols-[92px_80px_88px_130px_76px_64px_94px_76px_76px_76px_1fr] items-center font-mono text-[7px] ${row[0] === 'plaid' && row[1] === 'chase' ? 'ring-1 ring-inset ring-brand-purple ' : ''}${j < IMPORT_ARRIVALS.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  {row.map((cell, c) => (
                    <span key={c} className={`overflow-hidden whitespace-nowrap px-[6px] ${c === 0 ? 'text-brand-purple' : c === 10 && (cell === 'PENDING' || cell === 'FAILED') ? 'text-brand-amber' : 'text-brand-purple'}`}>{cell}</span>
                  ))}
                </div>
              ))}
            </div>
            <svg viewBox={`0 0 ${S3_GEOM.W} ${S3_H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-brand-purple">
              <defs>
                <marker id="s3-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {IMPORT_ARRIVALS.map((row, j) => {
                const sy = s3ListCenter(S3_PROVIDERS.indexOf(row[0]));
                const ty = s3RowCenter(j);
                const mx = (S3_GEOM.LIST_W + S3_GEOM.TABLE_X) / 2;
                const d = `M${S3_GEOM.LIST_W} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${S3_GEOM.TABLE_X} ${ty}`;
                return <path key={row[4]} d={d} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s3-arrow)" />;
              })}
            </svg>
          </div>

          {/* THE ASK, mobile (PR-S3-ONE-TABLE) — the providers we picked,
              the caption, then the compact FOUR-column table (provider ·
              connection · resource · status; plaid · chase ringed,
              cell-level, the slide-02 idiom; PENDING and FAILED rust),
              the declared line, and the card — the old legend's form,
              part · gloss · plaid · chase's value, the phone's only
              legend. Arrows collapse to order. */}
          <div className="mt-[14px] lg:hidden">
            <div className="w-[200px] border border-border bg-white">
              <p className="flex h-[26px] items-center overflow-hidden whitespace-nowrap bg-bg-row px-[6px] font-mono text-[7px] font-normal uppercase tracking-[0.14em] text-text-faint border-b border-b-border">THE PROVIDERS WE PICKED</p>
              {S3_PROVIDERS.map((p, i) => (
                <p key={p} className={`flex h-[20px] items-center overflow-hidden whitespace-nowrap px-[6px] font-mono text-[10px] text-brand-purple ${i < S3_PROVIDERS.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{p}</p>
              ))}
            </div>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.20em] text-brand-amber">ONE ARRIVAL PER PROVIDER — AN EXAMPLE</p>
            <table className="mt-[14px] w-full table-fixed border-separate border-spacing-0 border border-border bg-white">
              <thead>
                <tr>
                  {([
                    ['PROVIDER', 'w-[28%]'], ['CONNECTION', 'w-[20%]'], ['RESOURCE', 'w-[28%]'], ['STATUS', 'w-[24%]'],
                  ] as const).map(([head, w]) => (
                    <th key={head} scope="col" className={`${w} ${DECK.th}`}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {IMPORT_ARRIVALS.map((row, r) => {
                  const ring = row[0] === 'plaid' && row[1] === 'chase' ? 'ring-1 ring-inset ring-brand-purple ' : '';
                  const rule = r === IMPORT_ARRIVALS.length - 1 ? '' : 'border-b-[0.75px] border-b-text-faint';
                  return (
                    <tr key={row[4]}>
                      {([row[0], row[1], row[2], row[10]] as const).map((cell, c) => (
                        <td key={c} className={`${ring}px-[11px] py-[9px] align-top font-mono text-[11px] ${c === 0 ? 'text-brand-purple' : c === 3 && (cell === 'PENDING' || cell === 'FAILED') ? 'text-brand-amber' : 'text-brand-purple'} ${rule}`}>{cell}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* The declared line — the founder's ruled wording, quoted
                exactly; not an essay line. */}
            <p className={`mt-[14px] ${DECK.statement}`}>Four of the eleven fit on a phone — plaid&apos;s row is opened below.</p>
            {/* THE CARD, mobile-only (PR-S3-ONE-TABLE) — the old legend's
                form: part names and glosses from IMPORT_COLUMNS (one
                source) and plaid · chase's values (S3_OPEN_ROW ==
                IMPORT_ARRIVALS[0], never retyped; s3FieldIndex pairs the
                const's rows with the 11-tuple's slots). */}
            <table className={`mt-[14px] ${DECK.table}`}>
              <colgroup>
                <col className="w-[26%]" />
                <col />
                <col className="w-[30%]" />
              </colgroup>
              <thead>
                <tr>
                  <th colSpan={2} scope="col" className={DECK.th}>THE PARTS OF EACH ROW</th>
                  <th scope="col" className={DECK.th}>PLAID · CHASE&apos;S ROW</th>
                </tr>
              </thead>
              {IMPORT_COLUMNS.map((group, b) => (
                <tbody key={group.band}>
                  <tr>
                    <td colSpan={3} className={DECK.th}>{group.band}</td>
                  </tr>
                  {group.rows.map((row, r) => {
                    const [name = '', desc = '', emphasis] = row;
                    const isLast = b === IMPORT_COLUMNS.length - 1 && r === group.rows.length - 1;
                    const rule = isLast ? '' : DECK.rule;
                    return (
                      <tr key={name}>
                        <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] text-brand-purple`}>{name}</td>
                        <td className={`${DECK.pad} ${rule} align-top font-mono text-[11px] text-text-faint`}>
                          {desc}
                          {emphasis !== undefined && <span className="font-mono text-brand-amber">{emphasis}</span>}
                        </td>
                        <td className={`${DECK.pad} ${rule} break-words align-top font-mono text-[11px] text-brand-purple`}>{S3_OPEN_ROW[s3FieldIndex(b, r)]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
          {/* PR-S3-COHESION: the tail is ONE paragraph — the essay's merged
              census + handshake + three-promises passage, verbatim, in the
              slide-01 body tier. The standalone census and handshake
              lines, the old framing line and the retired trio render
              nowhere else. */}
          <p className="mt-8 max-w-[680px] text-[15px] leading-[1.6] text-text-secondary">And here is the real size of it: today that is 121 feeds from 20 providers — counted August 24, 2026. We will show you a small example, so the idea stays small enough to hold. One more honest line: a few things we fetch are not data at all — handshakes, like the token that opens a bank connection. Handshakes are not data; they are how we knock on the door. They never enter the tables. And this table makes three promises: (1) nothing was ever edited — if a provider corrects something, the correction is a new row; (2) nothing was ever asked twice — if our reading of a row fails, we just read our stored copy again; (3) nothing was ever claimed — the fingerprint proves we stored exactly what they sent, but that does not necessarily mean they were right!</p>
          <p className="mt-[22px] lg:mt-9 text-[17px] lg:text-[28px] text-brand-purple">Now — what kind of thing is each one?</p>
        </div>
      </section>

      {/* ── ROUTING-04 / THE FOLD AND THE RULE (PR-DECK → … → PR-S4). Act
            grammar unchanged: same container, act padding, border-t for the
            import|routing seam. Step 4 in full: the essay's four moves under
            the sub (the #1600 rhythm), the feed gloss, then the FOLD DRAWN —
            the arrivals' identity columns fold into THE FEEDS (plaid's two
            connections converge; the two ruled extras ride beneath the fold,
            marked) and each feed lands its rule row in THE RULE BOOK, twenty
            rows, KIND gold (the deck's one non-money gold licence), MEANS on
            first appearance only. Two rails, 19 + 20 arrows, zero crossings,
            geometry the S4_GEOM corridor law. Under the rule book, the
            essay's plaid footnote (gloss tier, both breakpoints); then ONE
            paragraph — the merged rule / boundary / sixth-kind passage,
            slide-01 body tier — and the closer. The old routing table, the
            who-decides passage, the derived-boundary line, the sixth tease
            and the two rule lines render nowhere else. */}
      <section id="deck-04" aria-label="The routing" className={openSteps[3] ? 'max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px] border-t border-border' : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[3]}
          aria-controls="deck-04-body"
          onClick={() => toggleStep(3)}
          className={DECK.stepButton}
        >
          <span className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">04 / LABEL EVERY FEED BY ITS KIND</span>
          <span aria-hidden="true" className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">{openSteps[3] ? '−' : '+'}</span>
        </button>
        <div id="deck-04-body" className={openSteps[3] ? undefined : 'hidden'}>
          <h2 className="mt-[26px] text-[27px] leading-[1.2] lg:text-[38px] tracking-[-0.025em] text-brand-purple">
            One rule per feed.<br />Written down.
          </h2>
          <p className="mt-[22px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">
            Now we examine the data that we just imported in Step 3, and we give every feed a label.
          </p>
          {/* PR-S4: the essay's Step 4 moves block, verbatim — slide-01
              grammar, faint letter tier, the #1600 rhythm. Who decides the
              kind lives in moves (c)/(d) now. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is four moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> Start from the arrivals table Step 3 built.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Fold the rows into feeds: one provider, one resource, one feed. Plaid&apos;s two connections are one feed.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> Ask of each feed one question: what IS this thing, really? The answer is one of six kinds.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(d)</span> Write the answer down as one rule row — the feed and its kind — and the system applies it to every arrival of that feed, forever after.</p>

          {/* PR-VOICE → PR-STEP-2: the essay's feed gloss. The
              Duffel/Anthropic caption left with PR-STEP-2 — Step 02 owns
              provider glosses now, so no provider is introduced here.
              PR-S4: it takes the moves→next-block gap of the #1600 scale. */}
          <p className={`mt-[14px] lg:mt-8 ${DECK.statement}`}>A feed is one provider-and-resource pair; like Stripe&apos;s payouts, or Plaid&apos;s transactions, or TastyTrade&apos;s quotes.</p>

          {/* THE FOLD AND THE RULE, desktop (PR-S4) — three panels, two
              rails. LEFT: the arrivals' identity columns (19 rows, from
              IMPORT_ARRIVALS slots 0/1/2 — one source). MIDDLE: THE FEEDS
              — S4_FEEDS, plaid's two connections converging into feed 0,
              the two ruled extras beneath the fold marked 'more from
              plaid'. RIGHT: the rule book — ROUTING_RULES, KIND gold (the
              deck's one non-money gold licence), MEANS on each kind's
              first appearance. Fold rail: 19 arrows — plaid's pair
              converges (S4_CONVERGE fans the heads) and every other arrow
              drops exactly one pitch (the offset the extras buy). Rule
              rail: 20 arrows, dead level row for row. Zero crossings on
              both rails — script-proved. */}
          <div className="relative mt-[14px] hidden lg:mt-3 lg:block" style={{ height: S4_H, maxWidth: S4_GEOM.W }}>
            <div className="absolute left-0 top-0 border border-border bg-white" style={{ width: `${(S4_GEOM.L_W / S4_GEOM.W) * 100}%` }}>
              <div style={{ height: S4_GEOM.HEAD }} className="grid grid-cols-[100px_74px_1fr] items-center overflow-hidden bg-bg-row font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">
                <span className="px-[6px]">PROVIDER</span><span className="px-[6px]">CONNECTION</span><span className="px-[6px]">RESOURCE</span>
              </div>
              {IMPORT_ARRIVALS.map((row, j) => (
                <div key={row[4]} style={{ height: S4_GEOM.ROW_H }} className={`grid grid-cols-[100px_74px_1fr] items-center font-mono text-[7px] ${j < IMPORT_ARRIVALS.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-purple">{row[0]}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-purple">{row[1]}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-purple">{row[2]}</span>
                </div>
              ))}
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S4_GEOM.F_X / S4_GEOM.W) * 100}%`, width: `${(S4_GEOM.F_W / S4_GEOM.W) * 100}%` }}>
              <p style={{ height: S4_GEOM.HEAD }} className="flex items-center overflow-hidden whitespace-nowrap bg-bg-row px-[6px] font-mono text-[7px] font-normal uppercase tracking-[0.14em] text-text-faint border-b border-b-border">THE FEEDS</p>
              {S4_FEEDS.map(([p, r], i) => (
                <div key={`${p}-${r}`} style={{ height: S4_GEOM.ROW_H }} className={`flex items-center justify-between overflow-hidden px-[6px] font-mono text-[7px] ${i < S4_FEEDS.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="overflow-hidden whitespace-nowrap text-brand-purple">{p} · {r}</span>
                  {(r === 'account' || r === 'holding') && <span className="whitespace-nowrap pl-1 text-text-faint">more from plaid</span>}
                </div>
              ))}
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S4_GEOM.R_X / S4_GEOM.W) * 100}%`, width: `${(S4_GEOM.R_W / S4_GEOM.W) * 100}%` }}>
              <div style={{ height: S4_GEOM.HEAD }} className="grid grid-cols-[96px_92px_72px_1fr] items-center overflow-hidden bg-bg-row font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">
                <span className="px-[6px]">PROVIDER</span><span className="px-[6px]">RESOURCE</span><span className="px-[6px]">KIND</span><span className="px-[6px]">MEANS</span>
              </div>
              {ROUTING_RULES.map(([p, r, kind, means], i) => (
                <div key={`${p}-${r}`} style={{ height: S4_GEOM.ROW_H }} className={`grid grid-cols-[96px_92px_72px_1fr] items-center font-mono text-[7px] ${i < ROUTING_RULES.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-purple">{p}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-purple">{r}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[6px] uppercase text-brand-gold">{kind}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-purple">{means}</span>
                </div>
              ))}
            </div>
            <svg viewBox={`0 0 ${S4_GEOM.W} ${S4_H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-brand-purple">
              <defs>
                <marker id="s4-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {IMPORT_ARRIVALS.map((row, j) => {
                const i = S4_FEEDS.findIndex(([p, r]) => p === row[0] && r === row[2]);
                const ty = s4RowCenter(i) + (i === 0 ? S4_CONVERGE[row[1]] ?? 0 : 0);
                const mx = (S4_GEOM.L_W + S4_GEOM.F_X) / 2;
                const d = `M${S4_GEOM.L_W} ${s4RowCenter(j)} C ${mx} ${s4RowCenter(j)}, ${mx} ${ty}, ${S4_GEOM.F_X} ${ty}`;
                return <path key={row[4]} d={d} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s4-arrow)" />;
              })}
              {S4_FEEDS.map(([p, r], i) => {
                const mx = (S4_GEOM.F_X + S4_GEOM.F_W + S4_GEOM.R_X) / 2;
                const d = `M${S4_GEOM.F_X + S4_GEOM.F_W} ${s4RowCenter(i)} C ${mx} ${s4RowCenter(i)}, ${mx} ${s4RowCenter(i)}, ${S4_GEOM.R_X} ${s4RowCenter(i)}`;
                return <path key={`${p}-${r}`} d={d} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s4-arrow)" />;
              })}
            </svg>
          </div>
          {/* PR-S4: the essay's plaid footnote, verbatim, gloss tier —
              seated under the rule book (marginLeft from S4_GEOM). */}
          <p className={`hidden lg:block mt-2 ${DECK.statement}`} style={{ marginLeft: S4_GEOM.R_X }}>Plaid alone sends more than one feed. So the rule book here shows two more of Plaid&apos;s — your accounts and your holdings — so you can see every kind a feed can earn.</p>

          {/* THE FOLD AND THE RULE, mobile (PR-S4) — stacked per the
              BuildSpec: the identity table, THE FEEDS card with the fold
              marked on plaid's row and the extras marked, the rule book
              condensed (MEANS wraps), then the footnote. Arrows collapse
              to order. */}
          <div className="mt-[14px] lg:hidden">
            <div className="border border-border bg-white">
              <div className="grid h-[22px] grid-cols-[96px_66px_1fr] items-center overflow-hidden bg-bg-row font-mono text-[6.5px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">
                <span className="px-[6px]">PROVIDER</span><span className="px-[6px]">CONNECTION</span><span className="px-[6px]">RESOURCE</span>
              </div>
              {IMPORT_ARRIVALS.map((row, j) => (
                <div key={row[4]} className={`grid grid-cols-[96px_66px_1fr] font-mono text-[10px] leading-[1.4] ${j < IMPORT_ARRIVALS.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="px-[6px] py-[3px] text-brand-purple">{row[0]}</span>
                  <span className="px-[6px] py-[3px] text-brand-purple">{row[1]}</span>
                  <span className="px-[6px] py-[3px] text-brand-purple">{row[2]}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border border-border bg-white">
              <p className="flex h-[22px] items-center overflow-hidden whitespace-nowrap bg-bg-row px-[6px] font-mono text-[6.5px] font-normal uppercase tracking-[0.14em] text-text-faint border-b border-b-border">THE FEEDS</p>
              {S4_FEEDS.map(([p, r], i) => (
                <p key={`${p}-${r}`} className={`px-[6px] py-[3px] font-mono text-[10px] leading-[1.4] text-brand-purple ${i < S4_FEEDS.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  {p} · {r}
                  {p === 'plaid' && r === 'transaction' && <span className="text-text-faint"> ← chase · boa — two connections, one feed</span>}
                  {(r === 'account' || r === 'holding') && <span className="text-text-faint"> — more from plaid</span>}
                </p>
              ))}
            </div>
            <div className="mt-4 border border-border bg-white">
              <div className="grid h-[22px] grid-cols-[82px_84px_62px_1fr] items-center overflow-hidden bg-bg-row font-mono text-[6.5px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">
                <span className="px-[6px]">PROVIDER</span><span className="px-[6px]">RESOURCE</span><span className="px-[6px]">KIND</span><span className="px-[6px]">MEANS</span>
              </div>
              {ROUTING_RULES.map(([p, r, kind, means], i) => (
                <div key={`${p}-${r}`} className={`grid grid-cols-[82px_84px_62px_1fr] font-mono text-[9.5px] leading-[1.4] ${i < ROUTING_RULES.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="px-[6px] py-[3px] text-brand-purple">{p}</span>
                  <span className="px-[6px] py-[3px] text-brand-purple">{r}</span>
                  <span className="px-[6px] py-[3px] uppercase text-brand-gold">{kind}</span>
                  <span className="break-words px-[6px] py-[3px] text-brand-purple">{means}</span>
                </div>
              ))}
            </div>
            {/* The plaid footnote, mobile seat — same essay string. */}
            <p className={`mt-[14px] ${DECK.statement}`}>Plaid alone sends more than one feed. So the rule book here shows two more of Plaid&apos;s — your accounts and your holdings — so you can see every kind a feed can earn.</p>
          </div>

          {/* PR-S4: the tail is ONE paragraph — the essay's merged rule /
              boundary / sixth-kind passage, verbatim, slide-01 body tier.
              The old standalones (the who-decides passage, the
              derived-boundary line, the sixth-kind tease, the two rule
              lines and their divider) render nowhere else — who-decides
              lives in moves (c)/(d) now. */}
          <p className="mt-8 max-w-[680px] text-[15px] leading-[1.6] text-text-secondary">Here is what makes this step different from every software you have ever met: each kind is given by a rule, and a rule is one written row in a table. Anyone can read it. Anyone can argue with it. It is not a guess buried in code. When a new provider shows up, we add rows; not code, and not new tables. And the line is who did the math: if we ordered it or ran it, it is derived; a provider&apos;s own published math is reference. And there is a sixth kind; but no feed ever earns it. We will meet it soon.</p>
          <p className="mt-[22px] lg:mt-9 text-[17px] lg:text-[28px] text-brand-purple">So how many tables are there?</p>
        </div>
      </section>

      {/* ── PR-S5 → PR-H6R / THE KIND PICKS THE TABLE — Step 5, the
            handoff re-cut IN PLACE (the founder's replace ruling: no new
            slide, no duplicate 06). Act grammar unchanged. Body: the Step
            5 moves block with MUTED labels — gold on this slide marks the
            kind and only the kind — then the drawing: the rule book
            SORTED by kind beside six kind-table boxes, five square
            block-brackets each sending ONE dotted muted connector to its
            box (posting gets none; its dashed card says why), the six
            boxes spanning the rule book's data rows flush top and bottom
            with equal gaps (the S5_LAYOUT even-span law, which THROWS at
            build if contiguity, the flush span, or crossing-freedom
            fails). The tail paragraph carries the
            founder's named-filler sentence. */}
      <section id="deck-05" aria-label="The handoff" className={openSteps[4] ? 'max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px] border-t border-border' : DECK.sectionBar}>
        <button
          type="button"
          aria-expanded={openSteps[4]}
          aria-controls="deck-05-body"
          onClick={() => toggleStep(4)}
          className={DECK.stepButton}
        >
          <span className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">05 / CREATE ONE TABLE PER KIND AND MAP THE DATA IN</span>
          <span aria-hidden="true" className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">{openSteps[4] ? '−' : '+'}</span>
        </button>
        <div id="deck-05-body" className={openSteps[4] ? undefined : 'hidden'}>
          <h2 className="mt-[26px] text-[27px] leading-[1.2] lg:text-[38px] tracking-[-0.025em] text-brand-purple">
            The kind picks the table.
          </h2>
          <p className="mt-[22px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">
            Now we take every labeled arrival and move it into a table; one table per kind.
          </p>

          {/* PR-S5: the essay's Step 5 moves block, verbatim — slide-01
              grammar, faint letter tier, the #1600 rhythm. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is four moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> Start from the rule book Step 4 built.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Create one table per kind: six tables, six names.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> Send every feed&apos;s arrivals to the table its kind names.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(d)</span> Look at what landed. The outside world fills four tables. Math we ordered fills derived. Posting stays empty.</p>

          {/* THE ADDRESS, desktop (PR-H6R) — the rule book SORTED by kind
              (S5_SORTED: the same twenty rows, stable within kind) beside
              the six kind-table boxes. The handoff layout, IN PLACE: five
              square block-brackets at the table's edge — one per
              contiguous kind-block — each sending ONE dotted muted
              connector to its box's left-center; posting gets none
              (nothing feeds it — its dashed card says so). The boxes span
              the table's data rows flush top and bottom with equal gaps
              (S5_LAYOUT); the build refuses if the span or the
              crossing-freedom fails. */}
          <p className="mt-8 hidden font-mono text-[11px] uppercase tracking-[0.20em] text-brand-amber lg:block">THE RULE BOOK — SORTED BY KIND</p>
          <div className="relative mt-[14px] hidden lg:mt-3 lg:block" style={{ height: S5_H, maxWidth: S5_GEOM.W }}>
            <div className="absolute left-0 top-0 border border-border bg-white" style={{ width: `${(S5_GEOM.RB_W / S5_GEOM.W) * 100}%` }}>
              <div style={{ height: S5_GEOM.HEAD }} className="grid grid-cols-[130px_150px_1fr] items-center overflow-hidden bg-bg-row font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">
                <span className="px-[6px]">PROVIDER</span><span className="px-[6px]">RESOURCE</span><span className="px-[6px]">KIND</span>
              </div>
              {S5_SORTED.map(([p, r, kind], j) => (
                <div key={`${p}-${r}`} style={{ height: S5_GEOM.ROW_H }} className={`grid grid-cols-[130px_150px_1fr] items-center font-mono text-[7px] ${j < S5_SORTED.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-purple">{p}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-purple">{r}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[6px] uppercase text-brand-gold">{kind}</span>
                </div>
              ))}
            </div>
            {S5_BOXES.map(([kind, holds, n], b) => (
              <div key={kind} className={`absolute bg-white ${kind === 'posting' ? 'border border-dashed border-text-faint' : 'border border-border'}`} style={{ left: `${(S5_GEOM.BX_L / S5_GEOM.W) * 100}%`, top: S5_LAYOUT.centers[b] - s5BoxH(kind) / 2, width: `${(S5_GEOM.BX_W / S5_GEOM.W) * 100}%`, height: s5BoxH(kind) }}>
                <div className="flex items-baseline justify-between px-[14px] pt-2">
                  <span className="font-mono text-[13px] text-brand-gold">{kind}</span>
                  <span className="font-mono text-[7px] tracking-[0.14em] text-text-faint"><span className="uppercase">{n} {n === 1 ? 'FEED' : 'FEEDS'}</span>{kind === 'posting' ? ' (later)' : ''}</span>
                </div>
                <p className="mt-1 px-[14px] text-[11px] leading-[1.4] text-text-faint">holds {holds}</p>
                {kind === 'posting' && <p className="mt-[5px] px-[14px] text-[11px] leading-[1.4] text-brand-purple">No provider feeds this. The bookkeeping step writes them here — from your events.</p>}
              </div>
            ))}
            <svg viewBox={`0 0 ${S5_GEOM.W} ${S5_H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-text-faint">
              <defs>
                <marker id="s5-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              <g className="text-border" stroke="currentColor" strokeWidth={1} fill="none">
                {S5_LAYOUT.blocks.map(([kind, r0, r1]) => {
                  const y0 = r0 === r1 ? s5RowY(r0) - 7 : s5RowY(r0);
                  const y1 = r0 === r1 ? s5RowY(r1) + 7 : s5RowY(r1);
                  const mid = (s5RowY(r0) + s5RowY(r1)) / 2;
                  return <path key={kind} d={`M${S5_GEOM.BRK - 6} ${y0} H${S5_GEOM.BRK} V${y1} H${S5_GEOM.BRK - 6} M${S5_GEOM.BRK} ${mid} H${S5_GEOM.BRK + 12}`} />;
                })}
              </g>
              {S5_LAYOUT.blocks.map(([kind, r0, r1], b) => {
                const mid = (s5RowY(r0) + s5RowY(r1)) / 2;
                const cmx = (S5_GEOM.BRK + 12 + S5_GEOM.BX_L) / 2;
                return <path key={kind} d={`M${S5_GEOM.BRK + 12} ${mid} C ${cmx} ${mid}, ${cmx} ${S5_LAYOUT.centers[b]}, ${S5_GEOM.BX_L} ${S5_LAYOUT.centers[b]}`} stroke="currentColor" strokeWidth={1} strokeDasharray="1 4" strokeLinecap="round" fill="none" markerEnd="url(#s5-arrow)" />;
              })}
            </svg>
          </div>

          {/* THE ADDRESS, mobile (PR-H6R) — stacked: the caption, the
              sorted rule book condensed, then the six boxes — each wearing
              its gold KIND echo in place of the connectors — posting
              dashed with its (later) tag and the aubergine line. */}
          <div className="mt-[14px] lg:hidden">
            <p className="font-mono text-[10px] uppercase tracking-[0.20em] text-brand-amber">THE RULE BOOK — SORTED BY KIND</p>
            <div className="mt-2 border border-border bg-white">
              <div className="grid h-[22px] grid-cols-[96px_96px_1fr] items-center overflow-hidden bg-bg-row font-mono text-[6.5px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">
                <span className="px-[6px]">PROVIDER</span><span className="px-[6px]">RESOURCE</span><span className="px-[6px]">KIND</span>
              </div>
              {S5_SORTED.map(([p, r, kind], j) => (
                <div key={`${p}-${r}`} className={`grid grid-cols-[96px_96px_1fr] font-mono text-[10px] leading-[1.4] ${j < S5_SORTED.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="px-[6px] py-[3px] text-brand-purple">{p}</span>
                  <span className="px-[6px] py-[3px] text-brand-purple">{r}</span>
                  <span className="px-[6px] py-[3px] uppercase text-brand-gold">{kind}</span>
                </div>
              ))}
            </div>
            {S5_BOXES.map(([kind, holds, n]) => (
              <div key={kind} className={`mt-3 bg-white px-3 py-[10px] ${kind === 'posting' ? 'border border-dashed border-text-faint' : 'border border-border'}`}>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[12px] text-brand-gold">{kind}</span>
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-brand-gold">{kind.toUpperCase()}</span>
                </div>
                <p className="mt-1 text-[10px] leading-[1.4] text-text-faint">holds {holds}</p>
                <p className="mt-1 font-mono text-[8px] tracking-[0.14em] text-text-faint"><span className="uppercase">{n} {n === 1 ? 'FEED' : 'FEEDS'}</span>{kind === 'posting' ? ' (later)' : ''}</p>
                {kind === 'posting' && <p className="mt-[5px] text-[10px] leading-[1.4] text-brand-purple">No provider feeds this. The bookkeeping step writes them here — from your events.</p>}
              </div>
            ))}
          </div>

          {/* PR-S5: the tail is ONE paragraph — the essay's consolidated
              Step 5 passage, verbatim, slide-01 body tier. The old kind
              table, the divider, the twenty-five-tools statement, the
              notice block and the census receipt all return inside it —
              they render nowhere else now. */}
          <p className="mt-8 max-w-[680px] text-[15px] leading-[1.6] text-text-secondary">Twenty-five tools, six tables; because we sorted by what a thing is, not by which tool it came from. But notice something strange here: (1) the outside world only ever fills four of the six — reference, registry, event, and snapshot; (2) derived is filled only by math we ordered, our AIs included; (3) and posting? Nothing from the outside world ever lands there. Nobody sends you debits and credits — the bookkeeping step builds those, from your own events. Remember that; it matters soon. We did not guess this. We classified every one of the 121 feeds — August 24, 2026 — and posting took zero. The data agreed!</p>
          <p className="mt-[22px] lg:mt-9 text-[17px] lg:text-[28px] text-brand-purple">Everything so far arrived from the world. So where do the things you do live?</p>
        </div>
      </section>

      {/* ── DECK-06 / OBSERVED VS AUTHORED (PR-DATAFLOW) — the fork as
            DATA FLOW: every item the system holds, BY NAME, grouped under
            its step-5 table (kind headers gold; THE SIXTEEN faint — not a
            table name), each item pulling out its source (world / you)
            and flowing on one arrow into its landing row in its lane —
            36 arrows, 16 → OBSERVED and 20 → AUTHORED, zero crossings by
            the S6_LAYOUT law (it throws at build). The hinge box and the
            brackets died: the drawing is the hinge. Lane headers RUST;
            item rows the dark data tier; three moves, no padding. */}
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
            For everything the system holds — did the world hand it to you, or did you make it?
          </p>

          {/* The three moves — real flow, no padding; labels faint. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is three moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> Take everything the system holds: the six tables&apos; feeds, and the sixteen tools that stayed home in Step 2.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Pull out each one&apos;s source — did the world hand it to you, or did you make it?</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> Route it: world-given lands in OBSERVED, you-made lands in AUTHORED.</p>

          {/* THE FORK, desktop (PR-DATAFLOW) — the 1–5 corridor: named
              rows, the SOURCE pull-out, two landing lanes, one arrow per
              item, row for row. */}
          <div className="relative mt-[14px] hidden lg:mt-8 lg:block" style={{ height: S6_H, maxWidth: S6_GEOM.W }}>
            <div className="absolute left-0 top-0 border border-border bg-white" style={{ width: `${(S6_GEOM.L_W / S6_GEOM.W) * 100}%` }}>
              <div style={{ height: S6_GEOM.HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[8px] font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">EVERYTHING THE SYSTEM HOLDS</div>
              {S6_GROUPS.map((g) => (
                <Fragment key={g.label}>
                  <div style={{ height: S6_GEOM.ROW_H }} className="flex items-center justify-between overflow-hidden bg-bg-row px-[8px] font-mono text-[7px]">
                    <span className={g.isKind ? 'text-brand-gold' : 'uppercase tracking-[0.12em] text-text-faint'}>{g.label}</span>
                    <span className="text-text-faint">{g.items.length === 0 ? '(empty)' : `(${g.items.length} ${g.isKind ? (g.items.length === 1 ? 'feed' : 'feeds') : 'tools'})`}</span>
                  </div>
                  {g.items.map((name, i) => (
                    <div key={name} style={{ height: S6_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[8px] font-mono text-[7px] text-brand-purple ${i < g.items.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{name}</div>
                  ))}
                </Fragment>
              ))}
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S6_GEOM.M_X / S6_GEOM.W) * 100}%`, width: `${(S6_GEOM.M_W / S6_GEOM.W) * 100}%` }}>
              <div style={{ height: S6_GEOM.HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[8px] font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">SOURCE</div>
              {S6_GROUPS.map((g) => (
                <Fragment key={g.label}>
                  <div style={{ height: S6_GEOM.ROW_H }} className="bg-bg-row" />
                  {g.items.map((name, i) => (
                    <div key={name} style={{ height: S6_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[8px] font-mono text-[7px] text-brand-purple ${i < g.items.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{g.lane === 'observed' ? 'world' : 'you'}</div>
                  ))}
                </Fragment>
              ))}
            </div>
            {S6_LANES.map(([lane, header, gloss]) => (
              <div key={lane} className="absolute border border-border bg-white" style={{ left: `${(S6_GEOM.R_X / S6_GEOM.W) * 100}%`, top: S6_LAYOUT.laneTop[lane], width: `${((S6_GEOM.W - S6_GEOM.R_X) / S6_GEOM.W) * 100}%`, height: S6_LAYOUT.laneH[lane] }}>
                <div style={{ height: S6_GEOM.LANE_HEAD }} className="overflow-hidden bg-bg-row px-[10px] pt-[6px] border-b border-b-border">
                  <p className={DECK.rust}>{header}</p>
                  <p className="mt-[2px] text-[10px] leading-[1.3] text-text-faint">{gloss}</p>
                </div>
                {S6_LAYOUT.arrows.filter((a) => a.lane === lane).map((a, i, arr) => (
                  <div key={a.name} style={{ height: S6_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[10px] font-mono text-[7px] text-brand-purple ${i < arr.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{a.name}</div>
                ))}
              </div>
            ))}
            <svg viewBox={`0 0 ${S6_GEOM.W} ${S6_H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-brand-purple">
              <defs>
                <marker id="s6-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {S6_LAYOUT.arrows.map((a) => (
                <g key={a.name}>
                  <path d={`M${S6_GEOM.L_W} ${a.ly} H${S6_GEOM.M_X}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" />
                  <path d={`M${S6_GEOM.M_X + S6_GEOM.M_W} ${a.ly} C ${(S6_GEOM.M_X + S6_GEOM.M_W + S6_GEOM.R_X) / 2} ${a.ly}, ${(S6_GEOM.M_X + S6_GEOM.M_W + S6_GEOM.R_X) / 2} ${a.ry}, ${S6_GEOM.R_X} ${a.ry}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s6-arrow)" />
                </g>
              ))}
            </svg>
          </div>

          {/* THE FORK, mobile (PR-DATAFLOW) — the 1–5 mobile idiom: no
              arrows; each group card lists its items with source and lane
              tags. */}
          <div className="mt-[14px] lg:hidden">
            {S6_GROUPS.map((g) => (
              <div key={g.label} className="mt-3 border border-border bg-white first:mt-0">
                <div className="flex items-baseline justify-between bg-bg-row px-3 py-[6px] border-b border-b-border">
                  <span className={`font-mono text-[11px] ${g.isKind ? 'text-brand-gold' : 'uppercase tracking-[0.12em] text-text-faint'}`}>{g.label}</span>
                  <span className="font-mono text-[8px] tracking-[0.12em] text-text-faint">{g.items.length === 0 ? '(empty)' : `(${g.items.length} ${g.isKind ? (g.items.length === 1 ? 'feed' : 'feeds') : 'tools'})`}</span>
                </div>
                {g.items.map((name, i) => (
                  <div key={name} className={`flex items-baseline justify-between gap-2 px-3 py-[5px] ${i < g.items.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                    <span className="overflow-hidden whitespace-nowrap font-mono text-[10px] text-brand-purple">{name}</span>
                    <span className="whitespace-nowrap font-mono text-[8px] text-text-faint">{g.lane === 'observed' ? 'world → OBSERVED' : 'you → AUTHORED'}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* The punch (not a fourth move), then the faint texture note. */}
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>The sixteen are yours — and they have no table. That&apos;s the one gap left.</p>
          <p className="mt-2 text-[12px] lg:text-[14px] text-text-faint">Derived and posting your system computes — no draft. The sixteen you draft, then commit.</p>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={DECK.q}>So how exactly do you make something happen?</p>
        </div>
      </section>

      {/* ── DECK-07 / THE LOOP (PR-ALL-25) — ALL twenty-five tools
            travel the four stage panels — DISCOVER → DECIDE → COMMIT →
            RECORD, headers faint — on one dead-level arrow per tool, row
            for row in PROBLEM_SHEET order, zero crossings by the
            S7_LAYOUT law (it throws at build). COMMIT wears the deck's
            ring (the pull-out — each tool's trigger by name); RECORD is
            the landing, tagged '→ Step 8' — its column is, by name,
            exactly what slide 08 catches (one source, LOOP_BY_TOOL, zero
            drift). No grid repeats the drawing (Deck Law 7). */}
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
            Book a flight, place a trade, send an invoice, post an entry, file with the state; same loop, different nouns.
          </p>

          {/* The four moves ARE the beats — labels faint. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is four moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> Discover — look at your options.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Decide — pick one; the pick becomes a draft.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> Commit — pull the trigger; the world moves.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(d)</span> Record — it is written down forever.</p>

          <p className="mt-10 lg:mt-[76px] text-[12px] lg:text-[14px] text-text-faint">twenty-five of twenty-five — every tool runs these same four beats.</p>

          {/* THE LOOP, desktop (PR-DATAFLOW) — five level arrows through
              four stages. */}
          <div className="relative mt-4 hidden lg:block" style={{ height: S7_H, maxWidth: S7_GEOM.W }}>
            <div className="absolute left-0 top-0 border border-border bg-white" style={{ width: `${(S7_GEOM.T_W / S7_GEOM.W) * 100}%` }}>
              <div style={{ height: S7_GEOM.HEAD }} className="bg-bg-row border-b border-b-border" />
              {S7_LAYOUT.rows.map((r, i) => (
                <div key={r.tool} style={{ height: S7_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[8px] font-mono text-[7px] uppercase tracking-[0.12em] text-brand-purple ${i < S7_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{r.tool}</div>
              ))}
            </div>
            {S7_BEATS.map((stage, s) => (
              <div key={stage} className={`absolute top-0 border border-border bg-white ${stage === 'COMMIT' ? 'ring-1 ring-inset ring-brand-purple' : ''}`} style={{ left: `${(s7StageX(s) / S7_GEOM.W) * 100}%`, width: `${(S7_STAGE_W / S7_GEOM.W) * 100}%` }}>
                <div style={{ height: S7_GEOM.HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[8px] font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">{stage}</div>
                {S7_LAYOUT.rows.map((r, i) => (
                  <div key={r.tool} style={{ height: S7_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[8px] font-mono text-[7px] text-brand-purple ${i < S7_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                    <span className="overflow-hidden whitespace-nowrap">{r.cells[s]}</span>
                  </div>
                ))}
              </div>
            ))}
            <svg viewBox={`0 0 ${S7_GEOM.W} ${S7_H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-brand-purple">
              <defs>
                <marker id="s7-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {S7_LAYOUT.rows.map((r) => (
                <g key={r.tool}>
                  {S7_BEATS.map((stage, s) => (
                    <path key={stage} d={`M${s === 0 ? S7_GEOM.T_W : s7StageX(s - 1) + S7_STAGE_W} ${r.y} H${s7StageX(s)}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd={s === S7_BEATS.length - 1 ? 'url(#s7-arrow)' : undefined} />
                  ))}
                </g>
              ))}
            </svg>
          </div>
          {/* The landing's tag — chrome, faint, seated under RECORD. */}
          <p className="mt-2 hidden text-[12px] lg:block lg:text-[14px] text-text-faint" style={{ marginLeft: s7StageX(3) }}>→ Step 8</p>

          {/* THE LOOP, mobile — one white card per tool, all twenty-five,
              four beats as label → value lines (the 1–5 mobile idiom, no
              arrows). */}
          <div className="mt-4 lg:hidden">
            {S7_LAYOUT.rows.map((r) => (
              <div key={r.tool} className="mt-3 border border-border bg-white px-3 py-[8px] first:mt-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-faint">{r.tool}</p>
                {S7_BEATS.map((beat, s) => (
                  <div key={beat} className="mt-[4px] grid grid-cols-[74px_1fr] gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">{beat}</span>
                    <span className="text-[10px] leading-[1.4] text-brand-purple">{r.cells[s]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>Twenty-five tools. Twenty-five loops. One shape!</p>
          <p className={`mt-2 ${DECK.statement}`}>This loop is the blueprint — the shape we&apos;re building every tool toward. Today, hotel bookings commit for real and an accepted task fires its build; the rest run discover → decide → draft, and commit is the beat we&apos;re wiring to the same loop, tool by tool.</p>
          <p className={DECK.q}>Twenty-five loops. Where do all the commits land?</p>
        </div>
      </section>

      {/* ── DECK-08 / THE MASTER TABLE (PR-S8-DATAFLOW) — the claim is
            drawn: all twenty-five loops' records, BY NAME in PROBLEM_SHEET
            order, each pulling out the document it becomes (WHAT IT IS)
            and flowing on its own DEAD-LEVEL arrow into its row of ONE
            master table — 25 arrows, zero crossings by the S8_LAYOUT law
            (it throws at build). The four field columns derive from
            MASTER_ROWS; the life-story and who/when cells repeat on every
            row — the repetition IS the teaching. The static two-column
            field table died (SHOW DON'T ECHO). Rust label above the
            table; three moves, no padding. */}
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

          {/* The three moves — real flow, no padding; labels faint. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is three moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> Take every record the loops wrote — one per tool, twenty-five, still with no home.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Give each one the same shape: a document with four fields — what it is, its life story, its pieces, who did it and when.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> Store all twenty-five in ONE master table.</p>

          <p className="mt-10 lg:mt-[76px] text-[12px] lg:text-[14px] text-text-faint">twenty-five of twenty-five — every loop&apos;s record lands here.</p>
          <p className={`mt-4 hidden lg:block ${DECK.rust}`} style={{ marginLeft: S8_GEOM.R_X }}>EVERY DOCUMENT CARRIES THE SAME FOUR THINGS</p>

          {/* THE MASTER TABLE, desktop (PR-S8-DATAFLOW) — the 1–5 corridor:
              named records, the WHAT-IT-IS pull-out, one landing table. */}
          <div className="relative mt-2 hidden lg:block" style={{ height: S8_H, maxWidth: S8_GEOM.W }}>
            <div className="absolute left-0 top-0 border border-border bg-white" style={{ width: `${(S8_GEOM.L_W / S8_GEOM.W) * 100}%` }}>
              <div style={{ height: S8_GEOM.HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[8px] font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">ONE PER LOOP — TWENTY-FIVE</div>
              {/* PR-ALL-25: each record BY NAME — LOOP_BY_TOOL's RECORD
                  cell, exactly what slide 07's landing column wrote. */}
              {S8_LAYOUT.rows.map((r, i) => (
                <div key={r.tool} style={{ height: S8_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[8px] font-mono text-[7px] text-brand-purple ${i < S8_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{LOOP_BY_TOOL[r.tool][3]}</div>
              ))}
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S8_GEOM.M_X / S8_GEOM.W) * 100}%`, width: `${(S8_GEOM.M_W / S8_GEOM.W) * 100}%` }}>
              <div style={{ height: S8_GEOM.HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[8px] font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">{S8_LAYOUT.fields[0]}</div>
              {S8_LAYOUT.rows.map((r, i) => (
                <div key={r.tool} style={{ height: S8_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[8px] font-mono text-[7px] text-brand-purple ${i < S8_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{r.what}</div>
              ))}
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S8_GEOM.R_X / S8_GEOM.W) * 100}%`, width: `${((S8_GEOM.W - S8_GEOM.R_X) / S8_GEOM.W) * 100}%` }}>
              <div style={{ height: S8_GEOM.HEAD }} className="grid grid-cols-[150px_170px_210px_1fr] items-center overflow-hidden bg-bg-row font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">
                {S8_LAYOUT.fields.map((f) => (
                  <span key={f} className="overflow-hidden whitespace-nowrap px-[8px]">{f}</span>
                ))}
              </div>
              {S8_LAYOUT.rows.map((r, i) => (
                <div key={r.tool} style={{ height: S8_GEOM.ROW_H }} className={`grid grid-cols-[150px_170px_210px_1fr] items-center font-mono text-[7px] text-brand-purple ${i < S8_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="overflow-hidden whitespace-nowrap px-[8px]">{r.what}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[8px]">{S8_LIFE}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[8px]">{r.pieces}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[8px]">{S8_WHO}</span>
                </div>
              ))}
            </div>
            <svg viewBox={`0 0 ${S8_GEOM.W} ${S8_H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-brand-purple">
              <defs>
                <marker id="s8-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {S8_LAYOUT.rows.map((r) => (
                <g key={r.tool}>
                  <path d={`M${S8_GEOM.L_W} ${r.y} H${S8_GEOM.M_X}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" />
                  <path d={`M${S8_GEOM.M_X + S8_GEOM.M_W} ${r.y} C ${(S8_GEOM.M_X + S8_GEOM.M_W + S8_GEOM.R_X) / 2} ${r.y}, ${(S8_GEOM.M_X + S8_GEOM.M_W + S8_GEOM.R_X) / 2} ${r.y}, ${S8_GEOM.R_X} ${r.y}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s8-arrow)" />
                </g>
              ))}
            </svg>
          </div>

          {/* THE MASTER TABLE, mobile (PR-S8-DATAFLOW) — the 1–5 mobile
              idiom: no arrows; the twenty-five documents as compact white
              cards, four fields each as label → value lines. */}
          <div className="mt-2 lg:hidden">
            <p className={DECK.rust}>EVERY DOCUMENT CARRIES THE SAME FOUR THINGS</p>
            {S8_LAYOUT.rows.map((r) => (
              <div key={r.tool} className="mt-3 border border-border bg-white px-3 py-[8px] first:mt-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-faint">{r.tool}</p>
                {([[S8_LAYOUT.fields[0], r.what], [S8_LAYOUT.fields[1], S8_LIFE], [S8_LAYOUT.fields[2], r.pieces], [S8_LAYOUT.fields[3], S8_WHO]] as const).map(([label, value]) => (
                  <div key={label} className="mt-[4px] grid grid-cols-[104px_1fr] gap-2">
                    <span className="overflow-hidden whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.1em] text-text-faint">{label}</span>
                    <span className="text-[10px] leading-[1.4] text-brand-purple">{value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>Different names, same shape. That is why one table can hold them all!</p>
          <p className={`mt-2 ${DECK.statement}`}>The master table is the blueprint. Today each tool keeps its own table; one table holding every document is the shape we&apos;re building.</p>
          <p className={DECK.q}>You committed. The world moved. But how do you know the money really landed?</p>
        </div>
      </section>

      {/* ── DECK-09 / THE MATCH (PR-S9-DATAFLOW) — the payoff of 06's
            fork, drawn: the fourteen observed money events (dark tier,
            the ruled MATCHES order — repeats are distinct matches) each
            pull out the KEY — amount · date · reference, the same on
            every row — and flow on one DEAD-LEVEL arrow into the
            authored document they confirm (TOOL_DOCUMENTS' nouns).
            Fourteen arrows, zero crossings by the S9_LAYOUT law (it
            throws at build). The MATCH divider idiom rides the middle
            band; OBSERVED / AUTHORED band labels are rust; Travel wears
            the faint live-today tag so the drawing and the hedge agree.
            The single deposit/invoice card pair retired (SHOW DON'T
            ECHO); the eleven no-match tools are derived and named in
            the faint note. Three moves, no padding. */}
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

          {/* The three moves — real flow, no padding; labels faint. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is three moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> Take what the world said happened — the observed money events.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Pull out the key from each: amount, date, reference.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> Find the document in the master table with the same key — and match them.</p>

          {/* THE MATCH, desktop (PR-S9-DATAFLOW) — the 1–5 corridor:
              observed events, the KEY pull-out under the MATCH divider,
              the documents found. */}
          <div className="relative mt-[14px] hidden lg:mt-8 lg:block" style={{ height: S9_H, maxWidth: S9_GEOM.W }}>
            <div className="absolute left-0 top-0 border border-border bg-white" style={{ width: `${(S9_GEOM.L_W / S9_GEOM.W) * 100}%` }}>
              <div style={{ height: S9_GEOM.HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[8px] border-b border-b-border">
                <span className={DECK.rust}>OBSERVED — what happened</span>
              </div>
              {S9_LAYOUT.rows.map((r, i) => (
                <div key={r.tool} style={{ height: S9_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[8px] font-mono text-[7px] text-brand-purple ${i < S9_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{r.observed}</div>
              ))}
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S9_GEOM.M_X / S9_GEOM.W) * 100}%`, width: `${(S9_GEOM.M_W / S9_GEOM.W) * 100}%` }}>
              <div style={{ height: S9_GEOM.HEAD }} className="flex items-center gap-[10px] overflow-hidden bg-bg-row px-[8px] border-b border-b-border">
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-brand-purple">MATCH</span>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </div>
              {S9_LAYOUT.rows.map((r, i) => (
                <div key={r.tool} style={{ height: S9_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[8px] font-mono text-[7px] text-brand-purple ${i < S9_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{S9_KEY}</div>
              ))}
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S9_GEOM.R_X / S9_GEOM.W) * 100}%`, width: `${((S9_GEOM.W - S9_GEOM.R_X) / S9_GEOM.W) * 100}%` }}>
              <div style={{ height: S9_GEOM.HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[8px] border-b border-b-border">
                <span className={DECK.rust}>AUTHORED — what you did</span>
              </div>
              {S9_LAYOUT.rows.map((r, i) => (
                <div key={r.tool} style={{ height: S9_GEOM.ROW_H }} className={`flex items-center justify-between overflow-hidden px-[8px] font-mono text-[7px] ${i < S9_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="overflow-hidden whitespace-nowrap text-brand-purple">{r.doc}</span>
                  {r.live && <span className="whitespace-nowrap pl-2 text-text-faint">live today</span>}
                </div>
              ))}
            </div>
            <svg viewBox={`0 0 ${S9_GEOM.W} ${S9_H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-brand-purple">
              <defs>
                <marker id="s9-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {S9_LAYOUT.rows.map((r) => (
                <g key={r.tool}>
                  <path d={`M${S9_GEOM.L_W} ${r.y} H${S9_GEOM.M_X}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" />
                  <path d={`M${S9_GEOM.M_X + S9_GEOM.M_W} ${r.y} C ${(S9_GEOM.M_X + S9_GEOM.M_W + S9_GEOM.R_X) / 2} ${r.y}, ${(S9_GEOM.M_X + S9_GEOM.M_W + S9_GEOM.R_X) / 2} ${r.y}, ${S9_GEOM.R_X} ${r.y}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s9-arrow)" />
                </g>
              ))}
            </svg>
          </div>

          {/* THE MATCH, mobile (PR-S9-DATAFLOW) — the 1–5 mobile idiom:
              no arrows; fourteen compact cards, observed → key → document
              found, Travel tagged live today. */}
          <div className="mt-[14px] lg:hidden">
            {S9_LAYOUT.rows.map((r) => (
              <div key={r.tool} className="mt-3 border border-border bg-white px-3 py-[8px] first:mt-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="overflow-hidden whitespace-nowrap font-mono text-[10px] text-brand-purple">{r.observed} → {r.doc}</span>
                  {r.live && <span className="whitespace-nowrap font-mono text-[8px] text-text-faint">live today</span>}
                </div>
                <p className="mt-[3px] font-mono text-[8px] tracking-[0.1em] text-text-faint">{S9_KEY}</p>
              </div>
            ))}
          </div>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>amount + date + reference → one match.</p>
          <p className={`mt-2 ${DECK.statement}`}>Click; one match.</p>
          <p className={`mt-2 ${DECK.statement}`}>The deposit found its invoice. The fill found its order. The card charge found its booking. Nobody hunted through statements!</p>
          <p className={`mt-2 ${DECK.statement}`}>Matched means real; the world just confirmed what you did.</p>
          <p className={`mt-2 ${DECK.statement}`}>(A piece of this is already alive today: card charges find their bookings and propose the match — you approve it.)</p>
          <p className="mt-2 text-[12px] lg:text-[14px] text-text-faint">The other eleven move no money and need no match — they&apos;re real the moment you commit.</p>
          <p className={DECK.q}>Matched and real. So who writes the debits and credits?</p>
        </div>
      </section>

      {/* ── DECK-10 / THE POSTING (PR-S10-DATAFLOW) — the deck's longest
            payoff, drawn: posting took zero feeds at step 5; slide 9
            closed on who writes the debits and credits; here the
            fourteen matched money events (MATCHES order — 9's matches
            ARE 10's inputs) each pull out their rule — debit account ·
            credit account, accounts gold (the money licence) — and one
            DEAD-LEVEL arrow writes the two lines into the posting
            table, slide 5's box now filling (same dashed border, the
            echo). Fourteen arrows, zero crossings by the S10_LAYOUT law
            (it throws at build). The static rules table retired (SHOW
            DON'T ECHO) — POSTING_RULES feeds the middle panel only; the
            stripe-payout rule lives on under the worked sale. The
            no-money eleven derive from the sheet — the same eleven
            slide 9 named. Three moves, no padding. */}
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

          {/* The three moves — real flow, no padding; labels faint. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is three moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> Take the matched money events from Step 9 — fourteen, each confirmed by the world.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Pull out each one&apos;s rule: which account takes the debit, which takes the credit.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> The rule writes the two lines into the posting table. You never type them.</p>

          {/* THE POSTING, desktop (PR-S10-DATAFLOW) — the 1–5 corridor:
              matched events, THE RULE pull-out, the posting table
              filling. */}
          <div className="relative mt-[14px] hidden lg:mt-8 lg:block" style={{ height: S10_H, maxWidth: S10_GEOM.W }}>
            <div className="absolute left-0 top-0 border border-border bg-white" style={{ width: `${(S10_GEOM.L_W / S10_GEOM.W) * 100}%` }}>
              <div style={{ height: S10_GEOM.HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[8px] border-b border-b-border">
                <span className={DECK.rust}>MATCHED — confirmed by the world</span>
              </div>
              {S10_LAYOUT.rows.map((r, i) => (
                <div key={r.tool} style={{ height: S10_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[8px] font-mono text-[7px] text-brand-purple ${i < S10_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{r.event}</div>
              ))}
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S10_GEOM.M_X / S10_GEOM.W) * 100}%`, width: `${(S10_GEOM.M_W / S10_GEOM.W) * 100}%` }}>
              <div style={{ height: S10_GEOM.HEAD }} className="flex items-center gap-[10px] overflow-hidden bg-bg-row px-[8px] border-b border-b-border">
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-brand-purple">THE RULE</span>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </div>
              {S10_LAYOUT.rows.map((r, i) => (
                <div key={r.tool} style={{ height: S10_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[8px] font-mono text-[7px] ${i < S10_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="whitespace-nowrap"><span className="text-text-faint">debit </span><span className="text-brand-gold">{r.debit}</span><span className="text-text-faint"> · credit </span><span className="text-brand-gold">{r.credit}</span></span>
                </div>
              ))}
            </div>
            <div className="absolute top-0 border border-dashed border-text-faint bg-white" style={{ left: `${(S10_GEOM.R_X / S10_GEOM.W) * 100}%`, width: `${((S10_GEOM.W - S10_GEOM.R_X) / S10_GEOM.W) * 100}%` }}>
              <div style={{ height: S10_GEOM.HEAD }} className="overflow-hidden bg-bg-row pt-[5px] border-b border-b-border">
                <p className={`px-[8px] leading-[1.3] ${DECK.rust}`}>POSTING — debits and credits</p>
                <p className="mt-[2px] px-[8px] font-mono text-[8px] leading-[1.3] text-text-faint">the table that took zero at Step 5</p>
                <div className="mt-[3px] grid grid-cols-2 font-mono text-[7px] leading-[1.3] uppercase tracking-[0.14em] text-text-faint">
                  <span className="px-[8px]">DEBIT</span><span className="px-[8px]">CREDIT</span>
                </div>
              </div>
              {S10_LAYOUT.rows.map((r, i) => (
                <div key={r.tool} style={{ height: S10_GEOM.ROW_H }} className={`grid grid-cols-2 items-center font-mono text-[7px] text-brand-gold ${i < S10_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="overflow-hidden whitespace-nowrap px-[8px]">{r.debit}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[8px]">{r.credit}</span>
                </div>
              ))}
            </div>
            <svg viewBox={`0 0 ${S10_GEOM.W} ${S10_H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-brand-purple">
              <defs>
                <marker id="s10-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {S10_LAYOUT.rows.map((r) => (
                <g key={r.tool}>
                  <path d={`M${S10_GEOM.L_W} ${r.y} H${S10_GEOM.M_X}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" />
                  <path d={`M${S10_GEOM.M_X + S10_GEOM.M_W} ${r.y} C ${(S10_GEOM.M_X + S10_GEOM.M_W + S10_GEOM.R_X) / 2} ${r.y}, ${(S10_GEOM.M_X + S10_GEOM.M_W + S10_GEOM.R_X) / 2} ${r.y}, ${S10_GEOM.R_X} ${r.y}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s10-arrow)" />
                </g>
              ))}
            </svg>
          </div>

          {/* THE POSTING, mobile (PR-S10-DATAFLOW) — the 1–5 mobile
              idiom: no arrows; fourteen compact cards, each event and
              the rule&apos;s two lines. */}
          <div className="mt-[14px] lg:hidden">
            {S10_LAYOUT.rows.map((r) => (
              <div key={r.tool} className="mt-3 border border-border bg-white px-3 py-[8px] first:mt-0">
                <span className="font-mono text-[10px] text-brand-purple">{r.event}</span>
                <p className="mt-[3px] font-mono text-[10px] leading-[1.5]"><span className="text-text-faint">debit </span><span className="text-brand-gold">{r.debit}</span><span className="text-text-faint"> · credit </span><span className="text-brand-gold">{r.credit}</span></p>
              </div>
            ))}
          </div>

          <p className="mt-[22px] lg:mt-8 font-mono text-[11px] lg:text-[12px] text-text-faint">Four quick glosses before we go on: A/R means money owed TO you. A/P means money YOU owe. Clearing means a holding bin that must end at zero. Withholdings means tax held back from a paycheck before it reaches anyone.</p>

          <p className={`mt-10 lg:mt-[76px] ${DECK.rust}`}>ONE SALE, THREE LINES</p>
          <p className="mt-[14px] font-mono text-[11px] lg:text-[12px]"><span className="text-brand-purple">{SALE_RULE[0]}</span><span className="text-text-faint"> — debit </span><span className="text-brand-gold">{SALE_RULE[1]}</span><span className="text-text-faint"> · credit </span><span className="text-brand-gold">{SALE_RULE[2]}</span></p>
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
          <p className="mt-[14px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">{`One more truth: some tools never touch money. ${S10_LAYOUT.noMoney.join(', ')} never write a line. Your hours reach the books one way only; through Payroll.`}</p>

          <p className={`mt-2 ${DECK.statement}`}>The posting table is the blueprint — today it holds zero lines. The rules writing them is the bookkeeping pipe we&apos;re building.</p>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={DECK.q}>So what do all those lines add up to?</p>
        </div>
      </section>

      {/* ── DECK-11 / THE ANSWERS (PR-S11-DATAFLOW) — the thesis, drawn:
            one ledger, many lenses. The lines Step 10 wrote (accounts,
            plus the reference feeds an answer needs) group under a faint
            header per answer; each group's math from ANSWER_ROWS spans
            its rows as the lens; one arrow per line runs level through
            the lens and converges on its answer card, heads fanned in
            row order (the S2_CONVERGE pattern) so nothing stacks.
            Groups tile contiguously in ANSWER_ROWS order, so the fans
            are monotonic — zero crossings by the S11_LAYOUT law (it
            throws at build). The static QUESTION | THE MATH table
            retired (SHOW DON'T ECHO) — ANSWER_ROWS feeds the middle
            panel only. A line under two answers renders once per group:
            same line, many lenses. Three moves, no padding. */}
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

          {/* The three moves — real flow, no padding; labels faint. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is three moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> Take the lines Step 10 wrote — the accounts, and the reference feeds an answer needs.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Each answer is a lens: its math pulls exactly the lines it reads, and only those.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> The answer is computed from them — never typed, never stale.</p>

          {/* THE ANSWERS, desktop (PR-S11-DATAFLOW) — the 1–5 corridor:
              the lines, THE MATH pull-out spanning each group, the four
              answer cards. */}
          <div className="relative mt-[14px] hidden lg:mt-8 lg:block" style={{ height: S11_H, maxWidth: S11_GEOM.W }}>
            <div className="absolute left-0 top-0 border border-border bg-white" style={{ width: `${(S11_GEOM.L_W / S11_GEOM.W) * 100}%` }}>
              <div style={{ height: S11_GEOM.HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[8px] border-b border-b-border">
                <span className={DECK.rust}>THE LINES — what Step 10 wrote</span>
              </div>
              {S11_LAYOUT.groups.map((g) => (
                <Fragment key={g.question}>
                  <div style={{ height: S11_GEOM.GROUP_HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[8px] font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">{g.question}</div>
                  {g.rows.map((r, i) => (
                    <div key={`${g.question}-${r.name}`} style={{ height: S11_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[8px] font-mono text-[7px] text-brand-purple ${i < g.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>{r.name}</div>
                  ))}
                </Fragment>
              ))}
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S11_GEOM.M_X / S11_GEOM.W) * 100}%`, width: `${(S11_GEOM.M_W / S11_GEOM.W) * 100}%` }}>
              <div style={{ height: S11_GEOM.HEAD }} className="flex items-center gap-[10px] overflow-hidden bg-bg-row px-[8px] border-b border-b-border">
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-brand-purple">THE MATH</span>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </div>
              {S11_LAYOUT.groups.map((g, i) => (
                <div key={g.question} style={{ height: g.h }} className={`flex items-center overflow-hidden px-[10px] font-mono text-[8px] leading-[1.5] text-brand-purple ${i < S11_LAYOUT.groups.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span><GoldSegments segments={g.math} /></span>
                </div>
              ))}
            </div>
            <div className="absolute top-0 flex items-center overflow-hidden" style={{ left: `${(S11_GEOM.R_X / S11_GEOM.W) * 100}%`, height: S11_GEOM.HEAD }}>
              <span className={DECK.rust}>THE ANSWERS</span>
            </div>
            {S11_LAYOUT.groups.map((g) => (
              <div key={g.question} className="absolute border border-border bg-white" style={{ left: `${(S11_GEOM.R_X / S11_GEOM.W) * 100}%`, top: g.ay - S11_GEOM.CARD_H / 2, width: `${(S11_GEOM.CARD_W / S11_GEOM.W) * 100}%`, height: S11_GEOM.CARD_H }}>
                <div className="flex h-full items-center overflow-hidden px-[10px] text-[11px] leading-[1.3] text-brand-purple">{g.question}</div>
              </div>
            ))}
            <svg viewBox={`0 0 ${S11_GEOM.W} ${S11_H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-brand-purple">
              <defs>
                <marker id="s11-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {S11_LAYOUT.arrows.map((r) => (
                <g key={`${r.gi}-${r.name}`}>
                  <path d={`M${S11_GEOM.L_W} ${r.ly} H${S11_GEOM.M_X}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" />
                  <path d={`M${S11_GEOM.M_X + S11_GEOM.M_W} ${r.ly} C ${(S11_GEOM.M_X + S11_GEOM.M_W + S11_GEOM.R_X) / 2} ${r.ly}, ${(S11_GEOM.M_X + S11_GEOM.M_W + S11_GEOM.R_X) / 2} ${r.ty}, ${S11_GEOM.R_X} ${r.ty}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s11-arrow)" />
                </g>
              ))}
            </svg>
          </div>

          {/* THE ANSWERS, mobile (PR-S11-DATAFLOW) — the 1–5 mobile
              idiom: no arrows; four cards in order — the question, its
              math, its lines. */}
          <div className="mt-[14px] lg:hidden">
            {S11_LAYOUT.groups.map((g) => (
              <div key={g.question} className="mt-3 border border-border bg-white px-3 py-[8px] first:mt-0">
                <span className="text-[11px] leading-[1.4] text-brand-purple">{g.question}</span>
                <p className="mt-[3px] font-mono text-[10px] leading-[1.5] text-brand-purple"><GoldSegments segments={g.math} /></p>
                <p className="mt-[3px] font-mono text-[10px] leading-[1.5] text-text-faint">{g.rows.map((r) => r.name).join(' · ')}</p>
              </div>
            ))}
          </div>

          {/* PR-VOICE: the essay line renders once, in the statement tier;
              the rust caps line stays as the poster emphasis of it. */}
          <p className={`mt-10 lg:mt-[76px] ${DECK.statement}`}>Never typed. Never stale. This is the product!</p>
          {/* PR-ARTICULATION: the essay's back-half truth, verbatim. */}
          <p className={`mt-2 ${DECK.statement}`}>And look at what these steps really are: Steps 9 and 10 are the bookkeeping system. Step 11 is the tax module and the runway screen. We did not bolt tools onto the pipe — the back half of the pipe IS the tools.</p>
          <p className="mt-[14px] font-mono text-[11px] lg:text-[13px] uppercase tracking-[0.20em] text-brand-amber">THIS IS THE PRODUCT.</p>

          <p className={`mt-2 ${DECK.statement}`}>These four lenses are the blueprint. Today all four compute — tax and the business result from the journal entries you commit by hand, runway from Plaid&apos;s account balances against those entries, trading from the positions and lots you committed, with no live quote in the number. The rules-written lines and the live quotes the blueprint reads wait on the posting pipe.</p>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={DECK.q}>Four answers. Where do you look?</p>
        </div>
      </section>

      {/* ── DECK-12 / THE TWO WINDOWS (PR-S12-DATAFLOW) — the thesis,
            drawn: ledger and calendar are the same rows seen two ways.
            The dated things sit in the CENTER with their WHEN pulled
            out; the calendar window is LEFT, the ledger window RIGHT —
            the two arrow sets live in separate half-planes (stacked on
            one side they provably cross: one line's calendar arrow must
            cross another's ledger arrow), and within each set sources
            and landings share one date order, so both corridors are
            monotone — zero crossings by the S12_LAYOUT law (it throws
            at build). Every item arrows LEFT into the calendar (bars on
            their spans, dots on their days, ledger lines as derived
            gold dots, deadlines on the real-deadlines rows); the four
            lines ALSO arrow RIGHT into the ledger — one item, two
            windows. The static side-by-side retired (SHOW DON'T ECHO);
            both windows survive only as the landings. Every item
            arrows left into the calendar; deadlines land on the
            real-deadlines strip rows. The travel figure stays flagged:
            the render tags it faint as illustrative while the const
            comment holds the swap-here note. The deadline sentences'
            glosses leave the render — name and date derive per row;
            CAL_DEADLINES holds the essay text. Three moves, no
            padding. */}
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

          {/* The three moves — real flow, no padding; labels faint. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is three moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span> Take every dated thing the pipe made — the lines Step 10 wrote, the documents from Step 8 that carry a date, the real deadlines.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Pull out WHEN it is: a moment — a dot — or a span — a bar.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> It appears in both windows at once: as a row in the ledger, and on its day in the calendar. Same thing, two views.</p>

          {/* THE TWO WINDOWS, desktop (PR-S12-DATAFLOW) — center-out:
              the dated things radiate left into the calendar and right
              into the ledger. */}
          <div className="relative mt-[14px] hidden lg:mt-8 lg:block" style={{ height: S12_H, maxWidth: S12_GEOM.W }}>
            <div className="absolute left-0 top-0 border border-border bg-white" style={{ width: `${(S12_GEOM.CAL_W / S12_GEOM.W) * 100}%` }}>
              <div style={{ height: S12_GEOM.HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[8px] border-b border-b-border">
                <span className={DECK.rust}>THE CALENDAR</span>
              </div>
              <div style={{ height: S12_GEOM.DAY_H }} className="grid grid-cols-[repeat(14,minmax(0,1fr))] border-b border-border bg-bg-row">
                {CAL_DAYS.map((d) => (
                  <span key={d} className="flex items-center justify-center font-mono text-[7px] text-text-faint">{d}</span>
                ))}
              </div>
              <div className="relative bg-white" style={{ height: S12_GEOM.BODY_H }}>
                {Array.from({ length: 13 }, (_, i) => (
                  <span key={i} aria-hidden="true" className="absolute top-0 h-full w-px bg-bg-row" style={{ left: `${((i + 1) / 14) * 100}%` }} />
                ))}
                {CAL_BARS.map((bar) => (
                  <Fragment key={bar.label}>
                    <span aria-hidden="true" className="absolute h-[6px] bg-brand-purple" style={{ left: `calc(${bar.left}% + 4px)`, width: `calc(${bar.width}% - 8px)`, top: bar.y }} />
                    <span className="absolute whitespace-nowrap font-mono text-[8px] text-brand-purple" style={{ left: `calc(${bar.left}% + 4px)`, top: bar.y + 9 }}>{bar.label}</span>
                  </Fragment>
                ))}
                {CAL_DOTS.map((dot) => (
                  <Fragment key={dot.label}>
                    <span aria-hidden="true" className="absolute h-[6px] w-[6px] rounded-full bg-brand-gold" style={{ left: `calc(${((dot.day - 0.5) / 14) * 100}% - 3px)`, top: 96 }} />
                    <span className="absolute whitespace-nowrap font-mono text-[8px] text-brand-purple" style={{ left: `calc(${((dot.day - 0.5) / 14) * 100}% + 7px)`, top: 93 }}>{dot.label}</span>
                  </Fragment>
                ))}
                {S12_LAYOUT.lines.map((r, j) => (
                  <span key={r.name} aria-hidden="true" className="absolute h-[6px] w-[6px] rounded-full bg-brand-gold" style={{ left: `calc(${((r.key + 0.5) / 14) * 100}% - 3px)`, top: 104 + j * 7 }} />
                ))}
              </div>
              <div style={{ height: S12_GEOM.DLL_H }} className="flex items-center overflow-hidden bg-bg-row px-[8px] border-y border-border">
                <span className="font-mono text-[8px] uppercase tracking-[0.20em] text-brand-amber">THE REAL DEADLINES</span>
              </div>
              {S12_LAYOUT.deadlines.map((r, j) => (
                <div key={r.name} style={{ height: S12_GEOM.DL_H }} className={`flex items-center gap-[6px] overflow-hidden px-[8px] font-mono text-[7px] ${j < S12_LAYOUT.deadlines.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span aria-hidden="true" className="h-[4px] w-[4px] shrink-0 rounded-full bg-brand-gold" />
                  <span className="whitespace-nowrap text-brand-purple">{r.name}</span>
                  <span className="overflow-hidden whitespace-nowrap text-text-faint">— {r.date}</span>
                </div>
              ))}
            </div>
            <div className="absolute top-0 border border-border bg-white" style={{ left: `${(S12_GEOM.C_X / S12_GEOM.W) * 100}%`, width: `${(S12_GEOM.C_W / S12_GEOM.W) * 100}%` }}>
              <div style={{ height: S12_GEOM.HEAD }} className="flex items-center justify-between overflow-hidden bg-bg-row px-[8px] border-b border-b-border">
                <span className={DECK.rust}>THE DATED THINGS</span>
                <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-brand-purple">WHEN</span>
              </div>
              {S12_LAYOUT.rows.map((r, i) => (
                <div key={`${r.name}-${i}`} style={{ height: S12_GEOM.ROW_H }} className={`grid grid-cols-[150px_1fr] items-center font-mono text-[7px] ${i < S12_LAYOUT.rows.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="overflow-hidden whitespace-nowrap px-[8px] text-brand-purple">{r.name}</span>
                  <span className="overflow-hidden whitespace-nowrap px-[8px]"><span className="text-brand-purple">{r.date}</span><span className="text-text-faint"> · {r.kind}</span></span>
                </div>
              ))}
            </div>
            <div className="absolute top-0" style={{ left: `${(S12_GEOM.L_X / S12_GEOM.W) * 100}%`, width: `${((S12_GEOM.W - S12_GEOM.L_X) / S12_GEOM.W) * 100}%` }}>
              <div style={{ height: S12_GEOM.HEAD }} className="flex items-center overflow-hidden px-[8px]">
                <span className={DECK.rust}>THE LEDGER</span>
              </div>
              <div className="border border-border bg-white" style={{ marginTop: S12_GEOM.LED_TOP - S12_GEOM.HEAD }}>
                <div style={{ height: S12_GEOM.LED_HEAD }} className="grid grid-cols-[56px_84px_1fr_70px] items-center overflow-hidden bg-bg-row font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">
                  <span className="px-[6px]">DATE</span><span className="px-[6px]">LINE</span><span className="px-[6px]">DEBIT</span><span className="px-[6px]">CREDIT</span>
                </div>
                {S12_LAYOUT.lines.map((r, k) => (
                  <div key={r.name} style={{ height: S12_GEOM.LED_ROW }} className={`grid grid-cols-[56px_84px_1fr_70px] items-center font-mono text-[7px] ${k < S12_LAYOUT.lines.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                    <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-purple">{r.row[0]}</span>
                    <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-purple">{r.row[1]}</span>
                    <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-gold">{r.row[2]}{r.row[2] === '480.00' && <span className="text-[6px] text-text-faint"> (illustrative)</span>}</span>
                    <span className="overflow-hidden whitespace-nowrap px-[6px] text-brand-gold">{r.row[3]}</span>
                  </div>
                ))}
              </div>
            </div>
            <svg viewBox={`0 0 ${S12_GEOM.W} ${S12_H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-brand-purple">
              <defs>
                <marker id="s12-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {S12_LAYOUT.calArrows.map((r, i) => (
                <path key={`cal-${r.name}-${i}`} d={`M${S12_GEOM.C_X} ${r.ly} C ${(S12_GEOM.C_X + S12_GEOM.CAL_W) / 2} ${r.ly}, ${(S12_GEOM.C_X + S12_GEOM.CAL_W) / 2} ${r.ty}, ${S12_GEOM.CAL_W} ${r.ty}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s12-arrow)" />
              ))}
              {S12_LAYOUT.ledArrows.map((r) => (
                <path key={`led-${r.name}`} d={`M${S12_GEOM.C_X + S12_GEOM.C_W} ${r.ly} C ${(S12_GEOM.C_X + S12_GEOM.C_W + S12_GEOM.L_X) / 2} ${r.ly}, ${(S12_GEOM.C_X + S12_GEOM.C_W + S12_GEOM.L_X) / 2} ${r.ty}, ${S12_GEOM.L_X} ${r.ty}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd="url(#s12-arrow)" />
              ))}
            </svg>
          </div>

          {/* THE TWO WINDOWS, mobile (PR-S12-DATAFLOW) — no arrows; the
              dated things as cards, then the ledger, then the calendar
              strip with the deadlines. */}
          <div className="mt-[14px] lg:hidden">
            {S12_LAYOUT.rows.map((r, i) => (
              <div key={`${r.name}-${i}`} className="mt-3 border border-border bg-white px-3 py-[8px] first:mt-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="overflow-hidden whitespace-nowrap font-mono text-[10px] text-brand-purple">{r.name}</span>
                  <span className="whitespace-nowrap font-mono text-[8px] text-text-faint">{r.isLine ? 'ledger + calendar' : 'calendar'}</span>
                </div>
                <p className="mt-[3px] font-mono text-[10px] leading-[1.5]"><span className="text-brand-purple">{r.date}</span><span className="text-text-faint"> · {r.kind}</span></p>
              </div>
            ))}
            <p className={`mt-6 ${DECK.rust}`}>THE LEDGER</p>
            <div className="mt-[10px] border border-border bg-white">
              <div className="grid grid-cols-[64px_1fr_88px_72px] items-center bg-bg-row py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">
                <span className="px-2">DATE</span><span className="px-2">LINE</span><span className="px-2">DEBIT</span><span className="px-2">CREDIT</span>
              </div>
              {S12_LAYOUT.lines.map((r, k) => (
                <div key={r.name} className={`grid grid-cols-[64px_1fr_88px_72px] items-center py-[6px] font-mono text-[10px] ${k < S12_LAYOUT.lines.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span className="overflow-hidden whitespace-nowrap px-2 text-brand-purple">{r.row[0]}</span>
                  <span className="overflow-hidden whitespace-nowrap px-2 text-brand-purple">{r.row[1]}</span>
                  <span className="overflow-hidden whitespace-nowrap px-2 text-brand-gold">{r.row[2]}{r.row[2] === '480.00' && <span className="text-[8px] text-text-faint"> (illustrative)</span>}</span>
                  <span className="overflow-hidden whitespace-nowrap px-2 text-brand-gold">{r.row[3]}</span>
                </div>
              ))}
            </div>
            <p className={`mt-6 ${DECK.rust}`}>THE CALENDAR</p>
            <div className="mt-[10px] border border-border">
              <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] border-b border-border bg-bg-row">
                {CAL_DAYS.map((d) => (
                  <span key={d} className="py-1 text-center font-mono text-[10px] text-text-faint">{d}</span>
                ))}
              </div>
              <div className="relative h-[132px] bg-white">
                {Array.from({ length: 13 }, (_, i) => (
                  <span key={i} aria-hidden="true" className="absolute top-0 h-full w-px bg-bg-row" style={{ left: `${((i + 1) / 14) * 100}%` }} />
                ))}
                {CAL_BARS.map((bar) => (
                  <Fragment key={bar.label}>
                    <span aria-hidden="true" className="absolute h-[6px] bg-brand-purple" style={{ left: `calc(${bar.left}% + 4px)`, width: `calc(${bar.width}% - 8px)`, top: bar.y }} />
                    <span className="absolute whitespace-nowrap font-mono text-[10px] text-brand-purple" style={{ left: `calc(${bar.left}% + 4px)`, top: bar.y + 9 }}>{bar.label}</span>
                  </Fragment>
                ))}
                {CAL_DOTS.map((dot) => (
                  <Fragment key={dot.label}>
                    <span aria-hidden="true" className="absolute h-[6px] w-[6px] rounded-full bg-brand-gold" style={{ left: `calc(${((dot.day - 0.5) / 14) * 100}% - 3px)`, top: 96 }} />
                    <span className="absolute whitespace-nowrap font-mono text-[10px] text-brand-purple" style={{ left: `calc(${((dot.day - 0.5) / 14) * 100}% + 7px)`, top: 92 }}>{dot.label}</span>
                  </Fragment>
                ))}
                {S12_LAYOUT.lines.map((r, j) => (
                  <span key={r.name} aria-hidden="true" className="absolute h-[6px] w-[6px] rounded-full bg-brand-gold" style={{ left: `calc(${((r.key + 0.5) / 14) * 100}% - 3px)`, top: 104 + j * 7 }} />
                ))}
              </div>
              <div className="flex items-center bg-bg-row px-2 py-1 border-y border-border">
                <span className="font-mono text-[10px] uppercase tracking-[0.20em] text-brand-amber">THE REAL DEADLINES</span>
              </div>
              {S12_LAYOUT.deadlines.map((r, j) => (
                <div key={r.name} className={`flex items-center gap-2 px-2 py-[5px] font-mono text-[10px] ${j < S12_LAYOUT.deadlines.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 rounded-full bg-brand-gold" />
                  <span className="whitespace-nowrap text-brand-purple">{r.name}</span>
                  <span className="overflow-hidden whitespace-nowrap text-text-faint">— {r.date}</span>
                </div>
              ))}
            </div>
          </div>

          <p className={`mt-8 lg:mt-12 ${DECK.statement}`}>Bars are things that last. Dots are things that happen.</p>
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>Twenty-five tools. Two windows!</p>

          <p className={`mt-2 ${DECK.statement}`}>Two windows over one set of rows is the blueprint. Today the calendar window is live in the cockpit; the ledger window fills as the posting pipe lands its lines.</p>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={DECK.q}>Can you watch one dollar run the whole machine?</p>
        </div>
      </section>

      {/* ── DECK-13 / THE THREADS (PR-S13-ALL-25) — the full sheet runs
            the eight beats: twenty-five lanes in PROBLEM_SHEET order
            (tools as rows, the slide-8 idiom), beats as columns, one
            DEAD-LEVEL arrow per lane through the column gaps (the
            slide-7 corridor idiom) with the head landing on YOU LOOK —
            twenty-five arrows, zero crossings by construction. Every
            cell derives as before; fourteen lanes throw a shadow,
            eleven run the loop and write none — that IS the teaching.
            The hero row carries the sale in its label; the hero
            bindings are unchanged so slide 14's law reads S13_LAYOUT
            untouched. Gold only via GoldSegments. */}
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
            {`One ${S13_LAYOUT.amount} sale runs the machine.`}<br />Then every other door opens.
          </h2>

          {/* The three moves — real flow, no padding; labels faint. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is three moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span>{` Take one sale — the ${S13_LAYOUT.amount} sale from Step 10 — and run it down all eight beats.`}</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> Open every door — all twenty-five tools — and run their records down the same eight beats.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> Watch where each lane throws a shadow: fourteen write lines; eleven run the whole loop and write none.</p>

          <p className={`mt-10 lg:mt-[76px] ${DECK.rust}`}>SAME MACHINE, SAME EIGHT BEATS</p>
          <p className="mt-[6px] font-mono text-[10px] lg:text-[11px] text-text-faint">twenty-five of twenty-five — every lane reaches YOU LOOK; eleven write no lines.</p>

          {/* THE THREADS, desktop (PR-S13-ALL-25) — the tool gutter,
              eight beat columns, level arrows in the gaps. */}
          <div className="relative mt-[14px] hidden lg:mt-[18px] lg:block" style={{ height: S13_H, maxWidth: S13_GEOM.W }}>
            <div className="absolute left-0 top-0 border border-border bg-white" style={{ width: `${(S13_GEOM.G_W / S13_GEOM.W) * 100}%` }}>
              <div style={{ height: S13_GEOM.HEAD }} className="flex items-center overflow-hidden bg-bg-row px-[6px] font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint border-b border-b-border">THE SHEET</div>
              {S13_LAYOUT.lanes.map((lane, i) => (
                <div key={lane.tool} style={{ height: S13_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[6px] font-mono text-[7px] leading-[10px] text-brand-purple ${i < S13_LAYOUT.lanes.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                  <span><GoldSegments segments={lane.label} /></span>
                </div>
              ))}
            </div>
            {S13_BEATS.map(([tag, beat], s) => (
              <div key={beat} className="absolute top-0 border border-border bg-white" style={{ left: `${(S13_LAYOUT.colXs[s] / S13_GEOM.W) * 100}%`, width: `${(S13_GEOM.COL_W / S13_GEOM.W) * 100}%` }}>
                <div style={{ height: S13_GEOM.HEAD }} className="flex flex-col justify-center gap-[1px] overflow-hidden bg-bg-row px-[6px] border-b border-b-border">
                  <span className="font-mono text-[7px] text-text-faint">{tag}</span>
                  <span className="font-mono text-[7px] leading-[9px] uppercase tracking-[0.1em] text-text-faint">{beat}</span>
                </div>
                {S13_LAYOUT.lanes.map((lane, i) => (
                  <div key={lane.tool} style={{ height: S13_GEOM.ROW_H }} className={`flex items-center overflow-hidden px-[6px] ${i < S13_LAYOUT.lanes.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`}>
                    <span className={`font-mono text-[7px] leading-[10px] ${lane.cells[s].faint ? 'text-text-faint' : 'text-brand-purple'}`}>
                      <GoldSegments segments={lane.cells[s].segs} />
                      {lane.cells[s].tag && <span className="text-text-faint"> {lane.cells[s].tag}</span>}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <svg viewBox={`0 0 ${S13_GEOM.W} ${S13_H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-brand-purple">
              <defs>
                <marker id="s13-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {S13_LAYOUT.lanes.map((lane) => (
                <g key={lane.tool}>
                  {S13_BEATS.map((beat, s) => (
                    <path key={beat[1]} d={`M${s === 0 ? S13_GEOM.G_W : S13_LAYOUT.colXs[s - 1] + S13_GEOM.COL_W} ${lane.y} H${S13_LAYOUT.colXs[s]}`} stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" fill="none" markerEnd={s === S13_BEATS.length - 1 ? 'url(#s13-arrow)' : undefined} />
                  ))}
                </g>
              ))}
            </svg>
          </div>

          {/* THE THREADS, mobile (PR-S13-ALL-25) — twenty-five cards in
              sheet order, the eight beats as label → value lines; no
              arrows. */}
          <div className="mt-[14px] lg:hidden">
            {S13_LAYOUT.lanes.map((lane) => (
              <div key={lane.tool} className="mt-3 border border-border bg-white px-3 py-[10px] first:mt-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-purple"><GoldSegments segments={lane.label} /></p>
                {S13_BEATS.map(([tag, beat], bi) => (
                  <p key={beat} className="mt-[6px] font-mono text-[10px] leading-[1.5]">
                    <span className="text-text-faint">{tag} · {beat} — </span>
                    <span className={lane.cells[bi].faint ? 'text-text-faint' : 'text-brand-purple'}>
                      <GoldSegments segments={lane.cells[bi].segs} />
                      {lane.cells[bi].tag && <span className="text-text-faint"> {lane.cells[bi].tag}</span>}
                    </span>
                  </p>
                ))}
              </div>
            ))}
          </div>

          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>Nobody typed a debit anywhere in this story!</p>

          <p className={`mt-[22px] lg:mt-8 ${DECK.trio}`}>Read the no-line lanes twice! Eleven tools run the loop — and the project lane runs it all the way to a match — writing zero lines, because no money moved. The loop is bigger than money; money is just the loops that get a shadow.</p>
          {/* PR-VOICE: the two truths — truth (1) derives its account
              words from the rule book. */}
          <p className={`mt-[14px] ${DECK.statement}`}>Two more truths from this drawing:</p>
          <div className="mt-[10px] border-y border-border py-[14px]">
            <p className="font-mono text-[11px] leading-[1.6] lg:text-[12px] text-text-secondary">
              <GoldSegments segments={TRADE_CLOSE} />
            </p>
            <p className="mt-2 font-mono text-[11px] leading-[1.6] lg:text-[12px] text-text-secondary">{HOURS_TRUTH}</p>
          </div>
          <p className={`mt-[14px] ${DECK.statement}`}>Alive today: the travel match — card charges find their bookings and propose the match; you approve it. The project lane is wired end to end: a task lands for your review, and accepting it fires the build that answers it.</p>

          <div className={DECK.hairline} aria-hidden="true" />
          <p className={DECK.q}>Beautiful. But why should you believe any of it?</p>
        </div>
      </section>

      {/* ── DECK-14 / THE PROOF (PR-S14-DATAFLOW) — the reverse walk,
            derived and checked: one lane down the 13/14 connector (1px
            spine, 5×5 node per hop, the arrowhead landing on THE
            FINGERPRINT — the walk ends at the source). Seven hops,
            every record derived from the consts slides 11/12/10/09/08/03
            render from; the CHECK column renders the law's own list, and
            every check THROWS at build — the drawing can never show a
            false proof. Layer labels keep 14's gold-mono exception; gold
            in records only via GoldSegments (accounts, amounts, ids, the
            fingerprint). PROOF_WALK retired (Deck Law 7); PROOF_TRIO
            stays verbatim. Ends on the deck's closing LINE — 24px roman,
            deliberately NOT a question. */}
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

          {/* The three moves — real flow, no padding; labels faint. */}
          <p className={`mt-6 lg:mt-5 ${DECK.statement}`}>This step is three moves:</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(a)</span>{` Take one number off the screen — the ${S14_LAYOUT.amount} on "${S14_LAYOUT.question}" — and walk it backwards.`}</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(b)</span> At every layer, name the record it came from and the check that proves the hop: the line, the rule, the match, the document, the arrival.</p>
          <p className={`mt-2 lg:mt-0 lg:leading-[2] ${DECK.statement}`}><span className="font-mono text-text-faint">(c)</span> End at the fingerprint — the code made from the payload the moment it arrived. Recompute it: it still matches.</p>

          <p className={`mt-10 lg:mt-[76px] ${DECK.rust}`}>SEVEN HOPS BACK TO THE PROVIDER&apos;S WORDS</p>
          <p className="mt-[6px] font-mono text-[10px] lg:text-[11px] text-text-faint">seven of seven hops checked at build — a failed check is a failed build.</p>

          {/* THE PROOF, desktop (PR-S14-DATAFLOW) — the beat gutter, THE
              RECORD, THE CHECK; the connector overlay rides the fixed
              row pitch. */}
          <div className="relative mt-[14px] hidden lg:mt-[18px] lg:block" style={{ maxWidth: S14_GEOM.W, minHeight: S14_H }}>
            <div className="grid border-b border-border bg-bg-row" style={{ height: S14_GEOM.HEAD, gridTemplateColumns: `${(S14_GEOM.G_W / S14_GEOM.W) * 100}% ${(S14_GEOM.R_W / S14_GEOM.W) * 100}% minmax(0, 1fr)` }}>
              <span />
              <span className="flex items-center overflow-hidden pl-[10px] pr-2 font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint">THE RECORD</span>
              <span className="flex items-center overflow-hidden px-2 font-mono text-[7px] uppercase tracking-[0.14em] text-text-faint">THE CHECK</span>
            </div>
            {S14_LAYOUT.hops.map((hop, i) => (
              <div key={hop.layer} className={`grid bg-white ${i < S14_LAYOUT.hops.length - 1 ? 'border-b-[0.75px] border-b-text-faint' : ''}`} style={{ height: S14_GEOM.ROW_H, gridTemplateColumns: `${(S14_GEOM.G_W / S14_GEOM.W) * 100}% ${(S14_GEOM.R_W / S14_GEOM.W) * 100}% minmax(0, 1fr)` }}>
                <div className="flex flex-col justify-center gap-[2px] overflow-hidden px-2">
                  <span className="font-mono text-[7px] text-text-faint">{hop.tag}</span>
                  <span className="whitespace-nowrap font-mono text-[7px] uppercase tracking-[0.14em] text-brand-gold">{hop.layer}</span>
                </div>
                <div className="flex items-center overflow-hidden pl-[10px] pr-2">
                  <span className="font-mono text-[7px] leading-[10px] text-brand-purple"><GoldSegments segments={hop.record} /></span>
                </div>
                <div className="flex items-center overflow-hidden px-2">
                  <span className="font-mono text-[7px] leading-[10px] text-text-faint">{hop.check}</span>
                </div>
              </div>
            ))}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <span className="absolute w-px bg-border" style={{ left: `${((S14_GEOM.G_W + 2) / S14_GEOM.W) * 100}%`, top: S14_LAYOUT.hops[0].y, height: S14_LAYOUT.hops[S14_LAYOUT.hops.length - 1].y + 8 - S14_LAYOUT.hops[0].y }} />
              {S14_LAYOUT.hops.map((hop) => (
                <span key={hop.layer} className="absolute h-[5px] w-[5px] bg-brand-purple" style={{ left: `calc(${((S14_GEOM.G_W + 2) / S14_GEOM.W) * 100}% - 2px)`, top: hop.y - 2 }} />
              ))}
              <span className="absolute h-0 w-0 border-l-[3px] border-r-[3px] border-t-[5px] border-l-transparent border-r-transparent border-t-brand-purple" style={{ left: `calc(${((S14_GEOM.G_W + 2) / S14_GEOM.W) * 100}% - 3px)`, top: S14_LAYOUT.hops[S14_LAYOUT.hops.length - 1].y + 8 }} />
            </div>
          </div>

          {/* THE PROOF, mobile (PR-S14-DATAFLOW) — one card per hop in
              walk order; no arrows. */}
          <div className="mt-[14px] lg:hidden">
            {S14_LAYOUT.hops.map((hop) => (
              <div key={hop.layer} className="mt-3 border border-border bg-white px-3 py-[10px] first:mt-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em]"><span className="text-text-faint">{hop.tag} · </span><span className="text-brand-gold">{hop.layer}</span></p>
                <p className="mt-[6px] font-mono text-[10px] leading-[1.5]"><span className="text-text-faint">RECORD — </span><span className="text-brand-purple"><GoldSegments segments={hop.record} /></span></p>
                <p className="mt-[3px] font-mono text-[10px] leading-[1.5] text-text-faint">CHECK — {hop.check}</p>
              </div>
            ))}
          </div>

          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>Nothing between the screen and the provider&apos;s words was edited.</p>

          <div className={DECK.hairline} aria-hidden="true" />
          <div className="mt-[22px] lg:mt-8">
            {PROOF_TRIO.map((claim, i) => (
              <p key={claim} className={`${i === 0 ? '' : 'mt-3 lg:mt-[14px]'} ${DECK.trio}`}>{claim}</p>
            ))}
          </div>
          <p className={`mt-[22px] lg:mt-8 ${DECK.statement}`}>That is why you can believe the screen: every number walks back to its source — the exact words a provider sent, or the document you committed — and the rule that wrote the line.</p>
          <p className={`mt-2 ${DECK.statement}`}>Alive today: the fingerprint, on the rules and the audit log — every regulation pull is hashed the moment it lands, and the audit log hash-chains every entry it records; the citation re-check is written, but the hash it compares against is stored empty today, so it proves nothing yet. Today the money feeds land already parsed — no stored word-for-word payload, no fingerprint yet; the arrivals table that saves the provider&apos;s exact words and fingerprints them on arrival is the shape we&apos;re building.</p>
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

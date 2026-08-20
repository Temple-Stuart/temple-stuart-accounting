'use client';

/**
 * Landing (FD-1 → FD-1b → FD-1c → FD-1d) — the sales floor: hero → pillar
 * cards → the NINE-ROW module sheet → pricing-transparency band → footer, in
 * the house Bloomberg aesthetic (see FD-1c notes; zero new hex).
 *
 * FD-1d:
 *   • header/footer extracted to LandingHeader/LandingFooter (shared with the
 *     /modules pages); the CPA disclaimer now rides the shared footer;
 *   • descriptors import from the ONE source (src/lib/tabDescriptors.ts) —
 *     the FD-1 lockstep copy is dead;
 *   • pillar cards' "Explore →" targets the pillar's shareable info page
 *     (/modules/<id> — deck + honest access block), not the tab deep link;
 *   • the sheet lists ALL NINE pillars honestly: the four entitlement modules
 *     (TAB_PRICING data, availability-honest Select → direct checkout)
 *     PLUS the five free pillars as explicit Free rows — travel is free with
 *     NO account (its search/booking routes are public, middleware.ts:70-94);
 *     runway/routines/projects/content are free WITH a free account (their
 *     builders are auth-gated but carry no entitlement gate — isTabLocked
 *     wraps only the four, ML :259-262 — and no tier gate, tiers.ts
 *     TRUTH-LABELS :4-17). Free rows link Learn more → /modules/<id>.
 *
 * Card bullets remain the FD-1b verbatim deck-heading lifts (provenance in
 * the PILLAR_CARDS comment).
 *
 * LOBBY-DECK-1 (Alex's ruling — simpler page, less packed intel, fresh,
 * cellphone-friendly): the NINE PILLARS card grid + the MODULES sheet
 * consolidate into ONE slide deck — nine slides in the funnel order, each
 * carrying its pillar card's content (chip + descriptor + verbatim bullets)
 * AND its sheet row's truth (label, price-or-Free, the FD-1o cost summary,
 * the availability-honest Select/Learn-more — commerce wiring byte-identical).
 * CSS scroll-snap, no new deps. The hero's "Try it live" CTA became "See how
 * it works ↓" (scrollIntoView to the deck). The costs ▾ expanders and the
 * legend/footnote block no longer render here — the receipt machinery
 * (ModuleCostBreakdown + helpers) is PRESERVED unmounted below (exported;
 * HPW-1 consumes it); the transparency door is the one-line link under the
 * deck. transparencyLedger is untouched.
 *
 * FD-1i (the selection floor — Alex's seven rulings): the deck gains
 * checkboxes on the four PAID slides ("Add to plan" → a selection Set); the
 * bundle strip becomes a live CALCULATOR strip (0 selected = the bundle
 * pitch; 1 = single-select continue; 2+ = count + the honest sum ONLY when
 * every selected TAB_PRICING monthlyPrice exists — all five are null today,
 * so "prices shown at checkout" is the live default — vs the bundle line);
 * a visual regrade (existing token families only: brand-purple = paid,
 * brand-green = free, white opacities); and a second SUMMARY deck beneath —
 * every string lifted verbatim from the module decks (per-line provenance on
 * SUMMARY_BY_ID). (PR-ELEV-2b: the deck was cut in ELEV-2+3, then RESTORED
 * byte-faithfully from fec63b01 by Alex's ruling; the "Built on" card wall +
 * "Built in public" sections follow it.) PR-PRICE-3: /pricing is DISCONTINUED
 * — this deck is THE pricing surface. Select/Continue call the
 * checkout-entitlement flow directly (via GuestLanding's onBuyModule
 * account-first resume); multi-select is one checkout per module, starting
 * with the first selected, and the strip says so.
 *
 * DECKS-3 (three verbatim rulings): (1) the PILLARS deck is a VERTICAL STACK
 * of full-width mini heroes — its carousel mechanics died (PR-DECK-CLEAN-3:
 * each hero is internally TWO-COLUMN when it carries a demoImage — text
 * left, framed screenshot right); (2) the SELECTION
 * deck adopted the mini-hero glow-panel format but stays a horizontal snap
 * rail, each slide carrying the commerce (PR-DECK-CLEAN-1 re-cut the slide
 * to the 5-part scannable card: name, one line, checkmark fragments, price
 * slot, actions — the evicted prose lives on /modules/<id>); (3) NOTHING IS
 * FREE except the home-page travel search itself — every "Free…" access
 * label was reframed paid (claims stay gate-true; the PAID_* label prose
 * moved to /modules/<id> via modulePillars.ts accessNote, PR-DECK-CLEAN-1),
 * all NINE slides carry the checkbox, "Learn more" died, and Select's key
 * mapping comes from the REAL purchasable vocabulary (categoryKeys.ts:22-29 —
 * tab:travel + tab:operations exist; runway/routines/content have NO key →
 * availability-honest "Launching soon", never an invented key).
 * ENFORCEMENT of the paid framing (gates for the five former-free pillars)
 * is a separate ruled decision — no gate/tier/middleware line changes here.
 */

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
// PR-DECK-CLEAN-1: the card fragments' checkmark — lucide is the house icon
// vocabulary (TripHeader.tsx:16 already imports Check).
// PR-DECK-4CAT: the four category-tab icons join.
import { Plane, BookOpen, TrendingUp, Settings } from 'lucide-react';
// MERGED-02: the segment control + catalog table died with the merged
// section — ds.iconTab/DATA and LayoutGrid left with them. The four
// category icons stay: DECK_CATEGORIES is the ratified partition the
// stage's group tag reads.
// PERSONAS-2: the TAB_PRICING import retired with the Act-4 bundle bar —
// its last Landing consumer (pricingByKey/bundle). The pricing surface is
// /how-pricing-works (header link) until buy affordances return.
// MERGED-02: the shared pipe-phases config — the stage's step rail reads
// the SAME rows the in-app StageStrips render (landing/app lockstep by
// construction, pipePhases.ts's own contract).
import { PIPE_PHASES, type PipePhase, type PipePillarId } from '@/lib/pipePhases';
// WALKTHROUGH-STAGE (round-5): the truth-ledger data the Treatment-A stage
// renders — order-parallel to PIPE_PHASES (the a′ contract). The dev assert
// below fails LOUD on any drift between the two arrays' lengths.
import { WALKTHROUGH_LEDGER } from '@/lib/walkthroughLedger';
import { GLIMPSES } from '@/components/landing/glimpses';

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

interface PillarCard {
  id: string;
  label: string;
  /** TAB_DESCRIPTORS key — differs from `id` only for Runway, whose tab key
   *  is 'calendar' (ModuleLauncher.tsx TABS :126). */
  tab: string;
  /** PURCHASABLE entitlement key when one exists in the real vocabulary
   *  (categoryKeys.ts:22-29 TAB_ENTITLEMENT_KEYS — DECKS-3 added tab:travel
   *  + tab:operations). Absent = not yet sellable (runway/routines/content):
   *  the slide renders the availability-honest "Launching soon". A key may
   *  exist WITHOUT a TAB_PRICING display entry — the price line then falls
   *  back to "price shown at checkout". */
  entitlementKey?: string;
  /** LAND-MSG-1: ONE plain-English outcome line under the pillar name — the
   *  card's single subtitle (PR-DECK-CLEAN-1 structure slot 2). HARD RULE:
   *  every line is a REPHRASE of an already-verified claim — the per-line
   *  source cites are in the LAND-MSG-1 report. Zero new claims. */
  plain: string;
  /** PR-DECK-CLEAN-1 (Alex, vs resend/plaid/stripe pricing: "too much
   *  text"): CHECKMARK short fragments (aim ≤6 words; approved copy may
   *  exceed — PLAIN-SHOWCASE) — every fragment COMPRESSED
   *  from a pre-existing verified string (pricingModel.ts unlocks lines /
   *  the old deck bullets / the old PAID_* access labels; per-card
   *  provenance below). Zero new claims. The evicted long copy is preserved
   *  on /modules/<id> — the showcase decks already carry the old bullets and
   *  TAB_DESCRIPTORS verbatim, and the PAID_* specifics moved to
   *  modulePillars.ts accessNote. PR-DECK-CLEAN-2 (even-card ruling):
   *  EXACTLY 3 per card — the trimmed 4th fragments stay preserved at the
   *  same /modules/<id> destinations (cut list in the provenance below). */
  bullets: string[];
}

// PR-DECK-CLEAN-1: the PAID_* access labels left the deck. Their claims
// survive, verified unchanged (FD-1o gate cites): Travel's framing already
// lives on /modules/travel (ModulePageClient travel branch); the
// Runway/Routines/Projects/Content specifics moved VERBATIM (minus the
// duplicated "A paid module —" lead the module page already states) to
// modulePillars.ts accessNote, rendered in each page's paid block.

// PR-DECK-4CAT: the module category tabs — a fixed PARTITION of the nine
// PILLAR_CARDS ids (every id appears in exactly one MODULE category; verified
// in the DECK-4CAT report). The active tab mounts ONLY its moduleIds cards,
// in this order, as a static grid — the persona-filtered carousel retired.
// DECK-SERVICES-TAB: 'services' is EXEMPT from the partition BY DESIGN —
// empty moduleIds; its tab renders the professional-services panel, not
// module cards (the deck's done-for-you bar absorbed here).
const DECK_CATEGORIES = [
  { key: 'travel',     label: 'Travel',     icon: Plane,      moduleIds: ['travel'] },
  { key: 'accounting', label: 'Accounting', icon: BookOpen,   moduleIds: ['books', 'runway', 'tax'] },
  { key: 'trading',    label: 'Trading',    icon: TrendingUp, moduleIds: ['trade'] },
  { key: 'operations', label: 'Operations', icon: Settings,   moduleIds: ['projects', 'routines', 'content', 'compliance'] },
  // LANDING-V2: the services tab left the deck (spec :323-327) — the panel
  // lives in section 04's DONE-FOR-YOU seat now.
] as const;

// MODULE-ORDER: the canonical order — Alex's lifecycle ruling (plan →
// execute → book → prove → settle → know → tell): routines, projects,
// travel, trade, books, compliance, tax, runway, content — numbered 01-09
// by ARRAY INDEX everywhere (spine marks, chips, stage kicker all derive;
// no stored number). Ids and /modules/<id> routes unchanged. (Supersedes
// the funnel order; moduleBands.ts nums + ModuleLauncher TABS move in
// lockstep this PR.) PR-DECK-CLEAN-1 fragment provenance — every
// bullet is a compression of ONE pre-existing verified string, zero new
// claims (the old FD-1o / FD-1h gate cites carry over with each source;
// provenance listed per module, not in display order):
//   Travel:     ruled plain-language pass (PR-SLIDE-TRAVEL-REAL) — Alex's
//               approved copy, not lift-quotes. The claims behind each
//               bullet stay the verified ones: free public search
//               (middleware-verified routes), bookings persist to the trip
//               (flights/book/route.ts:201), planned-vs-actual budget lens
//               (TripBudgetActual.tsx)
//   Runway:     b1 ← RunwayShowcaseSections.tsx:345 headline fragment;
//               b2+b3 ← FD-1h claim "Burn broken out by Personal vs.
//               Business — strays surfaced, never dropped" (runway/route.ts
//               :146-171)
//   Books:      b1+b2 ← pricingModel.ts tab:books unlocks fragments;
//               b3 ← TabShowcases.tsx:296 verbatim
//   Trade:      b1+b2 ← pricingModel.ts tab:trade unlocks fragments;
//               b3 ← TabShowcases.tsx:148 ("Eighteen real controls.
//               Sixteen strategies.")
//   Tax:        b1-b3 ← pricingModel.ts tab:tax unlocks fragments
//   Compliance: b1-b3 ← pricingModel.ts tab:compliance unlocks fragments
//   Routines:   b1-b3 ← RoutinesShowcaseSections.tsx :367, :391, :398
//   Projects:   b1 ← ProjectsShowcaseSections.tsx:271 ("Goals in. Audited
//               tasks out."); b2+b3 ← old PAID_PROJECTS ("the AI planning
//               pipeline, capped at 20 runs/day")
//   Content:    b1 ← ContentShowcaseSections.tsx:229 verbatim; b2 ← :260
//               fragment; b3 ← old PAID_CONTENT ("AI script generation is
//               a paid feature")
// PR-DECK-CLEAN-2 cuts (exactly-3 ruling) — each cut fragment's claim stays
// preserved where DECK-CLEAN-1 already parked the full copy:
//   Runway     − "Numbers from your ledger"      → /modules/runway accessNote
//   Books      − "Reconciliation & period close" → tab:books unlocks,
//                rendered on /modules/books ("Unlocks …")
//   Trade      − "Trade cards + reconcile queue" → tab:trade unlocks,
//                rendered on /modules/trade
//   Tax        − "Schedule C/D/SE"               → tab:tax unlocks,
//                rendered on /modules/tax
//   Compliance − "Missions & tasks"              → tab:compliance unlocks,
//                rendered on /modules/compliance
//   Routines   − "AI scene enrichment (paid)"    → /modules/routines
//                accessNote
//   Content    − "Day log & planning"            → /modules/content
//                accessNote
const PILLAR_CARDS: PillarCard[] = [
  {
    id: 'routines', label: 'Routines', tab: 'routines',
    plain: 'Set up a habit once — it lands on your calendar and your budget.',
    bullets: [
      'Build once, shows up everywhere',
      'Executable steps you actually run',
      'What’s due, done, slipped',
    ],
  },
  {
    id: 'projects', label: 'Projects', tab: 'projects', entitlementKey: 'tab:operations',
    plain: 'Type a goal — get a plan you can actually run.',
    bullets: [
      'Goals in, audited tasks out',
      'AI planning pipeline',
      'Capped at 20 runs/day',
    ],
  },
  {
    id: 'travel', label: 'Travel', tab: 'travel', entitlementKey: 'tab:travel',
    plain: 'Search, book, and budget your trips in one place.',
    bullets: [
      'Search and book — no account needed',
      'Every booking saves to your trip',
      'See planned vs. what you really spent',
    ],
  },
  {
    id: 'trade', label: 'Trade', tab: 'trade', entitlementKey: 'tab:trade',
    plain: 'Find trades worth taking — and get told when to skip.',
    bullets: [
      'Scanner on live market data',
      'Trading journal & realized P&L',
      'Eighteen controls, sixteen strategies',
    ],
  },
  {
    id: 'books', label: 'Books', tab: 'books', entitlementKey: 'tab:books',
    plain: 'Know where every dollar went — synced straight from your bank.',
    bullets: [
      'Plaid bank sync',
      'Double-entry journal & ledger',
      'Hand your CPA a package',
    ],
  },
  {
    id: 'compliance', label: 'Compliance', tab: 'compliance', entitlementKey: 'tab:compliance',
    plain: 'Every number keeps its receipt — proof you can show later.',
    bullets: [
      'Regulatory corpus search',
      'Citation verification',
      'Tamper-evident audit registry',
    ],
  },
  {
    id: 'tax', label: 'Tax', tab: 'tax', entitlementKey: 'tab:tax',
    plain: 'Your return builds itself from your records.',
    bullets: [
      '1040 estimate from closed books',
      'Wash sales + Form 8949',
      'CPA export',
    ],
  },
  {
    id: 'runway', label: 'Runway', tab: 'calendar',
    plain: 'See how many months your money lasts.',
    bullets: [
      'Every system you’re juggling',
      'Burn: Personal vs. Business',
      'Strays surfaced, never dropped',
    ],
  },
  {
    id: 'content', label: 'Content', tab: 'content',
    plain: 'Turn what you did today into a ready-to-film script.',
    bullets: [
      'Your day becomes the script',
      'Every step: shot, question, purpose',
      'AI script generation (paid)',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// REPLACED_APPS — the 25 apps this product replaces, grouped into six
// families. DELIBERATELY SEPARATE from PILLAR_CARDS and never coupled to it:
// that list is the nine modules we BUILD (products, ids, entitlement keys, the
// stage's data source); this one is what a user is REPLACING. The two
// vocabularies answer different questions and must be free to diverge — no
// shared type, no derived count, no cross-reference.
// Numbering is 01–25 CONTINUOUS across families, derived at render from
// FAMILY_OFFSETS below — never a retyped literal.
// ─────────────────────────────────────────────────────────────────────────
interface ReplacedAppFamily {
  /** Family label — rendered uppercase via CSS, never a retyped string. */
  family: string;
  /** App names in display order; the array's own length feeds the numbering. */
  apps: string[];
}

const REPLACED_APPS: ReplacedAppFamily[] = [
  { family: 'The Work', apps: ['Calendar', 'Tasks', 'Time'] },
  { family: 'Money In', apps: ['CRM', 'Contracts', 'Invoicing', 'Payments'] },
  { family: 'Money Out', apps: ['Bill Pay', 'Payroll', 'Expenses', 'Travel', 'Mileage', 'Budget'] },
  { family: 'What You Own', apps: ['Banking', 'Fixed Assets', 'Retirement', 'Brokerage', 'Trade Log'] },
  { family: 'What You Owe', apps: ['Debt', 'Sales Tax', 'Entity Filings'] },
  { family: 'The Proof', apps: ['Bookkeeping', 'Tax', 'Compliance', 'FP&A'] },
];

// Running index for the continuous 01–25 marks: each family's first app starts
// after every app in the families above it. Pure derivation from the array's
// own lengths — add or move an app and the numbering follows with no edit
// here. (Six families; the slice/reduce cost is nil and it stays obviously
// correct, unlike a mutating counter threaded through the render.)
const FAMILY_OFFSETS: number[] = REPLACED_APPS.map((_, i) =>
  REPLACED_APPS.slice(0, i).reduce((n, f) => n + f.apps.length, 0),
);

// PROBLEM-DIAGRAM: the six kinds of places money lives, for the 01 / THE
// PROBLEM diagram. ONE array because the diagram renders its labels TWICE —
// once per breakpoint SVG, each at its own absolute offsets — and the same
// six strings typed twice is exactly the drift the no-drift law forbids.
// Stored in sentence case; the mono lockup uppercases via CSS, never a
// retyped string. Intentionally NOT the six REPLACED_APPS family names as a
// shared symbol: the strip groups apps you replace, this names where money
// lives. They read alike today and must stay free to diverge.
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
// NOT COUPLED TO REPLACED_APPS, and deliberately not a shared symbol with it —
// the same reasoning as PROBLEM_SOURCES above. The strip groups the apps you
// replace; this names the twenty-five while they are still twenty-five separate
// things that do not talk. They enumerate the same concepts today and must stay
// free to diverge.
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

// PROBLEM-CAPTION: the two lines that sit under the sheet. They are rendered
// TWICE — on desktop INSIDE the sheet column, so they inherit the table's left
// edge, and on mobile under the stacked grids — so the strings live here once
// rather than being typed twice (the no-drift law). CAPTION-ANCHOR: the note
// used to be a lone <p> child of the section with no left offset at all, so it
// began at the page margin while A SPREADSHEET faked its alignment with a
// pl-[560px] hand-copied from the sheet's rect x. Both magic numbers are gone:
// on desktop the pair are simply children of the column the table fills.
const PROBLEM_SHEET_CAPTION = 'A spreadsheet';
const PROBLEM_SHEET_NOTE = 'As current as the last time you typed into it.';

// IMPORT-COLUMNS: the eleven columns of the raw import table, for the
// 02 / THE IMPORT slide. Four bands, each a heading plus its rows; a row is
// the tuple [name, holds, why], read positionally by the table that renders
// it. Order is the reading order of the slide and carries the argument —
// where it came from, what it is, what they actually sent, when and how far —
// so rows must never be sorted or regrouped for tidiness.
//
// fetched_at HAS NO WHY ON PURPOSE. Its empty string is content, not a gap
// waiting to be filled: the row pairs with received_at directly beneath it and
// the explanation belongs to the pair, not to either half. Do not invent copy
// for it.
//
// THE PAYLOAD ROW IS THE EMPHASIS of the slide and the renderer keys off its
// name, not a flag here, so that this stays plain data — one bolder cell is a
// presentation fact, not a property of the column. Its WHY is deliberately
// shouted in caps; that IS the copy, not a style to normalise away.
//
// NOT COUPLED TO ANYTHING EXISTING — not PROBLEM_SHEET, not REPLACED_APPS.
// The problem slide names the tools a business already runs; this names the
// columns of one table this product writes. They share no vocabulary and must
// stay free to diverge.
const IMPORT_COLUMNS = [
  {
    band: 'WHERE IT CAME FROM',
    rows: [
      ['provider', 'stripe · plaid · sec · fred', 'which system sent it'],
      ['connection_id', 'which connection of that system', 'you may have two banks'],
    ],
  },
  {
    band: 'WHAT IT IS',
    rows: [
      ['resource_type', 'payout · transaction · quote', 'their word for it'],
      ['external_id', 'po_1QmX8fK2', 'their id, so you never import it twice'],
      ['id', 'our own key', "theirs may collide with another feed's"],
    ],
  },
  {
    band: 'WHAT THEY ACTUALLY SENT',
    rows: [
      ['payload', 'the response, byte for byte', 'THE REASON THIS TABLE EXISTS'],
      ['payload_hash', 'a fingerprint of those bytes', 'proof you did not alter them'],
    ],
  },
  {
    band: 'WHEN AND HOW FAR',
    rows: [
      ['fetched_at', 'when you asked', ''],
      ['received_at', 'when it arrived', 'the gap matters when a feed lags'],
      ['parsed_at', 'when it was interpreted', 'null until step 3'],
      ['parse_status', 'pending · done · failed', 'you can replay a failure'],
    ],
  },
] as const;

// The name of the one row the import table emphasises. Named here rather than
// typed into the renderer so the emphasis and the data cannot drift apart.
const IMPORT_PAYLOAD_ROW = 'payload';

// IMPORT-ARRIVALS: four rows that actually landed, one per feed, as
// [provider, resource, external_id, received, parse]. The point of the table is
// that four unrelated kinds of thing — a payout, a card purchase, a stock quote
// and a filing — are the same shape, so the four providers must stay different
// from one another; replacing one with a second bank would lose the argument.
const IMPORT_ARRIVALS = [
  ['stripe', 'payout', 'po_1QmX8fK2', '09:14:02Z', 'done'],
  ['plaid', 'transaction', 'nkP9dLm4zQx7', '09:14:06Z', 'done'],
  ['tastytrade', 'quote', 'SPY-2026-02-19', '10:31:00Z', 'done'],
  ['sec', 'filing', '0000320193-26-14', '11:02:44Z', 'pending'],
] as const;

// The slide's three closing sentences, each split [opening phrase, remainder].
// The split is a COLOUR boundary and nothing else — the opener is purple, the
// remainder faint, and neither half changes weight. Stored pre-split because
// the break points are editorial (they fall on the claim, not on a comma) and
// deriving them from punctuation would get them wrong.
const IMPORT_WHY_IT_MATTERS = [
  ['Nothing is ever edited.', 'A correction from the source is a new row, not a rewrite.'],
  ['Nothing is ever re-asked.', 'If a parser is wrong, you re-read these rows.'],
  ['Nothing is ever claimed.', 'The hash proves you stored what they sent — not that they were right.'],
] as const;

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
// Lines were chosen to NOT repeat the selection deck's PILLAR_CARDS bullets —
// the two decks tell different halves of each pillar's story.
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

// LANDING-04-CAPTIONS: the SECOND caption line under each section-04 frame —
// what that module hands to the rest of the platform, in plain language (a
// reader with a bank account and no accounting background follows every line).
// Keyed by PILLAR_CARDS id, the section's own map key. The FIRST caption line
// is deliberately NOT here: it is the card's existing `plain` string, rendered
// straight from PILLAR_CARDS (the source moduleBands.ts copies byte-for-byte
// per its own header — the two were verified identical for all nine this PR),
// so no headline copy is duplicated or retyped anywhere.
const FRAME_LINKS: Record<string, string> = {
  travel: 'Every booking lands in your budget and on your calendar — automatically.',
  runway: 'Reads what you planned and what you actually spent. The number moves as you live.',
  books: 'Real transactions, real double-entry. Feeds Runway and Tax.',
  trade: 'Every trade lands in your books.',
  tax: 'Derived from your closed books — not typed.',
  compliance: 'The audit trail writes itself.',
  routines: 'Bills stop ambushing you.',
  projects: 'With a price tag, on your calendar.',
  content: 'Your calendar tells the story.',
};

// PERSONAS-3 → PERSONAS-PAYOFFS (round-5): each row = the hook question +
// ONE plain-language outcome sentence + the spec's payoff sentence (the
// final plain segment per row — extracted PROGRAMMATICALLY from the
// Desktop-1440 mock's personas region, whose paragraphs were verified to
// START byte-exactly with the shipped sentences; the remainder IS the
// payoff — never retyped). Rows alternate prose and mono-purple module
// fragments (the ruled idiom: max two per row, mid-sentence; rows where no
// fragment reads naturally stay plain prose).
const PERSONAS: ReadonlyArray<{ label: string; segments: ReadonlyArray<{ text: string; mono?: true }> }> = [
  { label: 'FOUNDER', segments: [
    { text: "Building a company? See how many months you've got, what the build is costing, and receipts for every dollar when investors ask." },
    { text: " When someone asks where the money went, the answer is one click." },
  ] },
  { label: 'TRADER', segments: [
    { text: 'Trading your own money? Every fill lands in your ' },
    { text: 'books', mono: true },
    { text: ', keeps its receipt, and shows up on your ' },
    { text: 'return', mono: true },
    { text: ' — you just trade.' },
    { text: " No April spreadsheet panic; it's been ready all year." },
  ] },
  { label: 'CREATOR', segments: [
    { text: 'Filming what you do? Your day plans your shoots, and your ' },
    { text: 'calendar', mono: true },
    { text: ' writes the script.' },
    { text: " More posting, less planning." },
  ] },
  { label: 'NOMAD', segments: [
    { text: 'Living out of a suitcase? Book the trip, and the budget, calendar, and ' },
    { text: 'books', mono: true },
    { text: ' update themselves — from anywhere.' },
    { text: " Change countries; your money system doesn't care." },
  ] },
  { label: 'SMALL BUSINESS OWNER', segments: [
    { text: "Running a small business? Know what came in, what went out, and what's left — without hiring a bookkeeper." },
    { text: " You see what an accountant would see, in plain words, every day." },
  ] },
  { label: 'STUDENT', segments: [
    { text: "First bank account? Learn where your money goes before it's gone — the app shows you how." },
    { text: " You'll pick up real accounting without ever taking the class." },
  ] },
];

// MERGED-02 (spec §6): the per-group rationale under the stage's group tag,
// keyed by DECK_CATEGORIES key (the ratified partition — the tag itself is
// the category's own label, uppercased by CSS, never retyped). Spec strings
// verbatim.
const GROUP_RATIONALE: Record<string, string> = {
  travel: 'Where money moves first.',
  accounting: 'The ledger is the spine — Books writes it, Runway and Tax read it.',
  trading: 'A money engine with receipts — every trade lands in your books.',
  operations: 'The life around the money, on the same calendar.',
};

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

// PERSONAS-2: entitlementAvailability + onBuyModule stay in Props — the
// FD-2 mount contract still passes them (page.tsx → GuestLanding, outside
// this PR's fence) — but Landing no longer consumes them: their last
// consumer (the Act-4 bundle bar) retired. The buy path returns with the
// next purchase affordance; until then only what's used is destructured.
// REAL-MARKS: logoAvailability is CONSUMED again — the marquee chips carry
// the lit-logo two-state render (the wall's own logic, relocated), so the
// server fs-check → availability → chip pipeline is live end to end.
// (entitlementAvailability/onBuyModule remain passed-but-unconsumed.)
export default function Landing({ onRequireAuth, onRequireLogin, logoAvailability }: Props) {
  // MERGED-02: the merged section's ONE piece of state — which module the
  // stage shows. Default runway (the spec's ruled tweak). PILLAR_CARDS ids
  // are exactly the PipePillarId vocabulary (canonical lifecycle order), so the
  // set-time cast at the chip is total.
  // (The retired deck state died with the section: categoryKey/deckCards
  // fed only the segment control + table; the FD-1i selection set —
  // selectedIds/toggleSelected/selectedPillars/selectedSum/selectedSellKeys
  // — fed only the calculator strip, which was already UNREACHABLE dead
  // code: toggleSelected's checkbox mounts retired with the card deck, so
  // selectedIds was permanently empty.)
  const [stageId, setStageId] = useState<PipePillarId>('runway');
  // WALKTHROUGH-STAGE: the rail's step index — CLICK-ONLY, user-paced (the
  // spec's interaction law). Module switch resets to step 01; the reset lives
  // in the chip handler alone, which is sufficient BY INVARIANT: autoplay can
  // only advance while userTookControl is false, and stepIndex can only leave
  // 0 via a rail click, which sets userTookControl — so autoplay never runs
  // over a user-chosen step.
  const [stepIndex, setStepIndex] = useState(0);

  // STAGE-AUTOPLAY: the tuning knob — ms each module holds the stage while
  // the auto-advance runs.
  const STAGE_AUTOPLAY_MS = 2000;
  // Autoplay machinery — refs, not state (pause/resume must not re-render).
  // The interval advances stageId through PILLAR_CARDS order from the
  // ratified 'runway' default, wrapping 09 → 01 (declared: the initial
  // state is unchanged, so the first paint is byte-identical to the static
  // stage and the reduced-motion path is flash-free — the interval simply
  // never starts, the merged section's motion-reduce contract in JS form
  // via the same media query the marquee's utilities consult).
  const userTookControl = useRef(false); // any chip activation → autoplay stops for good
  const stageHovered = useRef(false); // pointer over stage card / chip row → paused
  const stageInView = useRef(false); // IntersectionObserver: off-screen → paused
  const stageSectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // prefers-reduced-motion → never start; the stage stays static Runway.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // MOBILE-AUTOPLAY (390 audit finding 1, ruled): touch-class devices
    // reuse the SAME never-start path — the only mid-read pause input is
    // hover (onPointerEnter below), which (hover: none) devices can never
    // fire, so on a phone the stage would flip every 2s under the reader.
    // Static Runway instead; chip taps still switch stages (and still set
    // userTookControl — harmless with no interval running). Evaluated once
    // at mount, exactly like the reduced-motion line above. Desktop hover
    // machinery byte-unchanged.
    if (window.matchMedia('(hover: none)').matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      stageInView.current = entry.isIntersecting;
    });
    if (stageSectionRef.current) observer.observe(stageSectionRef.current);
    const interval = setInterval(() => {
      if (userTookControl.current || stageHovered.current || !stageInView.current) return;
      setStageId((prev) => {
        const i = PILLAR_CARDS.findIndex((p) => p.id === prev);
        return PILLAR_CARDS[(i + 1) % PILLAR_CARDS.length].id as PipePillarId;
      });
    }, STAGE_AUTOPLAY_MS);
    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  const stageIndex = PILLAR_CARDS.findIndex((p) => p.id === stageId);
  const stagePillar = PILLAR_CARDS[stageIndex];
  // Widened to the interface so the optional link (Trade's 06) type-checks
  // across the union of literal rows.
  // LANDING-TRADE-ORDER override — app strip rewires separately; delete this
  // when pipePhases.trade is reordered.
  const LANDING_TRADE_PHASES: readonly PipePhase[] = [
    { ...PIPE_PHASES.trade[0], num: '01', name: 'FILTER', subLabel: "Pick what you're hunting" },
    { ...PIPE_PHASES.trade[1], num: '02', name: 'SCAN', subLabel: 'Live market data runs your filters' },
    { ...PIPE_PHASES.trade[2], num: '03', name: 'REVIEW', subLabel: 'Trades worth taking — and the skips' },
    { ...PIPE_PHASES.trade[3], num: '04', name: 'QUEUE', subLabel: 'The card holds the prediction' },
    { ...PIPE_PHASES.trade[5], num: '05', name: 'COMMIT', subLabel: 'Every trade lands in your books' },
    { ...PIPE_PHASES.trade[4], num: '06', name: 'RECORD', subLabel: 'Wins and losses, written down' },
  ];
  const stagePhases: readonly PipePhase[] = stageId === 'trade' ? LANDING_TRADE_PHASES : PIPE_PHASES[stageId];
  // WALKTHROUGH-STAGE: the module's ledger + the active step's five clauses
  // (order-parallel; the module-scope assert guarantees the index is valid).
  const stageLedger = WALKTHROUGH_LEDGER[stageId];
  const stageStep = stageLedger.steps[stepIndex];
  const stageStepPhase = stagePhases[stepIndex];
  // The ratified partition (:186-188 — every pillar id appears in exactly
  // one category, verified): the find is total; the assertion states that
  // invariant, it is not a fallback.
  const stageCategory = DECK_CATEGORIES.find((c) => (c.moduleIds as readonly string[]).includes(stageId))!;

  // LOBBY-DECK-1b: the demo modal — only reachable when DEMO_VIDEO_URL is set
  // (the merged-section header button that opens it renders only then).
  const [showDemo, setShowDemo] = useState(false);

  // PERSONAS-MOBILE: below lg the persona rows collapse to a one-open-at-a-
  // time accordion — FOUNDER (index 0) open by default; tapping the open row
  // closes it. Desktop is untouched: the toggle renders as the inert label
  // (lg:pointer-events-none) and every sentence stays lg:block.
  const [openPersona, setOpenPersona] = useState<number | null>(0);

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

      {/* ── PROBLEM-01 / SIX-SOURCE DIAGRAM. Act grammar unchanged: the
            kicker, h2 and act padding are the previous section's classes
            verbatim, and the section still draws NO border — the modules
            section's border-y directly below closes the seam.

            GOLD RULING SUPERSEDED. The 2026-08-18 ruling ("the section's ONE
            gold moment"; "both problem-section questions render gold") is
            RETIRED together with the questions it governed. This act is
            deliberately colourless: the problem carries no accent, and gold
            first appears in the modules section below. Zero brand-gold here,
            by design — not an oversight.

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
      <section aria-label="The problem" className="max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px]">
        <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">01 / THE PROBLEM</p>
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
            {/* CAPTION-ANCHOR: children of the sheet column, so both lines start
                at the table's left edge with no offset of their own. */}
            <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-purple">
              {PROBLEM_SHEET_CAPTION}
            </p>
            <p className="mt-[10px] text-[15px] leading-[1.6] text-text-secondary">
              {PROBLEM_SHEET_NOTE}
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
            A SPREADSHEET caption's pl-[20px] still aligns to both and does not
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
        <p className="mt-2 pl-[20px] font-mono text-xs font-semibold uppercase tracking-[0.08em] text-brand-purple lg:hidden">
          {PROBLEM_SHEET_CAPTION}
        </p>
        <p className="mt-4 max-w-[680px] pl-[20px] text-[15px] leading-[1.6] text-text-secondary lg:hidden">
          {PROBLEM_SHEET_NOTE}
        </p>
        <p className="mt-6 text-[17px] lg:text-[20px] text-brand-purple">So what do these twenty-five actually give you?</p>
        <div className="mt-4 h-[30px] lg:h-10 w-px bg-border" aria-hidden="true" />
      </section>

      {/* ── IMPORT-02 / THE RAW IMPORT TABLE. Act grammar copied from the
            problem section above: same max-w-7xl container, same px, same
            pt-9 lg:pt-[60px] pb-9 lg:pb-[60px], and NO border — the modules
            section's border-y below still closes the seam.

            GOLD IS DELIBERATE HERE. The problem act is colourless by ruling
            and gold "first appears in the modules section below"; this slide
            now sits between them and takes gold for its four band labels, the
            FOUR ARRIVALS label and WHY IT MATTERS. That does not reopen the
            problem section's ruling — that ruling is about the problem act,
            which is still untouched and still colourless.

            EVERYTHING IS WEIGHT 400. No bold, no semibold, no medium anywhere
            in this act, which is why the header cells carry an explicit
            font-normal: Preflight does not reset the UA's `th { font-weight:
            bold }`, so a th without it would silently ship at 700.

            HORIZONTAL RULES ONLY. Neither table draws interior verticals —
            that is what makes them read calm — so cells set border-b and never
            border-r. border-separate + border-spacing-0 rather than the house
            border-collapse: collapsed borders are half-inside the box and make
            percentage column widths unpredictable, the same reason the problem
            sheet uses separate borders.

            BAND ROWS CARRY NO RULE BENEATH THEM. A band label hugs the group
            it introduces (24px above it, 9px below), so the rule that closes
            the previous group is the previous ROW's border-b, not the band's.
            The last data row of the table drops its border-b too — the table's
            own outer border closes it.

            TWO BAND CELLS, ONE PER BREAKPOINT. A single colSpan={3} band cell
            would force the table model to three columns even where the WHY
            column is display:none, leaving a phantom sliver on the right that
            the horizontal rules would stop short of. Rendering a colSpan={2}
            cell for mobile and a colSpan={3} cell for desktop keeps each
            breakpoint's table exactly as wide as its visible columns. The
            label string comes from IMPORT_COLUMNS either way, so the two
            cells cannot drift; the hidden one leaves the a11y tree with its
            display:none. ─────────────────────────────────────────────── */}
      <section aria-label="The import" className="max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px] pb-9 lg:pb-[60px]">
        <p className="font-mono text-[10.5px] lg:text-[10px] uppercase tracking-[0.12em] text-text-faint">02 / THE IMPORT</p>
        <h2 className="mt-[26px] text-[27px] leading-[1.2] lg:text-[38px] tracking-[-0.025em] text-brand-purple">
          Store what arrived.<br />Then decide what it means.
        </h2>
        <p className="mt-[22px] text-[13px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] text-text-secondary">
          One table. Every feed writes here first. Nothing is interpreted yet.
        </p>

        {/* TABLE 1 — the eleven columns. Three equal thirds on desktop; on
            mobile the WHY column is dropped entirely and the two that remain
            remeasure to 49.8%. Design authored 210/340/auto in a colgroup that
            the browser ignored — the equal thirds that rendered are what was
            approved, so table-fixed carries the widths and there is no
            colgroup to restore. */}
        <table className="mt-10 lg:mt-[76px] w-full table-fixed border-separate border-spacing-0 border border-border">
          <thead>
            <tr>
              <th scope="col" className="w-[49.8%] lg:w-[33.33%] bg-bg-row px-[11px] py-[9px] lg:px-5 lg:py-[13px] text-left align-top font-mono text-[10px] lg:text-[11px] font-normal uppercase tracking-[0.18em] text-text-faint border-b border-b-border">NAME</th>
              <th scope="col" className="w-[49.8%] lg:w-[33.33%] bg-bg-row px-[11px] py-[9px] lg:px-5 lg:py-[13px] text-left align-top font-mono text-[10px] lg:text-[11px] font-normal uppercase tracking-[0.18em] text-text-faint border-b border-b-border">WHAT IT HOLDS</th>
              <th scope="col" className="hidden lg:table-cell lg:w-[33.33%] bg-bg-row px-[11px] py-[9px] lg:px-5 lg:py-[13px] text-left align-top font-mono text-[10px] lg:text-[11px] font-normal uppercase tracking-[0.18em] text-text-faint border-b border-b-border">WHY</th>
            </tr>
          </thead>
          {IMPORT_COLUMNS.map((group, b) => (
            <tbody key={group.band}>
              <tr>
                <td colSpan={2} className="lg:hidden px-[11px] pt-[17px] pb-[7px] align-top font-mono text-[10px] uppercase tracking-[0.20em] text-brand-gold">{group.band}</td>
                <td colSpan={3} className="hidden lg:table-cell px-5 pt-6 pb-[9px] align-top font-mono text-[11px] uppercase tracking-[0.20em] text-brand-gold">{group.band}</td>
              </tr>
              {group.rows.map(([name, holds, why], r) => {
                const isPayload = name === IMPORT_PAYLOAD_ROW;
                const isLast = b === IMPORT_COLUMNS.length - 1 && r === group.rows.length - 1;
                // The payload row keeps its rule on desktop but drops it on
                // mobile, where its WHY follows as a second row that the two
                // must read as one block: same fill, no rule between.
                const rule = isLast ? '' : isPayload ? 'lg:border-b-[0.75px] lg:border-b-text-faint' : 'border-b-[0.75px] border-b-text-faint';
                const fill = isPayload ? 'bg-bg-row' : '';
                const pad = `px-[11px] py-[9px] lg:px-5 ${isPayload ? 'lg:py-[15px]' : 'lg:py-[11px]'}`;
                return (
                  <Fragment key={name}>
                    <tr>
                      <td className={`${pad} ${fill} ${rule} align-top font-mono text-[11.5px] lg:text-[14px] text-brand-purple`}>{name}</td>
                      <td className={`${pad} ${fill} ${rule} align-top font-mono text-[11px] leading-[1.4] lg:text-[13px] lg:leading-normal text-text-faint`}>{holds}</td>
                      <td className={`hidden lg:table-cell ${pad} ${fill} ${rule} align-top ${isPayload ? 'text-[18px] leading-[1.35] text-brand-purple' : 'text-[13.5px] leading-[1.45] text-text-faint'}`}>{why}</td>
                    </tr>
                    {isPayload && (
                      <tr className="lg:hidden">
                        <td colSpan={2} className={`${fill} border-b-[0.75px] border-b-text-faint px-[11px] pt-0 pb-[9px] align-top text-[13px] leading-[1.4] text-brand-purple`}>{why}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          ))}
        </table>

        <p className="mt-10 lg:mt-[76px] font-mono text-[10px] lg:text-[11px] uppercase tracking-[0.20em] text-brand-gold">FOUR ARRIVALS, ONE TABLE</p>

        {/* TABLE 2 — five equal columns; mobile keeps PROVIDER, RESOURCE and
            PARSE and drops EXTERNAL_ID and RECEIVED, the two that cannot
            shorten. No colSpan anywhere here, so the mobile table is exactly
            three columns wide. */}
        <table className="mt-[14px] lg:mt-[18px] w-full table-fixed border-separate border-spacing-0 border border-border">
          <thead>
            <tr>
              {([
                ['PROVIDER', false], ['RESOURCE', false], ['EXTERNAL_ID', true], ['RECEIVED', true], ['PARSE', false],
              ] as const).map(([head, lgOnly]) => (
                <th
                  key={head}
                  scope="col"
                  className={`${lgOnly ? 'hidden lg:table-cell lg:w-[20%]' : 'w-[33.33%] lg:w-[20%]'} bg-bg-row px-[11px] py-[9px] lg:px-5 lg:py-3 text-left align-top font-mono text-[10px] lg:text-[11px] font-normal uppercase tracking-[0.18em] text-text-faint border-b border-b-border`}
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {IMPORT_ARRIVALS.map((row, r) => (
              <tr key={row[2]}>
                {row.map((cell, c) => (
                  <td
                    key={cell}
                    className={`${c === 2 || c === 3 ? 'hidden lg:table-cell' : ''} px-[11px] py-[9px] lg:px-5 lg:py-[11px] align-top font-mono text-[11px] lg:text-[13px] ${c === 0 ? 'text-brand-purple' : 'text-text-faint'} ${r === IMPORT_ARRIVALS.length - 1 ? '' : 'border-b-[0.75px] border-b-text-faint'}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-[14px] lg:mt-5 text-[12px] lg:text-[14px] text-text-faint">
          A payout, a card purchase, a stock quote and an SEC filing. Same table.
        </p>

        <div className="mt-10 lg:mt-[76px] h-px w-full bg-border" aria-hidden="true" />
        <p className="mt-[22px] lg:mt-8 font-mono text-[10px] lg:text-[11px] uppercase tracking-[0.20em] text-brand-gold">WHY IT MATTERS</p>
        <div className="mt-[14px] lg:mt-5">
          {IMPORT_WHY_IT_MATTERS.map(([claim, rest], i) => (
            <p key={claim} className={`${i === 0 ? '' : 'mt-3 lg:mt-[14px]'} text-[13px] leading-[1.5] lg:text-[16.5px] text-text-faint`}>
              <span className="text-brand-purple">{claim}</span> {rest}
            </p>
          ))}
        </div>
        <div className="mt-8 lg:mt-12 h-px w-full bg-border" aria-hidden="true" />
        <p className="mt-[22px] lg:mt-9 text-[17px] lg:text-[28px] text-brand-purple">Now — what kind of thing is each one?</p>
      </section>

      {/* ── MERGED-02 (spec design-refs/merged-modules-spec.md §1-§6): the
            merged modules section — spine, personas, chips, ONE stage, foot —
            replacing the 02 catalog table and the 04 frame grid. id="modules"
            KEPT: the stable anchor the /pricing permanent redirect and the
            header's Modules link target. Geometry = the spec's px, verbatim;
            every hex in the spec's §0 maps to an existing token (border-light
            = #EBE4F7, ts-white = #FFFDF9 — nothing invented). Chip switching
            is local state (default runway, the ruled tweak); inactive stages
            are conditionally rendered, not kept mounted — static content, no
            survival contract (declared). Frames: the house plain-<img>
            convention (HotelGallery precedent — the override), object-contain
            at EVERY width including mobile (zero-information-loss law; the
            spec's §5 "may crop" is overridden). ─────────────────────────── */}
      <section id="modules" ref={stageSectionRef} className="w-full border-y border-border bg-bg-terminal">
        {/* HEADER — eyebrow (SECTION-SWAP → PROBLEM-01: the problem act
            leads as 01; the modules are 02, the demo 03) + the pricing
            right slot (:800-802 idiom, purple ink on cream now) + the 04
            h2/intro MOVED here verbatim (old :1120-1128). Act 1 flows from
            the header — no rule between (spec §1). */}
        <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-9 lg:pt-[60px]">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint">
              02 / THE NINE MODULES
            </p>
            <Link href="/how-pricing-works" className="font-mono text-xs lg:text-[10px] tracking-wider text-brand-purple hover:text-brand-purple-hover">
              HOW PRICING WORKS →
            </Link>
          </div>
          <h2 className="mt-[18px] text-[27px] lg:text-[38px] font-medium tracking-[-0.025em] text-brand-purple">
            The product, as it runs.
          </h2>
          <p className="mt-3 max-w-[680px] text-[17px] leading-[1.55] text-text-secondary">
            Everything you plan and everything you spend lands in one place — so it can tell you how long your money lasts.
          </p>
          {/* HERO-REPO-1 → MERGED-02: the demo trigger keeps its seat in this
              section's header. Honesty-gated on DEMO_VIDEO_URL — null renders
              nothing (null today, demoVideo.ts:11); config + modal untouched. */}
          {DEMO_VIDEO_URL !== null && (
            <button
              type="button"
              onClick={() => setShowDemo(true)}
              className="mt-3 inline-block bg-white px-4 py-1.5 text-xs font-medium text-brand-purple hover:bg-bg-row"
            >
              Watch the demo 🎥
            </button>
          )}
        </div>

        {/* ACT 1 — SPINE (spec §2): the six families of replaced apps → spine
            → the three words → the two dollar shapes → spine + gold square →
            the two hubs → the closing count. Families, app names and the
            CONTINUOUS 01–25 marks all derive from REPLACED_APPS +
            FAMILY_OFFSETS (index-derived padStart); uppercase is a CSS
            transform of the stored label, never a retyped string. */}
        <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-10 lg:pt-16 pb-12 lg:pb-[76px] text-center">
          <p className="font-mono text-xs lg:text-[10px] font-semibold tracking-[0.16em] text-text-muted">
            TWENTY-FIVE APPS <span className="text-brand-gold">·</span> ONE SPINE
          </p>
          {/* FAMILY ROWS. text-left overrides the act's text-center for THIS
              container only — every block below keeps the centre. @lg each row
              is the ACT 2 two-column idiom (:1003): a fixed label column + the
              app grid. BORDER-BOX NOTE: the label column carries no padding and
              no border, so its content box IS its border box and the measured
              186px transfers unchanged under Preflight; gap is between boxes in
              either model, so 40px transfers too. Apps: 2 equal columns at
              mobile, 6 equal columns @lg, row-major — a short family simply
              leaves its trailing cells empty (no stretch, no centring). */}
          <div className="mx-auto mt-5 lg:mt-[22px] max-w-[980px] text-left">
            {REPLACED_APPS.map((fam, f) => (
              <Fragment key={fam.family}>
                {f > 0 && <div className="h-px bg-border" aria-hidden="true" />}
                <div className="py-4 lg:grid lg:grid-cols-[186px_minmax(0,1fr)] lg:items-start lg:gap-x-10">
                  <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
                    {fam.family}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 lg:mt-0 lg:grid-cols-6">
                    {fam.apps.map((app, a) => (
                      <span key={app} className="flex items-baseline gap-1.5">
                        <span className="font-mono text-xs lg:text-[10px] text-text-faint">{String(FAMILY_OFFSETS[f] + a + 1).padStart(2, '0')}</span>
                        <span className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-purple">{app}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
          <div className="mx-auto mt-6 lg:mt-[26px] h-[30px] lg:h-10 w-px bg-border" aria-hidden="true" />
          <p className="mt-5 text-base text-text-secondary">Every app speaks the same three words —</p>
          <p className="mt-3 font-mono text-[16.5px] lg:text-2xl font-semibold tracking-[0.1em] lg:tracking-[0.16em] text-brand-purple">
            A DATE <span className="text-brand-gold">·</span> A TIME <span className="text-brand-gold">·</span> A DOLLAR
          </p>
          <p className="mt-3 text-base text-text-secondary">a time becomes a dollar two ways —</p>
          {/* The two dollar shapes: stacked full-width at mobile, two EQUAL
              columns @lg (1fr each — no measured width to convert). */}
          <div className="mx-auto mt-3 grid max-w-[680px] gap-3 lg:grid-cols-2">
            <div className="rounded border border-border bg-ts-white px-4 py-3">
              <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">A CADENCE</p>
              <p className="mt-1.5 text-base text-text-secondary">every month × the amount</p>
            </div>
            <div className="rounded border border-border bg-ts-white px-4 py-3">
              <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">A RATE</p>
              <p className="mt-1.5 text-base text-text-secondary">the hours × your rate</p>
            </div>
          </div>
          <p className="mt-3 text-base text-text-secondary">— and the app writes them into</p>
          <div className="mx-auto mt-5 h-6 lg:h-8 w-px bg-border" aria-hidden="true" />
          <div className="mx-auto h-[5px] w-[5px] bg-brand-gold" aria-hidden="true" />
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-3 lg:gap-6">
            <span className="border-b-4 border-brand-gold bg-brand-purple px-[18px] py-3 lg:px-[30px] lg:py-[15px] font-mono text-[12.5px] font-semibold tracking-[0.14em] text-ts-white">
              ONE LEDGER
            </span>
            <span className="border border-border bg-ts-white px-[18px] py-3 lg:px-[30px] lg:py-[15px] font-mono text-[12.5px] font-semibold tracking-[0.14em] text-brand-purple">
              ONE CALENDAR
            </span>
          </div>
          {/* The closing count — the eyebrow's own type idiom (:920) dropped to
              text-text-faint so it reads as the quiet last word, not a second
              heading. */}
          <p className="mt-8 lg:mt-10 font-mono text-xs lg:text-[10px] font-semibold tracking-[0.16em] text-text-faint">
            25 logins <span className="text-brand-gold">·</span> 25 passwords <span className="text-brand-gold">·</span> none of them talk to each other
          </p>
        </div>

        {/* ACT 2 — PERSONAS-3 (value cases): hook question + one outcome
            sentence per row; module-name fragments wear the mono purple
            idiom mid-sentence. Rows: border-light rules (§0's inner
            hairline — the exact #EBE4F7 token). The '·' in the act label
            wears gold — the Act 1 label's own separator idiom. */}
        <div className="w-full border-t border-border">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-10 lg:pt-[60px] pb-12 lg:pb-[68px]">
            <p className="text-center font-mono text-xs lg:text-[10px] font-semibold tracking-[0.16em] text-text-muted">
              SAME NINE MODULES <span className="text-brand-gold">·</span> DIFFERENT REASONS
            </p>
            <div className="mx-auto mt-5 max-w-[880px]">
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
                    <p className={`${open ? 'block' : 'hidden'} lg:block mt-1 text-[14.5px] text-text-primary lg:mt-0`}>
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

        {/* ACT 3 — THE MODULES: label row (right slot EMPTY — the honesty
            line retired; wrapper kept so the label keeps its seat), the nine
            chips (§3 states; Travel wears the gold LIVE ▪), the truth line
            (MOVED verbatim from old :865), and the ONE stage. Chips:
            contained horizontal scroll at mobile (§5 — the
            landing-mobile-viewport pattern), 9-col grid at desktop. */}
        <div className="w-full border-t border-border">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-10 lg:pt-[60px] pb-12 lg:pb-[76px]">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-mono text-xs lg:text-[10px] font-semibold tracking-[0.16em] text-text-muted">THE MODULES</p>
            </div>
            {/* STAGE-AUTOPLAY: pointer over the chip row pauses the advance
                (resumes on leave, while the user hasn't taken control). */}
            <div
              // CHIP-FADE (390 audit finding 2): ts-chipfade (globals.css) —
              // cream edge-fades signal the 6 off-screen chips; mobile pr-10
              // makes the fade zone pure padding at scroll-end (chip 09 never
              // fades) while the natural partial-chip peek at rest sits under
              // the right fade — the "there's more" signal. lg: unchanged
              // (all 9 chips fit; the mask turns off in the same media query).
              className="ts-chipfade -mx-4 mt-4 overflow-x-auto pl-4 pr-10 lg:mx-0 lg:overflow-visible lg:px-0"
              onPointerEnter={() => { stageHovered.current = true; }}
              onPointerLeave={() => { stageHovered.current = false; }}
            >
              <div role="group" aria-label="The nine modules" className="flex w-max gap-2 lg:grid lg:w-auto lg:grid-cols-9">
                {PILLAR_CARDS.map((p, i) => {
                  const active = stageId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        // STAGE-AUTOPLAY: manual selection (click or the
                        // button's native keyboard activation) takes control
                        // for good — the interval keeps ticking but never
                        // advances again.
                        userTookControl.current = true;
                        setStageId(p.id as PipePillarId);
                        setStepIndex(0); // WALKTHROUGH-STAGE: module switch → step 01

                      }}
                      className={`flex items-baseline justify-center gap-1.5 whitespace-nowrap border border-b-[3px] px-3 pt-[10px] pb-[9px] lg:px-2 lg:pt-[9px] lg:pb-2 font-mono text-xs lg:text-[10px] tracking-[0.06em] transition-colors ${
                        active
                          ? 'border-brand-purple border-b-brand-gold bg-brand-purple text-ts-white'
                          : 'border-border bg-ts-white text-text-secondary hover:bg-brand-purple-wash/40'
                      }`}
                    >
                      <span className={active ? 'text-white/60' : 'text-text-faint'}>{String(i + 1).padStart(2, '0')}</span>
                      {p.id === 'travel' && <span className="text-brand-gold" aria-hidden="true">▪</span>}
                      <span className="uppercase">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="mt-3 font-mono text-xs lg:text-[11px] text-text-muted">Search & book travel free today — no account needed. Paid modules are launching soon.</p>

            {/* THE STAGE (spec §4) — one card, all data from cited sources:
                bar kicker/status = the pillar seat + the deck's status
                conditional (old :911-916, reused verbatim); the frame img
                RETIRED with SUMMARY_BY_ID (Treatment A glimpses supersede);
                steps = PIPE_PHASES[id] (names as stored — the app's own
                strings) + WALKTHROUGH_LEDGER[id] (round-5 clauses);
                line 1 = PILLAR_CARDS[id].plain; line 2 =
                FRAME_LINKS[id]; group tag = DECK_CATEGORIES label (the
                ratified partition, :186-188) + §6 rationale. Trade's 06
                renders the link-chip STYLE but links /modules/trade like
                every Explore — selectTab doesn't exist on the landing
                (declared override). Mobile stack order (§5): bar → STEP
                LIST FIRST → frame → captions → group tag → Explore. */}
            {/* STAGE-AUTOPLAY: pointer over the stage card pauses too. */}
            <div
              className="mt-5 overflow-hidden rounded-lg border border-border bg-white"
              onPointerEnter={() => { stageHovered.current = true; }}
              onPointerLeave={() => { stageHovered.current = false; }}
            >
              <div className="flex flex-wrap items-baseline lg:items-center justify-between gap-3 border-b border-border px-[18px] py-2.5 lg:h-[37px] lg:py-0">
                <span className="font-mono text-xs lg:text-[10.5px] uppercase tracking-[0.05em] text-text-secondary">
                  {String(stageIndex + 1).padStart(2, '0')} / {stagePillar.label}
                </span>
                {stagePillar.id === 'travel' ? (
                  <span className="font-mono text-xs lg:text-[10.5px] font-semibold text-brand-purple">LIVE — FREE</span>
                ) : (
                  <span className="font-mono text-xs lg:text-[10.5px] tracking-[0.05em] text-text-muted">LAUNCHING SOON</span>
                )}
              </div>
              {/* WALKTHROUGH-STAGE (round-5, Treatment A — README §Stage
                  geometry + the Build-Spec anatomy; the mock's renderer DOM
                  mirrored: panelName/stepOf header, ›-joined strip cells,
                  glimpse surface, truth strip, 65px rail rows). UNIFORM
                  HEIGHT LAW @lg: body 550 = drawing 455 (pad 24 + header 20 +
                  gap 12 + strip 60 + gap 16 + glimpse 299) + rule + truth 94;
                  with bar 36 + Row C 130 + rules/borders the card is 720 for
                  EVERY module and EVERY step. The frame <img> retires FROM
                  THE STAGE (per-step glimpses supersede it — README note; the
                  svg files stay in public/demo). THIS PR renders the honest
                  placeholder glimpse (caption + the ledger's glimpse clause —
                  the mock's own to-follow pattern); per-step art lands in
                  follow-up PRs. Retired stage strings, declared: THE
                  PIPELINE / NN STEPS / A PREVIEW OF EXACTLY WHAT THE BUYER
                  SEES INSIDE (superseded by the walkthrough anatomy) + the
                  rail's Trade link-chip render (the chip still ships in the
                  in-app Trade strip via pipePhases). Mobile 390 (§ mobile):
                  STATIC — step 01 per module, rail rows non-interactive
                  (pointer-events gate); natural heights, rail first (the
                  shipped mobile order). */}
              <div className="grid grid-cols-1 lg:h-[550px] lg:grid-cols-[minmax(0,1fr)_400px]">
                {/* ── DRAWING AREA + TRUTH STRIP ── */}
                <div className="order-2 lg:order-none flex flex-col">
                  <div className="p-6 lg:h-[455px] lg:overflow-hidden">
                    {/* header 20 — the mock's panelName / stepOf row */}
                    <div className="flex items-baseline justify-between gap-3 lg:h-5">
                      <span className="font-mono text-xs lg:text-[15px] lg:leading-5 font-medium tracking-[0.3em] text-text-faint">{stagePillar.label.toUpperCase()}</span>
                      <span className="font-mono text-xs lg:text-[13px] lg:leading-5 tracking-[0.16em] text-text-faint">STEP {String(stepIndex + 1).padStart(2, '0')} OF {String(stagePhases.length).padStart(2, '0')}</span>
                    </div>
                    {/* strip cells 60 — ellipsis-guarded; the active cell alone carries the marker */}
                    <div className="mt-3 hidden items-stretch lg:flex lg:h-[60px]">
                      {stagePhases.map((ph, i) => (
                        <Fragment key={ph.num}>
                          {i > 0 && <span aria-hidden="true" className="self-center px-1 font-mono text-[11px] text-text-faint">›</span>}
                          <div className={`min-w-0 flex-1 border px-2 py-1.5 ${i === stepIndex ? 'border-brand-purple bg-brand-purple' : 'border-border bg-ts-white'}`}>
                            <div className={`font-mono text-[9.5px] tracking-widest ${i === stepIndex ? 'text-white/60' : 'text-text-faint'}`}>{ph.num}</div>
                            <div className={`truncate font-mono text-[11px] font-semibold uppercase tracking-wider ${i === stepIndex ? 'text-white' : 'text-text-secondary'}`}>{ph.name}</div>
                            {i === stepIndex && <div className="font-mono text-[9px] tracking-widest text-white/80">▪ YOU ARE HERE</div>}
                          </div>
                        </Fragment>
                      ))}
                    </div>
                    {/* glimpse surface 299 — GLIMPSE-ART staged rollout: a
                        module with drawn art (glimpses.tsx — Routines ×4 this
                        PR) renders it; every other module renders the staged
                        placeholder below (the mock's own to-follow pattern —
                        a VISIBLE staging state, not a silent fallback:
                        absence of art is the declared condition, and the
                        placeholder names the step it stands in for). */}
                    <div className="mt-4">
                      {GLIMPSES[stageId]?.[stepIndex] ?? (
                        <div className="relative flex min-h-[180px] flex-col items-center justify-center border border-border-light bg-bg-terminal px-6 py-8 text-center lg:h-[299px] lg:py-0">
                          {stageStep.inBuild && (
                            <span className="absolute right-3 top-3 rounded border border-border bg-bg-row px-1.5 font-mono text-xs lg:text-[10px] tracking-[0.1em] text-text-faint">IN BUILD</span>
                          )}
                          <p className="font-mono text-xs lg:text-[11px] font-semibold tracking-[0.16em] text-text-muted">{stagePillar.label.toUpperCase()} · {stageStepPhase.num} {stageStepPhase.name.toUpperCase()}</p>
                          <p className="mt-2 max-w-[420px] font-mono text-xs lg:text-[11px] leading-[1.6] text-text-faint">{stageStep.glimpse}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* truth strip 94 — grid 1fr · 1.3fr · 1fr */}
                  <div className="grid grid-cols-1 gap-3 border-t border-border px-6 py-3 lg:h-[94px] lg:grid-cols-[1fr_1.3fr_1fr] lg:gap-4 lg:overflow-hidden">
                    <div>
                      <div className="font-mono text-xs lg:text-[11px] lg:leading-[15px] font-semibold tracking-[0.1em] text-text-muted">YOU</div>
                      <p className="mt-1 text-xs lg:text-[12px] lg:leading-[17px] text-text-secondary">{stageStep.you}</p>
                    </div>
                    <div>
                      <div className="font-mono text-xs lg:text-[11px] lg:leading-[15px] font-semibold tracking-[0.1em] text-text-muted">THE APP</div>
                      <p className="mt-1 text-xs lg:text-[12px] lg:leading-[17px] text-text-secondary">{stageStep.app}</p>
                    </div>
                    <div>
                      <div className="font-mono text-xs lg:text-[11px] lg:leading-[15px] font-semibold tracking-[0.1em] text-brand-gold">→ FEEDS{stageStep.feeds.target !== null ? ` ${String(stageStep.feeds.target).padStart(2, '0')}` : ''}</div>
                      <p className="mt-1 text-xs lg:text-[12px] lg:leading-[17px] text-text-secondary">{stageStep.feeds.clause}</p>
                    </div>
                  </div>
                </div>
                {/* ── THE RAIL — 65px rows; click sets the step (and takes
                      control of autoplay: a click is a click, the shipped
                      law); active = purple fill + gold inset underline (zero
                      geometry change). [IN BUILD] chips per README §[IN
                      BUILD] (tokens: bg-bg-row/border-border/text-text-faint
                      = the spec's #F3EFE6/#DDD6E8/#7A7488; on-purple = the
                      white/.12-.3-.75 variant). Tax (7 rows = 455) leaves the
                      spacer at its 14px minimum by construction (flex-1
                      min-h-[14px]). ── */}
                <div className="order-1 lg:order-none flex flex-col border-b border-border lg:h-[550px] lg:overflow-hidden lg:border-b-0 lg:border-l">
                  {stagePhases.map((ph, i) => {
                    const st = stageLedger.steps[i];
                    const active = i === stepIndex;
                    return (
                      <button
                        key={ph.num}
                        type="button"
                        aria-pressed={active}
                        onClick={() => { userTookControl.current = true; setStepIndex(i); }}
                        className={`pointer-events-auto flex w-full flex-col justify-center border-t px-[18px] py-[11px] text-left lg:h-[65px] lg:py-0 ${
                          active
                            ? 'border-brand-purple bg-brand-purple [box-shadow:inset_0_-3px_0_0_#B8860B]'
                            : 'border-border-light hover:bg-brand-purple-wash/40'
                        }`}
                      >
                        <span className={`text-[15px] leading-[22px] font-medium ${active ? 'text-ts-white' : 'text-text-primary'}`}>
                          <span className={`font-mono text-xs lg:text-[11px] ${active ? 'text-white/60' : 'text-text-faint'}`}>{ph.num}</span>{' '}
                          {ph.name}
                          {st.inBuild && (
                            <span className={`ml-2 inline-block rounded border px-1.5 align-middle font-mono text-xs lg:text-[9px] tracking-[0.1em] ${active ? 'border-white/30 bg-white/10 text-white/75' : 'border-border bg-bg-row text-text-faint'}`}>IN BUILD</span>
                          )}
                        </span>
                        <span className={`mt-[3px] text-xs lg:text-[12px] lg:leading-[17px] ${active ? 'text-white/75' : 'text-text-muted'}`}>{st.teach}</span>
                      </button>
                    );
                  })}
                  <div className="min-h-[14px] flex-1" aria-hidden="true" />
                </div>
              </div>
              <div className="grid grid-cols-1 border-t border-border lg:h-[131px] lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
                <div className="p-[18px]">
                  <p className="text-[16.5px] font-medium leading-[1.4] text-text-primary">{stagePillar.plain}</p>
                  <p className="mt-1.5 text-[13px] leading-[1.6] text-text-muted">{FRAME_LINKS[stageId]}</p>
                </div>
                <div className="flex flex-col border-t border-border p-4 lg:border-t-0 lg:border-l lg:px-6">
                  <span className="self-start rounded border border-border px-2 py-0.5 font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                    {stageCategory.label}
                  </span>
                  <p className="mt-2 text-xs leading-[1.55] text-text-muted">{GROUP_RATIONALE[stageCategory.key]}</p>
                  <div className="flex-1" aria-hidden="true" />
                  <Link href={`/modules/${stageId}`} className="mt-3 font-mono text-xs lg:text-[11px] font-semibold tracking-[0.06em] text-brand-purple hover:text-brand-purple-hover">
                    EXPLORE →
                  </Link>
                </div>
              </div>
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
      {/* LANDING-V3: id="demo" — the spec's :93 anchor, the nav's Live-demo
          target. */}
      {/* DEMO-SECTION (390 audit finding 8): div → section + aria-label so
          the demo region is a real landmark (the census found it outside
          every section). Classes carried verbatim — Tailwind utilities are
          tag-agnostic and nothing selects div#demo (the #demo anchor is an
          href target only). */}
      <section id="demo" aria-label="Live demo — travel" className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* LANDING-V2 (spec :96-97) → SECTION-SWAP: the demo's numbered
            eyebrow row — 03 now (the problem act leads); label otherwise
            verbatim; right slot = the existing /modules/travel door. */}
        <div className="flex items-baseline justify-between gap-3 pt-6">
          <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint">03 / LIVE DEMO — TRAVEL</p>
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

      {/* ── LANDING-V4 (Alex's ruling, reversing the V2 seat): DONE-FOR-YOU is
            its own numbered section directly below the deck — eyebrow in the
            established grammar ('04 / DONE-FOR-YOU' after PROBLEM-01), no
            right slot. Body = the PROFESSIONAL SERVICES panel relocated
            WHOLESALE from the 05 grid (markup byte-identical inside), seated
            in the deck-table's white-card container idiom. SECTION-SWAP seam
            fix (the no-drop rule): the demo unit above carries no rules of
            its own — the hairline that used to close its area was the
            modules section's border-y bottom, which moved up with the swap —
            so this section takes border-t to keep one rule at the seam. ──── */}
      <section className="w-full border-y border-border bg-bg-terminal">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            04 / DONE-FOR-YOU
          </p>
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
      <section className="w-full border-b border-border bg-bg-terminal">
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

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
import { Fragment, useState } from 'react';
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
const SUMMARY_BY_ID: Record<string, {
  eyebrow: string;
  headline: string;
  lines: string[];
  demoImage?: { src: string; alt: string };
}> = {
  travel: {
    eyebrow: 'Travel — try it free, no account',
    headline: 'Search it. Price it. Book it. Free to look.',
    lines: [
      'Searching is always free.',
      'One trip holds everything — plans, bookings, budget.',
      'Every booking flows into your budget.',
    ],
    demoImage: { src: '/demo/travel.svg', alt: 'Illustration of the Travel pipeline: search, book, it lands in your budget' },
  },
  runway: {
    eyebrow: 'Runway — the whole platform, one question',
    headline: 'Every system you’re juggling. One question answered: how long can you keep going?',
    lines: [
      'Not a number you typed — the number your banks report.',
      'Your routines ARE the budget.',
      'Trading money ≠ living money. The wall is the feature.',
    ],
    demoImage: { src: '/demo/runway.svg', alt: 'Illustration of the Runway pipeline: money in, planned vs actual, months left' },
  },
  books: {
    eyebrow: 'Books — double-entry bookkeeping',
    headline: 'Every transaction becomes a journal entry. Every period must balance.',
    lines: [
      'Link your banks. Assign every account.',
      'The trial balance must balance.',
      'Closed means closed.',
    ],
    demoImage: { src: '/demo/books.svg', alt: 'Illustration of the Books pipeline: bank sync, categorize, double entry, reports' },
  },
  trade: {
    eyebrow: 'Trade — the scanner',
    headline: 'An entire index in full focus. One decision out.',
    lines: [
      'Every ticker scored. Strategies only where the gates pass.',
      'The whole trade, written down.',
      'The grades accumulate. Denominators first.',
    ],
    demoImage: { src: '/demo/trade.svg', alt: 'Illustration of the Trade pipeline: filters, scan, TRADE or SKIP verdicts, into your books' },
  },
  tax: {
    eyebrow: 'Tax — from closed books to a filed return',
    headline: 'Your books are already clean. Your taxes are half-done before you start.',
    lines: [
      'What others type in, your ledger already knows.',
      'Every income line traces to its source.',
      'Every lot boxed. Every box explained.',
    ],
    demoImage: { src: '/demo/tax.svg', alt: 'Illustration of the Tax pipeline: closed books, forms build, review, file' },
  },
  compliance: {
    eyebrow: 'Compliance — the receipts',
    headline: 'Don’t trust us. Verify us.',
    lines: [
      'A real regulatory corpus, on real schedules.',
      'The statute you cited is the statute you saw.',
      'Obligations tracked like engineering tickets.',
    ],
    demoImage: { src: '/demo/compliance.svg', alt: 'Illustration of the Compliance pipeline: every action, hashed, audit trail' },
  },
  routines: {
    eyebrow: 'Routines — the recurrence engine',
    headline: 'Build it once. It shows up everywhere.',
    lines: [
      'You describe the rhythm. The machine writes the schedule.',
      'The streak counts both ways.',
      'Feed one: every occurrence lands on the one calendar, priced.',
    ],
    demoImage: { src: '/demo/routines.svg', alt: 'Illustration of the Routines pipeline: set it once, calendar and budget, no surprises' },
  },
  projects: {
    eyebrow: 'Projects — the Truth Machine',
    headline: 'Goals in. Audited tasks out.',
    lines: [
      'A project starts as goals in your own words.',
      'Auto-generated work waits for your ✓.',
      'Every inference has a receipt.',
    ],
    demoImage: { src: '/demo/projects.svg', alt: 'Illustration of the Projects pipeline: type a goal, plan with a price tag, tasks on your calendar' },
  },
  content: {
    eyebrow: 'Content — day to script',
    headline: 'Your day becomes the script.',
    lines: [
      'The whole day, one feed.',
      'Inputs feed the map.',
      'Answer the day. Keep the record.',
    ],
    demoImage: { src: '/demo/content.svg', alt: 'Illustration of the Content pipeline: what you did, scenes, script' },
  },
};

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

// PERSONAS-3 (value cases): each row = the hook question + ONE plain-language
// outcome sentence — the module stacks and the "is your stack." grammar
// RETIRED (strings in git history). Rows alternate prose and mono-purple
// module fragments (the ruled idiom: max two per row, mid-sentence; rows
// where no fragment reads naturally stay plain prose).
const PERSONAS: ReadonlyArray<{ label: string; segments: ReadonlyArray<{ text: string; mono?: true }> }> = [
  { label: 'FOUNDER', segments: [
    { text: "Building a company? See how many months you've got, what the build is costing, and receipts for every dollar when investors ask." },
  ] },
  { label: 'TRADER', segments: [
    { text: 'Trading your own money? Every fill lands in your ' },
    { text: 'books', mono: true },
    { text: ', keeps its receipt, and shows up on your ' },
    { text: 'return', mono: true },
    { text: ' — you just trade.' },
  ] },
  { label: 'CREATOR', segments: [
    { text: 'Filming what you do? Your day plans your shoots, and your ' },
    { text: 'calendar', mono: true },
    { text: ' writes the script.' },
  ] },
  { label: 'NOMAD', segments: [
    { text: 'Living out of a suitcase? Book the trip, and the budget, calendar, and ' },
    { text: 'books', mono: true },
    { text: ' update themselves — from anywhere.' },
  ] },
  { label: 'SMALL BUSINESS OWNER', segments: [
    { text: "Running a small business? Know what came in, what went out, and what's left — without hiring a bookkeeper." },
  ] },
  { label: 'STUDENT', segments: [
    { text: "First bank account? Learn where your money goes before it's gone — the app shows you how." },
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
// BUILTON-MARQUEE: logoAvailability joins entitlementAvailability/onBuyModule
// as a Props field the FD-2 mount contract still passes but Landing no
// longer consumes — its last consumer (the wall's lit-logo check) retired
// with the card grid. Only what's used is destructured.
export default function Landing({ onRequireAuth, onRequireLogin }: Props) {
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
  const stageIndex = PILLAR_CARDS.findIndex((p) => p.id === stageId);
  const stagePillar = PILLAR_CARDS[stageIndex];
  const stageSummary = SUMMARY_BY_ID[stageId];
  // Widened to the interface so the optional link (Trade's 06) type-checks
  // across the union of literal rows.
  const stagePhases: readonly PipePhase[] = PIPE_PHASES[stageId];
  // The ratified partition (:186-188 — every pillar id appears in exactly
  // one category, verified): the find is total; the assertion states that
  // invariant, it is not a fallback.
  const stageCategory = DECK_CATEGORIES.find((c) => (c.moduleIds as readonly string[]).includes(stageId))!;

  // LOBBY-DECK-1b: the demo modal — only reachable when DEMO_VIDEO_URL is set
  // (the merged-section header button that opens it renders only then).
  const [showDemo, setShowDemo] = useState(false);

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
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 mb-6">
              {/* REPAINT-2: the pop glyph re-inks lavender — pop is invisible
                  on the aubergine band. */}
              <span className="text-brand-purple-wash" aria-hidden="true">✦</span>
              All-in-one financial operating system
            </div>
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
      {/* LANDING-V3: id="demo" — the spec's :93 anchor, the nav's Live-demo
          target. */}
      <div id="demo" className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* LANDING-V2 (spec :96-97): section 01's numbered eyebrow row —
            label verbatim; right slot = the existing /modules/travel door. */}
        <div className="flex items-baseline justify-between gap-3 pt-6">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">01 / LIVE DEMO — TRAVEL</p>
          <Link href="/modules/travel" className="font-mono text-[10px] tracking-wider text-brand-purple hover:text-brand-purple-hover">
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
            SUMMARY_BY_ID.travel.lines; NO ACCOUNT NEEDED is the spec's mono
            right slot). */}
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 pb-2">
          <span className="text-[13px] text-text-faint">One trip holds everything — plans, bookings, budget.</span>
          <span className="font-mono text-[10.5px] tracking-wider text-text-faint">NO ACCOUNT NEEDED</span>
        </div>
      </div>
      {/* PR-ELEV-1: the coming-soon tiles live INSIDE the strip above as
          badged "Soon" chips (travelStripModes) — the PR-LANDING-1 tile
          row below the strip is gone; the both-surfaces-at-once light-up
          ruling now holds at chip level via the shared builder. */}

      {/* ── BOOK-3: the guest's session trip — renders only when records
            exist (fail-honest empty state = nothing). ─────────────────────── */}
      <GuestTripStrip onRequireAuth={onRequireAuth} />

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
      <section id="modules" className="w-full border-y border-border bg-bg-terminal">
        {/* HEADER — eyebrow (spec §1: 02 / THE NINE MODULES) + the pricing
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

        {/* ACT 1 — SPINE (spec §2): marks → spine → the three words → spine +
            gold square → the two hubs. Marks/names derive from PILLAR_CARDS
            (canonical lifecycle order, index-derived padStart); uppercase is a CSS
            transform of the card label, never a retyped string. */}
        <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-10 lg:pt-16 pb-12 lg:pb-[76px] text-center">
          <p className="font-mono text-xs lg:text-[10px] font-semibold tracking-[0.16em] text-text-muted">
            NINE MODULES <span className="text-brand-gold">·</span> ONE SPINE
          </p>
          <div className="mx-auto mt-5 lg:mt-[22px] grid max-w-[340px] grid-cols-3 gap-y-2.5 lg:flex lg:max-w-none lg:flex-wrap lg:justify-center lg:gap-x-[26px]">
            {PILLAR_CARDS.map((p, i) => (
              <span key={p.id} className="flex items-baseline justify-center gap-1.5">
                <span className="font-mono text-xs lg:text-[10px] text-text-faint">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-purple">{p.label}</span>
              </span>
            ))}
          </div>
          <div className="mx-auto mt-6 lg:mt-[26px] h-[30px] lg:h-10 w-px bg-border" aria-hidden="true" />
          <p className="mt-5 text-base text-text-secondary">Every module speaks the same three words —</p>
          <p className="mt-3 font-mono text-[16.5px] lg:text-2xl font-semibold tracking-[0.1em] lg:tracking-[0.16em] text-brand-purple">
            A DATE <span className="text-brand-gold">·</span> A TIME <span className="text-brand-gold">·</span> A DOLLAR
          </p>
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
              {PERSONAS.map((row) => (
                <div key={row.label} className="border-t border-border-light py-3 first:border-t-0 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-baseline lg:gap-4">
                  <p className="font-mono text-xs font-semibold tracking-wider text-text-muted">{row.label}</p>
                  <p className="mt-1 text-[14.5px] text-text-primary lg:mt-0">
                    {row.segments.map((seg, i) =>
                      seg.mono ? (
                        <span key={i} className="font-mono text-[12.5px] font-semibold text-brand-purple">{seg.text}</span>
                      ) : (
                        <Fragment key={i}>{seg.text}</Fragment>
                      ),
                    )}
                  </p>
                </div>
              ))}
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
            <div className="-mx-4 mt-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
              <div role="group" aria-label="The nine modules" className="flex w-max gap-2 lg:grid lg:w-auto lg:grid-cols-9">
                {PILLAR_CARDS.map((p, i) => {
                  const active = stageId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStageId(p.id as PipePillarId)}
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
                conditional (old :911-916, reused verbatim); frame =
                SUMMARY_BY_ID[id].demoImage (plain <img>, object-contain —
                the override; absence-is-honest gate kept from old :1153);
                steps = PIPE_PHASES[id] (names as stored — the app's own
                strings); line 1 = PILLAR_CARDS[id].plain; line 2 =
                FRAME_LINKS[id]; group tag = DECK_CATEGORIES label (the
                ratified partition, :186-188) + §6 rationale. Trade's 06
                renders the link-chip STYLE but links /modules/trade like
                every Explore — selectTab doesn't exist on the landing
                (declared override). Mobile stack order (§5): bar → STEP
                LIST FIRST → frame → captions → group tag → Explore. */}
            <div className="mt-5 overflow-hidden rounded-lg border border-border bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-[18px] py-2.5">
                <span className="font-mono text-xs lg:text-[10.5px] uppercase tracking-[0.05em] text-text-secondary">
                  {String(stageIndex + 1).padStart(2, '0')} / {stagePillar.label}
                </span>
                {stagePillar.id === 'travel' ? (
                  <span className="font-mono text-xs lg:text-[10.5px] font-semibold text-brand-purple">LIVE — FREE</span>
                ) : (
                  <span className="font-mono text-xs lg:text-[10.5px] tracking-[0.05em] text-text-muted">LAUNCHING SOON</span>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
                <div className="order-2 lg:order-none aspect-[16/10] bg-bg-terminal">
                  {stageSummary.demoImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={stageSummary.demoImage.src} alt={stageSummary.demoImage.alt} className="h-full w-full object-contain" />
                  )}
                </div>
                <div className="order-1 lg:order-none flex flex-col border-b border-border px-6 pt-[22px] pb-4 lg:border-b-0 lg:border-l lg:py-[22px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-xs lg:text-[10px] font-semibold tracking-[0.14em] text-text-muted">THE PIPELINE</span>
                    <span className="font-mono text-xs lg:text-[10px] text-text-faint">{String(stagePhases.length).padStart(2, '0')} STEPS</span>
                  </div>
                  <div className="mt-2">
                    {stagePhases.map((ph) => (
                      <div key={ph.num} className="flex items-baseline border-t border-border-light py-[11px]">
                        <span className="w-[22px] shrink-0 font-mono text-xs lg:text-[11px] text-text-faint">{ph.num}</span>
                        {ph.link ? (
                          <Link href={`/modules/${stageId}`} className="flex items-baseline gap-2">
                            <span className="text-[15px] font-medium text-text-primary">{ph.name}</span>
                            <span className="inline-block rounded border border-border px-1.5 font-mono text-xs lg:text-[9px] tracking-widest text-brand-purple">{ph.link.label}</span>
                          </Link>
                        ) : (
                          <span className="text-[15px] font-medium text-text-primary">{ph.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="min-h-[14px] flex-1" aria-hidden="true" />
                  <p className="font-mono text-xs lg:text-[9.5px] tracking-[0.08em] text-text-faint">A PREVIEW OF EXACTLY WHAT THE BUYER SEES INSIDE</p>
                </div>
              </div>
              <div className="grid grid-cols-1 border-t border-border lg:grid-cols-[minmax(0,1fr)_400px]">
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

      {/* ── LANDING-V4 (Alex's ruling, reversing the V2 seat): DONE-FOR-YOU is
            its own numbered section directly below the deck — eyebrow in the
            established grammar ('03 / DONE-FOR-YOU' is the one new label), no
            right slot. Body = the PROFESSIONAL SERVICES panel relocated
            WHOLESALE from the 05 grid (markup byte-identical inside), seated
            in the deck-table's white-card container idiom. ────────────────── */}
      <section className="w-full border-b border-border bg-bg-terminal">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            03 / DONE-FOR-YOU
          </p>
          <div className="mt-4 rounded-lg border border-border bg-white p-5">
            <div className="mt-4">
              <span className="rounded border border-border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
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
            invented, none dropped. TEXT-ONLY: no images, no logo assets —
            the leaf's logo slots + marks rulings stay documented there but
            idle here (logoAvailability keeps flowing in Props for the FD-2
            mount contract; Landing no longer consumes it).
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
                  {BUILT_ON.map((e) => (
                    /* The group-tag/bundle mono chip idiom — name in mono
                       purple, the entry's own tag as the muted descriptor. */
                    <span
                      key={`${run}-${e.name}`}
                      className="flex items-baseline gap-1.5 whitespace-nowrap rounded border border-border bg-white px-3 py-1.5 font-mono text-xs"
                    >
                      <span className="font-semibold text-brand-purple">{e.name}</span>
                      <span className="text-text-muted">· {e.tag}</span>
                    </span>
                  ))}
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

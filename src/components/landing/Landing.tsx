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
import { LayoutGrid, Plane, BookOpen, TrendingUp, Settings } from 'lucide-react';
// PR-DECK-4CAT: the category tabs reuse the ToggleStrip icon-tab idiom
// (DS.iconTab — the trip.com tab form factor the booking strip wears).
// REPAINT-2 → REPAINT-3: cards are flat white/cream + hairline; the local
// iconTabLight twin was PROMOTED into ds.iconTab (REPAINT-3 — one tab idiom
// again), so the shared import returns.
import { DATA, iconTab } from '@/lib/ds';
import { TAB_PRICING } from '@/config/pricing-costs';
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
import { BUILT_ON, WALL_SECTIONS } from '@/lib/builtOnWall';

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

// Funnel order — Alex's ruling. PR-DECK-CLEAN-1 fragment provenance — every
// bullet is a compression of ONE pre-existing verified string, zero new
// claims (the old FD-1o / FD-1h gate cites carry over with each source):
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
    id: 'travel', label: 'Travel', tab: 'travel', entitlementKey: 'tab:travel',
    plain: 'Search, book, and budget your trips in one place.',
    bullets: [
      'Search and book — no account needed',
      'Every booking saves to your trip',
      'See planned vs. what you really spent',
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
    id: 'books', label: 'Books', tab: 'books', entitlementKey: 'tab:books',
    plain: 'Know where every dollar went — synced straight from your bank.',
    bullets: [
      'Plaid bank sync',
      'Double-entry journal & ledger',
      'Hand your CPA a package',
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
    id: 'tax', label: 'Tax', tab: 'tax', entitlementKey: 'tab:tax',
    plain: 'Your return builds itself from your records.',
    bullets: [
      '1040 estimate from closed books',
      'Wash sales + Form 8949',
      'CPA export',
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

// REPAINT-3: the local iconTabLight helper moved home to ds.iconTab
// (byte-identical ink) — imported above.

export default function Landing({ onRequireAuth, onRequireLogin, entitlementAvailability, logoAvailability, onBuyModule }: Props) {
  const pricingByKey = new Map(TAB_PRICING.map((t) => [t.key, t]));
  const bundle = pricingByKey.get('bundle:all');

  // PR-DECK-4CAT: category tab state (client only). The four fixed tabs
  // partition the nine cards; the active tab mounts ONLY its moduleIds
  // cards, in category order (the flatMap idiom kept from the retired
  // persona filter), laid out as a static grid — no rail, no scroll state.
  // DECK-TABLE: 'all' is the resting state — the full nine-row catalog
  // (declared addition); a category tab narrows the rows through the SAME
  // moduleIds wiring. Presentation state only — commerce wiring untouched.
  const [categoryKey, setCategoryKey] = useState('all');
  const category = DECK_CATEGORIES.find((c) => c.key === categoryKey);
  const deckCards =
    categoryKey === 'all'
      ? PILLAR_CARDS
      : (category?.moduleIds ?? []).flatMap((id) => PILLAR_CARDS.filter((p) => p.id === id));

  // LOBBY-DECK-1b: the demo modal — only reachable when DEMO_VIDEO_URL is set
  // (the hero button that opens it renders only then).
  const [showDemo, setShowDemo] = useState(false);

  // FD-1i → DECKS-3: the selection set is keyed by PILLAR ID now — ALL NINE
  // slides carry the checkbox (ruling 3). A selected pillar without a
  // sellable entitlement key still lists in the strip; only mappable keys
  // ride the Continue link (no invented keys, no fake checkout paths).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Stable PILLAR_CARDS order.
  const selectedPillars = PILLAR_CARDS.filter((p) => selectedIds.has(p.id));
  // The honest sum: ONLY when every selected pillar has a display price
  // (TAB_PRICING — all entries are null today, pricing-costs.ts:346-370, and
  // five pillars have no entry at all — so this stays null and the strip
  // renders "prices shown at checkout" until Alex enters prices).
  const selectedPrices = selectedPillars.map((p) =>
    p.entitlementKey ? pricingByKey.get(p.entitlementKey)?.monthlyPrice ?? null : null,
  );
  const selectedSum =
    selectedPillars.length > 0 && selectedPrices.every((v) => v !== null)
      ? selectedPrices.reduce((s, v) => (s as number) + (v as number), 0)
      : null;
  const selectedSellKeys = selectedPillars
    .map((p) => p.entitlementKey)
    .filter((k): k is string => typeof k === 'string');

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

            {/* HERO-PRESENCE → LANDING-V2 (spec :60): the three check chips
                compress to the spec's single mono row; the BSL + services
                mono blocks DELETED (BSL survives on the utility bar +
                section 04; services reseats in section 04). The ownership
                phrase survives as the row's tail — the session's
                spec-conflict ruling, adopted. Claims unchanged: no-card
                signup, LICENSE-true self-hosting, never-paywalled export
                (GET /api/export). Spec ink #9C90C2 → text-white/60. */}
            <div className="mt-6 font-mono text-[10px] tracking-wider text-white/60">
              NO CREDIT CARD · PRIVACY FIRST · SELF-HOSTABLE · YOU ALWAYS OWN YOUR LEDGER
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

      {/* ── LOBBY-DECK-1 → PR-DECK-CLEAN-1: the nine pillars as SCANNABLE
            cards, funnel order. Each slide = the 5-part structure and nothing
            else: name · one plain line · 3-4 checkmark fragments · the price
            slot (PRICE-1/2 states) · actions (availability-honest Select →
            direct checkout; Explore → /modules/<id>). PR-DECK-4CAT:
            navigation is 4 category tabs over a static grid — the
            scroll-snap rail, chevrons, and dots retired.
            HERO-REPO-1: the demo trigger mounts in this header. PR-PRICE-3:
            id="modules" — THE stable anchor the /pricing permanent redirect
            (and any deep link) targets; this deck IS the pricing surface. ──── */}
      <section id="modules" className="w-full border-b border-border bg-bg-terminal">
        {/* LANDING-V5 (Alex's ruling; spec :181-189): the 02 intro is a
            FULL-BLEED aubergine band — background:var(--purple) runs edge to
            edge with the content constrained inside (the hero/footer band
            pattern), replacing the REPAINT-2 rounded floater. Contents
            byte-identical: eyebrow, right slot, h2, the honesty-gated demo
            trigger. */}
        <div className="bg-brand-purple">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
            {/* LANDING-V2 (spec :184-185): the 02 eyebrow + the cream
                HOW PRICING WORKS right slot, on the aubergine band. */}
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
                02 / THE NINE PILLARS
              </p>
              <Link href="/how-pricing-works" className="font-mono text-[10px] tracking-wider text-ts-white hover:text-white">
                HOW PRICING WORKS →
              </Link>
            </div>
            <h2 className="mt-1 text-lg font-light tracking-tight text-white">
              Buy the modules you&apos;ll use. One, some, or all.
            </h2>
            {/* HERO-REPO-1: the demo trigger relocated here from the hero.
                Honesty-gated on DEMO_VIDEO_URL — null renders nothing (the
                deck is self-explanatory); non-null shows "Watch the demo 🎥"
                opening the existing modal (config + modal + youTubeEmbedUrl
                untouched — only the trigger's mount moved). */}
            {DEMO_VIDEO_URL !== null && (
              <button
                type="button"
                onClick={() => setShowDemo(true)}
                className="mt-2 inline-block bg-white px-4 py-1.5 text-xs font-medium text-brand-purple hover:bg-bg-row"
              >
                Watch the demo 🎥
              </button>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 lg:px-8 pb-10 pt-4">

          {/* PR-DECK-4CAT → DECK-TABLE: the category tab row — the
              ToggleStrip icon-tab idiom (DS.iconTab) above the catalog.
              A tab FILTERS the table rows below; the leading All tab
              (declared addition) is the default full-catalog view.
              Client state only — commerce wiring and selection state
              untouched. */}
          <div className="mt-4 grid grid-cols-3 justify-items-center gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:justify-center" role="group" aria-label="Module categories">
            <button
              type="button"
              onClick={() => setCategoryKey('all')}
              aria-pressed={categoryKey === 'all'}
              className={iconTab(categoryKey === 'all')}
            >
              <span aria-hidden="true" className={categoryKey === 'all' ? 'text-brand-purple' : undefined}>
                <LayoutGrid className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="w-min whitespace-normal text-center leading-tight">All</span>
            </button>
            {DECK_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategoryKey(c.key)}
                aria-pressed={categoryKey === c.key}
                className={iconTab(categoryKey === c.key)}
              >
                <span aria-hidden="true" className={categoryKey === c.key ? 'text-brand-purple' : undefined}>
                  <c.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="w-min whitespace-normal text-center leading-tight">
                  {c.label}
                </span>
              </button>
            ))}
          </div>

          {/* PRICE-1 (proposal c) → PR-DECK-4CAT: the ONE verified lead-in
              line — free-travel anchor + launching-soon truth, above the
              deck. STATIC now: the 'everyone' persona's string survives
              verbatim; the per-persona variants retired with the filter. */}
          <p className="mt-2 font-mono text-xs text-text-muted">Search & book travel free today — no account needed. Paid modules are launching soon.</p>

          {/* LANDING-V2 (spec :323-327): the SERVICES tab left the deck —
              the PROFESSIONAL SERVICES panel reseated in section 04 as the
              spec's DONE-FOR-YOU seat. The catalog renders unconditionally. */}
          {/* DECK-TABLE (Alex's ruling): the card grid became the Direction-C
             catalog table — the toggler FILTERS the rows (same moduleIds
             wiring, presentation state only). Copy is PILLAR_CARDS
             byte-exact (label + plain); STATUS carries the two ruled labels;
             the → column is the existing per-module Explore affordance,
             aria-labeled. SUPERSESSION (declared): the per-card Select /
             Add-to-plan bundle affordances retired with the cards — the
             bundle bar + calculator strip below survive byte-identical, and
             buy affordances return to rows when real prices exist. Table
             chrome = the DATA vocabulary (ds.ts) on cream: white card,
             lavender hairlines, zebra rows, wash hover. */}
          <div role="group" aria-label="The nine pillars" className="mt-4 overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                {/* LANDING-V3 (spec :194): the header row takes the token
                    fill — bg-bg-row (#F3EFE6, the closest token to the
                    spec's #F5F1E5; no new hex). */}
                <tr className="border-b border-border bg-bg-row text-left">
                  <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>No</th>
                  <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Module</th>
                  <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Category</th>
                  <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>In its own words</th>
                  <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Status</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Explore</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deckCards.map((p) => {
                  // The catalog number is the module's seat in PILLAR_CARDS
                  // (funnel order) — stable under filtering.
                  const no = String(PILLAR_CARDS.findIndex((x) => x.id === p.id) + 1).padStart(2, '0');
                  const cat = DECK_CATEGORIES.find((c) => (c.moduleIds as readonly string[]).includes(p.id));
                  return (
                    <tr key={p.id} className="odd:bg-bg-row transition-colors hover:bg-brand-purple-wash/40">
                      <td className="px-3 py-2.5 font-mono text-xs text-text-faint">{no}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-brand-purple">{p.label}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">{cat?.label}</td>
                      <td className="px-3 py-2.5 text-xs leading-relaxed text-text-secondary">{p.plain}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {p.id === 'travel' ? (
                          <span className="font-mono text-[10px] font-semibold text-brand-purple">LIVE — FREE</span>
                        ) : (
                          /* LANDING-V3 (spec :210): source-uppercase per spec. */
                          <span className="font-mono text-[10px] tracking-wider text-text-muted">LAUNCHING SOON</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/modules/${p.id}`}
                          aria-label={`Explore ${p.label}`}
                          className="font-mono text-sm font-medium text-brand-purple hover:text-brand-purple-hover"
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── FD-1i (ruling B): the CALCULATOR strip — live selection state
                replaced the static bundle row. Nothing selected → the bundle
                pitch below, unchanged. 1+ selected → the live strip: count,
                the honest price area (the sum ONLY when every selected
                TAB_PRICING monthlyPrice exists — all five are null today,
                pricing-costs.ts:346-370, so "prices shown at checkout" is the
                live default), the bundle comparison at 2+, and Continue →
                onBuyModule (PR-PRICE-3: /pricing died; Stripe checkout is one
                subscription per session, so multi-select starts with the
                FIRST selected key and the strip says so — the remaining
                modules buy the same way after each checkout returns). ──────── */}
          {selectedPillars.length > 0 && (
            <div className="mt-5 flex flex-col gap-4 rounded-lg border border-brand-purple/60 bg-white p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  {selectedPillars.length} module{selectedPillars.length === 1 ? '' : 's'} selected
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  {selectedPillars.map((p) => p.label).join(' · ')}
                </p>
                {selectedPillars.length >= 2 && (
                  <p className="mt-1 text-[10px] text-text-faint">
                    One checkout per module — Continue starts with the first selected.
                  </p>
                )}
              </div>
              <div className="sm:text-right">
                <p className="font-mono text-lg font-bold text-brand-gold">
                  {selectedSum !== null ? (
                    <>${selectedSum}<span className="text-xs font-normal text-text-faint">/mo</span></>
                  ) : (
                    <span className="text-xs font-normal italic text-text-faint">prices shown at checkout</span>
                  )}
                </p>
                {selectedPillars.length >= 2 && bundle && (
                  <p className="mt-0.5 text-[10px] text-text-faint">
                    {bundle.monthlyPrice !== null
                      ? `Bundle: everything for $${bundle.monthlyPrice}/mo`
                      : entitlementAvailability[bundle.key] === true
                        ? 'Bundle: price shown at checkout'
                        : 'Bundle: launching soon'}
                  </p>
                )}
              </div>
              {/* Selection requires `available` (the checkbox gate above), so
                  every selected pillar has a sell key — selectedSellKeys is
                  never empty while this strip renders. */}
              <button
                type="button"
                onClick={() => onBuyModule(selectedSellKeys[0])}
                className="bg-brand-gold px-6 py-2 text-center text-xs font-medium text-white hover:bg-brand-gold/90"
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── The bundle pitch — the calculator's EMPTY state (nothing
                selected). Markup + commerce wiring verbatim from the dead
                sheet's closer (LOBBY-DECK-1). ───────────────────────────────── */}
          {categoryKey !== 'services' && selectedPillars.length === 0 && bundle && (
            <div className="mt-5 flex flex-col gap-4 rounded-lg border border-border bg-white p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <span className="rounded border border-border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  {bundle.label}
                </span>
                {/* PR-DECK-CLEAN-1 (bundle = same treatment: name, ONE line,
                    price slot): compressed from the pricingModel bundle:all
                    unlocks string — the full sentence stays the checkout
                    truth ("resolved at read time — one purchase unlocks all
                    tabs"). */}
                <p className="mt-2 text-xs leading-relaxed text-text-muted">Every module above — one subscription.</p>
              </div>
              {/* PRICE-1: the bundle row follows the slide rule — ONE honest
                  state. Purchasable → price/italic + Select; not → "Launching
                  soon", no dead button. */}
              <div className="font-mono text-lg font-bold text-brand-gold">
                {bundle.monthlyPrice !== null ? (
                  <>${bundle.monthlyPrice}<span className="text-xs font-normal text-text-faint">/mo</span></>
                ) : entitlementAvailability[bundle.key] === true ? (
                  <span className="text-xs font-normal italic text-text-faint">price shown at checkout</span>
                ) : (
                  <span className="text-xs font-normal text-text-muted">Launching soon</span>
                )}
              </div>
              {entitlementAvailability[bundle.key] === true && (
                <button
                  type="button"
                  onClick={() => onBuyModule(bundle.key)}
                  className="bg-brand-gold px-6 py-2 text-center text-xs font-medium text-white hover:bg-brand-gold/90"
                >
                  Select the bundle →
                </button>
              )}
            </div>
          )}

          {/* DECK-SERVICES-TAB: the SERVICES-TIER done-for-you bar was
              ABSORBED into the Services tab's panel above — one offer, one
              surface (the hero Work-with-me row stays). */}

          {/* ── The transparency door — the legend/total/footnote block moved
                behind this one line (LOBBY-DECK-1); the full receipts live on
                /how-pricing-works. ─────────────────────────────────────────── */}
          <Link
            href="/how-pricing-works"
            className="mt-5 inline-block font-mono text-xs font-medium text-brand-purple hover:text-brand-purple-hover"
          >
            Every price, traced to a real bill → see the full breakdown
          </Link>
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

      {/* ── LANDING-V4 (spec :281-302): INSIDE THE APP renumbers to 04 and
            adopts the spec's frame-card anatomy — per module a white card
            with a mono caption bar ('APP / {NAME}' left · the deck-table's
            status string as the right chip, :907-911 idiom reused) and the
            existing screenshot framed beneath (spec :290 aspect 16/10,
            fit-contain; border-border + bg-bg-row chrome), 2-up at lg.
            DECLARED RETIREMENT: the FD-1i/DECK-2 slide prose (eyebrow chips,
            h3 headlines, bullet lines, Explore CTAs) leaves the page —
            strings live in git history; the module pitch lives in the deck
            table's IN ITS OWN WORDS column and Explore access in its arrows.
            DECLARED INTERIM: current screenshot assets remain until the
            Direction-C re-shoot — frames receive new images as drop-in
            asset swaps (same src paths). ─────────────────────────────────── */}
      <section className="w-full border-b border-border bg-bg-terminal">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          {/* LANDING-V2 (spec :281-282): the eyebrow row; the right slot is a
              PLAIN mono line, not a link (spec renders it in the muted ink). */}
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              04 / INSIDE THE APP
            </p>
            {/* LANDING-04-ILLOS: the old right slot read "REAL SCREENS — NOT
                RENDERS", which was FALSE for eight of the nine frames (they
                carried code-drawn illustrations) and for the ninth once its
                stale pre-repaint capture retired. The line now says what the
                frames actually are. (Ratify row — Alex judges on Preview.) */}
            <p className="font-mono text-[10px] tracking-wider text-text-faint">ILLUSTRATED PIPELINES — NOT SCREENSHOTS</p>
          </div>
          {/* LANDING-V3 (spec :284): the section h2, spec wording verbatim. */}
          <h2 className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">
            The product, as it runs.
          </h2>
          {/* LANDING-04-CAPTIONS: the one intro line — how the nine modules
              link up, in plain language. Type idiom reused verbatim from the
              Built-on wall's intro line (:1202 text-sm text-text-secondary). */}
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Everything you plan and everything you spend lands in one place — so it can tell you how long your money lasts.
          </p>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {PILLAR_CARDS.map((p) => {
              const s = SUMMARY_BY_ID[p.id];
              return (
                // LANDING-V4 (spec :286-301): the frame card — white card,
                // mono caption bar (label left · status chip right), the
                // screenshot in a 16/10 frame beneath (spec fit="contain",
                // :291). Status strings + classes reused verbatim from the
                // deck table's STATUS column — never invented. Plain <img>
                // per the house precedent (HotelGallery.tsx:38); the frame
                // renders ONLY when the entry carries a real image
                // (absence-is-honest — today all nine do, PR-DEMO-1).
                <div key={p.id} className="overflow-hidden rounded-lg border border-border bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                      APP / {p.label}
                    </span>
                    {p.id === 'travel' ? (
                      <span className="font-mono text-[10px] font-semibold text-brand-purple">LIVE — FREE</span>
                    ) : (
                      <span className="font-mono text-[10px] tracking-wider text-text-muted">LAUNCHING SOON</span>
                    )}
                  </div>
                  {s.demoImage && (
                    <div className="aspect-[16/10] bg-bg-row">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.demoImage.src} alt={s.demoImage.alt} className="h-full w-full object-contain" />
                    </div>
                  )}
                  {/* LANDING-04-CAPTIONS: two lines under the frame. Line 1 is
                      the module's own plain line — READ FROM THE CARD, never
                      retyped (PILLAR_CARDS is the source moduleBands.ts copies
                      byte-for-byte, per its own header; the two are verified
                      identical for all nine). Line 2 says how that module
                      connects to the rest. Block geometry mirrors the caption
                      BAR above (:1147 px-3.5 + a border hairline); the two-line
                      type idiom is the 03 service card's, verbatim (:1082-1083
                      text-sm font-medium / mt-1 text-xs text-text-muted). No
                      fixed widths — both lines wrap at 390. */}
                  <div className="border-t border-border px-3.5 py-3 text-text-primary">
                    <div className="text-sm font-medium">{p.plain}</div>
                    <p className="mt-1 text-xs text-text-muted">{FRAME_LINKS[p.id]}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ── PR-ELEV-2 → ELEV-2b: the "Built on" wall — now a CARD GRID (Alex's
            feedback: the mono row undersold the stack; the summary deck above
            was RESTORED byte-faithfully from fec63b01 by the same ruling).
            CARD IDIOM REUSED, not invented: the pillar deck's glow-panel
            article (rounded-lg; the shared glow wash died in REPAINT-2 —
            solid aubergine tiles now; the :723-731 slide classes, compacted
            to p-4). WORDING LAW (locked): "Built on" /
            "integrates with" ONLY — never "partners", "trusted by", or any
            endorsement framing. CLAIMABILITY RULE: wired clients only (each
            name has a live client file in src/lib — LANDING-ELEVATE-AUDIT-1
            Part C); declared-not-connected vendors (Mozio/Airalo/Cover
            Genius) never appear. (FRED graduated in WALL-LOGOS-2 — its
            fetchers are wired, convergence/data-fetchers.ts.)
            PR-ELEV-2d: cards are LOGO-CAPABLE — entries live in the
            builtOnWall.ts leaf; a brand-terms-CLEARED vendor (per-vendor
            rules + policy URLs documented there) carries a logo slot that
            lights ONLY when its official file exists at
            public/logos/<slug>.svg (server fs check → logoAvailability).
            Stripe's lit card links to stripe.com (their marks mandate).
            PR-WALL-TEACH: the wall is a categorized TEACHING DIAGRAM —
            WALL_SECTIONS headers + plain-language explainers, EVERY card
            visible: the real mark when its file is lit, a letter tile
            until then (the WALL-PURE "Also built on" line died);
            never-cleared marks never light by construction (verdicts in
            builtOnWall.ts). ─────────────────────────────────────────────── */}
      <section className="w-full border-b border-border bg-bg-terminal">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
            Built on
          </p>
          {/* PR-WALL-TEACH: the one plain-language intro line. */}
          <p className="text-sm text-text-secondary mt-1">Every tool this platform runs on — and what each layer does.</p>
          {/* PR-WALL-TEACH: the categorized teaching diagram — WALL_SECTIONS
              order, every card ALWAYS visible: real mark when its file is
              lit (same server fs-check), a letter tile until then. Tiles
              auto-swap to marks on a bare file drop, zero code. Sections
              render as fragments in one container so first:mt-0 hits only
              the first header. */}
          <div className="mt-4">
            {WALL_SECTIONS.map((s) => (
              <Fragment key={s.key}>
                <p className="font-mono text-[10px] uppercase tracking-wider text-brand-purple mt-8 first:mt-0">{s.label}</p>
                <p className="text-xs text-text-secondary mt-1 mb-3">{s.description}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {BUILT_ON.filter((e) => e.category === s.key).map((e) => {
                    const logoLive = e.logo !== undefined && logoAvailability[e.logo.slug] === true;
                    // REPAINT-2 (edit 6, Alex's ruling — the stack STAYS):
                    // SOLID aubergine tile, flat, no glow — the white marks +
                    // letter tiles render legible on brand-purple.
                    const cardClass = 'flex flex-col items-center justify-center text-center gap-1.5 min-h-24 overflow-hidden rounded-lg bg-brand-purple p-4 text-white';
                    const body = (
                      <>
                        {logoLive && e.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/logos/${e.logo.slug}.svg`}
                            alt={e.logo.alt}
                            className="h-10 w-auto object-contain"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg font-semibold text-white/80">{e.name[0]}</div>
                        )}
                        <p className="text-xs font-medium text-white/80">{e.name}</p>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">{e.tag}</p>
                      </>
                    );
                    // Stripe's marks rule: the lit logo must link to
                    // stripe.com — the whole card becomes the outbound link.
                    // href without a lit logo does nothing (the mandate
                    // binds the MARK, not the name).
                    return logoLive && e.logo?.href ? (
                      <a
                        key={e.name}
                        href={e.logo.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cardClass}
                      >
                        {body}
                      </a>
                    ) : (
                      <article key={e.name} className={cardClass}>
                        {body}
                      </article>
                    );
                  })}
                </div>
              </Fragment>
            ))}
          </div>
          {/* PR-ELEV-2d (re-issue): REQUIRED attribution — mandatory under
              vercel.com/geist/brands while their marks render above (the
              Vercel + Next.js image marks on their split cards; the interim
              ▲ unicode mark retired with the shared infra card,
              WALL-LOGOS-2 → WALL-PURE). Exact required wording, verbatim;
              the house trace-line idiom (font-mono text-[10px] white/40). */}
          <p className="mt-3 max-w-3xl font-mono text-[10px] leading-relaxed text-text-faint">
            Vercel, the Vercel design, Next.js and related marks, designs and logos are trademarks
            or registered trademarks of Vercel, Inc. or its affiliates in the US and other countries.
          </p>
        </div>
      </section>

      {/* ── PR-ELEV-3: building in public — REAL FACTS ONLY (ruling): the
            public repo, the PR-by-PR build history, the never-paywalled
            export. No invented stats, no testimonials; a news/changelog
            carousel exists only when real content does. ───────────────────── */}
      <section className="w-full border-b border-border bg-bg-terminal">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          {/* LANDING-V2 (spec :308) → LANDING-V4: the eyebrow renumbers to 05
              — no right slot. */}
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">
            05 / BUILT IN PUBLIC
          </p>
          {/* LANDING-V3 (spec :309-328) → LANDING-V4: the grid is 3 columns
              now — THE CODE (V3 FLAGS: inline repo anchor is PLAIN TEXT,
              words byte-identical; the spec's :313 mono GITHUB link is the
              column's only link) / THE CHANGELOG / YOUR LEDGER. The
              DONE-FOR-YOU column died with the panel's move to section 03. */}
          <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">THE CODE</p>
              <p className="text-sm leading-relaxed text-text-secondary">
                The code is public — github.com/Temple-Stuart/temple-stuart-accounting
                (source-available under BSL 1.1 — free to self-host for personal use).
              </p>
              <a
                href="https://github.com/Temple-Stuart/temple-stuart-accounting"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-mono text-[10px] tracking-wider font-medium text-brand-purple hover:text-brand-purple-hover"
              >
                GITHUB.COM/TEMPLE-STUART ↗
              </a>
            </div>
            <div>
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">THE CHANGELOG</p>
              <p className="text-sm leading-relaxed text-text-secondary">
                Every change ships as a reviewed pull request — the build history is the changelog.
              </p>
            </div>
            <div>
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">YOUR LEDGER</p>
              <p className="text-sm leading-relaxed text-text-secondary">
                Your complete financial records export in one click — never paywalled.
              </p>
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

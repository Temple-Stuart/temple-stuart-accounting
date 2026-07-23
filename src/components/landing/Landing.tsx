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
 *     (TAB_PRICING data, availability-honest Select → /pricing?module=<key>)
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
 * SUMMARY_BY_ID). Commerce stays on /pricing: the landing SELECTS, /pricing
 * SELLS — Continue links carry ?module= / ?modules= only, and multi-purchase
 * remains N clicks through /pricing's existing per-module buttons.
 *
 * DECKS-3 (three verbatim rulings): (1) the PILLARS deck is a VERTICAL STACK
 * of full-width mini heroes — its carousel mechanics died; (2) the SELECTION
 * deck adopted the mini-hero glow-panel format but stays a horizontal snap
 * rail, each slide carrying the commerce (chip, display label, descriptor,
 * bullets, price, our-cost, ADD TO PLAN, Select/Explore); (3) NOTHING IS
 * FREE except the home-page travel search itself — every "Free…" access
 * label was reframed paid (claims stay gate-true; see PAID_*), all NINE
 * slides carry the checkbox, "Learn more" died, and Select's key mapping
 * comes from the REAL purchasable vocabulary (categoryKeys.ts:22-29 —
 * tab:travel + tab:operations exist; runway/routines/content have NO key →
 * availability-honest "Not yet available", never an invented key).
 * ENFORCEMENT of the paid framing (gates for the five former-free pillars)
 * is a separate ruled decision — no gate/tier/middleware line changes here.
 */

import Link from 'next/link';
import { useRef, useState } from 'react';
import { TAB_PRICING } from '@/config/pricing-costs';
import {
  ALLOCATION_ROWS, NO_COST_STRIP,
  ENTITY_DIM, ACCOUNT_DIM, SUB_DIM, OBJECT_DIM, VENDOR_DIM,
  type ScheduleAllocationRow,
} from '@/config/transparencyLedger';
import { TAB_DESCRIPTORS } from '@/lib/tabDescriptors';
import { DEMO_VIDEO_URL } from '@/config/demoVideo';

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
   *  the slide renders the availability-honest disabled Select. A key may
   *  exist WITHOUT a TAB_PRICING display entry — the price line then falls
   *  back to "price shown at checkout". */
  entitlementKey?: string;
  /** The pillar's truthful access label, paid-framed (DECKS-3) — shown when
   *  no TAB_PRICING entry carries an Unlocks line. Claims stay gate-true. */
  accessLabel?: string;
  /** LIFTED VERBATIM from the deck's own headings — except where the provenance
   *  block below marks a bullet as an FD-1h audit-cleared claim instead. */
  bullets: string[];
}

// FD-1o: per-tab truth labels, each claim verified against its live gate
// (cite table in the FD-1o report): Runway = /api/runway:38 "DB-only read";
// Routines = enrich-routine/route.ts:42 requireTier('ai'); Projects =
// requirePipeBudget across the pipe routes + pipeBudget.ts:15 default cap 20;
// Content = generate-script/route.ts:53 requireTier('ai').
// FD-1o-b: Travel re-ruled after the FD-1o STOP — every clause verified:
// free search = the public surface (middleware.ts:81-100 — flights/hotels/
// activities/transfers search); guest booking = flights & hotels ONLY
// (flights/book + liteapi prebook/book are public; activities Book routes to
// sign-up, PublicActivitySearch.tsx:92-94); paid picks =
// places/category-search/route.ts:89-99 (401 → requireTier('placesSearch')
// → category entitlements).
// DECKS-3 (ruling 3): the labels reframe PAID — every capability claim above
// stays gate-verified; only the free framing died. The ONE surviving free
// claim is the home-page travel search itself (its routes are public —
// middleware.ts:81-100 — and that stays true).
const PAID_TRAVEL = 'Free search on this page — the full Travel module is paid.';
const PAID_RUNWAY = "A paid module — its numbers come from your ledger, so it's most useful with Books.";
const PAID_ROUTINES = 'A paid module — build & run routines. AI scene enrichment is a paid feature.';
const PAID_PROJECTS = 'A paid module — includes the AI planning pipeline, capped at 20 runs/day.';
const PAID_CONTENT = 'A paid module — day log & planning. AI script generation is a paid feature.';

// Funnel order — Alex's ruling. Bullet provenance (deck lifts verbatim, except
// the FD-1h bullets — ruled copy cleared by the NOTE-0 booking→runway audit):
//   Travel:     TravelShowcaseSections.tsx :325 (bullet 1); bullets 2-3 are
//               FD-1h audit-cleared claims (bookings attach to the trip —
//               flights/book/route.ts :201; trip budget planned-vs-actual —
//               TripBudgetActual.tsx), NOT deck lifts
//   Runway:     RunwayShowcaseSections.tsx :588 (bullet 1); bullet 2 is an
//               FD-1h audit-cleared claim (per-entity BURN only — runway/route.ts
//               :146-171, RunwayBudgetPanel.tsx :128-142; cash is combined, so
//               per-entity runway months must NOT be claimed)
//   Books:      TabShowcases.tsx :337, :360, :395
//   Trade:      TabShowcases.tsx :207, :220, :269
//   Tax:        TabShowcases.tsx :454, :463, :505
//   Compliance: ComplianceShowcaseSections.tsx :328, :352, :366
//   Routines:   RoutinesShowcaseSections.tsx :430, :454, :461
//   Projects:   ProjectsShowcaseSections.tsx :717
//   Content:    ContentShowcaseSections.tsx :461, :492, :506
const PILLAR_CARDS: PillarCard[] = [
  {
    id: 'travel', label: 'Travel', tab: 'travel', entitlementKey: 'tab:travel', accessLabel: PAID_TRAVEL,
    bullets: [
      'Search it. Price it. Book it. No account required to look.',
      'Book a flight or hotel and it’s saved to your trip.',
      'Budget the trip line by line — planned vs. actual from your real ledger.',
    ],
  },
  {
    id: 'runway', label: 'Runway', tab: 'calendar', accessLabel: PAID_RUNWAY,
    bullets: [
      'Every system you’re juggling. One question answered: how long can you keep going?',
      'Burn broken out by Personal vs. Business — strays surfaced, never dropped.',
    ],
  },
  {
    id: 'books', label: 'Books', tab: 'books', entitlementKey: 'tab:books',
    bullets: [
      'Every transaction becomes a journal entry. Every period must balance.',
      'Commit is double-entry. Unbalanced refuses to save.',
      'Hand your CPA a package, not a shoebox.',
    ],
  },
  {
    id: 'trade', label: 'Trade', tab: 'trade', entitlementKey: 'tab:trade',
    bullets: [
      'An entire index in full focus. One decision out.',
      'Eighteen real controls. Sixteen strategies.',
      'The brake that says no for you.',
    ],
  },
  {
    id: 'tax', label: 'Tax', tab: 'tax', entitlementKey: 'tab:tax',
    bullets: [
      'Your books are already clean. Your taxes are half-done before you start.',
      'Tax begins at completed books.',
      'The whole return, derived — not typed.',
    ],
  },
  {
    id: 'compliance', label: 'Compliance', tab: 'compliance', entitlementKey: 'tab:compliance',
    bullets: [
      'Don’t trust us. Verify us.',
      'Citations that verify — and a checker that declares its limits.',
      'Break one row, the whole chain screams.',
    ],
  },
  {
    id: 'routines', label: 'Routines', tab: 'routines', accessLabel: PAID_ROUTINES,
    bullets: [
      'Build it once. It shows up everywhere.',
      'A routine is executable — steps you actually run.',
      'Every day answers: what’s due, what’s done, what slipped.',
    ],
  },
  {
    id: 'projects', label: 'Projects', tab: 'projects', entitlementKey: 'tab:operations', accessLabel: PAID_PROJECTS,
    bullets: [
      'Goals in. Audited tasks out.',
    ],
  },
  {
    id: 'content', label: 'Content', tab: 'content', accessLabel: PAID_CONTENT,
    bullets: [
      'Your day becomes the script.',
      'Every step gets a shot, a question, a purpose.',
      'The script only says what happened.',
    ],
  },
];

// FD-1i: the SUMMARY deck's content — LIFTED ONLY, zero invented copy (the
// FD-1b bullet-lift precedent). Per pillar: the module deck's dark-hero
// eyebrow + headline, then 3 verbatim slide titles. Provenance (file:line,
// verified this PR):
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
const SUMMARY_BY_ID: Record<string, { eyebrow: string; headline: string; lines: string[] }> = {
  travel: {
    eyebrow: 'Travel — the real product, no account required',
    headline: 'Search it. Price it. Book it. No account required to look.',
    lines: [
      'Real searches, free by design.',
      'The trip is the container.',
      'Every booking feeds the books.',
    ],
  },
  runway: {
    eyebrow: 'Runway — the whole platform, one question',
    headline: 'Every system you’re juggling. One question answered: how long can you keep going?',
    lines: [
      'Not a number you typed — the number your banks report.',
      'Your routines ARE the budget.',
      'Trading money ≠ living money. The wall is the feature.',
    ],
  },
  books: {
    eyebrow: 'Books — double-entry bookkeeping',
    headline: 'Every transaction becomes a journal entry. Every period must balance.',
    lines: [
      'Link your banks. Assign every account.',
      'The trial balance must balance.',
      'Closed means closed.',
    ],
  },
  trade: {
    eyebrow: 'Trade — the scanner',
    headline: 'An entire index in full focus. One decision out.',
    lines: [
      'Every ticker scored. Strategies only where the gates pass.',
      'The whole trade, written down.',
      'The grades accumulate. Denominators first.',
    ],
  },
  tax: {
    eyebrow: 'Tax — from closed books to a filed return',
    headline: 'Your books are already clean. Your taxes are half-done before you start.',
    lines: [
      'What others type in, your ledger already knows.',
      'Every income line traces to its source.',
      'Every lot boxed. Every box explained.',
    ],
  },
  compliance: {
    eyebrow: 'Compliance — the receipts',
    headline: 'Don’t trust us. Verify us.',
    lines: [
      'A real regulatory corpus, on real schedules.',
      'The statute you cited is the statute you saw.',
      'Obligations tracked like engineering tickets.',
    ],
  },
  routines: {
    eyebrow: 'Routines — the recurrence engine',
    headline: 'Build it once. It shows up everywhere.',
    lines: [
      'You describe the rhythm. The machine writes the schedule.',
      'The streak counts both ways.',
      'Feed one: every occurrence lands on the one calendar, priced.',
    ],
  },
  projects: {
    eyebrow: 'Projects — the Truth Machine',
    headline: 'Goals in. Audited tasks out.',
    lines: [
      'A project starts as goals in your own words.',
      'Auto-generated work waits for your ✓.',
      'Every inference has a receipt.',
    ],
  },
  content: {
    eyebrow: 'Content — day to script',
    headline: 'Your day becomes the script.',
    lines: [
      'The whole day, one feed.',
      'Inputs feed the map.',
      'Answer the day. Keep the record.',
    ],
  },
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

// FD-1o: the glanceable per-module cost summary — the SAME per-project
// derivation the expansion uses (no new data, no new claims), condensed to
// one mono micro line under the module chip.
function projectCostSummary(projectName: string): string {
  const rows = ALLOCATION_ROWS.filter((r) => r.target.name === projectName);
  const entered = rows.filter((r) => r.amountUsd !== null);
  const total = entered.reduce((s, r) => s + (r.amountUsd as number), 0);
  const usd = `$${total.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return entered.length > 0
    ? `our cost: ${usd}/mo entered · ${rows.length} items`
    : `our cost: $0 of ${rows.length} entered`;
}

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
  /** The ONE account-ask funnel — hero secondary CTA + header. FD-2 supplies
   *  the real register-modal opener; the preview wrapper supplies a stub. */
  onRequireAuth: () => void;
  /** Per-entitlement-key availability, SERVER-computed by the mount route
   *  (mirrors /pricing/page.tsx:15-24). Missing key → unavailable. */
  entitlementAvailability: Record<string, boolean>;
}

// The house dark-hero background — TabShowcaseTemplate.tsx:140-144's pattern
// on token vars (no hex).
const HERO_BG =
  'radial-gradient(ellipse 80% 90% at 85% 10%, rgb(var(--ts-purple) / 0.65), transparent 60%), radial-gradient(ellipse 60% 70% at 100% 80%, rgb(var(--ts-purple-deep) / 0.5), transparent 55%), var(--ts-panel)';

export default function Landing({ onRequireAuth, entitlementAvailability }: Props) {
  const pricingByKey = new Map(TAB_PRICING.map((t) => [t.key, t]));
  const bundle = pricingByKey.get('bundle:all');

  // LOBBY-DECK-1: the deck's nav — a ref on the snap track, chevrons that
  // scroll it, and ONE scroll-derived piece of client state (the active-dot
  // index). No slide data lives in state; CSS scroll-snap owns positioning.
  const deckTrackRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const onDeckScroll = () => {
    const el = deckTrackRef.current;
    if (!el) return;
    const denom = Math.max(1, el.scrollWidth - el.clientWidth);
    setActiveSlide(Math.round((el.scrollLeft / denom) * (PILLAR_CARDS.length - 1)));
  };
  const deckScrollBy = (dir: 1 | -1) => {
    const el = deckTrackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.9), behavior: 'smooth' });
  };

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
  const continueHref =
    selectedSellKeys.length === 1
      ? `/pricing?module=${encodeURIComponent(selectedSellKeys[0])}`
      : selectedSellKeys.length > 1
        ? `/pricing?modules=${selectedSellKeys.join(',')}`
        : '/pricing';

  return (
    <div className="min-h-screen bg-panel text-white">
      <LandingHeader onRequireAuth={onRequireAuth} />

      {/* ── Hero — the house Bloomberg treatment; copy + CTAs verbatim ─────── */}
      <section className="text-white pb-14 pt-12" style={{ background: HERO_BG }}>
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Track your money.<br />
              Plan your time.<br />
              <span className="text-white/50">Live smarter.</span>
            </h1>
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
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-6 py-3 bg-white text-brand-purple font-medium hover:bg-bg-row text-sm text-center"
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

            {/* ── LOBBY-FIX-1: the source-availability line moved here, directly
                  beneath the hero CTA row (from under the selection deck). Every
                  claim is LICENSE-true: LICENSE:1 "Business Source License 1.1";
                  Additional Use Grant (LICENSE:13-16) = personal, non-commercial
                  use only, commercial use requires a separate license; Change
                  License Apache 2.0 on Change Date 2028-01-01 (LICENSE:18-21).
                  Address = the house contact, LandingHeader.tsx:36
                  (astuart@templestuart.com — also LICENSE:16). NO "open source"
                  framing. ───────────────────────────────────────────────────── */}
            <p className="mt-4 font-mono text-xs text-white/50">
              Source-available under BSL 1.1 — free to self-host for personal use. Commercial use or a
              done-for-you setup →{' '}
              <a href="mailto:astuart@templestuart.com" className="text-white/70 underline hover:text-white">
                astuart@templestuart.com
              </a>
            </p>
          </div>

          {/* ── TOGGLE-1: the lobby books — the five-way toggle strip, mounted
                where the teaser sat (directly under the CTA row; pre-BOOK-1
                Landing.tsx:325-328). Full content width — the strip holds
                whole booking surfaces + result rows, not just a form. ─────── */}
          <LandingBookingSection onRequireAuth={onRequireAuth} />
        </div>
      </section>

      {/* ── BOOK-3: the guest's session trip — renders only when records
            exist (fail-honest empty state = nothing). ─────────────────────── */}
      <GuestTripStrip onRequireAuth={onRequireAuth} />

      {/* ── LOBBY-DECK-1: the nine pillars + the module sheet, consolidated
            into ONE slide deck — nine slides in the funnel order. Each slide
            = the pillar card's content (chip + TAB_DESCRIPTORS + verbatim
            PILLAR_CARDS bullets) + its sheet row's truth (Unlocks/accessLabel,
            the price line, the FD-1o cost summary) + the actions
            (availability-honest Select → /pricing?module=<key>; Explore →
            /modules/<id>). Navigation: CSS scroll-snap (no new
            deps), chevrons + scroll-derived dots. HERO-REPO-1: the demo
            trigger mounts in this header (id="pillar-deck" retained). ───────── */}
      <section id="pillar-deck" className="w-full border-b border-panel-border bg-panel">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
                The nine pillars · modules
              </p>
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
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                aria-label="Previous slides"
                onClick={() => deckScrollBy(-1)}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/30 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next slides"
                onClick={() => deckScrollBy(1)}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/30 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          <div
            ref={deckTrackRef}
            onScroll={onDeckScroll}
            role="group"
            aria-label="The nine pillars"
            tabIndex={0}
            className="mt-4 flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {PILLAR_CARDS.map((p) => {
              const pricing = p.entitlementKey ? pricingByKey.get(p.entitlementKey) : undefined;
              const available = p.entitlementKey ? entitlementAvailability[p.entitlementKey] === true : false;
              return (
                // DECKS-3 (ruling 2): the selection slide is a wide GLOW HERO
                // (the DECK-2 panel language — HERO_BG reused verbatim) that
                // carries the commerce. The FD-1i purple/green accent split
                // died with "free" itself. Chip = the hero eyebrow idiom
                // ('Module', a chrome label); the pillar label is the display
                // headline. ALL NINE slides get ADD TO PLAN (ruling 3);
                // actions are Select → /pricing?module=<key> (availability-
                // honest disabled when no key or no Stripe price) + the
                // Explore secondary. "Learn more" is gone.
                <article
                  key={p.id}
                  className="flex min-h-[18rem] w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-lg p-5 text-white sm:w-[60%] sm:p-6 lg:w-[38%]"
                  style={{ background: HERO_BG }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
                      Module
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-light tracking-tight sm:text-2xl">{p.label}</h3>
                  <p className="mt-3 max-w-xl text-xs leading-relaxed text-white/65">{TAB_DESCRIPTORS[p.tab]}</p>
                  <ul className="mt-3 max-w-xl space-y-1">
                    {p.bullets.map((b, i) => (
                      <li key={i} className={`text-xs leading-relaxed ${i === 0 ? 'font-medium text-white' : 'text-white/70'}`}>
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* The commerce block: price (TAB_PRICING when present, else
                      the italic fallback — no pillar says Free anymore), the
                      Unlocks/accessLabel truth line, the FD-1o cost summary. */}
                  <div className="mt-4 max-w-xl border-t border-white/20 pt-3">
                    <p className="font-mono text-sm font-bold text-white">
                      {pricing && pricing.monthlyPrice !== null ? (
                        <>${pricing.monthlyPrice}<span className="text-xs font-normal text-white/50">/mo</span></>
                      ) : (
                        <span className="text-xs font-normal italic text-white/50" title="Display price not entered yet — Stripe shows the real price at checkout">
                          price shown at checkout
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                      {pricing ? <>Unlocks {pricing.unlocks}.</> : p.accessLabel}
                    </p>
                    <p className="mt-1.5 font-mono text-[10px] text-white/40">
                      {projectCostSummary(p.label)}
                    </p>
                  </div>

                  {/* DECKS-3 (ruling 3): every slide is selectable. */}
                  <label className="mt-3 flex cursor-pointer items-center gap-2 self-start font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70 transition-colors hover:text-white">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                      className="h-3.5 w-3.5 accent-brand-purple"
                      aria-label={`Add ${p.label} to plan`}
                    />
                    Add to plan
                  </label>

                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
                    {p.entitlementKey && available ? (
                      <Link
                        href={`/pricing?module=${encodeURIComponent(p.entitlementKey)}`}
                        className="inline-block bg-white px-4 py-1.5 text-xs font-medium text-brand-purple hover:bg-bg-row"
                      >
                        Select →
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="This module's Stripe price isn't configured yet"
                        className="cursor-not-allowed border border-panel-border px-4 py-1.5 text-xs font-medium text-white/40"
                      >
                        Not yet available
                      </button>
                    )}
                    <Link
                      href={`/modules/${p.id}`}
                      className="inline-block border border-white/30 px-4 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                    >
                      Explore →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Slide-position dots — indicators only, scroll-derived. */}
          <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
            {PILLAR_CARDS.map((p, i) => (
              <span
                key={p.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeSlide ? 'w-4 bg-white' : 'w-1.5 bg-white/30'
                }`}
              />
            ))}
          </div>

          {/* ── FD-1i (ruling B): the CALCULATOR strip — live selection state
                replaced the static bundle row. Nothing selected → the bundle
                pitch below, unchanged. 1+ selected → the live strip: count,
                the honest price area (the sum ONLY when every selected
                TAB_PRICING monthlyPrice exists — all five are null today,
                pricing-costs.ts:346-370, so "prices shown at checkout" is the
                live default), the bundle comparison at 2+, and Continue into
                /pricing (?module= single / ?modules= multi). Commerce stays
                on /pricing — multi-purchase is N checkouts there, and the
                strip says so. ─────────────────────────────────────────────── */}
          {selectedPillars.length > 0 && (
            <div className="mt-5 flex flex-col gap-4 rounded-lg border border-brand-purple/60 bg-panel p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  {selectedPillars.length} module{selectedPillars.length === 1 ? '' : 's'} selected
                </p>
                <p className="mt-1 text-xs leading-relaxed text-white/60">
                  {selectedPillars.map((p) => p.label).join(' · ')}
                </p>
                {selectedPillars.length >= 2 && (
                  <p className="mt-1 text-[10px] text-white/40">
                    Complete each module&apos;s checkout on the next page.
                  </p>
                )}
              </div>
              <div className="sm:text-right">
                <p className="font-mono text-lg font-bold text-white">
                  {selectedSum !== null ? (
                    <>${selectedSum}<span className="text-xs font-normal text-white/50">/mo</span></>
                  ) : (
                    <span className="text-xs font-normal italic text-white/50">prices shown at checkout</span>
                  )}
                </p>
                {selectedPillars.length >= 2 && bundle && (
                  <p className="mt-0.5 text-[10px] text-white/50">
                    {bundle.monthlyPrice !== null
                      ? `Bundle: everything for $${bundle.monthlyPrice}/mo`
                      : 'Bundle: price shown at checkout'}
                  </p>
                )}
              </div>
              <Link
                href={continueHref}
                className="bg-white px-6 py-2 text-center text-xs font-medium text-brand-purple hover:bg-bg-row"
              >
                Continue →
              </Link>
            </div>
          )}

          {/* ── The bundle pitch — the calculator's EMPTY state (nothing
                selected). Markup + commerce wiring verbatim from the dead
                sheet's closer (LOBBY-DECK-1). ───────────────────────────────── */}
          {selectedPillars.length === 0 && bundle && (
            <div className="mt-5 flex flex-col gap-4 rounded-lg border border-white/30 bg-panel p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <span className="rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  {bundle.label}
                </span>
                <p className="mt-2 text-xs leading-relaxed text-white/60">Unlocks {bundle.unlocks}.</p>
              </div>
              <div className="font-mono text-lg font-bold text-white">
                {bundle.monthlyPrice !== null ? (
                  <>${bundle.monthlyPrice}<span className="text-xs font-normal text-white/50">/mo</span></>
                ) : (
                  <span className="text-xs font-normal italic text-white/50">price shown at checkout</span>
                )}
              </div>
              {entitlementAvailability[bundle.key] === true ? (
                <Link
                  href={`/pricing?module=${encodeURIComponent(bundle.key)}`}
                  className="bg-white px-6 py-2 text-center text-xs font-medium text-brand-purple hover:bg-bg-row"
                >
                  Select the bundle →
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title="The bundle's Stripe price isn't configured yet"
                  className="cursor-not-allowed border border-panel-border px-6 py-2 text-xs font-medium text-white/40"
                >
                  Not yet available
                </button>
              )}
            </div>
          )}

          {/* ── The transparency door — the legend/total/footnote block moved
                behind this one line (LOBBY-DECK-1); the full receipts live on
                /how-pricing-works. ─────────────────────────────────────────── */}
          <Link
            href="/how-pricing-works"
            className="mt-5 inline-block font-mono text-xs font-medium text-white hover:text-white/70"
          >
            Every price, traced to a real bill → see the full breakdown
          </Link>
        </div>
      </section>

      {/* ── FD-1i (ruling E): the SUMMARY deck — a second pass beneath the
            selection floor, same scroll-snap mechanics. Content LIFTED ONLY:
            each pillar's dark-hero eyebrow + headline, the descriptor, and
            three verbatim slide titles (provenance on SUMMARY_BY_ID).
            DECK-2: the slides render as MINIATURE EXPLORE HEROES — wide,
            tall, radial-glow panels in the darkHero language (the stage
            changed; the script is byte-identical).
            DECKS-3 (ruling 1): the deck is a VERTICAL STACK now — nine
            full-width mini heroes, top to bottom. The carousel mechanics
            (snap rail, chevrons, dots) died on this section. ───────────────── */}
      <section className="w-full border-b border-panel-border bg-panel-surface">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
            The pillars — in their own words
          </p>

          <div className="mt-4 space-y-6">
            {PILLAR_CARDS.map((p) => {
              const s = SUMMARY_BY_ID[p.id];
              return (
                // DECK-2: each slide IS a miniature explore hero — the
                // TabShowcaseTemplate darkHero visual language (:142-148:
                // near-black base + brand-purple radial glows), rebuilt on
                // tokens via the FD-1c HERO_BG const (reused verbatim — the
                // template's raw color literals never enter this file).
                // Chip = the template's :151 eyebrow idiom (+ the
                // landing's mono); headline = the hero's display type scaled
                // down (text-3xl/5xl → 2xl/3xl); sub-copy white/65-70; CTA =
                // the white hero-button family. Content strings byte-identical
                // to FD-1i (SUMMARY_BY_ID + TAB_DESCRIPTORS — 0 data lines).
                <article
                  key={p.id}
                  className="flex min-h-[22rem] w-full flex-col overflow-hidden rounded-lg p-6 text-white sm:p-8"
                  style={{ background: HERO_BG }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
                      {s.eyebrow}
                    </span>
                  </div>
                  <h3 className="mt-4 text-2xl font-light tracking-tight sm:text-3xl">{s.headline}</h3>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">{TAB_DESCRIPTORS[p.tab]}</p>
                  <ul className="mt-3 max-w-xl space-y-1">
                    {s.lines.map((l, i) => (
                      <li key={i} className="text-sm leading-relaxed text-white/70">{l}</li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-5">
                    <Link
                      href={`/modules/${p.id}`}
                      className="inline-block bg-white px-4 py-1.5 text-xs font-medium text-brand-purple hover:bg-bg-row"
                    >
                      Explore {p.label} →
                    </Link>
                  </div>
                </article>
              );
            })}
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
            className="w-full max-w-3xl rounded-lg border border-panel-border bg-panel p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
                The demo
              </p>
              <button
                type="button"
                aria-label="Close the demo"
                onClick={() => setShowDemo(false)}
                className="text-white/50 transition-colors hover:text-white"
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

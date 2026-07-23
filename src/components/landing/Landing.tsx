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
  /** TAB_PRICING key for the four entitlement modules; absent = free pillar. */
  entitlementKey?: string;
  /** The free pillar's truthful access label (audit-cited in the header note). */
  freeLabel?: string;
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
const FREE_TRAVEL =
  'Free search — flights, hotels, activities. Guest booking for flights & hotels. Premium local picks are paid add-ons.';
const FREE_RUNWAY = "Free with a free account — its numbers come from your ledger, so it's most useful with Books.";
const FREE_ROUTINES = 'Free with a free account — build & run routines. AI scene enrichment is a paid feature.';
const FREE_PROJECTS = 'Free with a free account — includes the AI planning pipeline, capped at 20 runs/day.';
const FREE_CONTENT = 'Free with a free account — day log & planning. AI script generation is a paid feature.';

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
    id: 'travel', label: 'Travel', tab: 'travel', freeLabel: FREE_TRAVEL,
    bullets: [
      'Search it. Price it. Book it. No account required to look.',
      'Book a flight or hotel and it’s saved to your trip.',
      'Budget the trip line by line — planned vs. actual from your real ledger.',
    ],
  },
  {
    id: 'runway', label: 'Runway', tab: 'calendar', freeLabel: FREE_RUNWAY,
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
    id: 'routines', label: 'Routines', tab: 'routines', freeLabel: FREE_ROUTINES,
    bullets: [
      'Build it once. It shows up everywhere.',
      'A routine is executable — steps you actually run.',
      'Every day answers: what’s due, what’s done, what slipped.',
    ],
  },
  {
    id: 'projects', label: 'Projects', tab: 'projects', freeLabel: FREE_PROJECTS,
    bullets: [
      'Goals in. Audited tasks out.',
    ],
  },
  {
    id: 'content', label: 'Content', tab: 'content', freeLabel: FREE_CONTENT,
    bullets: [
      'Your day becomes the script.',
      'Every step gets a shot, a question, a purpose.',
      'The script only says what happened.',
    ],
  },
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
              {/* LOBBY-DECK-1: "Try it live" died — the booking strip sits right
                  below anyway; the white CTA now walks the guest to the deck. */}
              <button
                type="button"
                onClick={() =>
                  document.getElementById('pillar-deck')?.scrollIntoView({ behavior: 'smooth' })
                }
                className="px-6 py-3 bg-white text-brand-purple font-medium hover:bg-bg-row text-sm text-center"
              >
                See how it works ↓
              </button>
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-6 py-3 border border-white/40 text-white font-medium hover:bg-white/10 text-sm"
              >
                Create free account
              </button>
            </div>
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
            PILLAR_CARDS bullets) + its sheet row's truth (Unlocks/freeLabel,
            price-or-Free, the FD-1o cost summary) + the sheet's actions
            (Explore → /modules/<id>; availability-honest Select →
            /pricing?module=<key> / Learn more — commerce wiring byte-
            identical to the dead sheet). Navigation: CSS scroll-snap (no new
            deps), chevrons + scroll-derived dots. The hero CTA scrolls here
            (id="pillar-deck"). ─────────────────────────────────────────────── */}
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
                <article
                  key={p.id}
                  className="flex w-[85%] shrink-0 snap-start flex-col rounded-lg border border-panel-border bg-panel-surface p-4 sm:w-[48%] lg:w-[32%]"
                >
                  <span className="self-start rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
                    {p.label}
                  </span>
                  <p className="mt-2 text-xs leading-relaxed text-white/60">{TAB_DESCRIPTORS[p.tab]}</p>
                  <ul className="mt-3 space-y-1">
                    {p.bullets.map((b, i) => (
                      <li key={i} className={`text-xs leading-relaxed ${i === 0 ? 'font-medium text-white' : 'text-white/60'}`}>
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* The sheet row's truth, folded into the slide: price-or-Free,
                      the Unlocks/freeLabel line, the FD-1o cost summary. */}
                  <div className="mt-3 border-t border-panel-border pt-3">
                    <p className="font-mono text-sm font-bold text-white">
                      {pricing ? (
                        pricing.monthlyPrice !== null ? (
                          <>${pricing.monthlyPrice}<span className="text-xs font-normal text-white/50">/mo</span></>
                        ) : (
                          <span className="text-xs font-normal italic text-white/50" title="Display price not entered yet — Stripe shows the real price at checkout">
                            price shown at checkout
                          </span>
                        )
                      ) : (
                        <>Free</>
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                      {pricing ? <>Unlocks {pricing.unlocks}.</> : p.freeLabel}
                    </p>
                    <p className="mt-1.5 font-mono text-[10px] text-white/40">
                      {projectCostSummary(p.label)}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                    <Link
                      href={`/modules/${p.id}`}
                      className="font-mono text-xs font-medium text-white hover:text-white/70"
                    >
                      Explore {p.label} →
                    </Link>
                    {pricing ? (
                      available ? (
                        <Link
                          href={`/pricing?module=${encodeURIComponent(pricing.key)}`}
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
                      )
                    ) : (
                      <Link
                        href={`/modules/${p.id}`}
                        className="inline-block border border-white/30 px-4 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                      >
                        Learn more →
                      </Link>
                    )}
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

          {/* ── The bundle — the ruled call: a slim strip BELOW the deck (not a
                tenth slide; it has no card/descriptor shape). Markup + commerce
                wiring verbatim from the dead sheet's closer. ────────────────── */}
          {bundle && (
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

      <LandingFooter />
    </div>
  );
}

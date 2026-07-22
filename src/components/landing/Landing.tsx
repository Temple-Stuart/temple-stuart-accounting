'use client';

/**
 * Landing (FD-1 → FD-1b → FD-1c) — "the doctor's office", now the SALES FLOOR:
 * same content skeleton as FD-1b (hero → pillar cards → MODULE SHEET → pricing-
 * transparency band → footer), redressed in the house institutional aesthetic
 * and carrying the truthful module-select sheet.
 *
 * VISUAL REGRADE (FD-1c) — the house terminal look, ZERO new hex:
 *   • dark surfaces ride the EXISTING panel token family (tailwind.config.ts
 *     :34-39 → --ts-panel vars) + brand-purple-deep (:21);
 *   • the hero mirrors the TRADE-SHOWCASE-BLOOMBERG dark hero
 *     (TabShowcaseTemplate.tsx:140-144 — near-black base, brand-purple radial
 *     glows, "No new palette — the brand family, deepened"), rebuilt here on
 *     rgb(var(--ts-*)) references so no hex literal exists in this file;
 *   • micro-labels mirror the template's eyebrow chip (TabShowcaseTemplate.tsx
 *     :150 — text-[10px] font-semibold uppercase tracking-wider + hairline
 *     border-white/20) and the dark data panels (TradeShowcaseSections.tsx:98,
 *     :159 — border-panel-border bg-panel font-mono) — IBM Plex Mono is
 *     already loaded app-wide (layout.tsx:2-10).
 *
 * MODULE SHEET (FD-1c) — "select what you wanna buy", truth-bound:
 *   • exactly the 4 live modules (tab:trade/books/tax/compliance) + bundle:all
 *     — no tier cards (dormant lane stays on /pricing), no tab:travel/
 *     tab:operations (they gate nothing — selling them sells nothing);
 *   • every rendered field comes VERBATIM from TAB_PRICING
 *     (src/config/pricing-costs.ts:341-372, the same source /pricing renders);
 *     monthlyPrice null → the exact honest fallback /pricing shows
 *     ("price shown at checkout", PricingClient.tsx:241-243);
 *   • availability is the SERVER-computed boolean per key (client code cannot
 *     read env) — passed in via the entitlementAvailability prop by the mount
 *     route (landing-preview/page.tsx mirrors /pricing/page.tsx:15-24; FD-2's
 *     arrival branch supplies the same map). Unavailable → disabled
 *     "Not yet available" (PricingClient.tsx:256-266's honesty, mirrored);
 *   • Select is a LINK to /pricing?module=<key> — no checkout calls from the
 *     landing; PricingClient scroll-highlights the matching card.
 *
 * Hero copy + both CTAs are RULED and stay verbatim from FD-1b. Descriptors
 * remain the TAB_DESCRIPTORS lockstep copies (ModuleLauncher.tsx:153-163 —
 * see FD-1's bundling rationale). Card bullets remain the FD-1b verbatim
 * deck-heading lifts (provenance in the PILLAR_CARDS comment).
 */

import Link from 'next/link';
import { TAB_PRICING } from '@/config/pricing-costs';

// COPIED VERBATIM from ModuleLauncher.tsx TAB_DESCRIPTORS (:153-163) — keep in
// lockstep until the constant is extracted to a shared leaf module (FD-1 note).
const DESCRIPTORS: Record<string, string> = {
  travel: 'Book your flights, hotels, things to do, and ground transportation — competitive prices, real times, real data.',
  runway: 'Runway — how long your money buys you. Your planned and actual spend, mapped to the day, so your runway is never a guess.',
  books: 'Connect your bank through Plaid and every transaction flows in.',
  trade: "Tell the scanner what you're hunting, and it pulls live prices from TastyTrade, company numbers from Finnhub, economy data from FRED, official filings from SEC EDGAR, and the mood online from Grok.",
  tax: 'Your books are already clean, so your taxes are half-done before you start.',
  compliance: "This one's for when things get serious.",
  routines: 'Build your recurring routines and watch them land on your calendar — the rhythms that run your day.',
  projects: "Type the big messy goal that's rattling around your head — plain, rambly, however it actually lives up there.",
  content: 'Turn what you actually did today into a reel — sources to scenes to a ready-to-record script.',
};

interface PillarCard {
  id: string;
  label: string;
  /** The ?tab= id the Explore link targets — differs from `id` only for
   *  Runway, whose tab key is 'calendar' (ModuleLauncher.tsx TABS :126). */
  tab: string;
  /** LIFTED VERBATIM from the deck's own headings — provenance per string: */
  bullets: string[];
}

// Funnel order — Alex's ruling. Bullet provenance (all verbatim):
//   Travel:     TravelShowcaseSections.tsx :325, :342, :349
//   Runway:     RunwayShowcaseSections.tsx :588
//   Books:      TabShowcases.tsx :337, :360, :395
//   Trade:      TabShowcases.tsx :207, :220, :269
//   Tax:        TabShowcases.tsx :454, :463, :505
//   Compliance: ComplianceShowcaseSections.tsx :328, :352, :366
//   Routines:   RoutinesShowcaseSections.tsx :430, :454, :461
//   Projects:   ProjectsShowcaseSections.tsx :717
//   Content:    ContentShowcaseSections.tsx :461, :492, :506
const PILLAR_CARDS: PillarCard[] = [
  {
    id: 'travel', label: 'Travel', tab: 'travel',
    bullets: [
      'Search it. Price it. Book it. No account required to look.',
      'Real searches, free by design.',
      'Hotels: book as a guest — the one complete flow.',
    ],
  },
  {
    id: 'runway', label: 'Runway', tab: 'calendar',
    bullets: [
      'Every system you’re juggling. One question answered: how long can you keep going?',
    ],
  },
  {
    id: 'books', label: 'Books', tab: 'books',
    bullets: [
      'Every transaction becomes a journal entry. Every period must balance.',
      'Commit is double-entry. Unbalanced refuses to save.',
      'Hand your CPA a package, not a shoebox.',
    ],
  },
  {
    id: 'trade', label: 'Trade', tab: 'trade',
    bullets: [
      'An entire index in full focus. One decision out.',
      'Eighteen real controls. Sixteen strategies.',
      'The brake that says no for you.',
    ],
  },
  {
    id: 'tax', label: 'Tax', tab: 'tax',
    bullets: [
      'Your books are already clean. Your taxes are half-done before you start.',
      'Tax begins at completed books.',
      'The whole return, derived — not typed.',
    ],
  },
  {
    id: 'compliance', label: 'Compliance', tab: 'compliance',
    bullets: [
      'Don’t trust us. Verify us.',
      'Citations that verify — and a checker that declares its limits.',
      'Break one row, the whole chain screams.',
    ],
  },
  {
    id: 'routines', label: 'Routines', tab: 'routines',
    bullets: [
      'Build it once. It shows up everywhere.',
      'A routine is executable — steps you actually run.',
      'Every day answers: what’s due, what’s done, what slipped.',
    ],
  },
  {
    id: 'projects', label: 'Projects', tab: 'projects',
    bullets: [
      'Goals in. Audited tasks out.',
    ],
  },
  {
    id: 'content', label: 'Content', tab: 'content',
    bullets: [
      'Your day becomes the script.',
      'Every step gets a shot, a question, a purpose.',
      'The script only says what happened.',
    ],
  },
];

// The sheet's contents — RULED: the 4 live modules + the bundle, in TAB_PRICING
// order. tab:travel/tab:operations are deliberately absent (they gate nothing).
const SHEET_KEYS = ['tab:trade', 'tab:books', 'tab:tax', 'tab:compliance', 'bundle:all'] as const;

interface Props {
  /** The ONE account-ask funnel — header/hero secondary CTA. FD-2 supplies the
   *  real register-modal opener; the preview wrapper supplies a stub. */
  onRequireAuth: () => void;
  /** Per-entitlement-key availability, SERVER-computed by the mount route
   *  (a Stripe price ID is configured right now) — mirrors /pricing/page.tsx
   *  :15-24. Missing key → treated as unavailable, never assumed sellable. */
  entitlementAvailability: Record<string, boolean>;
}

// The house dark-hero background — TabShowcaseTemplate.tsx:140-144's pattern
// rebuilt on token vars (no hex): brand-purple + brand-purple-deep glows over
// the panel base.
const HERO_BG =
  'radial-gradient(ellipse 80% 90% at 85% 10%, rgb(var(--ts-purple) / 0.65), transparent 60%), radial-gradient(ellipse 60% 70% at 100% 80%, rgb(var(--ts-purple-deep) / 0.5), transparent 55%), var(--ts-panel)';

export default function Landing({ onRequireAuth, entitlementAvailability }: Props) {
  const sheet = SHEET_KEYS
    .map((k) => TAB_PRICING.find((t) => t.key === k))
    .filter((t): t is (typeof TAB_PRICING)[number] => t != null);
  const modules = sheet.filter((t) => t.key !== 'bundle:all');
  const bundle = sheet.find((t) => t.key === 'bundle:all');

  return (
    <div className="min-h-screen bg-panel text-white">
      {/* ── Header — institutional dark: panel base, hairline border ───────── */}
      <header className="border-b border-panel-border bg-panel">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white flex items-center justify-center">
                <span className="text-brand-purple font-bold text-terminal-lg">TS</span>
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">Temple Stuart</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-white/50">Founder&apos;s Back Office</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/how-pricing-works" className="text-xs text-white/60 hover:text-white hidden sm:block">
                Pricing
              </Link>
              <a href="mailto:astuart@templestuart.com" className="text-xs text-white/60 hover:text-white hidden sm:block">
                Contact
              </a>
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-4 py-2 text-xs bg-white text-brand-purple font-medium hover:bg-bg-row"
              >
                Create free account
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero — the house Bloomberg treatment; copy + CTAs verbatim ─────── */}
      <section className="text-white pb-14 pt-12" style={{ background: HERO_BG }}>
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Track your money.<br />
              Plan your life.<br />
              <span className="text-white/50">Act smarter.</span>
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Link
                href="/?tab=travel"
                className="px-6 py-3 bg-white text-brand-purple font-medium hover:bg-bg-row text-sm text-center"
              >
                Try it live — search real flights &amp; hotels. No account needed.
              </Link>
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-6 py-3 border border-white/40 text-white font-medium hover:bg-white/10 text-sm"
              >
                Create free account
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── The nine pillars — table-density dark cards ────────────────────── */}
      <section className="w-full border-b border-panel-border bg-panel">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
            The nine pillars
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PILLAR_CARDS.map((p) => (
              <div key={p.id} className="flex flex-col rounded-lg border border-panel-border bg-panel-surface p-4 transition-colors hover:bg-panel-hover">
                <span className="self-start rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  {p.label}
                </span>
                <p className="mt-2 text-xs leading-relaxed text-white/60">{DESCRIPTORS[p.id]}</p>
                <ul className="mt-3 space-y-1">
                  {p.bullets.map((b, i) => (
                    <li key={i} className={`text-xs leading-relaxed ${i === 0 ? 'font-medium text-white' : 'text-white/60'}`}>
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/?tab=${p.tab}`}
                  className="mt-auto pt-3 font-mono text-xs font-medium text-white hover:text-white/70"
                >
                  Explore {p.label} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODULE SHEET — select what you need; every field from TAB_PRICING
            (pricing-costs.ts:341-371); sheet heading + sub-line + price
            fallback + billing line + disabled copy LIFTED from /pricing
            (PricingClient.tsx :210-213, :241-246, :264). ─────────────────── */}
      <section className="w-full border-b border-panel-border bg-panel-surface">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Modules
          </p>
          <h2 className="text-2xl font-light tracking-tight text-white">
            Buy the modules you&apos;ll use. One, some, or all.
          </h2>
          <p className="mt-2 max-w-2xl text-xs text-white/60">
            Each module is a separate subscription — pay for a module and the whole module works.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((m) => {
              const available = entitlementAvailability[m.key] === true;
              return (
                <div key={m.key} className="flex flex-col rounded-lg border border-panel-border bg-panel p-4">
                  <span className="self-start rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
                    {m.label}
                  </span>
                  <div className="mt-3 font-mono text-lg font-bold text-white">
                    {m.monthlyPrice !== null ? (
                      <>${m.monthlyPrice}<span className="text-xs font-normal text-white/50">/mo</span></>
                    ) : (
                      <span className="text-xs font-normal italic text-white/50" title="Display price not entered yet — Stripe shows the real price at checkout">
                        price shown at checkout
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                    Billed monthly · cancel anytime
                  </div>
                  <p className="mt-3 mb-4 text-xs leading-relaxed text-white/60">Unlocks {m.unlocks}.</p>
                  {available ? (
                    <Link
                      href={`/pricing?module=${encodeURIComponent(m.key)}`}
                      className="mt-auto block w-full bg-white px-4 py-2 text-center text-xs font-medium text-brand-purple hover:bg-bg-row"
                    >
                      Select {m.label} →
                    </Link>
                  ) : (
                    // Honest partial-Stripe state, mirrored from PricingClient
                    // :256-266: no configured price → no functional action.
                    <button
                      type="button"
                      disabled
                      title="This module's Stripe price isn't configured yet"
                      className="mt-auto w-full cursor-not-allowed border border-panel-border px-4 py-2 text-xs font-medium text-white/40"
                    >
                      Not yet available
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {bundle && (
            <div className="mt-3 flex flex-col gap-4 rounded-lg border border-white/30 bg-panel p-4 sm:flex-row sm:items-center">
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
        </div>
      </section>

      {/* ── Transparent pricing — audited facts only (pricing-costs.ts:70,
            :80, :308/:315; heading + honesty line from /how-pricing-works
            :98, :101-103) — dark regrade, mono numerals. ──────────────────── */}
      <section className="w-full border-b border-panel-border bg-panel">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Cost transparency
          </p>
          <h2 className="text-2xl font-light tracking-tight text-white">
            Every price, traced to a real bill.
          </h2>
          <p className="mt-2 max-w-2xl text-xs text-white/60">
            Costs are entered from real invoices; a cell that hasn&apos;t been filled yet says so
            instead of showing a made-up number.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-panel-border bg-panel-surface p-4">
              <p className="font-mono text-lg font-bold text-white">$550/mo</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                Finnhub — the market-data subscription behind Trade. Entered from the real invoice.
              </p>
            </div>
            <div className="rounded-lg border border-panel-border bg-panel-surface p-4">
              <p className="font-mono text-lg font-bold text-white">$0</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                TastyTrade — users connect their own TastyTrade account; the platform pays nothing.
              </p>
            </div>
            <div className="rounded-lg border border-panel-border bg-panel-surface p-4">
              <p className="font-mono text-lg font-bold text-white">Zero external APIs</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                Tax and the Hub Calendar run entirely on our own database and code — verified in the
                cost audit.
              </p>
            </div>
          </div>
          <Link
            href="/how-pricing-works"
            className="mt-5 inline-block font-mono text-xs font-medium text-white hover:text-white/70"
          >
            See the full cost breakdown →
          </Link>
        </div>
      </section>

      {/* ── CPA disclaimer — copy carried verbatim from page.tsx :202-207 ──── */}
      <section className="bg-brand-purple-deep py-8">
        <div className="max-w-3xl mx-auto px-4 lg:px-8 text-center">
          <p className="text-xs text-white/50 leading-relaxed">
            Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor.
            All tax figures generated by this platform are estimates for informational purposes only
            and must be verified by a qualified tax professional before filing.
            Use of this software does not constitute tax advice.
          </p>
        </div>
      </section>

      {/* ── Footer — legal + Pricing carry over; dark regrade ──────────────── */}
      <footer className="border-t border-panel-border bg-brand-purple-deep text-white py-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white flex items-center justify-center">
                <span className="text-brand-purple font-bold text-sm">TS</span>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-white/50">© 2026 Temple Stuart, LLC</div>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/how-pricing-works" className="text-xs text-white/50 hover:text-white/80">Pricing</Link>
              <a href="/terms" className="text-xs text-white/50 hover:text-white/80">Terms of Service</a>
              <a href="/privacy" className="text-xs text-white/50 hover:text-white/80">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

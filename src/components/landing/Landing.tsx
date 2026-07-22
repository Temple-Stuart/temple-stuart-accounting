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
 * Hero copy + both CTAs remain RULED-verbatim. Card bullets remain the FD-1b
 * verbatim deck-heading lifts (provenance in the PILLAR_CARDS comment).
 */

import Link from 'next/link';
import { TAB_PRICING } from '@/config/pricing-costs';
import { TAB_DESCRIPTORS } from '@/lib/tabDescriptors';
import LandingHeader from './LandingHeader';
import LandingFooter from './LandingFooter';

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
  /** LIFTED VERBATIM from the deck's own headings — provenance per string: */
  bullets: string[];
}

const FREE_WITH_ACCOUNT = 'Free with a free account';
const FREE_NO_ACCOUNT = 'Free — search works with no account';

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
    id: 'travel', label: 'Travel', tab: 'travel', freeLabel: FREE_NO_ACCOUNT,
    bullets: [
      'Search it. Price it. Book it. No account required to look.',
      'Real searches, free by design.',
      'Hotels: book as a guest — the one complete flow.',
    ],
  },
  {
    id: 'runway', label: 'Runway', tab: 'calendar', freeLabel: FREE_WITH_ACCOUNT,
    bullets: [
      'Every system you’re juggling. One question answered: how long can you keep going?',
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
    id: 'routines', label: 'Routines', tab: 'routines', freeLabel: FREE_WITH_ACCOUNT,
    bullets: [
      'Build it once. It shows up everywhere.',
      'A routine is executable — steps you actually run.',
      'Every day answers: what’s due, what’s done, what slipped.',
    ],
  },
  {
    id: 'projects', label: 'Projects', tab: 'projects', freeLabel: FREE_WITH_ACCOUNT,
    bullets: [
      'Goals in. Audited tasks out.',
    ],
  },
  {
    id: 'content', label: 'Content', tab: 'content', freeLabel: FREE_WITH_ACCOUNT,
    bullets: [
      'Your day becomes the script.',
      'Every step gets a shot, a question, a purpose.',
      'The script only says what happened.',
    ],
  },
];

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

  return (
    <div className="min-h-screen bg-panel text-white">
      <LandingHeader onRequireAuth={onRequireAuth} />

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

      {/* ── The nine pillars — Explore lands on the shareable module page ──── */}
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
                <p className="mt-2 text-xs leading-relaxed text-white/60">{TAB_DESCRIPTORS[p.tab]}</p>
                <ul className="mt-3 space-y-1">
                  {p.bullets.map((b, i) => (
                    <li key={i} className={`text-xs leading-relaxed ${i === 0 ? 'font-medium text-white' : 'text-white/60'}`}>
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/modules/${p.id}`}
                  className="mt-auto pt-3 font-mono text-xs font-medium text-white hover:text-white/70"
                >
                  Explore {p.label} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODULE SHEET — ALL NINE, honestly: entitlement modules render
            TAB_PRICING (pricing-costs.ts:341-371) + availability-honest
            Select; the free five state their true access + Learn more.
            Heading/sub-line/price-fallback/billing/disabled copy lifted from
            /pricing (PricingClient.tsx :210-213, :241-246, :264). ──────────── */}
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
          <div className="mt-6 overflow-x-auto rounded-lg border border-panel-border bg-panel">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-panel-border text-left font-mono text-[10px] uppercase tracking-wider text-white/40">
                  <th className="px-4 py-2 font-semibold">Module</th>
                  <th className="px-4 py-2 font-semibold">What you get</th>
                  <th className="px-4 py-2 font-semibold text-right">Monthly</th>
                  <th className="px-4 py-2 font-semibold text-right"></th>
                </tr>
              </thead>
              <tbody>
                {PILLAR_CARDS.map((p) => {
                  const pricing = p.entitlementKey ? pricingByKey.get(p.entitlementKey) : undefined;
                  const available = p.entitlementKey ? entitlementAvailability[p.entitlementKey] === true : false;
                  return (
                    <tr key={p.id} className="border-b border-panel-border last:border-0">
                      <td className="px-4 py-3 align-top">
                        <span className="rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70 whitespace-nowrap">
                          {p.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-xs leading-relaxed text-white/60">
                        {pricing ? <>Unlocks {pricing.unlocks}.</> : p.freeLabel}
                      </td>
                      <td className="px-4 py-3 align-top text-right font-mono text-sm font-bold text-white whitespace-nowrap">
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
                      </td>
                      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
            :98, :101-103). ───────────────────────────────────────────────── */}
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

      <LandingFooter />
    </div>
  );
}

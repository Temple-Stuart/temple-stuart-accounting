'use client';

/**
 * ModulePageClient (FD-1d) — the shareable module info page body: Bloomberg
 * header → THE DECK, standalone and AS-BUILT ("just the deck, no pipes under
 * them" — no tab bar, no ModuleLauncher, no live search stacks) → the honest
 * access block → the shared footer.
 *
 * Deck mounts reuse the FD-1 portability shapes verbatim: the five thesis
 * decks take { onRequireAuth } (ML :543,:565,:588,:676,:697); the four paid
 * wrappers take { currentUserId:'', onRequireAuth } (ML :899,:959,:976,:994).
 * All decks load via next/dynamic {ssr:false} (FlightCheckoutPanel.tsx:25-31
 * pattern) so each page ships only its own deck chunk.
 *
 * ACCESS BLOCK TRUTH (per the FD-1d audit):
 *   • the four entitlement modules (trade/books/tax/compliance — the ONLY
 *     tab-gated pillars, categoryLock.ts:28-30 via ML :259-262) render
 *     TAB_PRICING price-or-fallback + the server-computed availability →
 *     Select links /pricing?module=<key> (PricingClient owns login-resume,
 *     :143-182) or the disabled "Not yet available" (PricingClient :256-266);
 *   • travel: free, guest-usable — its search/booking routes are PUBLIC
 *     (middleware.ts:70-94) and its deck's own eyebrow says "no account
 *     required" (TravelShowcaseSections.tsx:324) → CTA = the live tools;
 *   • runway/routines/projects/content: free with a free account — their real
 *     builders are auth-gated but carry NO entitlement gate (isTabLocked
 *     wraps only the four, ML :259-262) and NO tier gate (modules are not
 *     tier features — tiers.ts TRUTH-LABELS :4-17) → CTA links /pricing,
 *     whose "Get Started Free" opens account creation.
 *
 * On these pages every deck onRequireAuth routes to /pricing — no login modal
 * exists here, and /pricing is the real ask surface (see LandingHeader note).
 */

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { TAB_PRICING } from '@/config/pricing-costs';
import { TAB_DESCRIPTORS } from '@/lib/tabDescriptors';
// MOD-1: the pillar registry lives in a server-safe leaf now — defining it
// here ('use client') made the server page's PILLARS.find() a client-reference
// call that 500ed every /modules page (MOD-0).
import type { PillarDef } from '@/lib/modulePillars';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';

function deckLoading(label: string) {
  const DeckLoading = () => (
    <p className="px-4 py-10 text-center text-sm text-white/50">Loading {label}…</p>
  );
  DeckLoading.displayName = `DeckLoading(${label})`;
  return DeckLoading;
}

const TravelShowcase = dynamic(() => import('@/components/home/TravelShowcaseSections'), { ssr: false, loading: deckLoading('Travel') });
const RunwayShowcase = dynamic(() => import('@/components/home/RunwayShowcaseSections'), { ssr: false, loading: deckLoading('Runway') });
const RoutinesShowcase = dynamic(() => import('@/components/home/RoutinesShowcaseSections'), { ssr: false, loading: deckLoading('Routines') });
const ProjectsShowcase = dynamic(() => import('@/components/home/ProjectsShowcaseSections'), { ssr: false, loading: deckLoading('Projects') });
const ContentShowcase = dynamic(() => import('@/components/home/ContentShowcaseSections'), { ssr: false, loading: deckLoading('Content') });
const TradeShowcase = dynamic(() => import('@/components/home/TabShowcases').then((m) => m.TradeShowcase), { ssr: false, loading: deckLoading('Trade') });
const BooksShowcase = dynamic(() => import('@/components/home/TabShowcases').then((m) => m.BooksShowcase), { ssr: false, loading: deckLoading('Books') });
const TaxShowcase = dynamic(() => import('@/components/home/TabShowcases').then((m) => m.TaxShowcase), { ssr: false, loading: deckLoading('Tax') });
const ComplianceShowcase = dynamic(() => import('@/components/home/TabShowcases').then((m) => m.ComplianceShowcase), { ssr: false, loading: deckLoading('Compliance') });

type PlainDeck = ComponentType<{ onRequireAuth: () => void }>;
type WrappedDeck = ComponentType<{ currentUserId: string; onRequireAuth: () => void }>;

const PLAIN_DECKS: Record<string, PlainDeck> = {
  travel: TravelShowcase,
  runway: RunwayShowcase,
  routines: RoutinesShowcase,
  projects: ProjectsShowcase,
  content: ContentShowcase,
};
const WRAPPED_DECKS: Record<string, WrappedDeck> = {
  books: BooksShowcase,
  trade: TradeShowcase,
  tax: TaxShowcase,
  compliance: ComplianceShowcase,
};

export default function ModulePageClient({ pillar, availability }: {
  pillar: PillarDef;
  availability: Record<string, boolean>;
}) {
  const requireAuth = () => { window.location.href = '/pricing'; };
  const Plain = PLAIN_DECKS[pillar.id];
  const Wrapped = WRAPPED_DECKS[pillar.id];
  const pricing = pillar.entitlementKey
    ? TAB_PRICING.find((t) => t.key === pillar.entitlementKey)
    : undefined;
  const available = pillar.entitlementKey ? availability[pillar.entitlementKey] === true : false;

  return (
    <div className="min-h-screen bg-panel text-white">
      <LandingHeader />

      {/* ── THE DECK — standalone, as-built ────────────────────────────────── */}
      <section className="w-full border-b border-panel-border bg-panel">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
            {pillar.label}
          </p>
          <p className="mb-6 max-w-2xl text-xs text-white/60">{TAB_DESCRIPTORS[pillar.tab]}</p>
          {Plain && <Plain onRequireAuth={requireAuth} />}
          {Wrapped && <Wrapped currentUserId="" onRequireAuth={requireAuth} />}
        </div>
      </section>

      {/* ── ACCESS — the honest block per pillar class ─────────────────────── */}
      <section className="w-full border-b border-panel-border bg-panel-surface">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Access
          </p>
          {pricing ? (
            <div className="flex flex-col gap-4 rounded-lg border border-panel-border bg-panel p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <span className="rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  {pricing.label}
                </span>
                <p className="mt-2 text-xs leading-relaxed text-white/60">Unlocks {pricing.unlocks}.</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-white/40">
                  Billed monthly · cancel anytime
                </p>
              </div>
              <div className="font-mono text-lg font-bold text-white">
                {pricing.monthlyPrice !== null ? (
                  <>${pricing.monthlyPrice}<span className="text-xs font-normal text-white/50">/mo</span></>
                ) : (
                  <span className="text-xs font-normal italic text-white/50" title="Display price not entered yet — Stripe shows the real price at checkout">
                    price shown at checkout
                  </span>
                )}
              </div>
              {available ? (
                <Link
                  href={`/pricing?module=${encodeURIComponent(pricing.key)}`}
                  className="bg-white px-6 py-2 text-center text-xs font-medium text-brand-purple hover:bg-bg-row"
                >
                  Select {pricing.label} →
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title="This module's Stripe price isn't configured yet"
                  className="cursor-not-allowed border border-panel-border px-6 py-2 text-xs font-medium text-white/40"
                >
                  Not yet available
                </button>
              )}
            </div>
          ) : pillar.id === 'travel' ? (
            // DECKS-3 (ruling 3): paid framing — the ONE surviving free claim
            // is the home-page search itself (its routes are public,
            // middleware.ts:81-100; guest booking is real). Capability copy
            // unchanged; only the free module framing died.
            <div className="flex flex-col gap-4 rounded-lg border border-panel-border bg-panel p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <span className="rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  Paid module
                </span>
                <p className="mt-2 text-xs leading-relaxed text-white/60">
                  The full Travel module is paid. The live flight and hotel searches on the home
                  page stay free — search works with no account, and booking works as a guest.
                </p>
              </div>
              <Link
                href="/?tab=travel"
                className="bg-white px-6 py-2 text-center text-xs font-medium text-brand-purple hover:bg-bg-row"
              >
                Try it live — search real flights &amp; hotels. No account needed.
              </Link>
            </div>
          ) : (
            // DECKS-3 (ruling 3): paid framing for the remaining former-free
            // pillars. Honest about availability: none of these has a live
            // subscription yet (runway/routines/content have no entitlement
            // key; travel/operations keys await Stripe prices) — pricing
            // appears when it goes on sale.
            <div className="flex flex-col gap-4 rounded-lg border border-panel-border bg-panel p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <span className="rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  Paid module
                </span>
                <p className="mt-2 text-xs leading-relaxed text-white/60">
                  {pillar.label} is a paid module. Its subscription isn&apos;t on sale yet — pricing
                  appears here when it is.
                </p>
              </div>
              <Link
                href="/pricing"
                className="bg-white px-6 py-2 text-center text-xs font-medium text-brand-purple hover:bg-bg-row"
              >
                Create free account
              </Link>
            </div>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

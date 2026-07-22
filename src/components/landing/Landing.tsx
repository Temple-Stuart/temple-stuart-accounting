'use client';

/**
 * Landing (FD-1) — "the doctor's office": the guest-facing landing assembled
 * from the NINE completed showcase decks, funnel-ordered per Alex's ruling:
 * Travel → Runway → Books → Trade → Tax → Compliance → Routines → Projects →
 * Content. Value-first: the primary CTA routes to the LIVE guest travel tools
 * (/?tab=travel — the F2 deep link that works today); the account ask is
 * secondary and every deck CTA funnels through ONE onRequireAuth callback.
 *
 * REUSE, NOT REWRITE: every deck renders AS-BUILT with the exact prop shapes
 * of its ModuleLauncher/TabShowcases mount (FD audit) — zero deck-file edits:
 *   five thesis decks         { onRequireAuth }                (ML :543,:565,:588,:676,:697)
 *   four paid wrappers        { currentUserId:'', onRequireAuth } (ML :899,:959,:976,:994)
 * currentUserId '' is the wrappers' own guest value (ModuleLauncher.tsx:181).
 *
 * LAZY-MOUNT: hero + pillar strip + chrome are the ONLY eager code. All nine
 * decks (~7.4k lines of client TSX) load via next/dynamic {ssr:false} — the
 * FlightCheckoutPanel.tsx:25-31 house pattern — with an honest one-line
 * loading state, so none of it rides the first paint.
 *
 * DESCRIPTORS: the per-pillar one-liners are COPIED VERBATIM from
 * ModuleLauncher.tsx TAB_DESCRIPTORS (:153-163) — importing that binding would
 * pull ModuleLauncher's eager nine-deck import graph (:58-81) into this
 * bundle and defeat the lazy-mount constraint, and moving the constant out is
 * an ModuleLauncher edit FD-1 is barred from (0 lines). KEEP IN LOCKSTEP with
 * the source until a later PR extracts TAB_DESCRIPTORS to a shared leaf
 * module. No new marketing copy is invented here.
 *
 * This component owns NO routing/arrival behavior — page.tsx branches to it in
 * FD-2 and supplies the real register-modal opener as onRequireAuth.
 */

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

// ── the nine decks, all lazy (client-only) — none ride the first paint ──────
function deckLoading(label: string) {
  const DeckLoading = () => (
    <p className="px-4 py-10 text-center text-sm text-text-muted">Loading {label}…</p>
  );
  DeckLoading.displayName = `DeckLoading(${label})`;
  return DeckLoading;
}

const TravelShowcase = dynamic(() => import('@/components/home/TravelShowcaseSections'), {
  ssr: false, loading: deckLoading('Travel'),
});
const RunwayShowcase = dynamic(() => import('@/components/home/RunwayShowcaseSections'), {
  ssr: false, loading: deckLoading('Runway'),
});
const BooksShowcase = dynamic(() => import('@/components/home/TabShowcases').then((m) => m.BooksShowcase), {
  ssr: false, loading: deckLoading('Books'),
});
const TradeShowcase = dynamic(() => import('@/components/home/TabShowcases').then((m) => m.TradeShowcase), {
  ssr: false, loading: deckLoading('Trade'),
});
const TaxShowcase = dynamic(() => import('@/components/home/TabShowcases').then((m) => m.TaxShowcase), {
  ssr: false, loading: deckLoading('Tax'),
});
const ComplianceShowcase = dynamic(() => import('@/components/home/TabShowcases').then((m) => m.ComplianceShowcase), {
  ssr: false, loading: deckLoading('Compliance'),
});
const RoutinesShowcase = dynamic(() => import('@/components/home/RoutinesShowcaseSections'), {
  ssr: false, loading: deckLoading('Routines'),
});
const ProjectsShowcase = dynamic(() => import('@/components/home/ProjectsShowcaseSections'), {
  ssr: false, loading: deckLoading('Projects'),
});
const ContentShowcase = dynamic(() => import('@/components/home/ContentShowcaseSections'), {
  ssr: false, loading: deckLoading('Content'),
});

// COPIED VERBATIM from ModuleLauncher.tsx TAB_DESCRIPTORS (:153-163) — see the
// header note. Keys renamed to the funnel's pillar ids; strings byte-identical.
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

interface Props {
  /** The ONE account-ask funnel — every deck CTA and the secondary hero CTA
   *  call this. FD-2 supplies the real register-modal opener; the preview
   *  route supplies a stub. No auth UI lives in this component. */
  onRequireAuth: () => void;
}

/** A pillar mounts its deck AS-BUILT. `needsUserId: true` marks the four paid
 *  wrappers whose mount shape is { currentUserId, onRequireAuth } — the
 *  discriminant lets TS check each mount against its real prop shape. */
type Pillar =
  | { id: string; label: string; needsUserId?: false; Deck: ComponentType<{ onRequireAuth: () => void }> }
  | { id: string; label: string; needsUserId: true; Deck: ComponentType<{ currentUserId: string; onRequireAuth: () => void }> };

// Funnel order — Alex's ruling, not tab order.
const PILLARS: Pillar[] = [
  { id: 'travel', label: 'Travel', Deck: TravelShowcase },
  { id: 'runway', label: 'Runway', Deck: RunwayShowcase },
  { id: 'books', label: 'Books', Deck: BooksShowcase, needsUserId: true },
  { id: 'trade', label: 'Trade', Deck: TradeShowcase, needsUserId: true },
  { id: 'tax', label: 'Tax', Deck: TaxShowcase, needsUserId: true },
  { id: 'compliance', label: 'Compliance', Deck: ComplianceShowcase, needsUserId: true },
  { id: 'routines', label: 'Routines', Deck: RoutinesShowcase },
  { id: 'projects', label: 'Projects', Deck: ProjectsShowcase },
  { id: 'content', label: 'Content', Deck: ContentShowcase },
];

export default function Landing({ onRequireAuth }: Props) {
  return (
    <div className="min-h-screen bg-bg-terminal">
      {/* ── Header — lifted from page.tsx :96-139, token-native ────────────── */}
      <header className="bg-brand-purple text-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white flex items-center justify-center">
                <span className="text-brand-purple font-bold text-terminal-lg">TS</span>
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">Temple Stuart</div>
                <div className="text-[10px] text-text-faint">Founder&apos;s Back Office</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/how-pricing-works" className="text-xs text-text-faint hover:text-white hidden sm:block">
                Pricing
              </Link>
              <a href="mailto:astuart@templestuart.com" className="text-xs text-text-faint hover:text-white hidden sm:block">
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

      {/* ── Hero — value first, ask second ─────────────────────────────────── */}
      <section className="bg-brand-purple text-white pb-12 pt-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Track your money.<br />
              Plan your life.<br />
              <span className="text-text-faint">Act smarter.</span>
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* PRIMARY: real value, zero account — the live guest travel tools
                  via the F2 ?tab= deep link (works today). */}
              <Link
                href="/?tab=travel"
                className="px-6 py-3 bg-white text-brand-purple font-medium hover:bg-bg-row text-sm text-center"
              >
                Try it live — search real flights &amp; hotels. No account needed.
              </Link>
              {/* SECONDARY: the account ask — routed through the ONE funnel. */}
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

      {/* ── Pillar strip — slim sticky anchor nav over the nine sections ───── */}
      <nav className="sticky top-0 z-30 border-b border-border bg-white">
        <div className="max-w-7xl mx-auto flex overflow-x-auto px-4 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PILLARS.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-medium text-text-muted transition-colors hover:border-brand-purple hover:text-brand-purple"
            >
              {p.label}
            </a>
          ))}
        </div>
      </nav>

      {/* ── The nine decks, funnel-ordered, each in a thin token-native frame ─ */}
      {PILLARS.map((p, i) => (
        <section
          key={p.id}
          id={p.id}
          className={`w-full border-b border-border ${i % 2 === 1 ? 'bg-bg-row' : 'bg-white'} scroll-mt-12`}
        >
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="mb-4 max-w-3xl">
              <h2 className="text-lg font-semibold text-text-primary">{p.label}</h2>
              <p className="mt-1 text-sm text-text-secondary">{DESCRIPTORS[p.id]}</p>
            </div>
            {p.needsUserId ? (
              <p.Deck currentUserId="" onRequireAuth={onRequireAuth} />
            ) : (
              <p.Deck onRequireAuth={onRequireAuth} />
            )}
          </div>
        </section>
      ))}

      {/* ── CPA disclaimer — copy carried verbatim from page.tsx :202-207 ──── */}
      <section className="bg-brand-purple py-8">
        <div className="max-w-3xl mx-auto px-4 lg:px-8 text-center">
          <p className="text-xs text-text-faint leading-relaxed">
            Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor.
            All tax figures generated by this platform are estimates for informational purposes only
            and must be verified by a qualified tax professional before filing.
            Use of this software does not constitute tax advice.
          </p>
        </div>
      </section>

      {/* ── Footer — adapted from page.tsx :212-259; legal + Pricing carry over ─ */}
      <footer className="bg-brand-purple text-white py-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white flex items-center justify-center">
                <span className="text-brand-purple font-bold text-sm">TS</span>
              </div>
              <div className="text-xs text-text-faint">© 2026 Temple Stuart, LLC</div>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/how-pricing-works" className="text-xs text-text-muted hover:text-text-faint">Pricing</Link>
              <a href="/terms" className="text-xs text-text-muted hover:text-text-faint">Terms of Service</a>
              <a href="/privacy" className="text-xs text-text-muted hover:text-text-faint">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

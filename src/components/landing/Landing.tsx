'use client';

/**
 * Landing (FD-1 → FD-1b) — "the doctor's office", slimmed per Alex's verdict on
 * FD-1: nine full decks stacked = the same overwhelm as the nine-tab arrival.
 * The lobby GREETS and POINTS: nine pillar CARDS in funnel order (Travel →
 * Runway → Books → Trade → Tax → Compliance → Routines → Projects → Content) +
 * a transparent-pricing band. The decks stay in their tabs, where every
 * "Explore →" lands on them for real (TAB-SHOW-AND-GATE guest mounts +
 * the F2 ?tab= deep link, ModuleLauncher.tsx:204-231).
 *
 * NO INVENTED COPY: every card renders (a) the pillar descriptor — COPIED
 * VERBATIM from ModuleLauncher.tsx TAB_DESCRIPTORS (:153-163); importing that
 * binding would pull ModuleLauncher's eager nine-deck import graph (:58-81)
 * into this bundle, and moving the constant is a ModuleLauncher edit this PR
 * is barred from — KEEP IN LOCKSTEP until TAB_DESCRIPTORS is extracted to a
 * shared leaf module; and (b) up to 3 bullets LIFTED VERBATIM from the deck's
 * own truth-audited headings (file:line cited per bullet at the data below).
 * The pricing band renders only audited facts from src/config/pricing-costs.ts
 * and lines lifted from /how-pricing-works itself.
 *
 * FD-1b removes the nine next/dynamic deck mounts entirely — the landing is
 * now small and fully eager; no deck code loads here at all.
 *
 * This component owns NO routing/arrival behavior — page.tsx branches to it in
 * FD-2 and supplies the real register-modal opener as onRequireAuth.
 */

import Link from 'next/link';

// COPIED VERBATIM from ModuleLauncher.tsx TAB_DESCRIPTORS (:153-163) — see the
// header note. Keys are the funnel's pillar ids; strings byte-identical.
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

interface Props {
  /** The ONE account-ask funnel — the header/hero secondary CTA. FD-2 supplies
   *  the real register-modal opener; the preview route supplies a stub. */
  onRequireAuth: () => void;
}

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

      {/* ── Hero — value first, ask second (unchanged from FD-1) ───────────── */}
      <section className="bg-brand-purple text-white pb-12 pt-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Track your money.<br />
              Plan your life.<br />
              <span className="text-text-faint">Act smarter.</span>
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

      {/* ── The nine pillars — cards, not decks. Explore lands on the REAL
            guest deck in its tab (TAB-SHOW-AND-GATE + the F2 ?tab= link). ──── */}
      <section className="w-full bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLAR_CARDS.map((p) => (
              <div key={p.id} className="flex flex-col rounded-lg border border-border bg-bg-row p-5">
                <h2 className="text-base font-semibold text-text-primary">{p.label}</h2>
                <p className="mt-1 text-sm text-text-secondary">{DESCRIPTORS[p.id]}</p>
                <ul className="mt-3 space-y-1.5">
                  {p.bullets.map((b, i) => (
                    <li key={i} className={`text-sm ${i === 0 ? 'font-medium text-text-primary' : 'text-text-muted'}`}>
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/?tab=${p.tab}`}
                  className="mt-auto pt-4 text-sm font-medium text-brand-purple hover:text-brand-purple/80"
                >
                  Explore {p.label} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Transparent pricing — audited facts only, from pricing-costs.ts
            (Finnhub :70; TastyTrade note :80; Tax/Hub-Calendar zero-API
            :308/:315) + lines lifted from /how-pricing-works (:98, :101-103). ── */}
      <section className="w-full bg-bg-row border-b border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <h2 className="text-2xl font-light tracking-tight text-text-primary">
            Every price, traced to a real bill.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Costs are entered from real invoices; a cell that hasn&apos;t been filled yet says so
            instead of showing a made-up number.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-white p-4">
              <p className="text-lg font-semibold text-text-primary">$550/mo</p>
              <p className="mt-1 text-sm text-text-secondary">
                Finnhub — the market-data subscription behind Trade. Entered from the real invoice.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-4">
              <p className="text-lg font-semibold text-text-primary">$0</p>
              <p className="mt-1 text-sm text-text-secondary">
                TastyTrade — users connect their own TastyTrade account; the platform pays nothing.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-4">
              <p className="text-lg font-semibold text-text-primary">Zero external APIs</p>
              <p className="mt-1 text-sm text-text-secondary">
                Tax and the Hub Calendar run entirely on our own database and code — verified in the
                cost audit.
              </p>
            </div>
          </div>
          <Link
            href="/how-pricing-works"
            className="mt-5 inline-block text-sm font-medium text-brand-purple hover:text-brand-purple/80"
          >
            See the full cost breakdown →
          </Link>
        </div>
      </section>

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

'use client';

import { Fragment, useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import LoginBox from '@/components/LoginBox';
import ModuleLauncher from '@/components/home/ModuleLauncher';
// ONE-BAND: the per-tab module band copy (headline + ✓ chips) — the hero IS
// the module band now, so it reads the same single source (leaf module,
// lockstep with the deck's PILLAR_CARDS).
import { MODULE_BANDS } from '@/lib/moduleBands';
import { Check } from 'lucide-react';
// DS-2: the app hero uses the SAME radial-glow surface as the landing hero.
// REPAINT-3: the HERO_BG import died — the hero is a solid aubergine band
// (HOME-HERO-PARITY holds: the landing hero made the same move in REPAINT-2).
import CheckoutResultBanner from '@/components/CheckoutResultBanner';
import { useExportDownload } from '@/lib/useExportDownload';

// BANDS-TRIM: the per-tab "How it works" disclosure (PR-Hero-Collapsible)
// RETIRED with the band's descriptor sub-line — the band is h1 + proof
// chips only now. The three step-lists (projects / calendar / routines)
// live in git history; TAB_DESCRIPTORS survives in its leaf for the
// logged-out pointer cards (ModulePointerCard.tsx:32).

export default function HomeClient() {
  const { data: session } = useSession();
  const [showLogin, setShowLogin] = useState(false);
  // PR-Hero-PerTab: the hero subhead swaps with the active tab. ModuleLauncher owns the
  // tabs and reports the active one via onTabChange; this mirror drives the hero copy.
  // Default 'calendar' matches ModuleLauncher's initial tab (no flash, no mismatch).
  const [activeTab, setActiveTab] = useState('calendar');
  // PR-Auth-Home: login from the home page lands back on the home tabs (in logged-in
  // mode), not the old /hub cockpit. (Other /hub entry points are a separate retire PR.)
  const [loginRedirect] = useState('/');
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');

  // PR-Auth-Home: the home shell now learns who's logged in (same /api/auth/me check the
  // rest of the app uses) so the header can switch Enter ↔ Log out. null = still loading
  // (render a neutral placeholder, never flash the wrong action); true/false once resolved.
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [userLabel, setUserLabel] = useState('');
  // EXPORT-1b: the header export chip — shared behavior with the Books-tab button.
  const { busy: exportBusy, error: exportError, run: runExport } = useExportDownload();
  // PR-PRICE-3: "Manage subscription" relocated here from the dead /pricing
  // page — the EXPORT-1b rationale verbatim: this header user area is the one
  // authed surface with no entitlement in front of it (no settings/account
  // page exists), and billing must reach EVERY subscriber regardless of which
  // module they hold. Same portal flow PricingClient ran (POST
  // /api/stripe/portal → Stripe's hosted portal); errors render inline like
  // the export chip's — fail-loud, no alert().
  const [manageBusy, setManageBusy] = useState(false);
  const [manageError, setManageError] = useState('');
  const openBillingPortal = async () => {
    setManageError('');
    setManageBusy(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not open the billing portal');
      }
      window.location.href = data.url;
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Could not open the billing portal');
      setManageBusy(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (res) => {
        if (cancelled) return;
        setAuthed(res.ok);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const u = data?.user;
          if (u) setUserLabel(u.name || u.email?.split('@')[0] || '');
        }
      })
      .catch(() => { if (!cancelled) setAuthed(false); });
    return () => { cancelled = true; };
  }, []);

  // PR-Auth-Home: log out from the home header — the SAME recipe the app shell uses
  // (AppLayout.handleSignOut): clear the cookie-auth cookie, sign out of next-auth if
  // there's a session, otherwise hit the clear-cookie route. End on the home page,
  // logged out (a full load so the header + tabs reflect the guest state cleanly).
  const handleSignOut = async () => {
    document.cookie = 'userEmail=; path=/; max-age=0';
    if (session) {
      await signOut({ callbackUrl: '/' });
    } else {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    }
  };

  return (
    // FD-3 → REPAINT-3: the shell canvas returns to the cream paper (Direction
    // C) — bg-page died with the dark chrome. Each tab body still sets its OWN
    // surface; the remaining dark tab interiors are the declared Slice-4
    // islands.
    <div className="min-h-screen bg-bg-terminal">
      {/* UNLOCK-BANNER: authed landing — the same checkout result card the
          guest landing mounts (the purchase resume returns to '/'). */}
      <CheckoutResultBanner />
      {/* Header — FD-3-2: joins the panel family, mirroring LandingHeader
          (border-b border-border bg-white text-text-primary; mono micro sub-
          line; text-text-muted nav links). It stays distinct from the hero via
          the lavender HAIRLINE, not a different colour. */}
      <header className="border-b border-border bg-white text-text-primary">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white flex items-center justify-center">
                <span className="text-brand-purple font-bold text-terminal-lg">TS</span>
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">Temple Stuart</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-text-faint">Founder&apos;s Back Office</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/how-pricing-works" className="text-xs text-text-muted hover:text-text-primary hidden sm:block">
                Pricing
              </Link>
              <a href="mailto:astuart@templestuart.com" className="text-xs text-text-muted hover:text-text-primary hidden sm:block">
                Contact
              </a>
              {/* PR-Auth-Home: logged in → name + Log out; logged out → Enter →. While auth
                  is still resolving (authed === null), show an invisible placeholder so the
                  header never flashes the wrong action or shifts width. */}
              {authed === null ? (
                <span className="px-4 py-2.5 text-sm opacity-0 select-none" aria-hidden="true">Enter →</span>
              ) : authed ? (
                <>
                  {/* EXPORT-1b: the export must reach EVERY authed user, not just
                      tab:books holders — the only prior mount sat inside the
                      entitlement-locked BooksPipeline. This header user area is
                      the one authed surface with no entitlement in front of it
                      (no settings/account page exists). Same behavior as the
                      CPA-context button via the shared useExportDownload hook;
                      visible at all breakpoints (mobile users export too). The
                      error renders inline, truncated with the full message in
                      title — fail-loud, layout-stable. */}
                  {exportError && (
                    <span role="alert" title={exportError} className="max-w-[14rem] truncate text-xs text-rose-400">
                      {exportError}
                    </span>
                  )}
                  <button
                    onClick={runExport}
                    disabled={exportBusy}
                    title="Download every financial + travel table you own — one CSV per table, zipped. Never paywalled."
                    className="text-xs text-text-muted hover:text-text-primary disabled:opacity-60"
                  >
                    {exportBusy ? 'Preparing export…' : 'Export my data'}
                  </button>
                  {/* PR-PRICE-3: the relocated /pricing "Manage existing
                      subscription" — same link idiom as the export chip. */}
                  {manageError && (
                    <span role="alert" title={manageError} className="max-w-[14rem] truncate text-xs text-rose-400">
                      {manageError}
                    </span>
                  )}
                  <button
                    onClick={openBillingPortal}
                    disabled={manageBusy}
                    title="Open the Stripe billing portal — view, update, or cancel your subscriptions."
                    className="text-xs text-text-muted hover:text-text-primary disabled:opacity-60"
                  >
                    {manageBusy ? 'Opening portal…' : 'Manage subscription'}
                  </button>
                  {userLabel && (
                    <span className="text-xs text-text-muted hidden sm:block">{userLabel}</span>
                  )}
                  <button onClick={handleSignOut}
                    className="px-4 py-2.5 text-sm bg-white text-brand-purple font-medium hover:bg-bg-row">
                    Log out
                  </button>
                </>
              ) : (
                <button onClick={() => { setLoginMode('login'); setShowLogin(true); }}
                  className="px-4 py-2.5 text-sm bg-brand-purple text-white font-medium hover:bg-brand-purple-hover">
                  Enter →
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero — DS-2 → REPAINT-3 → ONE-BAND: the app hero IS the module band
          now (the second purple band under the tab bar retired — every tab
          renders exactly ONE purple headline surface). SOLID bg-brand-purple
          band, cream headline (text-ts-white); section padding (pb-8 pt-6)
          stays. The marketing tri-line retired from the app — it remains
          landing copy for guests (Landing.tsx hero, mounted via GuestLanding).
          Content = the ACTIVE tab's band config (MODULE_BANDS leaf — the same
          strings the retired ModuleBand cards rendered), swapping on tab
          select exactly as the subtitle already does. */}
      <section className="bg-brand-purple text-white pb-8 pt-6">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="max-w-3xl">
            {/* ONE-BAND eyebrow: the module kicker in the ratified mock's
                grammar — "MODULE NN / NAME" (numbering = PILLAR_CARDS'
                canonical lifecycle order, MODULE-ORDER, via the moduleBands
                nums). Landing eyebrow mono idiom; ink =
                the band's own muted white tier (StageStrip's active num line,
                StageStrip.tsx:69). The old badge pill retired with the
                tri-line. No descriptor renders here: the band config carries
                none (MODULE_BANDS has plain + bullets only). */}
            {MODULE_BANDS[activeTab] && (
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white/60 mb-6">
                MODULE {MODULE_BANDS[activeTab].num} / {MODULE_BANDS[activeTab].name}
              </p>
            )}
            <h1 className="text-4xl sm:text-6xl font-bold leading-tight tracking-tight mb-6 text-ts-white">
              {MODULE_BANDS[activeTab]?.plain}
            </h1>
            {/* ONE-BAND chips: the band's ✓ chips, same config — the
                white-on-purple chip idiom byte-copied from the retired
                ModuleBand (row: ModuleLauncher's :180 row classes minus
                justify-center — the hero is left-aligned; chip span + Check:
                TradeTrustChip verbatim). flex-wrap = the 390px contract
                (chips wrap, no horizontal overflow). */}
            {MODULE_BANDS[activeTab] && (
              <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-white/80">
                {MODULE_BANDS[activeTab].bullets.map((fact, i) => (
                  <Fragment key={fact}>
                    {i > 0 && <span className="text-white/30" aria-hidden="true">|</span>}
                    <span className="flex items-center gap-1">
                      <Check className="h-3.5 w-3.5 shrink-0 text-white/80" strokeWidth={2.5} aria-hidden="true" />
                      {fact}
                    </span>
                  </Fragment>
                ))}
              </div>
            )}
            {/* BANDS-TRIM: the descriptor sub-line (TAB_DESCRIPTORS) and the
                "How it works:" disclosure RETIRED — the band is h1 + proof
                chips only; the chips' own mb-6 closes the rhythm to the CTA
                row below (nothing invented). */}
            {/* ROUTE-1b: "Get Started" is a REGISTER funnel — a guest pitch.
                It renders ONLY for verified guests (authed === false — the
                same /api/auth/me state the header's Enter↔Log-out branch
                reads). Signed-in users see no CTA (Alex: "why would we need
                to get started inside the app"). While auth resolves
                (authed === null) an invisible placeholder holds the space —
                the header's own no-flash idiom — so the hero never jumps. */}
            <div className="flex items-center gap-4">
              {authed === null ? (
                <span className="px-6 py-3 text-sm opacity-0 select-none" aria-hidden="true">Get Started</span>
              ) : authed === false ? (
                <button onClick={() => { setLoginMode('register'); setShowLogin(true); }}
                  className="px-6 py-3 bg-white text-brand-purple font-medium hover:bg-bg-row text-sm">
                  Get Started
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* HOME-PR-1: module launcher (additive, directly under the Hero). Travel
          is live + guest-usable (shared CreateTripForm; saving is register-gated
          via the existing LoginBox modal). The 5 paid pills are stubs. Nothing
          below is removed — old landing content is HOME-PR-2. */}
      <ModuleLauncher
        onRequireAuth={() => { setLoginMode('register'); setShowLogin(true); }}
        onTabChange={setActiveTab}
      />

      {/* CPA Disclaimer — FD-3-2: the panel family, mirroring LandingFooter's
          CPA row (bg-white + lavender hairline; text-text-faint). */}
      <section className="border-t border-border bg-white py-8">
        <div className="max-w-3xl mx-auto px-4 lg:px-8 text-center">
          <p className="text-xs text-text-faint leading-relaxed">
            Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor.
            All tax figures generated by this platform are estimates for informational purposes only
            and must be verified by a qualified tax professional before filing.
            Use of this software does not constitute tax advice.
          </p>
        </div>
      </section>

      {/* Social — FD-3-2: the panel family, mirroring LandingFooter's social
          row (bg-white + lavender hairline; mono micro copyright;
          white/50 icon links). */}
      <section className="border-t border-border bg-white text-text-primary py-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white flex items-center justify-center">
                <span className="text-brand-purple font-bold text-sm">TS</span>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-text-faint">© 2026 Temple Stuart, LLC</div>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://www.instagram.com/temple_stuart_accounting/" target="_blank" rel="noopener noreferrer"
                className="text-text-faint hover:text-text-primary transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="https://www.tiktok.com/@temple_stuart" target="_blank" rel="noopener noreferrer"
                className="text-text-faint hover:text-text-primary transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                </svg>
              </a>
              <a href="https://www.youtube.com/@Temple-Stuart" target="_blank" rel="noopener noreferrer"
                className="text-text-faint hover:text-text-primary transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <a href="https://x.com/Alex_Stuart_APS" target="_blank" rel="noopener noreferrer"
                className="text-text-faint hover:text-text-primary transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://www.linkedin.com/in/alexander-stuart-phi/" target="_blank" rel="noopener noreferrer"
                className="text-text-faint hover:text-text-primary transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <a href="/terms" className="text-xs text-text-faint hover:text-text-secondary">Terms of Service</a>
              <a href="/privacy" className="text-xs text-text-faint hover:text-text-secondary">Privacy Policy</a>
            </div>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogin(false)} />
          <div className="relative z-10">
            <LoginBox
              onClose={() => setShowLogin(false)}
              onSuccess={() => { window.location.href = '/'; }}
              redirectTo={loginRedirect}
              initialMode={loginMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}

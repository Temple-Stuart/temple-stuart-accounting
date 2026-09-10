'use client';

import { Fragment, useState, useEffect } from 'react';
import LoginBox from '@/components/LoginBox';
import ModuleLauncher from '@/components/home/ModuleLauncher';
// SHELL-02: the app's shell — ShellBar + the rail — for a signed-in viewer. The
// cockpit used to render its own marketing header instead, which is why /books,
// /trade, /tax and /travel wore a different chrome from every other page.
import AppLayout from '@/components/ui/AppLayout';
// SHELL-02: a GUEST on a cockpit path keeps the deck's own header — the same
// component the landing, /pricing and the /modules pages already mount. One
// language per audience; no third header, no new copy.
import LandingHeader from '@/components/landing/LandingHeader';
// SHELL-02: every tab opens in the Accounts shape — "STEP N · FAMILY", the
// step's title, one derived line. The step comes from the registry's own
// cockpit map (COCKPIT_PRIMARY_TOOL → stepOfTool), never a retyped list.
import StepOpener from '@/components/shell/StepOpener';
import { COCKPIT_PRIMARY_TOOL } from '@/lib/toolRegistry';
import { stepOfTool } from '@/lib/steps';
// DS-2: the app hero uses the SAME radial-glow surface as the landing hero.
// REPAINT-3: the HERO_BG import died — the hero is a solid aubergine band
// (HOME-HERO-PARITY holds: the landing hero made the same move in REPAINT-2).
import CheckoutResultBanner from '@/components/CheckoutResultBanner';
// SELL-02: the `?module=<key>` door on the authed landing, and the one checkout call.
import { moduleDoorPlan } from '@/lib/offer';
import { startEntitlementCheckout } from '@/lib/checkoutDoor';

// BANDS-TRIM: the per-tab "How it works" disclosure (PR-Hero-Collapsible)
// RETIRED with the band's descriptor sub-line — the band is h1 + proof
// chips only now. The three step-lists (projects / calendar / routines)
// live in git history; TAB_DESCRIPTORS survives in its leaf for the
// logged-out pointer cards (ModulePointerCard.tsx:32).

export default function HomeClient({ offerAvailability }: {
  /** SELL-02: per offer key, is its Stripe price id set — the server's env-presence read (page.tsx, [tab]/page.tsx); the locked cards render from it. */
  offerAvailability: Record<string, boolean>;
}) {
  const [showLogin, setShowLogin] = useState(false);
  // PR-Hero-PerTab: the hero subhead swaps with the active tab. ModuleLauncher owns the
  // tabs and reports the active one via onTabChange; this mirror drives the hero copy.
  // Default 'calendar' matches ModuleLauncher's initial tab (no flash, no mismatch).
  const [activeTab, setActiveTab] = useState('calendar');
  // PR-Auth-Home → NAV-01c: login from the home page lands on THE ANSWERS (/answers),
  // the post-login front door — the same door the /login page and /hub use.
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');

  // PR-Auth-Home: the home shell now learns who's logged in (same /api/auth/me check the
  // rest of the app uses) so the header can switch Enter ↔ Log out. null = still loading
  // (render a neutral placeholder, never flash the wrong action); true/false once resolved.
  const [authed, setAuthed] = useState<boolean | null>(null);
  // SELL-02: the `?module=<key>` door — a signed-in viewer goes straight to checkout; a guest
  // (the tab paths render this shell for guests too) gets the sign-up modal with the key
  // pending and checkout resumes after sign-up. Errors render loud; nothing retries.
  const [pendingBuyKey, setPendingBuyKey] = useState<string | null>(null);
  const [buyError, setBuyError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (res) => {
        if (cancelled) return;
        setAuthed(res.ok);
      })
      .catch(() => { if (!cancelled) setAuthed(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (authed === null) return;
    const plan = moduleDoorPlan(window.location.search, authed);
    if (plan.kind === 'checkout') {
      startEntitlementCheckout(plan.key)
        .then((url) => { window.location.href = url; })
        .catch((err: unknown) => setBuyError(err instanceof Error ? err.message : 'Could not start checkout'));
    } else if (plan.kind === 'register') {
      setPendingBuyKey(plan.key);
      setLoginMode('register');
      setShowLogin(true);
    }
  }, [authed]);

  // SHELL-02 — ONE HEADER, and which one depends on the audience:
  //   authed → AppLayout (ShellBar + the rail), the app's shell, the same one
  //            every other signed-in page wears;
  //   guest  → LandingHeader, the deck's own header (the landing, /pricing and
  //            the /modules pages already mount it).
  // While auth resolves, neither renders — the no-flash idiom the deleted
  // header used, kept.
  const body = (
    <>
      {/* UNLOCK-BANNER: authed landing — the same checkout result card the
          guest landing mounts (the purchase resume returns to '/'). */}
      <CheckoutResultBanner />
      {buyError && (
        <div role="alert" onClick={() => setBuyError('')} className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 cursor-pointer border border-red-200 bg-red-50 p-3 text-xs text-red-800 shadow-lg">
          {buyError} — click to dismiss.
        </div>
      )}


      {/* SHELL-02: the tab's opener, where the purple band used to be. */}
      {(() => {
        const tool = COCKPIT_PRIMARY_TOOL[activeTab];
        if (!tool) return null;
        return (
          <div className="mx-auto w-full max-w-[1800px] px-4 pt-6 lg:px-6">
            <StepOpener step={stepOfTool(tool)} />
          </div>
        );
      })()}

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
              onSuccess={(result) => {
                if (pendingBuyKey) {
                  // SELL-02: the purchase resume — checkout for the pending key; Stripe returns to /answers.
                  const key = pendingBuyKey;
                  setPendingBuyKey(null);
                  setShowLogin(false);
                  startEntitlementCheckout(key)
                    .then((url) => { window.location.href = url; })
                    .catch((err: unknown) => setBuyError(err instanceof Error ? err.message : 'Could not start checkout'));
                  return;
                }
                // SELL-03: the one front door — the server names it (/answers).
                window.location.href = result.landing;
              }}
              initialMode={loginMode}
            />
          </div>
        </div>
      )}
    </>
  );

  if (authed === null) {
    return <div className="min-h-screen bg-bg-terminal" aria-busy="true" />;
  }
  if (authed) {
    // rail={false}: ModuleLauncher mounts the rail itself, in select mode. One
    // shell, one rail — AppLayout supplies the bar, the cockpit supplies the rail.
    return <AppLayout rail={false}>{body}</AppLayout>;
  }
  return (
    <div className="min-h-screen bg-bg-terminal">
      <LandingHeader
        onRequireLogin={() => { setLoginMode('login'); setShowLogin(true); }}
        onRequireAuth={() => { setLoginMode('register'); setShowLogin(true); }}
      />
      {body}
    </div>
  );
}

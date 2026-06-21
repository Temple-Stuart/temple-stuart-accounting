'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import LoginBox from '@/components/LoginBox';
import ModuleLauncher, { TAB_DESCRIPTORS } from '@/components/home/ModuleLauncher';

export default function LandingPage() {
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
    <div className="min-h-screen bg-bg-terminal">
      {/* Header */}
      <header className="bg-brand-purple text-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white flex items-center justify-center">
                <span className="text-brand-purple font-bold text-terminal-lg">TS</span>
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">Temple Stuart</div>
                <div className="text-[10px] text-text-faint">Personal Back Office</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/how-pricing-works" className="text-xs text-text-faint hover:text-white hidden sm:block">
                Pricing
              </Link>
              <a href="mailto:astuart@templestuart.com" className="text-xs text-text-faint hover:text-white hidden sm:block">
                Contact
              </a>
              {/* PR-Auth-Home: logged in → name + Log out; logged out → Enter →. While auth
                  is still resolving (authed === null), show an invisible placeholder so the
                  header never flashes the wrong action or shifts width. */}
              {authed === null ? (
                <span className="px-4 py-2 text-xs opacity-0 select-none" aria-hidden="true">Enter →</span>
              ) : authed ? (
                <>
                  {userLabel && (
                    <span className="text-xs text-text-faint hidden sm:block">{userLabel}</span>
                  )}
                  <button onClick={handleSignOut}
                    className="px-4 py-2 text-xs bg-white text-brand-purple font-medium hover:bg-bg-row">
                    Log out
                  </button>
                </>
              ) : (
                <button onClick={() => { setLoginMode('login'); setShowLogin(true); }}
                  className="px-4 py-2 text-xs bg-white text-brand-purple font-medium hover:bg-bg-row">
                  Enter →
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-brand-purple text-white pb-12 pt-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl font-light tracking-tight mb-4">
              Track your money.<br />
              Plan your life.<br />
              <span className="text-text-faint">Act smarter.</span>
            </h1>
            {/* PR-Hero-PerTab: the subhead swaps to the active tab's descriptor. min-h
                reserves space so the Get Started button never jumps as the line changes
                length. The headline above + Get Started below are unchanged. */}
            <p className="text-text-faint text-terminal-lg mb-8 max-w-xl min-h-[4rem]">
              {TAB_DESCRIPTORS[activeTab]}
            </p>
            {/* How it works — the projects pipeline explainer, shown under the goal
                line (only on the projects tab, where that descriptor renders). Reuses
                the panel's text-white / text-text-faint tokens — no new colors. */}
            {activeTab === 'projects' && (
              <div className="text-text-faint text-sm mb-8 max-w-xl">
                <p className="text-white font-medium mb-2">How it works:</p>
                <ol className="list-decimal list-inside space-y-2">
                  {[
                    "You bring a problem. Open a project, type what you want to build or fix, name it.",
                    "Research finds the right way. It turns your messy goals into clear targets and looks up the correct rules and how the best already do it.",
                    "Claude Code reads your real code. It opens your actual codebase and writes down what works, what's broken, and what's missing.",
                    "It waits for the truth. Nothing moves until the code check comes back. No skipping.",
                    "It makes a smart plan. Your goals, the right way, and the real problems become a to-do list — biggest fixes first.",
                    "You pick what to build. Accept a task and Claude Code builds it and opens a request on GitHub. You review and ship it.",
                    "You evolve it. Add new goals and run it again — the loop never ends.",
                  ].map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
            {/* How it works — the Runway explainer, shown only on the Runway (calendar) tab.
                Mirrors the projects block byte-for-byte in structure/styling; only the step
                copy differs. Reuses the shared Get Started button below — no new colors. */}
            {activeTab === 'calendar' && (
              <div className="text-text-faint text-sm mb-8 max-w-xl">
                <p className="text-white font-medium mb-2">How it works:</p>
                <ol className="list-decimal list-inside space-y-2">
                  {[
                    "You set up your routines. Rent, coffee, the gym — each recurring expense carries a category and a dollar amount.",
                    "Your routines become your plan. Every routine's budget flows onto the calendar as what you plan to spend, by the day.",
                    "Your bookkeeping fills in what really happened. Actual spend comes straight from your ledger, not a guess.",
                    "Your bank shows your cash. Your real balance is pulled live, with trading money kept separate — that's at-risk, not spending money.",
                    "It does the math on your burn. It looks at the last 3 and 6 months of real money in and out, and finds your monthly burn.",
                    "It tells you the truth: how many months you've got, and the date your money runs out.",
                    "Trading stands on its own. Your trading wins and losses show in their own panel — never mixed into your runway.",
                  ].map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
            <div className="flex items-center gap-4">
              <button onClick={() => { setLoginMode('register'); setShowLogin(true); }}
                className="px-6 py-3 bg-white text-brand-purple font-medium hover:bg-bg-row text-sm">
                Get Started
              </button>
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

      {/* CPA Disclaimer */}
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

      {/* Social */}
      <section className="bg-brand-purple text-white py-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white flex items-center justify-center">
                <span className="text-brand-purple font-bold text-sm">TS</span>
              </div>
              <div className="text-xs text-text-faint">© 2026 Temple Stuart, LLC</div>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://www.instagram.com/temple_stuart_accounting/" target="_blank" rel="noopener noreferrer"
                className="text-text-faint hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="https://www.tiktok.com/@temple_stuart" target="_blank" rel="noopener noreferrer"
                className="text-text-faint hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                </svg>
              </a>
              <a href="https://www.youtube.com/@Temple-Stuart" target="_blank" rel="noopener noreferrer"
                className="text-text-faint hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <a href="https://x.com/Alex_Stuart_APS" target="_blank" rel="noopener noreferrer"
                className="text-text-faint hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://www.linkedin.com/in/alexander-stuart-phi/" target="_blank" rel="noopener noreferrer"
                className="text-text-faint hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <a href="/terms" className="text-xs text-text-muted hover:text-text-faint">Terms of Service</a>
              <a href="/privacy" className="text-xs text-text-muted hover:text-text-faint">Privacy Policy</a>
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

'use client';

/**
 * LandingHeader (FD-1d) — the Bloomberg header extracted from Landing.tsx so
 * the /modules pages share it verbatim. Token-native (panel family +
 * brand-purple), zero hex.
 *
 * ROUTE-1 (Alex's ruling b): the top-right CTA is now "Log in" — the hero
 * already carries "Create free account", so the header stops duplicating the
 * register ask and serves returning users. Two honest modes:
 *   • onRequireLogin provided (the Landing; GuestLanding passes the LoginBox
 *     opener in LOGIN mode) → a button calling it;
 *   • absent (the /modules pages, which have no login modal) → a LINK to
 *     '/' — PR-PRICE-3: /pricing (the old ask surface) is a redirect now, so
 *     the front door is the real one: its header renders THIS component in
 *     button mode (working Log in modal) and its hero carries the register
 *     ask.
 */

import Link from 'next/link';

export default function LandingHeader({ onRequireLogin }: { onRequireLogin?: () => void }) {
  return (
    <header className="border-b border-panel-border bg-panel text-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white flex items-center justify-center">
              <span className="text-brand-purple font-bold text-terminal-lg">TS</span>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Temple Stuart</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-white/50">Founder&apos;s Back Office</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/how-pricing-works" className="text-xs text-white/60 hover:text-white hidden sm:block">
              Pricing
            </Link>
            <a href="mailto:astuart@templestuart.com" className="text-xs text-white/60 hover:text-white hidden sm:block">
              Contact
            </a>
            {onRequireLogin ? (
              <button
                type="button"
                onClick={onRequireLogin}
                className="px-4 py-2 text-xs bg-white text-brand-purple font-medium hover:bg-bg-row"
              >
                Log in
              </button>
            ) : (
              <Link href="/" className="px-4 py-2 text-xs bg-white text-brand-purple font-medium hover:bg-bg-row">
                Log in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

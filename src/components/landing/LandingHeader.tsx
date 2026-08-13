'use client';

/**
 * LandingHeader (FD-1d) — the Bloomberg header extracted from Landing.tsx so
 * the /modules pages share it verbatim. Token-native, zero hex. REPAINT-2
 * (Direction C): the nav sits on cream with the lavender border-b hairline,
 * aubergine ink; the Create-account CTA wears the MONEY_ACTION gold colors
 * (geometry preserved — the header buttons keep their own padding and carry
 * no rounding).
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

export default function LandingHeader({ onRequireLogin, onRequireAuth }: {
  onRequireLogin?: () => void;
  /** HEADER-CTA: the hero "Create free account" opener (Landing.tsx:772
   *  onClick={onRequireAuth}) — passed through by the Landing mount so the
   *  header CTA's destination is byte-identical to the hero's. Absent (the
   *  /modules pages, no modal) → the CTA links '/' like link-mode Log in. */
  onRequireAuth?: () => void;
}) {
  return (
    <header className="border-b border-border bg-bg-terminal text-text-primary">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-purple flex items-center justify-center">
              <span className="text-white font-bold text-terminal-lg">TS</span>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Temple Stuart</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Founder&apos;s Back Office</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/how-pricing-works" className="text-xs text-text-muted hover:text-text-primary hidden sm:block">
              Pricing
            </Link>
            <a href="mailto:astuart@templestuart.com" className="text-xs text-text-muted hover:text-text-primary hidden sm:block">
              Contact
            </a>
            {onRequireLogin ? (
              <button
                type="button"
                onClick={onRequireLogin}
                className="px-4 py-2.5 text-sm border border-brand-purple/40 text-brand-purple font-medium hover:bg-brand-purple-wash"
              >
                Log in
              </button>
            ) : (
              <Link href="/" className="px-4 py-2.5 text-sm border border-brand-purple/40 text-brand-purple font-medium hover:bg-brand-purple-wash">
                Log in
              </Link>
            )}
            {/* HEADER-CTA: the gold Create-account CTA — right of Log in,
                all breakpoints (the CTA pattern; only the nav links collapse
                on mobile). Same dual-mode shape as Log in: the hero's
                onRequireAuth opener when the mount provides it, else the '/'
                ask-surface link. No rounding — the header buttons carry none.
                REPAINT-2: the gradient died; MONEY_ACTION's gold colors at
                the header's own geometry. */}
            {onRequireAuth ? (
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-4 py-2.5 text-sm font-medium bg-brand-gold text-white hover:bg-brand-gold/90"
              >
                Create account
              </button>
            ) : (
              <Link href="/" className="px-4 py-2.5 text-sm font-medium bg-brand-gold text-white hover:bg-brand-gold/90">
                Create account
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

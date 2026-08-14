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
    // LANDING-V3 (spec :34-47) → THREE-TRIMS: the nav anatomy, minus the
    // retired anchor links (Live demo → /#demo and Modules → /#modules died
    // — the #modules id STAYS on the merged section as the /pricing 308
    // redirect target, app/pricing/page.tsx). Outlined TS mark (:37);
    // Pricing keeps /how-pricing-works; GitHub ↗ = the repo link; Log in =
    // the spec's text link, SAME dual-mode handlers; CREATE FREE ACCOUNT =
    // the spec's mono uppercase gold button, SAME dual-mode handlers.
    // V3 FLAGS: Contact dropped — the mailto survives in the footer.
    <header className="border-b border-border bg-bg-terminal text-text-primary">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16 sm:h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-7 h-7 border-2 border-brand-purple flex items-center justify-center">
              <span className="font-mono text-[10.5px] font-semibold text-brand-purple">TS</span>
            </div>
            <div className="text-sm font-semibold tracking-[0.16em] text-brand-purple">TEMPLE STUART</div>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/how-pricing-works" className="text-xs text-text-muted hover:text-text-primary hidden sm:block">
              Pricing
            </Link>
            <a
              href="https://github.com/Temple-Stuart/temple-stuart-accounting"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-text-muted hover:text-text-primary hidden sm:block"
            >
              GitHub ↗
            </a>
            {onRequireLogin ? (
              <button
                type="button"
                onClick={onRequireLogin}
                className="text-xs font-medium text-brand-purple hover:text-brand-purple-hover"
              >
                Log in
              </button>
            ) : (
              <Link href="/" className="text-xs font-medium text-brand-purple hover:text-brand-purple-hover">
                Log in
              </Link>
            )}
            {onRequireAuth ? (
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-4 py-2.5 bg-brand-gold font-mono text-[11px] font-semibold uppercase tracking-wider text-brand-purple-deep hover:bg-brand-gold/90"
              >
                CREATE FREE ACCOUNT
              </button>
            ) : (
              <Link
                href="/"
                className="px-4 py-2.5 bg-brand-gold font-mono text-[11px] font-semibold uppercase tracking-wider text-brand-purple-deep hover:bg-brand-gold/90"
              >
                CREATE FREE ACCOUNT
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

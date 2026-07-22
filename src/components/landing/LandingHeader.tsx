'use client';

/**
 * LandingHeader (FD-1d) — the Bloomberg header extracted from Landing.tsx so
 * the /modules pages share it verbatim. Token-native (panel family +
 * brand-purple), zero hex.
 *
 * The account CTA has two honest modes:
 *   • onRequireAuth provided (the Landing; FD-2 will pass the real register-
 *     modal opener) → a button calling it;
 *   • absent (the /modules pages, which have no login modal) → a LINK to
 *     /pricing, whose "Get Started Free" opens LoginBox and whose buy flow
 *     owns login-resume (PricingClient.tsx:143-182) — the ruled ask surface.
 */

import Link from 'next/link';

export default function LandingHeader({ onRequireAuth }: { onRequireAuth?: () => void }) {
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
            {onRequireAuth ? (
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-4 py-2 text-xs bg-white text-brand-purple font-medium hover:bg-bg-row"
              >
                Create free account
              </button>
            ) : (
              <Link href="/pricing" className="px-4 py-2 text-xs bg-white text-brand-purple font-medium hover:bg-bg-row">
                Create free account
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

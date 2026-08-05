'use client';

/**
 * PRICING-PAGE-SELL → PR-PRICE-2: /pricing is THE ONE pricing table, consuming
 * THE one model (src/config/pricingModel.ts via page.tsx's server availability
 * check). Columns: Free today / Per module / Bundle. The RESOLUTION RULE
 * (pricingModel.ts): a price + working Unlock button render ONLY when the
 * config number AND the Stripe env price ID both exist; anything less renders
 * the one honest state — "Pricing coming". No invented numbers, no dead
 * buttons. Checkout is the untouched signature-verified entitlement flow
 * (POST /api/stripe/checkout-entitlement — the same flow Travel's locked
 * categories use), with the logged-out resume path intact.
 *
 * The parallel Pro/Pro+ TIER vocabulary DIED here (PRICING-AUDIT-1's
 * two-model confusion): the tier cards + their /api/stripe/checkout flow are
 * gone from this page; tiers.ts remains ONLY as legacy gate vocabulary
 * (requireTier call sites — see its header) until module entitlements replace
 * those gates. "Manage existing subscription" stays for anyone already
 * subscribed.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import LoginBox from '@/components/LoginBox';

export interface CatalogItem {
  key: string;
  label: string;
  unlocks: string;
  monthlyPrice: number | null;
  /** true only when the server found a configured Stripe price ID for this key. */
  available: boolean;
}

/** FD-1c: the DOM id a landing ?module=<key> link scrolls to (':' is not
 *  queryable-safe in ids — sanitized to '-'). */
function moduleCardId(key: string): string {
  return `module-${key.replace(':', '-')}`;
}

export default function PricingClient({ catalog }: { catalog: CatalogItem[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  // PRICING-PAGE-SELL: a module buy started while logged out resumes after login.
  const [pendingTabKey, setPendingTabKey] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const searchParams = useSearchParams();
  const cancelled = searchParams.get('cancelled');
  // FD-1c: ?module=<key> from the landing sheet → scroll that card into view
  // with a brief highlight. Reads the SAME useSearchParams binding above (this
  // component already mounts under <Suspense>, page.tsx:27-29) — fewer lines
  // than the window.location house pattern, and this file's own convention.
  // FD-1i: ?modules=<key,key,...> (the landing calculator's multi-select
  // Continue) rides the SAME pattern — every valid listed card highlights,
  // the first scrolls into view. Multi-PURCHASE stays N clicks through the
  // per-module buttons below; nothing about checkout changes here.
  // PRESENTATION ONLY: no commerce logic (checkout/resume/portal) is touched.
  const [highlightKeys, setHighlightKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    const single = searchParams.get('module');
    const multi = searchParams.get('modules');
    const keys = (multi ? multi.split(',') : single ? [single] : [])
      .filter((k) => catalog.some((c) => c.key === k));
    if (keys.length === 0) return;
    setHighlightKeys(new Set(keys));
    document.getElementById(moduleCardId(keys[0]))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightKeys(new Set()), 2500);
    return () => clearTimeout(timer);
  }, [searchParams, catalog]);

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/auth/me')
      .then(res => {
        setIsLoggedIn(res.ok);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  // PR-PRICE-2: the tier subscription checkout (proceedToCheckout →
  // /api/stripe/checkout) left this page with the tier cards. The route +
  // webhook stay (existing subscribers), reachable via "Manage" below.

  // PRICING-PAGE-SELL: the entitlement buy-flow — the SAME request Travel's
  // LockedCategoryCard makes. Only ever called for catalog items the server
  // marked available (button is disabled otherwise), so it cannot 400 on an
  // unconfigured price. Errors render inline, fail-loud.
  const proceedToTabCheckout = async (key: string) => {
    setLoading(key);
    setBuyError(null);
    try {
      const res = await fetch('/api/stripe/checkout-entitlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout');
      }
      window.location.href = data.url;
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Could not start checkout');
      setLoading(null);
    }
  };

  const handleBuyTab = (key: string) => {
    if (!isLoggedIn) {
      setPendingTabKey(key);
      setShowLogin(true);
      return;
    }
    proceedToTabCheckout(key);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    setIsLoggedIn(true);
    if (pendingTabKey) {
      proceedToTabCheckout(pendingTabKey);
      setPendingTabKey(null);
    }
  };

  const handleManage = async () => {
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    setLoading('manage');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert('Failed to open billing portal');
    } finally {
      setLoading(null);
    }
  };

  const bundle = catalog.find((c) => c.key === 'bundle:all');
  const tabs = catalog.filter((c) => c.key !== 'bundle:all');

  // PR-PRICE-2: THE resolution rule (pricingModel.ts) at the render site —
  // live = config number AND Stripe env both exist; anything less is the one
  // honest state. This deliberately supersedes the old "price shown at
  // checkout"-with-working-button path: numbers-day requires BOTH halves.
  const priceCell = (c: CatalogItem, buyLabel?: string) => {
    const live = c.monthlyPrice !== null && c.available;
    if (!live) return <span className="italic text-text-muted">Pricing coming</span>;
    return (
      <div className="flex flex-col items-start gap-2">
        <span className="font-mono text-sm font-bold text-brand-purple">
          ${c.monthlyPrice}
          <span className="text-xs font-normal text-text-muted">/mo</span>
        </span>
        <button
          onClick={() => handleBuyTab(c.key)}
          disabled={loading !== null}
          className="px-4 py-2 text-xs font-medium bg-brand-purple text-white hover:bg-brand-purple/90 disabled:opacity-60"
        >
          {loading === c.key ? 'Starting checkout…' : (buyLabel ?? `Unlock ${c.label}`)}
        </button>
        <span className="text-[10px] text-text-muted">Billed monthly · cancel anytime</span>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Modules</div>
        <h2 className="text-sm font-light text-text-primary">Buy the modules you&apos;ll use. One, some, or all.</h2>
        <p className="mt-2 text-xs text-text-muted max-w-2xl">
          Each module is a separate subscription — pay for a module and the whole module works.
          Travel&apos;s premium discovery categories are sold individually on the Travel tab.
        </p>
      </div>

      {cancelled && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
          Checkout cancelled. No charges were made.
        </div>
      )}

      {buyError && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-800 text-xs" role="alert">
          {buyError}
        </div>
      )}

      {/* THE TABLE (PR-PRICE-2) — one pricing model, drop-in ready. Rows =
          modules (+ the bundle closer); columns = Free today / Per module /
          Bundle. priceCell enforces the pricingModel.ts resolution rule:
          "$X/mo" + a WORKING Unlock button ONLY when config number AND Stripe
          env both exist; otherwise "Pricing coming" — never a number without
          a checkout, never a button that would 400. */}
      <div className="mb-10 overflow-x-auto">
        <table className="w-full min-w-[680px] border border-border text-xs">
          <thead>
            <tr className="border-b border-border bg-bg-row">
              <th className="px-4 py-3 text-left font-medium text-text-primary">Module</th>
              <th className="px-4 py-3 text-left font-medium text-text-primary">Free today</th>
              <th className="px-4 py-3 text-left font-medium text-text-primary">Per module</th>
              <th className="px-4 py-3 text-left font-medium text-text-primary">Bundle</th>
            </tr>
          </thead>
          <tbody>
            {/* Travel — the one module with LIVE free value (public booking
                rails); its premium discovery categories sell on the Travel
                tab, not here. Not a catalog row: nothing to price. */}
            <tr className="border-b border-border">
              <td className="px-4 py-3 font-medium text-text-primary">Travel</td>
              <td className="px-4 py-3 text-emerald-600">
                Search &amp; book flights, hotels &amp; more — free, no account required
              </td>
              <td className="px-4 py-3 text-text-muted">
                Premium discovery categories — sold individually on the Travel tab
              </td>
              <td className="px-4 py-3 text-text-secondary">Included</td>
            </tr>
            {tabs.map((c) => (
              <tr
                key={c.key}
                id={moduleCardId(c.key)}
                className={`border-b border-border align-top ${highlightKeys.has(c.key) ? 'ring-2 ring-inset ring-brand-purple/40' : ''}`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-text-primary">{c.label}</div>
                  <div className="mt-1 max-w-md text-[10px] leading-relaxed text-text-muted">
                    Unlocks {c.unlocks}.
                  </div>
                </td>
                <td className="px-4 py-3 text-text-faint">—</td>
                <td className="px-4 py-3">{priceCell(c)}</td>
                <td className="px-4 py-3 text-text-secondary">Included</td>
              </tr>
            ))}
            {bundle && (
              <tr
                id={moduleCardId(bundle.key)}
                className={`bg-bg-row/50 align-top ${highlightKeys.has(bundle.key) ? 'ring-2 ring-inset ring-brand-purple/40' : ''}`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-text-primary">{bundle.label}</div>
                  <div className="mt-1 max-w-md text-[10px] leading-relaxed text-text-muted">
                    Unlocks {bundle.unlocks}.
                  </div>
                </td>
                <td className="px-4 py-3 text-text-faint">—</td>
                <td className="px-4 py-3 text-text-faint">—</td>
                <td className="px-4 py-3">{priceCell(bundle, 'Unlock everything')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-center">
        <button
          onClick={handleManage}
          className="text-xs text-text-muted hover:text-text-secondary underline"
        >
          {loading === 'manage' ? 'Loading...' : 'Manage existing subscription'}
        </button>
      </div>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowLogin(false); setPendingTabKey(null); }} />
          <div className="relative z-10">
            <LoginBox
              onClose={() => { setShowLogin(false); setPendingTabKey(null); }}
              onSuccess={handleLoginSuccess}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}

'use client';

/**
 * PRICING-PAGE-SELL: the /pricing client surface. The MODULES section sells the
 * per-tab entitlements + the bundle through the existing signature-verified
 * entitlement checkout (POST /api/stripe/checkout-entitlement — the same flow
 * Travel's locked categories use). The server component (page.tsx) tells this
 * component, per key, whether a Stripe price ID is configured RIGHT NOW —
 * a buy-button renders functional ONLY then; otherwise an explicit, disabled
 * "Not yet available" (never a button that would 400). Display prices come
 * from TAB_PRICING (Alex-entered config); null renders "price not set —
 * shown at checkout", never a fabricated number.
 * The legacy tier cards below cover the features tiers still gate
 * (lifestyle AI, travel discovery, trip AI) — kept per TRUTH-LABELS.
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    tier: 'free',
    // TRUTH-LABELS: bullets list only what each tier's gates ACTUALLY grant in
    // code today (requireTier call sites). The modules are sold above, per-tab.
    features: [
      'Manual transaction entry',
      'Budgeting across all modules',
      'Trip planning & flight search',
      'Runway calendar & hub',
    ],
    cta: 'Get Started Free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/mo',
    tier: 'pro',
    features: [
      'Everything in Free, plus:',
      'Premium travel discovery (category search, with category subscriptions)',
    ],
    cta: 'Coming Soon',
    highlight: true,
  },
  {
    name: 'Pro+',
    price: '$40',
    period: '/mo',
    tier: 'pro_plus',
    features: [
      'Everything in Pro, plus:',
      'AI meal & cart planning',
      'Trip AI recommendations',
      'AI content tools (reel scripts, routine scenes)',
      'Priority support',
    ],
    cta: 'Coming Soon',
    highlight: false,
  },
];

export default function PricingClient({ catalog }: { catalog: CatalogItem[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingTier, setPendingTier] = useState<string | null>(null);
  // PRICING-PAGE-SELL: a module buy started while logged out resumes after login.
  const [pendingTabKey, setPendingTabKey] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const cancelled = searchParams.get('cancelled');

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/auth/me')
      .then(res => {
        setIsLoggedIn(res.ok);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  const proceedToCheckout = async (tier: string) => {
    setLoading(tier);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Something went wrong');
      }
    } catch {
      alert('Failed to start checkout');
    } finally {
      setLoading(null);
    }
  };

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

  const handleUpgrade = async (tier: string) => {
    if (tier === 'free') {
      if (isLoggedIn) {
        router.push('/hub');
      } else {
        setShowLogin(true);
      }
      return;
    }

    if (!isLoggedIn) {
      setPendingTier(tier);
      setShowLogin(true);
      return;
    }

    proceedToCheckout(tier);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    setIsLoggedIn(true);
    if (pendingTier) {
      proceedToCheckout(pendingTier);
      setPendingTier(null);
    }
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

      {/* MODULES — the per-tab sell */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {tabs.map((c) => (
          <div key={c.key} className="p-6 border border-border relative">
            <div className="text-xs font-medium text-text-primary mb-1">{c.label}</div>
            <div className="text-sm font-bold font-mono text-brand-purple mb-1">
              {c.monthlyPrice !== null ? (
                <>
                  ${c.monthlyPrice}
                  <span className="text-sm font-normal text-text-muted">/mo</span>
                </>
              ) : (
                <span className="text-xs font-normal italic text-text-faint" title="Display price not entered yet — Stripe shows the real price at checkout">
                  price shown at checkout
                </span>
              )}
            </div>
            <div className="text-[10px] text-text-muted mb-4">Billed monthly · cancel anytime</div>
            <p className="text-xs text-text-secondary mb-6">Unlocks {c.unlocks}.</p>
            {c.available ? (
              <button
                onClick={() => handleBuyTab(c.key)}
                disabled={loading !== null}
                className="w-full px-4 py-2 text-xs font-medium bg-brand-purple text-white hover:bg-brand-purple/90 disabled:opacity-60"
              >
                {loading === c.key ? 'Starting checkout…' : `Unlock ${c.label}`}
              </button>
            ) : (
              // Honest partial-Stripe state: no configured price ID → no
              // functional button (a click would 400 at checkout). Explicit.
              <button
                disabled
                title="This module's Stripe price isn't configured yet"
                className="w-full px-4 py-2 text-xs font-medium bg-border text-text-muted cursor-not-allowed"
              >
                Not yet available
              </button>
            )}
          </div>
        ))}
      </div>

      {/* THE BUNDLE */}
      {bundle && (
        <div className="p-6 border-2 border-brand-purple mb-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="text-xs font-medium text-text-primary mb-1">{bundle.label}</div>
            <p className="text-xs text-text-secondary">Unlocks {bundle.unlocks}.</p>
          </div>
          <div className="text-sm font-bold font-mono text-brand-purple">
            {bundle.monthlyPrice !== null ? (
              <>${bundle.monthlyPrice}<span className="text-sm font-normal text-text-muted">/mo</span></>
            ) : (
              <span className="text-xs font-normal italic text-text-faint">price shown at checkout</span>
            )}
          </div>
          {bundle.available ? (
            <button
              onClick={() => handleBuyTab(bundle.key)}
              disabled={loading !== null}
              className="px-6 py-2 text-xs font-medium bg-brand-purple text-white hover:bg-brand-purple/90 disabled:opacity-60"
            >
              {loading === bundle.key ? 'Starting checkout…' : 'Unlock everything'}
            </button>
          ) : (
            <button disabled title="The bundle's Stripe price isn't configured yet"
              className="px-6 py-2 text-xs font-medium bg-border text-text-muted cursor-not-allowed">
              Not yet available
            </button>
          )}
        </div>
      )}

      {/* LEGACY TIERS — the features tiers still gate (TRUTH-LABELS bullets) */}
      <div className="mb-8">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Plans</div>
        <h2 className="text-sm font-light text-text-primary">Lifestyle features — free to start.</h2>
        <p className="mt-2 text-xs text-text-muted max-w-2xl">
          These plans cover the lifestyle AI and travel-discovery features (not the modules above).
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {TIERS.map((t) => (
          <div
            key={t.tier}
            className={`p-6 relative ${
              t.highlight
                ? 'border-2 border-brand-purple'
                : 'border border-border'
            }`}
          >
            {t.highlight && (
              <div className="absolute -top-2.5 left-4 bg-brand-purple text-white text-[9px] px-2 py-0.5 uppercase tracking-wider">
                Popular
              </div>
            )}
            {t.tier !== 'free' && (
              <div className="absolute -top-2.5 left-4 bg-emerald-500 text-white text-[9px] px-2 py-0.5 uppercase tracking-wider">
                Coming Soon
              </div>
            )}
            <div className="text-xs font-medium text-text-primary mb-1">{t.name}</div>
            <div className="text-sm font-bold font-mono text-brand-purple mb-1">
              {t.price}
              {t.period !== 'forever' && (
                <span className="text-sm font-normal text-text-muted">{t.period}</span>
              )}
            </div>
            <div className="text-[10px] text-text-muted mb-4">
              {t.period === 'forever' ? 'Forever' : 'Billed monthly'}
            </div>

            <div className="space-y-2 text-xs text-text-secondary mb-6">
              {t.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full flex-shrink-0"></div>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => t.tier === 'free' && handleUpgrade(t.tier)}
              disabled={loading !== null || t.tier !== 'free'}
              className={`w-full px-4 py-2 text-xs font-medium ${
                t.tier !== 'free'
                  ? 'bg-border text-text-muted cursor-not-allowed'
                  : 'border border-border text-text-secondary hover:bg-bg-row'
              }`}
            >
              {loading === t.tier ? 'Loading...' : t.cta}
            </button>
          </div>
        ))}
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowLogin(false); setPendingTier(null); setPendingTabKey(null); }} />
          <div className="relative z-10">
            <LoginBox
              onClose={() => { setShowLogin(false); setPendingTier(null); setPendingTabKey(null); }}
              onSuccess={handleLoginSuccess}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}

'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import LoginBox from '@/components/LoginBox';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    tier: 'free',
    features: [
      'Manual transaction entry',
      'Budgeting across all modules',
      'Trip planning & flight search',
      'Double-entry bookkeeping',
      'Hub command center',
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
      'Plaid bank sync (10 accounts)',
      'Trading P&L analytics',
      'Auto-categorization',
      'Wash sale tracking',
      'Bank reconciliation',
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
      'AI spending insights',
      'AI meal planning',
      'Trip AI recommendations',
      'Up to 25 linked accounts',
      'Priority support',
    ],
    cta: 'Coming Soon',
    highlight: false,
  },
  {
    name: 'Trader Pro',
    price: '$60',
    period: '/mo',
    tier: 'trader_pro',
    features: [
      'Everything in Pro+, plus:',
      'Real-time market data (stocks, options, crypto, futures)',
      'AI strategy builder — natural language algo creation',
      'IV-HV spread analysis & options scanner',
      'Live signal alerts',
      'Wash sale & tax impact warnings before you trade',
      'Portfolio Greeks across all accounts',
      'Budget-aware position sizing',
    ],
    cta: 'Coming Soon',
    highlight: false,
  },
];

function PricingContent() {
  const [loading, setLoading] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingTier, setPendingTier] = useState<string | null>(null);
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
    } catch (err) {
      alert('Failed to start checkout');
    } finally {
      setLoading(null);
    }
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
    } catch (err) {
      alert('Failed to open billing portal');
    } finally {
      setLoading(null);
    }
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Plans</div>
        <h2 className="text-sm font-light text-text-primary">Start free. Upgrade when you need more.</h2>
      </div>

      {cancelled && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
          Checkout cancelled. No charges were made.
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {TIERS.map((t) => (
          <div
            key={t.tier}
            className={`p-6 relative ${
              t.highlight
                ? 'border-2 border-brand-purple'
                : t.tier === 'trader_pro'
                ? 'border-2 border-emerald-400 bg-gradient-to-b from-white to-emerald-50/30'
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowLogin(false); setPendingTier(null); }} />
          <div className="relative z-10">
            <LoginBox 
              onClose={() => { setShowLogin(false); setPendingTier(null); }}
              onSuccess={handleLoginSuccess}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}

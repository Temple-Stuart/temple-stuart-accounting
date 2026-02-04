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
    cta: 'Current Plan',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$19',
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
    cta: 'Upgrade to Pro',
    highlight: true,
  },
  {
    name: 'Pro+',
    price: '$39',
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
    cta: 'Upgrade to Pro+',
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
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Plans</div>
        <h2 className="text-2xl font-light text-gray-900">Start free. Upgrade when you need more.</h2>
      </div>

      {cancelled && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
          Checkout cancelled. No charges were made.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        {TIERS.map((t) => (
          <div
            key={t.tier}
            className={`p-6 ${
              t.highlight
                ? 'border-2 border-[#2d1b4e] relative'
                : 'border border-gray-200'
            }`}
          >
            {t.highlight && (
              <div className="absolute -top-2.5 left-4 bg-[#2d1b4e] text-white text-[9px] px-2 py-0.5 uppercase tracking-wider">
                Popular
              </div>
            )}
            <div className="text-xs font-medium text-gray-900 mb-1">{t.name}</div>
            <div className="text-2xl font-bold font-mono text-[#2d1b4e] mb-1">
              {t.price}
              {t.period !== 'forever' && (
                <span className="text-sm font-normal text-gray-500">{t.period}</span>
              )}
            </div>
            <div className="text-[10px] text-gray-500 mb-4">
              {t.period === 'forever' ? 'Forever' : 'Billed monthly'}
            </div>

            <div className="space-y-2 text-xs text-gray-700 mb-6">
              {t.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full flex-shrink-0"></div>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleUpgrade(t.tier)}
              disabled={loading !== null}
              className={`w-full px-4 py-2 text-xs font-medium ${
                t.highlight
                  ? 'bg-[#2d1b4e] text-white hover:bg-[#3d2b5e]'
                  : t.tier === 'free'
                  ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
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
          className="text-xs text-gray-500 hover:text-gray-700 underline"
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

'use client';

/**
 * GuestLanding (FD-2) — the client wrapper the arrival branch renders for
 * VERIFIED-guest arrivals on bare '/': the Landing with REAL wiring.
 *
 *   • entitlementAvailability arrives server-computed from page.tsx (the same
 *     env-only map; page.tsx:83-85 pattern);
 *   • onRequireAuth opens the REAL LoginBox in REGISTER mode — the modal
 *     markup mirrors the home shell's own mount (HomeClient :262-274 — same
 *     backdrop, same props);
 *   • ROUTE-1 (ruling b): onRequireLogin opens the SAME LoginBox in LOGIN
 *     mode — the header's "Log in" button. One modal, one state pair; only
 *     the initial mode differs (the user can still switch inside LoginBox).
 *   • PR-PRICE-3: onBuyModule — the deck's Select/Continue buy path, ported
 *     from the dead PricingClient's login-resume (its pendingTabKey flow was
 *     built FOR logged-out visitors; /pricing is a redirect now). Every
 *     Landing viewer is a guest (page.tsx:77 branches authed → HomeClient),
 *     so the account comes FIRST: the click stores the key and opens the
 *     register modal; a successful login/registration resumes STRAIGHT into
 *     POST /api/stripe/checkout-entitlement (auth-gated server-side) instead
 *     of reloading. Checkout failure renders the house red alert box —
 *     fail-loud, never silent.
 *
 * NO LOOP by construction: a non-purchase LoginBox onSuccess reloads '/'; a
 * successful login/registration set the signed userEmail cookie, so the
 * server branch now VERIFIES the arrival and renders <HomeClient/> — the
 * Landing renders only while verification fails, so a logged-in user can
 * never be handed the Landing again by this path. (The purchase resume goes
 * to Stripe instead; its return URLs land back on '/'.)
 */

import { useState } from 'react';
import Landing from './Landing';
import LoginBox from '@/components/LoginBox';

export default function GuestLanding({ entitlementAvailability }: {
  entitlementAvailability: Record<string, boolean>;
}) {
  const [showLogin, setShowLogin] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('register');
  // PR-PRICE-3: the module key whose checkout resumes after auth (the
  // PricingClient pendingTabKey pattern, relocated here when the page died).
  const [pendingBuyKey, setPendingBuyKey] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  // The SAME request LockedTabCard/LockedCategoryCard make — the one
  // entitlement checkout flow. Only reachable AFTER a successful login
  // (the route 401s guests), and only for keys the server marked available
  // (the deck hides Select otherwise), so it cannot 400 on an unconfigured
  // price. Errors render loud below; nothing retries silently.
  const startCheckout = async (key: string) => {
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
    }
  };

  const onBuyModule = (key: string) => {
    setBuyError(null);
    setPendingBuyKey(key);
    setLoginMode('register');
    setShowLogin(true);
  };

  return (
    <>
      <Landing
        entitlementAvailability={entitlementAvailability}
        onRequireAuth={() => { setLoginMode('register'); setShowLogin(true); }}
        onRequireLogin={() => { setLoginMode('login'); setShowLogin(true); }}
        onBuyModule={onBuyModule}
      />
      {/* PR-PRICE-3: checkout failure after the auth resume — the house red
          alert vocabulary (PricingClient :193 / ModuleLauncher books-error
          idiom), pinned so it's visible from anywhere on the long page.
          Click dismisses. */}
      {buyError && (
        <div
          role="alert"
          onClick={() => setBuyError(null)}
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 cursor-pointer border border-red-200 bg-red-50 p-3 text-xs text-red-800 shadow-lg"
        >
          {buyError} — click to dismiss, then try Select again.
        </div>
      )}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowLogin(false); setPendingBuyKey(null); }} />
          <div className="relative z-10">
            <LoginBox
              onClose={() => { setShowLogin(false); setPendingBuyKey(null); }}
              onSuccess={() => {
                if (pendingBuyKey) {
                  // Purchase resume: stay on the page and go straight to
                  // checkout — Stripe's return URLs land back on '/'.
                  setShowLogin(false);
                  startCheckout(pendingBuyKey);
                  setPendingBuyKey(null);
                } else {
                  window.location.href = '/';
                }
              }}
              redirectTo="/"
              initialMode={loginMode}
            />
          </div>
        </div>
      )}
    </>
  );
}

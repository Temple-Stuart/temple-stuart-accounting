'use client';

/**
 * UNLOCK-BANNER — the checkout result banner (the parked PR-BANNER-1, now
 * money-path UX: payment confirmation must not be silent).
 *
 * Reads the checkout-entitlement route's OWN return params verbatim
 * (checkout-entitlement/route.ts: success `/?unlocked=<key>`, cancel
 * `/?checkout=cancelled`) and renders a dismissible card on BOTH landings
 * (GuestLanding + HomeClient mounts). Dismiss clears ONLY these two params
 * via router.replace — every other param and the hash survive.
 *
 * Label lookup: the PRICING_MODEL entry for the key (the same vocabulary
 * the deck sells from). A key without a model entry (Google category keys)
 * displays the raw key — the honest identifier, nothing invented.
 *
 * useSearchParams rides inside its own <Suspense> so prerendering never
 * bails (the Next.js requirement; fallback null = no layout shift).
 */

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PRICING_MODEL } from '@/config/pricingModel';

function BannerInner() {
  const params = useSearchParams();
  const router = useRouter();
  const unlockedKey = params.get('unlocked');
  const cancelled = params.get('checkout') === 'cancelled';
  if (!unlockedKey && !cancelled) return null;

  const dismiss = () => {
    const next = new URLSearchParams(params.toString());
    next.delete('unlocked');
    next.delete('checkout');
    const qs = next.toString();
    router.replace(`${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  };

  const label = unlockedKey
    ? (PRICING_MODEL.find((e) => e.key === unlockedKey)?.label ?? unlockedKey)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 lg:px-8">
      <div
        role="status"
        className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-xs ${
          unlockedKey
            ? 'border-status-success/30 bg-status-success/10 text-status-success'
            : 'border-panel-border bg-white/5 text-white/70'
        }`}
      >
        <span>
          {unlockedKey
            ? `${label} unlocked — it's live in your account.`
            : 'Checkout cancelled — nothing was charged.'}
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-current opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function CheckoutResultBanner() {
  return (
    <Suspense fallback={null}>
      <BannerInner />
    </Suspense>
  );
}

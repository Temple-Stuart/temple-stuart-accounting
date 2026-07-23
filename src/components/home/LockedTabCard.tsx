'use client';

// MOD-3: LockedTabCard extracted VERBATIM from TabShowcases.tsx to its own
// leaf so ModuleLauncher's purchase-path import no longer drags TabShowcases
// (and its slide-section modules) into the app graph — the last transitive
// deck thread dies (completes MOD-2's ruled objective). Zero deck imports
// here by construction: react + lucide only.
//
// LOCK discipline (unchanged): "Subscribe to unlock" POSTs
// /api/stripe/checkout-entitlement with this tab's key; the signature-
// verified webhook writes the entitlement row. Logged-out → the sign-up
// modal first. Fail-loud checkout errors. Nothing here unlocks anything —
// the gate lives in ModuleLauncher via isTabLocked.

import { useState } from 'react';
import { Lock } from 'lucide-react';

/** The per-tab locked CTA — Travel's LockedCategoryCard pattern, keyed tab:X. */
export function LockedTabCard({
  tabKey,
  label,
  valueLine,
  currentUserId,
  onRequireAuth,
}: {
  tabKey: string;
  label: string;
  valueLine: string;
  currentUserId: string;
  onRequireAuth: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const onRequestUnlock = async () => {
    if (!currentUserId) {
      onRequireAuth(); // logged out → create an account first (checkout is auth-gated)
      return;
    }
    setError('');
    setStarting(true);
    try {
      const res = await fetch('/api/stripe/checkout-entitlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: tabKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout');
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-brand-purple/15 bg-bg-row px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
        <Lock className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-text-primary">{label} — built and running</p>
        <p className="text-sm text-text-muted">{valueLine}</p>
      </div>
      <button
        type="button"
        onClick={onRequestUnlock}
        disabled={starting}
        className="rounded-lg bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90 disabled:opacity-60"
      >
        {starting ? 'Starting checkout…' : `Subscribe to unlock ${label}`}
      </button>
      {error && <p className="text-sm text-brand-red">{error}</p>}
    </div>
  );
}

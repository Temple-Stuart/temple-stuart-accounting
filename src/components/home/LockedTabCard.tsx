'use client';

// SELL-02: the locked tab's card is THE OFFER CARD — rendered from src/lib/offer.ts
// and the registry, never from a typed claim. The offer that grants this tab
// (offerGranting — Books, with Trade, Tax and Compliance riding inside) is shown
// with every tool's registry claim line, the tab's own tools in bold, and the
// price line: a buy button renders ONLY when the price is live (the const AND
// the Stripe price id); otherwise the declared line stands and nothing is for
// sale. "Subscribe" POSTs the one checkout call (src/lib/checkoutDoor.ts); the
// signature-verified webhook writes the entitlement row. Logged-out → the
// sign-up modal first. Fail-loud checkout errors. Nothing here unlocks anything
// — the gate lives in ModuleLauncher via isTabLocked.

import { useState } from 'react';
import { Lock } from 'lucide-react';
import OfferCard from '@/components/OfferCard';
import { TOOL_GATE, offerCard, offerGranting } from '@/lib/offer';
import { startEntitlementCheckout } from '@/lib/checkoutDoor';

/** The per-tab locked CTA, keyed tab:X — the offer that grants it. */
export function LockedTabCard({
  tabKey,
  currentUserId,
  onRequireAuth,
  offerAvailability,
}: {
  tabKey: string;
  currentUserId: string;
  onRequireAuth: () => void;
  /** Per offer key, is its Stripe price id set — server-computed (offerAvailabilityFromEnv), passed down; never read here. */
  offerAvailability: Readonly<Record<string, boolean>>;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const offer = offerGranting(tabKey);
  if (!offer) {
    // Fail loud: the offer law guarantees every gated tab is granted by an offer; reaching here is a programming error.
    throw new Error(`LockedTabCard: no offer grants ${tabKey}`);
  }
  const card = offerCard(offer, offerAvailability);
  const highlight = card.tools.filter((t) => TOOL_GATE[t.name] === tabKey).map((t) => t.name);

  const onRequestUnlock = async () => {
    if (!currentUserId) {
      onRequireAuth(); // logged out → create an account first (checkout is auth-gated)
      return;
    }
    setError('');
    setStarting(true);
    try {
      window.location.href = await startEntitlementCheckout(offer.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-locked-tab={tabKey}>
      <div className="flex items-center gap-2 text-brand-purple">
        <Lock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">Locked — sold as {offer.label}</span>
      </div>
      <OfferCard
        card={card}
        door={{ kind: 'button', onClick: onRequestUnlock, busy: starting }}
        highlight={highlight}
        error={error || undefined}
      />
    </div>
  );
}

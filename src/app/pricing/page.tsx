import { Suspense } from 'react';
import PricingClient, { type CatalogItem } from './PricingClient';
import { TAB_PRICING } from '@/config/pricing-costs';
import { getPriceIdFromEntitlementKey } from '@/lib/stripe';

/**
 * PRICING-PAGE-SELL: server component — the ONLY place the page touches the
 * STRIPE_*_PRICE_ID env vars. It computes, per sellable key, a single boolean
 * `available` (is a Stripe price ID configured RIGHT NOW) and passes it with
 * the Alex-entered display price to the client. The price-ID VALUES never
 * cross to the client — no secret leak, no extra API route, no PUBLIC_PATHS
 * change. force-dynamic: availability is read per-request, so Alex can add a
 * price ID in Vercel env and the buy-button lights up without a redeploy.
 */
export const dynamic = 'force-dynamic';

export default function PricingPage() {
  const catalog: CatalogItem[] = TAB_PRICING.map((t) => ({
    key: t.key,
    label: t.label,
    unlocks: t.unlocks,
    monthlyPrice: t.monthlyPrice,
    available: getPriceIdFromEntitlementKey(t.key) !== null,
  }));

  return (
    <Suspense>
      <PricingClient catalog={catalog} />
    </Suspense>
  );
}

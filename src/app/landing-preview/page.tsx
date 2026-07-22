/**
 * /landing-preview (FD-1 → FD-1c) — the SCRATCH route for Alex's visual gate.
 * Deliberately NOT in middleware PUBLIC_PATHS: Alex previews it while authed;
 * a logged-out guest hitting this URL is redirected to '/' by the middleware's
 * default unauth handling — guests never see the scratch route. The real
 * arrival branch (page.tsx guest/authed) is FD-2.
 *
 * FD-1c: now a SERVER component — the ONLY place this route touches the
 * STRIPE_*_PRICE_ID env vars. It computes the per-key availability boolean
 * exactly as /pricing/page.tsx:15-24 does (price-ID VALUES never cross to the
 * client) and hands the map to the client wrapper, which supplies the preview
 * stub for onRequireAuth. force-dynamic mirrors /pricing: availability is
 * read per-request, so a newly configured price lights up without a redeploy.
 */

import PreviewClient from './PreviewClient';
import { TAB_PRICING } from '@/config/pricing-costs';
import { getPriceIdFromEntitlementKey } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export default function LandingPreviewPage() {
  const availability = Object.fromEntries(
    TAB_PRICING.map((t) => [t.key, getPriceIdFromEntitlementKey(t.key) !== null]),
  );
  return <PreviewClient availability={availability} />;
}

/**
 * /modules/[pillar] (FD-1d) — the nine shareable module info pages: the
 * pillar's deck STANDALONE (no app chrome, no live tool stacks) + the honest
 * access block, between the shared Bloomberg header/footer.
 *
 * SERVER component — the only place this route touches STRIPE_*_PRICE_ID env
 * vars: it computes the per-key availability booleans exactly as
 * /pricing/page.tsx:15-24 does and passes the map down. force-dynamic mirrors
 * /pricing (no generateStaticParams precedent exists in this repo, and live
 * availability truth beats static generation — the FD-1d determination).
 *
 * An unknown pillar id → notFound() (404) — never a guessed page.
 */

import { notFound } from 'next/navigation';
import ModulePageClient, { PILLARS } from './ModulePageClient';
import { TAB_PRICING } from '@/config/pricing-costs';
import { getPriceIdFromEntitlementKey } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export default async function ModulePage({ params }: { params: Promise<{ pillar: string }> }) {
  const { pillar } = await params;
  const def = PILLARS.find((p) => p.id === pillar);
  if (!def) notFound();

  const availability = Object.fromEntries(
    TAB_PRICING.map((t) => [t.key, getPriceIdFromEntitlementKey(t.key) !== null]),
  );
  return <ModulePageClient pillar={def} availability={availability} />;
}

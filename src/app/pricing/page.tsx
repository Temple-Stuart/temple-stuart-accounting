import { permanentRedirect } from 'next/navigation';

/**
 * PR-PRICE-3 (Alex's ruling): /pricing is a DISCONTINUED surface — the pricing
 * model lives on the landing deck ("THE NINE PILLARS · MODULES",
 * Landing.tsx id="modules"). This route survives ONLY as a permanent redirect
 * so every link in the wild (and any bookmark) lands on the deck; the query
 * string rides along verbatim (?module= / ?modules= / ?cancelled= …).
 * PricingClient (the standalone table) died with this PR — the deck's own
 * Select/Continue flow calls /api/stripe/checkout-entitlement directly, and
 * "Manage existing subscription" moved to the authed home header (HomeClient).
 *
 * permanentRedirect = 308: the discontinuation is a ruling, not an experiment.
 * force-dynamic: searchParams must be read per-request to preserve the query.
 */
export const dynamic = 'force-dynamic';

export default async function PricingPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') qs.append(k, v);
    else if (Array.isArray(v)) for (const item of v) qs.append(k, item);
  }
  const query = qs.toString();
  permanentRedirect(`/${query ? `?${query}` : ''}#modules`);
}

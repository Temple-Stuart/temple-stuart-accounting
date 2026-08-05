// ─── THE pricing model (PR-PRICE-2) — one source of truth, drop-in ready ─────
// Every pricing surface derives from this file: /pricing's table consumes it
// directly (via page.tsx's server availability check) and the landing deck's
// TAB_PRICING is a mapped view of it (pricing-costs.ts) — ONE model, no
// parallel vocabularies (the Pro/Pro+ tier cards died with this PR; tiers.ts
// is LEGACY gate vocabulary only).
//
// RESOLUTION RULE (the skeleton's law, enforced at the render sites):
//   a price renders ONLY when BOTH are true —
//     1. `monthlyPrice` is set here (Alex's display number), AND
//     2. the module's `stripeEnvKey` env var holds a real Stripe price ID
//        (checked server-side, pricing/page.tsx — the value never reaches
//        the client).
//   Anything less renders the ONE honest state: "Pricing coming". No invented
//   numbers, no dead buy buttons, ever.
//
// NUMBERS-DAY (zero restructuring): to light a real price for a module —
//   1. set `monthlyPrice` on its entry below (from the real Stripe price);
//   2. set its `stripeEnvKey` env var in Vercel to the Stripe price ID.
//   The row then renders "$X/mo" with a WORKING Unlock button (the existing
//   checkout-entitlement flow). No layout work, no other code.
//
// `unlocks` strings are the FD-1o gate-verified claims, moved here verbatim
// from pricing-costs.ts TAB_PRICING (which now derives from this file).
// `stripeEnvKey` names mirror entitlementPriceEnvName (src/lib/stripe.ts:49-55)
// — kept as literals because this config is client-safe and stripe.ts is
// server-only; the names cannot drift without failing the availability check.

export interface PricingModelEntry {
  key: string;
  label: string;
  unlocks: string;
  monthlyPrice: number | null;
  stripeEnvKey: string;
}

export const PRICING_MODEL: PricingModelEntry[] = [
  {
    key: 'tab:trade',
    label: 'Trading',
    unlocks: 'the convergence scanner on live market data, trade cards + reconcile queue, trading journal, realized P&L',
    monthlyPrice: null,
    stripeEnvKey: 'STRIPE_TAB_TRADE_PRICE_ID',
  },
  {
    key: 'tab:books',
    label: 'Bookkeeping',
    unlocks: 'Plaid bank sync, double-entry journal & ledger, statements, reconciliation, period close, spending insights',
    monthlyPrice: null,
    stripeEnvKey: 'STRIPE_TAB_BOOKS_PRICE_ID',
  },
  {
    key: 'tab:tax',
    label: 'Tax',
    unlocks: '1040 estimate from your closed books, Schedule C/D/SE, wash sales, Form 8949 + CPA export',
    monthlyPrice: null,
    stripeEnvKey: 'STRIPE_TAB_TAX_PRICE_ID',
  },
  {
    key: 'tab:compliance',
    label: 'Compliance',
    unlocks: 'regulatory corpus search, citation verification, missions & tasks, the tamper-evident audit registry',
    monthlyPrice: null,
    stripeEnvKey: 'STRIPE_TAB_COMPLIANCE_PRICE_ID',
  },
  {
    key: 'bundle:all',
    label: 'All-modules bundle',
    unlocks: 'every module above with one subscription (resolved at read time — one purchase unlocks all tabs)',
    monthlyPrice: null,
    stripeEnvKey: 'STRIPE_BUNDLE_ALL_PRICE_ID',
  },
];

/** The resolution rule as code — render a price ONLY in the 'live' state. */
export function priceState(
  entry: Pick<PricingModelEntry, 'monthlyPrice'>,
  stripeConfigured: boolean,
): { kind: 'live'; monthlyPrice: number } | { kind: 'coming' } {
  return entry.monthlyPrice !== null && stripeConfigured
    ? { kind: 'live', monthlyPrice: entry.monthlyPrice }
    : { kind: 'coming' };
}

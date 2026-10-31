/**
 * LAW-02 (2026-09-27) — A HOLD WITH NO STATED PRICE NEVER REACHES THE CARD FORM.
 *
 * prebookRate (src/lib/liteapiClient.ts) used to turn an unstated price into 0 and
 * an unstated currency into 'USD', so the checkout showed "$0.00" and opened the
 * card form for a figure the vendor never gave. It carries NULL now, and the
 * checkout panel (src/components/trips/CheckoutPanel.tsx) asks this leaf before it
 * moves to the pay phase: anything unstated is named, and the panel shows the
 * CHECKOUT-01 named failure (kind 'prebook') instead of a card ask. Pure.
 */

/** The prebook fields this gate reads — as the route returned them, untyped. */
export interface PrebookMoney {
  price?: unknown;
  currency?: unknown;
}

/** What the vendor did not state, in words ("a price", "a currency", "a price and a currency"), or null when both are stated. */
export function prebookUnstatedMoney(p: PrebookMoney | null | undefined): string | null {
  const price = typeof p?.price === 'number' && Number.isFinite(p.price);
  const currency = typeof p?.currency === 'string' && p.currency.length > 0;
  if (price && currency) return null;
  if (!price && !currency) return 'a price and a currency';
  return price ? 'a currency' : 'a price';
}

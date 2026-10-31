import Stripe from 'stripe';
// SELL-02: the purchasable set and the price-env naming rule live in the offer (src/lib/offer.ts).
import { SELLABLE_KEYS, priceEnvName } from '@/lib/offer';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }
  return _stripe;
}

// SELL-05b: the tier price maps (STRIPE_PRO_PRICE_ID / STRIPE_PRO_PLUS_PRICE_ID) are gone with
// the tier system. The offer's keys below are the ONLY prices the store knows; a Stripe event
// for any other price grants nothing, loudly (the webhook's fail-safe).

// ═══ ENTITLEMENT-WRITER: per-key price mapping ═══
// SELL-02: the purchasable entitlement vocabulary is THE OFFER's keys
// (src/lib/offer.ts OFFERS — Books and the all-modules bundle; the offer law
// keeps the nine Google category keys out of it). Each
// key's Stripe price ID lives in an env var named by the offer's rule
// (priceEnvName). Alex creates the Stripe products and sets the env vars; a
// key with NO env var set is simply NOT purchasable (checkout 400s with a
// clear message, and no selling surface renders a buy button for it) — never
// a fallback price, never a free grant.
//
//   'tab:books'  → STRIPE_TAB_BOOKS_PRICE_ID
//   'bundle:all' → STRIPE_BUNDLE_ALL_PRICE_ID
//
// Rows already held for keys no longer sold (a Google category; the retired
// tab:operations, which no reader asks for) keep whatever gate semantics a
// reader gives them (getEntitledCategories reads every active row); a
// Stripe event for such a subscription maps to no purchasable key and the
// webhook declares "NO change" — nothing is granted or revoked silently.

export const PURCHASABLE_ENTITLEMENT_KEYS: readonly string[] = SELLABLE_KEYS;

export const entitlementPriceEnvName = priceEnvName;

export function getPriceIdFromEntitlementKey(key: string): string | null {
  if (!PURCHASABLE_ENTITLEMENT_KEYS.includes(key)) return null;
  return process.env[entitlementPriceEnvName(key)] || null;
}

/**
 * Reverse lookup for the webhook: which entitlement key (if any) does a paid
 * price ID belong to? Returns null for an unknown price — the caller must
 * treat null as "not an entitlement purchase", NEVER grant.
 */
export function getEntitlementKeyFromPriceId(priceId: string): string | null {
  if (!priceId) return null;
  for (const key of PURCHASABLE_ENTITLEMENT_KEYS) {
    const configured = process.env[entitlementPriceEnvName(key)];
    if (configured && configured === priceId) return key;
  }
  return null;
}

import Stripe from 'stripe';
import { GOOGLE_CATEGORY_KEYS, TAB_ENTITLEMENT_KEYS, BUNDLE_ALL_KEY } from '@/lib/categoryKeys';

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

export function getTierFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro';
  if (priceId === process.env.STRIPE_PRO_PLUS_PRICE_ID) return 'pro_plus';
  return 'free';
}

export function getPriceIdFromTier(tier: string): string | null {
  if (tier === 'pro') return process.env.STRIPE_PRO_PRICE_ID || null;
  if (tier === 'pro_plus') return process.env.STRIPE_PRO_PLUS_PRICE_ID || null;
  return null;
}

// ═══ ENTITLEMENT-WRITER: per-key (category / tab / bundle) price mapping ═══
// The purchasable entitlement vocabulary = the 9 Google category keys +
// the tab:X keys + bundle:all (all defined in src/lib/categoryKeys.ts).
// Each key's Stripe price ID lives in an env var whose name is derived
// deterministically below. Alex creates the Stripe products and sets the
// env vars; a key with NO env var set is simply NOT purchasable (checkout
// 400s with a clear message) — never a fallback price, never a free grant.
//
//   'brunch_coffee' → STRIPE_CAT_BRUNCH_COFFEE_PRICE_ID
//   'tab:trade'     → STRIPE_TAB_TRADE_PRICE_ID
//   'bundle:all'    → STRIPE_BUNDLE_ALL_PRICE_ID

export const PURCHASABLE_ENTITLEMENT_KEYS: readonly string[] = [
  ...GOOGLE_CATEGORY_KEYS,
  ...TAB_ENTITLEMENT_KEYS,
  BUNDLE_ALL_KEY,
];

export function entitlementPriceEnvName(key: string): string {
  if (key === BUNDLE_ALL_KEY) return 'STRIPE_BUNDLE_ALL_PRICE_ID';
  if (key.startsWith('tab:')) {
    return `STRIPE_TAB_${key.slice(4).toUpperCase()}_PRICE_ID`;
  }
  return `STRIPE_CAT_${key.toUpperCase()}_PRICE_ID`;
}

export function getPriceIdFromEntitlementKey(key: string): string | null {
  if (!PURCHASABLE_ENTITLEMENT_KEYS.includes(key)) return null;
  return process.env[entitlementPriceEnvName(key)] || null;
}

/**
 * Reverse lookup for the webhook: which entitlement key (if any) does a paid
 * price ID belong to? Returns null for tier prices and unknown prices —
 * the caller must treat null as "not an entitlement purchase", NEVER grant.
 */
export function getEntitlementKeyFromPriceId(priceId: string): string | null {
  if (!priceId) return null;
  for (const key of PURCHASABLE_ENTITLEMENT_KEYS) {
    const configured = process.env[entitlementPriceEnvName(key)];
    if (configured && configured === priceId) return key;
  }
  return null;
}

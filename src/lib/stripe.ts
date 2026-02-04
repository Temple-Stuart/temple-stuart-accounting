import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

/**
 * Map Stripe Price IDs to internal tier names.
 * Set these in .env.local after creating products in Stripe dashboard.
 */
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

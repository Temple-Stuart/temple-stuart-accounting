import { getStripe } from './stripe';

/**
 * PR-PAY-1 — the STRIPE flight payment rail (server pieces only).
 *
 * Duffel Payments is closed to new customers (the banner on their live
 * Payment Intents reference — DUFFEL-AUDIT-1), so flight card collection
 * pivots to Stripe: Stripe collects the customer's card → Alex pre-funds the
 * Duffel balance → orders continue as payments:[{type:'balance'}]
 * (book/route.ts:178-183, untouched this PR).
 *
 * This module deliberately does NOT touch src/lib/stripe.ts (the subscription
 * commerce client + price-ID resolution stays byte-identical; ruling 1) — it
 * only imports getStripe() from it. No mock mode, no silent defaults: every
 * unparseable input and unrecognized key THROWS.
 */

/**
 * Stripe's documented zero-decimal currencies — amounts are charged in the
 * currency's smallest unit, which for these IS the whole unit (¥100 → 100).
 * Source: https://docs.stripe.com/currencies#zero-decimal (the "Zero-decimal
 * currencies" list). Duffel amounts arrive as DECIMAL STRINGS ("129.76").
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

/**
 * Stripe's documented THREE-decimal currencies (BHD/JOD/KWD/OMR/TND —
 * https://docs.stripe.com/currencies#three-decimal). They carry an extra
 * rounding rule (last minor-unit digit must be 0). No Duffel flight offer has
 * surfaced one on our rails; rather than guess the rounding, we THROW —
 * fail-loud until a real case forces a ruled implementation.
 */
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

/**
 * Decimal-string → Stripe minor units, EXACT STRING MATH — no float
 * multiplication anywhere (0.1+0.2-class drift can never mint or lose a cent).
 *
 * INVARIANT: for a two-decimal currency, toMinorUnits(s) === the integer whose
 * decimal representation is s with the point removed and the fraction
 * right-padded to exactly 2 digits ("129.76"→12976, "129.7"→12970, "129"→12900).
 * For a zero-decimal currency the amount must already be an integer number of
 * units ("2500000" VND → 2500000); a non-zero fraction is malformed and THROWS.
 *
 * THROWS on: empty/non-numeric/negative input, more fraction digits than the
 * currency allows, three-decimal currencies (see above), and results outside
 * Number's safe-integer range.
 */
export function toMinorUnits(amountDecimal: string, currency: string): number {
  const cur = currency.toUpperCase();
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amountDecimal.trim());
  if (!m) {
    throw new Error(`toMinorUnits: unparseable amount ${JSON.stringify(amountDecimal)} (${cur})`);
  }
  const intPart = m[1];
  const fracPart = m[2] ?? '';

  if (THREE_DECIMAL_CURRENCIES.has(cur)) {
    throw new Error(`toMinorUnits: three-decimal currency ${cur} is not implemented (needs its own rounding ruling)`);
  }

  let minorStr: string;
  if (ZERO_DECIMAL_CURRENCIES.has(cur)) {
    // Whole units ARE the minor units; a fractional part must be all zeros.
    if (fracPart.replace(/0/g, '') !== '') {
      throw new Error(`toMinorUnits: fractional amount ${JSON.stringify(amountDecimal)} for zero-decimal currency ${cur}`);
    }
    minorStr = intPart;
  } else {
    // Two-decimal currency: shift the decimal point two places as a string.
    if (fracPart.length > 2) {
      throw new Error(`toMinorUnits: too many decimal places in ${JSON.stringify(amountDecimal)} for two-decimal currency ${cur}`);
    }
    minorStr = intPart + fracPart.padEnd(2, '0');
  }

  const minor = Number(minorStr);
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`toMinorUnits: amount ${JSON.stringify(amountDecimal)} (${cur}) exceeds the safe integer range`);
  }
  return minor;
}

/**
 * The Stripe secret key's mode, from its documented prefix (sk_live_/sk_test_,
 * or the restricted-key forms rk_live_/rk_test_). THROWS on a missing key or
 * an unrecognized prefix — never a default (ruling 3: the route cross-checks
 * this against the Duffel mode gate and fails closed on any disagreement).
 */
export function stripeKeyMode(): 'live' | 'test' {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('stripeKeyMode: STRIPE_SECRET_KEY is not set');
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) return 'live';
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) return 'test';
  throw new Error('stripeKeyMode: STRIPE_SECRET_KEY has an unrecognized prefix');
}

/**
 * Create the Stripe PaymentIntent for a flight offer. Amount is the
 * SERVER-derived offer total (decimal string — the route derives it via
 * applyMarkup(offer.total_amount); never client-supplied), converted here with
 * exact string math. The Duffel offer id rides metadata for reconciliation.
 */
export async function createFlightPaymentIntent({ amountDecimal, currency, offerId }: {
  amountDecimal: string;
  currency: string;
  offerId: string;
}) {
  return getStripe().paymentIntents.create({
    amount: toMinorUnits(amountDecimal, currency),
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: { duffel_offer_id: offerId },
  });
}

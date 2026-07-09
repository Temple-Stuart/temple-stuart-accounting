import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe, getPriceIdFromEntitlementKey, PURCHASABLE_ENTITLEMENT_KEYS } from '@/lib/stripe';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * ENTITLEMENT-WRITER: POST { key } → a Stripe Checkout Session for ONE
 * entitlement key (a Google category like 'brunch_coffee', a tab like
 * 'tab:trade', or 'bundle:all').
 *
 * Mirrors api/stripe/checkout (the PAYWALL tier route) exactly:
 * auth FIRST (getVerifiedEmail → 401, user → 404), then key validation
 * (unknown key → 400; known key with no configured price → 400 — a key
 * without a STRIPE_*_PRICE_ID env var is simply not purchasable, never
 * granted). The session metadata carries { userId, entitlementKey } so the
 * signature-verified webhook can write the user-scoped entitlement row.
 * Nothing is granted here — only the webhook (after signature verification
 * AND price↔key cross-check) writes entitlements.
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { key } = await request.json();
    if (typeof key !== 'string' || !PURCHASABLE_ENTITLEMENT_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Unknown entitlement key' }, { status: 400 });
    }
    const priceId = getPriceIdFromEntitlementKey(key);
    if (!priceId) {
      return NextResponse.json(
        { error: 'This item is not purchasable yet (price not configured)' },
        { status: 400 }
      );
    }

    // Create or reuse Stripe customer — same flow as api/stripe/checkout
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.users.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/?unlocked=${encodeURIComponent(key)}`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,
      metadata: { userId: user.id, entitlementKey: key },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe entitlement checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}

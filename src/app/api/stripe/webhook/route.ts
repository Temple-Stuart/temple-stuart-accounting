import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe, getTierFromPriceId } from '@/lib/stripe';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

const OWNER_EMAIL = process.env.OWNER_EMAIL;

// PAYWALL: every tier entitlement change lands in the tamper-evident audit log.
// actor = external_integration (Stripe, authenticated by webhook signature);
// request_id = `${event.id}:${userId}` so Stripe's at-least-once retries and
// multi-user events cannot double-log (writeAuditLog dedupes by request_id).
async function auditTierChange(opts: {
  eventId: string;
  eventType: string;
  userId: string;
  email: string | null;
  fromTier: string;
  toTier: string;
  subscriptionId: string | null;
}) {
  await writeAuditLog({
    actor: { type: 'external_integration', email: 'stripe-webhook' },
    action: {
      type: opts.toTier === 'free' ? 'permission_revoked' : 'permission_granted',
      description: `Stripe ${opts.eventType}: tier ${opts.fromTier} → ${opts.toTier} for ${opts.email ?? opts.userId}`,
    },
    target: { table: 'users', id: opts.userId },
    payload: {
      before: { tier: opts.fromTier },
      after: { tier: opts.toTier },
      metadata: { stripe_event: opts.eventType, subscription_id: opts.subscriptionId },
    },
    request_id: `${opts.eventId}:${opts.userId}`,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;

        if (userId && subscriptionId) {
          // Fetch subscription to get price ID
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;

          // FALLBACK TRIPWIRE: a paid tier is granted ONLY from a verified,
          // recognized price ID. No readable price → NO grant (the previous
          // `: 'pro'` default here was a default-to-paid violation). An
          // unrecognized price maps to 'free' (getTierFromPriceId) — a no-op
          // for a checkout user, never an escalation.
          if (!priceId) {
            console.error(
              `Stripe webhook: checkout.session.completed ${event.id} has no price ID on subscription ${subscriptionId} — NO tier granted (fail-safe)`,
            );
            break;
          }
          const tier = getTierFromPriceId(priceId);

          const checkoutUser = await prisma.users.findUnique({ where: { id: userId } });
          if (checkoutUser && checkoutUser.email !== OWNER_EMAIL) {
            await prisma.users.update({
              where: { id: userId },
              data: {
                tier,
                stripeSubscriptionId: subscriptionId,
                stripeCustomerId: session.customer as string,
              },
            });
            await auditTierChange({
              eventId: event.id,
              eventType: event.type,
              userId,
              email: checkoutUser.email,
              fromTier: checkoutUser.tier,
              toTier: tier,
              subscriptionId,
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const priceId = subscription.items.data[0]?.price.id;
        const tier = priceId ? getTierFromPriceId(priceId) : 'free';
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const user = await prisma.users.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (user && user.email !== OWNER_EMAIL) {
          // Fail-safe by construction: unknown price → 'free' (getTierFromPriceId),
          // missing price → 'free', non-active subscription → 'free'. A paid tier
          // is only ever set from a recognized price on an ACTIVE subscription.
          const effectiveTier = subscription.status === 'active' ? tier : 'free';
          await prisma.users.update({
            where: { id: user.id },
            data: {
              tier: effectiveTier,
              stripeSubscriptionId: subscription.id,
            },
          });
          if (effectiveTier !== user.tier) {
            await auditTierChange({
              eventId: event.id,
              eventType: event.type,
              userId: user.id,
              email: user.email,
              fromTier: user.tier,
              toTier: effectiveTier,
              subscriptionId: subscription.id,
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const user = await prisma.users.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (user && user.email !== OWNER_EMAIL) {
          await prisma.users.update({
            where: { id: user.id },
            data: {
              tier: 'free',
              stripeSubscriptionId: null,
            },
          });
          if (user.tier !== 'free') {
            await auditTierChange({
              eventId: event.id,
              eventType: event.type,
              userId: user.id,
              email: user.email,
              fromTier: user.tier,
              toTier: 'free',
              subscriptionId: subscription.id,
            });
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 });
  }
}

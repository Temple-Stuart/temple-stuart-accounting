import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe, getTierFromPriceId } from '@/lib/stripe';

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
          const tier = priceId ? getTierFromPriceId(priceId) : 'pro';

          await prisma.users.update({
            where: { id: userId },
            data: {
              tier,
              stripeSubscriptionId: subscriptionId,
              stripeCustomerId: session.customer as string,
            },
          });
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

        if (user) {
          await prisma.users.update({
            where: { id: user.id },
            data: {
              tier: subscription.status === 'active' ? tier : 'free',
              stripeSubscriptionId: subscription.id,
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const user = await prisma.users.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (user) {
          await prisma.users.update({
            where: { id: user.id },
            data: {
              tier: 'free',
              stripeSubscriptionId: null,
            },
          });
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

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getStripe, getTierFromPriceId, getEntitlementKeyFromPriceId } from '@/lib/stripe';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
// REBUILD-01 PR-4: every delivery lands raw-first — the signed bytes, one arrival per event
// (client_secret redacted and declared), the handler from the arrival, one transaction.
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { customerIdOf, runStripeDelivery } from '@/lib/arrivals/stripeWebhook';

const OWNER_EMAIL = process.env.OWNER_EMAIL;

/** The handler's database — the delivery's transaction client (PR-4), so its writes roll back with the landing. writeAuditLog keeps its own hash-chained transaction. */
type Db = Prisma.TransactionClient;

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

// ENTITLEMENT-WRITER: every entitlement grant/revoke lands in the same
// tamper-evident audit log. request_id includes the key so one Stripe event
// touching multiple rows cannot collide, and retries dedupe.
async function auditEntitlementChange(opts: {
  eventId: string;
  eventType: string;
  userId: string;
  email: string | null;
  key: string;
  granted: boolean;
  subscriptionId: string | null;
  rowId: string;
}) {
  await writeAuditLog({
    actor: { type: 'external_integration', email: 'stripe-webhook' },
    action: {
      type: opts.granted ? 'permission_granted' : 'permission_revoked',
      description: `Stripe ${opts.eventType}: entitlement ${opts.key} ${opts.granted ? 'granted to' : 'revoked from'} ${opts.email ?? opts.userId}`,
    },
    target: { table: 'user_category_entitlements', id: opts.rowId },
    payload: {
      after: { key: opts.key, status: opts.granted ? 'active' : 'inactive' },
      metadata: { stripe_event: opts.eventType, subscription_id: opts.subscriptionId },
    },
    request_id: `${opts.eventId}:${opts.userId}:${opts.key}`,
  });
}

// The paid period end, read from the subscription item (this API version keeps
// current_period_end on the item). Missing → null: the row's lifecycle is then
// purely status-driven (revoked by the deleted/updated events) — the schema's
// existing semantic for a null currentPeriodEnd. Never a fabricated date.
function entitlementPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const unix = subscription.items.data[0]?.current_period_end;
  return typeof unix === 'number' && unix > 0 ? new Date(unix * 1000) : null;
}

// ENTITLEMENT-WRITER: the ONE place an entitlement row is written from a paid
// event. Caller must have (a) verified the webhook signature and (b) derived
// `key` from the RECOGNIZED price ID — never from metadata alone.
async function grantEntitlement(db: Db, opts: {
  eventId: string;
  eventType: string;
  userId: string;
  email: string | null;
  key: string;
  active: boolean;
  subscriptionId: string;
  currentPeriodEnd: Date | null;
}) {
  const status = opts.active ? 'active' : 'inactive';
  // Audit on state TRANSITIONS only — a renewal that refreshes the period end
  // without changing status updates the row silently (the row itself is the
  // record); a grant or revoke always lands in the audit log.
  const previous = await db.userCategoryEntitlement.findUnique({
    where: { userId_categoryKey: { userId: opts.userId, categoryKey: opts.key } },
    select: { status: true },
  });
  const row = await db.userCategoryEntitlement.upsert({
    where: { userId_categoryKey: { userId: opts.userId, categoryKey: opts.key } },
    create: {
      userId: opts.userId,
      categoryKey: opts.key,
      status,
      stripeSubscriptionId: opts.subscriptionId,
      currentPeriodEnd: opts.currentPeriodEnd,
    },
    update: {
      status,
      stripeSubscriptionId: opts.subscriptionId,
      currentPeriodEnd: opts.currentPeriodEnd,
    },
  });
  if (previous?.status !== status) {
    await auditEntitlementChange({
      eventId: opts.eventId,
      eventType: opts.eventType,
      userId: opts.userId,
      email: opts.email,
      key: opts.key,
      granted: opts.active,
      subscriptionId: opts.subscriptionId,
      rowId: row.id,
    });
  }
}

/**
 * Who an event belongs to: the checkout session's metadata.userId when it names one
 * of our users, else the user whose stripeCustomerId is the object's customer. Null
 * → the arrival lands as a guest (guest_ref = the customer id, or event:<id>).
 */
async function userForEvent(db: Db, event: Stripe.Event): Promise<string | null> {
  if (event.type === 'checkout.session.completed') {
    const metaUserId = event.data.object.metadata?.userId;
    if (metaUserId) {
      const u = await db.users.findUnique({ where: { id: metaUserId }, select: { id: true } });
      if (u) return u.id;
    }
  }
  const customerId = customerIdOf(event);
  if (!customerId) return null;
  const u = await db.users.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } });
  return u?.id ?? null;
}

export async function POST(request: NextRequest) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get('stripe-signature');

  const outcome = await runStripeDelivery<Stripe.Event>(
    prisma,
    { rawBody, signature, secret: process.env.STRIPE_WEBHOOK_SECRET, receivedAt: new Date() },
    (body, sig, secret) => getStripe().webhooks.constructEvent(body, sig, secret),
    (tx) => {
      const db = tx as Db;
      return {
        landing: prismaLanding(db),
        userFor: (event) => userForEvent(db, event),
        handle: (event) => handleStripeEvent(db, event),
      };
    },
  );

  if (!outcome.ok && outcome.failure === 'signature') {
    // Nothing landed; Stripe's expected 400.
    console.error('Stripe webhook:', outcome.error.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  if (!outcome.ok) {
    // The delivery rolled back whole; a non-2xx makes Stripe redeliver.
    console.error('Stripe webhook error:', outcome.error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
  const r = outcome.result;
  console.log(`[stripe] ${r.type} ${r.eventId}: ${r.outcome}${r.handled ? '' : ' — handler skipped'}${r.redactions.length ? ` · redacted ${r.redactions.join(', ')}` : ''}${r.guestRef ? ` · guest ${r.guestRef}` : ''}`);
  return NextResponse.json({ received: true, landed: r.outcome, handled: r.handled });
}

/** The existing handler, unchanged in what it does — it reads the ARRIVAL payload (PR-4) and writes through the delivery's transaction. */
async function handleStripeEvent(db: Db, event: Stripe.Event): Promise<void> {
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
              `Stripe webhook: checkout.session.completed ${event.id} has no price ID on subscription ${subscriptionId} — NO grant (fail-safe)`,
            );
            break;
          }

          // ENTITLEMENT-WRITER: route by what the PAID PRICE actually is.
          // An entitlement price grants an entitlement row (never touches
          // user.tier); a tier price grants a tier (never an entitlement);
          // an unrecognized price grants NOTHING, loudly.
          const entitlementKey = getEntitlementKeyFromPriceId(priceId);
          const tier = getTierFromPriceId(priceId); // 'free' when not a tier price

          const checkoutUser = await db.users.findUnique({ where: { id: userId } });
          if (!checkoutUser || checkoutUser.email === OWNER_EMAIL) break;

          if (entitlementKey) {
            // Cross-check: our checkout-entitlement route always stamps the key
            // in session metadata. A mismatch means this session is not ours —
            // NO write (the price is the truth, the metadata is the check).
            const metaKey = session.metadata?.entitlementKey;
            if (metaKey !== entitlementKey) {
              console.error(
                `Stripe webhook: ${event.id} price maps to entitlement '${entitlementKey}' but session metadata says '${metaKey ?? 'none'}' — NO grant (fail-safe)`,
              );
              break;
            }
            await grantEntitlement(db, {
              eventId: event.id,
              eventType: event.type,
              userId,
              email: checkoutUser.email,
              key: entitlementKey,
              active: true,
              subscriptionId,
              currentPeriodEnd: entitlementPeriodEnd(subscription),
            });
          } else if (tier !== 'free') {
            await db.users.update({
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
          } else {
            // FALLBACK TRIPWIRE: recognized by neither map — nothing granted.
            console.error(
              `Stripe webhook: checkout.session.completed ${event.id} price ${priceId} matches no tier and no entitlement key — NO grant (fail-safe)`,
            );
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const priceId = subscription.items.data[0]?.price.id;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const user = await db.users.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (!user || user.email === OWNER_EMAIL) break;

        // ENTITLEMENT-WRITER: route by subscription type (a user can hold a
        // tier subscription AND entitlement subscriptions — an update to one
        // must never touch the other).
        const entitlementKey = priceId ? getEntitlementKeyFromPriceId(priceId) : null;

        if (entitlementKey) {
          // Entitlement subscription: active → row active; any other status
          // (past_due, canceled, unpaid…) → row inactive. Upsert covers the
          // renewal case and a race where 'updated' lands before 'completed'
          // — the key still comes ONLY from the recognized paid price.
          await grantEntitlement(db, {
            eventId: event.id,
            eventType: event.type,
            userId: user.id,
            email: user.email,
            key: entitlementKey,
            active: subscription.status === 'active',
            subscriptionId: subscription.id,
            currentPeriodEnd: entitlementPeriodEnd(subscription),
          });
          break;
        }

        const tier = priceId ? getTierFromPriceId(priceId) : 'free';
        // Mixed-subscription guard: only treat this as the user's TIER
        // subscription if the price maps to a tier OR this subscription is the
        // one recorded as their tier subscription. An unrecognized price on
        // some other subscription must never downgrade the tier.
        if (tier === 'free' && user.stripeSubscriptionId !== subscription.id) {
          console.error(
            `Stripe webhook: subscription.updated ${event.id} price ${priceId ?? 'none'} is neither tier nor entitlement and not the user's tier subscription — NO change (fail-safe)`,
          );
          break;
        }
        // Fail-safe by construction: unknown price → 'free', missing price →
        // 'free', non-active subscription → 'free'. A paid tier is only ever
        // set from a recognized price on an ACTIVE subscription.
        const effectiveTier = subscription.status === 'active' ? tier : 'free';
        await db.users.update({
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
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const user = await db.users.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (!user || user.email === OWNER_EMAIL) break;

        // ENTITLEMENT-WRITER: if this subscription backs entitlement rows,
        // revoke exactly those rows (status → inactive, audit-logged) and do
        // NOT touch the user's tier.
        const entitlementRows = await db.userCategoryEntitlement.findMany({
          where: { userId: user.id, stripeSubscriptionId: subscription.id },
        });
        if (entitlementRows.length > 0) {
          for (const row of entitlementRows) {
            await db.userCategoryEntitlement.update({
              where: { id: row.id },
              data: { status: 'inactive' },
            });
            await auditEntitlementChange({
              eventId: event.id,
              eventType: event.type,
              userId: user.id,
              email: user.email,
              key: row.categoryKey,
              granted: false,
              subscriptionId: subscription.id,
              rowId: row.id,
            });
          }
          break;
        }

        // Mixed-subscription guard: only reset the TIER when the deleted
        // subscription is the user's recorded tier subscription. Deleting some
        // other (unrecognized) subscription must never downgrade the tier.
        if (user.stripeSubscriptionId !== subscription.id) {
          console.error(
            `Stripe webhook: subscription.deleted ${event.id} (${subscription.id}) backs no entitlement rows and is not the user's tier subscription — NO change (fail-safe)`,
          );
          break;
        }

        await db.users.update({
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
        break;
      }
    }

}

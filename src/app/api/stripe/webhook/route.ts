import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getStripe, getEntitlementKeyFromPriceId } from '@/lib/stripe';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
// REBUILD-01 PR-4: every delivery lands raw-first — the signed bytes, one arrival per event
// (client_secret redacted and declared), the handler from the arrival, one transaction.
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { customerIdOf, runStripeDelivery } from '@/lib/arrivals/stripeWebhook';
// LAUNCH-01 LAPSE-01: a lapsed subscription is told — the row records when/why it
// ended (src/lib/lapse.ts), and the user is mailed AFTER the delivery commits
// (src/lib/lapseMail.ts, declared on failure).
import { lapseWrite, subscriptionIdOfInvoice, type LapseReason } from '@/lib/lapse';
import { sendLapseMail, type LapseMail } from '@/lib/lapseMail';
import { OFFERS } from '@/lib/offer';

const OWNER_EMAIL = process.env.OWNER_EMAIL;

/** The offer's label for a row's key (src/lib/offer.ts); a key no offer sells is named as itself. */
function offerLabelFor(key: string): string {
  return OFFERS.find((o) => o.key === key)?.label ?? key;
}

/** When a subscription ended: Stripe's ended_at on the object when present, else the event's own timestamp. */
function endedAtOf(event: Stripe.Event, unix: number | null | undefined): Date {
  return new Date((typeof unix === 'number' && unix > 0 ? unix : event.created) * 1000);
}

/** The handler's database — the delivery's transaction client (PR-4), so its writes roll back with the landing. writeAuditLog keeps its own hash-chained transaction. */
type Db = Prisma.TransactionClient;

// SELL-05b: the tier branch is gone — the offer's entitlement keys are the ONLY prices
// this webhook grants; every other price is declared and grants nothing. users.tier is
// never written here any more.

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
      // LAPSE-01: a re-grant clears the lapse; a revoke through this path (an
      // updated event with a non-active status) leaves any recorded lapse as is.
      ...(opts.active ? { ended_at: null, ended_reason: null } : {}),
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

  // LAPSE-01: the mails the handler collects inside the transaction — sent only
  // after it commits (a rolled-back write is never announced; an already_landed
  // redelivery runs no handler, so it mails nobody twice).
  const lapses: LapseMail[] = [];

  const outcome = await runStripeDelivery<Stripe.Event>(
    prisma,
    { rawBody, signature, secret: process.env.STRIPE_WEBHOOK_SECRET, receivedAt: new Date() },
    (body, sig, secret) => getStripe().webhooks.constructEvent(body, sig, secret),
    (tx) => {
      const db = tx as Db;
      return {
        landing: prismaLanding(db),
        userFor: (event) => userForEvent(db, event),
        handle: (event) => handleStripeEvent(db, event, lapses),
      };
    },
    (line) => console.log(line),
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

  // LAPSE-01: the lapse mails, after the commit. Each is one attempt through
  // Resend; a failure is logged with its class (sendLapseMail) and counted here
  // — the entitlement write stands and Stripe's 200 stands with it.
  let lapseMails: { sent: number; failed: number } | undefined;
  if (r.handled && lapses.length > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    lapseMails = { sent: 0, failed: 0 };
    for (const mail of lapses) {
      const result = await sendLapseMail(mail, baseUrl);
      if (result.sent) lapseMails.sent += 1; else lapseMails.failed += 1;
    }
    console.log(`[stripe] ${r.eventId}: lapse mails — ${lapseMails.sent} sent, ${lapseMails.failed} failed`);
  }
  return NextResponse.json({ received: true, landed: r.outcome, handled: r.handled, ...(lapseMails ? { lapseMails } : {}) });
}

/** Revoke the entitlement rows a subscription backs with the lapse recorded (when, why), audit each, and queue the user's mail. */
async function lapseRows(db: Db, event: Stripe.Event, opts: {
  user: { id: string; email: string; name: string };
  subscriptionId: string;
  reason: LapseReason;
  endedAt: Date;
  lapses: LapseMail[];
}): Promise<number> {
  const rows = await db.userCategoryEntitlement.findMany({
    where: { userId: opts.user.id, stripeSubscriptionId: opts.subscriptionId },
  });
  for (const row of rows) {
    await db.userCategoryEntitlement.update({
      where: { id: row.id },
      data: lapseWrite(opts.reason, opts.endedAt),
    });
    // Audit the revoke on the TRANSITION (a payment_failed landing after the
    // updated/past_due revoke finds the row already inactive — the lapse fields
    // still land, the audit is not repeated).
    if (row.status === 'active') {
      await auditEntitlementChange({
        eventId: event.id,
        eventType: event.type,
        userId: opts.user.id,
        email: opts.user.email,
        key: row.categoryKey,
        granted: false,
        subscriptionId: opts.subscriptionId,
        rowId: row.id,
      });
    }
    opts.lapses.push({
      to: opts.user.email,
      name: opts.user.name,
      offerLabel: offerLabelFor(row.categoryKey),
      endedAt: opts.endedAt,
      reason: opts.reason,
    });
  }
  return rows.length;
}

/** The handler — it reads the ARRIVAL payload (PR-4) and writes through the delivery's transaction; lapse mails are queued into `lapses` for the route to send after the commit. */
async function handleStripeEvent(db: Db, event: Stripe.Event, lapses: LapseMail[]): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;

        if (userId && subscriptionId) {
          // Fetch subscription to get price ID
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;

          // FALLBACK TRIPWIRE: an entitlement is granted ONLY from a verified,
          // recognized price ID. No readable price → NO grant (the previous
          // default-to-paid here was a violation). An unrecognized price
          // grants nothing, loudly — never an escalation.
          if (!priceId) {
            console.error(
              `Stripe webhook: checkout.session.completed ${event.id} has no price ID on subscription ${subscriptionId} — NO grant (fail-safe)`,
            );
            break;
          }

          // ENTITLEMENT-WRITER: route by what the PAID PRICE actually is.
          // An entitlement price grants an entitlement row; any other price
          // grants NOTHING, loudly (SELL-05b: there is no tier to grant).
          const entitlementKey = getEntitlementKeyFromPriceId(priceId);

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
          } else {
            // FALLBACK TRIPWIRE: not an entitlement price — nothing granted.
            console.error(
              `Stripe webhook: checkout.session.completed ${event.id} price ${priceId} matches no entitlement key — NO grant (fail-safe)`,
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

        // ENTITLEMENT-WRITER: only an entitlement subscription is ours to update.
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

        // SELL-05b: not an entitlement price → NO change, declared (there is no tier to move).
        console.error(
          `Stripe webhook: subscription.updated ${event.id} price ${priceId ?? 'none'} is not an entitlement price — NO change (fail-safe)`,
        );
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
        // revoke exactly those rows (status → inactive, audit-logged).
        // LAPSE-01: the row records when (Stripe's ended_at) and why
        // ('canceled'); the user is mailed after the commit.
        const revoked = await lapseRows(db, event, {
          user,
          subscriptionId: subscription.id,
          reason: 'canceled',
          endedAt: endedAtOf(event, subscription.ended_at),
          lapses,
        });
        if (revoked > 0) break;

        // SELL-05b: a subscription backing no entitlement rows is not ours — NO change, declared.
        console.error(
          `Stripe webhook: subscription.deleted ${event.id} (${subscription.id}) backs no entitlement rows — NO change (fail-safe)`,
        );
        break;
      }

      case 'invoice.payment_failed': {
        // LAPSE-01: a failed renewal. The subscription itself moves to past_due
        // through customer.subscription.updated (which revokes the row); this
        // branch records WHY and WHEN on the row and tells the user. Order of
        // the two deliveries is not guaranteed, so this write is complete on
        // its own (status inactive + the lapse fields) and idempotent.
        const invoice = event.data.object;
        const subscriptionId = subscriptionIdOfInvoice(invoice);
        if (!subscriptionId) {
          console.error(`Stripe webhook: invoice.payment_failed ${event.id} (${invoice.id}) bills no subscription — NO change (fail-safe)`);
          break;
        }
        const customerId = customerIdOf(event);
        const user = customerId ? await db.users.findFirst({ where: { stripeCustomerId: customerId } }) : null;
        if (!user || user.email === OWNER_EMAIL) break;

        const lapsed = await lapseRows(db, event, {
          user,
          subscriptionId,
          reason: 'payment_failed',
          endedAt: endedAtOf(event, null),
          lapses,
        });
        if (lapsed > 0) break;

        console.error(
          `Stripe webhook: invoice.payment_failed ${event.id} (${subscriptionId}) backs no entitlement rows — NO change (fail-safe)`,
        );
        break;
      }
    }

}

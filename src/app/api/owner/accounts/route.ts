import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';

// OWNER-DASH: the accounts panel's read — every user with the cheap
// per-account intel the OWNER-DASH v2 audit mapped (counts + entitlements).
// Supersedes the display precedent at /api/admin/users (users/route.ts:16-25),
// which serialized RAW Stripe ids; here `hasStripe` is the only Stripe fact
// that crosses the wire. `password` is NEVER selected (explicit select list,
// no spread). requireAdmin FIRST — the 18-route precedent.

export async function GET() {
  const adminGate = await requireAdmin();
  if (adminGate instanceof NextResponse) return adminGate;

  try {
    const users = await prisma.users.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        tier: true,
        bookkeeping_initialized: true,
        scanner_start_date: true,
        accountCode: true,
        // Selected ONLY to derive hasStripe below — the raw id never leaves
        // this handler.
        stripeCustomerId: true,
        _count: {
          select: {
            plaid_items: true,
            trade_cards: true,
            trips: true,
            reservations: true,
          },
        },
      },
    });

    // UserCategoryEntitlement has no Prisma relation to users (schema comment:
    // standalone table, joined by userId) — one findMany, grouped in JS.
    const entitlements = await prisma.userCategoryEntitlement.findMany({
      select: { userId: true, categoryKey: true, status: true, currentPeriodEnd: true },
    });
    const entitlementsByUser = new Map<
      string,
      Array<{ categoryKey: string; status: string; currentPeriodEnd: Date | null }>
    >();
    for (const e of entitlements) {
      const list = entitlementsByUser.get(e.userId) ?? [];
      list.push({
        categoryKey: e.categoryKey,
        status: e.status,
        currentPeriodEnd: e.currentPeriodEnd,
      });
      entitlementsByUser.set(e.userId, list);
    }

    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        tier: u.tier,
        bookkeeping_initialized: u.bookkeeping_initialized,
        scanner_start_date: u.scanner_start_date,
        accountCode: u.accountCode,
        hasStripe: u.stripeCustomerId !== null,
        counts: u._count,
        entitlements: entitlementsByUser.get(u.id) ?? [],
      })),
    );
  } catch (error) {
    console.error('Owner accounts error:', error);
    return NextResponse.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}

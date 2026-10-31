import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { renameAccount, retireAccount, type ChartAccountRow } from '@/lib/coa/accounts';
import { prismaChartDb } from '@/lib/coa/prismaChartDb';

/**
 * /api/chart-of-accounts/[id]
 *
 * PUT   — rename (COA-01): { name?, code?, family? | accountType?, subType? }.
 *         A new code obeys the entity's scheme and its family's range and must
 *         be unique in the entity's chart (src/lib/coa/accounts.ts renameAccount).
 * PATCH — retire / restore: { archived: boolean }. The flag flips and NOTHING
 *         else — accounts are never deleted; balance and ledger history stay
 *         (ledger_entries.account is Restrict; no_ledger_updates refuses edits).
 *         A retired account leaves every categorization list (the GET routes
 *         filter it, assign-coa refuses it, the auto-categorizer skips it).
 *
 * Same auth chain on both: verified email → user → tab:books → the account is
 * the user's (defensive 404).
 */

async function ownedAccount(userId: string, id: string): Promise<ChartAccountRow | null> {
  const r = await prisma.chart_of_accounts.findFirst({
    where: { id, userId },
    select: {
      id: true, userId: true, entity_id: true, entity_type: true, code: true, name: true,
      account_type: true, balance_type: true, sub_type: true, module: true, settled_balance: true, is_archived: true,
    },
  });
  return r ? { ...r, userId: r.userId ?? userId } : null;
}

function serialize(updated: ChartAccountRow) {
  return {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    accountType: updated.account_type,
    balanceType: updated.balance_type,
    subType: updated.sub_type,
    settledBalance: Number(updated.settled_balance),
    entity_id: updated.entity_id,
    entity_type: updated.entity_type,
    is_archived: updated.is_archived,
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { name, code, subType } = body ?? {};
    const family = body?.family ?? body?.accountType;

    const existing = await ownedAccount(user.id, id);
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const updated = await renameAccount(prismaChartDb(prisma, user.id), {
      userId: user.id,
      entity: { id: existing.entity_id, entity_type: existing.entity_type },
      account: existing,
      name,
      code,
      family,
      subType,
    });

    return NextResponse.json({ success: true, account: serialize(updated) });
  } catch (error) {
    return failClosedResponse('COA update', 'Failed to update account', error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (typeof body?.archived !== 'boolean') {
      return NextResponse.json({ error: 'archived must be true or false', field: 'archived' }, { status: 400 });
    }

    const existing = await ownedAccount(user.id, id);
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const updated = await retireAccount(prismaChartDb(prisma, user.id), existing, body.archived);

    return NextResponse.json({
      success: true,
      account: { id: updated.id, code: updated.code, is_archived: updated.is_archived },
    });
  } catch (error) {
    return failClosedResponse('COA archive', 'Failed to update archive state', error);
  }
}

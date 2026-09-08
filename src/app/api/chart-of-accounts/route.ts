import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireEntitySetup } from '@/lib/ensure-bookkeeping';
import { requireTabAccess } from '@/lib/auth-helpers';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { addAccount } from '@/lib/coa/accounts';
import { prismaChartDb } from '@/lib/coa/prismaChartDb';

/**
 * /api/chart-of-accounts
 *
 * GET  — the user's accounts (optionally one entity); active only unless
 *        include_archived=true, so every categorization list that reads this
 *        route hides retired accounts by default (COA-01).
 * POST — add an account (COA-01): { entityId, code, name, family, subType? }.
 *        The code follows the ENTITY's scheme (src/lib/coa/scheme.ts): four
 *        digits or the entity letter and four digits, inside the family's
 *        range, unique in the entity's chart — a retired account at that code
 *        is a 409 with the restore hint. `accountType` is accepted as the
 *        legacy name of `family`. Every refusal is a ValidationError answered
 *        verbatim at its status; faults are the fixed failClosed line.
 *
 * Gate order on both: verified email → user → tab:books → the entity is the
 * user's (defensive 404).
 */

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    // SELL-04: a user with no entity gets the declared setup line (412) — nothing is created here.
    const setup = await requireEntitySetup(user);
    if (setup) return setup;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entity_id') || null;
    const includeArchived = searchParams.get('include_archived') === 'true';

    const accounts = await prisma.chart_of_accounts.findMany({
      where: {
        userId: user.id,
        ...(includeArchived ? {} : { is_archived: false }),
        ...(entityId && { entity_id: entityId })
      },
      orderBy: [
        { code: 'asc' }
      ]
    });

    // Convert ALL BigInt fields to numbers for JSON serialization
    const serializedAccounts = accounts.map(acc => ({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      accountType: acc.account_type,
      balanceType: acc.balance_type,
      // DIM-2: the S segment of the derived dimensional string (client renders
      // via deriveAccountString — the string is a render, never stored).
      subType: acc.sub_type,
      settledBalance: Number(acc.settled_balance),
      pendingBalance: Number(acc.pending_balance),
      version: Number(acc.version),
      is_archived: acc.is_archived,
      entity_id: acc.entity_id,
      entity_type: acc.entity_type,
      createdAt: acc.created_at,
      updatedAt: acc.updated_at
    }));

    return NextResponse.json({ accounts: serializedAccounts });
  } catch (error) {
    return failClosedResponse('COA fetch', 'Failed to fetch chart of accounts', error);
  }
}

export async function POST(request: Request) {
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
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    // SELL-04: a user with no entity gets the declared setup line (412) — nothing is created here.
    const setup = await requireEntitySetup(user);
    if (setup) return setup;

    const body = await request.json().catch(() => ({}));
    const { code, name, entityId, subType } = body ?? {};
    const family = body?.family ?? body?.accountType;

    if (typeof entityId !== 'string' || !entityId) {
      return NextResponse.json({ error: 'entityId is required', field: 'entityId' }, { status: 400 });
    }

    // Verify entity belongs to user — defensive 404.
    const entity = await prisma.entities.findFirst({
      where: { id: entityId, userId: user.id },
      select: { id: true, entity_type: true },
    });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const account = await addAccount(prismaChartDb(prisma, user.id), {
      userId: user.id,
      entity,
      code,
      name,
      family,
      subType,
    });

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: account.account_type,
        balanceType: account.balance_type,
        subType: account.sub_type,
        entity_id: account.entity_id,
        entity_type: account.entity_type,
        settledBalance: 0,
        pendingBalance: 0,
        version: 0,
        is_archived: false,
      }
    });
  } catch (error) {
    return failClosedResponse('COA create', 'Failed to create account', error);
  }
}

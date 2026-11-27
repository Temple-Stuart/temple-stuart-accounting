import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireEntitySetup } from '@/lib/ensure-bookkeeping';
import { requireTabAccess } from '@/lib/auth-helpers';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { renderCode } from '@/lib/coa/scheme';
import { addSubAccount } from '@/lib/coa/subAccounts';
import { prismaSubAccountDb } from '@/lib/coa/prismaSubAccountDb';
import { isValidUuid } from '@/lib/operations/parseUuid';

/**
 * /api/chart-of-accounts/sub-accounts — COALEVELS-01 (Alex, 2026-11-27).
 *
 * A sub-account is a two-digit code and a name under ONE chart account: the account is the CATEGORY, the sub-account the TYPE
 * (the one rule: src/lib/coa/subAccounts.ts). This file is the table's one writer.
 *
 * GET  ?entity_id=&include_archived= — the caller's sub-accounts, ordered by their account's code and then their own; active
 *        ones under active accounts unless include_archived=true. Answered { subAccounts: [{ id, accountId, accountCode,
 *        entityId, code, name, is_archived }] }.
 * POST { accountId, name, code? } — add one under an account of the caller's. The name stands once under its account; the
 *        code is two digits, free under the account, or — not sent — the next ten (10, 20, …). Every refusal is a
 *        ValidationError answered verbatim at its status; faults are the fixed failClosed line. Answered 201
 *        { success: true, subAccount: { id, accountId, accountCode, code, name, is_archived } }.
 *
 * Gate order on both, /api/chart-of-accounts' own: verified email → user → tab:books → entity setup. The account is read
 * as the caller's — an account that is missing and one that is another user's answer alike (defensive 404). No paid call.
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

    const subAccounts = await prisma.chart_of_sub_accounts.findMany({
      where: {
        userId: user.id,
        account: {
          userId: user.id,
          ...(entityId && { entity_id: entityId }),
          ...(includeArchived ? {} : { is_archived: false }),
        },
        ...(includeArchived ? {} : { is_archived: false }),
      },
      select: { id: true, account_id: true, code: true, name: true, is_archived: true, account: { select: { code: true, entity_id: true } } },
      orderBy: [{ account: { code: 'asc' } }, { code: 'asc' }],
    });

    return NextResponse.json({
      subAccounts: subAccounts.map((s) => ({
        id: s.id,
        accountId: s.account_id,
        accountCode: s.account.code,
        entityId: s.account.entity_id,
        code: s.code,
        name: s.name,
        is_archived: s.is_archived,
      })),
    });
  } catch (error) {
    return failClosedResponse('COA sub-accounts fetch', 'Failed to fetch sub-accounts', error);
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
    const { accountId, name, code } = body ?? {};

    if (typeof accountId !== 'string' || !accountId) {
      return NextResponse.json({ error: 'accountId is required', field: 'accountId' }, { status: 400 });
    }

    // The account is read as the caller's — its own row AND its entity. Missing, another user's, or an id that is no
    // account's id at all (not a UUID: no query is made for it) answer alike — defensive 404.
    const account = !isValidUuid(accountId) ? null : await prisma.chart_of_accounts.findFirst({
      where: { id: accountId, userId: user.id, entity: { userId: user.id } },
      select: { id: true, code: true, name: true, is_archived: true, entity: { select: { entity_type: true } } },
    });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const subAccount = await addSubAccount(prismaSubAccountDb(prisma), {
      userId: user.id,
      parent: { id: account.id, rendered: renderCode(account.code, account.entity.entity_type), name: account.name, is_archived: account.is_archived },
      name,
      code,
      createdBy: userEmail,
    });

    return NextResponse.json({
      success: true,
      subAccount: {
        id: subAccount.id,
        accountId: subAccount.account_id,
        accountCode: account.code,
        code: subAccount.code,
        name: subAccount.name,
        is_archived: subAccount.is_archived,
      },
    }, { status: 201 });
  } catch (error) {
    return failClosedResponse('COA sub-account create', 'Failed to create sub-account', error);
  }
}

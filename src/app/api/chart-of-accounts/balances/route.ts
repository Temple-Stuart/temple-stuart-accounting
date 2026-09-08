import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');
    // COA-01: retired accounts are hidden unless asked for — the COA page asks,
    // so a retired account's balance and history stay visible there.
    const includeArchived = searchParams.get('include_archived') === 'true';

    // SECURITY: Scoped to user's COA only
    const accounts = await prisma.chart_of_accounts.findMany({
      where: {
        userId: user.id,
        ...(includeArchived ? {} : { is_archived: false }),
        ...(entityId && { entity_id: entityId }),
      },
      orderBy: { code: 'asc' }
    });

    return NextResponse.json({
      accounts: accounts.map(acc => ({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        accountType: acc.account_type,
        balanceType: acc.balance_type,
        settledBalance: acc.settled_balance.toString(),
        pendingBalance: acc.pending_balance.toString(),
        entityId: acc.entity_id,
        entityType: acc.entity_type,
        subType: acc.sub_type,
        is_archived: acc.is_archived,
      }))
    });
  } catch (error) {
    console.error('COA fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

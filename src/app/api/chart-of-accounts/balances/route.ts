import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

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

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');

    // SECURITY: Scoped to user's COA only
    const accounts = await prisma.chart_of_accounts.findMany({
      where: {
        userId: user.id,
        is_archived: false,
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
        entityType: acc.entity_type
      }))
    });
  } catch (error) {
    console.error('COA fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

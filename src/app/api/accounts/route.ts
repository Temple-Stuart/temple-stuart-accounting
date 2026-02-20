import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const items = await prisma.plaid_items.findMany({
      where: { userId: user.id },
      include: {
        accounts: true
      }
    });

    const transformedItems = items.map(item => ({
      id: item.id,
      institutionName: item.institutionName,
      accounts: item.accounts.map(account => ({
        id: account.id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        balance: account.currentBalance || 0,
      }))
    }));

    // Dashboard expects { items: [...] }
    return NextResponse.json({ items: transformedItems });
  } catch (error) {
    console.error('Accounts error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

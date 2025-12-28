import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const items = await prisma.plaid_items.findMany({
      where: { userId: user.id },
      include: {
        accounts: {
          include: {
            transactions: {
              orderBy: { date: 'desc' },
              take: 100
            },
            investment_transactions: {
              orderBy: { date: 'desc' },
              take: 100
            }
          }
        }
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
        currentBalance: account.currentBalance,
        availableBalance: account.availableBalance,
        transactions: account.transactions,
        investment_transactions: account.investment_transactions,
      }))
    }));

    return NextResponse.json(transformedItems);
  } catch (error) {
    console.error('Accounts error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

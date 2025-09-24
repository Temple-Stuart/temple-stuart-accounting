import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
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

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id },
      include: { accounts: true }
    });

    const mappedPlaidItems = plaidItems.map(item => ({
      id: item.id,
      accounts: item.accounts.map(account => ({
        id: account.id,
        name: account.name,
        institution: 'Bank', // Default since institutionName doesn't exist
        type: account.type,
        subtype: account.subtype || '',
        balance: account.currentBalance || 0,
        lastSync: account.updatedAt
      }))
    }));

    const allAccounts = mappedPlaidItems.flatMap(item => item.accounts);

    return NextResponse.json(allAccounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get all Plaid items and accounts for this user
    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId },
      include: {
        accounts: true
      }
    });

    // Map the data to match frontend interface
    const mappedPlaidItems = plaidItems.map(item => ({
      id: item.id,
      institutionName: item.institutionName,
      accounts: item.accounts.map(account => ({
        id: account.id,
        name: account.name,
        type: account.type,
        subtype: account.subtype || '',
        balance: account.balanceCurrent || 0
      }))
    }));

    console.log('Returning plaid items:', mappedPlaidItems.length);
    
    return NextResponse.json({ plaidItems: mappedPlaidItems });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';

export async function POST() {
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
      where: { userId: user.id }
    });

    let updatedCount = 0;

    for (const item of plaidItems) {
      try {
        const response = await plaidClient.transactionsGet({
          access_token: item.accessToken,
          start_date: '2024-01-01',
          end_date: new Date().toISOString().split('T')[0]
        });

        for (const plaidTxn of response.data.transactions) {
          await prisma.transactions.updateMany({
            where: { transactionId: plaidTxn.transaction_id },
            data: { 
              category: plaidTxn.category ? plaidTxn.category.join(', ') : null,
              merchantName: plaidTxn.merchant_name
            }
          });
          updatedCount++;
        }
      } catch (error) {
        console.error('Error fixing categories for item:', item.id, error);
      }
    }

    return NextResponse.json({ 
      success: true, 
      updatedCount 
    });
  } catch (error) {
    console.error('Fix categories error:', error);
    return NextResponse.json({ error: 'Failed to fix categories' }, { status: 500 });
  }
}

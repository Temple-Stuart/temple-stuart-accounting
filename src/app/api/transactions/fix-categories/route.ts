import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { decryptToken } from '@/lib/secrets/tokenCipher';

export async function POST() {
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

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id }
    });

    let updatedCount = 0;

    for (const item of plaidItems) {
      try {
        const response = await plaidClient.transactionsGet({
          access_token: decryptToken(item.accessToken),
          start_date: '2024-01-01',
          end_date: new Date().toISOString().split('T')[0]
        });

        for (const plaidTxn of response.data.transactions) {
          // SEC-01: transactions carry no userId (prisma/schema.prisma:414-450). The
          // real ownership path is transactions.accountId → accounts.plaidItemId →
          // plaid_items.userId. The write is scoped to THIS item under THIS user;
          // a transactionId held by another user matches zero rows. No fallback.
          const result = await prisma.transactions.updateMany({
            where: {
              transactionId: plaidTxn.transaction_id,
              accounts: { plaid_items: { id: item.id, userId: user.id } },
            },
            data: { 
              category: plaidTxn.category ? plaidTxn.category.join(', ') : null,
              merchantName: plaidTxn.merchant_name
            }
          });
          updatedCount += result.count;
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

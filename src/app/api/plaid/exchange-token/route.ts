import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';

export async function POST(request: Request) {
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

    const { publicToken } = await request.json();

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken
    });

    const { access_token: accessToken, item_id: itemId } = exchangeResponse.data;

    // Generate unique ID for plaid_item
    const plaidItemId = `plaid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store in database
    await prisma.plaid_items.create({
      data: {
        id: plaidItemId,
        itemId,
        accessToken,
        userId: user.id,
        updatedAt: new Date(),
      },
    });

    // Sync accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken
    });

    for (const account of accountsResponse.data.accounts) {
      const accountId = `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await prisma.accounts.create({
        data: {
          id: accountId,
          accountId: account.account_id,
          name: account.name,
          officialName: account.official_name,
          type: account.type,
          subtype: account.subtype,
          mask: account.mask,
          currentBalance: account.balances.current,
          availableBalance: account.balances.available,
          isoCurrencyCode: account.balances.iso_currency_code,
          plaidItemId: plaidItemId,
          userId: user.id,
          updatedAt: new Date(),
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}

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

    // Get item metadata to get institution info
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken
    });

    // Store in database with institution info
    await prisma.plaid_items.create({
      data: {
        id: plaidItemId,
        itemId,
        accessToken,
        institutionId: itemResponse.data.item.institution_id || 'unknown',
        institutionName: 'Robinhood', // You can enhance this with institution lookup
        userId: user.id,
        updatedAt: new Date(),
      },
    });

    // Sync accounts - handle both regular and investment accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken
    });

    console.log('Accounts from Plaid:', accountsResponse.data.accounts.map(a => ({
      name: a.name,
      type: a.type,
      balances: a.balances
    })));

    // For investment accounts, also get holdings for balance calculation
    let holdings = null;
    try {
      const holdingsResponse = await plaidClient.investmentsHoldingsGet({
        access_token: accessToken
      });
      holdings = holdingsResponse.data.holdings;
      console.log(`Found ${holdings.length} holdings for investment accounts`);
    } catch (e) {
      console.log('Not an investment account or holdings not available');
    }

    for (const account of accountsResponse.data.accounts) {
      const accountId = `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate balance - for investment accounts, use holdings if available
      let currentBalance = account.balances.current;
      let availableBalance = account.balances.available;
      
      if (holdings && account.type === 'investment') {
        // Sum up all holdings for this account
        const accountHoldings = holdings.filter(h => h.account_id === account.account_id);
        currentBalance = accountHoldings.reduce((sum, holding) => {
          const value = holding.institution_value || (holding.institution_price * holding.quantity);
          console.log(`Holding: ${holding.quantity} @ ${holding.institution_price} = ${value}`);
          return sum + value;
        }, 0);
        availableBalance = currentBalance; // For investments, available = current
        console.log(`Calculated investment balance for ${account.name}: $${currentBalance}`);
      }
      
      console.log(`Creating account ${account.name} with balance: $${currentBalance || 0}`);
      
      await prisma.accounts.create({
        data: {
          id: accountId,
          accountId: account.account_id,
          name: account.name,
          officialName: account.official_name,
          type: account.type,
          subtype: account.subtype,
          mask: account.mask,
          currentBalance: currentBalance || 0,
          availableBalance: availableBalance || currentBalance || 0,
          isoCurrencyCode: account.balances.iso_currency_code || 'USD',
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

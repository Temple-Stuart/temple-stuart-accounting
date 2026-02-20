import { requireTier, getCurrentUser} from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { CountryCode } from 'plaid';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tierGate = requireTier(user.tier, 'plaid');
    if (tierGate) return tierGate;

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

    // Get the actual institution name from Plaid
    let institutionName = 'Unknown';
    const institutionId = itemResponse.data.item.institution_id;
    
    if (institutionId) {
      try {
        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us]
        });
        institutionName = institutionResponse.data.institution.name;
      } catch (e) {
        console.log('Could not fetch institution name');
      }
    }

    // Store in database with correct institution info
    await prisma.plaid_items.create({
      data: {
        id: plaidItemId,
        itemId,
        accessToken,
        institutionId: institutionId || 'unknown',
        institutionName: institutionName,
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
          currentBalance: account.balances.current || 0,
          availableBalance: account.balances.available || account.balances.current || 0,
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

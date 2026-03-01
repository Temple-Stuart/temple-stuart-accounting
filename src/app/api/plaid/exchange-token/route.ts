import { requireTier } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { CountryCode } from 'plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function POST(request: Request) {
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
      // Dedup: check if this account already exists
      // Check 1: exact Plaid account_id match (same link)
      let existing = await prisma.accounts.findUnique({
        where: { accountId: account.account_id }
      });

      // Check 2: same user + mask + type (re-link scenario where Plaid
      // issues a new account_id for the same physical account)
      if (!existing && account.mask) {
        existing = await prisma.accounts.findFirst({
          where: {
            userId: user.id,
            mask: account.mask,
            type: account.type,
          }
        });
      }

      if (existing) {
        // Update existing account: refresh balance, re-link to new Plaid item
        await prisma.accounts.update({
          where: { id: existing.id },
          data: {
            accountId: account.account_id,
            plaidItemId: plaidItemId,
            currentBalance: account.balances.current || 0,
            availableBalance: account.balances.available || account.balances.current || 0,
            updatedAt: new Date(),
          }
        });
        continue;
      }

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

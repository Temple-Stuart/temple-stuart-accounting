import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { public_token, metadata } = await request.json();

    if (!public_token) {
      return NextResponse.json({ error: 'Missing public token' }, { status: 400 });
    }

    console.log('Exchanging public token for institution:', metadata?.institution?.name);

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get account details
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    // Store in database - using the correct table name 'plaid_items'
    const plaidItem = await prisma.plaid_items.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        itemId,
        accessToken,
        institutionId: metadata?.institution?.institution_id || 'unknown',
        institutionName: metadata?.institution?.name || 'Unknown Bank',
        updatedAt: new Date(),
      },
    });

    // Store accounts - using the correct table name 'accounts'
    for (const account of accountsResponse.data.accounts) {
      await prisma.accounts.create({
        data: {
          id: crypto.randomUUID(),
          plaidItemId: plaidItem.id,
          accountId: account.account_id,
          name: account.name,
          officialName: account.official_name,
          type: account.type,
          subtype: account.subtype,
          balanceAvailable: account.balances.available,
          balanceCurrent: account.balances.current,
          balanceLimit: account.balances.limit,
          updatedAt: new Date(),
        },
      });
    }

    console.log('Successfully connected', accountsResponse.data.accounts.length, 'accounts');

    return NextResponse.json({ 
      success: true,
      institution: metadata?.institution?.name,
      accounts: accountsResponse.data.accounts.length 
    });

  } catch (error: any) {
    console.error('Token exchange error:', {
      message: error.message,
      code: error.response?.data?.error_code,
      type: error.response?.data?.error_type,
    });

    return NextResponse.json(
      { 
        error: 'Failed to exchange token',
        details: error.message,
        code: error.response?.data?.error_code 
      },
      { status: 500 }
    );
  }
}

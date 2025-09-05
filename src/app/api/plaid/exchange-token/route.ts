import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const configuration = new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function POST(request: NextRequest) {
  try {
    // Verify JWT token from cookie
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { public_token, institution_name } = await request.json();

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const access_token = exchangeResponse.data.access_token;
    const item_id = exchangeResponse.data.item_id;

    // Get accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token,
    });

    // Save Plaid item to database
    const plaidItem = await prisma.plaidItem.create({
      data: {
        itemId: item_id,
        accessToken: access_token,
        institutionId: 'unknown',
        institutionName: institution_name,
        userId: decoded.userId,
      },
    });

    // Save accounts to database
    for (const account of accountsResponse.data.accounts) {
      await prisma.account.create({
        data: {
          plaidItemId: plaidItem.id,
          accountId: account.account_id,
          name: account.name,
          officialName: account.official_name,
          type: account.type,
          subtype: account.subtype,
          balanceAvailable: account.balances.available,
          balanceCurrent: account.balances.current,
          balanceLimit: account.balances.limit,
        },
      });
    }

    return NextResponse.json({ 
      message: 'Bank account connected successfully',
      itemId: item_id 
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

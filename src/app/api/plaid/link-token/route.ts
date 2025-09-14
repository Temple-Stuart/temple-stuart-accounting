import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { verifyAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Creating link token with config:', {
      user: { client_user_id: userId },
      client_name: 'Temple Stuart Accounting',
      products: ['transactions', 'investments'],
      country_codes: ['US'],
      language: 'en',
      environment: process.env.PLAID_ENV
    });

    const configs = {
      user: {
        client_user_id: userId,
      },
      client_name: 'Temple Stuart Accounting',
      products: [Products.Transactions, Products.Investments],
      country_codes: [CountryCode.Us],
      language: 'en',
    };

    const createTokenResponse = await plaidClient.linkTokenCreate(configs);
    
    return NextResponse.json({ 
      link_token: createTokenResponse.data.link_token,
      expiration: createTokenResponse.data.expiration 
    });
  } catch (error: any) {
    console.error('Error creating link token:', error);
    return NextResponse.json(
      { error: 'Failed to create link token', details: error.message },
      { status: 500 }
    );
  }
}

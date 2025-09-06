import { NextRequest, NextResponse } from 'next/server';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const client = new PlaidApi(configuration);

export async function POST(request: NextRequest) {
  try {
    const request_data = {
      products: ['transactions'],
      client_name: 'Temple Stuart Accounting',
      country_codes: ['US'],
      language: 'en',
      user: {
        client_user_id: 'user123',
      },
    };

    const response = await client.linkTokenCreate(request_data);
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error.response?.data || error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}

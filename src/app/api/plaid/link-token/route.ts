import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, Products, PlaidEnvironments, LinkTokenCreateRequest, CountryCode } from 'plaid';
import jwt from 'jsonwebtoken';

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
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const request_data: LinkTokenCreateRequest = {
      products: [Products.Transactions],
      client_name: "Temple Stuart Accounting",
      country_codes: [CountryCode.Us],
      language: 'en',
      user: {
        client_user_id: decoded.userId
      }
    };

    const response = await client.linkTokenCreate(request_data);
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}

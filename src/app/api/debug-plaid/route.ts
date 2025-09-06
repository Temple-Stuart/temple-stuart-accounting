import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    
    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId: decoded.userId }
    });

    const debugInfo = [];

    for (const item of plaidItems) {
      try {
        // Get item info to see what products we have
        const itemResponse = await client.itemGet({
          access_token: item.accessToken
        });

        // Get accounts to see account types
        const accountsResponse = await client.accountsGet({
          access_token: item.accessToken
        });

        debugInfo.push({
          item_id: item.id,
          products: itemResponse.data.item.products,
          available_products: itemResponse.data.item.available_products,
          accounts: accountsResponse.data.accounts.map(acc => ({
            account_id: acc.account_id,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype
          }))
        });
      } catch (error) {
        debugInfo.push({
          item_id: item.id,
          error: error.message
        });
      }
    }

    return NextResponse.json({ debugInfo });
  } catch (error) {
    return NextResponse.json({ error: error.message });
  }
}

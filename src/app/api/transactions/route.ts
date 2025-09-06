import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { PlaidApi, Configuration, PlaidEnvironments, TransactionsGetRequest } from 'plaid';
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

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId: decoded.userId }
    });

    const allTransactions = [];

    for (const item of plaidItems) {
      const request: TransactionsGetRequest = {
        access_token: item.accessToken,
        start_date: '2020-01-01',
        end_date: new Date().toISOString().split('T')[0]
      };

      try {
        const response = await client.transactionsGet(request);
        allTransactions.push(...response.data.transactions);
        console.log(`Found ${response.data.transactions.length} transactions for item ${item.id}`);
      } catch (error) {
        console.error('Error fetching transactions for item:', item.id, error.response?.data || error);
      }
    }

    return NextResponse.json({ 
      transactions: allTransactions,
      total_count: allTransactions.length 
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

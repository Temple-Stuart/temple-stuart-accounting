import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
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
      where: { userId: decoded.userId },
      include: { accounts: true }
    });

    const allTransactions = [];

    for (const item of plaidItems) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();

      const request = {
        access_token: item.accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      };

      try {
        const response = await client.transactionsGet(request);
        allTransactions.push(...response.data.transactions);
        console.log(`Found ${response.data.transactions.length} transactions for item ${item.id}`);
      } catch (error) {
        console.error('Error fetching transactions for item:', item.id, error instanceof Error ? error.message : String(error));
      }
    }

    return NextResponse.json({ transactions: allTransactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

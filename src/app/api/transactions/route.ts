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
      // Get 24 months of data instead of 30 days
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 24); // 24 months back
      const endDate = new Date();

      const request = {
        access_token: item.accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        count: 500, // Max transactions per request
        offset: 0
      };

      try {
        // Plaid returns max 500 transactions at a time, so we need to paginate
        let hasMore = true;
        let offset = 0;
        
        while (hasMore) {
          const response = await client.transactionsGet({
            ...request,
            offset: offset
          });
          
          // Add institution name to each transaction
          const transactionsWithInstitution = response.data.transactions.map(transaction => ({
            ...transaction,
            institution_name: item.institutionName
          }));
          
          allTransactions.push(...transactionsWithInstitution);
          
          // Check if there are more transactions to fetch
          const totalTransactions = response.data.total_transactions;
          offset += response.data.transactions.length;
          hasMore = offset < totalTransactions;
          
          console.log(`Fetched ${offset} of ${totalTransactions} transactions for ${item.institutionName}`);
        }
      } catch (error) {
        console.error('Error fetching transactions for item:', item.id, error instanceof Error ? error.message : String(error));
      }
    }

    console.log(`Total transactions fetched: ${allTransactions.length}`);
    return NextResponse.json({ transactions: allTransactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

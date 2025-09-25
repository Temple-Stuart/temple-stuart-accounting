import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const items = await prisma.plaid_items.findMany({
      include: {
        accounts: {
          include: {
            transactions: {
              orderBy: { date: 'desc' },
              take: 100
            },
            investment_transactions: {
              orderBy: { date: 'desc' },
              take: 100
            }
          }
        }
      }
    });

    const transformedItems = items.map(item => ({
      id: item.id,
      institutionName: item.institutionName,
      accessToken: item.accessToken,
      accounts: item.accounts.map(account => ({
        id: account.id,
        accountId: account.accountId,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        // CRITICAL FIX: Use currentBalance and map to balance
        balance: account.currentBalance || 0,
        available_balance: account.availableBalance || 0,
        transactions: account.transactions,
        investment_transactions: account.investment_transactions
      }))
    }));

    return NextResponse.json({ items: transformedItems });

  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

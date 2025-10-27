import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get('entity_type') || null;
    
    const accounts = await prisma.chart_of_accounts.findMany({
      where: {
        is_archived: false,
        ...(entity_type && { entity_type })
      },
      orderBy: [
        { code: 'asc' }
      ]
    });

    // Convert ALL BigInt fields to numbers for JSON serialization
    const serializedAccounts = accounts.map(acc => ({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      accountType: acc.account_type,
      balanceType: acc.balance_type,
      settledBalance: Number(acc.settled_balance),
      pendingBalance: Number(acc.pending_balance),
      version: Number(acc.version),
      is_archived: acc.is_archived,
      entity_type: acc.entity_type,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt
    }));

    return NextResponse.json({ accounts: serializedAccounts });
  } catch (error) {
    console.error('COA fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch chart of accounts' }, { status: 500 });
  }
}

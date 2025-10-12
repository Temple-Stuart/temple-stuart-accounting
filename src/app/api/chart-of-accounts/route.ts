import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType') || null;
    
    const accounts = await prisma.chartOfAccount.findMany({
      where: {
        isArchived: false,
        ...(entityType && { entityType })
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
      accountType: acc.accountType,
      balanceType: acc.balanceType,
      settledBalance: Number(acc.settledBalance),
      pendingBalance: Number(acc.pendingBalance),
      version: Number(acc.version),
      isArchived: acc.isArchived,
      entityType: acc.entityType,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt
    }));

    return NextResponse.json({ accounts: serializedAccounts });
  } catch (error) {
    console.error('COA fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch chart of accounts' }, { status: 500 });
  }
}

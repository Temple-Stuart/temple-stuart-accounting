import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get('entity_type') || null;
    
    const accounts = await prisma.chart_of_accounts.findMany({
      where: {
        userId: user.id,
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
      createdAt: acc.created_at,
      updatedAt: acc.updated_at
    }));

    return NextResponse.json({ accounts: serializedAccounts });
  } catch (error) {
    console.error('COA fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch chart of accounts' }, { status: 500 });
  }
}

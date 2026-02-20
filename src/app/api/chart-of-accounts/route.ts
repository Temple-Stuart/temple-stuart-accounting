import { randomUUID } from 'crypto';
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
        // userId: user.id, // COA is shared
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

const BALANCE_TYPE_MAP: Record<string, string> = {
  asset: 'D',
  expense: 'D',
  liability: 'C',
  equity: 'C',
  revenue: 'C',
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { code, name, accountType, entityType } = await request.json();

    if (!code || !name || !accountType) {
      return NextResponse.json({ error: 'code, name, and accountType are required' }, { status: 400 });
    }

    const balanceType = BALANCE_TYPE_MAP[accountType.toLowerCase()];
    if (!balanceType) {
      return NextResponse.json({ error: 'Invalid accountType. Must be asset, liability, equity, revenue, or expense' }, { status: 400 });
    }

    const existing = await prisma.chart_of_accounts.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: `Account code "${code}" already exists` }, { status: 409 });
    }

    const account = await prisma.chart_of_accounts.create({
      data: {
        id: randomUUID(),
        code,
        name,
        account_type: accountType.toLowerCase(),
        balance_type: balanceType,
        entity_type: entityType || null,
        userId: user.id,
      }
    });

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: account.account_type,
        balanceType: account.balance_type,
        entity_type: account.entity_type,
        settledBalance: 0,
        pendingBalance: 0,
        version: 0,
        is_archived: false,
      }
    });
  } catch (error) {
    console.error('COA create error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

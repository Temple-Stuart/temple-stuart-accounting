import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    const reconciliations = await prisma.bank_reconciliations.findMany({
      where: { 
        userId: user.id,
        ...(accountId ? { accountId } : {})
      },
      include: { 
        items: true,
        account: true
      },
      orderBy: { periodEnd: 'desc' }
    });

    return NextResponse.json({ reconciliations });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch reconciliations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { accountId, periodEnd, statementBalance, bookBalance, items, status } = body;

    // Calculate adjusted balances
    const depositsInTransit = items
      ?.filter((i: any) => i.type === 'deposit_in_transit' && !i.cleared)
      .reduce((sum: number, i: any) => sum + parseFloat(i.amount), 0) || 0;
    
    const outstandingChecks = items
      ?.filter((i: any) => i.type === 'outstanding_check' && !i.cleared)
      .reduce((sum: number, i: any) => sum + parseFloat(i.amount), 0) || 0;

    const adjustedBankBalance = parseFloat(statementBalance) + depositsInTransit - outstandingChecks;
    const adjustedBookBalance = parseFloat(bookBalance);
    const difference = Math.abs(adjustedBankBalance - adjustedBookBalance);

    const reconciliation = await prisma.bank_reconciliations.upsert({
      where: {
        userId_accountId_periodEnd: {
          userId: user.id,
          accountId,
          periodEnd: new Date(periodEnd)
        }
      },
      update: {
        statementBalance: parseFloat(statementBalance),
        bookBalance: parseFloat(bookBalance),
        adjustedBankBalance,
        adjustedBookBalance,
        difference,
        status: status || 'draft',
        reconciledAt: status === 'reconciled' ? new Date() : null,
        items: {
          deleteMany: {},
          create: items?.map((i: any) => ({
            transactionId: i.transactionId || null,
            type: i.type,
            description: i.description,
            amount: parseFloat(i.amount),
            cleared: i.cleared || false
          })) || []
        }
      },
      create: {
        userId: user.id,
        accountId,
        periodEnd: new Date(periodEnd),
        statementBalance: parseFloat(statementBalance),
        bookBalance: parseFloat(bookBalance),
        adjustedBankBalance,
        adjustedBookBalance,
        difference,
        status: status || 'draft',
        reconciledAt: status === 'reconciled' ? new Date() : null,
        items: {
          create: items?.map((i: any) => ({
            transactionId: i.transactionId || null,
            type: i.type,
            description: i.description,
            amount: parseFloat(i.amount),
            cleared: i.cleared || false
          })) || []
        }
      },
      include: { items: true, account: true }
    });

    return NextResponse.json({ reconciliation });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to save reconciliation' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/transactions/manual
 *
 * Creates a manual transaction + manual account (if needed) + journal entry.
 * Available to ALL tiers (including free).
 *
 * Body: { date, description, amount, category, accountName, accountType }
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date, description, amount, category, accountName, accountType } = await request.json();

    if (!date || !description || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'date, description, and amount are required' },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Find or create manual account for this user
    const acctName = accountName || 'Manual Cash';
    const acctType = accountType || 'depository';

    let account = await prisma.accounts.findFirst({
      where: {
        userId: user.id,
        name: acctName,
        source: 'manual',
      }
    });

    if (!account) {
      const accountId = uuidv4();
      account = await prisma.accounts.create({
        data: {
          id: accountId,
          accountId: `manual_${accountId}`,
          name: acctName,
          type: acctType,
          source: 'manual',
          userId: user.id,
          updatedAt: new Date(),
        }
      });
    }

    // Create the transaction
    const txnId = uuidv4();
    const transaction = await prisma.transactions.create({
      data: {
        id: txnId,
        transactionId: `manual_${txnId}`,
        accountId: account.id,
        amount: parsedAmount,
        date: new Date(date),
        name: description,
        merchantName: description,
        category: category || null,
        pending: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        date: transaction.date,
        name: transaction.name,
        amount: transaction.amount,
        accountName: account.name,
      }
    });
  } catch (error) {
    console.error('[MANUAL TXN] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transactions/manual
 * Returns only manual transactions for the current user.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactions = await prisma.transactions.findMany({
      where: {
        accounts: {
          userId: user.id,
          source: 'manual',
        }
      },
      include: {
        accounts: {
          select: { name: true, type: true }
        }
      },
      orderBy: { date: 'desc' },
    });

    const mapped = transactions.map(t => ({
      id: t.id,
      date: t.date,
      name: t.name,
      merchantName: t.merchantName,
      amount: t.amount,
      category: t.category,
      accountName: t.accounts?.name,
      accountType: t.accounts?.type,
      pending: t.pending,
    }));

    return NextResponse.json({ transactions: mapped });
  } catch (error) {
    console.error('[MANUAL TXN GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/transactions/manual
 *
 * Creates a manual transaction and, when the named account does not exist yet, the manual account
 * it sits in. It posts NOTHING: the row waits in the review queue like a bank row and posts through
 * commit-to-ledger (the one Plaid-shaped posting path, journal-entry-service.ts commitPlaidTransaction).
 * Available to ALL tiers (including free).
 *
 * Body: { date, description, amount, currency, category, accountName, accountType }
 *
 * FX-01 (Alex, 2026-10-30, ruling G): A MANUAL ACCOUNT STATES ITS CURRENCY. `currency` is required —
 * a three-letter ISO 4217 code in capitals — and is refused by name when absent or malformed. A NEW
 * manual account is created with isoCurrencyCode = currency. An EXISTING manual account of that name
 * whose isoCurrencyCode differs from the body's is refused (409 by name); one whose isoCurrencyCode is
 * NULL (born before FX-01) is refused by name until it is set (Alex sets his by psql). Nothing here
 * backfills an existing account, and no currency is ever assumed. (The words are module-level, not exported:
 * a Next.js route file exports only its handlers.)
 */
const ISO_4217 = /^[A-Z]{3}$/;
const CURRENCY_REQUIRED_WORDS = 'currency is required — a three-letter ISO 4217 code in capitals (USD, PHP, …)';
const accountStatesNoCurrencyWords = (name: string): string => `account "${name}" states no currency — set it first`;
const accountCurrencyDiffersWords = (name: string, stated: string, sent: string): string =>
  `account "${name}" is stated in ${stated}; this transaction says ${sent}`;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date, description, amount, currency, category, accountName, accountType } = await request.json();

    if (!date || !description || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'date, description, and amount are required' },
        { status: 400 }
      );
    }
    // FX-01 (ruling G): the currency, stated by the customer, in ISO 4217 capitals — nothing assumed.
    if (typeof currency !== 'string' || !ISO_4217.test(currency)) {
      return NextResponse.json({ error: CURRENCY_REQUIRED_WORDS }, { status: 400 });
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

    // FX-01 (ruling G): an existing manual account must state the same currency; a NULL one is refused by name.
    if (account) {
      const stated = account.isoCurrencyCode;
      if (stated === null) return NextResponse.json({ error: accountStatesNoCurrencyWords(account.name) }, { status: 409 });
      if (stated !== currency) return NextResponse.json({ error: accountCurrencyDiffersWords(account.name, stated, currency) }, { status: 409 });
    }

    if (!account) {
      const accountId = uuidv4();
      account = await prisma.accounts.create({
        data: {
          id: accountId,
          accountId: `manual_${accountId}`,
          name: acctName,
          type: acctType,
          source: 'manual',
          // FX-01 (ruling G): born with the currency the customer stated — never NULL, never a default.
          isoCurrencyCode: currency,
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

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');
    const accountId = searchParams.get('accountId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    const where: any = { userId: user.id };
    if (entityId) where.entity_id = entityId;
    if (accountId) where.account_id = accountId;
    if (year) where.year = parseInt(year, 10);
    if (month) where.month = parseInt(month, 10);

    const records = await prisma.bank_reconciliations.findMany({
      where,
      include: {
        account: {
          include: {
            plaid_items: { select: { institutionName: true } },
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    // Shape to match BankReconciliation.tsx Reconciliation interface
    const reconciliations = records.map((r: any) => ({
      id: r.id,
      accountId: r.account_id,
      periodEnd: new Date(r.year, r.month - 1, 1).toISOString(), // first of month as period marker
      statementBalance: Number(r.statement_balance),
      bookBalance: Number(r.book_balance),
      adjustedBankBalance: Number(r.adjusted_bank),
      adjustedBookBalance: Number(r.adjusted_book),
      difference: Number(r.difference),
      status: r.status,
      items: (r.items as any[]) || [],
      year: r.year,
      month: r.month,
      account: {
        id: r.account.id,
        name: r.account.name,
        mask: r.account.mask,
        type: r.account.type,
        balance: r.account.currentBalance || 0,
        institutionName: r.account.plaid_items?.institutionName || 'Unknown',
      },
    }));

    return NextResponse.json({ reconciliations });
  } catch (error) {
    console.error('Bank reconciliations GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { accountId, periodEnd, statementBalance, bookBalance, items, status } = await request.json();

    if (!accountId || !periodEnd || statementBalance === undefined) {
      return NextResponse.json(
        { error: 'accountId, periodEnd, and statementBalance are required' },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await prisma.accounts.findFirst({
      where: { id: accountId, userId: user.id },
    });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Resolve entity_id: prefer account's entity_id, fallback to user's default entity
    let entityId = account.entity_id;
    if (!entityId) {
      const defaultEntity = await prisma.entities.findFirst({
        where: { userId: user.id, is_default: true },
      });
      entityId = defaultEntity?.id || null;
    }
    if (!entityId) {
      return NextResponse.json(
        { error: 'No entity assigned to this account. Assign an entity first.' },
        { status: 400 }
      );
    }

    // Parse period from periodEnd date
    const periodDate = new Date(periodEnd);
    const year = periodDate.getFullYear();
    const month = periodDate.getMonth() + 1;

    // Compute adjusted balances from reconciling items
    const reconItems = items || [];
    const depositsInTransit = reconItems
      .filter((i: any) => i.type === 'deposit_in_transit' && !i.cleared)
      .reduce((sum: number, i: any) => sum + (parseFloat(i.amount) || 0), 0);
    const outstandingChecks = reconItems
      .filter((i: any) => i.type === 'outstanding_check' && !i.cleared)
      .reduce((sum: number, i: any) => sum + (parseFloat(i.amount) || 0), 0);
    const bankFees = reconItems
      .filter((i: any) => i.type === 'bank_fee')
      .reduce((sum: number, i: any) => sum + (parseFloat(i.amount) || 0), 0);
    const interest = reconItems
      .filter((i: any) => i.type === 'interest')
      .reduce((sum: number, i: any) => sum + (parseFloat(i.amount) || 0), 0);

    const stmtBal = parseFloat(statementBalance);
    const bookBal = parseFloat(bookBalance) || 0;
    const adjustedBank = stmtBal + depositsInTransit - outstandingChecks;
    const adjustedBook = bookBal - bankFees + interest;
    const difference = Math.abs(adjustedBank - adjustedBook);

    // Compute book balance from ledger entries (authoritative, not denormalized)
    let computedBookBalance = bookBal;
    if (account.accountCode) {
      const coaAccount = await prisma.chart_of_accounts.findFirst({
        where: { userId: user.id, entity_id: entityId, code: account.accountCode },
        select: { id: true, balance_type: true },
      });

      if (coaAccount) {
        // End of period = last day of the month
        const endOfMonth = new Date(year, month, 0); // day 0 of next month = last day of this month
        const asOfDate = endOfMonth.toISOString().split('T')[0];

        const result: any[] = await prisma.$queryRaw`
          SELECT
            COALESCE(SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END), 0)::text AS total_debits,
            COALESCE(SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END), 0)::text AS total_credits
          FROM ledger_entries le
          JOIN journal_entries je ON le.journal_entry_id = je.id
          WHERE le.account_id = ${coaAccount.id}
            AND je."userId" = ${user.id}
            AND je.is_reversal = false
            AND je.reversed_by_entry_id IS NULL
            AND je.date <= ${asOfDate}::date
        `;

        if (result.length > 0) {
          const totalDebits = Number(result[0].total_debits);
          const totalCredits = Number(result[0].total_credits);
          // Normal balance: D accounts = debits - credits, C accounts = credits - debits
          computedBookBalance = coaAccount.balance_type === 'D'
            ? (totalDebits - totalCredits) / 100 // cents to dollars
            : (totalCredits - totalDebits) / 100;
        }
      }
    }

    // Upsert: create or update for this account+period
    const record = await prisma.bank_reconciliations.upsert({
      where: {
        userId_entity_id_account_id_year_month: {
          userId: user.id,
          entity_id: entityId,
          account_id: accountId,
          year,
          month,
        },
      },
      create: {
        userId: user.id,
        entity_id: entityId,
        account_id: accountId,
        year,
        month,
        statement_balance: stmtBal,
        book_balance: computedBookBalance,
        adjusted_bank: adjustedBank,
        adjusted_book: adjustedBook - bookBal + computedBookBalance, // recalc with computed book
        difference,
        status: status || 'draft',
        reconciled_at: status === 'reconciled' ? new Date() : null,
        reconciled_by: status === 'reconciled' ? userEmail : null,
        items: reconItems,
      },
      update: {
        statement_balance: stmtBal,
        book_balance: computedBookBalance,
        adjusted_bank: adjustedBank,
        adjusted_book: adjustedBook - bookBal + computedBookBalance,
        difference,
        status: status || 'draft',
        reconciled_at: status === 'reconciled' ? new Date() : undefined,
        reconciled_by: status === 'reconciled' ? userEmail : undefined,
        items: reconItems,
      },
    });

    return NextResponse.json({
      success: true,
      reconciliation: {
        id: record.id,
        accountId: record.account_id,
        year: record.year,
        month: record.month,
        statementBalance: Number(record.statement_balance),
        bookBalance: Number(record.book_balance),
        difference: Number(record.difference),
        status: record.status,
      },
    });
  } catch (error) {
    console.error('Bank reconciliations POST error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

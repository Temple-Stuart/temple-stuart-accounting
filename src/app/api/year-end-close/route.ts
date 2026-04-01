import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

const ENTITY_PREFIX: Record<string, string> = {
  personal: 'P-', sole_prop: 'B-', business: 'B-', trading: 'T-',
};

// GAAP Year-End Close API
//
// Creates closing journal entries that zero out revenue and expense accounts
// and transfer net income to Retained Earnings (3900).
//
// PATHWAY 8: Year-end close bypasses period close enforcement.
// Closing entries are the privileged reason periods are closed.
// Audit trail: source_type = 'year_end_close', created_by = userEmail
//
// Idempotency: source_type = 'year_end_close', source_id = year (string)
// All amounts in BigInt cents per SOC2 BAL control.

interface RevExpRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  balance_type: string;
  total_debits: bigint;
  total_credits: bigint;
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

    const { entityId, year } = await request.json();

    if (!entityId || !year) {
      return NextResponse.json({ error: 'Missing required fields: entityId, year' }, { status: 400 });
    }

    // 1. Validate entity belongs to user
    const entity = await prisma.entities.findFirst({
      where: { id: entityId, userId: user.id },
    });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found or does not belong to user' }, { status: 404 });
    }

    // 2. Check all 12 months are period-closed for this entity+year
    const closedPeriods = await prisma.$queryRaw<{ month: number }[]>`
      SELECT month FROM closing_periods
      WHERE "userId" = ${user.id}
        AND entity_id = ${entityId}
        AND year = ${year}
        AND status = 'closed'
    `;
    const closedMonths = new Set(closedPeriods.map((p: { month: number }) => p.month));
    const openMonths: number[] = [];
    for (let m = 1; m <= 12; m++) {
      if (!closedMonths.has(m)) openMonths.push(m);
    }
    if (openMonths.length > 0) {
      return NextResponse.json({
        error: `Cannot close year. Open months: [${openMonths.join(', ')}]`,
        openMonths,
      }, { status: 400 });
    }

    // 3. Idempotency check — has this year already been closed?
    const existingClose = await prisma.journal_entries.findFirst({
      where: {
        userId: user.id,
        entity_id: entityId,
        source_type: 'year_end_close',
        source_id: String(year),
        is_reversal: false,
        reversed_by_entry_id: null,
      },
    });
    if (existingClose) {
      return NextResponse.json({
        error: `Year-end close already completed for ${year}`,
        closingEntryId: existingClose.id,
      }, { status: 409 });
    }

    // 4. Compute revenue and expense balances for the year
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const rows: RevExpRow[] = await prisma.$queryRaw`
      SELECT
        coa.id AS account_id,
        coa.code AS account_code,
        coa.name AS account_name,
        coa.account_type,
        coa.balance_type,
        COALESCE(SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END), 0) AS total_debits,
        COALESCE(SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END), 0) AS total_credits
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${user.id}
        AND je.entity_id = ${entityId}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND coa.account_type IN ('revenue', 'expense')
        AND je.date >= ${yearStart}::date
        AND je.date <= ${yearEnd}::date
      GROUP BY coa.id, coa.code, coa.name, coa.account_type, coa.balance_type
      HAVING SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END) != 0
          OR SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END) != 0
      ORDER BY coa.code
    `;

    // 5. Compute net income
    let totalRevenue = BigInt(0);
    let totalExpenses = BigInt(0);

    for (const row of rows) {
      const debits = BigInt(row.total_debits);
      const credits = BigInt(row.total_credits);

      if (row.account_type === 'revenue') {
        // Revenue is credit-normal: balance = credits - debits
        totalRevenue += credits - debits;
      } else {
        // Expense is debit-normal: balance = debits - credits
        totalExpenses += debits - credits;
      }
    }

    const netIncome = totalRevenue - totalExpenses;

    // 6. Find or create Retained Earnings account (3900)
    const rePrefix = ENTITY_PREFIX[entity.entity_type] || 'P-';
    const reCode = `${rePrefix}3900`;
    let retainedEarnings = await prisma.chart_of_accounts.findFirst({
      where: {
        userId: user.id,
        entity_id: entityId,
        code: reCode,
        account_type: 'equity',
      },
    });
    if (!retainedEarnings) {
      retainedEarnings = await prisma.chart_of_accounts.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          entity_id: entityId,
          code: reCode,
          name: 'Retained Earnings',
          account_type: 'equity',
          balance_type: 'C',
          created_by: userEmail,
        },
      });
    }

    // 7. Create closing journal entry in a transaction
    // PATHWAY 8: Year-end close bypasses period close enforcement.
    // Closing entries are the privileged reason periods are closed.
    // Audit trail: source_type = 'year_end_close', created_by = userEmail
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const journalEntry = await tx.journal_entries.create({
        data: {
          userId: user.id,
          entity_id: entityId,
          date: new Date(year, 11, 31), // Dec 31
          description: `Year-end closing entry for ${year}`,
          source_type: 'year_end_close',
          source_id: String(year),
          status: 'posted',
          is_reversal: false,
          created_by: userEmail,
        },
      });

      let totalLedgerDebits = BigInt(0);
      let totalLedgerCredits = BigInt(0);
      let accountsClosed = 0;

      // Close each revenue and expense account
      for (const row of rows) {
        const debits = BigInt(row.total_debits);
        const credits = BigInt(row.total_credits);

        if (row.account_type === 'revenue') {
          // Revenue is credit-normal: balance = credits - debits
          const balance = credits - debits;
          if (balance === BigInt(0)) continue;

          // Debit revenue account to zero it out
          const absBalance = balance > BigInt(0) ? balance : -balance;
          const entryType = balance > BigInt(0) ? 'D' : 'C';

          await tx.ledger_entries.create({
            data: {
              journal_entry_id: journalEntry.id,
              account_id: row.account_id,
              entry_type: entryType,
              amount: absBalance,
              created_by: userEmail,
            },
          });

          if (entryType === 'D') {
            totalLedgerDebits += absBalance;
          } else {
            totalLedgerCredits += absBalance;
          }

          // Update account settled_balance
          // Debiting a credit-normal account decreases its balance
          const balanceChange = entryType === 'C' ? absBalance : -absBalance;
          await tx.chart_of_accounts.update({
            where: { id: row.account_id },
            data: {
              settled_balance: { increment: balanceChange },
              version: { increment: 1 },
            },
          });
        } else {
          // Expense is debit-normal: balance = debits - credits
          const balance = debits - credits;
          if (balance === BigInt(0)) continue;

          // Credit expense account to zero it out
          const absBalance = balance > BigInt(0) ? balance : -balance;
          const entryType = balance > BigInt(0) ? 'C' : 'D';

          await tx.ledger_entries.create({
            data: {
              journal_entry_id: journalEntry.id,
              account_id: row.account_id,
              entry_type: entryType,
              amount: absBalance,
              created_by: userEmail,
            },
          });

          if (entryType === 'D') {
            totalLedgerDebits += absBalance;
          } else {
            totalLedgerCredits += absBalance;
          }

          // Update account settled_balance
          // Crediting a debit-normal account decreases its balance
          const balanceChange = entryType === 'D' ? absBalance : -absBalance;
          await tx.chart_of_accounts.update({
            where: { id: row.account_id },
            data: {
              settled_balance: { increment: balanceChange },
              version: { increment: 1 },
            },
          });
        }

        accountsClosed++;
      }

      // Retained Earnings line
      if (netIncome !== BigInt(0)) {
        const absNetIncome = netIncome > BigInt(0) ? netIncome : -netIncome;
        // Profit: CREDIT RE; Loss: DEBIT RE
        const reEntryType = netIncome > BigInt(0) ? 'C' : 'D';

        await tx.ledger_entries.create({
          data: {
            journal_entry_id: journalEntry.id,
            account_id: retainedEarnings!.id,
            entry_type: reEntryType,
            amount: absNetIncome,
            created_by: userEmail,
          },
        });

        if (reEntryType === 'D') {
          totalLedgerDebits += absNetIncome;
        } else {
          totalLedgerCredits += absNetIncome;
        }

        // Update RE settled_balance
        // RE is credit-normal (balance_type 'C')
        const reBalanceChange = reEntryType === 'C' ? absNetIncome : -absNetIncome;
        await tx.chart_of_accounts.update({
          where: { id: retainedEarnings!.id },
          data: {
            settled_balance: { increment: reBalanceChange },
            version: { increment: 1 },
          },
        });
      }

      // CRITICAL: Balance verification (SOC2 BAL control)
      if (totalLedgerDebits !== totalLedgerCredits) {
        throw new Error(
          `Year-end closing entry is unbalanced: debits=${totalLedgerDebits.toString()}, credits=${totalLedgerCredits.toString()}. Rolling back.`
        );
      }

      return { journalEntry, accountsClosed };
    });

    return NextResponse.json({
      closingEntryId: result.journalEntry.id,
      netIncome: Number(netIncome),
      accountsClosed: result.accountsClosed,
      year,
      entityName: entity.name,
    });
  } catch (error) {
    console.error('Year-end close error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const year = searchParams.get('year');

    if (!entityId || !year) {
      return NextResponse.json({ error: 'Missing required params: entityId, year' }, { status: 400 });
    }

    // Validate entity belongs to user
    const entity = await prisma.entities.findFirst({
      where: { id: entityId, userId: user.id },
    });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found or does not belong to user' }, { status: 404 });
    }

    // Check if a closing entry exists
    const closingEntry = await prisma.journal_entries.findFirst({
      where: {
        userId: user.id,
        entity_id: entityId,
        source_type: 'year_end_close',
        source_id: year,
        is_reversal: false,
        reversed_by_entry_id: null,
      },
      select: {
        id: true,
        created_at: true,
      },
    });

    if (closingEntry) {
      // Compute net income from the ledger entries of this closing entry
      const ledgerEntries = await prisma.ledger_entries.findMany({
        where: { journal_entry_id: closingEntry.id },
        include: { account: true },
      });

      // Net income = sum of credits to RE minus debits to RE
      let netIncome = BigInt(0);
      for (const le of ledgerEntries) {
        const gePrefix = ENTITY_PREFIX[entity.entity_type] || 'P-';
        if (le.account.code === `${gePrefix}3900` && le.account.account_type === 'equity') {
          if (le.entry_type === 'C') {
            netIncome += le.amount;
          } else {
            netIncome -= le.amount;
          }
        }
      }

      return NextResponse.json({
        isClosed: true,
        closingEntryId: closingEntry.id,
        netIncome: Number(netIncome),
        closedAt: closingEntry.created_at.toISOString(),
      });
    }

    return NextResponse.json({
      isClosed: false,
      closingEntryId: null,
      netIncome: null,
      closedAt: null,
    });
  } catch (error) {
    console.error('Year-end close status error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

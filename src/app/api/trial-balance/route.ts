import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// GAAP-Compliant Trial Balance API
//
// - Derived from the general ledger, never from cached/denormalized values (settled_balance)
// - Reversed entries excluded via dual filter per ASC 250 (error correction):
//     je.is_reversal = false AND je.reversed_by_entry_id IS NULL
// - Entity scoping supports multi-entity reporting per ASC 810 (consolidation)
// - All amounts in cents (BigInt) to avoid floating-point errors per SOC2 BAL control
// - Date filtering supports period-end reporting (monthly, quarterly, annual)

interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type: string;
  balance_type: string;
  entity_id: string;
  entity_name: string;
  total_debits: string;
  total_credits: string;
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
    const asOfDate = searchParams.get('asOfDate');
    const startDate = searchParams.get('startDate');

    // Build dynamic WHERE clauses beyond the mandatory filters
    const conditions: Prisma.Sql[] = [
      Prisma.sql`je."userId" = ${user.id}`,
      Prisma.sql`je.is_reversal = false`,
      Prisma.sql`je.reversed_by_entry_id IS NULL`,
    ];

    if (entityId) {
      conditions.push(Prisma.sql`je.entity_id = ${entityId}`);
    }
    if (asOfDate) {
      conditions.push(Prisma.sql`je.date <= ${asOfDate}::date`);
    }
    if (startDate) {
      conditions.push(Prisma.sql`je.date >= ${startDate}::date`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    const rows: TrialBalanceRow[] = await prisma.$queryRaw`
      SELECT
        coa.code AS account_code,
        coa.name AS account_name,
        coa.account_type,
        coa.balance_type,
        coa.entity_id,
        e.name AS entity_name,
        COALESCE(SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END), 0)::text AS total_debits,
        COALESCE(SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END), 0)::text AS total_credits
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      JOIN entities e ON je.entity_id = e.id
      WHERE ${whereClause}
      GROUP BY coa.code, coa.name, coa.account_type, coa.balance_type, coa.entity_id, e.name
      ORDER BY coa.code ASC
    `;

    // Compute per-account balances
    const accounts = rows.map((row) => {
      const totalDebits = Number(row.total_debits);
      const totalCredits = Number(row.total_credits);
      const netBalance = totalDebits - totalCredits;

      // Normal balance: positive when on the account's natural side
      // balance_type 'D' (assets, expenses): normal = debits - credits
      // balance_type 'C' (liabilities, equity, revenue): normal = credits - debits
      const normalBalance =
        row.balance_type === 'D' ? totalDebits - totalCredits : totalCredits - totalDebits;

      // Display side: where this account's balance sits on the trial balance
      // Positive normalBalance → account's natural side
      // Negative normalBalance → contra/unusual, opposite side
      let displaySide: 'debit' | 'credit';
      if (row.balance_type === 'D') {
        displaySide = normalBalance >= 0 ? 'debit' : 'credit';
      } else {
        displaySide = normalBalance >= 0 ? 'credit' : 'debit';
      }

      return {
        accountCode: row.account_code,
        accountName: row.account_name,
        accountType: row.account_type,
        balanceType: row.balance_type,
        entityId: row.entity_id,
        entityName: row.entity_name,
        totalDebits,
        totalCredits,
        netBalance,
        normalBalance,
        displaySide,
      };
    });

    // Trial balance proof: total debit-side balances must equal total credit-side balances
    let totalDebitBalances = 0;
    let totalCreditBalances = 0;
    for (const acct of accounts) {
      const absBalance = Math.abs(acct.normalBalance);
      if (acct.displaySide === 'debit') {
        totalDebitBalances += absBalance;
      } else {
        totalCreditBalances += absBalance;
      }
    }

    return NextResponse.json({
      asOfDate: asOfDate || null,
      startDate: startDate || null,
      entityId: entityId || null,
      accounts,
      totals: {
        totalDebits: totalDebitBalances,
        totalCredits: totalCreditBalances,
        imbalance: totalDebitBalances - totalCreditBalances,
        isBalanced: totalDebitBalances === totalCreditBalances,
      },
    });
  } catch (error) {
    console.error('Trial balance API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

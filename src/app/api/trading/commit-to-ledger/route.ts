import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { assertPeriodOpen, PeriodClosedError } from '@/lib/period-close-guard';
import { requireTabAccess } from '@/lib/auth-helpers';

function dollarsToCents(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

function updateBalance(entryType: string, accountBalanceType: string, amountCents: bigint): bigint {
  return entryType === accountBalanceType ? amountCents : -amountCents;
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
    // TAB-SERVER-GATE: tab:trade entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:trade');
    if (tabGate) return tabGate;

    const { tradeNums } = await request.json();
    if (!tradeNums || !Array.isArray(tradeNums) || tradeNums.length === 0) {
      return NextResponse.json({ error: 'tradeNums array required' }, { status: 400 });
    }

    // Resolve Trading entity
    const tradingEntity = await prisma.entities.findFirst({
      where: { userId: user.id, entity_type: 'trading' },
    });
    if (!tradingEntity) {
      return NextResponse.json({ error: 'No Trading entity found for user' }, { status: 400 });
    }
    const entityId = tradingEntity.id;

    // Look up COA accounts: 1010 (Trading Cash), 4100 (Trading Gains), 5100 (Trading Losses)
    const [cashAccount, gainsAccount, lossesAccount] = await Promise.all([
      prisma.chart_of_accounts.findUnique({
        where: { userId_entity_id_code: { userId: user.id, entity_id: entityId, code: '1010' } },
      }),
      prisma.chart_of_accounts.findUnique({
        where: { userId_entity_id_code: { userId: user.id, entity_id: entityId, code: '4100' } },
      }),
      prisma.chart_of_accounts.findUnique({
        where: { userId_entity_id_code: { userId: user.id, entity_id: entityId, code: '5100' } },
      }),
    ]);

    if (!cashAccount || !gainsAccount || !lossesAccount) {
      const missing = [];
      if (!cashAccount) missing.push('1010');
      if (!gainsAccount) missing.push('4100');
      if (!lossesAccount) missing.push('5100');
      return NextResponse.json(
        { error: `Missing Trading COA accounts: ${missing.join(', ')}. Initialize bookkeeping first.` },
        { status: 400 }
      );
    }

    let committed = 0;
    let skipped = 0;
    const errors: string[] = [];
    // KILL-1: trades skipped because a CLOSED leg has no close_date — declared,
    // never committed on a substitute date.
    const skippedMissingCloseDate: { trade_num: number; symbol: string }[] = [];

    for (const tradeNum of tradeNums) {
      try {
        // Idempotency: check if already committed
        const existing = await prisma.journal_entries.findFirst({
          where: { userId: user.id, source_type: 'trading_position', source_id: tradeNum },
        });
        if (existing) {
          skipped++;
          continue;
        }

        // Fetch all closed positions for this trade
        // Security: verify ownership through investment_transactions → accounts → userId
        const positions = await prisma.trading_positions.findMany({
          where: { trade_num: tradeNum, status: 'CLOSED' },
        });

        if (positions.length === 0) {
          errors.push(`Trade #${tradeNum}: no closed positions found`);
          continue;
        }

        // SEC-2: EVERY leg must belong to the user. The prior guard passed when
        // AT LEAST ONE leg was owned (ownedTxns.length === 0), then netPL was
        // summed across ALL fetched legs (line below) — a trade_num collision
        // would post another user's realized_pl into this user's ledger. Require
        // the full distinct owned set, mirroring
        // investment-transactions/commit-to-ledger/route.ts:66-73.
        const txnIds = positions.map(p => p.open_investment_txn_id);
        const uniqueTxnIds = [...new Set(txnIds)];
        const ownedTxns = await prisma.investment_transactions.findMany({
          where: { id: { in: uniqueTxnIds }, accounts: { userId: user.id } },
          select: { id: true },
        });
        if (ownedTxns.length !== uniqueTxnIds.length) {
          errors.push(`Trade #${tradeNum}: one or more legs do not belong to this user — not committed`);
          continue;
        }

        // Sum realized P&L across all legs
        const netPL = positions.reduce((sum, p) => sum + (p.realized_pl ?? 0), 0);

        // Skip zero P&L trades
        if (Math.abs(netPL) < 0.005) {
          skipped++;
          continue;
        }

        // KILL-1: the journal entry date is the trade's REAL close date (latest
        // close_date across legs) — the same convention as every other ledger
        // writer (stock-lots/commit dates JEs with the real sale date). If any
        // CLOSED leg has no close_date, the trade's close date is unknowable:
        // SKIP and DECLARE. Never date a ledger entry with "now", the open
        // date, or any other substitute — a fabricated date also corrupts the
        // assertPeriodOpen check below.
        const legsMissingCloseDate = positions.filter(p => p.close_date == null);
        if (legsMissingCloseDate.length > 0) {
          skipped++;
          skippedMissingCloseDate.push({ trade_num: tradeNum, symbol: positions[0].symbol });
          errors.push(
            `Trade #${tradeNum} (${positions[0].symbol}): skipped — ${legsMissingCloseDate.length} CLOSED leg(s) missing close_date; not committed (no date is fabricated)`,
          );
          continue;
        }

        // Latest real close_date across legs (all non-null past the guard,
        // and positions.length > 0 is guaranteed above)
        const closeDate = positions
          .map(p => p.close_date as Date)
          .reduce((latest, d) => (d > latest ? d : latest));

        // Build description from first position
        const symbol = positions[0].symbol;
        const strategy = positions[0].strategy || 'unknown';
        const plLabel = netPL > 0 ? 'WIN' : 'LOSS';
        const description = `${symbol} ${strategy} - Trade #${tradeNum} - ${plLabel}`;

        const amountCents = dollarsToCents(Math.abs(netPL));
        const isWin = netPL > 0;

        // WIN: DR T-1010 (Cash), CR T-4100 (Gains)
        // LOSS: DR T-5100 (Losses), CR T-1010 (Cash)
        const debitAccount = isWin ? cashAccount : lossesAccount;
        const creditAccount = isWin ? gainsAccount : cashAccount;

        // Period close enforcement
        await assertPeriodOpen(prisma, user.id, entityId, closeDate);

        // Create JE + ledger entries + update balances in a single transaction
        await prisma.$transaction(async (tx) => {
          const journalEntry = await tx.journal_entries.create({
            data: {
              userId: user.id,
              entity_id: entityId,
              date: closeDate,
              description,
              source_type: 'trading_position',
              source_id: tradeNum,
              status: 'posted',
              created_by: userEmail,
            },
          });

          // Debit ledger entry
          await tx.ledger_entries.create({
            data: {
              journal_entry_id: journalEntry.id,
              account_id: debitAccount.id,
              entry_type: 'D',
              amount: amountCents,
              created_by: userEmail,
            },
          });

          // Credit ledger entry
          await tx.ledger_entries.create({
            data: {
              journal_entry_id: journalEntry.id,
              account_id: creditAccount.id,
              entry_type: 'C',
              amount: amountCents,
              created_by: userEmail,
            },
          });

          // Update settled_balance on debit account
          await tx.chart_of_accounts.update({
            where: { id: debitAccount.id },
            data: {
              settled_balance: { increment: updateBalance('D', debitAccount.balance_type, amountCents) },
              version: { increment: 1 },
            },
          });

          // Update settled_balance on credit account
          await tx.chart_of_accounts.update({
            where: { id: creditAccount.id },
            data: {
              settled_balance: { increment: updateBalance('C', creditAccount.balance_type, amountCents) },
              version: { increment: 1 },
            },
          });
        });

        committed++;
      } catch (err) {
        if (err instanceof PeriodClosedError) {
          errors.push(`Trade #${tradeNum}: ${err.message}`);
          continue;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        // Handle duplicate JE (unique constraint)
        if (message.includes('Unique constraint') || message.includes('unique constraint')) {
          skipped++;
          continue;
        }
        console.error(`Error committing trade #${tradeNum}:`, err);
        errors.push(`Trade #${tradeNum}: ${message}`);
      }
    }

    return NextResponse.json({ committed, skipped, skipped_missing_close_date: skippedMissingCloseDate, errors });
  } catch (error) {
    console.error('Trade commit API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

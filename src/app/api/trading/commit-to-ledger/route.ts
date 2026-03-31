import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { assertPeriodOpen, PeriodClosedError } from '@/lib/period-close-guard';

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

    // Look up COA accounts: T-1010 (Trading Cash), T-4100 (Trading Gains), T-5100 (Trading Losses)
    const [cashAccount, gainsAccount, lossesAccount] = await Promise.all([
      prisma.chart_of_accounts.findUnique({
        where: { userId_entity_id_code: { userId: user.id, entity_id: entityId, code: 'T-1010' } },
      }),
      prisma.chart_of_accounts.findUnique({
        where: { userId_entity_id_code: { userId: user.id, entity_id: entityId, code: 'T-4100' } },
      }),
      prisma.chart_of_accounts.findUnique({
        where: { userId_entity_id_code: { userId: user.id, entity_id: entityId, code: 'T-5100' } },
      }),
    ]);

    if (!cashAccount || !gainsAccount || !lossesAccount) {
      const missing = [];
      if (!cashAccount) missing.push('T-1010');
      if (!gainsAccount) missing.push('T-4100');
      if (!lossesAccount) missing.push('T-5100');
      return NextResponse.json(
        { error: `Missing Trading COA accounts: ${missing.join(', ')}. Initialize bookkeeping first.` },
        { status: 400 }
      );
    }

    let committed = 0;
    let skipped = 0;
    const errors: string[] = [];

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

        // Verify ownership: check that open_investment_txn_id belongs to user
        const txnIds = positions.map(p => p.open_investment_txn_id);
        const ownedTxns = await prisma.investment_transactions.findMany({
          where: { id: { in: txnIds }, accounts: { userId: user.id } },
          select: { id: true },
        });
        if (ownedTxns.length === 0) {
          errors.push(`Trade #${tradeNum}: positions do not belong to this user`);
          continue;
        }

        // Sum realized P&L across all legs
        const netPL = positions.reduce((sum, p) => sum + (p.realized_pl ?? 0), 0);

        // Skip zero P&L trades
        if (Math.abs(netPL) < 0.005) {
          skipped++;
          continue;
        }

        // Get close date (latest across legs)
        const closeDate = positions.reduce<Date | null>((latest, p) => {
          if (!p.close_date) return latest;
          if (!latest || p.close_date > latest) return p.close_date;
          return latest;
        }, null) || new Date();

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

    return NextResponse.json({ committed, skipped, errors });
  } catch (error) {
    console.error('Trade commit API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

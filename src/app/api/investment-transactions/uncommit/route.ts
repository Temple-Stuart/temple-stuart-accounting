import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { assertPeriodOpen, PeriodClosedError } from '@/lib/period-close-guard';
import { balanceDeltaOf, postJournal } from '@/lib/posting/postJournal';

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { transactionIds } = await request.json();

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'No transaction IDs provided' }, { status: 400 });
    }

    // SECURITY: Verify all transactions belong to this user
    const owned = await prisma.investment_transactions.findMany({
      where: { id: { in: transactionIds }, accounts: { userId: user.id } },
      select: { id: true }
    });

    if (owned.length !== transactionIds.length) {
      return NextResponse.json({ error: 'Some transactions do not belong to your account' }, { status: 403 });
    }

    const now = new Date();
    const batchId = randomUUID();
    const reversalIds: string[] = [];

    // HYG-04: every reversal posts through postJournal's `post`; each id is read back after commit.
    await postJournal(prisma, async (tx, post) => {
      // Clean up trading positions and stock lots (these are operational, not accounting records)
      const positions = await tx.trading_positions.findMany({
        where: {
          OR: [
            { open_investment_txn_id: { in: transactionIds } },
            { close_investment_txn_id: { in: transactionIds } }
          ]
        }
      });

      const stockLots = await tx.stock_lots.findMany({
        where: { investment_txn_id: { in: transactionIds } }
      });
      const stockLotIds = stockLots.map(l => l.id);

      if (stockLotIds.length > 0) {
        await tx.lot_dispositions.deleteMany({
          where: { lot_id: { in: stockLotIds } }
        });
        await tx.stock_lots.deleteMany({
          where: { id: { in: stockLotIds } }
        });
      }

      // Collect all related transaction IDs to find journal entries
      const allTxnIds = new Set<string>();
      for (const position of positions) {
        if (position.open_investment_txn_id) allTxnIds.add(position.open_investment_txn_id);
        if (position.close_investment_txn_id) allTxnIds.add(position.close_investment_txn_id);
      }
      for (const lot of stockLots) {
        allTxnIds.add(lot.investment_txn_id);
      }
      transactionIds.forEach((id: string) => allTxnIds.add(id));

      // Find original (non-reversed, non-reversal) journal entries
      const journals = await tx.journal_entries.findMany({
        where: {
          source_id: { in: Array.from(allTxnIds) },
          source_type: 'investment_txn',
          is_reversal: false,
          reversed_by_entry_id: null,
        },
        include: {
          ledger_entries: {
            include: { account: { select: { id: true, balance_type: true, code: true } } }
          }
        }
      });

      // Period close enforcement — reversals are dated today
      for (const original of journals) {
        await assertPeriodOpen(tx, user.id, original.entity_id, now);
      }

      // Create reversing entries for each original journal entry
      for (const original of journals) {
        // Create the reversing journal entry — the opposite line for every
        // original line, the balances moved back by the same rule.
        const reversalEntry = await post({
          entry: {
            userId: user.id,
            entity_id: original.entity_id,
            date: now,
            description: `REVERSAL: ${original.description}`,
            source_type: 'reversal',
            source_id: null,
            status: 'posted',
            is_reversal: true,
            reverses_entry_id: original.id,
            request_id: `${batchId}-${original.id}`,
            created_by: userEmail,
          },
          lines: original.ledger_entries.map((entry) => {
            const oppositeType: 'D' | 'C' = entry.entry_type === 'D' ? 'C' : 'D';
            return {
              account_id: entry.account_id,
              entry_type: oppositeType,
              amount: entry.amount,
              balanceDelta: balanceDeltaOf(oppositeType, entry.account.balance_type, entry.amount),
              created_by: userEmail,
            };
          }),
        });

        reversalIds.push(reversalEntry.id);

        // Mark original as reversed
        await tx.journal_entries.update({
          where: { id: original.id },
          data: {
            status: 'reversed',
            reversed_by_entry_id: reversalEntry.id,
          }
        });
      }

      // Clean up trading positions
      if (positions.length > 0) {
        await tx.trading_positions.deleteMany({
          where: { id: { in: positions.map(p => p.id) } }
        });
      }

      // Clear accounting fields on investment transactions
      await tx.investment_transactions.updateMany({
        where: { id: { in: transactionIds } },
        data: {
          accountCode: null,
          strategy: null,
          tradeNum: null
        }
      });
    });

    return NextResponse.json({
      success: true,
      uncommitted: transactionIds.length,
      reversalEntryIds: reversalIds,
      message: `Uncommitted ${transactionIds.length} transaction(s) with ${reversalIds.length} reversing journal entr${reversalIds.length === 1 ? 'y' : 'ies'} created`
    });
  } catch (error) {
    if (error instanceof PeriodClosedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return failClosedResponse('Uncommit', 'Failed to uncommit', error);
  }
}

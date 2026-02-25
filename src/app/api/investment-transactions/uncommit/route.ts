import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

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
    const reversalIds: string[] = [];

    await prisma.$transaction(async (tx) => {
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

      // Create reversing entries for each original journal entry
      for (const original of journals) {
        // Create the reversing journal entry
        const reversalEntry = await tx.journal_entries.create({
          data: {
            userId: user.id,
            entity_id: original.entity_id,
            date: now,
            description: `REVERSAL: ${original.description}`,
            source_type: 'reversal',
            source_id: null,
            status: 'posted',
            is_reversal: true,
            reverses_entry_id: original.id,
          }
        });

        reversalIds.push(reversalEntry.id);

        // Create reversing ledger entries (opposite debit/credit)
        for (const entry of original.ledger_entries) {
          const oppositeType = entry.entry_type === 'D' ? 'C' : 'D';

          await tx.ledger_entries.create({
            data: {
              journal_entry_id: reversalEntry.id,
              account_id: entry.account_id,
              amount: entry.amount,
              entry_type: oppositeType,
            }
          });

          // Update COA balance: opposite direction from original
          const balanceChange = oppositeType === entry.account.balance_type
            ? entry.amount
            : -entry.amount;

          await tx.chart_of_accounts.update({
            where: { id: entry.account.id },
            data: {
              settled_balance: { increment: balanceChange },
              version: { increment: 1 }
            }
          });
        }

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
    console.error('Uncommit error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to uncommit'
    }, { status: 500 });
  }
}

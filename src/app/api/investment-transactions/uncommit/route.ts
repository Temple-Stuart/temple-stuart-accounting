import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    await prisma.$transaction(async (tx) => {
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

      const allTxnIds = new Set<string>();
      for (const position of positions) {
        if (position.open_investment_txn_id) allTxnIds.add(position.open_investment_txn_id);
        if (position.close_investment_txn_id) allTxnIds.add(position.close_investment_txn_id);
      }
      for (const lot of stockLots) {
        allTxnIds.add(lot.investment_txn_id);
      }
      transactionIds.forEach(id => allTxnIds.add(id));

      const journals = await tx.journal_transactions.findMany({
        where: { external_transaction_id: { in: Array.from(allTxnIds) } },
        select: { id: true }
      });

      const journalIds = journals.map(j => j.id);

      if (journalIds.length > 0) {
        await tx.ledger_entries.deleteMany({
          where: { transaction_id: { in: journalIds } }
        });
        await tx.journal_transactions.deleteMany({
          where: { id: { in: journalIds } }
        });
      }

      if (positions.length > 0) {
        await tx.trading_positions.deleteMany({
          where: { id: { in: positions.map(p => p.id) } }
        });
      }

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
      message: `Uncommitted ${transactionIds.length} transactions`
    });
  } catch (error) {
    console.error('Uncommit error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to uncommit'
    }, { status: 500 });
  }
}

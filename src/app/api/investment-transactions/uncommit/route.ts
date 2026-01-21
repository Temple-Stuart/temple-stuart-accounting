import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { transactionIds } = await request.json();
    
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'No transaction IDs provided' }, { status: 400 });
    }
    
    await prisma.$transaction(async (tx) => {
      // Get all OPTIONS positions associated with these transactions
      const positions = await tx.trading_positions.findMany({
        where: {
          OR: [
            { open_investment_txn_id: { in: transactionIds } },
            { close_investment_txn_id: { in: transactionIds } }
          ]
        }
      });

      // Get all STOCK LOTS associated with these transactions
      const stockLots = await tx.stock_lots.findMany({
        where: { investment_txn_id: { in: transactionIds } }
      });
      const stockLotIds = stockLots.map(l => l.id);

      // Delete lot dispositions first (foreign key constraint)
      if (stockLotIds.length > 0) {
        await tx.lot_dispositions.deleteMany({
          where: { lot_id: { in: stockLotIds } }
        });
        
        // Delete stock lots
        await tx.stock_lots.deleteMany({
          where: { id: { in: stockLotIds } }
        });
      }
      
      // Collect all transaction IDs from positions AND stock lots
      const allTxnIds = new Set<string>();
      for (const position of positions) {
        if (position.open_investment_txn_id) allTxnIds.add(position.open_investment_txn_id);
        if (position.close_investment_txn_id) allTxnIds.add(position.close_investment_txn_id);
      }
      for (const lot of stockLots) {
        allTxnIds.add(lot.investment_txn_id);
      }
      // Also add the original transactionIds for direct journal lookup
      transactionIds.forEach(id => allTxnIds.add(id));
      
      // Get ALL journal IDs in one query
      const journals = await tx.journal_transactions.findMany({
        where: {
          external_transaction_id: { in: Array.from(allTxnIds) }
        },
        select: { id: true }
      });
      
      const journalIds = journals.map(j => j.id);
      
      // BATCH DELETE: All ledger entries at once
      if (journalIds.length > 0) {
        await tx.ledger_entries.deleteMany({
          where: { transaction_id: { in: journalIds } }
        });
        
        // BATCH DELETE: All journal transactions at once
        await tx.journal_transactions.deleteMany({
          where: { id: { in: journalIds } }
        });
      }
      
      // BATCH DELETE: All trading positions at once
      if (positions.length > 0) {
        await tx.trading_positions.deleteMany({
          where: { id: { in: positions.map(p => p.id) } }
        });
      }
      
      // BATCH UPDATE: All investment transactions at once
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

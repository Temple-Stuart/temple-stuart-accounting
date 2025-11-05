import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE() {
  try {
    console.log('Starting reset...');
    
    // STEP 1: Get trigger definition for later recreation
    const triggerDef = await prisma.$queryRaw`
      SELECT pg_get_triggerdef(oid) as definition
      FROM pg_trigger
      WHERE tgname LIKE '%ledger%' AND tgname NOT LIKE 'RI_%'
      LIMIT 1
    `;
    console.log('Trigger definition saved');
    
    // STEP 2: Drop the custom trigger (not system triggers)
    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS prevent_ledger_modification ON ledger_entries CASCADE;
    `);
    console.log('Trigger dropped');
    
    // STEP 3: Delete ledger entries
    const deletedLedgers = await prisma.$executeRawUnsafe(`
      DELETE FROM ledger_entries 
      WHERE transaction_id IN (
        SELECT id FROM journal_transactions WHERE trade_num IS NOT NULL
      )
    `);
    console.log(`Deleted ${deletedLedgers} ledger entries`);
    
    // STEP 4: Delete journal transactions
    const deletedJournals = await prisma.journal_transactions.deleteMany({
      where: { trade_num: { not: null } }
    });
    console.log(`Deleted ${deletedJournals.count} journal transactions`);
    
    // STEP 5: Delete trading positions
    const deletedPositions = await prisma.trading_positions.deleteMany({});
    console.log(`Deleted ${deletedPositions.count} trading positions`);
    
    // STEP 6: Reset investment_transactions
    const resetTxns = await prisma.investment_transactions.updateMany({
      where: {
        OR: [
          { accountCode: { not: null } },
          { strategy: { not: null } },
          { tradeNum: { not: null } }
        ]
      },
      data: {
        accountCode: null,
        strategy: null,
        tradeNum: null
      }
    });
    console.log(`Reset ${resetTxns.count} investment transactions`);
    
    // STEP 7: Recreate the trigger
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION prevent_ledger_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM journal_transactions WHERE id = OLD.transaction_id AND posted_at IS NOT NULL) THEN
          RAISE EXCEPTION 'Ledger entries cannot be modified or deleted after posting';
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE TRIGGER prevent_ledger_modification
      BEFORE UPDATE OR DELETE ON ledger_entries
      FOR EACH ROW
      EXECUTE FUNCTION prevent_ledger_modification();
    `);
    console.log('Trigger recreated');
    
    return NextResponse.json({ 
      success: true, 
      message: `Reset complete: ${deletedPositions.count} positions, ${deletedJournals.count} journals, ${deletedLedgers} ledger entries` 
    });
  } catch (error) {
    console.error('Reset error:', error);
    
    // SAFETY: Try to recreate trigger even if error
    try {
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION prevent_ledger_modification()
        RETURNS TRIGGER AS $$
        BEGIN
          IF EXISTS (SELECT 1 FROM journal_transactions WHERE id = OLD.transaction_id AND posted_at IS NOT NULL) THEN
            RAISE EXCEPTION 'Ledger entries cannot be modified or deleted after posting';
          END IF;
          RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
        
        CREATE TRIGGER prevent_ledger_modification
        BEFORE UPDATE OR DELETE ON ledger_entries
        FOR EACH ROW
        EXECUTE FUNCTION prevent_ledger_modification();
      `);
    } catch (e) {
      console.error('Failed to recreate trigger:', e);
    }
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to reset data' 
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { robinhoodParser } from '@/lib/robinhood-parser';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('🚀 Starting database save...\n');
    
    // Load RH history
    const historyPath = path.join(process.cwd(), 'robinhood_history.txt');
    const historyText = fs.readFileSync(historyPath, 'utf-8');
    
    robinhoodParser.resetCounter();
    const spreads = robinhoodParser.parseHistory(historyText);
    console.log(`✅ Parsed ${spreads.length} spreads\n`);
    
    // Load ALL buy/sell investment transactions
    const plaidTxns = await prisma.investment_transactions.findMany({
      where: {
        OR: [{ type: 'buy' }, { type: 'sell' }]
      },
      include: {
        security: true
      },
      orderBy: { date: 'asc' }
    });
    
    console.log(`✅ Loaded ${plaidTxns.length} Plaid transactions\n`);
    
    // Transform to parser format
    const plaidData = plaidTxns.map(txn => ({
      id: txn.investment_transaction_id,
      date: txn.date.toISOString(),
      name: txn.name || '',
      symbol: txn.security?.ticker_symbol || '',
      type: txn.type || '',
      price: txn.price || 0,
      quantity: txn.quantity || 0,
      amount: txn.amount || 0,
      security: {
        option_underlying_ticker: txn.security?.option_underlying_ticker || undefined,
        option_strike_price: txn.security?.option_strike_price || undefined,
        option_expiration_date: txn.security?.option_expiration_date?.toISOString() || undefined,
        option_contract_type: txn.security?.option_contract_type || undefined
      }
    }));
    
    // Run matching
    console.log('🔄 Running matcher...\n');
    const results = robinhoodParser.matchToPlaid(spreads, plaidData);
    
    console.log(`\n✅ Matching complete: ${results.length} mappings\n`);
    
    // Save to database
    console.log('💾 Saving to database...\n');
    
    let savedCount = 0;
    let errorCount = 0;
    
    for (const result of results) {
      try {
        await prisma.investment_transactions.update({
          where: {
            investment_transaction_id: result.txnId
          },
          data: {
            tradeNum: result.tradeNum,
            strategy: result.strategy,
            accountCode: result.coa,
            rhQuantity: result.rhQuantity,
            rhPrice: result.rhPrice,
            rhPrincipal: result.rhPrincipal,
            rhFees: result.rhFees,
            rhNetAmount: result.rhNetAmount,
            rhAction: result.rhAction,
            reconciliationStatus: 'matched',
            isReconciled: true,
            reconciledAt: new Date()
          }
        });
        
        savedCount++;
        
        if (savedCount % 50 === 0) {
          console.log(`   💾 Saved ${savedCount}/${results.length}...`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error saving ${result.txnId}:`, error);
        errorCount++;
      }
    }
    
    await prisma.$disconnect();
    
    console.log(`\n✅ SAVE COMPLETE!`);
    console.log(`   ✅ Saved: ${savedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    return NextResponse.json({
      success: true,
      saved: savedCount,
      errors: errorCount,
      total: results.length,
      message: `Successfully saved ${savedCount}/${results.length} mappings to database`
    });
    
  } catch (error) {
    console.error('❌ Save error:', error);
    await prisma.$disconnect();
    return NextResponse.json({
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

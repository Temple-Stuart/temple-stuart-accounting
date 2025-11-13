import { NextResponse } from 'next/server';
import { robinhoodParser } from '@/lib/robinhood-parser';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('🚀 Starting Phase 1 matching test...\n');
    
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
    
    // Transform to parser format - FIXED FIELD NAMES
    const plaidData = plaidTxns.map(txn => ({
      id: txn.investment_transaction_id,
      date: txn.date.toISOString(),
      name: txn.name || '',
      symbol: txn.security?.ticker_symbol || '',  // FIXED: was .symbol
      type: txn.type || '',
      price: txn.price || 0,
      quantity: txn.quantity || 0,
      amount: txn.amount || 0,
      security: {
        option_underlying_ticker: txn.security?.option_underlying_ticker || undefined,
        option_strike_price: txn.security?.option_strike_price || undefined,
        option_expiration_date: txn.security?.option_expiration_date?.toISOString() || undefined,
        option_contract_type: txn.security?.option_contract_type || undefined  // FIXED: was .option_type
      }
    }));
    
    // Run Phase 1 matching
    console.log('🔄 Running Phase 1 matcher...\n');
    const results = robinhoodParser.matchToPlaid(spreads, plaidData);
    
    const successRate = ((results.length / plaidData.length) * 100).toFixed(1);
    
    console.log(`\n✅ PHASE 1 COMPLETE: ${results.length}/${plaidData.length} mapped (${successRate}%)\n`);
    
    await prisma.$disconnect();
    
    return NextResponse.json({
      success: true,
      spreadsCount: spreads.length,
      openSpreads: spreads.filter(s => s.isOpen).length,
      closeSpreads: spreads.filter(s => !s.isOpen).length,
      plaidCount: plaidData.length,
      mappedCount: results.length,
      unmappedCount: plaidData.length - results.length,
      successRate: successRate + '%'
    });
    
  } catch (error) {
    console.error('❌ Matching error:', error);
    await prisma.$disconnect();
    return NextResponse.json({
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

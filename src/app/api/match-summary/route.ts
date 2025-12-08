import { NextResponse } from 'next/server';
import { robinhoodParser } from '@/lib/robinhood-parser';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const historyPath = path.join(process.cwd(), 'robinhood_history.txt');
    const historyText = fs.readFileSync(historyPath, 'utf-8');
    
    robinhoodParser.resetCounter();
    const spreads = robinhoodParser.parseHistory(historyText);
    
    const plaidTxns = await prisma.investment_transactions.findMany({
      where: { OR: [{ type: 'buy' }, { type: 'sell' }] },
      include: { security: true },
      orderBy: { date: 'asc' }
    });
    
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
    
    const results = robinhoodParser.matchToPlaid(spreads, plaidData);
    
    // Find which trades failed
    const openSpreads = spreads.filter(s => s.isOpen);
    const closeSpreads = spreads.filter(s => !s.isOpen);
    
    const failedOpens = openSpreads.filter((spread, idx) => {
      const tradeNum = (idx + 1).toString();
      const hasMatch = results.some(r => r.tradeNum === tradeNum && !r.isClosing);
      return !hasMatch;
    });
    
    const failedCloses = closeSpreads.filter(spread => {
      // Check if this close matched
      const matchingResults = results.filter(r => 
        r.isClosing && 
        r.matchedTo?.includes(spread.symbol)
      );
      return matchingResults.length === 0;
    });
    
    await prisma.$disconnect();
    
    return NextResponse.json({
      summary: {
        totalOpens: openSpreads.length,
        totalCloses: closeSpreads.length,
        mappedTransactions: results.length,
        failedOpens: failedOpens.length,
        failedCloses: failedCloses.length
      },
      failedOpens: failedOpens.map((s, idx) => ({
        tradeNum: openSpreads.indexOf(s) + 1,
        symbol: s.symbol,
        strategy: s.strategyName,
        date: s.legs[0]?.filledDate,
        limitPrice: s.limitPrice,
        legs: s.legs.length
      })),
      failedCloses: failedCloses.map(s => ({
        symbol: s.symbol,
        strategy: s.strategyName,
        date: s.legs[0]?.filledDate,
        limitPrice: s.limitPrice,
        legs: s.legs.length
      }))
    });
    
  } catch (error) {
    await prisma.$disconnect();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

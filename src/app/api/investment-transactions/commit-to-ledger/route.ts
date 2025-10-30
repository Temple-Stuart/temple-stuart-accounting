import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { investmentLedgerService } from '@/lib/investment-ledger-service';

export async function POST(request: Request) {
  try {
    const { transactionIds, strategy, tradeNum } = await request.json();

    if (!transactionIds || !strategy || !tradeNum) {
      return NextResponse.json(
        { error: 'transactionIds, strategy, and tradeNum required' },
        { status: 400 }
      );
    }

    // Fetch all investment transactions with security details
    const invTxns = await prisma.investment_transactions.findMany({
      where: { id: { in: transactionIds } },
      include: { security: true }
    });

    if (invTxns.length === 0) {
      return NextResponse.json({ error: 'No transactions found' }, { status: 404 });
    }

    // Transform to InvestmentLeg format
    const legs = invTxns.map(txn => {
      const name = txn.name.toLowerCase();
      const positionEffect = name.includes('to open') ? 'open' : 'close';
      const action = txn.type as 'buy' | 'sell';
      
      // Extract symbol from security or name
      const symbol = txn.security?.option_underlying_ticker || 
                     txn.name.split(' ').find(w => /^[A-Z]{1,5}$/.test(w)) || 
                     'UNKNOWN';
      
      return {
        id: txn.id,
        date: txn.date,
        symbol,
        strike: txn.security?.option_strike_price || null,
        expiry: txn.security?.option_expiration_date || null,
        contractType: txn.security?.option_contract_type as 'call' | 'put' | null,
        action,
        positionEffect: positionEffect as 'open' | 'close',
        quantity: txn.quantity || 1,
        price: txn.price || 0,
        fees: txn.rhFees || txn.fees || 0,
        amount: txn.amount || 0
      };
    });

    // Commit using IRS-compliant service
    const result = await investmentLedgerService.commitOptionsTrade({
      legs,
      strategy,
      tradeNum
    });

    return NextResponse.json({
      success: true,
      committed: legs.length,
      tradeNum,
      strategy,
      details: result
    });

  } catch (error: any) {
    console.error('Investment commit error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to commit investments' },
      { status: 500 }
    );
  }
}

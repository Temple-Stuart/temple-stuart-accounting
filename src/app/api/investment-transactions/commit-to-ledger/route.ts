import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { positionTrackerService } from '@/lib/position-tracker-service';
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

    const { transactionIds, strategy, tradeNum } = await request.json();

    if (!transactionIds || !strategy || !tradeNum) {
      return NextResponse.json(
        { error: 'transactionIds, strategy, and tradeNum required' },
        { status: 400 }
      );
    }

    // SECURITY: Only fetch transactions belonging to user's accounts
    const invTxns = await prisma.investment_transactions.findMany({
      where: {
        id: { in: transactionIds },
        accounts: { userId: user.id }
      },
      include: { security: true }
    });

    if (invTxns.length === 0) {
      return NextResponse.json({ error: 'No transactions found' }, { status: 404 });
    }

    // Verify all requested IDs belong to this user
    if (invTxns.length !== transactionIds.length) {
      return NextResponse.json(
        { error: 'Some transaction IDs do not belong to your account' },
        { status: 403 }
      );
    }

    const legs = invTxns.map(txn => {
      const name = txn.name.toLowerCase();
      const positionEffect = name.includes('to open') ? 'open' : 'close';
      const action = txn.type as 'buy' | 'sell';
      
      const symbol = txn.security?.option_underlying_ticker || 
                    txn.security?.ticker_symbol ||
                    txn.name.split(' ').find(w => /^[A-Z]{1,5}$/.test(w)) || 
                    'UNKNOWN';
      
      return {
        id: txn.id,
        date: txn.date,
        name: txn.name,
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

    const result = await prisma.$transaction(
      async (tx) => {
        return await positionTrackerService.commitOptionsTrade({
          legs,
          strategy,
          tradeNum,
          tx
        });
      },
      {
        maxWait: 30000,
        timeout: 120000,
      }
    );

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

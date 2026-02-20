import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { positionTrackerService } from '@/lib/position-tracker-service';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// GET: List open lots for a symbol (or all symbols)
export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const status = searchParams.get('status') || 'OPEN';

    const where: any = { user_id: user.id };
    if (symbol) where.symbol = symbol.toUpperCase();
    if (status !== 'ALL') where.status = status === 'OPEN' ? { in: ['OPEN', 'PARTIAL'] } : status;

    const lots = await prisma.stock_lots.findMany({
      where,
      include: { dispositions: true },
      orderBy: { acquired_date: 'asc' }
    });

    // Calculate summary stats
    const summary = {
      totalLots: lots.length,
      totalShares: lots.reduce((sum, l) => sum + l.remaining_quantity, 0),
      totalCostBasis: lots.reduce((sum, l) => sum + (l.remaining_quantity / l.original_quantity) * l.total_cost_basis, 0),
      bySymbol: {} as Record<string, { lots: number; shares: number; costBasis: number; avgCost: number }>
    };

    lots.forEach(lot => {
      if (!summary.bySymbol[lot.symbol]) {
        summary.bySymbol[lot.symbol] = { lots: 0, shares: 0, costBasis: 0, avgCost: 0 };
      }
      const s = summary.bySymbol[lot.symbol];
      s.lots++;
      s.shares += lot.remaining_quantity;
      const remainingCostBasis = (lot.remaining_quantity / lot.original_quantity) * lot.total_cost_basis;
      s.costBasis += remainingCostBasis;
      s.avgCost = s.shares > 0 ? s.costBasis / s.shares : 0;
    });

    return NextResponse.json({ lots, summary });
  } catch (error) {
    console.error('Stock lots fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch lots' }, { status: 500 });
  }
}

// POST: Create lots from investment transactions WITH journal entries
export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { transactionIds, strategy = 'stock-long', tradeNum } = await request.json();

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'No transaction IDs provided' }, { status: 400 });
    }

    // Get next trade number if not provided
    let actualTradeNum = tradeNum;
    if (!actualTradeNum) {
      const maxResult = await prisma.investment_transactions.findMany({
        where: { tradeNum: { not: null }, accounts: { userId: user.id } },
        select: { tradeNum: true }
      });
      const maxNum = maxResult.reduce((max, t) => {
        const num = parseInt(t.tradeNum || '0', 10);
        return num > max ? num : max;
      }, 0);
      actualTradeNum = String(maxNum + 1);
    }

    // Fetch the investment transactions
    const transactions = await prisma.investment_transactions.findMany({
      where: { id: { in: transactionIds }, accounts: { userId: user.id } },
      include: { security: true }
    });

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions found' }, { status: 404 });
    }

    if (transactions.length !== transactionIds.length) {
      return NextResponse.json({ error: 'Forbidden: not all transactions belong to user' }, { status: 403 });
    }


    // Validate: all must be BUY transactions for stocks (not options)
    // Use security metadata to detect options (same as opens API), not name string matching
    console.log('Stock lots validation - received txn count:', transactions.length);
    const invalidTxns = transactions.filter(t => {
      const name = (t.name || '').toLowerCase();
      const isBuy = name.startsWith('buy');
      // Detect options via security metadata, not name substring
      const sec = t.security;
      const isOption = !!(sec?.option_contract_type || sec?.option_strike_price);
      
      console.log('Validating:', { 
        id: t.id, 
        nameSample: t.name?.substring(0, 40),
        isBuy, 
        isOption,
        hasSec: !!sec,
        optType: sec?.option_contract_type,
        strike: sec?.option_strike_price
      });
      
      return !isBuy || isOption;
    });

    console.log('Invalid count:', invalidTxns.length);
    if (invalidTxns.length > 0) {
      console.log('Rejected:', invalidTxns.map(t => t.name?.substring(0, 50)));
      return NextResponse.json({ 
        error: 'Invalid transactions: must be stock BUY transactions (not options)',
        invalid: invalidTxns.map(t => ({ id: t.id, name: t.name }))
      }, { status: 400 });
    }

    // Check for already committed transactions
    const alreadyCommitted = transactions.filter(t => t.tradeNum);
    if (alreadyCommitted.length > 0) {
      return NextResponse.json({
        error: `${alreadyCommitted.length} transaction(s) already committed`,
        alreadyCommitted: alreadyCommitted.map(t => ({ id: t.id, tradeNum: t.tradeNum }))
      }, { status: 400 });
    }

    // Transform to legs format
    const legs = transactions.map(txn => {
      const symbol = txn.security?.ticker_symbol || 
                    txn.security?.option_underlying_ticker ||
                    extractSymbol(txn.name);
      return {
        id: txn.id,
        date: txn.date,
        symbol: symbol.toUpperCase(),
        action: 'buy' as const,
        quantity: txn.quantity || 0,
        price: txn.price || 0,
        fees: txn.rhFees || txn.fees || 0,
        amount: txn.amount || 0
      };
    });

    // Use position tracker service to create lots + journal entries
    const result = await prisma.$transaction(
      async (tx) => {
        return await positionTrackerService.commitStockTrade({
          legs,
          strategy,
          tradeNum: actualTradeNum,
          userId: user.id,
          tx
        });
      },
      { maxWait: 30000, timeout: 120000 }
    );

    return NextResponse.json({
      success: true,
      tradeNum: actualTradeNum,
      ...result
    });
  } catch (error) {
    console.error('Stock lots create error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to create lots' 
    }, { status: 500 });
  }
}

function extractSymbol(name: string): string {
  const match = name.match(/\b([A-Z]{1,5})\b/);
  return match ? match[1] : 'UNKNOWN';
}

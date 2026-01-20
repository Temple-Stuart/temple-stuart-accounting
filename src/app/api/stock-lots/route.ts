import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// GET: List open lots for a symbol (or all symbols)
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const status = searchParams.get('status') || 'OPEN'; // OPEN, PARTIAL, CLOSED, ALL

    const where: any = { user_id: user.id };
    if (symbol) where.symbol = symbol.toUpperCase();
    if (status !== 'ALL') where.status = status === 'OPEN' ? { in: ['OPEN', 'PARTIAL'] } : status;

    const lots = await prisma.stock_lots.findMany({
      where,
      include: {
        dispositions: true
      },
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

// POST: Create lots from investment transactions
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { transactionIds } = await request.json();

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'No transaction IDs provided' }, { status: 400 });
    }

    // Fetch the investment transactions
    const transactions = await prisma.investment_transactions.findMany({
      where: { id: { in: transactionIds } },
      include: { security: true }
    });

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions found' }, { status: 404 });
    }

    // Validate: all must be BUY transactions for stocks (not options)
    const invalidTxns = transactions.filter(t => {
      const name = t.name.toLowerCase();
      const isBuy = name.includes('buy') && !name.includes('sell');
      const isOption = name.includes('call') || name.includes('put');
      return !isBuy || isOption;
    });

    if (invalidTxns.length > 0) {
      return NextResponse.json({ 
        error: 'Invalid transactions: must be stock BUY transactions (not options)',
        invalid: invalidTxns.map(t => ({ id: t.id, name: t.name }))
      }, { status: 400 });
    }

    // Create lots
    const createdLots: Array<any> = [];
    for (const txn of transactions) {
      // Check if lot already exists for this transaction
      const existing = await prisma.stock_lots.findFirst({
        where: { investment_txn_id: txn.id }
      });

      if (existing) {
        createdLots.push({ ...existing, skipped: true, reason: 'Already exists' });
        continue;
      }

      const symbol = txn.security?.ticker_symbol || 
                     txn.security?.option_underlying_ticker ||
                     extractSymbol(txn.name);
      
      const quantity = txn.quantity || 0;
      const price = txn.price || 0;
      const fees = txn.rhFees || txn.fees || 0;
      const totalCost = Math.abs(txn.amount || (quantity * price)) + fees;

      const lot = await prisma.stock_lots.create({
        data: {
          user_id: user.id,
          investment_txn_id: txn.id,
          symbol: symbol.toUpperCase(),
          acquired_date: txn.date,
          original_quantity: quantity,
          remaining_quantity: quantity,
          cost_per_share: quantity > 0 ? totalCost / quantity : 0,
          total_cost_basis: totalCost,
          fees: fees,
          status: 'OPEN'
        }
      });

      createdLots.push(lot);
    }

    return NextResponse.json({
      success: true,
      created: createdLots.filter(l => !l.skipped).length,
      skipped: createdLots.filter(l => l.skipped).length,
      lots: createdLots
    });
  } catch (error) {
    console.error('Stock lots create error:', error);
    return NextResponse.json({ error: 'Failed to create lots' }, { status: 500 });
  }
}

// Helper to extract symbol from transaction name
function extractSymbol(name: string): string {
  // Try to find a stock symbol pattern (1-5 uppercase letters)
  const match = name.match(/\b([A-Z]{1,5})\b/);
  return match ? match[1] : 'UNKNOWN';
}

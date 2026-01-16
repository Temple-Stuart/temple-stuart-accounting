import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Get all uncommitted transactions
    const uncommitted = await prisma.investment_transactions.findMany({
      where: {
        accountCode: null,
        accounts: { userId: user.id }
      },
      include: { security: true },
      orderBy: { date: 'asc' }
    });

    // Group by underlying symbol
    const bySymbol: Record<string, any[]> = {};

    for (const txn of uncommitted) {
      // Get underlying symbol (for options use underlying ticker, for stocks use ticker)
      const symbol = txn.security?.option_underlying_ticker ||
                     txn.security?.ticker_symbol ||
                     txn.name?.split(' ')[0] ||
                     'UNKNOWN';

      if (!bySymbol[symbol]) bySymbol[symbol] = [];
      bySymbol[symbol].push({
        id: txn.id,
        date: txn.date,
        name: txn.name,
        type: txn.type,
        subtype: txn.subtype,
        quantity: txn.quantity,
        price: txn.price,
        amount: txn.amount,
        ticker: txn.security?.ticker_symbol,
        underlying: txn.security?.option_underlying_ticker,
        optionType: txn.security?.option_contract_type,
        strike: txn.security?.option_strike_price,
        expiration: txn.security?.option_expiration_date,
      });
    }

    // Sort symbols by transaction count
    const symbolStats = Object.entries(bySymbol)
      .map(([symbol, txns]) => ({
        symbol,
        count: txns.length,
        dateRange: {
          first: txns[0]?.date,
          last: txns[txns.length - 1]?.date
        },
        sample: txns.slice(0, 3)
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totalUncommitted: uncommitted.length,
      uniqueSymbols: Object.keys(bySymbol).length,
      symbolStats,
      bySymbol
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

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

    // Fetch all investment transactions that don't have a tradeNum assigned
    // Include security relation for option details
    const transactions = await prisma.investment_transactions.findMany({
      where: {
        tradeNum: null,
        accounts: { userId: user.id }
      },
      include: {
        security: true
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Filter to only "to open" transactions
    const opens = transactions.filter(t => 
      t.name?.toLowerCase().includes('to open')
    );

    // Parse each transaction using security data
    const parsedOpens = opens.map(t => {
      const name = t.name || '';
      const sec = t.security;
      
      // Determine if option from security data
      const isOption = !!(sec?.option_contract_type || sec?.option_strike_price);
      
      // Get option details from security relation
      const underlying = sec?.option_underlying_ticker || null;
      const optionType = sec?.option_contract_type?.toLowerCase() || null; // 'put' or 'call'
      const strike = sec?.option_strike_price || null;
      const expiration = sec?.option_expiration_date 
        ? new Date(sec.option_expiration_date).toISOString().split('T')[0] 
        : null;
      const ticker = sec?.ticker_symbol || null;
      
      // Detect action from name
      const isSell = name.toLowerCase().startsWith('sell');
      const action = isSell ? 'sell_to_open' : 'buy_to_open';

      return {
        id: t.id,
        date: t.date,
        name: t.name,
        security_id: t.security_id,
        ticker,
        underlying,
        isOption,
        optionType,
        strike,
        expiration,
        action,
        quantity: t.quantity,
        price: t.price,
        amount: t.amount,
      };
    });

    // Group by date
    const byDate: Record<string, typeof parsedOpens> = {};
    parsedOpens.forEach(t => {
      const dateKey = t.date ? new Date(t.date).toISOString().split('T')[0] : 'unknown';
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(t);
    });

    // Also group by date + underlying for spread detection
    const byDateAndUnderlying: Record<string, Record<string, typeof parsedOpens>> = {};
    parsedOpens.forEach(t => {
      const dateKey = t.date ? new Date(t.date).toISOString().split('T')[0] : 'unknown';
      const symbol = t.underlying || t.ticker || 'unknown';
      
      if (!byDateAndUnderlying[dateKey]) byDateAndUnderlying[dateKey] = {};
      if (!byDateAndUnderlying[dateKey][symbol]) byDateAndUnderlying[dateKey][symbol] = [];
      byDateAndUnderlying[dateKey][symbol].push(t);
    });

    return NextResponse.json({
      totalOpens: parsedOpens.length,
      opens: parsedOpens,
      byDate,
      byDateAndUnderlying,
    });
  } catch (error) {
    console.error('Opens endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

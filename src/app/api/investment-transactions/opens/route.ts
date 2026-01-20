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

    // Fetch ALL investment transactions that don't have a tradeNum assigned
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

    // Parse each transaction
    const parsed = transactions.map(t => {
      const name = t.name || '';
      const sec = t.security;
      const nameLower = name.toLowerCase();
      
      // Determine asset type
      const isOption = !!(sec?.option_contract_type || sec?.option_strike_price);
      const isCrypto = ['btc', 'eth', 'doge', 'sol', 'ada', 'xrp'].some(c => 
        sec?.ticker_symbol?.toLowerCase() === c || nameLower.includes(c)
      );
      const isStock = !isOption && !isCrypto;
      
      // Get option details from security relation
      const underlying = sec?.option_underlying_ticker || null;
      const optionType = sec?.option_contract_type?.toLowerCase() || null;
      const strike = sec?.option_strike_price || null;
      const expiration = sec?.option_expiration_date 
        ? new Date(sec.option_expiration_date).toISOString().split('T')[0] 
        : null;
      const ticker = sec?.ticker_symbol || null;
      
      // Detect action from name
      const isSell = nameLower.startsWith('sell');
      const isBuy = nameLower.startsWith('buy');
      const isToOpen = nameLower.includes('to open');
      const isToClose = nameLower.includes('to close');
      
      let action = 'unknown';
      if (isOption) {
        if (isToOpen) action = isSell ? 'sell_to_open' : 'buy_to_open';
        else if (isToClose) action = isSell ? 'sell_to_close' : 'buy_to_close';
      } else {
        action = isSell ? 'sell' : 'buy';
      }
      
      // Detect exercise/assignment (these CLOSE option positions)
      const isExercise = nameLower.includes('exercise');
      const isAssignment = nameLower.includes('assignment');
      const isExerciseOrAssignment = isExercise || isAssignment;
      
      // Determine position type
      let positionType: 'open' | 'close' | 'unknown' = 'unknown';
      
      if (isExerciseOrAssignment) {
        // Exercise/assignment transactions close option positions
        // The "transfer" type ones are the option closing
        // The "buy/sell" ones with "due to exercise/assignment" are stock opens
        if (t.type === 'transfer' || nameLower.startsWith('transfer')) {
          positionType = 'close'; // This closes the option
        } else {
          // Stock transaction from exercise - this OPENS a stock position
          positionType = 'open';
        }
      } else if (isOption) {
        positionType = isToOpen ? 'open' : isToClose ? 'close' : 'unknown';
      } else {
        // For stocks/crypto: buys open positions, sells close positions
        positionType = isBuy ? 'open' : isSell ? 'close' : 'unknown';
      }

      return {
        id: t.id,
        date: t.date,
        name: t.name,
        security_id: t.security_id,
        ticker,
        underlying: underlying || ticker, // Use ticker as underlying for stocks/crypto
        isOption,
        isCrypto,
        isStock,
        optionType,
        strike,
        expiration,
        action,
        positionType,
        quantity: t.quantity,
        price: t.price,
        amount: t.amount,
      };
    });

    // Separate opens vs closes
    const opens = parsed.filter(t => t.positionType === 'open');
    const closes = parsed.filter(t => t.positionType === 'close');
    const unknown = parsed.filter(t => t.positionType === 'unknown');

    // Group opens by date
    const byDate: Record<string, typeof opens> = {};
    opens.forEach(t => {
      const dateKey = t.date ? new Date(t.date).toISOString().split('T')[0] : 'unknown';
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(t);
    });

    // Group opens by date + underlying for spread detection
    const byDateAndUnderlying: Record<string, Record<string, typeof opens>> = {};
    opens.forEach(t => {
      const dateKey = t.date ? new Date(t.date).toISOString().split('T')[0] : 'unknown';
      const symbol = t.underlying || t.ticker || 'unknown';
      
      if (!byDateAndUnderlying[dateKey]) byDateAndUnderlying[dateKey] = {};
      if (!byDateAndUnderlying[dateKey][symbol]) byDateAndUnderlying[dateKey][symbol] = [];
      byDateAndUnderlying[dateKey][symbol].push(t);
    });

    return NextResponse.json({
      totalAll: parsed.length,
      totalOpens: opens.length,
      totalCloses: closes.length,
      totalUnknown: unknown.length,
      opens,
      closes,
      unknown,
      byDate,
      byDateAndUnderlying,
    });
  } catch (error) {
    console.error('Opens endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

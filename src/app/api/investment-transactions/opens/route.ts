import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all investment transactions that don't have a tradeNum assigned
  const transactions = await prisma.investment_transactions.findMany({
    where: {
      tradeNum: null,
    },
    orderBy: {
      date: 'asc',
    },
  });

  // Filter to only "to open" transactions
  const opens = transactions.filter(t => 
    t.name?.toLowerCase().includes('to open')
  );

  // Parse each transaction to extract useful fields
  const parsedOpens = opens.map(t => {
    const name = t.name || '';
    
    // Extract ticker from name (e.g., "TSLA250815P00280000" or "TSLA")
    const tickerMatch = name.match(/\d+\.?\d*\s+(?:shares\s+of\s+)?([A-Z0-9]+)/i);
    const ticker = tickerMatch ? tickerMatch[1] : null;
    
    // Detect if it's an option (has format like TSLA250815P00280000)
    const isOption = ticker ? /^[A-Z]+\d{6}[PC]\d+$/.test(ticker) : false;
    
    // Parse option details if applicable
    let underlying = null;
    let optionType = null;
    let strike = null;
    let expiration = null;
    
    if (isOption && ticker) {
      const optMatch = ticker.match(/^([A-Z]+)(\d{6})([PC])(\d{8})$/);
      if (optMatch) {
        underlying = optMatch[1];
        const dateStr = optMatch[2];
        optionType = optMatch[3] === 'P' ? 'put' : 'call';
        strike = parseInt(optMatch[4]) / 1000;
        const yy = dateStr.substring(0, 2);
        const mm = dateStr.substring(2, 4);
        const dd = dateStr.substring(4, 6);
        expiration = `20${yy}-${mm}-${dd}`;
      }
    }
    
    const isSell = name.toLowerCase().startsWith('sell');
    const action = isSell ? 'sell_to_open' : 'buy_to_open';

    return {
      id: t.id,
      date: t.date,
      name: t.name,
      ticker: isOption ? ticker : (underlying || ticker),
      underlying: underlying,
      isOption,
      optionType,
      strike,
      expiration,
      action,
      quantity: t.quantity,
      price: t.price,
      amount: t.amount,
      tradeNum: null,
      closingTransactionIds: [],
    };
  });

  const byDate: Record<string, typeof parsedOpens> = {};
  parsedOpens.forEach(t => {
    const dateKey = t.date ? new Date(t.date).toISOString().split('T')[0] : 'unknown';
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(t);
  });

  return NextResponse.json({
    totalOpens: parsedOpens.length,
    opens: parsedOpens,
    byDate,
  });
}

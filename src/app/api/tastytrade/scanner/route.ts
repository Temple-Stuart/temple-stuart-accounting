import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient } from '@/lib/tastytrade';

const DEFAULT_SYMBOLS = [
  'SPY','QQQ','IWM','AAPL','MSFT','GOOGL','AMZN','TSLA','NVDA','META',
  'AMD','NFLX','JPM','BAC','GS','XOM','CVX','PFE','JNJ','UNH',
  'DIS','BA','COST','HD','LOW','CRM','ORCL','ADBE','INTC','MU',
  'COIN','MARA','SQ','SHOP','SNAP','PLTR','SOFI','RIVN','LCID','NIO',
  'ARM','SMCI','AVGO','MRVL','PANW','CRWD','NET','DKNG','ABNB','UBER',
];

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    const symbols = symbolsParam
      ? symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : DEFAULT_SYMBOLS;

    // Tastytrade API expects symbols as comma-separated, not bracket-array
    const raw = await client.marketMetricsService.getMarketMetrics({ symbols: symbols.join(',') });
    const items = Array.isArray(raw) ? raw : [];

    const metrics = items.map((m: any) => {
      const earningsDate = m['earnings']?.['expected-report-date'] || m['next-earnings-date'] || null;
      let daysTillEarnings: number | null = null;
      if (earningsDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const ed = new Date(earningsDate + 'T00:00:00');
        daysTillEarnings = Math.round((ed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        symbol: m['symbol'] || '',
        ivRank: Number(m['implied-volatility-rank'] || m['tos-implied-volatility-rank'] || 0),
        ivPercentile: Number(m['implied-volatility-percentile'] || m['tos-implied-volatility-percentile'] || 0),
        impliedVolatility: Number(m['implied-volatility-index'] || m['tw-implied-volatility-index'] || 0),
        liquidityRating: Number(m['liquidity-rating'] || m['liquidity-value'] || 0),
        earningsDate,
        daysTillEarnings,
      };
    }).filter((m: any) => m.symbol);

    return NextResponse.json({ metrics, fetchedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('[Tastytrade] Scanner error:', error);
    return NextResponse.json({ error: 'Failed to fetch scanner data' }, { status: 500 });
  }
}

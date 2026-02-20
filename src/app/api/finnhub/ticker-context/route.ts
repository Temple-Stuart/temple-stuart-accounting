import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }

  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    return NextResponse.json({ error: 'Finnhub API key not configured' });
  }

  const baseUrl = 'https://finnhub.io/api/v1';
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  // Three parallel requests — each individually caught so partial data is fine
  const [newsResult, analystResult, targetResult] = await Promise.all([
    // 1. Company News (last 7 days)
    fetch(`${baseUrl}/company-news?symbol=${symbol}&from=${fmtDate(sevenDaysAgo)}&to=${fmtDate(today)}&token=${token}`)
      .then(r => {
        if (!r.ok) { console.error(`[Finnhub] News ${symbol}: HTTP ${r.status}`); return null; }
        return r.json();
      })
      .then((articles: any[] | null) => {
        if (!articles || !Array.isArray(articles)) return { count: 0, articles: [] };
        // Sort by datetime descending (most recent first)
        articles.sort((a: any, b: any) => (b.datetime || 0) - (a.datetime || 0));
        const now = Date.now() / 1000;
        return {
          count: articles.length,
          articles: articles.slice(0, 5).map((a: any) => ({
            headline: a.headline || '',
            source: a.source || '',
            daysAgo: Math.round((now - (a.datetime || 0)) / 86400),
            url: a.url || '',
          })),
        };
      })
      .catch((e) => { console.error(`[Finnhub] News ${symbol} error:`, e); return null; }),

    // 2. Analyst Recommendations (most recent)
    fetch(`${baseUrl}/stock/recommendation?symbol=${symbol}&token=${token}`)
      .then(r => {
        if (!r.ok) { console.error(`[Finnhub] Recommendations ${symbol}: HTTP ${r.status}`); return null; }
        return r.json();
      })
      .then((recs: any[] | null) => {
        if (!recs || !Array.isArray(recs) || recs.length === 0) return null;
        const latest = recs[0];
        return {
          strongBuy: latest.strongBuy ?? 0,
          buy: latest.buy ?? 0,
          hold: latest.hold ?? 0,
          sell: latest.sell ?? 0,
          strongSell: latest.strongSell ?? 0,
          period: latest.period ?? '',
        };
      })
      .catch((e) => { console.error(`[Finnhub] Recommendations ${symbol} error:`, e); return null; }),

    // 3. Price Target
    fetch(`${baseUrl}/stock/price-target?symbol=${symbol}&token=${token}`)
      .then(async (r) => {
        if (!r.ok) { console.error(`[Finnhub] PriceTarget ${symbol}: HTTP ${r.status}`); return { _status: r.status }; }
        const pt = await r.json();
        console.log(`[Finnhub] PriceTarget ${symbol} raw:`, JSON.stringify(pt));
        return pt;
      })
      .then((pt: any | null) => {
        if (!pt || pt._status) return pt?._status ? { _blocked: pt._status } : null;
        // Accept if ANY numeric target field exists
        const mean = typeof pt.targetMean === 'number' ? pt.targetMean : null;
        const median = typeof pt.targetMedian === 'number' ? pt.targetMedian : null;
        const high = typeof pt.targetHigh === 'number' ? pt.targetHigh : null;
        const low = typeof pt.targetLow === 'number' ? pt.targetLow : null;
        const bestMean = mean ?? median ?? null;
        if (bestMean === null || bestMean === 0) return null;
        return {
          high: high ?? 0,
          low: low ?? 0,
          mean: bestMean,
          median: median ?? mean ?? 0,
          numberAnalysts: typeof pt.numberAnalysts === 'number' ? pt.numberAnalysts : 0,
        };
      })
      .catch((e) => { console.error(`[Finnhub] PriceTarget ${symbol} error:`, e); return null; }),
  ]);

  // Clean up internal debug fields from price target
  const priceTarget = targetResult && typeof targetResult === 'object' && '_blocked' in targetResult
    ? null
    : targetResult;

  return NextResponse.json({
    news: newsResult,
    analysts: analystResult,
    priceTarget,
    // Debug: include if price target was blocked by HTTP status
    ...(targetResult && typeof targetResult === 'object' && '_blocked' in targetResult
      ? { priceTargetStatus: (targetResult as any)._blocked }
      : {}),
  });
}

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
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
        if (!r.ok) return null;
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
      .catch(() => null),

    // 2. Analyst Recommendations (most recent)
    fetch(`${baseUrl}/stock/recommendation?symbol=${symbol}&token=${token}`)
      .then(r => {
        if (!r.ok) return null;
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
      .catch(() => null),

    // 3. Price Target
    fetch(`${baseUrl}/stock/price-target?symbol=${symbol}&token=${token}`)
      .then(r => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((pt: any | null) => {
        if (!pt || (pt.targetMean == null && pt.targetMedian == null)) return null;
        return {
          high: pt.targetHigh ?? 0,
          low: pt.targetLow ?? 0,
          mean: pt.targetMean ?? pt.targetMedian ?? 0,
          median: pt.targetMedian ?? pt.targetMean ?? 0,
          numberAnalysts: pt.numberAnalysts ?? 0,
        };
      })
      .catch(() => null),
  ]);

  return NextResponse.json({
    news: newsResult,
    analysts: analystResult,
    priceTarget: targetResult,
  });
}

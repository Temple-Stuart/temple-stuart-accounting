import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const personalEntity = await prisma.entities.findFirst({
      where: { userId: user.id, entity_type: 'personal', is_default: true },
    });
    if (!personalEntity) {
      return NextResponse.json({ error: 'Personal entity not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const months = Math.min(parseInt(searchParams.get('months') || '6', 10) || 6, 24);

    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
    cutoff.setUTCDate(1);
    cutoff.setUTCHours(0, 0, 0, 0);

    const txns = await prisma.transactions.findMany({
      where: {
        entity_id: personalEntity.id,
        accountCode: { not: null },
        review_status: 'committed',
        amount: { gt: 0 },
        date: { gte: cutoff },
      },
      select: {
        date: true,
        amount: true,
        accountCode: true,
        merchantName: true,
        logo_url: true,
      },
      orderBy: { date: 'desc' },
    });

    const expenseTxns = txns.filter((t) => {
      const code = t.accountCode!;
      return code.startsWith('6') || code.startsWith('7') || code.startsWith('8') || code.startsWith('9');
    });

    const coaCodes = [...new Set(expenseTxns.map((t) => t.accountCode!))];
    const coaRows = coaCodes.length > 0
      ? await prisma.chart_of_accounts.findMany({
          where: { entity_id: personalEntity.id, code: { in: coaCodes } },
          select: { code: true, name: true },
        })
      : [];
    const coaNameByCode: Record<string, string> = {};
    for (const c of coaRows) coaNameByCode[c.code] = c.name;

    // monthlyTotals
    const monthMap = new Map<string, { txnCount: number; totalOutflow: number }>();
    for (const t of expenseTxns) {
      const m = t.date.toISOString().slice(0, 7);
      const entry = monthMap.get(m) || { txnCount: 0, totalOutflow: 0 };
      entry.txnCount++;
      entry.totalOutflow = round2(entry.totalOutflow + t.amount);
      monthMap.set(m, entry);
    }
    const monthlyTotals = Array.from(monthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month));

    // categoryBreakdown
    interface MerchantAgg {
      merchantName: string;
      logoUrl: string | null;
      txnCount: number;
      totalSpend: number;
    }
    interface CategoryAgg {
      accountCode: string;
      accountName: string;
      txnCount: number;
      totalSpend: number;
      merchantMap: Map<string, MerchantAgg>;
    }
    const catMap = new Map<string, CategoryAgg>();
    for (const t of expenseTxns) {
      const code = t.accountCode!;
      let cat = catMap.get(code);
      if (!cat) {
        cat = {
          accountCode: code,
          accountName: coaNameByCode[code] || code,
          txnCount: 0,
          totalSpend: 0,
          merchantMap: new Map(),
        };
        catMap.set(code, cat);
      }
      cat.txnCount++;
      cat.totalSpend = round2(cat.totalSpend + t.amount);

      const mName = t.merchantName || 'Unknown';
      let merch = cat.merchantMap.get(mName);
      if (!merch) {
        merch = { merchantName: mName, logoUrl: t.logo_url, txnCount: 0, totalSpend: 0 };
        cat.merchantMap.set(mName, merch);
      }
      merch.txnCount++;
      merch.totalSpend = round2(merch.totalSpend + t.amount);
      if (!merch.logoUrl && t.logo_url) merch.logoUrl = t.logo_url;
    }

    const categoryBreakdown = Array.from(catMap.values())
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .map((cat) => {
        const merchants = Array.from(cat.merchantMap.values())
          .sort((a, b) => b.totalSpend - a.totalSpend)
          .slice(0, 10)
          .map((m) => ({
            ...m,
            avgPerTxn: round2(m.totalSpend / m.txnCount),
          }));
        return {
          accountCode: cat.accountCode,
          accountName: cat.accountName,
          txnCount: cat.txnCount,
          totalSpend: cat.totalSpend,
          merchants,
        };
      });

    // topMerchants
    const globalMerchMap = new Map<string, { merchantName: string; logoUrl: string | null; txnCount: number; totalSpend: number }>();
    for (const t of expenseTxns) {
      const mName = t.merchantName || 'Unknown';
      let m = globalMerchMap.get(mName);
      if (!m) {
        m = { merchantName: mName, logoUrl: t.logo_url, txnCount: 0, totalSpend: 0 };
        globalMerchMap.set(mName, m);
      }
      m.txnCount++;
      m.totalSpend = round2(m.totalSpend + t.amount);
      if (!m.logoUrl && t.logo_url) m.logoUrl = t.logo_url;
    }
    const topMerchants = Array.from(globalMerchMap.values())
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 15);

    return NextResponse.json({ monthlyTotals, categoryBreakdown, topMerchants });
  } catch (error) {
    console.error('Expense analytics error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

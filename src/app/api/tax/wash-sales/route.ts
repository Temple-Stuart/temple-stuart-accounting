import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { detectWashSales, applyWashSaleAdjustments } from '@/lib/wash-sale-service';

/**
 * GET /api/tax/wash-sales
 * Returns all detected wash sale violations for the authenticated user.
 */
export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const result = await detectWashSales(user.id);

    // Group violations by symbol for the report
    const bySymbol: Record<string, {
      symbol: string;
      violations: typeof result.violations;
      totalDisallowed: number;
      count: number;
    }> = {};

    for (const v of result.violations) {
      if (!bySymbol[v.symbol]) {
        bySymbol[v.symbol] = { symbol: v.symbol, violations: [], totalDisallowed: 0, count: 0 };
      }
      bySymbol[v.symbol].violations.push(v);
      bySymbol[v.symbol].totalDisallowed += v.disallowedLoss;
      bySymbol[v.symbol].count++;
    }

    // Round the per-symbol totals
    for (const sym of Object.values(bySymbol)) {
      sym.totalDisallowed = Math.round(sym.totalDisallowed * 100) / 100;
    }

    // Estimate tax impact: disallowed losses reduce your deductible losses
    const ST_TAX_RATE = 0.35;
    const LT_TAX_RATE = 0.15;
    // Conservative: assume all disallowed losses would have been short-term
    const estimatedTaxImpact = Math.round(result.summary.totalDisallowedLosses * ST_TAX_RATE * 100) / 100;

    return NextResponse.json({
      ...result,
      bySymbol: Object.values(bySymbol).sort((a, b) => b.totalDisallowed - a.totalDisallowed),
      taxImpact: {
        totalDisallowedLosses: result.summary.totalDisallowedLosses,
        estimatedAdditionalTax: estimatedTaxImpact,
        note: 'Estimated using 35% short-term rate. Actual impact depends on your tax bracket and whether losses are short-term or long-term.'
      }
    });
  } catch (error) {
    console.error('Wash sale detection error:', error);
    return NextResponse.json({ error: 'Failed to detect wash sales' }, { status: 500 });
  }
}

/**
 * POST /api/tax/wash-sales
 * Apply wash sale adjustments to the database (mark dispositions, adjust cost basis).
 * This is a destructive operation — updates lot_dispositions and stock_lots records.
 */
export async function POST() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Detect first
    const { violations, summary } = await detectWashSales(user.id);

    if (violations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No wash sale violations detected',
        updated: 0
      });
    }

    // Apply adjustments
    const result = await applyWashSaleAdjustments(user.id, violations);

    return NextResponse.json({
      success: true,
      message: `Applied ${result.updated} wash sale adjustments`,
      updated: result.updated,
      totalDisallowedLosses: summary.totalDisallowedLosses,
      symbolsAffected: summary.symbolsAffected
    });
  } catch (error) {
    console.error('Wash sale apply error:', error);
    return NextResponse.json({ error: 'Failed to apply wash sale adjustments' }, { status: 500 });
  }
}

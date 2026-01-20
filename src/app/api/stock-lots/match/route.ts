import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

interface Lot {
  id: string;
  acquired_date: Date;
  original_quantity: number;
  remaining_quantity: number;
  cost_per_share: number;
  total_cost_basis: number;
}

interface MatchResult {
  method: string;
  lots: Array<{
    lotId: string;
    acquiredDate: string;
    quantityUsed: number;
    costBasisUsed: number;
    proceedsAllocated: number;
    gainLoss: number;
    holdingPeriodDays: number;
    isLongTerm: boolean;
  }>;
  summary: {
    shortTermGain: number;
    longTermGain: number;
    totalGainLoss: number;
    estimatedTax: number;
  };
}

// POST: Calculate matching scenarios for a potential sale
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { symbol, saleQuantity, salePrice, saleDate, stTaxRate = 0.35, ltTaxRate = 0.15 } = await request.json();

    if (!symbol || !saleQuantity || !salePrice || !saleDate) {
      return NextResponse.json({ 
        error: 'Required: symbol, saleQuantity, salePrice, saleDate' 
      }, { status: 400 });
    }

    const saleDateObj = new Date(saleDate);
    const totalProceeds = saleQuantity * salePrice;

    // Get all open/partial lots for this symbol
    const lots = await prisma.stock_lots.findMany({
      where: {
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        status: { in: ['OPEN', 'PARTIAL'] },
        remaining_quantity: { gt: 0 }
      },
      orderBy: { acquired_date: 'asc' }
    });

    if (lots.length === 0) {
      return NextResponse.json({ error: 'No open lots found for this symbol' }, { status: 404 });
    }

    const totalAvailable = lots.reduce((sum, l) => sum + l.remaining_quantity, 0);
    if (totalAvailable < saleQuantity) {
      return NextResponse.json({ 
        error: `Insufficient shares: have ${totalAvailable.toFixed(4)}, need ${saleQuantity}`,
        available: totalAvailable
      }, { status: 400 });
    }

    // Calculate each matching method
    const scenarios: Record<string, MatchResult> = {
      fifo: calculateMatch(lots, saleQuantity, salePrice, saleDateObj, 'FIFO', stTaxRate, ltTaxRate),
      lifo: calculateMatch([...lots].reverse(), saleQuantity, salePrice, saleDateObj, 'LIFO', stTaxRate, ltTaxRate),
      hifo: calculateMatch(
        [...lots].sort((a, b) => b.cost_per_share - a.cost_per_share), 
        saleQuantity, salePrice, saleDateObj, 'HIFO', stTaxRate, ltTaxRate
      ),
      lofo: calculateMatch(
        [...lots].sort((a, b) => a.cost_per_share - b.cost_per_share), 
        saleQuantity, salePrice, saleDateObj, 'LOFO', stTaxRate, ltTaxRate
      ),
      ltFirst: calculateMatch(
        [...lots].sort((a, b) => a.acquired_date.getTime() - b.acquired_date.getTime())
          .filter(l => isLongTerm(l.acquired_date, saleDateObj))
          .concat([...lots].filter(l => !isLongTerm(l.acquired_date, saleDateObj))),
        saleQuantity, salePrice, saleDateObj, 'LT_FIRST', stTaxRate, ltTaxRate
      ),
      minTax: findMinTaxScenario(lots, saleQuantity, salePrice, saleDateObj, stTaxRate, ltTaxRate)
    };

    // Find the best scenario
    const bestMethod = Object.entries(scenarios)
      .reduce((best, [method, result]) => 
        result.summary.estimatedTax < best.result.summary.estimatedTax 
          ? { method, result } 
          : best,
        { method: 'fifo', result: scenarios.fifo }
      );

    return NextResponse.json({
      symbol,
      saleQuantity,
      salePrice,
      saleDate,
      totalProceeds,
      availableLots: lots.map(l => ({
        id: l.id,
        acquiredDate: l.acquired_date.toISOString(),
        remainingQuantity: l.remaining_quantity,
        costPerShare: l.cost_per_share,
        totalCostBasis: l.total_cost_basis,
        holdingPeriodDays: daysBetween(l.acquired_date, saleDateObj),
        isLongTerm: isLongTerm(l.acquired_date, saleDateObj)
      })),
      scenarios,
      bestMethod: bestMethod.method,
      taxRates: { stTaxRate, ltTaxRate }
    });
  } catch (error) {
    console.error('Stock lots match error:', error);
    return NextResponse.json({ error: 'Failed to calculate matching' }, { status: 500 });
  }
}

function calculateMatch(
  sortedLots: Lot[],
  saleQuantity: number,
  salePrice: number,
  saleDate: Date,
  method: string,
  stTaxRate: number,
  ltTaxRate: number
): MatchResult {
  const lotsUsed: MatchResult['lots'] = [];
  let remaining = saleQuantity;
  let shortTermGain = 0;
  let longTermGain = 0;

  for (const lot of sortedLots) {
    if (remaining <= 0) break;

    const quantityFromLot = Math.min(remaining, lot.remaining_quantity);
    const costBasisUsed = quantityFromLot * lot.cost_per_share;
    const proceedsAllocated = quantityFromLot * salePrice;
    const gainLoss = proceedsAllocated - costBasisUsed;
    const holdingDays = daysBetween(lot.acquired_date, saleDate);
    const longTerm = holdingDays >= 365;

    if (longTerm) {
      longTermGain += gainLoss;
    } else {
      shortTermGain += gainLoss;
    }

    lotsUsed.push({
      lotId: lot.id,
      acquiredDate: lot.acquired_date.toISOString(),
      quantityUsed: quantityFromLot,
      costBasisUsed,
      proceedsAllocated,
      gainLoss,
      holdingPeriodDays: holdingDays,
      isLongTerm: longTerm
    });

    remaining -= quantityFromLot;
  }

  const totalGainLoss = shortTermGain + longTermGain;
  const stTax = shortTermGain * stTaxRate;
  const ltTax = longTermGain * ltTaxRate;
  const estimatedTax = stTax + ltTax;

  return {
    method,
    lots: lotsUsed,
    summary: {
      shortTermGain,
      longTermGain,
      totalGainLoss,
      estimatedTax
    }
  };
}

function findMinTaxScenario(
  lots: Lot[],
  saleQuantity: number,
  salePrice: number,
  saleDate: Date,
  stTaxRate: number,
  ltTaxRate: number
): MatchResult {
  const lotsWithMeta = lots.map(l => ({
    ...l,
    potentialGainPerShare: salePrice - l.cost_per_share,
    isLongTerm: isLongTerm(l.acquired_date, saleDate)
  }));

  const optimallySorted = lotsWithMeta.sort((a, b) => {
    const aIsLoss = a.potentialGainPerShare < 0;
    const bIsLoss = b.potentialGainPerShare < 0;
    
    if (aIsLoss && !bIsLoss) return -1;
    if (!aIsLoss && bIsLoss) return 1;
    if (aIsLoss && bIsLoss) return b.cost_per_share - a.cost_per_share;
    if (a.isLongTerm && !b.isLongTerm) return -1;
    if (!a.isLongTerm && b.isLongTerm) return 1;
    return a.potentialGainPerShare - b.potentialGainPerShare;
  });

  return calculateMatch(optimallySorted, saleQuantity, salePrice, saleDate, 'MIN_TAX', stTaxRate, ltTaxRate);
}

function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
}

function isLongTerm(acquiredDate: Date, saleDate: Date): boolean {
  return daysBetween(acquiredDate, saleDate) >= 365;
}

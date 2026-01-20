import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// POST: Commit a sale using the selected matching method
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { 
      saleTxnId,           // Investment transaction ID for the sale
      symbol,
      saleQuantity,
      salePrice,
      saleDate,
      saleFees = 0,
      matchingMethod,      // FIFO, LIFO, HIFO, LOFO, MIN_TAX, SPECIFIC
      selectedLots         // For SPECIFIC: array of { lotId, quantity }
    } = await request.json();

    if (!symbol || !saleQuantity || !salePrice || !saleDate || !matchingMethod) {
      return NextResponse.json({ 
        error: 'Required: symbol, saleQuantity, salePrice, saleDate, matchingMethod' 
      }, { status: 400 });
    }

    const saleDateObj = new Date(saleDate);
    const totalProceeds = (saleQuantity * salePrice) - saleFees;

    // Get open lots
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
      return NextResponse.json({ error: 'No open lots found' }, { status: 404 });
    }

    // Sort lots based on method
    let sortedLots = [...lots];
    switch (matchingMethod) {
      case 'LIFO':
        sortedLots.reverse();
        break;
      case 'HIFO':
        sortedLots.sort((a, b) => b.cost_per_share - a.cost_per_share);
        break;
      case 'LOFO':
        sortedLots.sort((a, b) => a.cost_per_share - b.cost_per_share);
        break;
      case 'MIN_TAX':
        sortedLots = sortForMinTax(lots, salePrice, saleDateObj);
        break;
      case 'SPECIFIC':
        if (!selectedLots || !Array.isArray(selectedLots)) {
          return NextResponse.json({ error: 'SPECIFIC method requires selectedLots array' }, { status: 400 });
        }
        // Reorder based on user selection
        sortedLots = selectedLots.map(sel => {
          const lot = lots.find(l => l.id === sel.lotId);
          if (!lot) throw new Error(`Lot not found: ${sel.lotId}`);
          return { ...lot, requestedQty: sel.quantity };
        });
        break;
      // FIFO is default (already sorted by acquired_date asc)
    }

    // Execute the matching in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const dispositions = [];
      let remaining = saleQuantity;
      let totalCostBasis = 0;
      let shortTermGain = 0;
      let longTermGain = 0;

      for (const lot of sortedLots) {
        if (remaining <= 0) break;

        const requestedQty = (lot as any).requestedQty;
        const quantityFromLot = matchingMethod === 'SPECIFIC' && requestedQty
          ? Math.min(requestedQty, lot.remaining_quantity, remaining)
          : Math.min(remaining, lot.remaining_quantity);

        if (quantityFromLot <= 0) continue;

        const costBasisUsed = quantityFromLot * lot.cost_per_share;
        const proceedsAllocated = (quantityFromLot / saleQuantity) * totalProceeds;
        const feesAllocated = (quantityFromLot / saleQuantity) * saleFees;
        const gainLoss = proceedsAllocated - costBasisUsed;
        const holdingDays = daysBetween(lot.acquired_date, saleDateObj);
        const isLongTerm = holdingDays >= 365;

        totalCostBasis += costBasisUsed;
        if (isLongTerm) {
          longTermGain += gainLoss;
        } else {
          shortTermGain += gainLoss;
        }

        // Create disposition record
        const disposition = await tx.lot_dispositions.create({
          data: {
            lot_id: lot.id,
            sale_txn_id: saleTxnId || `manual_${Date.now()}`,
            disposed_date: saleDateObj,
            quantity_disposed: quantityFromLot,
            proceeds_per_share: salePrice,
            total_proceeds: proceedsAllocated,
            fees_allocated: feesAllocated,
            cost_basis_disposed: costBasisUsed,
            realized_gain_loss: gainLoss,
            holding_period_days: holdingDays,
            is_long_term: isLongTerm,
            is_wash_sale: false,
            wash_sale_loss: 0,
            matching_method: matchingMethod
          }
        });

        dispositions.push({
          dispositionId: disposition.id,
          lotId: lot.id,
          quantityDisposed: quantityFromLot,
          costBasisUsed,
          proceedsAllocated,
          gainLoss,
          holdingDays,
          isLongTerm
        });

        // Update lot
        const newRemaining = lot.remaining_quantity - quantityFromLot;
        const newStatus = newRemaining <= 0.0001 ? 'CLOSED' : 'PARTIAL';

        await tx.stock_lots.update({
          where: { id: lot.id },
          data: {
            remaining_quantity: Math.max(0, newRemaining),
            status: newStatus
          }
        });

        remaining -= quantityFromLot;
      }

      if (remaining > 0.0001) {
        throw new Error(`Could not match all shares: ${remaining.toFixed(4)} remaining`);
      }

      // Save tax scenario record
      const scenario = await tx.tax_scenarios.create({
        data: {
          user_id: user.id,
          sale_txn_id: saleTxnId,
          symbol: symbol.toUpperCase(),
          sale_quantity: saleQuantity,
          sale_price: salePrice,
          sale_date: saleDateObj,
          selected_method: matchingMethod,
          is_committed: true,
          fifo_result: { used: matchingMethod === 'FIFO' },
          lifo_result: { used: matchingMethod === 'LIFO' },
          hifo_result: { used: matchingMethod === 'HIFO' },
          specific_result: matchingMethod === 'SPECIFIC' ? { lots: selectedLots } : null
        }
      });

      return {
        scenarioId: scenario.id,
        dispositions,
        summary: {
          totalProceeds,
          totalCostBasis,
          shortTermGain,
          longTermGain,
          totalGainLoss: shortTermGain + longTermGain,
          matchingMethod
        }
      };
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Stock lots commit error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to commit sale' 
    }, { status: 500 });
  }
}

function sortForMinTax(lots: any[], salePrice: number, saleDate: Date) {
  return [...lots].sort((a, b) => {
    const aGain = salePrice - a.cost_per_share;
    const bGain = salePrice - b.cost_per_share;
    const aIsLoss = aGain < 0;
    const bIsLoss = bGain < 0;
    const aLT = daysBetween(a.acquired_date, saleDate) >= 365;
    const bLT = daysBetween(b.acquired_date, saleDate) >= 365;
    
    if (aIsLoss && !bIsLoss) return -1;
    if (!aIsLoss && bIsLoss) return 1;
    if (aIsLoss && bIsLoss) return b.cost_per_share - a.cost_per_share;
    if (aLT && !bLT) return -1;
    if (!aLT && bLT) return 1;
    return aGain - bGain;
  });
}

function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// POST: Commit a sale using the selected matching method
export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
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

      if (remaining > 0.01) {
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
          specific_result: matchingMethod === 'SPECIFIC' ? { lots: selectedLots } : undefined
        }
      });

      // Get next trade number
      const maxResult = await tx.investment_transactions.findMany({
        where: { tradeNum: { not: null } },
        select: { tradeNum: true }
      });
      const maxNum = maxResult.reduce((max, t) => {
        const num = parseInt(t.tradeNum || '0', 10);
        return num > max ? num : max;
      }, 0);
      const tradeNum = String(maxNum + 1);

      // Create journal entry for the sale
      const TRADING_CASH = 'T-1010';
      const STOCK_POSITION = 'T-1100';
      const PL_ACCOUNT = shortTermGain + longTermGain >= 0 ? 'T-4100' : 'T-5100';
      
      const totalGainLoss = shortTermGain + longTermGain;
      const proceedsCents = Math.round(totalProceeds * 100);
      const costBasisCents = Math.round(totalCostBasis * 100);
      const plCents = Math.round(totalGainLoss * 100);

      // Fetch accounts
      const accounts = await tx.chart_of_accounts.findMany({
        where: { code: { in: [TRADING_CASH, STOCK_POSITION, PL_ACCOUNT] } }
      });
      
      const cashAccount = accounts.find(a => a.code === TRADING_CASH);
      const stockAccount = accounts.find(a => a.code === STOCK_POSITION);
      const plAccount = accounts.find(a => a.code === PL_ACCOUNT);
      
      if (!cashAccount || !stockAccount || !plAccount) {
        throw new Error('Missing required accounts: T-1010, T-1100, T-4100/T-5100');
      }

      // Create journal transaction
      const journalTxn = await tx.journal_transactions.create({
        data: {
          id: uuidv4(),
          transaction_date: saleDateObj,
          description: `SELL STOCK: ${saleQuantity} ${symbol} @ $${salePrice.toFixed(2)} (${matchingMethod})`,
          external_transaction_id: saleTxnId,
          strategy: 'stock-long',
          trade_num: tradeNum,
          amount: proceedsCents,
          posted_at: new Date()
        }
      });

      // Journal entry: DR Cash (proceeds), CR Stock Position (cost basis), DR/CR P&L (difference)
      // If gain: DR Cash, CR Stock, CR P&L (T-4100)
      // If loss: DR Cash, DR P&L (T-5100), CR Stock
      
      // DR Trading Cash (proceeds received)
      await tx.ledger_entries.create({
        data: {
          id: uuidv4(),
          transaction_id: journalTxn.id,
          account_id: cashAccount.id,
          amount: BigInt(proceedsCents),
          entry_type: 'D'
        }
      });
      await tx.chart_of_accounts.update({
        where: { id: cashAccount.id },
        data: { settled_balance: { increment: BigInt(proceedsCents) }, version: { increment: 1 } }
      });

      // CR Stock Position (cost basis removed)
      await tx.ledger_entries.create({
        data: {
          id: uuidv4(),
          transaction_id: journalTxn.id,
          account_id: stockAccount.id,
          amount: BigInt(costBasisCents),
          entry_type: 'C'
        }
      });
      await tx.chart_of_accounts.update({
        where: { id: stockAccount.id },
        data: { settled_balance: { increment: BigInt(-costBasisCents) }, version: { increment: 1 } }
      });

      // P&L entry (gain = credit T-4100, loss = debit T-5100)
      await tx.ledger_entries.create({
        data: {
          id: uuidv4(),
          transaction_id: journalTxn.id,
          account_id: plAccount.id,
          amount: BigInt(Math.abs(plCents)),
          entry_type: totalGainLoss >= 0 ? 'C' : 'D'
        }
      });
      const plBalanceChange = totalGainLoss >= 0 ? BigInt(Math.abs(plCents)) : BigInt(-Math.abs(plCents));
      await tx.chart_of_accounts.update({
        where: { id: plAccount.id },
        data: { settled_balance: { increment: plBalanceChange }, version: { increment: 1 } }
      });

      // Update sale investment transaction with tradeNum
      if (saleTxnId) {
        await tx.investment_transactions.update({
          where: { id: saleTxnId },
          data: {
            tradeNum,
            strategy: 'stock-long',
            accountCode: TRADING_CASH
          }
        });
      }

      return {
        scenarioId: scenario.id,
        tradeNum,
        journalId: journalTxn.id,
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

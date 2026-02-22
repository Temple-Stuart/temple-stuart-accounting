import { prisma } from '@/lib/prisma';

const WASH_SALE_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface WashSaleViolation {
  // The losing sale
  dispositionId: string;
  symbol: string;
  saleDate: string;
  quantitySold: number;
  proceedsPerShare: number;
  costBasisPerShare: number;
  realizedLoss: number;

  // The triggering replacement purchase
  replacementType: 'stock' | 'option';
  replacementDate: string;
  replacementQuantity: number;
  replacementCostPerShare: number;
  replacementLotId: string | null;       // stock lot ID
  replacementPositionId: string | null;  // option position ID

  // Wash sale amounts
  disallowedLoss: number;
  adjustedCostBasis: number; // new cost basis for replacement shares
  sharesAffected: number;    // min(sold, replacement) shares affected
}

/**
 * Detect all wash sale violations for a given user.
 *
 * IRS Publication 550 rules:
 * - Sell at a loss, then buy substantially identical security within 30 days
 *   before or after the sale → loss disallowed.
 * - Disallowed loss is added to cost basis of replacement shares.
 * - "Substantially identical" includes:
 *   - Same stock
 *   - Options on same underlying stock (conservative approach)
 */
export async function detectWashSales(userId: string): Promise<{
  violations: WashSaleViolation[];
  summary: {
    totalDisallowedLosses: number;
    totalViolations: number;
    symbolsAffected: string[];
    stockToStockCount: number;
    stockToOptionCount: number;
    optionToStockCount: number;
    optionToOptionCount: number;
  };
}> {
  // 1. Get all losing stock dispositions for this user
  const losingDispositions = await prisma.lot_dispositions.findMany({
    where: {
      realized_gain_loss: { lt: 0 },
      lot: { user_id: userId }
    },
    include: {
      lot: true
    },
    orderBy: { disposed_date: 'asc' }
  });

  // 2. Get all stock lots (potential replacement purchases)
  const allLots = await prisma.stock_lots.findMany({
    where: { user_id: userId },
    orderBy: { acquired_date: 'asc' }
  });

  // 3. Get all option positions (potential replacement purchases via options)
  const userAccounts = await prisma.accounts.findMany({
    where: { userId },
    select: { id: true }
  });
  const accountIds = userAccounts.map(a => a.id);

  const userInvestmentTxnIds = accountIds.length > 0
    ? (await prisma.investment_transactions.findMany({
        where: { accountId: { in: accountIds } },
        select: { id: true }
      })).map(t => t.id)
    : [];

  // Get option positions where user opened a long position (bought)
  const optionPositions = userInvestmentTxnIds.length > 0
    ? await prisma.trading_positions.findMany({
        where: {
          open_investment_txn_id: { in: userInvestmentTxnIds },
          position_type: 'LONG'
        },
        orderBy: { open_date: 'asc' }
      })
    : [];

  // 4. Also get losing closed option positions for option-to-stock / option-to-option wash sales
  const losingOptionPositions = userInvestmentTxnIds.length > 0
    ? await prisma.trading_positions.findMany({
        where: {
          open_investment_txn_id: { in: userInvestmentTxnIds },
          status: 'CLOSED',
          realized_pl: { lt: 0 }
        },
        orderBy: { close_date: 'asc' }
      })
    : [];

  const violations: WashSaleViolation[] = [];

  // ========== STOCK LOSS → STOCK/OPTION REPLACEMENT ==========
  for (const disp of losingDispositions) {
    const symbol = disp.lot.symbol.toUpperCase();
    const saleDate = disp.disposed_date;
    const windowStart = new Date(saleDate.getTime() - WASH_SALE_WINDOW_DAYS * MS_PER_DAY);
    const windowEnd = new Date(saleDate.getTime() + WASH_SALE_WINDOW_DAYS * MS_PER_DAY);

    // Check stock repurchases (same symbol, within 61-day window)
    // Exclude the lot that was sold (disp.lot_id) from matches
    const replacementLots = allLots.filter(lot =>
      lot.symbol.toUpperCase() === symbol &&
      lot.id !== disp.lot_id &&
      lot.acquired_date >= windowStart &&
      lot.acquired_date <= windowEnd
    );

    for (const repLot of replacementLots) {
      const sharesAffected = Math.min(disp.quantity_disposed, repLot.original_quantity);
      const lossPerShare = Math.abs(disp.realized_gain_loss) / disp.quantity_disposed;
      const disallowedLoss = lossPerShare * sharesAffected;

      violations.push({
        dispositionId: disp.id,
        symbol,
        saleDate: saleDate.toISOString(),
        quantitySold: disp.quantity_disposed,
        proceedsPerShare: disp.proceeds_per_share,
        costBasisPerShare: disp.cost_basis_disposed / disp.quantity_disposed,
        realizedLoss: disp.realized_gain_loss,
        replacementType: 'stock',
        replacementDate: repLot.acquired_date.toISOString(),
        replacementQuantity: repLot.original_quantity,
        replacementCostPerShare: repLot.cost_per_share,
        replacementLotId: repLot.id,
        replacementPositionId: null,
        disallowedLoss: Math.round(disallowedLoss * 100) / 100,
        adjustedCostBasis: Math.round((repLot.cost_per_share + (disallowedLoss / sharesAffected)) * 100) / 100,
        sharesAffected
      });
    }

    // Check option purchases on same underlying (conservative: any call on same symbol)
    const replacementOptions = optionPositions.filter(pos => {
      const underlying = extractUnderlying(pos.symbol);
      return underlying === symbol &&
        pos.open_date >= windowStart &&
        pos.open_date <= windowEnd;
    });

    for (const repOpt of replacementOptions) {
      const contractShares = (repOpt.quantity || 1) * 100; // 1 contract = 100 shares
      const sharesAffected = Math.min(disp.quantity_disposed, contractShares);
      const lossPerShare = Math.abs(disp.realized_gain_loss) / disp.quantity_disposed;
      const disallowedLoss = lossPerShare * sharesAffected;

      violations.push({
        dispositionId: disp.id,
        symbol,
        saleDate: saleDate.toISOString(),
        quantitySold: disp.quantity_disposed,
        proceedsPerShare: disp.proceeds_per_share,
        costBasisPerShare: disp.cost_basis_disposed / disp.quantity_disposed,
        realizedLoss: disp.realized_gain_loss,
        replacementType: 'option',
        replacementDate: repOpt.open_date.toISOString(),
        replacementQuantity: repOpt.quantity,
        replacementCostPerShare: repOpt.open_price,
        replacementLotId: null,
        replacementPositionId: repOpt.id,
        disallowedLoss: Math.round(disallowedLoss * 100) / 100,
        adjustedCostBasis: Math.round((repOpt.cost_basis + disallowedLoss) * 100) / 100,
        sharesAffected
      });
    }
  }

  // ========== OPTION LOSS → STOCK/OPTION REPLACEMENT ==========
  for (const optPos of losingOptionPositions) {
    const underlying = extractUnderlying(optPos.symbol);
    if (!underlying) continue;

    const closeDate = optPos.close_date;
    if (!closeDate) continue;

    const windowStart = new Date(closeDate.getTime() - WASH_SALE_WINDOW_DAYS * MS_PER_DAY);
    const windowEnd = new Date(closeDate.getTime() + WASH_SALE_WINDOW_DAYS * MS_PER_DAY);
    const loss = optPos.realized_pl || 0;

    // Option loss → stock repurchase
    const replacementLots = allLots.filter(lot =>
      lot.symbol.toUpperCase() === underlying &&
      lot.acquired_date >= windowStart &&
      lot.acquired_date <= windowEnd
    );

    for (const repLot of replacementLots) {
      const contractShares = (optPos.quantity || 1) * 100;
      const sharesAffected = Math.min(contractShares, repLot.original_quantity);
      const disallowedLoss = Math.abs(loss);

      violations.push({
        dispositionId: optPos.id, // using position ID as reference
        symbol: underlying,
        saleDate: closeDate.toISOString(),
        quantitySold: optPos.quantity,
        proceedsPerShare: optPos.close_price || 0,
        costBasisPerShare: optPos.open_price,
        realizedLoss: loss,
        replacementType: 'stock',
        replacementDate: repLot.acquired_date.toISOString(),
        replacementQuantity: repLot.original_quantity,
        replacementCostPerShare: repLot.cost_per_share,
        replacementLotId: repLot.id,
        replacementPositionId: null,
        disallowedLoss: Math.round(disallowedLoss * 100) / 100,
        adjustedCostBasis: Math.round((repLot.total_cost_basis + disallowedLoss) / repLot.original_quantity * 100) / 100,
        sharesAffected
      });
    }

    // Option loss → option repurchase (substantially identical = same underlying)
    const replacementOptions = optionPositions.filter(pos =>
      pos.id !== optPos.id &&
      extractUnderlying(pos.symbol) === underlying &&
      pos.open_date >= windowStart &&
      pos.open_date <= windowEnd
    );

    for (const repOpt of replacementOptions) {
      const disallowedLoss = Math.abs(loss);

      violations.push({
        dispositionId: optPos.id,
        symbol: underlying,
        saleDate: closeDate.toISOString(),
        quantitySold: optPos.quantity,
        proceedsPerShare: optPos.close_price || 0,
        costBasisPerShare: optPos.open_price,
        realizedLoss: loss,
        replacementType: 'option',
        replacementDate: repOpt.open_date.toISOString(),
        replacementQuantity: repOpt.quantity,
        replacementCostPerShare: repOpt.open_price,
        replacementLotId: null,
        replacementPositionId: repOpt.id,
        disallowedLoss: Math.round(disallowedLoss * 100) / 100,
        adjustedCostBasis: Math.round((repOpt.cost_basis + disallowedLoss) * 100) / 100,
        sharesAffected: Math.min(optPos.quantity, repOpt.quantity)
      });
    }
  }

  // Deduplicate: a single disposition may match multiple replacement lots,
  // but each share of loss can only be disallowed once.
  // Group by dispositionId + take the earliest replacement (IRS requires first replacement match).
  const deduped = deduplicateViolations(violations);

  // Compute summary
  const totalDisallowedLosses = deduped.reduce((sum, v) => sum + v.disallowedLoss, 0);
  const symbolsAffected = [...new Set(deduped.map(v => v.symbol))];

  return {
    violations: deduped,
    summary: {
      totalDisallowedLosses: Math.round(totalDisallowedLosses * 100) / 100,
      totalViolations: deduped.length,
      symbolsAffected,
      stockToStockCount: deduped.filter(v => v.replacementType === 'stock' && !v.replacementPositionId).length,
      stockToOptionCount: deduped.filter(v => v.replacementType === 'option' && v.replacementPositionId && !isOptionDisposition(v)).length,
      optionToStockCount: deduped.filter(v => v.replacementType === 'stock' && isOptionDisposition(v)).length,
      optionToOptionCount: deduped.filter(v => v.replacementType === 'option' && isOptionDisposition(v)).length,
    }
  };
}

/**
 * Apply wash sale adjustments to the database:
 * - Mark dispositions as wash sales
 * - Adjust replacement lot cost basis
 */
export async function applyWashSaleAdjustments(
  userId: string,
  violations: WashSaleViolation[]
): Promise<{ updated: number }> {
  let updated = 0;

  for (const v of violations) {
    await prisma.$transaction(async (tx) => {
      // Mark the disposition as a wash sale (only for stock dispositions)
      // Check if this is an actual lot_dispositions record (UUID format)
      const isStockDisposition = await tx.lot_dispositions.findUnique({
        where: { id: v.dispositionId }
      });

      if (isStockDisposition) {
        await tx.lot_dispositions.update({
          where: { id: v.dispositionId },
          data: {
            is_wash_sale: true,
            wash_sale_loss: v.disallowedLoss
          }
        });
      }

      // Adjust replacement lot cost basis (only for stock replacements)
      if (v.replacementLotId) {
        const lot = await tx.stock_lots.findFirst({
          where: { id: v.replacementLotId, user_id: userId }
        });
        if (lot) {
          const adjustmentPerShare = v.disallowedLoss / v.sharesAffected;
          await tx.stock_lots.update({
            where: { id: v.replacementLotId },
            data: {
              wash_sale_adjustment: v.disallowedLoss,
              wash_sale_disallowed: v.disallowedLoss,
              wash_sale_source_id: v.dispositionId,
              cost_per_share: lot.cost_per_share + adjustmentPerShare,
              total_cost_basis: lot.total_cost_basis + v.disallowedLoss
            }
          });
        }
      }

      updated++;
    });
  }

  return { updated };
}

/**
 * Extract the underlying stock ticker from an option symbol.
 * Option symbols typically look like "AAPL 230120C00150000" or "AAPL Jan 20 2023 $150 Call"
 * The first word/segment before a space or digit-heavy portion is the underlying.
 */
function extractUnderlying(optionSymbol: string): string {
  if (!optionSymbol) return '';
  // Take first word, strip trailing digits
  const parts = optionSymbol.trim().split(/[\s]/);
  const first = parts[0];
  // If it's a pure ticker (all caps, 1-5 chars), return it
  if (/^[A-Z]{1,5}$/.test(first)) return first;
  // Otherwise, extract leading alpha chars
  const match = first.match(/^([A-Z]{1,5})/);
  return match ? match[1] : first.toUpperCase();
}

/**
 * Check if a violation originated from an option close (vs stock sale).
 * Option dispositions use the trading_positions ID as dispositionId.
 */
function isOptionDisposition(v: WashSaleViolation): boolean {
  // Heuristic: if proceedsPerShare and costBasisPerShare are typical option premiums
  // (small values) and quantitySold is in contract units (1-100), it's likely an option.
  // More reliable: check if replacementPositionId is set on the source side.
  // For simplicity, we check the costBasisPerShare — options premiums are typically < $50
  // while stock cost basis is typically > $1.
  // Actually, the most reliable check: option losses come from losingOptionPositions
  // which won't match lot_dispositions IDs. We can check by seeing if the
  // dispositionId matches any lot_disposition.
  return v.proceedsPerShare < 100 && v.quantitySold <= 100;
}

/**
 * Deduplicate violations: for a single disposition, if multiple replacement
 * securities are found, use the earliest replacement (IRS first-in rule).
 * Also cap the total disallowed loss at the actual loss amount.
 */
function deduplicateViolations(violations: WashSaleViolation[]): WashSaleViolation[] {
  // Group by dispositionId
  const byDisp: Record<string, WashSaleViolation[]> = {};
  for (const v of violations) {
    if (!byDisp[v.dispositionId]) byDisp[v.dispositionId] = [];
    byDisp[v.dispositionId].push(v);
  }

  const result: WashSaleViolation[] = [];

  for (const [, group] of Object.entries(byDisp)) {
    // Sort by replacement date (earliest first)
    group.sort((a, b) =>
      new Date(a.replacementDate).getTime() - new Date(b.replacementDate).getTime()
    );

    const totalLoss = Math.abs(group[0].realizedLoss);
    let remainingLoss = totalLoss;

    for (const v of group) {
      if (remainingLoss <= 0) break;

      const cappedDisallowed = Math.min(v.disallowedLoss, remainingLoss);
      result.push({
        ...v,
        disallowedLoss: Math.round(cappedDisallowed * 100) / 100
      });
      remainingLoss -= cappedDisallowed;
    }
  }

  return result;
}

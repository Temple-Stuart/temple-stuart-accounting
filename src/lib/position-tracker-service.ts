import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

interface InvestmentLeg {
  id: string;
  date: Date;
  symbol: string;
  strike: number | null;
  expiry: Date | null;
  contractType: 'call' | 'put' | null;
  action: 'buy' | 'sell';
  positionEffect: 'open' | 'close';
  quantity: number;
  price: number;
  fees: number;
  amount: number;
  name?: string;
  subtype?: string;
  txnType?: string;
}

type TransactionContext = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class PositionTrackerService {
  async commitOptionsTrade(params: {
    legs: InvestmentLeg[];
    strategy: string;
    tradeNum: string;
    userId: string;
    entityId: string;
    tx?: TransactionContext;
    createdBy?: string;
  }) {
    const { legs, strategy, tradeNum, userId, entityId, tx, createdBy } = params;
    const db = tx || prisma;
    const results = [];
    const skipped = [];

    console.log(`[Commit] Processing ${legs.length} legs for Trade #${tradeNum}`);

    // CRITICAL: Process ALL opens first to ensure positions exist in DB
    for (const leg of legs) {
      if (leg.positionEffect === 'open') {
        console.log(`  [OPEN] ${leg.symbol} $${leg.strike} ${leg.contractType} ${leg.expiry?.toLocaleDateString()}`);
        const result = await this.openPosition(leg, strategy, tradeNum, userId, entityId, db, createdBy);
        results.push(result);
      }
    }

    // Detect if close legs form an exercise/assignment/expiration pattern
    // requiring atomic spread close processing (single journal entry for all legs)
    const closeLegs = legs.filter(l => l.positionEffect === 'close');
    const hasAtomicClosePattern = closeLegs.length > 0 && closeLegs.some(leg => {
      const name = (leg.name || '').toLowerCase();
      return name.includes('exercise') || name.includes('assignment') ||
             name.includes('expiration') || leg.txnType === 'transfer';
    });

    if (hasAtomicClosePattern) {
      // Exercise/assignment/expiration: process ALL close legs as ONE atomic journal entry.
      // This handles spread closes where multiple positions close together via stock
      // settlement, and expirations where positions expire worthless.
      console.log(`  [ATOMIC CLOSE] ${closeLegs.length} legs for Trade #${tradeNum}`);
      const spreadResult = await this.closeSpreadAtomically(closeLegs, strategy, tradeNum, userId, entityId, db, createdBy);
      results.push(...spreadResult.results);
      skipped.push(...spreadResult.skipped);
    } else {
      // Normal close: process each close leg individually (buy-to-close / sell-to-close)
      for (const leg of legs) {
        if (leg.positionEffect === 'close') {
          const openPosition = await db.trading_positions.findFirst({
            where: {
              symbol: leg.symbol,
              strike_price: leg.strike,
              option_type: leg.contractType?.toUpperCase(),
              expiration_date: leg.expiry,
              status: 'OPEN'
            }
          });

          if (!openPosition) {
            console.warn(`  [SKIP CLOSE] No open position for ${leg.symbol} $${leg.strike} ${leg.contractType} ${leg.expiry?.toLocaleDateString()}`);
            skipped.push({
              legId: leg.id,
              reason: 'NO_OPEN_POSITION',
              symbol: leg.symbol,
              strike: leg.strike,
              contractType: leg.contractType,
              expiry: leg.expiry?.toLocaleDateString()
            });
            continue;
          }

          console.log(`  [CLOSE] ${leg.symbol} $${leg.strike} ${leg.contractType} ${leg.expiry?.toLocaleDateString()}`);
          const result = await this.closePosition(
            leg,
            strategy,
            tradeNum,
            userId,
            entityId,
            db,
            createdBy
          );
          results.push(result);
        }
      }
    }

    // Update investment_transactions table with COA codes
    for (const leg of legs) {
      const result = results.find(r => r.legId === leg.id);
      if (result && !('skipped' in result)) {
        await db.investment_transactions.update({
          where: { id: leg.id },
          data: { strategy, tradeNum, accountCode: result.coaCode }
        });
      } else if (result && 'skipped' in result) {
        // Still mark skipped legs with trade number for tracking
        await db.investment_transactions.update({
          where: { id: leg.id },
          data: { strategy, tradeNum }
        });
      }
    }

    console.log(`[Commit] SUCCESS: ${results.length} committed, ${skipped.length} skipped`);

    return { success: true, results, skipped };
  }

  private async openPosition(
    leg: InvestmentLeg,
    strategy: string,
    tradeNum: string,
    userId: string,
    entityId: string,
    db: TransactionContext,
    createdBy?: string
  ) {
    const TRADING_CASH = 'T-1010';
    const multiplier = 100;
    let costBasis: number;
    if (leg.action === 'buy') {
      costBasis = Math.round((leg.price * leg.quantity * multiplier + leg.fees) * 100);
    } else {
      costBasis = Math.round((leg.price * leg.quantity * multiplier - leg.fees) * 100);
    }
    let positionAccount: string;
    const positionType = leg.action === 'buy' ? 'LONG' : 'SHORT';
    if (leg.action === 'buy') {
      positionAccount = leg.contractType === 'call' ? 'T-1200' : 'T-1210';
    } else {
      positionAccount = leg.contractType === 'call' ? 'T-2100' : 'T-2110';
    }
    const lines: Array<{ accountCode: string; amount: number; entryType: 'D' | 'C' }> = [];
    if (leg.action === 'buy') {
      lines.push({ accountCode: positionAccount, amount: costBasis, entryType: 'D' });
      lines.push({ accountCode: TRADING_CASH, amount: costBasis, entryType: 'C' });
    } else {
      lines.push({ accountCode: TRADING_CASH, amount: costBasis, entryType: 'D' });
      lines.push({ accountCode: positionAccount, amount: costBasis, entryType: 'C' });
    }
    const journalEntry = await this.createJournalEntry({
      date: leg.date,
      description: `OPEN ${positionType}: ${leg.symbol} ${leg.strike} ${leg.contractType?.toUpperCase()} ${leg.expiry?.toLocaleDateString()}`,
      lines, externalTransactionId: leg.id, strategy, tradeNum, amount: costBasis,
      userId, entityId, db, createdBy
    });
    await db.trading_positions.create({
      data: {
        open_investment_txn_id: leg.id, symbol: leg.symbol, option_type: leg.contractType?.toUpperCase() as string,
        strike_price: leg.strike, expiration_date: leg.expiry, position_type: positionType, quantity: leg.quantity, remaining_quantity: leg.quantity,
        open_price: leg.price, open_fees: leg.fees, open_date: leg.date, cost_basis: costBasis / 100,
        status: 'OPEN', trade_num: tradeNum, strategy: strategy
      }
    });
    return { legId: leg.id, journalId: journalEntry.id, coaCode: positionAccount, costBasis, action: 'OPEN' };
  }

  private async closePosition(
    leg: InvestmentLeg & { matchedPosition?: any },
    strategy: string,
    tradeNum: string,
    userId: string,
    entityId: string,
    db: TransactionContext,
    createdBy?: string
  ) {
    const TRADING_CASH = 'T-1010';

    // Use pre-matched position (for exercise/assignment) or lookup by option details
    let openPosition = leg.matchedPosition;

    if (!openPosition) {
      // Find position with remaining quantity > 0
      openPosition = await db.trading_positions.findFirst({
        where: {
          symbol: leg.symbol,
          strike_price: leg.strike,
          option_type: leg.contractType?.toUpperCase(),
          expiration_date: leg.expiry,
          remaining_quantity: { gt: 0 }
        },
        orderBy: { open_date: 'asc' }
      });
    }

    if (!openPosition) throw new Error(`No open position found for ${leg.symbol} ${leg.strike} ${leg.contractType} ${leg.expiry?.toLocaleDateString()}`);


    // Check if this is an exercise/assignment FIRST (stock transaction closing an option)
    const legName = (leg as any).name?.toLowerCase() || '';
    const isExerciseOrAssignment = legName.includes('exercise') || legName.includes('assignment');

    // Calculate close quantity and proportional values
    const closeQty = leg.quantity;
    const positionQty = openPosition.quantity;
    const remainingQty = openPosition.remaining_quantity ?? positionQty;

    // Skip quantity validation for exercise/assignment (qty is shares, not contracts)
    if (!isExerciseOrAssignment && closeQty > remainingQty) {
      throw new Error(`Cannot close ${closeQty} contracts - only ${remainingQty} remaining`);
    }

    // For normal closes, use leg qty; for exercise/assignment, close full position
    const effectiveCloseQty = isExerciseOrAssignment ? remainingQty : closeQty;

    // Proportional cost basis for partial close
    const proportionalCostBasis = (effectiveCloseQty / positionQty) * openPosition.cost_basis;
    const originalCost = Math.round(proportionalCostBasis * 100);

    // Calculate new remaining quantity
    const newRemainingQty = remainingQty - effectiveCloseQty;
    const isFullClose = newRemainingQty <= 0;
    let proceeds: number;
    let realizedPL: number;

    if (isExerciseOrAssignment) {
      // For exercise/assignment, skip journal entry creation entirely.
      // P&L is calculated at the trade level from transaction amounts.

      // Update position (partial or full close)
      await db.trading_positions.update({
        where: { id: openPosition.id },
        data: {
          remaining_quantity: Math.max(0, newRemainingQty),
          status: isFullClose ? 'CLOSED' : 'OPEN',
          close_investment_txn_id: isFullClose ? leg.id : openPosition.close_investment_txn_id,
          close_price: isFullClose ? leg.price : openPosition.close_price,
          close_fees: (openPosition.close_fees || 0) + (leg.fees || 0),
          close_date: isFullClose ? leg.date : openPosition.close_date,
          proceeds: (openPosition.proceeds || 0) + leg.amount,
          realized_pl: 0 // Will be calculated at trade level
        }
      });

      return {
        legId: leg.id,
        journalId: null,
        coaCode: null,
        realizedPL: 0,
        proceeds: Math.round(leg.amount * 100),
        originalCost,
        action: isFullClose ? 'CLOSE_EXERCISE' : 'PARTIAL_CLOSE_EXERCISE'
      };
    } else {
      // Normal option close: calculate from price * quantity * multiplier
      const multiplier = 100;
      if (leg.action === 'sell') {
        proceeds = Math.round((leg.price * closeQty * multiplier - leg.fees) * 100);
      } else {
        proceeds = Math.round((leg.price * closeQty * multiplier + leg.fees) * 100);
      }

      if (openPosition.position_type === 'LONG') {
        realizedPL = proceeds - originalCost;
      } else {
        realizedPL = originalCost - proceeds;
      }
    }
    const isGain = realizedPL > 0;
    const plAccount = isGain ? 'T-4100' : 'T-5100';
    const positionAccount = openPosition.position_type === 'LONG'
      ? (openPosition.option_type === 'CALL' ? 'T-1200' : 'T-1210')
      : (openPosition.option_type === 'CALL' ? 'T-2100' : 'T-2110');
    const lines: Array<{ accountCode: string; amount: number; entryType: 'D' | 'C' }> = [];
    if (openPosition.position_type === 'LONG') {
      lines.push({ accountCode: TRADING_CASH, amount: proceeds, entryType: 'D' });
      lines.push({ accountCode: positionAccount, amount: originalCost, entryType: 'C' });
      if (isGain) { lines.push({ accountCode: plAccount, amount: Math.abs(realizedPL), entryType: 'C' }); }
      else { lines.push({ accountCode: plAccount, amount: Math.abs(realizedPL), entryType: 'D' }); }
    } else {
      lines.push({ accountCode: positionAccount, amount: originalCost, entryType: 'D' });
      lines.push({ accountCode: TRADING_CASH, amount: proceeds, entryType: 'C' });
      if (isGain) { lines.push({ accountCode: plAccount, amount: Math.abs(realizedPL), entryType: 'C' }); }
      else { lines.push({ accountCode: plAccount, amount: Math.abs(realizedPL), entryType: 'D' }); }
    }
    const journalEntry = await this.createJournalEntry({
      date: leg.date,
      description: `${isFullClose ? 'CLOSE' : 'PARTIAL CLOSE'} ${openPosition.position_type}: ${closeQty}x ${leg.symbol} ${leg.strike} ${leg.contractType?.toUpperCase()} - ${isGain ? 'GAIN' : 'LOSS'} $${(Math.abs(realizedPL) / 100).toFixed(2)}`,
      lines, externalTransactionId: leg.id, strategy, tradeNum, amount: proceeds,
      userId, entityId, db, createdBy
    });

    // Update position with new remaining quantity
    await db.trading_positions.update({
      where: { id: openPosition.id },
      data: {
        remaining_quantity: Math.max(0, newRemainingQty),
        status: isFullClose ? 'CLOSED' : 'OPEN',
        close_investment_txn_id: isFullClose ? leg.id : openPosition.close_investment_txn_id,
        close_price: isFullClose ? leg.price : openPosition.close_price,
        close_fees: (openPosition.close_fees || 0) + (leg.fees || 0),
        close_date: isFullClose ? leg.date : openPosition.close_date,
        proceeds: ((openPosition.proceeds || 0) * 100 + proceeds) / 100,
        realized_pl: ((openPosition.realized_pl || 0) * 100 + realizedPL) / 100
      }
    });
    return { legId: leg.id, journalId: journalEntry.id, coaCode: plAccount, realizedPL, proceeds, originalCost, action: isFullClose ? 'CLOSE' : 'PARTIAL_CLOSE' };
  }

  /**
   * Atomic spread close for exercise/assignment/expiration.
   *
   * Creates ONE balanced journal entry that:
   * 1. Closes all open positions (DR short accounts, CR long accounts) at original cost basis
   * 2. Records net stock settlement cash (if exercise/assignment with stock buy+sell)
   * 3. Calculates P&L as the balancing entry (CR 4100 for gain, DR 5100 for loss)
   *
   * Stock settlement lines do NOT create stock_lots — they represent instantaneous
   * settlement (buy shares due to exercise + sell shares due to assignment), not held positions.
   *
   * ═══════════════════════════════════════════════════════════════════════════════
   * VERIFICATION — SPY $535/$540 credit spread, exercise/assignment close:
   *
   * Opens (previously committed):
   *   Sell $535 Call: DR 1010 $117,700  CR 2100 $117,700 (short call, cost_basis=$1,177)
   *   Buy  $540 Call: DR 1200  $77,400  CR 1010  $77,400 (long call, cost_basis=$774)
   *   Net premium received = $117,700 - $77,400 = $40,300 ($403.00)
   *
   * Close legs (4 transactions):
   *   1. "Assignment SPY 535 Call" — $0 transfer (closes short)
   *   2. "Exercise SPY 540 Call"  — $0 transfer (closes long)
   *   3. "Sell 100 SPY due to assignment" — amount=+$53,500
   *   4. "Buy 100 SPY due to exercise"   — amount=-$54,000
   *
   * Atomic journal entry (all amounts in cents):
   *   DR 2100 (Short Call)  117,700   — close short position at original cost
   *   CR 1200 (Long Call)    77,400   — close long position at original cost
   *   CR 1010 (Cash)         50,000   — net stock settlement: ($53,500-$54,000)=-$500
   *   DR 5100 (Loss)          9,700   — P&L: $40,300 premium + (-$50,000 settlement) = -$9,700
   *   ─────────────────────────────
   *   Total DR: 127,400  Total CR: 127,400  ✓ Balanced
   *   Realized P&L: -$97.00 (loss)
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  private async closeSpreadAtomically(
    closeLegs: InvestmentLeg[],
    strategy: string,
    tradeNum: string,
    userId: string,
    entityId: string,
    db: TransactionContext,
    createdBy?: string
  ): Promise<{ results: any[]; skipped: any[] }> {
    const TRADING_CASH = 'T-1010';
    const results: any[] = [];
    const skipped: any[] = [];

    // Classify legs into option transfers ($0) vs stock settlement (has amount)
    const optionTransferLegs: InvestmentLeg[] = [];
    const stockSettlementLegs: InvestmentLeg[] = [];

    for (const leg of closeLegs) {
      const name = (leg.name || '').toLowerCase();
      const isTransferType = name.includes('exercise') || name.includes('assignment') || name.includes('expiration');

      if (isTransferType && (leg.amount === 0 || leg.price === 0)) {
        optionTransferLegs.push(leg);
      } else {
        stockSettlementLegs.push(leg);
      }
    }

    console.log(`  [ATOMIC] ${optionTransferLegs.length} transfer legs, ${stockSettlementLegs.length} settlement legs`);

    // Find ALL open positions for this trade number
    const openPositions = await db.trading_positions.findMany({
      where: { trade_num: tradeNum, status: 'OPEN' }
    });

    if (openPositions.length === 0) {
      console.warn(`  [ATOMIC] No open positions found for trade #${tradeNum}`);
      for (const leg of closeLegs) {
        skipped.push({ legId: leg.id, reason: 'NO_OPEN_POSITIONS_FOR_TRADE', symbol: leg.symbol });
      }
      return { results, skipped };
    }

    console.log(`  [ATOMIC] Found ${openPositions.length} open positions to close`);

    // Build journal entry lines
    const lines: Array<{ accountCode: string; amount: number; entryType: 'D' | 'C' }> = [];

    // 1. Close each open position at its proportional remaining cost basis
    const positionAccountMap: Record<string, string> = {};
    for (const pos of openPositions) {
      // Proportional cost basis for remaining quantity (handles partial prior closes)
      const costBasisCents = Math.round(
        ((pos.remaining_quantity ?? pos.quantity) / pos.quantity) * pos.cost_basis * 100
      );
      const positionAccount = pos.position_type === 'LONG'
        ? (pos.option_type === 'CALL' ? 'T-1200' : 'T-1210')
        : (pos.option_type === 'CALL' ? 'T-2100' : 'T-2110');
      positionAccountMap[pos.id] = positionAccount;

      if (pos.position_type === 'SHORT') {
        // Close short: DR to remove liability
        lines.push({ accountCode: positionAccount, amount: costBasisCents, entryType: 'D' });
      } else {
        // Close long: CR to remove asset
        lines.push({ accountCode: positionAccount, amount: costBasisCents, entryType: 'C' });
      }
    }

    // 2. Net stock settlement (buy + sell amounts from exercise/assignment)
    // DB stores all amounts as positive. Determine direction from transaction name:
    //   "sell ... due to assignment" → cash inflow (positive)
    //   "buy ... due to exercise"   → cash outflow (negative)
    const netSettlementDollars = stockSettlementLegs.reduce((sum, leg) => {
      const name = (leg.name || '').toLowerCase();
      const isCashInflow = name.includes('sell') && name.includes('assignment');
      const isCashOutflow = name.includes('buy') && name.includes('exercise');
      const signedAmount = isCashOutflow ? -Math.abs(leg.amount || 0)
                         : isCashInflow  ?  Math.abs(leg.amount || 0)
                         : (leg.amount || 0); // fallback: trust raw amount
      return sum + signedAmount;
    }, 0);
    const netSettlementCents = Math.round(netSettlementDollars * 100);

    if (netSettlementCents > 0) {
      // Cash received from settlement: DR cash
      lines.push({ accountCode: TRADING_CASH, amount: netSettlementCents, entryType: 'D' });
    } else if (netSettlementCents < 0) {
      // Cash paid for settlement: CR cash
      lines.push({ accountCode: TRADING_CASH, amount: Math.abs(netSettlementCents), entryType: 'C' });
    }

    // 3. Calculate P&L as the balancing entry
    const totalDebits = lines.filter(l => l.entryType === 'D').reduce((sum, l) => sum + l.amount, 0);
    const totalCredits = lines.filter(l => l.entryType === 'C').reduce((sum, l) => sum + l.amount, 0);
    const imbalance = totalDebits - totalCredits;
    // imbalance > 0 → excess debits → GAIN (need credit to balance)
    // imbalance < 0 → excess credits → LOSS (need debit to balance)

    if (imbalance > 0) {
      lines.push({ accountCode: 'T-4100', amount: imbalance, entryType: 'C' });
    } else if (imbalance < 0) {
      lines.push({ accountCode: 'T-5100', amount: Math.abs(imbalance), entryType: 'D' });
    }

    const realizedPLCents = imbalance; // positive = gain, negative = loss
    const isGain = realizedPLCents >= 0;
    const plAccount = realizedPLCents > 0 ? 'T-4100' : (realizedPLCents < 0 ? 'T-5100' : null);
    const hasExpiration = closeLegs.some(l => (l.name || '').toLowerCase().includes('expiration'));
    const closeType = hasExpiration ? 'EXPIRATION' : 'EXERCISE/ASSIGNMENT';
    const symbol = openPositions[0].symbol;

    const description = `SPREAD CLOSE (${closeType}): Trade #${tradeNum} ${symbol} - ${isGain ? 'GAIN' : 'LOSS'} $${(Math.abs(realizedPLCents) / 100).toFixed(2)}`;

    // Create ONE atomic journal entry
    const journalEntry = await this.createJournalEntry({
      date: closeLegs[0].date,
      description,
      lines,
      externalTransactionId: closeLegs[0].id,
      strategy,
      tradeNum,
      amount: Math.abs(realizedPLCents),
      userId,
      entityId,
      db,
      createdBy
    });

    console.log(`  [ATOMIC] Journal entry ${journalEntry.id}: ${description}`);

    // Distribute total trade P&L across positions proportional to cost basis weight.
    // For exercise/assignment, stock settlement is a spread-level event — it doesn't
    // decompose to individual option legs. We allocate P&L by each leg's share of
    // total cost basis and derive implied proceeds from cost + allocated P&L.
    let totalCostBasisCents = 0;
    for (const pos of openPositions) {
      totalCostBasisCents += Math.round(
        ((pos.remaining_quantity ?? pos.quantity) / pos.quantity) * pos.cost_basis * 100
      );
    }

    // Update all open positions to CLOSED with per-position proceeds and P&L
    let allocatedPLCents = 0;
    for (let i = 0; i < openPositions.length; i++) {
      const pos = openPositions[i];

      // Try to match a transfer leg to this position by strike + option type
      const matchingTransfer = optionTransferLegs.find(leg => {
        const name = (leg.name || '').toLowerCase();
        const strikeStr = pos.strike_price?.toString() || '';
        return strikeStr && name.includes(strikeStr) &&
               name.includes((pos.option_type || '').toLowerCase());
      });

      const costBasisCents = Math.round(
        ((pos.remaining_quantity ?? pos.quantity) / pos.quantity) * pos.cost_basis * 100
      );

      // Allocate P&L proportionally; last position gets remainder to avoid rounding drift
      let perPositionPL: number;
      if (i === openPositions.length - 1) {
        perPositionPL = realizedPLCents - allocatedPLCents;
      } else {
        perPositionPL = totalCostBasisCents > 0
          ? Math.round(realizedPLCents * (costBasisCents / totalCostBasisCents))
          : 0;
        allocatedPLCents += perPositionPL;
      }

      // Derive implied proceeds: for LONG, proceeds = cost + P&L; for SHORT, proceeds = cost - P&L
      const proceedsCents = pos.position_type === 'LONG'
        ? costBasisCents + perPositionPL
        : costBasisCents - perPositionPL;

      await db.trading_positions.update({
        where: { id: pos.id },
        data: {
          remaining_quantity: 0,
          status: 'CLOSED',
          close_investment_txn_id: matchingTransfer?.id || closeLegs[0].id,
          close_date: closeLegs[0].date,
          close_price: 0,
          close_fees: 0,
          proceeds: proceedsCents / 100,
          realized_pl: perPositionPL / 100
        }
      });
    }

    // Build results for each close leg
    for (const leg of optionTransferLegs) {
      // Find which position this transfer closes
      const matchedPos = openPositions.find(pos => {
        const name = (leg.name || '').toLowerCase();
        const strikeStr = pos.strike_price?.toString() || '';
        return strikeStr && name.includes(strikeStr) &&
               name.includes((pos.option_type || '').toLowerCase());
      });
      const coaCode = matchedPos ? positionAccountMap[matchedPos.id] : (plAccount || TRADING_CASH);

      results.push({
        legId: leg.id,
        journalId: journalEntry.id,
        coaCode,
        realizedPL: realizedPLCents,
        action: 'SPREAD_CLOSE'
      });
    }

    for (const leg of stockSettlementLegs) {
      results.push({
        legId: leg.id,
        journalId: journalEntry.id,
        coaCode: TRADING_CASH,
        realizedPL: 0,
        action: 'SPREAD_CLOSE_SETTLEMENT'
      });
    }

    return { results, skipped };
  }

  private async createJournalEntry(params: {
    date: Date; description: string;
    lines: Array<{ accountCode: string; amount: number; entryType: 'D' | 'C' }>;
    externalTransactionId?: string; strategy?: string; tradeNum?: string; amount?: number;
    userId: string; entityId: string; db: TransactionContext; requestId?: string; createdBy?: string;
  }) {
    const { date, description, lines, externalTransactionId, strategy, tradeNum, userId, entityId, db, requestId, createdBy } = params;
    const debits = lines.filter(l => l.entryType === 'D').reduce((sum, l) => sum + l.amount, 0);
    const credits = lines.filter(l => l.entryType === 'C').reduce((sum, l) => sum + l.amount, 0);
    if (debits !== credits) throw new Error(`Unbalanced entry: debits=${debits} credits=${credits}`);
    const accountCodes = lines.map(l => l.accountCode);
    const uniqueAccountCodes = [...new Set(accountCodes)];
    // SECURITY: Scope account lookup to user's accounts within the entity
    const accounts = await db.chart_of_accounts.findMany({ where: { code: { in: uniqueAccountCodes }, userId, entity_id: entityId } });
    if (accounts.length !== uniqueAccountCodes.length) {
      const missing = uniqueAccountCodes.filter(code => !accounts.find(a => a.code === code));
      throw new Error(`Account codes not found: ${missing.join(', ')}`);
    }

    // Create journal entry
    const journalEntry = await db.journal_entries.create({
      data: {
        userId,
        entity_id: entityId,
        date,
        description,
        source_type: 'investment_txn',
        source_id: externalTransactionId || null,
        status: 'posted',
        metadata: (strategy || tradeNum) ? { strategy, trade_num: tradeNum } : undefined,
        request_id: requestId || randomUUID(),
        created_by: createdBy || null,
      }
    });

    // Create ledger entries and update account balances
    for (const line of lines) {
      const account = accounts.find(a => a.code === line.accountCode)!;
      await db.ledger_entries.create({
        data: {
          journal_entry_id: journalEntry.id,
          account_id: account.id,
          amount: BigInt(line.amount),
          entry_type: line.entryType,
          created_by: createdBy || null,
        }
      });
      const balanceChange = line.entryType === account.balance_type ? BigInt(line.amount) : BigInt(-line.amount);
      await db.chart_of_accounts.update({
        where: { id: account.id },
        data: {
          settled_balance: { increment: balanceChange },
          version: { increment: 1 }
        }
      });
    }

    return journalEntry;
  }

  async handleAssignmentExercise(params: {
    exerciseTransfer: any; stockTransaction: any; strategy: string; tradeNum: string; userId: string; entityId: string; createdBy?: string;
  }) {
    const { exerciseTransfer, stockTransaction, strategy, tradeNum, userId, entityId, createdBy } = params;
    const nameMatch = exerciseTransfer.name.match(/(\d+\.?\d*)\s*call|put/i);
    const strike = nameMatch ? parseFloat(nameMatch[1]) : null;
    if (!strike) throw new Error(`Cannot extract strike from: ${exerciseTransfer.name}`);
    const isExercise = exerciseTransfer.subtype === 'exercise';
    const symbol = stockTransaction.security?.ticker_symbol || 'UNKNOWN';
    const openPosition = await prisma.trading_positions.findFirst({
      where: { symbol, strike_price: strike, status: 'OPEN', position_type: isExercise ? 'LONG' : 'SHORT' },
      orderBy: { open_date: 'asc' }
    });
    if (!openPosition) throw new Error(`No open ${isExercise ? 'LONG' : 'SHORT'} position found for ${symbol} $${strike}`);
    const originalCost = Math.round(openPosition.cost_basis * 100);
    const realizedPL = isExercise ? -originalCost : originalCost;
    const isGain = realizedPL > 0;
    const plAccount = isGain ? 'T-4100' : 'T-5100';
    const positionAccount = openPosition.position_type === 'LONG'
      ? (openPosition.option_type === 'CALL' ? 'T-1200' : 'T-1210')
      : (openPosition.option_type === 'CALL' ? 'T-2100' : 'T-2110');
    const lines: Array<{ accountCode: string; amount: number; entryType: 'D' | 'C' }> = [];
    if (isExercise) {
      lines.push({ accountCode: positionAccount, amount: originalCost, entryType: 'C' });
      lines.push({ accountCode: plAccount, amount: originalCost, entryType: 'D' });
    } else {
      lines.push({ accountCode: positionAccount, amount: originalCost, entryType: 'D' });
      lines.push({ accountCode: plAccount, amount: originalCost, entryType: 'C' });
    }
    const journalEntry = await this.createJournalEntry({
      date: exerciseTransfer.date,
      description: `${isExercise ? 'EXERCISE' : 'ASSIGNMENT'}: ${symbol} $${strike} ${openPosition.option_type}`,
      lines, externalTransactionId: exerciseTransfer.id, strategy, tradeNum, amount: originalCost,
      userId, entityId, db: prisma, createdBy
    });
    await prisma.trading_positions.update({
      where: { id: openPosition.id },
      data: { status: 'CLOSED', close_investment_txn_id: exerciseTransfer.id,
        close_date: exerciseTransfer.date, realized_pl: realizedPL / 100 }
    });
    await prisma.investment_transactions.update({
      where: { id: exerciseTransfer.id }, data: { strategy, tradeNum, accountCode: plAccount }
    });
    await prisma.investment_transactions.update({
      where: { id: stockTransaction.id }, data: { strategy, tradeNum, accountCode: 'T-1100' }
    });
    return { type: isExercise ? 'EXERCISE' : 'ASSIGNMENT', symbol, strike, journalId: journalEntry.id, realizedPL };
  }

  // Commit stock purchases as lots with journal entries
  async commitStockTrade(params: {
    legs: Array<{
      id: string;
      date: Date;
      symbol: string;
      action: 'buy' | 'sell';
      quantity: number;
      price: number;
      fees: number;
      amount: number;
    }>;
    strategy: string;
    tradeNum: string;
    userId: string;
    entityId: string;
    tx?: TransactionContext;
    createdBy?: string;
  }) {
    const { legs, strategy, tradeNum, userId, entityId, tx, createdBy } = params;
    const db = tx || prisma;
    const results = [];
    const TRADING_CASH = 'T-1010';
    const STOCK_POSITION = 'T-1100';

    for (const leg of legs) {
      // Calculate cost basis (no multiplier for stocks)
      const costBasis = Math.round((Math.abs(leg.amount) + leg.fees) * 100); // Store in cents

      if (leg.action === 'buy') {
        // Create stock lot
        const lot = await db.stock_lots.create({
          data: {
            user_id: userId,
            investment_txn_id: leg.id,
            symbol: leg.symbol.toUpperCase(),
            acquired_date: leg.date,
            original_quantity: leg.quantity,
            remaining_quantity: leg.quantity,
            cost_per_share: leg.quantity > 0 ? Math.abs(leg.amount) / leg.quantity : 0,
            total_cost_basis: Math.abs(leg.amount) + leg.fees,
            fees: leg.fees,
            status: 'OPEN'
          }
        });

        // Create journal entry: DR Stock Position, CR Cash
        const journalEntry = await this.createJournalEntry({
          date: leg.date,
          description: `BUY STOCK: ${leg.quantity} ${leg.symbol} @ $${leg.price.toFixed(2)}`,
          lines: [
            { accountCode: STOCK_POSITION, amount: costBasis, entryType: 'D' },
            { accountCode: TRADING_CASH, amount: costBasis, entryType: 'C' }
          ],
          externalTransactionId: leg.id,
          strategy,
          tradeNum,
          amount: costBasis,
          userId, entityId, db, createdBy
        });

        // Update investment transaction
        await db.investment_transactions.update({
          where: { id: leg.id },
          data: { strategy, tradeNum, accountCode: STOCK_POSITION }
        });

        results.push({
          legId: leg.id,
          lotId: lot.id,
          journalId: journalEntry.id,
          action: 'BUY',
          costBasis: costBasis / 100
        });
      }
      // Sells will be handled separately via the lot matching workflow
    }

    return { committed: results.length, results };
  }
}

export const positionTrackerService = new PositionTrackerService();

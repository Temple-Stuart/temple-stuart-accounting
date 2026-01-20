import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

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
}

type TransactionContext = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class PositionTrackerService {
  async commitOptionsTrade(params: { 
    legs: InvestmentLeg[]; 
    strategy: string; 
    tradeNum: string;
    tx?: TransactionContext; 
  }) {
    const { legs, strategy, tradeNum, tx } = params;
    const db = tx || prisma;
    const results = [];
    const skipped = [];
    
    console.log(`[Commit] Processing ${legs.length} legs for Trade #${tradeNum}`);
    
    // CRITICAL: Process ALL opens first to ensure positions exist in DB
    for (const leg of legs) {
      if (leg.positionEffect === 'open') {
        console.log(`  [OPEN] ${leg.symbol} $${leg.strike} ${leg.contractType} ${leg.expiry?.toLocaleDateString()}`);
        const result = await this.openPosition(leg, strategy, tradeNum, db);
        results.push(result);
      }
    }
    
    // Then process ALL closes (can now find the opens we just created)
    for (const leg of legs) {
      if (leg.positionEffect === 'close') {
        // Check if this is an exercise/assignment transaction
        const legName = (leg as any).name?.toLowerCase() || '';
        const isExerciseOrAssignment = legName.includes('exercise') || legName.includes('assignment');
        
        // Skip $0 transfer legs - only process stock transactions with real amounts
        if (isExerciseOrAssignment && (leg.amount === 0 || leg.price === 0)) {
          console.log(`  [SKIP] $0 transfer leg for exercise/assignment: ${legName.slice(0, 50)}`);
          // Still mark as committed but don't create journal entries
          results.push({
            legId: leg.id,
            action: 'CLOSE',
            skipped: true,
            reason: 'ZERO_AMOUNT_TRANSFER'
          });
          continue;
        }
        
        let openPosition = null;
        
        if (isExerciseOrAssignment) {
          // For exercise/assignment: find open position by TRADE NUMBER
          // These transactions close options but have stock symbol, not option details
          openPosition = await db.trading_positions.findFirst({
            where: { 
              trade_num: tradeNum,
              status: 'OPEN' 
            }
          });
          
          if (openPosition) {
            console.log(`  [EXERCISE/ASSIGN CLOSE] Found position by trade #${tradeNum}: ${openPosition.symbol} $${openPosition.strike_price}`);
          }
        } else {
          // Normal option close: match by symbol/strike/type/expiry
          openPosition = await db.trading_positions.findFirst({
            where: { 
              symbol: leg.symbol, 
              strike_price: leg.strike, 
              option_type: leg.contractType?.toUpperCase(),
              expiration_date: leg.expiry, 
              status: 'OPEN' 
            }
          });
        }
        
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
          continue; // Skip this close, don't crash
        }
        
        console.log(`  [CLOSE] ${leg.symbol} $${leg.strike} ${leg.contractType} ${leg.expiry?.toLocaleDateString()}`);
        // For exercise/assignment, pass the matched position info to closePosition
        const result = await this.closePosition(
          isExerciseOrAssignment ? { ...leg, matchedPosition: openPosition } : leg, 
          strategy, 
          tradeNum, 
          db
        );
        results.push(result);
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
    db: TransactionContext
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
      db
    });
    await db.trading_positions.create({
      data: {
        open_investment_txn_id: leg.id, symbol: leg.symbol, option_type: leg.contractType?.toUpperCase() as string,
        strike_price: leg.strike, expiration_date: leg.expiry, position_type: positionType, quantity: leg.quantity,
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
    db: TransactionContext
  ) {
    const TRADING_CASH = 'T-1010';
    
    // Use pre-matched position (for exercise/assignment) or lookup by option details
    let openPosition = leg.matchedPosition;
    
    if (!openPosition) {
      openPosition = await db.trading_positions.findFirst({
        where: { 
          symbol: leg.symbol, 
          strike_price: leg.strike, 
          option_type: leg.contractType?.toUpperCase(),
          expiration_date: leg.expiry, 
          status: 'OPEN' 
        },
        orderBy: { open_date: 'asc' }
      });
    }
    
    if (!openPosition) throw new Error(`No open position found for ${leg.symbol} ${leg.strike} ${leg.contractType} ${leg.expiry?.toLocaleDateString()}`);
    
    // Check if this is an exercise/assignment (stock transaction closing an option)
    const legName = (leg as any).name?.toLowerCase() || '';
    const isExerciseOrAssignment = legName.includes('exercise') || legName.includes('assignment');
    
    let proceeds: number;
    let realizedPL: number;
    const originalCost = Math.round(openPosition.cost_basis * 100);
    
    if (isExerciseOrAssignment) {
      // For exercise/assignment, skip journal entry creation entirely.
      // The stock transactions don't correspond to option positions in a way
      // that makes sense for double-entry bookkeeping of the option trade.
      // P&L is calculated at the trade level from transaction amounts.
      
      // Just close the position without journal entry
      await db.trading_positions.update({
        where: { id: openPosition.id },
        data: { 
          status: 'CLOSED', 
          close_investment_txn_id: leg.id, 
          close_price: leg.price,
          close_fees: leg.fees || 0, 
          close_date: leg.date, 
          proceeds: leg.amount, 
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
        action: 'CLOSE_EXERCISE' 
      };
    } else {
      // Normal option close: calculate from price * quantity * multiplier
      const multiplier = 100;
      if (leg.action === 'sell') {
        proceeds = Math.round((leg.price * leg.quantity * multiplier - leg.fees) * 100);
      } else {
        proceeds = Math.round((leg.price * leg.quantity * multiplier + leg.fees) * 100);
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
      description: `CLOSE ${openPosition.position_type}: ${leg.symbol} ${leg.strike} ${leg.contractType?.toUpperCase()} - ${isGain ? 'GAIN' : 'LOSS'} $${(Math.abs(realizedPL) / 100).toFixed(2)}`,
      lines, externalTransactionId: leg.id, strategy, tradeNum, amount: proceeds,
      db
    });
    await db.trading_positions.update({
      where: { id: openPosition.id },
      data: { status: 'CLOSED', close_investment_txn_id: leg.id, close_price: leg.price,
        close_fees: leg.fees, close_date: leg.date, proceeds: proceeds / 100, realized_pl: realizedPL / 100 }
    });
    return { legId: leg.id, journalId: journalEntry.id, coaCode: plAccount, realizedPL, proceeds, originalCost, action: 'CLOSE' };
  }

  private async createJournalEntry(params: {
    date: Date; description: string;
    lines: Array<{ accountCode: string; amount: number; entryType: 'D' | 'C' }>;
    externalTransactionId?: string; strategy?: string; tradeNum?: string; amount?: number;
    db: TransactionContext;
  }) {
    const { date, description, lines, externalTransactionId, strategy, tradeNum, amount, db } = params;
    const debits = lines.filter(l => l.entryType === 'D').reduce((sum, l) => sum + l.amount, 0);
    const credits = lines.filter(l => l.entryType === 'C').reduce((sum, l) => sum + l.amount, 0);
    if (debits !== credits) throw new Error(`Unbalanced entry: debits=${debits} credits=${credits}`);
    const accountCodes = lines.map(l => l.accountCode);
    const accounts = await db.chart_of_accounts.findMany({ where: { code: { in: accountCodes } } });
    if (accounts.length !== accountCodes.length) {
      const missing = accountCodes.filter(code => !accounts.find(a => a.code === code));
      throw new Error(`Account codes not found: ${missing.join(', ')}`);
    }
    
    // Create journal transaction
    const journalTxn = await db.journal_transactions.create({
      data: { 
        id: uuidv4(), 
        transaction_date: date, 
        description, 
        external_transaction_id: externalTransactionId,
        strategy, 
        trade_num: tradeNum, 
        amount, 
        posted_at: new Date() 
      }
    });
    
    // Create ledger entries and update account balances
    for (const line of lines) {
      const account = accounts.find(a => a.code === line.accountCode)!;
      await db.ledger_entries.create({
        data: { 
          id: uuidv4(), 
          transaction_id: journalTxn.id, 
          account_id: account.id,
          amount: BigInt(line.amount), 
          entry_type: line.entryType 
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
    
    return journalTxn;
  }

  async handleAssignmentExercise(params: {
    exerciseTransfer: any; stockTransaction: any; strategy: string; tradeNum: string;
  }) {
    const { exerciseTransfer, stockTransaction, strategy, tradeNum } = params;
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
      db: prisma
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
    tx?: TransactionContext;
  }) {
    const { legs, strategy, tradeNum, userId, tx } = params;
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
          db
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

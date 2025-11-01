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

export class PositionTrackerService {
  async commitOptionsTrade(params: { legs: InvestmentLeg[]; strategy: string; tradeNum: string; }) {
    const { legs, strategy, tradeNum } = params;
    const results = [];
    for (const leg of legs) {
      if (leg.positionEffect === 'open') {
        const result = await this.openPosition(leg, strategy, tradeNum);
        results.push(result);
      } else {
        const result = await this.closePosition(leg, strategy, tradeNum);
        results.push(result);
      }
    }
    for (const leg of legs) {
      await prisma.investment_transactions.update({
        where: { id: leg.id },
        data: { strategy, tradeNum, accountCode: results.find(r => r.legId === leg.id)?.coaCode || null }
      });
    }
    return { success: true, results };
  }

  private async openPosition(leg: InvestmentLeg, strategy: string, tradeNum: string) {
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
      lines, externalTransactionId: leg.id, strategy, tradeNum, amount: costBasis
    });
    await prisma.trading_positions.create({
      data: {
        open_investment_txn_id: leg.id, symbol: leg.symbol, option_type: leg.contractType?.toUpperCase() as string,
        strike_price: leg.strike, expiration_date: leg.expiry, position_type: positionType, quantity: leg.quantity,
        open_price: leg.price, open_fees: leg.fees, open_date: leg.date, cost_basis: costBasis / 100,
        status: 'OPEN', trade_num: tradeNum, strategy: strategy
      }
    });
    return { legId: leg.id, journalId: journalEntry.id, coaCode: positionAccount, costBasis, action: 'OPEN' };
  }

  private async closePosition(leg: InvestmentLeg, strategy: string, tradeNum: string) {
    const TRADING_CASH = 'T-1010';
    const openPosition = await prisma.trading_positions.findFirst({
      where: { symbol: leg.symbol, strike_price: leg.strike, option_type: leg.contractType?.toUpperCase(),
        expiration_date: leg.expiry, status: 'OPEN' },
      orderBy: { open_date: 'asc' }
    });
    if (!openPosition) throw new Error(`No open position found for ${leg.symbol} ${leg.strike} ${leg.contractType} ${leg.expiry?.toLocaleDateString()}`);
    const multiplier = 100;
    let proceeds: number;
    if (leg.action === 'sell') {
      proceeds = Math.round((leg.price * leg.quantity * multiplier - leg.fees) * 100);
    } else {
      proceeds = Math.round((leg.price * leg.quantity * multiplier + leg.fees) * 100);
    }
    const originalCost = Math.round(openPosition.cost_basis * 100);
    let realizedPL: number;
    if (openPosition.position_type === 'LONG') {
      realizedPL = proceeds - originalCost;
    } else {
      realizedPL = originalCost - proceeds;
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
      lines, externalTransactionId: leg.id, strategy, tradeNum, amount: proceeds
    });
    await prisma.trading_positions.update({
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
  }) {
    const { date, description, lines, externalTransactionId, strategy, tradeNum, amount } = params;
    const debits = lines.filter(l => l.entryType === 'D').reduce((sum, l) => sum + l.amount, 0);
    const credits = lines.filter(l => l.entryType === 'C').reduce((sum, l) => sum + l.amount, 0);
    if (debits !== credits) throw new Error(`Unbalanced entry: debits=${debits} credits=${credits}`);
    const accountCodes = lines.map(l => l.accountCode);
    const accounts = await prisma.chart_of_accounts.findMany({ where: { code: { in: accountCodes } } });
    if (accounts.length !== accountCodes.length) {
      const missing = accountCodes.filter(code => !accounts.find(a => a.code === code));
      throw new Error(`Account codes not found: ${missing.join(', ')}`);
    }
    return await prisma.$transaction(async (tx) => {
      const journalTxn = await tx.journal_transactions.create({
        data: { id: uuidv4(), transaction_date: date, description, external_transaction_id: externalTransactionId,
          strategy, trade_num: tradeNum, amount, posted_at: new Date() }
      });
      for (const line of lines) {
        const account = accounts.find(a => a.code === line.accountCode)!;
        await tx.ledger_entries.create({
          data: { id: uuidv4(), transaction_id: journalTxn.id, account_id: account.id,
            amount: BigInt(line.amount), entry_type: line.entryType }
        });
        const balanceChange = line.entryType === account.balance_type ? BigInt(line.amount) : BigInt(-line.amount);
        await tx.chart_of_accounts.update({
          where: { id: account.id },
          data: { settled_balance: { increment: balanceChange }, version: { increment: 1 } }
        });
      }
      return journalTxn;
    });
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
      lines, externalTransactionId: exerciseTransfer.id, strategy, tradeNum, amount: originalCost
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
}

export const positionTrackerService = new PositionTrackerService();

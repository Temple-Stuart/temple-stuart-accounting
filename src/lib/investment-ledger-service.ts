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

export class InvestmentLedgerService {
  
  /**
   * IRS-compliant commit for options trades
   * Handles opening positions, closing positions, and realized P/L calculation
   */
  async commitOptionsTrade(params: {
    legs: InvestmentLeg[];
    strategy: string;
    tradeNum: string;
  }) {
    const { legs, strategy, tradeNum } = params;
    
    // Validate all legs are from same trade date (or 7 days apart max for weekly options)
    const dates = legs.map(l => l.date.getTime());
    const maxDate = Math.max(...dates);
    const minDate = Math.min(...dates);
    if ((maxDate - minDate) / (1000 * 60 * 60 * 24) > 7) {
      throw new Error('Legs must be from same trade or within 7 days');
    }
    
    // Group by open vs close
    const openLegs = legs.filter(l => l.positionEffect === 'open');
    const closeLegs = legs.filter(l => l.positionEffect === 'close');
    
    const results = [];
    
    // Process opening legs (establish positions)
    for (const leg of openLegs) {
      const result = await this.processOpeningLeg(leg, strategy, tradeNum);
      results.push(result);
    }
    
    // Process closing legs (realize P/L)
    for (const leg of closeLegs) {
      const result = await this.processClosingLeg(leg, openLegs, strategy, tradeNum);
      results.push(result);
    }
    
    // Update investment_transactions with metadata
    for (const leg of legs) {
      await prisma.investment_transactions.update({
        where: { id: leg.id },
        data: {
          strategy,
          tradeNum,
          accountCode: leg.positionEffect === 'close' ? 
            (results.find(r => r.legId === leg.id)?.coaCode || 'T-4140') : 
            null
        }
      });
    }
    
    return { success: true, results };
  }
  
  /**
   * Open a position - create asset or liability
   */
  private async processOpeningLeg(
    leg: InvestmentLeg,
    strategy: string,
    tradeNum: string
  ) {
    const TRADING_CASH = 'T-1010';
    
    // FIX #1: Round to nearest cent before converting to BigInt (cents)
    const costBasis = Math.round((Math.abs(leg.amount) + leg.fees) * 100);
    
    let positionAccount: string;
    let lines: Array<{ accountCode: string; amount: number; entryType: 'D' | 'C' }>;
    
    if (leg.action === 'buy') {
      // Buy to Open = Long position (Asset)
      positionAccount = leg.contractType === 'call' ? 'T-1200' : 'T-1210';
      lines = [
        { accountCode: positionAccount, amount: costBasis, entryType: 'D' },
        { accountCode: TRADING_CASH, amount: costBasis, entryType: 'C' }
      ];
    } else {
      // Sell to Open = Short position (Liability)
      positionAccount = leg.contractType === 'call' ? 'T-2100' : 'T-2110';
      lines = [
        { accountCode: TRADING_CASH, amount: costBasis, entryType: 'D' },
        { accountCode: positionAccount, amount: costBasis, entryType: 'C' }
      ];
    }
    
    const journalEntry = await this.createJournalEntry({
      date: leg.date,
      description: `Open: ${leg.symbol} ${leg.strike} ${leg.contractType?.toUpperCase()} ${leg.expiry?.toLocaleDateString()} - ${strategy}`,
      lines,
      externalTransactionId: leg.id,
      strategy,
      tradeNum,
      amount: costBasis
    });
    
    return {
      legId: leg.id,
      journalId: journalEntry.id,
      coaCode: positionAccount,
      costBasis
    };
  }
  
  /**
   * Close a position - realize P/L
   */
  private async processClosingLeg(
    leg: InvestmentLeg,
    openLegs: InvestmentLeg[],
    strategy: string,
    tradeNum: string
  ) {
    const TRADING_CASH = 'T-1010';
    
    // FIX #1: Round to nearest cent before converting
    const proceeds = Math.round((Math.abs(leg.amount) - leg.fees) * 100);
    
    // FIX #2: Improved matching logic - match by strike AND type, ignore action
    const matchingOpen = openLegs.find(o => 
      o.strike === leg.strike && 
      o.contractType === leg.contractType
    );
    
    if (!matchingOpen) {
      throw new Error(`No matching opening leg found for closing ${leg.symbol} ${leg.strike} ${leg.contractType}. Available opens: ${openLegs.map(o => `${o.strike} ${o.contractType} ${o.action}`).join(', ')}`);
    }
    
    // FIX #1: Round original cost
    const originalCost = Math.round((Math.abs(matchingOpen.amount) + matchingOpen.fees) * 100);
    
    // Calculate realized P/L
    let realizedPL: number;
    let isGain: boolean;
    
    if (leg.action === 'sell') {
      // Selling to close a long position
      realizedPL = proceeds - originalCost;
      isGain = realizedPL > 0;
    } else {
      // Buying to close a short position
      realizedPL = originalCost - proceeds;
      isGain = realizedPL > 0;
    }
    
    const plAccount = isGain ? 'T-4140' : 'T-5140';
    const positionAccount = matchingOpen.action === 'buy' ?
      (matchingOpen.contractType === 'call' ? 'T-1200' : 'T-1210') :
      (matchingOpen.contractType === 'call' ? 'T-2100' : 'T-2110');
    
    // Build journal entry
    const lines: Array<{ accountCode: string; amount: number; entryType: 'D' | 'C' }> = [];
    
    if (leg.action === 'sell') {
      // Closing long: Cash increases, Position closes, P/L realized
      lines.push({ accountCode: TRADING_CASH, amount: proceeds, entryType: 'D' });
      lines.push({ accountCode: positionAccount, amount: originalCost, entryType: 'C' });
      if (isGain) {
        lines.push({ accountCode: plAccount, amount: Math.abs(realizedPL), entryType: 'C' });
      } else {
        lines.push({ accountCode: plAccount, amount: Math.abs(realizedPL), entryType: 'D' });
      }
    } else {
      // Closing short: Cash decreases, Position closes, P/L realized
      lines.push({ accountCode: positionAccount, amount: originalCost, entryType: 'D' });
      lines.push({ accountCode: TRADING_CASH, amount: proceeds, entryType: 'C' });
      if (isGain) {
        lines.push({ accountCode: plAccount, amount: Math.abs(realizedPL), entryType: 'C' });
      } else {
        lines.push({ accountCode: plAccount, amount: Math.abs(realizedPL), entryType: 'D' });
      }
    }
    
    const journalEntry = await this.createJournalEntry({
      date: leg.date,
      description: `Close: ${leg.symbol} ${leg.strike} ${leg.contractType?.toUpperCase()} - ${isGain ? 'GAIN' : 'LOSS'} $${(Math.abs(realizedPL) / 100).toFixed(2)}`,
      lines,
      externalTransactionId: leg.id,
      strategy,
      tradeNum,
      amount: proceeds
    });
    
    return {
      legId: leg.id,
      journalId: journalEntry.id,
      coaCode: plAccount,
      realizedPL,
      proceeds,
      originalCost
    };
  }
  
  /**
   * Create journal entry with double-entry validation
   */
  private async createJournalEntry(params: {
    date: Date;
    description: string;
    lines: Array<{ accountCode: string; amount: number; entryType: 'D' | 'C' }>;
    externalTransactionId?: string;
    strategy?: string;
    tradeNum?: string;
    amount?: number;
  }) {
    const { date, description, lines, externalTransactionId, strategy, tradeNum, amount } = params;
    
    // Validate balanced
    const debits = lines.filter(l => l.entryType === 'D').reduce((sum, l) => sum + l.amount, 0);
    const credits = lines.filter(l => l.entryType === 'C').reduce((sum, l) => sum + l.amount, 0);
    
    if (debits !== credits) {
      throw new Error(`Unbalanced entry: debits=${debits} credits=${credits}`);
    }
    
    // Get accounts
    const accountCodes = lines.map(l => l.accountCode);
    const accounts = await prisma.chart_of_accounts.findMany({
      where: { code: { in: accountCodes } }
    });
    
    if (accounts.length !== accountCodes.length) {
      const missing = accountCodes.filter(code => !accounts.find(a => a.code === code));
      throw new Error(`Account codes not found: ${missing.join(', ')}`);
    }
    
    // Create journal transaction
    return await prisma.$transaction(async (tx) => {
      const journalTxn = await tx.journal_transactions.create({
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
      
      // Create ledger entries
      for (const line of lines) {
        const account = accounts.find(a => a.code === line.accountCode)!;
        
        await tx.ledger_entries.create({
          data: {
            id: uuidv4(),
            transaction_id: journalTxn.id,
            account_id: account.id,
            amount: BigInt(line.amount),
            entry_type: line.entryType
          }
        });
        
        // Update COA balance
        const balanceChange = line.entryType === account.balance_type 
          ? BigInt(line.amount) 
          : BigInt(-line.amount);
        
        await tx.chart_of_accounts.update({
          where: { id: account.id },
          data: { 
            settled_balance: { increment: balanceChange },
            version: { increment: 1 }
          }
        });
      }
      
      return journalTxn;
    });
  }
}

export const investmentLedgerService = new InvestmentLedgerService();

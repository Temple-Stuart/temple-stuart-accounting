import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface JournalEntryLine {
  accountCode: string;
  amount: number;
  entryType: 'D' | 'C';
}

interface CreateJournalEntryParams {
  date: Date;
  description: string;
  lines: JournalEntryLine[];
  plaidTransactionId?: string;
  externalTransactionId?: string;
  accountCode?: string;
  amount?: number;
  strategy?: string;
  tradeNum?: string;
}

export class JournalEntryService {
  
  async createJournalEntry(params: CreateJournalEntryParams) {
    const { date, description, lines, plaidTransactionId, externalTransactionId, accountCode, amount, strategy, tradeNum } = params;
    
    const debits = lines.filter(l => l.entryType === 'D').reduce((sum, l) => sum + l.amount, 0);
    const credits = lines.filter(l => l.entryType === 'C').reduce((sum, l) => sum + l.amount, 0);
    
    if (debits !== credits) {
      throw new Error(`Unbalanced transaction: debits=${debits} credits=${credits}`);
    }
    
    const accountCodes = lines.map(l => l.accountCode);
    const accounts = await prisma.chart_of_accounts.findMany({
      where: { code: { in: accountCodes } }
    });
    
    if (accounts.length !== accountCodes.length) {
      const missing = accountCodes.filter(code => 
        !accounts.find(a => a.code === code)
      );
      throw new Error(`Account codes not found: ${missing.join(', ')}`);
    }
    
    const result = await prisma.$transaction(async (tx) => {
      const journalTxn = await tx.journal_transactions.create({
        data: {
          transaction_date: date,
          description,
          plaid_transaction_id: plaidTransactionId,
          external_transaction_id: externalTransactionId,
          account_code: accountCode,
          amount,
          strategy,
          trade_num: tradeNum,
          postedAt: new Date(),
        }
      });
      
      for (const line of lines) {
        const account = accounts.find(a => a.code === line.accountCode)!;
        
        await tx.ledgerEntry.create({
          data: {
            transactionId: journalTxn.id,
            accountId: account.id,
            amount: BigInt(line.amount),
            entryType: line.entryType,
          }
        });
        
        const balanceChange = line.entryType === account.balance_type 
          ? BigInt(line.amount) 
          : BigInt(-line.amount);
        
        await tx.chartOfAccount.update({
          where: { id: account.id },
          data: { 
            settled_balance: { increment: balanceChange },
            version: { increment: 1 }
          }
        });
      }
      
      return journalTxn;
    });
    
    return result;
  }
  
  async convertPlaidTransaction(
    plaidTxnId: string,
    bankAccountCode: string,
    expenseOrIncomeCode: string
  ) {
    const plaidTxn = await prisma.transactions.findUnique({
      where: { transactionId: plaidTxnId }
    });
    
    if (!plaidTxn) {
      throw new Error('Plaid transaction not found');
    }
    
    const amountCents = Math.abs(Math.round(plaidTxn.amount * 100));
    const isExpense = plaidTxn.amount > 0;
    
    console.log(`Converting transaction: ${plaidTxn.name}, Bank: ${bankAccountCode}, Expense/Income: ${expenseOrIncomeCode}`);
    
    const lines: JournalEntryLine[] = isExpense 
      ? [
          { accountCode: expenseOrIncomeCode, amount: amountCents, entryType: 'D' },
          { accountCode: bankAccountCode, amount: amountCents, entryType: 'C' }
        ]
      : [
          { accountCode: bankAccountCode, amount: amountCents, entryType: 'D' },
          { accountCode: expenseOrIncomeCode, amount: amountCents, entryType: 'C' }
        ];
    
    return this.createJournalEntry({
      date: new Date(plaidTxn.date),
      description: plaidTxn.name,
      lines,
      plaid_transaction_id: plaidTxn.transactionId,
      external_transaction_id: plaidTxn.transactionId,
    });
  }
}

export const journalEntryService = new JournalEntryService();

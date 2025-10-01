import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface JournalEntryLine {
  accountCode: string;
  amount: number; // in cents
  entryType: 'D' | 'C';
}

interface CreateJournalEntryParams {
  date: Date;
  description: string;
  lines: JournalEntryLine[];
  plaidTransactionId?: string;
  externalTransactionId?: string;
}

export class JournalEntryService {
  
  /**
   * Create a balanced journal entry with validation
   */
  async createJournalEntry(params: CreateJournalEntryParams) {
    const { date, description, lines, plaidTransactionId, externalTransactionId } = params;
    
    // Validate: debits must equal credits
    const debits = lines.filter(l => l.entryType === 'D').reduce((sum, l) => sum + l.amount, 0);
    const credits = lines.filter(l => l.entryType === 'C').reduce((sum, l) => sum + l.amount, 0);
    
    if (debits !== credits) {
      throw new Error(`Unbalanced transaction: debits=${debits} credits=${credits}`);
    }
    
    // Get account IDs from codes
    const accountCodes = lines.map(l => l.accountCode);
    const accounts = await prisma.chartOfAccount.findMany({
      where: { code: { in: accountCodes } }
    });
    
    if (accounts.length !== accountCodes.length) {
      const missing = accountCodes.filter(code => 
        !accounts.find(a => a.code === code)
      );
      throw new Error(`Account codes not found: ${missing.join(', ')}`);
    }
    
    // Create transaction and ledger entries atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create journal transaction
      const journalTxn = await tx.journalTransaction.create({
        data: {
          transactionDate: date,
          description,
          plaidTransactionId,
          externalTransactionId,
          postedAt: new Date(),
        }
      });
      
      // Create ledger entries
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
        
        // Update account balance
        const balanceChange = line.entryType === account.balanceType 
          ? BigInt(line.amount) 
          : BigInt(-line.amount);
        
        await tx.chartOfAccount.update({
          where: { id: account.id },
          data: { 
            settledBalance: { increment: balanceChange },
            version: { increment: 1 }
          }
        });
      }
      
      return journalTxn;
    });
    
    return result;
  }
  
  /**
   * Convert Plaid transaction to journal entry
   */
  async convertPlaidTransaction(
    plaidTxnId: string,
    bankAccountCode: string,
    expenseOrIncomeCode: string
  ) {
    const plaidTxn = await prisma.transactions.findUnique({
      where: { transaction_id: plaidTxnId }
    });
    
    if (!plaidTxn) {
      throw new Error('Plaid transaction not found');
    }
    
    const amountCents = Math.abs(Math.round(plaidTxn.amount * 100));
    
    // Determine if money in or out
    const isExpense = plaidTxn.amount > 0; // Plaid: positive = money out
    
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
      plaidTransactionId: plaidTxn.transaction_id,
      externalTransactionId: plaidTxn.transaction_id,
    });
  }
}

export const journalEntryService = new JournalEntryService();

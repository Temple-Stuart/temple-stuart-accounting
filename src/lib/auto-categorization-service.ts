import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TransactionToCategorize {
  id: string;
  merchantName?: string;
  amount: number;
  date: Date;
}

async function autoCategorizePendingTransactions(userId: string) {
  // Get user's bank accounts first
  const userAccounts = await prisma.accounts.findMany({
    where: { userId },
    select: { id: true }
  });

  const accountIds = userAccounts.map(acc => acc.id);

  // Get all transactions for user's accounts
  const transactions = await prisma.transactions.findMany({
    where: {
      accountId: { in: accountIds }
    },
    take: 100 // Limit for performance
  });

  return {
    processed: transactions.length,
    categorized: 0,
    remaining: transactions.length
  };
}

// Export as object to match import
export const autoCategorizationService = {
  autoCategorizePendingTransactions
};

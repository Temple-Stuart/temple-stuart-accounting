import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TransactionToCategorize {
  id: string;
  merchantName?: string;
  plaidCategoryPrimary?: string;
  plaidCategoryDetailed?: string;
  amount: number;
  date: Date;
}

interface CategorizationRule {
  merchantPattern?: string;
  plaidCategory?: string;
  chartOfAccountsId: string;
  priority: number;
}

export async function autoCategorizePendingTransactions(userId: string) {
  const pendingTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      chartOfAccountsId: null,
      status: 'pending'
    }
  });

  const rules = await getCategorizationRules(userId);
  const categorized: string[] = [];

  for (const transaction of pendingTransactions) {
    const matchedRule = findMatchingRule(transaction, rules);
    
    if (matchedRule) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          chartOfAccountsId: matchedRule.chartOfAccountsId,
          status: 'categorized',
          lastCategorizedAt: new Date(),
          lastCategorizedBy: userId
        }
      });
      categorized.push(transaction.id);
    }
  }

  return {
    processed: pendingTransactions.length,
    categorized: categorized.length,
    remaining: pendingTransactions.length - categorized.length
  };
}

async function getCategorizationRules(userId: string): Promise<CategorizationRule[]> {
  const historicalData = await prisma.transaction.findMany({
    where: {
      userId,
      chartOfAccountsId: { not: null },
      status: 'categorized'
    },
    select: {
      merchantName: true,
      plaidCategoryPrimary: true,
      plaidCategoryDetailed: true,
      chartOfAccountsId: true
    }
  });

  const ruleMap = new Map<string, CategorizationRule>();

  for (const tx of historicalData) {
    if (tx.merchantName && tx.chartOfAccountsId) {
      const key = `merchant:${tx.merchantName}`;
      if (!ruleMap.has(key)) {
        ruleMap.set(key, {
          merchantPattern: tx.merchantName,
          chartOfAccountsId: tx.chartOfAccountsId,
          priority: 1
        });
      }
    }

    if (tx.plaidCategoryPrimary && tx.chartOfAccountsId) {
      const key = `plaid:${tx.plaidCategoryPrimary}`;
      if (!ruleMap.has(key)) {
        ruleMap.set(key, {
          plaidCategory: tx.plaidCategoryPrimary,
          chartOfAccountsId: tx.chartOfAccountsId,
          priority: 2
        });
      }
    }
  }

  return Array.from(ruleMap.values()).sort((a, b) => a.priority - b.priority);
}

function findMatchingRule(
  transaction: TransactionToCategorize,
  rules: CategorizationRule[]
): CategorizationRule | null {
  for (const rule of rules) {
    if (rule.merchantPattern && transaction.merchantName) {
      if (transaction.merchantName.toLowerCase().includes(rule.merchantPattern.toLowerCase())) {
        return rule;
      }
    }

    if (rule.plaidCategory && transaction.plaidCategoryPrimary) {
      if (transaction.plaidCategoryPrimary === rule.plaidCategory) {
        return rule;
      }
    }
  }

  return null;
}

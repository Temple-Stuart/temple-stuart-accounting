import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TransactionToCateg categorize {
  id: string;
  merchantName?: string;
  plaidCategoryPrimary?: string;
  plaidCategoryDetailed?: string;
  amount: number;
}

interface CategorizationSuggestion {
  transactionId: string;
  suggestedCoaCode: string;
  suggestedSubAccount?: string;
  confidence: number; // 0-1
  reason: 'merchant_history' | 'category_default' | 'manual_needed';
}

export class AutoCategorizationService {
  
  /**
   * Get COA suggestions for a batch of transactions
   */
  async suggestCategories(transactions: TransactionToCategorize[]): Promise<CategorizationSuggestion[]> {
    const suggestions: CategorizationSuggestion[] = [];
    
    for (const txn of transactions) {
      const suggestion = await this.suggestForTransaction(txn);
      suggestions.push(suggestion);
    }
    
    return suggestions;
  }
  
  /**
   * Suggest COA code for a single transaction
   */
  private async suggestForTransaction(txn: TransactionToCategorize): Promise<CategorizationSuggestion> {
    // Priority 1: Check merchant history
    if (txn.merchantName) {
      const merchantMapping = await prisma.merchantCoaMapping.findFirst({
        where: { merchantName: txn.merchantName },
        orderBy: { usageCount: 'desc' }
      });
      
      if (merchantMapping) {
        return {
          transactionId: txn.id,
          suggestedCoaCode: merchantMapping.coaCode,
          suggestedSubAccount: merchantMapping.subAccount || undefined,
          confidence: Number(merchantMapping.confidenceScore),
          reason: 'merchant_history'
        };
      }
    }
    
    // Priority 2: Check category defaults
    if (txn.plaidCategoryPrimary) {
      const categoryDefault = await prisma.categoryCoaDefault.findUnique({
        where: { plaidCategoryPrimary: txn.plaidCategoryPrimary }
      });
      
      if (categoryDefault) {
        return {
          transactionId: txn.id,
          suggestedCoaCode: categoryDefault.coaCode,
          confidence: 0.7,
          reason: 'category_default'
        };
      }
    }
    
    // Priority 3: Manual review needed
    return {
      transactionId: txn.id,
      suggestedCoaCode: 'P-8900', // Other Personal Expense as fallback
      confidence: 0.3,
      reason: 'manual_needed'
    };
  }
  
  /**
   * Learn from user's manual assignment
   */
  async learnFromAssignment(
    merchantName: string,
    plaidCategoryPrimary: string | null,
    coaCode: string,
    subAccount?: string
  ) {
    const existing = await prisma.merchantCoaMapping.findFirst({
      where: {
        merchantName,
        plaidCategoryPrimary: plaidCategoryPrimary || undefined
      }
    });
    
    if (existing) {
      // Update existing mapping
      await prisma.merchantCoaMapping.update({
        where: { id: existing.id },
        data: {
          coaCode,
          subAccount,
          usageCount: { increment: 1 },
          confidenceScore: Math.min(Number(existing.confidenceScore) + 0.1, 1.0),
          lastUsedAt: new Date()
        }
      });
    } else {
      // Create new mapping
      await prisma.merchantCoaMapping.create({
        data: {
          merchantName,
          plaidCategoryPrimary: plaidCategoryPrimary || undefined,
          coaCode,
          subAccount,
          usageCount: 1,
          confidenceScore: 0.8
        }
      });
    }
  }
  
  /**
   * Get filtered COA suggestions based on transaction type
   */
  async getRelevantCoaOptions(
    plaidCategory: string | null,
    amount: number
  ): Promise<string[]> {
    const isExpense = amount > 0;
    
    // Get accounts appropriate for this transaction type
    const accounts = await prisma.chartOfAccount.findMany({
      where: {
        isArchived: false,
        entityType: 'personal', // For now, default to personal
        accountType: isExpense ? 'expense' : 'revenue'
      },
      select: { code: true },
      orderBy: { code: 'asc' }
    });
    
    return accounts.map(a => a.code);
  }
}

export const autoCategorizationService = new AutoCategorizationService();

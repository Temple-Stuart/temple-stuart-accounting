import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface CategoryPrediction {
  coaCode: string;
  confidence: number;
  source: 'merchant_mapping' | 'category_mapping' | 'gpt' | 'manual';
}

export class AutoCategorizationService {
  
  /**
   * Predict COA code for a transaction based on merchant mappings
   */
  async predictCategory(
    merchantName: string | null,
    categoryPrimary: string | null,
    amount: number
  ): Promise<CategoryPrediction | null> {
    
    // Try merchant mapping first (highest confidence)
    if (merchantName && categoryPrimary) {
      const merchantMapping = await prisma.merchant_coa_mappings.findFirst({
        where: {
          merchant_name: {
            contains: merchantName,
            mode: 'insensitive'
          },
          plaid_category_primary: categoryPrimary
        },
        orderBy: {
          confidence_score: 'desc'
        }
      });
      
      if (merchantMapping && merchantMapping.confidence_score.toNumber() > 0.5) {
        return {
          coaCode: merchantMapping.coa_code,
          confidence: merchantMapping.confidence_score.toNumber(),
          source: 'merchant_mapping'
        };
      }
    }
    
    // Fallback to category mapping
    if (categoryPrimary) {
      const categoryMap: Record<string, string> = {
        'FOOD_AND_DRINK': 'P-6100',
        'TRANSPORTATION': 'P-6400', 
        'RENT_AND_UTILITIES': 'P-8100',
        'GENERAL_MERCHANDISE': 'P-8900',
        'GENERAL_SERVICES': 'P-8900',
        'ENTERTAINMENT': 'P-8170',
        'PERSONAL_CARE': 'P-8150',
        'BANK_FEES': 'P-6300',
        'MEDICAL': 'P-8130',
        'TRAVEL': 'P-6200'
      };
      
      const coaCode = categoryMap[categoryPrimary];
      if (coaCode) {
        return {
          coaCode: coaCode,
          confidence: 0.6,
          source: 'category_mapping'
        };
      }
    }
    
    // No prediction available
    return null;
  }
  
  /**
   * Categorize all pending transactions
   */
  async categorizePendingTransactions(userId?: string): Promise<{
    categorized: number;
    failed: number;
  }> {
    const pendingTransactions = await prisma.transactions.findMany({
      where: {
        accountCode: null,
        predicted_coa_code: null,
        ...(userId ? { accounts: { userId } } : {})
      }
    });
    
    let categorized = 0;
    let failed = 0;
    
    for (const txn of pendingTransactions) {
      try {
        const categoryPrimary = (txn.personal_finance_category as any)?.primary;
        
        const prediction = await this.predictCategory(
          txn.merchantName,
          categoryPrimary,
          txn.amount
        );
        
        if (prediction) {
          await prisma.transactions.update({
            where: { id: txn.id },
            data: {
              predicted_coa_code: prediction.coaCode,
              prediction_confidence: new Prisma.Decimal(prediction.confidence),
              review_status: 'pending_review'
            }
          });
          categorized++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error categorizing transaction ${txn.id}:`, error);
        failed++;
      }
    }
    
    return { categorized, failed };
  }
  
  /**
   * Commit reviewed transactions to ledger
   */
  async commitReviewedTransactions(
    transactionIds: string[],
    userId: string
  ): Promise<{
    committed: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    const errors: Array<{ id: string; error: string }> = [];
    let committed = 0;
    
    for (const txnId of transactionIds) {
      try {
        const txn = await prisma.transactions.findUnique({
          where: { id: txnId }
        });
        
        if (!txn) {
          errors.push({ id: txnId, error: 'Transaction not found' });
          continue;
        }
        
        // Use accountCode if set (user edited), otherwise use predicted
        const finalCoaCode = txn.accountCode || txn.predicted_coa_code;
        
        if (!finalCoaCode) {
          errors.push({ id: txnId, error: 'No COA code available' });
          continue;
        }
        
        // Check if user overrode the prediction
        const wasOverridden = !!(txn.accountCode && 
          txn.accountCode !== txn.predicted_coa_code);
        
        // Call existing commit API
        const response = await fetch('/api/transactions/commit-to-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionIds: [txnId],
            accountCode: finalCoaCode,
            subAccount: txn.subAccount
          })
        });
        
        if (!response.ok) {
          const data = await response.json();
          errors.push({ id: txnId, error: data.error || 'Commit failed' });
          continue;
        }
        
        // Update review status
        await prisma.transactions.update({
          where: { id: txnId },
          data: {
            review_status: 'approved',
            manually_overridden: wasOverridden,
            overridden_at: wasOverridden ? new Date() : null,
            overridden_by: wasOverridden ? userId : null
          }
        });
        
        committed++;
        
      } catch (error: any) {
        console.error(`Error committing transaction ${txnId}:`, error);
        errors.push({ id: txnId, error: error.message });
      }
    }
    
    return { committed, errors };
  }
}

export const autoCategorizationService = new AutoCategorizationService();

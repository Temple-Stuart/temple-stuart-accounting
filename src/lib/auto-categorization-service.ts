import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

interface CategoryPrediction {
  coaCode: string;
  confidence: number;
  source: 'merchant_mapping' | 'category_mapping' | 'gpt' | 'manual';
  entityId: string | null;
}

export class AutoCategorizationService {

  /**
   * Predict COA code for a transaction based on merchant mappings
   */
  async predictCategory(
    merchantName: string | null,
    categoryPrimary: string | null,
    amount: number,
    userId: string,
    entityId?: string
  ): Promise<CategoryPrediction | null> {

    // Try merchant mapping first (highest confidence)
    // SECURITY: Scoped to user's mappings only, optionally entity-scoped
    if (merchantName && categoryPrimary) {
      const merchantWhere: any = {
        userId,
        merchant_name: {
          contains: merchantName,
          mode: 'insensitive'
        },
        plaid_category_primary: categoryPrimary
      };
      if (entityId) {
        merchantWhere.entity_id = entityId;
      }

      const merchantMapping = await prisma.merchant_coa_mappings.findFirst({
        where: merchantWhere,
        orderBy: {
          confidence_score: 'desc'
        }
      });

      if (merchantMapping && merchantMapping.confidence_score.toNumber() > 0.5) {
        return {
          coaCode: merchantMapping.coa_code,
          confidence: merchantMapping.confidence_score.toNumber(),
          source: 'merchant_mapping',
          entityId: merchantMapping.entity_id
        };
      }
    }

    // Fallback to category mapping
    if (categoryPrimary) {
      const categoryMap: Record<string, string> = {
        'FOOD_AND_DRINK': '6100',
        'TRANSPORTATION': '6400',
        'RENT_AND_UTILITIES': '8100',
        'GENERAL_MERCHANDISE': '8900',
        'GENERAL_SERVICES': '8900',
        'ENTERTAINMENT': '8170',
        'PERSONAL_CARE': '8150',
        'BANK_FEES': '6300',
        'MEDICAL': '8130',
        'TRAVEL': '6200',
        'INCOME': '4200',
        'LOAN_PAYMENTS': '2020',
        'TRANSFER_IN': '3100',
        'TRANSFER_OUT': '3100',
      };

      const coaCode = categoryMap[categoryPrimary];
      if (coaCode) {
        return {
          coaCode,
          confidence: 0.6,
          source: 'category_mapping',
          entityId: null  // caller resolves to user's personal entity
        };
      }
    }

    // No prediction available
    return null;
  }

  /**
   * Categorize all pending transactions
   */
  async categorizePendingTransactions(userId: string, entityId?: string): Promise<{
    categorized: number;
    failed: number;
  }> {
    // Look up user's default personal entity ONCE for Tier 2 (category_mapping) fallback
    const personalEntity = await prisma.entities.findFirst({
      where: { userId, entity_type: 'personal', is_default: true },
      select: { id: true }
    });
    const personalEntityId = personalEntity?.id ?? null;

    const pendingTransactions = await prisma.transactions.findMany({
      where: {
        accountCode: null,
        predicted_coa_code: null,
        accounts: { userId }
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
          txn.amount,
          userId,
          entityId || txn.entity_id || undefined
        );

        if (prediction) {
          // Tier 1 (merchant_mapping): use mapping's entity_id
          // Tier 2 (category_mapping): entityId is null, resolve to personal entity
          const resolvedEntityId = prediction.entityId ?? personalEntityId;

          await prisma.transactions.update({
            where: { id: txn.id },
            data: {
              predicted_coa_code: prediction.coaCode,
              prediction_confidence: new Prisma.Decimal(prediction.confidence),
              review_status: 'pending_review',
              entity_id: resolvedEntityId
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

  /**
   * Record a merchant mapping with entity scope for future predictions
   */
  async recordMerchantMapping(params: {
    userId: string;
    entityId: string;
    merchantName: string;
    categoryPrimary: string;
    coaCode: string;
  }): Promise<void> {
    const { userId, entityId, merchantName, categoryPrimary, coaCode } = params;

    await prisma.merchant_coa_mappings.upsert({
      where: {
        userId_merchant_name_plaid_category_primary: {
          userId,
          merchant_name: merchantName,
          plaid_category_primary: categoryPrimary,
        }
      },
      update: {
        coa_code: coaCode,
        entity_id: entityId,
        usage_count: { increment: 1 },
        last_used_at: new Date(),
        confidence_score: new Prisma.Decimal(1.0),
      },
      create: {
        id: crypto.randomUUID(),
        userId,
        entity_id: entityId,
        merchant_name: merchantName,
        plaid_category_primary: categoryPrimary,
        coa_code: coaCode,
        usage_count: 1,
        confidence_score: new Prisma.Decimal(1.0),
      }
    });
  }
}

export const autoCategorizationService = new AutoCategorizationService();

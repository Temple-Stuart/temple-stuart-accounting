import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { journalEntryService } from '@/lib/journal-entry-service';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { transactionIds, accountCode, subAccount } = body;

    if (!transactionIds || !accountCode) {
      return NextResponse.json(
        { error: 'transactionIds and accountCode required' },
        { status: 400 }
      );
    }

    const ownedTxns = await prisma.transactions.findMany({
      where: { id: { in: transactionIds }, accounts: { userId: user.id } },
      select: { id: true }
    });

    if (ownedTxns.length !== transactionIds.length) {
      return NextResponse.json({ error: 'Some transactions do not belong to your account' }, { status: 403 });
    }

    const results = [];
    const errors = [];

    for (const txnId of transactionIds) {
      try {
        const plaidTxn = await prisma.transactions.findUnique({
          where: { id: txnId },
          include: { accounts: { include: { plaid_items: true } } }
        });

        if (!plaidTxn) {
          errors.push({ txnId, error: 'Transaction not found' });
          continue;
        }

        const institutionName = plaidTxn.accounts?.plaid_items?.institutionName?.toLowerCase() || '';
        const accountType = plaidTxn.accounts?.type?.toLowerCase() || '';

        let bankAccountCode = 'P-1010';

        if (institutionName.includes('robinhood') || accountType.includes('investment')) {
          bankAccountCode = 'P-1200';
        } else if (institutionName.includes('wells')) {
          bankAccountCode = 'P-1010';
        }

        const journalEntry = await journalEntryService.convertPlaidTransaction(
          plaidTxn.transactionId,
          bankAccountCode,
          accountCode,
          user.id
        );

        const wasOverridden = !!(plaidTxn.predicted_coa_code &&
                               plaidTxn.predicted_coa_code !== accountCode);

        if (wasOverridden && plaidTxn.merchantName) {
          const merchantName = plaidTxn.merchantName;
          const categoryPrimary = (plaidTxn.personal_finance_category as any)?.primary || null;

          // SECURITY: Scoped to user's mappings only
          const wrongMapping = await prisma.merchant_coa_mappings.findUnique({
            where: {
              userId_merchant_name_plaid_category_primary: {
                userId: user.id,
                merchant_name: merchantName,
                plaid_category_primary: categoryPrimary || ''
              }
            }
          });

          if (wrongMapping && wrongMapping.coa_code === plaidTxn.predicted_coa_code) {
            const newConfidence = Math.max(0, wrongMapping.confidence_score.toNumber() - 0.2);

            if (newConfidence < 0.3) {
              await prisma.merchant_coa_mappings.delete({
                where: { id: wrongMapping.id }
              });
            } else {
              await prisma.merchant_coa_mappings.update({
                where: { id: wrongMapping.id },
                data: {
                  confidence_score: newConfidence,
                  last_used_at: new Date()
                }
              });
            }
          }
        }

        await prisma.transactions.update({
          where: { id: txnId },
          data: {
            accountCode,
            subAccount: subAccount || null,
            manually_overridden: wasOverridden,
            overridden_at: wasOverridden ? new Date() : null
          }
        });

        if (plaidTxn.merchantName) {
          const merchantName = plaidTxn.merchantName;
          const categoryPrimary = (plaidTxn.personal_finance_category as any)?.primary || null;
          const categoryDetailed = (plaidTxn.personal_finance_category as any)?.detailed || null;

          // SECURITY: Scoped to user's mappings only
          const existing = await prisma.merchant_coa_mappings.findUnique({
            where: {
              userId_merchant_name_plaid_category_primary: {
                userId: user.id,
                merchant_name: merchantName,
                plaid_category_primary: categoryPrimary || ''
              }
            }
          });

          if (existing && existing.coa_code === accountCode) {
            await prisma.merchant_coa_mappings.update({
              where: { id: existing.id },
              data: {
                usage_count: { increment: 1 },
                confidence_score: Math.min(0.99, existing.confidence_score.toNumber() + 0.1),
                last_used_at: new Date()
              }
            });
          } else if (!existing) {
            await prisma.merchant_coa_mappings.create({
              data: {
                id: randomUUID(),
                userId: user.id,
                merchant_name: merchantName,
                plaid_category_primary: categoryPrimary,
                plaid_category_detailed: categoryDetailed,
                coa_code: accountCode,
                sub_account: subAccount || null,
                confidence_score: wasOverridden ? 0.6 : 0.5
              }
            });
          }
        }

        results.push({ txnId, journalEntryId: journalEntry.id, success: true });

      } catch (error: any) {
        console.error('Error committing transaction:', txnId, error);
        errors.push({ txnId, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      committed: results.length,
      errorCount: errors.length,
      results,
      errors
    });

  } catch (error: any) {
    console.error('Commit API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { journalEntryService } from '@/lib/journal-entry-service';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionIds, accountCode, subAccount } = body;
    
    if (!transactionIds || !accountCode) {
      return NextResponse.json(
        { error: 'transactionIds and accountCode required' },
        { status: 400 }
      );
    }
    
    const results = [];
    const errors = [];
    
    for (const txnId of transactionIds) {
      try {
        const plaidTxn = await prisma.transactions.findUnique({
          where: { id: txnId },
          include: { account: { include: { plaidItem: true } } }
        });
        
        if (!plaidTxn) {
          errors.push({ txnId, error: 'Transaction not found' });
          continue;
        }
        
        const institutionName = plaidTxn.account?.plaidItem?.institutionName?.toLowerCase() || '';
        const accountType = plaidTxn.account?.type?.toLowerCase() || '';
        
        let bankAccountCode = 'P-1010';
        
        if (institutionName.includes('robinhood') || accountType.includes('investment')) {
          bankAccountCode = 'P-1200';
        } else if (institutionName.includes('wells')) {
          bankAccountCode = 'P-1010';
        }
        
        const journalEntry = await journalEntryService.convertPlaidTransaction(
          plaidTxn.transactionId,
          bankAccountCode,
          accountCode
        );
        
        // LEARNING LOOP: Detect override
        const wasOverridden = plaidTxn.predictedCoaCode && 
        // LEARNING LOOP: Detect override
        const wasOverridden = !!(plaidTxn.predictedCoaCode && 
                               plaidTxn.predictedCoaCode !== accountCode);
        if (wasOverridden && plaidTxn.merchantName) {
          const merchantName = plaidTxn.merchantName;
          const categoryPrimary = (plaidTxn.personal_finance_category as any)?.primary || null;
          
          const wrongMapping = await prisma.merchantCoaMapping.findUnique({
            where: {
              merchantName_plaidCategoryPrimary: {
                merchantName,
                plaidCategoryPrimary: categoryPrimary || ''
              }
            }
          });
          
          if (wrongMapping && wrongMapping.coaCode === plaidTxn.predictedCoaCode) {
            const newConfidence = Math.max(0, wrongMapping.confidenceScore.toNumber() - 0.2);
            
            if (newConfidence < 0.3) {
              await prisma.merchantCoaMapping.delete({
                where: { id: wrongMapping.id }
              });
            } else {
              await prisma.merchantCoaMapping.update({
                where: { id: wrongMapping.id },
                data: {
                  confidenceScore: newConfidence,
                  lastUsedAt: new Date()
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
            manuallyOverridden: wasOverridden,
            overriddenAt: wasOverridden ? new Date() : null
          }
        });
        
        if (plaidTxn.merchantName) {
          const merchantName = plaidTxn.merchantName;
          const categoryPrimary = (plaidTxn.personal_finance_category as any)?.primary || null;
          const categoryDetailed = (plaidTxn.personal_finance_category as any)?.detailed || null;
          
          const existing = await prisma.merchantCoaMapping.findUnique({
            where: {
              merchantName_plaidCategoryPrimary: {
                merchantName,
                plaidCategoryPrimary: categoryPrimary || ''
              }
            }
          });
          
          if (existing && existing.coaCode === accountCode) {
            await prisma.merchantCoaMapping.update({
              where: { id: existing.id },
              data: {
                usageCount: { increment: 1 },
                confidenceScore: Math.min(0.99, existing.confidenceScore.toNumber() + 0.1),
                lastUsedAt: new Date()
              }
            });
          } else if (!existing || existing.coaCode !== accountCode) {
            await prisma.merchantCoaMapping.create({
              data: {
                merchantName,
                plaidCategoryPrimary: categoryPrimary,
                plaidCategoryDetailed: categoryDetailed,
                coaCode: accountCode,
                subAccount: subAccount || null,
                confidenceScore: wasOverridden ? 0.6 : 0.5
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
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

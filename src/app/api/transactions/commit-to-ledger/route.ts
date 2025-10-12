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
        
        // Use YOUR actual account codes with P- prefix
        const institutionName = plaidTxn.account?.plaidItem?.institutionName?.toLowerCase() || '';
        const accountType = plaidTxn.account?.type?.toLowerCase() || '';
        
        let bankAccountCode = 'P-1010'; // Personal Checking (Wells Fargo)
        
        if (institutionName.includes('robinhood') || accountType.includes('investment')) {
          bankAccountCode = 'P-1200'; // Brokerage Cash Account
        } else if (institutionName.includes('wells')) {
          bankAccountCode = 'P-1010'; // Personal Checking
        }
        
        // Create journal entry
        const journalEntry = await journalEntryService.convertPlaidTransaction(
          plaidTxn.transactionId,
          bankAccountCode,
          accountCode
        );
        
        // Update transaction with COA assignment
        await prisma.transactions.update({
          where: { id: txnId },
          data: { 
            accountCode, 
            subAccount: subAccount || null 
          }
        });
        
        // Save merchant mapping
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
          
          if (existing) {
            await prisma.merchantCoaMapping.update({
              where: { id: existing.id },
              data: {
                usageCount: { increment: 1 },
                confidenceScore: Math.min(0.99, existing.confidenceScore.toNumber() + 0.1),
                lastUsedAt: new Date()
              }
            });
          } else {
            await prisma.merchantCoaMapping.create({
              data: {
                merchantName,
                plaidCategoryPrimary: categoryPrimary,
                plaidCategoryDetailed: categoryDetailed,
                coaCode: accountCode,
                subAccount: subAccount || null,
                confidenceScore: 0.5
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

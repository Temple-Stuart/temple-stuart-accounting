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
        let bankAccountCode = 'P-1010';
        
        if (institutionName.includes('robinhood')) {
          bankAccountCode = 'P-1200';
        } else if (institutionName.includes('wells')) {
          bankAccountCode = 'P-1010';
        }
        
        const journalEntry = await journalEntryService.convertPlaidTransaction(
          plaidTxn.transaction_id,
          bankAccountCode,
          accountCode
        );
        
        await prisma.transactions.update({
          where: { id: txnId },
          data: { accountCode, subAccount: subAccount || null }
        });
        
        results.push({ txnId, journalEntryId: journalEntry.id, success: true });
        
      } catch (error: any) {
        errors.push({ txnId, error: error.message });
      }
    }
    
    return NextResponse.json({
      success: true,
      committed: results.length,
      errors: errors.length,
      results,
      errors
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

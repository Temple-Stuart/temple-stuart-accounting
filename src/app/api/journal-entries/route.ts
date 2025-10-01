import { NextRequest, NextResponse } from 'next/server';
import { journalEntryService } from '@/lib/journal-entry-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plaidTransactionId, bankAccountCode, expenseAccountCode } = body;
    
    if (!plaidTransactionId || !bankAccountCode || !expenseAccountCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const journalEntry = await journalEntryService.convertPlaidTransaction(
      plaidTransactionId,
      bankAccountCode,
      expenseAccountCode
    );
    
    return NextResponse.json({
      success: true,
      journalEntryId: journalEntry.id,
      message: 'Journal entry created successfully'
    });
    
  } catch (error: any) {
    console.error('Journal entry creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create journal entry' },
      { status: 500 }
    );
  }
}

// Get journal entries for display
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const entries = await prisma.journalTransaction.findMany({
      take: limit,
      orderBy: { transactionDate: 'desc' },
      include: {
        ledgerEntries: {
          include: {
            account: true
          }
        }
      }
    });
    
    await prisma.$disconnect();
    
    return NextResponse.json({ entries });
    
  } catch (error: any) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal entries' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId') || 'personal';
    
    // For now, return sample chart of accounts
    const sampleAccounts = [
      { id: '1', accountNumber: '1000', accountName: 'Cash', accountType: 'Asset', subType: 'Current Asset', normalBalance: 'debit', entityId },
      { id: '2', accountNumber: '1200', accountName: 'Accounts Receivable', accountType: 'Asset', subType: 'Current Asset', normalBalance: 'debit', entityId },
      { id: '3', accountNumber: '2000', accountName: 'Accounts Payable', accountType: 'Liability', subType: 'Current Liability', normalBalance: 'credit', entityId },
      { id: '4', accountNumber: '3000', accountName: 'Owners Equity', accountType: 'Equity', subType: 'Owners Equity', normalBalance: 'credit', entityId },
      { id: '5', accountNumber: '4000', accountName: 'Revenue', accountType: 'Revenue', subType: 'Operating Revenue', normalBalance: 'credit', entityId },
      { id: '6', accountNumber: '5000', accountName: 'Operating Expenses', accountType: 'Expense', subType: 'Operating Expense', normalBalance: 'debit', entityId },
    ];
    
    return NextResponse.json(sampleAccounts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch chart of accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // In production, save to database
    // const account = await prisma.chartOfAccount.create({ data });
    
    return NextResponse.json({ success: true, account: data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

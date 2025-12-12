import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transactionIds, accountCode, subAccount } = body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'transactionIds required' }, { status: 400 });
    }

    let updateCount = 0;

    for (const id of transactionIds) {
      // If subAccount not provided, fetch merchantName to auto-populate
      let finalSubAccount = subAccount;
      
      if (finalSubAccount === undefined || finalSubAccount === null) {
        const txn = await prisma.transactions.findUnique({
          where: { id },
          select: { merchantName: true, subAccount: true }
        });
        
        // Use merchantName if no subAccount provided and transaction doesn't already have one
        if (txn && !txn.subAccount && txn.merchantName) {
          finalSubAccount = txn.merchantName;
        } else if (txn?.subAccount) {
          // Keep existing subAccount if it exists
          finalSubAccount = txn.subAccount;
        }
      }

      await prisma.$executeRawUnsafe(
        `UPDATE transactions SET "accountCode" = $1, "subAccount" = $2 WHERE id = $3`,
        accountCode,
        finalSubAccount || null,
        id
      );
      updateCount++;
    }

    return NextResponse.json({ 
      success: true,
      updated: updateCount
    });

  } catch (error: any) {
    console.error('Assign COA error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

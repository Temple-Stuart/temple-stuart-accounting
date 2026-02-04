import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
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

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'transactionIds required' }, { status: 400 });
    }

    const ownedTxns = await prisma.transactions.findMany({
      where: { id: { in: transactionIds }, accounts: { userId: user.id } },
      select: { id: true, merchantName: true, subAccount: true }
    });

    if (ownedTxns.length !== transactionIds.length) {
      return NextResponse.json({ error: 'Some transactions do not belong to your account' }, { status: 403 });
    }

    let updateCount = 0;

    for (const id of transactionIds) {
      let finalSubAccount = subAccount;

      if (finalSubAccount === undefined || finalSubAccount === null) {
        const txn = ownedTxns.find(t => t.id === id);
        if (txn && !txn.subAccount && txn.merchantName) {
          finalSubAccount = txn.merchantName;
        } else if (txn?.subAccount) {
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

    return NextResponse.json({ success: true, updated: updateCount });
  } catch (error: any) {
    console.error('Assign COA error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

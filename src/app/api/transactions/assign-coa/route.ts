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

    const body = await request.json();
    const { transactionIds, accountCode, subAccount } = body;

    console.log('Transaction IDs received:', transactionIds);
    console.log('First ID:', transactionIds[0], 'Type:', typeof transactionIds[0]);

    // Update transactions using raw SQL since columns might not be in Prisma schema
    let updateCount = 0;
    for (const id of transactionIds) {
      await prisma.$executeRawUnsafe(
        `UPDATE transactions SET "accountCode" = $1, "subAccount" = $2 WHERE id = $3`,
        accountCode,
        subAccount || null,
        id
      );
      updateCount++;
    }

    return NextResponse.json({ 
      success: true,
      updated: updateCount
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

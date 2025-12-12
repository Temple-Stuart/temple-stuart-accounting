import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { transactionIds, subAccount } = await request.json();

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'transactionIds required' }, { status: 400 });
    }

    await prisma.transactions.updateMany({
      where: { id: { in: transactionIds } },
      data: { subAccount: subAccount || null }
    });

    return NextResponse.json({ success: true, updated: transactionIds.length });
  } catch (error) {
    console.error('Update sub-account error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

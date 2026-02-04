import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
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

    const { transactionIds, subAccount } = await request.json();

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'transactionIds required' }, { status: 400 });
    }

    const result = await prisma.transactions.updateMany({
      where: { id: { in: transactionIds }, accounts: { userId: user.id } },
      data: { subAccount: subAccount || null }
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    console.error('Update sub-account error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

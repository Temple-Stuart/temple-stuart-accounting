import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { accountId, entityType } = await request.json();
    if (!accountId || !entityType) {
      return NextResponse.json({ error: 'Missing accountId or entityType' }, { status: 400 });
    }

    const validTypes = ['personal', 'business', 'trading', 'retirement'];
    if (!validTypes.includes(entityType)) {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    // SECURITY: Only update accounts belonging to this user
    const account = await prisma.accounts.findFirst({
      where: { id: accountId, userId: user.id }
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await prisma.accounts.update({
      where: { id: accountId },
      data: { entityType }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating entity type:', error);
    return NextResponse.json({ error: 'Failed to update entity type' }, { status: 500 });
  }
}

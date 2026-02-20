import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { periodId } = await request.json();

    if (!periodId) {
      return NextResponse.json({ error: 'Period ID is required' }, { status: 400 });
    }

    // SECURITY: Only reopen periods owned by this user
    const period = await prisma.closing_periods.findFirst({
      where: { id: periodId, closedBy: user.id }
    });

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    await prisma.closing_periods.update({
      where: { id: periodId },
      data: {
        status: 'open',
        closedAt: null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reopen period error:', error);
    return NextResponse.json({ error: 'Failed to reopen period' }, { status: 500 });
  }
}

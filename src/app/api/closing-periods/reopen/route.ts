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

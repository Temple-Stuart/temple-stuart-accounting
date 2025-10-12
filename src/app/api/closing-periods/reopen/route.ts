import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { periodId } = await request.json();

    if (!periodId) {
      return NextResponse.json({ error: 'Period ID is required' }, { status: 400 });
    }

    const period = await prisma.closingPeriod.findUnique({
      where: { id: periodId }
    });

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // Update status to open
    await prisma.closingPeriod.update({
      where: { id: periodId },
      data: {
        status: 'open',
        closedAt: null
      }
    });

    // Note: In a production system, you would also reverse the closing entry here
    // For now, we just mark it as open

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reopen period error:', error);
    return NextResponse.json({ error: 'Failed to reopen period' }, { status: 500 });
  }
}

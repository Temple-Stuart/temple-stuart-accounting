import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const periods = await prisma.closing_periods.findMany({
      where: { closedBy: user.id },
      orderBy: { periodEnd: 'desc' }
    });

    return NextResponse.json({ periods });
  } catch (error) {
    console.error('Closing periods fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch closing periods' }, { status: 500 });
  }
}

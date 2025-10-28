import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const periods = await prisma.closing_periods.findMany({
      orderBy: { periodEnd: 'desc' }
    });

    return NextResponse.json({ periods });
  } catch (error) {
    console.error('Closing periods fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch closing periods' }, { status: 500 });
  }
}

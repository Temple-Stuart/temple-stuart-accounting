import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    
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

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const events = await prisma.$queryRaw<Array<{
      source: string;
      start_date: Date;
      budget_amount: number;
    }>>`
      SELECT source, start_date, budget_amount
      FROM calendar_events
      WHERE user_id = ${user.id}
        AND start_date >= ${startOfYear}
        AND start_date <= ${endOfYear}
    `;

    const monthlyData: Record<number, Record<string, number>> = {};
    for (let m = 0; m < 12; m++) {
      monthlyData[m] = { home: 0, auto: 0, shopping: 0, personal: 0, health: 0, growth: 0, trip: 0, total: 0 };
    }

    for (const event of events) {
      const month = new Date(event.start_date).getMonth();
      const amount = Number(event.budget_amount || 0);
      const source = event.source || 'personal';
      
      if (monthlyData[month][source] !== undefined) {
        monthlyData[month][source] += amount;
      }
      // Exclude trips from lease apartment total
      if (source !== 'trip') {
        monthlyData[month].total += amount;
      }
    }

    return NextResponse.json({ year, monthlyData });
  } catch (error) {
    console.error('Year calendar error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}

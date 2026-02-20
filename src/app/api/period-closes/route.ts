import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    const periods = await prisma.period_closes.findMany({
      where: { userId: user.id, year },
      orderBy: { month: 'asc' }
    });

    return NextResponse.json({ periods });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch periods' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { year, month, action, notes } = body;

    if (action === 'close') {
      const period = await prisma.period_closes.upsert({
        where: {
          userId_year_month: { userId: user.id, year, month }
        },
        update: {
          status: 'closed',
          closedAt: new Date(),
          closedBy: user.email,
          notes
        },
        create: {
          userId: user.id,
          year,
          month,
          status: 'closed',
          closedAt: new Date(),
          closedBy: user.email,
          notes
        }
      });
      return NextResponse.json({ period });
    } else if (action === 'reopen') {
      const period = await prisma.period_closes.update({
        where: {
          userId_year_month: { userId: user.id, year, month }
        },
        data: {
          status: 'open',
          reopenedAt: new Date(),
          reopenedBy: user.email
        }
      });
      return NextResponse.json({ period });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to update period' }, { status: 500 });
  }
}

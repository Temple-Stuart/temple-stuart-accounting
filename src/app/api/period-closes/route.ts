import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

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
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

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
          closedBy: userEmail,
          notes
        },
        create: {
          userId: user.id,
          year,
          month,
          status: 'closed',
          closedAt: new Date(),
          closedBy: userEmail,
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
          reopenedBy: userEmail
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

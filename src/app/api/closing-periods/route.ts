import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
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

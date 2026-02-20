import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
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

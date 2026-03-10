import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { scanner_start_date: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ scanner_start_date: user.scanner_start_date });
  } catch (error) {
    console.error('GET scanner-start-date error:', error);
    return NextResponse.json({ error: 'Failed to fetch scanner start date' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { scanner_start_date } = body;

    const dateValue = scanner_start_date ? new Date(scanner_start_date) : null;
    if (scanner_start_date && isNaN(dateValue!.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const updated = await prisma.users.update({
      where: { id: user.id },
      data: { scanner_start_date: dateValue },
      select: { scanner_start_date: true },
    });

    return NextResponse.json({ scanner_start_date: updated.scanner_start_date });
  } catch (error) {
    console.error('PATCH scanner-start-date error:', error);
    return NextResponse.json({ error: 'Failed to update scanner start date' }, { status: 500 });
  }
}

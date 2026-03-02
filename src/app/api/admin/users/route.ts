import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyCookie } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get('adminSession')?.value;
    if (!raw || verifyCookie(raw) !== 'admin-session') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await prisma.users.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        tier: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        bookkeeping_initialized: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

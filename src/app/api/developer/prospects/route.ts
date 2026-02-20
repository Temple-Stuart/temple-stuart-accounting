import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const prospects = await prisma.prospects.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(prospects);
  } catch (error) {
    console.error('Error fetching prospects:', error);
    return NextResponse.json([]);
  }
}

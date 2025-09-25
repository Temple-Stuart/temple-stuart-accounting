import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.users.findMany({
      include: {
        _count: {
          select: { accounts: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json([]);
  }
}

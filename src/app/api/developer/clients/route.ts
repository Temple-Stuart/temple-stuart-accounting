import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.users.findMany({
      include: {
        accounts: {
          include: {
            plaidItem: true
          }
        },
        _count: {
          select: { 
            accounts: true,
            transactions: true
          }
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

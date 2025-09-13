import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        plaidItems: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

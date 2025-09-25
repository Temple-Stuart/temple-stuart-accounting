import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const prospects = await prisma.prospects.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(prospects);
  } catch (error) {
    console.error('Error fetching prospects:', error);
    return NextResponse.json([]);
  }
}

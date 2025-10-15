import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { autoCategorizationService } from '@/lib/auto-categorization-service';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const result = await autoCategorizationService.autoCategorizePendingTransactions(userId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Auto-categorization error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-categorize transactions' },
      { status: 500 }
    );
  }
}

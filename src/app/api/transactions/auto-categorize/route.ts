import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { autoCategorizationService } from '@/lib/auto-categorization-service';

export async function POST() {
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

    const result = await autoCategorizationService.categorizePendingTransactions();

    return NextResponse.json({
      success: true,
      categorized: result.categorized,
      failed: result.failed,
      message: `Categorized ${result.categorized} transactions, ${result.failed} failed`
    });
  } catch (error: any) {
    console.error('Auto-categorization error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

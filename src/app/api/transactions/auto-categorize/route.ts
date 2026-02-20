import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { autoCategorizationService } from '@/lib/auto-categorization-service';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function POST() {
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

    const result = await autoCategorizationService.categorizePendingTransactions(user.id);

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

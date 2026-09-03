import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { autoCategorizationService } from '@/lib/auto-categorization-service';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[CRON] Starting auto-categorization...');

    // Process each user separately for proper data isolation
    const users = await prisma.users.findMany({ select: { id: true, email: true } });
    let totalCategorized = 0;
    let totalFailed = 0;

    for (const user of users) {
      const result = await autoCategorizationService.categorizePendingTransactions(user.id);
      totalCategorized += result.categorized;
      totalFailed += result.failed;
      if (result.categorized > 0 || result.failed > 0) {
        console.log(`[CRON] ${user.email}: ${result.categorized} categorized, ${result.failed} failed`);
      }
    }

    console.log(`[CRON] Complete: ${totalCategorized} categorized, ${totalFailed} failed across ${users.length} users`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      categorized: totalCategorized,
      failed: totalFailed
    });

  } catch (error: any) {
    return failClosedResponse('CRON auto-categorization', 'Auto-categorization failed', error);
  }
}

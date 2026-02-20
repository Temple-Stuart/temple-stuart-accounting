import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
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

    const expected = `Bearer ${cronSecret}`;
    const inputBuf = Buffer.from(authHeader ?? '');
    const expectedBuf = Buffer.from(expected);
    if (inputBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(inputBuf, expectedBuf)) {
      console.error('Unauthorized cron attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('[CRON] Starting auto-categorization...');
    
    const result = await autoCategorizationService.categorizePendingTransactions();
    
    console.log(`[CRON] Complete: ${result.categorized} categorized, ${result.failed} failed`);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      categorized: result.categorized,
      failed: result.failed
    });
    
  } catch (error: any) {
    console.error('[CRON] Auto-categorization error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

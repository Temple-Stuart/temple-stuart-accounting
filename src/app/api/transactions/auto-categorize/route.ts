import { NextResponse } from 'next/server';
import { autoCategorizationService } from '@/lib/auto-categorization-service';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

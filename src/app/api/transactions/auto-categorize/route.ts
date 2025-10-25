import { NextResponse } from 'next/server';
import { autoCategorizationService } from '@/lib/auto-categorization-service';

export async function POST() {
  try {
    const result = await autoCategorizationService.categorizePendingTransactions();
    
    return NextResponse.json({
      success: true,
      categorized: result.categorized,
      failed: result.failed,
      message: `Categorized ${result.categorized} transactions, ${result.failed} failed`
    });
  } catch (error: any) {
    console.error('Auto-categorization error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

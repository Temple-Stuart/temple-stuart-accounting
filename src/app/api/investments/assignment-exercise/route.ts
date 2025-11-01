import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { positionTrackerService } from '@/lib/position-tracker-service';

export async function POST(request: Request) {
  try {
    const { pairs, strategy, tradeNum } = await request.json();
    
    if (!pairs || !Array.isArray(pairs)) {
      return NextResponse.json(
        { error: 'pairs array required' },
        { status: 400 }
      );
    }
    
    const results = [];
    
    for (const pair of pairs) {
      const { transferId, stockId } = pair;
      
      // Fetch both transactions
      const [transferTxn, stockTxn] = await Promise.all([
        prisma.investment_transactions.findUnique({
          where: { id: transferId },
          include: { security: true }
        }),
        prisma.investment_transactions.findUnique({
          where: { id: stockId },
          include: { security: true }
        })
      ]);
      
      if (!transferTxn || !stockTxn) {
        throw new Error(`Transaction not found: ${transferId} or ${stockId}`);
      }
      
      const result = await positionTrackerService.handleAssignmentExercise({
        exerciseTransfer: transferTxn,
        stockTransaction: stockTxn,
        strategy: strategy || 'ITM Spread Expiration',
        tradeNum: tradeNum || 'AUTO'
      });
      
      results.push(result);
    }
    
    return NextResponse.json({
      success: true,
      processed: pairs.length,
      results
    });
    
  } catch (error: any) {
    console.error('Assignment/Exercise error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process assignment/exercise' },
      { status: 500 }
    );
  }
}

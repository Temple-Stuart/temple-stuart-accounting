import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { autoCategorizationService } from '@/lib/auto-categorization-service';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionIds } = body;
    
    if (!transactionIds || !Array.isArray(transactionIds)) {
      return NextResponse.json(
        { error: 'transactionIds array required' },
        { status: 400 }
      );
    }
    
    const transactions = await prisma.transactions.findMany({
      where: { id: { in: transactionIds } }
    });
    
    const txnsToCategor = transactions.map(t => ({
      id: t.id,
      merchantName: t.merchantName || t.name,
      plaidCategoryPrimary: t.personal_finance_category?.primary,
      plaidCategoryDetailed: t.personal_finance_category?.detailed,
      amount: t.amount
    }));
    
    const suggestions = await autoCategorizationService.suggestCategories(txnsToCategor);
    
    return NextResponse.json({ suggestions });
    
  } catch (error: any) {
    console.error('Auto-categorization error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

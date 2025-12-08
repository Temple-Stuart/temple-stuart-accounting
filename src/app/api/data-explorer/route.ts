import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  
  try {
    let transactions: any[] = [];
    let investments: any[] = [];
    
    if (type === 'transactions' || type === 'all') {
      transactions = await prisma.transactions.findMany({
        include: { accounts: true },
        orderBy: { date: 'desc' },
        take: 5000
      });
    }
    
    if (type === 'investments' || type === 'all') {
      investments = await prisma.investment_transactions.findMany({
        include: { 
          security: true,
          accounts: true 
        },
        orderBy: { date: 'desc' },
        take: 5000
      });
    }
    
    await prisma.$disconnect();
    
    return NextResponse.json({
      transactions,
      investments,
      meta: {
        transactionCount: transactions.length,
        investmentCount: investments.length,
        fetchedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    await prisma.$disconnect();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

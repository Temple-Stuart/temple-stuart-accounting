import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantName = searchParams.get('merchantName');
    const categoryPrimary = searchParams.get('categoryPrimary');
    
    let mappings;
    
    if (merchantName) {
      mappings = await prisma.merchantCoaMapping.findMany({
        where: { merchantName: { contains: merchantName, mode: 'insensitive' } },
        orderBy: [
          { confidenceScore: 'desc' },
          { usageCount: 'desc' }
        ],
        take: 5
      });
    } else if (categoryPrimary) {
      mappings = await prisma.merchantCoaMapping.findMany({
        where: { plaidCategoryPrimary: categoryPrimary },
        orderBy: [
          { confidenceScore: 'desc' },
          { usageCount: 'desc' }
        ],
        take: 10
      });
    } else {
      mappings = await prisma.merchantCoaMapping.findMany({
        orderBy: { lastUsedAt: 'desc' },
        take: 50
      });
    }
    
    return NextResponse.json({ mappings });
  } catch (error: any) {
    console.error('Merchant mapping fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch merchant mappings', details: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merchantName, plaidCategoryPrimary, plaidCategoryDetailed, coaCode, subAccount } = body;
    
    if (!merchantName || !coaCode) {
      return NextResponse.json(
        { error: 'merchantName and coaCode required' },
        { status: 400 }
      );
    }
    
    const existing = await prisma.merchantCoaMapping.findUnique({
      where: {
        merchantName_plaidCategoryPrimary: {
          merchantName,
          plaidCategoryPrimary: plaidCategoryPrimary || ''
        }
      }
    });
    
    if (existing) {
      const updated = await prisma.merchantCoaMapping.update({
        where: { id: existing.id },
        data: {
          usageCount: { increment: 1 },
          confidenceScore: Math.min(0.99, existing.confidenceScore.toNumber() + 0.1),
          lastUsedAt: new Date()
        }
      });
      return NextResponse.json({ mapping: updated, action: 'updated' });
    } else {
      const created = await prisma.merchantCoaMapping.create({
        data: {
          merchantName,
          plaidCategoryPrimary,
          plaidCategoryDetailed,
          coaCode,
          subAccount,
          confidenceScore: 0.5
        }
      });
      return NextResponse.json({ mapping: created, action: 'created' });
    }
  } catch (error: any) {
    console.error('Merchant mapping save error:', error);
    return NextResponse.json(
      { error: 'Failed to save merchant mapping', details: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

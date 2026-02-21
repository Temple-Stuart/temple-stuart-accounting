import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const merchantName = searchParams.get('merchantName');
    const categoryPrimary = searchParams.get('categoryPrimary');

    // SECURITY: All queries scoped to authenticated user
    let mappings;

    if (merchantName) {
      mappings = await prisma.merchant_coa_mappings.findMany({
        where: {
          userId: user.id,
          merchant_name: { contains: merchantName, mode: 'insensitive' }
        },
        orderBy: [
          { confidence_score: 'desc' },
          { usage_count: 'desc' }
        ],
        take: 5
      });
    } else if (categoryPrimary) {
      mappings = await prisma.merchant_coa_mappings.findMany({
        where: {
          userId: user.id,
          plaid_category_primary: categoryPrimary
        },
        orderBy: [
          { confidence_score: 'desc' },
          { usage_count: 'desc' }
        ],
        take: 10
      });
    } else {
      mappings = await prisma.merchant_coa_mappings.findMany({
        where: { userId: user.id },
        orderBy: { last_used_at: 'desc' },
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
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { merchant_name, plaidCategoryPrimary, plaidCategoryDetailed, coaCode, subAccount } = body;

    if (!merchant_name || !coaCode) {
      return NextResponse.json({ error: 'merchantName and coaCode required' }, { status: 400 });
    }

    // SECURITY: Lookup scoped to user's mappings only
    const existing = await prisma.merchant_coa_mappings.findUnique({
      where: {
        userId_merchant_name_plaid_category_primary: {
          userId: user.id,
          merchant_name,
          plaid_category_primary: plaidCategoryPrimary || ''
        }
      }
    });

    if (existing) {
      const updated = await prisma.merchant_coa_mappings.update({
        where: { id: existing.id },
        data: {
          coa_code: coaCode,
          sub_account: subAccount || null,
          usage_count: { increment: 1 },
          confidence_score: Math.min(0.99, existing.confidence_score.toNumber() + 0.1),
          last_used_at: new Date()
        }
      });
      return NextResponse.json({ mapping: updated, action: 'updated' });
    } else {
      const created = await prisma.merchant_coa_mappings.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          merchant_name,
          plaid_category_primary: plaidCategoryPrimary,
          plaid_category_detailed: plaidCategoryDetailed,
          coa_code: coaCode,
          sub_account: subAccount,
          confidence_score: 0.5
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
  }
}

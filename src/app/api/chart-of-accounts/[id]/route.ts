import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, accountType, balanceType, code } = body;

    // Verify account exists and belongs to user
    const existing = await prisma.chart_of_accounts.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // If code is changing, check uniqueness within entity
    if (code && code !== existing.code) {
      const duplicate = await prisma.chart_of_accounts.findFirst({
        where: { userId: user.id, entity_id: existing.entity_id, code, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: `Account code "${code}" already exists for this entity` },
          { status: 409 }
        );
      }
    }

    const BALANCE_TYPE_MAP: Record<string, string> = {
      asset: 'D', expense: 'D', liability: 'C', equity: 'C', revenue: 'C',
    };

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (accountType !== undefined) {
      const normalized = accountType.toLowerCase();
      const bt = BALANCE_TYPE_MAP[normalized];
      if (!bt) {
        return NextResponse.json(
          { error: 'Invalid accountType. Must be asset, liability, equity, revenue, or expense' },
          { status: 400 }
        );
      }
      updateData.account_type = normalized;
      updateData.balance_type = bt;
    }
    if (balanceType !== undefined && !accountType) {
      updateData.balance_type = balanceType;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await prisma.chart_of_accounts.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      account: {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        accountType: updated.account_type,
        balanceType: updated.balance_type,
        settledBalance: Number(updated.settled_balance),
        pendingBalance: Number(updated.pending_balance),
        entity_id: updated.entity_id,
        entity_type: updated.entity_type,
        version: Number(updated.version),
        is_archived: updated.is_archived,
      },
    });
  } catch (error) {
    console.error('COA update error:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

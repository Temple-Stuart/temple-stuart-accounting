import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';

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
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    const { id } = await params;
    const body = await request.json();
    // DIM-2 adds subType (the dimensional S segment, nullable — null clears it).
    const { name, accountType, balanceType, code, subType } = body;

    // Verify account exists and belongs to user
    const existing = await prisma.chart_of_accounts.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // If code is changing, check uniqueness within entity.
    // DIM-2 NOTE: code changes on accounts WITH POSTED HISTORY are un-guarded
    // here today (this pre-DIM-2 capability is preserved as-is) — whether a
    // posted account's code may change, and what that means for the literal
    // code matchers (merchant mappings, trading writers), is a DIM-3+ decision.
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
    if (subType !== undefined) {
      if (subType !== null && typeof subType !== 'string') {
        return NextResponse.json({ error: 'subType must be a string or null' }, { status: 400 });
      }
      updateData.sub_type = typeof subType === 'string' && subType.trim() ? subType.trim() : null;
    }
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
        subType: updated.sub_type,
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

// ─── DIM-2: archive / unarchive — accounts are NEVER deleted ─────────────────
// Removal from the working chart is is_archived = true, full stop: an account
// with posted ledger history is a permanent financial record (and the DB's
// ledger_entries.account FK is Restrict — deletion would fail anyway). PATCH
// { archived: boolean } flips the flag both ways; same auth chain as PUT
// (verified email → user → tab:books → user-scoped ownership, defensive 404).
export async function PATCH(
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
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (typeof body?.archived !== 'boolean') {
      return NextResponse.json({ error: 'archived must be true or false' }, { status: 400 });
    }

    const existing = await prisma.chart_of_accounts.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const updated = await prisma.chart_of_accounts.update({
      where: { id },
      data: { is_archived: body.archived },
    });

    return NextResponse.json({
      success: true,
      account: { id: updated.id, code: updated.code, is_archived: updated.is_archived },
    });
  } catch (error) {
    console.error('COA archive error:', error);
    return NextResponse.json({ error: 'Failed to update archive state' }, { status: 500 });
  }
}

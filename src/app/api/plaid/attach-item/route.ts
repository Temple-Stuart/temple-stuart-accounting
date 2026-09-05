import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { ValidationError } from '@/lib/errors/ValidationError';
import { attachItem, describePlan } from '@/lib/plaid/attachItem';
import { prismaAttach } from '@/lib/plaid/prismaAttach';

/**
 * POST /api/plaid/attach-item { itemId, dryRun? }
 * BANK-03, OWNER-ONLY (requireAdmin → OWNER_EMAIL): attach the fresh item
 * `itemId` (plaid_items.id, the caller's own) to the account rows that already
 * carry the history — matched by institutionId + mask, one-to-one — and retire
 * the item it replaces. One transaction; every integrity assertion throws →
 * rollback → 500 envelope. `dryRun: true` answers the plan and writes nothing.
 * A plan that stops (ambiguity, a collision, no match) is a 409 with the reason;
 * nothing to do is a 200 saying so. No Plaid call, no token read.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;

    const user = await prisma.users.findFirst({ where: { email: { equals: admin, mode: 'insensitive' } } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { itemId?: unknown; dryRun?: unknown };
    if (typeof body.itemId !== 'string' || body.itemId.trim() === '') throw new ValidationError('itemId is required', { field: 'itemId' });
    const dryRun = body.dryRun === true;

    const { plan, report } = await attachItem(prismaAttach(prisma), { userId: user.id, newItemRowId: body.itemId, dryRun });
    const stage = 'attach-item';
    if (plan.kind === 'stop') {
      const status = plan.reason === 'Bank connection not found' ? 404 : 409;
      return NextResponse.json({ ok: false, stage, error: plan.reason, message: plan.reason }, { status });
    }
    if (plan.kind === 'nothing') {
      return NextResponse.json({ ok: true, stage, message: plan.reason, plan: { kind: 'nothing' } });
    }
    const summary = {
      kind: 'merge',
      newItem: { id: plan.newItem.id, itemId: plan.newItem.itemId, institutionName: plan.newItem.institutionName },
      oldItem: { id: plan.oldItem.id, itemId: plan.oldItem.itemId, institutionName: plan.oldItem.institutionName },
      pairs: plan.pairs.map((p) => ({ mask: p.mask, oldAccountId: p.oldRow.id, newAccountId: p.newRow.id, survivor: p.survivorIs, before: p.before })),
      unmatchedNew: plan.unmatchedNew.map((a) => a.id),
      unmatchedOld: plan.unmatchedOld.map((a) => a.id),
      totalBefore: plan.totalBefore,
      retireReason: plan.retireReason,
    };
    if (dryRun) {
      return NextResponse.json({ ok: true, stage, dryRun: true, message: `DRY RUN — ${describePlan(plan)}`, plan: summary });
    }
    return NextResponse.json({
      ok: true,
      stage,
      message: `${plan.newItem.institutionName ?? 'The new item'}: ${report?.pairs.length ?? 0} account(s) attached; ${plan.oldItem.institutionName ?? 'the old item'} retired`,
      plan: summary,
      report,
    });
  } catch (error: unknown) {
    return failClosedResponse('api/plaid/attach-item POST', 'Failed to attach the item', error);
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireEntitySetup } from '@/lib/ensure-bookkeeping';
import { requireTabAccess } from '@/lib/auth-helpers';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { applySeed } from '@/lib/coa/accounts';
import { prismaChartDb } from '@/lib/coa/prismaChartDb';
import { planSeed, seedSet, seedSetsFor } from '@/lib/coa/seedSets';

/**
 * POST /api/chart-of-accounts/seed — COA-01's in-product seed, the honest
 * path (a migration cannot see a user's chart or report a collision).
 *
 *   { entityId, setKey, apply: false }  → the plan: every row's fate against
 *                                        THIS entity's chart, nothing written;
 *   { entityId, setKey, apply: true }   → inserts the 'create' rows in one
 *                                        transaction and returns the plan with
 *                                        what was created. Idempotent: a second
 *                                        apply creates nothing (every row 'exists').
 *
 * A collision (the code holds another name) is reported and never overwritten;
 * a retired match is reported (restore it — never re-added). The set must
 * apply to the entity's letter. Gate: verified email → user → tab:books →
 * the entity is the user's (defensive 404).
 */
export async function POST(request: Request) {
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

    // SELL-04: a user with no entity gets the declared setup line (412) — nothing is created here.
    const setup = await requireEntitySetup(user);
    if (setup) return setup;

    const body = await request.json().catch(() => ({}));
    const { entityId, setKey } = body ?? {};
    const apply = body?.apply === true;

    if (typeof entityId !== 'string' || !entityId) {
      return NextResponse.json({ error: 'entityId is required', field: 'entityId' }, { status: 400 });
    }
    const set = typeof setKey === 'string' ? seedSet(setKey) : undefined;
    if (!set) {
      return NextResponse.json({ error: 'setKey is not a seed set', field: 'setKey' }, { status: 400 });
    }

    const entity = await prisma.entities.findFirst({
      where: { id: entityId, userId: user.id },
      select: { id: true, name: true, entity_type: true },
    });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const existing = await prisma.chart_of_accounts.findMany({
      where: { userId: user.id, entity_id: entity.id, code: { in: set.accounts.map((a) => a.code) } },
      select: { id: true, code: true, name: true, is_archived: true },
    });
    const plan = planSeed(set, entity, existing);

    let created: string[] = [];
    if (apply) {
      created = await prisma.$transaction(async (tx) => {
        const rows = await applySeed(prismaChartDb(tx, user.id), { userId: user.id, entity }, plan);
        return rows.map((r) => r.code);
      });
    }

    return NextResponse.json({
      success: true,
      applied: apply,
      set: { key: set.key, label: set.label, why: set.why },
      entity: { id: entity.id, name: entity.name, entity_type: entity.entity_type },
      plan,
      created,
      counts: {
        create: plan.filter((r) => r.action === 'create').length,
        exists: plan.filter((r) => r.action === 'exists').length,
        collision: plan.filter((r) => r.action === 'collision').length,
        retired: plan.filter((r) => r.action === 'retired').length,
      },
      availableSets: seedSetsFor(entity.entity_type).map((s) => s.key),
    });
  } catch (error) {
    return failClosedResponse('COA seed', 'Failed to seed accounts', error);
  }
}

import { NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { createEntity } from '@/lib/entities/setup';
import { prismaEntityDb } from '@/lib/entities/prismaEntityDb';

export async function GET() {
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

    const entities = await prisma.entities.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, entity_type: true, is_default: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ entities });
  } catch (error) {
    return failClosedResponse('Entities API', 'Entities read failed', error);
  }
}

/**
 * POST /api/entities { name, entity_type } — SELL-04: THE entity creator, the
 * first-run step's one call. User-scoped by construction (the row carries the
 * authed user's id; the port is handed it); the kind must be one the routes
 * read (personal | sole_prop — src/lib/entities/kinds.ts); the name is unique
 * for the user (409). The entity, its starter chart and its Schedule C
 * mappings land in ONE transaction; the user's first entity becomes their
 * default and sets bookkeeping_initialized (what the old silent path set).
 * Gate: verified email → user → tab:books (Books' write surfaces' gate).
 */
export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    const body = await request.json().catch(() => ({}));
    const taxYear = new Date().getFullYear();
    const created = await prisma.$transaction((tx) => createEntity(prismaEntityDb(tx, user.id), { userId: user.id, body, taxYear }));

    return NextResponse.json(
      {
        success: true,
        entity: { id: created.entity.id, name: created.entity.name, entity_type: created.entity.entity_type, is_default: created.entity.is_default },
        chart: created.chart,
        isFirst: created.isFirst,
        taxYear,
      },
      { status: 201 },
    );
  } catch (error) {
    return failClosedResponse('Entity setup', 'Failed to create the entity', error);
  }
}

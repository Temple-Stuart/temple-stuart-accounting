/**
 * /api/operations/content/grid
 *
 * GET — returns everything the PieceGrid needs for the authenticated
 * user, in three user-scoped reads:
 *   - scenes  (operations_content_scenes): the grid ROWS — stable shot
 *             metadata, each joined to its routine_step for order/activity
 *             labels, ordered by step_order.
 *   - pieces  (operations_content_pieces): the grid COLUMNS — days,
 *             ordered by piece_date.
 *   - cells   (operations_content_takes): the per-(scene × piece) script.
 * Optional ?entity_id filter (validated). Read-only — no audit.
 *
 * Every query is WHERE user_id = authed user; a cell only surfaces if its
 * own row is the user's, so cross-user data can never appear in the grid.
 * Auth pattern mirrors src/app/api/operations/content/takes/route.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    let entityId: string | undefined;
    if (searchParams.has('entity_id')) {
      const raw = searchParams.get('entity_id');
      if (typeof raw !== 'string' || raw.length === 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'entity_id', message: 'entity_id must be a non-empty string' },
          { status: 400 }
        );
      }
      entityId = raw;
    }

    const scope = { user_id: user.id, ...(entityId ? { entity_id: entityId } : {}) };

    const [scenes, pieces, cells] = await Promise.all([
      prisma.operations_content_scenes.findMany({
        where: scope,
        include: {
          routine_step: {
            select: {
              id: true,
              step_order: true,
              activity: true,
              time_of_day: true,
              routine_id: true,
            },
          },
        },
        orderBy: [{ routine_step: { step_order: 'asc' } }, { created_at: 'asc' }],
      }),
      prisma.operations_content_pieces.findMany({
        where: scope,
        orderBy: [{ piece_date: 'asc' }, { created_at: 'asc' }],
      }),
      prisma.operations_content_takes.findMany({
        where: scope,
      }),
    ]);

    return NextResponse.json({ scenes, pieces, cells });
  } catch (error) {
    console.error('[Content Grid GET]', error);
    return NextResponse.json(
      { error: 'Failed to load grid', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

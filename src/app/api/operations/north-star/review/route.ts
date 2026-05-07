/**
 * /api/operations/north-star/review
 *
 * POST — record a review-without-edit attestation. Updates only
 *        last_reviewed_at to NOW() and recomputes next_review_at as
 *        last_reviewed_at + review_cadence_days. Hash-chains an audit
 *        entry with action_type operations_north_star_reviewed.
 *
 * Distinct from POST /api/operations/north-star (which records edits).
 * Bridgewater convention: "I read this and it still holds" is its own
 * audit-evidentiary event, separate from content changes. SOC 2 evidence-
 * of-review controls work this way.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

export async function POST() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const existing = await prisma.operations_north_star.findUnique({
      where: { user_id: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'No north star to review', message: 'create one first via POST /api/operations/north-star' },
        { status: 404 }
      );
    }

    const now = new Date();
    const nextReview = new Date(now.getTime() + existing.review_cadence_days * 24 * 60 * 60 * 1000);

    const northStar = await prisma.operations_north_star.update({
      where: { user_id: user.id },
      data: {
        last_reviewed_at: now,
        next_review_at: nextReview,
      },
    });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_north_star_reviewed',
        description: `Reviewed north star (no content change) for ${userEmail}; next review due ${nextReview.toISOString()}`,
      },
      target: {
        table: 'operations_north_star',
        id: northStar.id,
      },
      payload: {
        before: existing,
        after: northStar,
        metadata: {
          review_cadence_days: existing.review_cadence_days,
          previous_review_at: existing.last_reviewed_at?.toISOString() ?? null,
        },
      },
    });

    return NextResponse.json({ northStar });
  } catch (error) {
    console.error('[North Star Review]', error);
    return NextResponse.json(
      { error: 'Failed to record review', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

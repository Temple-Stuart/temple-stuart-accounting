/**
 * /api/operations/north-star
 *
 * GET  — return the current user's operations_north_star row, or null if absent.
 *        No audit write (read-only).
 *
 * POST — upsert the current user's row from the request body. Hash-chains
 *        an audit_log entry for the create or update event.
 *
 * Pattern mirrors src/app/api/discovery/profile/route.ts: inline auth,
 * inline user lookup, sequential prisma + writeAuditLog awaits (NOT
 * transactional — matches existing convention; partial-failure tolerance
 * relies on writeAuditLog's internal P2034/P2024 retry).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const northStar = await prisma.operations_north_star.findUnique({
      where: { user_id: user.id },
    });

    return NextResponse.json({ northStar });
  } catch (error) {
    console.error('[North Star GET]', error);
    return NextResponse.json(
      { error: 'Failed to load north star', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();

    // Validation: review_cadence_days must be positive (DB CHECK constraint).
    // Strings normalize empty → null. core_values must be a string array.
    const review_cadence_days =
      typeof body.review_cadence_days === 'number' ? body.review_cadence_days : 90;
    if (review_cadence_days <= 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'review_cadence_days', message: 'must be positive' },
        { status: 400 }
      );
    }

    if (body.core_values !== undefined && !Array.isArray(body.core_values)) {
      return NextResponse.json(
        { error: 'Validation', field: 'core_values', message: 'must be an array of strings' },
        { status: 400 }
      );
    }

    const norm = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t.length > 0 ? t : null;
    };

    const data = {
      mission_statement: norm(body.mission_statement),
      life_stage: norm(body.life_stage),
      core_values: Array.isArray(body.core_values)
        ? body.core_values.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
        : [],
      guiding_principles: norm(body.guiding_principles),
      one_year_target: norm(body.one_year_target),
      three_year_target: norm(body.three_year_target),
      current_location_label: norm(body.current_location_label),
      current_timezone: norm(body.current_timezone) ?? 'America/Los_Angeles',
      review_cadence_days,
    };

    const existing = await prisma.operations_north_star.findUnique({
      where: { user_id: user.id },
    });
    const isCreate = !existing;

    const northStar = await prisma.operations_north_star.upsert({
      where: { user_id: user.id },
      create: {
        user_id: user.id,
        created_by: userEmail,
        ...data,
      },
      update: data,
    });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: isCreate ? 'operations_north_star_created' : 'operations_north_star_updated',
        description: isCreate
          ? `Created north star for ${userEmail}`
          : `Updated north star for ${userEmail}`,
      },
      target: {
        table: 'operations_north_star',
        id: northStar.id,
      },
      payload: {
        before: existing ?? undefined,
        after: northStar,
      },
    });

    return NextResponse.json({ northStar, isCreate }, { status: isCreate ? 201 : 200 });
  } catch (error) {
    console.error('[North Star POST]', error);
    return NextResponse.json(
      { error: 'Failed to save north star', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

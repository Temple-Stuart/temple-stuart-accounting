import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

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

    const { entityId, year, month } = await request.json();

    if (!entityId || !year || !month) {
      return NextResponse.json(
        { error: 'entityId, year, and month are required' },
        { status: 400 }
      );
    }

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'month must be 1-12' }, { status: 400 });
    }

    // Verify entity belongs to user
    const entity = await prisma.entities.findFirst({
      where: { id: entityId, userId: user.id },
    });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Check if already closed
    const existing = await prisma.closing_periods.findUnique({
      where: {
        userId_entity_id_year_month: {
          userId: user.id,
          entity_id: entityId,
          year,
          month,
        },
      },
    });

    if (existing && existing.status === 'closed') {
      return NextResponse.json({ error: 'Period already closed' }, { status: 409 });
    }

    // If previously reopened, update back to closed; otherwise create
    let record;
    if (existing) {
      record = await prisma.closing_periods.update({
        where: { id: existing.id },
        data: {
          status: 'closed',
          closed_at: new Date(),
          closed_by: userEmail,
          reopened_at: null,
          reopened_by: null,
          notes: null,
        },
      });
    } else {
      record = await prisma.closing_periods.create({
        data: {
          userId: user.id,
          entity_id: entityId,
          year,
          month,
          status: 'closed',
          closed_by: userEmail,
        },
      });
    }

    return NextResponse.json({
      success: true,
      period: {
        id: record.id,
        entityId: record.entity_id,
        year: record.year,
        month: record.month,
        status: record.status,
        closedAt: record.closed_at,
        closedBy: record.closed_by,
      },
    });
  } catch (error) {
    console.error('Close period error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

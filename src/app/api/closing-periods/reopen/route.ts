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

    const { entityId, year, month, notes } = await request.json();

    if (!entityId || !year || !month) {
      return NextResponse.json(
        { error: 'entityId, year, and month are required' },
        { status: 400 }
      );
    }

    // Notes are REQUIRED for reopen — audit trail
    if (!notes || !notes.trim()) {
      return NextResponse.json(
        { error: 'notes is required when reopening a period (audit trail)' },
        { status: 400 }
      );
    }

    // Verify entity belongs to user
    const entity = await prisma.entities.findFirst({
      where: { id: entityId, userId: user.id },
    });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Find the closed period
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

    if (!existing || existing.status !== 'closed') {
      return NextResponse.json(
        { error: 'Period not found or already open' },
        { status: 404 }
      );
    }

    const record = await prisma.closing_periods.update({
      where: { id: existing.id },
      data: {
        status: 'reopened',
        reopened_at: new Date(),
        reopened_by: userEmail,
        notes: notes.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      period: {
        id: record.id,
        entityId: record.entity_id,
        year: record.year,
        month: record.month,
        status: record.status,
        reopenedAt: record.reopened_at,
        reopenedBy: record.reopened_by,
        notes: record.notes,
      },
    });
  } catch (error) {
    console.error('Reopen period error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

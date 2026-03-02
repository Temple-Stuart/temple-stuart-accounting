import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');
    const yearParam = searchParams.get('year');

    const where: any = { userId: user.id };
    if (entityId) where.entity_id = entityId;
    if (yearParam) where.year = parseInt(yearParam, 10);

    const periods = await prisma.closing_periods.findMany({
      where,
      include: { entity: { select: { name: true, entity_type: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return NextResponse.json({
      periods: periods.map((p: any) => ({
        id: p.id,
        entityId: p.entity_id,
        entityName: p.entity.name,
        entityType: p.entity.entity_type,
        year: p.year,
        month: p.month,
        status: p.status,
        closedAt: p.closed_at,
        closedBy: p.closed_by,
        reopenedAt: p.reopened_at,
        reopenedBy: p.reopened_by,
        notes: p.notes,
      })),
    });
  } catch (error) {
    console.error('Closing periods API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

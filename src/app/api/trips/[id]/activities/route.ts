import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const options = await prisma.$queryRaw`
      SELECT * FROM trip_activity_expenses 
      WHERE trip_id = ${id}
      ORDER BY category ASC, is_selected DESC, created_at ASC
    `;
    return NextResponse.json({ options });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const trip = await prisma.trips.findUnique({ where: { id }, select: { userId: true } });
    if (!trip || trip.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { category, title, vendor, url, price, is_per_person, per_person, notes } = await request.json();

    const result = await prisma.$queryRaw`
      INSERT INTO trip_activity_expenses (trip_id, category, title, vendor, url, price, is_per_person, per_person, notes)
      VALUES (${id}, ${category}, ${title || null}, ${vendor || null}, ${url || null}, 
              ${price || null}, ${is_per_person ?? true}, ${per_person || null}, ${notes || null})
      RETURNING *
    `;
    return NextResponse.json({ option: (result as any[])[0] });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

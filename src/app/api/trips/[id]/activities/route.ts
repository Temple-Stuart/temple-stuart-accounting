import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

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
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

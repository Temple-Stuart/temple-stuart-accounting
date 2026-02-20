import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const options = await prisma.$queryRaw`
      SELECT * FROM trip_transfer_options 
      WHERE trip_id = ${id}
      ORDER BY direction ASC, is_selected DESC, created_at ASC
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

    const { url, transfer_type, direction, title, vendor, price, per_person, notes } = await request.json();
    
    const count = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM trip_transfer_options WHERE trip_id = ${id}` as any[];
    if (count[0].count >= 10) {
      return NextResponse.json({ error: 'Maximum 10 transfer options per trip' }, { status: 400 });
    }

    const result = await prisma.$queryRaw`
      INSERT INTO trip_transfer_options (trip_id, url, transfer_type, direction, title, vendor, price, per_person, notes)
      VALUES (${id}, ${url || null}, ${transfer_type}, ${direction}, ${title || null}, ${vendor || null}, 
              ${price || null}, ${per_person || null}, ${notes || null})
      RETURNING *
    `;
    return NextResponse.json({ option: (result as any[])[0] });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

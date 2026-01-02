import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const options = await prisma.$queryRaw`
      SELECT * FROM trip_lodging_options 
      WHERE trip_id = ${id}
      ORDER BY is_selected DESC, created_at ASC
    `;
    
    return NextResponse.json({ options });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { url, title, image_url, location, price_per_night, total_price, taxes_estimate, per_person, notes } = await request.json();
    
    // Check limit of 5 options per trip
    const count = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM trip_lodging_options WHERE trip_id = ${id}` as any[];
    if (count[0].count >= 5) {
      return NextResponse.json({ error: 'Maximum 5 lodging options per trip' }, { status: 400 });
    }

    const result = await prisma.$queryRaw`
      INSERT INTO trip_lodging_options (trip_id, url, title, image_url, location, price_per_night, total_price, taxes_estimate, per_person, notes)
      VALUES (${id}, ${url}, ${title || null}, ${image_url || null}, ${location || null}, 
              ${price_per_night || null}, ${total_price || null}, ${taxes_estimate || null}, ${per_person || null}, ${notes || null})
      RETURNING *
    `;
    
    return NextResponse.json({ option: (result as any[])[0] });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

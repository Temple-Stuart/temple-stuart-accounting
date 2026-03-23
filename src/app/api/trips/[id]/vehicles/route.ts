import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const options = await prisma.trip_vehicle_options.findMany({
      where: { trip_id: id },
      orderBy: [{ is_selected: 'desc' }, { created_at: 'asc' }],
    });
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
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const { url, vehicle_type, title, vendor, price_per_day, total_price, per_person, notes } = await request.json();

    const count = await prisma.trip_vehicle_options.count({ where: { trip_id: id } });
    if (count >= 5) {
      return NextResponse.json({ error: 'Maximum 5 vehicle options per trip' }, { status: 400 });
    }

    const option = await prisma.trip_vehicle_options.create({
      data: {
        trip_id: id,
        url: url || null,
        vehicle_type,
        title: title || null,
        vendor: vendor || null,
        price_per_day: price_per_day || null,
        total_price: total_price || null,
        per_person: per_person || null,
        notes: notes || null,
      },
    });
    return NextResponse.json({ option });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

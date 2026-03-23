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

    const options = await prisma.trip_activity_expenses.findMany({
      where: { trip_id: id },
      orderBy: [{ category: 'asc' }, { is_selected: 'desc' }, { created_at: 'asc' }],
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

    const { category, title, vendor, url, price, is_per_person, per_person, notes } = await request.json();

    const option = await prisma.trip_activity_expenses.create({
      data: {
        trip_id: id,
        category,
        title: title || null,
        vendor: vendor || null,
        url: url || null,
        price: price || null,
        is_per_person: is_per_person ?? true,
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

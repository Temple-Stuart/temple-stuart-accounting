import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// GET selected destinations for a trip
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const destinations = await prisma.trip_destinations.findMany({
      where: { tripId: id },
    });

    const resortIds = destinations.map(d => d.resortId);
    const resorts = await prisma.ikon_resorts.findMany({
      where: { id: { in: resortIds } }
    });

    const enriched = destinations.map(d => ({
      ...d,
      resort: resorts.find(r => r.id === d.resortId)
    }));

    return NextResponse.json({ destinations: enriched });
  } catch (error) {
    console.error('Get destinations error:', error);
    return NextResponse.json({ error: 'Failed to fetch destinations' }, { status: 500 });
  }
}

// POST add destination to trip
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { resortId } = body;

    if (!resortId) {
      return NextResponse.json({ error: 'Missing resortId' }, { status: 400 });
    }

    const destination = await prisma.trip_destinations.upsert({
      where: {
        tripId_resortId: { tripId: id, resortId }
      },
      update: { isSelected: true },
      create: {
        tripId: id,
        resortId,
        isSelected: true
      }
    });

    const resort = await prisma.ikon_resorts.findUnique({
      where: { id: resortId }
    });

    return NextResponse.json({ destination: { ...destination, resort } }, { status: 201 });
  } catch (error) {
    console.error('Add destination error:', error);
    return NextResponse.json({ error: 'Failed to add destination' }, { status: 500 });
  }
}

// DELETE remove destination from trip
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { resortId } = body;

    if (!resortId) {
      return NextResponse.json({ error: 'Missing resortId' }, { status: 400 });
    }

    await prisma.trip_destinations.delete({
      where: {
        tripId_resortId: { tripId: id, resortId }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove destination error:', error);
    return NextResponse.json({ error: 'Failed to remove destination' }, { status: 500 });
  }
}

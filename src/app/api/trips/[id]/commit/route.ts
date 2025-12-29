import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// Free geocoding using OpenStreetMap Nominatim
async function geocodeDestination(destination: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`,
      {
        headers: {
          'User-Agent': 'TempleStuartOS/1.0'
        }
      }
    );
    const data = await response.json();
    if (data && data[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const trip = await prisma.trips.findUnique({
      where: { id },
      include: { destinations: true }
    });

    if (!trip || trip.userId !== user.id) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const body = await request.json();
    const { startDay } = body;

    if (!startDay) {
      return NextResponse.json({ error: 'Start day required' }, { status: 400 });
    }

    // Calculate actual dates
    const startDate = new Date(trip.year, trip.month - 1, startDay);
    const endDate = new Date(trip.year, trip.month - 1, startDay + trip.daysTravel - 1);

    // Geocode destination if available
    let latitude = null;
    let longitude = null;
    if (trip.destination) {
      const coords = await geocodeDestination(trip.destination);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      }
    }

    const updatedTrip = await prisma.trips.update({
      where: { id },
      data: {
        startDate,
        endDate,
        committedAt: new Date(),
        status: 'confirmed',
        latitude,
        longitude,
      }
    });

    return NextResponse.json({ 
      success: true, 
      trip: {
        ...updatedTrip,
        latitude: updatedTrip.latitude?.toString(),
        longitude: updatedTrip.longitude?.toString(),
      }
    });
  } catch (error) {
    console.error('Commit trip error:', error);
    return NextResponse.json({ error: 'Failed to commit trip' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const trip = await prisma.trips.findUnique({ where: { id } });

    if (!trip || trip.userId !== user.id) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const updatedTrip = await prisma.trips.update({
      where: { id },
      data: {
        startDate: null,
        endDate: null,
        committedAt: null,
        status: 'planning',
        latitude: null,
        longitude: null,
      }
    });

    return NextResponse.json({ success: true, trip: updatedTrip });
  } catch (error) {
    console.error('Uncommit trip error:', error);
    return NextResponse.json({ error: 'Failed to uncommit trip' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// Map activity to table name
const ACTIVITY_TABLE_MAP: Record<string, string> = {
  snowboard: 'ikon_resorts',
  mtb: 'ikon_resorts',
  hike: 'ikon_resorts',
  climb: 'ikon_resorts',
  surf: 'surf_spots',
  kitesurf: 'surf_spots',
  sail: 'surf_spots',
  bike: 'cycling_destinations',
  run: 'race_destinations',
  triathlon: 'triathlon_destinations',
  golf: 'golf_courses',
  skate: 'skatepark_destinations',
  festival: 'festival_destinations',
  conference: 'conference_destinations',
  nomad: 'nomad_cities',
};

// Helper to get destination data from the correct table
async function getDestinationData(table: string, ids: string[]) {
  if (ids.length === 0) return [];
  
  switch (table) {
    case 'ikon_resorts':
      return prisma.ikon_resorts.findMany({ where: { id: { in: ids } } });
    case 'surf_spots':
      return prisma.surf_spots.findMany({ where: { id: { in: ids } } });
    case 'golf_courses':
      return prisma.golf_courses.findMany({ where: { id: { in: ids } } });
    case 'cycling_destinations':
      return prisma.cycling_destinations.findMany({ where: { id: { in: ids } } });
    case 'race_destinations':
      return prisma.race_destinations.findMany({ where: { id: { in: ids } } });
    case 'triathlon_destinations':
      return prisma.triathlon_destinations.findMany({ where: { id: { in: ids } } });
    case 'festival_destinations':
      return prisma.festival_destinations.findMany({ where: { id: { in: ids } } });
    case 'skatepark_destinations':
      return prisma.skatepark_destinations.findMany({ where: { id: { in: ids } } });
    case 'conference_destinations':
      return prisma.conference_destinations.findMany({ where: { id: { in: ids } } });
    case 'nomad_cities':
      return prisma.nomad_cities.findMany({ where: { id: { in: ids } } });
    default:
      return prisma.ikon_resorts.findMany({ where: { id: { in: ids } } });
  }
}

async function getSingleDestination(table: string, id: string) {
  switch (table) {
    case 'ikon_resorts':
      return prisma.ikon_resorts.findUnique({ where: { id } });
    case 'surf_spots':
      return prisma.surf_spots.findUnique({ where: { id } });
    case 'golf_courses':
      return prisma.golf_courses.findUnique({ where: { id } });
    case 'cycling_destinations':
      return prisma.cycling_destinations.findUnique({ where: { id } });
    case 'race_destinations':
      return prisma.race_destinations.findUnique({ where: { id } });
    case 'triathlon_destinations':
      return prisma.triathlon_destinations.findUnique({ where: { id } });
    case 'festival_destinations':
      return prisma.festival_destinations.findUnique({ where: { id } });
    case 'skatepark_destinations':
      return prisma.skatepark_destinations.findUnique({ where: { id } });
    case 'conference_destinations':
      return prisma.conference_destinations.findUnique({ where: { id } });
    case 'nomad_cities':
      return prisma.nomad_cities.findUnique({ where: { id } });
    default:
      return prisma.ikon_resorts.findUnique({ where: { id } });
  }
}

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

    // Get trip to determine activity
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { activity: true }
    });

    const activity = trip?.activity || 'snowboard';
    const table = ACTIVITY_TABLE_MAP[activity] || 'ikon_resorts';

    const destinations = await prisma.trip_destinations.findMany({
      where: { tripId: id },
    });

    const resortIds = destinations.map(d => d.resortId);
    const resorts = await getDestinationData(table, resortIds);

    const enriched = destinations.map(d => ({
      ...d,
      resort: resorts.find((r: any) => r.id === d.resortId)
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

    // Get trip to determine activity
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { activity: true }
    });

    const activity = trip?.activity || 'snowboard';
    const table = ACTIVITY_TABLE_MAP[activity] || 'ikon_resorts';

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

    const resort = await getSingleDestination(table, resortId);

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

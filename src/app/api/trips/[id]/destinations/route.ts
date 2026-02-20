import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

// Map activity to table name
const ACTIVITY_TABLE_MAP: Record<string, string> = {
  // Mountain
  snowboard: 'ikon_resorts',
  mtb: 'cycling_destinations',
  hike: 'ikon_resorts',
  climb: 'ikon_resorts',
  // Water
  surf: 'surf_spots',
  kitesurf: 'surf_spots',
  sail: 'surf_spots',
  rafting: 'rafting_destinations',
  // Endurance
  bike: 'cycling_destinations',
  run: 'race_destinations',
  triathlon: 'triathlon_destinations',
  swim: 'swim_destinations',
  // Lifestyle
  golf: 'golf_courses',
  skate: 'skatepark_destinations',
  festival: 'festival_destinations',
  art: 'museum_destinations',
  // Business
  conference: 'conference_destinations',
  nomad: 'nomad_cities',
  dinner: 'dining_destinations',
  lunch: 'dining_destinations',
  // Work (consolidated - all locations)
  bizdev: 'all',
  content: 'all',
  education: 'all',
  party: 'all',
};

// Helper to get destination data from the correct table
// Get name from various field names across tables
function getNameField(d: any): string {
  return d.name || d.parkName || d.raceName || d.eventName || d.festivalName || d.city || 'Unknown';
}

// Normalize destination to common format
function normalizeDestination(d: any) {
  return {
    ...d,
    name: getNameField(d),
  };
}

async function getDestinationData(table: string, ids: string[]) {
  if (ids.length === 0) return [];
  
  // For 'all' table, we need to search across all tables
  if (table === 'all') {
    const results: any[] = [];
    
    // Try each table and collect results
    const [
      resorts, surfSpots, golfCourses, cycling, races, triathlon,
      festivals, skateparks, conferences, nomadCities, rafting, swim, museums, dining
    ] = await Promise.all([
      prisma.ikon_resorts.findMany({ where: { id: { in: ids } } }),
      prisma.surf_spots.findMany({ where: { id: { in: ids } } }),
      prisma.golf_courses.findMany({ where: { id: { in: ids } } }),
      prisma.cycling_destinations.findMany({ where: { id: { in: ids } } }),
      prisma.race_destinations.findMany({ where: { id: { in: ids } } }),
      prisma.triathlon_destinations.findMany({ where: { id: { in: ids } } }),
      prisma.festival_destinations.findMany({ where: { id: { in: ids } } }),
      prisma.skatepark_destinations.findMany({ where: { id: { in: ids } } }),
      prisma.conference_destinations.findMany({ where: { id: { in: ids } } }),
      prisma.nomad_cities.findMany({ where: { id: { in: ids } } }),
      prisma.rafting_destinations.findMany({ where: { id: { in: ids } } }),
      prisma.swim_destinations.findMany({ where: { id: { in: ids } } }),
      prisma.museum_destinations.findMany({ where: { id: { in: ids } } }),
      prisma.dining_destinations.findMany({ where: { id: { in: ids } } }),
    ]);
    
    return [
      ...resorts.map(normalizeDestination),
      ...surfSpots.map(normalizeDestination),
      ...golfCourses.map(normalizeDestination),
      ...cycling.map(normalizeDestination),
      ...races.map(normalizeDestination),
      ...triathlon.map(normalizeDestination),
      ...festivals.map(normalizeDestination),
      ...skateparks.map(normalizeDestination),
      ...conferences.map(normalizeDestination),
      ...nomadCities.map(normalizeDestination),
      ...rafting.map(normalizeDestination),
      ...swim.map(normalizeDestination),
      ...museums.map(normalizeDestination),
      ...dining.map(normalizeDestination),
    ];
  }
  
  switch (table) {
    case 'ikon_resorts':
      return prisma.ikon_resorts.findMany({ where: { id: { in: ids } } });
    case 'surf_spots':
      return prisma.surf_spots.findMany({ where: { id: { in: ids } } });
    case 'golf_courses':
      return prisma.golf_courses.findMany({ where: { id: { in: ids } } });
    case 'cycling_destinations':
      return (await prisma.cycling_destinations.findMany({ where: { id: { in: ids } } })).map(normalizeDestination);
    case 'race_destinations':
      return (await prisma.race_destinations.findMany({ where: { id: { in: ids } } })).map(normalizeDestination);
    case 'triathlon_destinations':
      return (await prisma.triathlon_destinations.findMany({ where: { id: { in: ids } } })).map(normalizeDestination);
    case 'festival_destinations':
      return (await prisma.festival_destinations.findMany({ where: { id: { in: ids } } })).map(normalizeDestination);
    case 'skatepark_destinations':
      return (await prisma.skatepark_destinations.findMany({ where: { id: { in: ids } } })).map(normalizeDestination);
    case 'conference_destinations':
      return (await prisma.conference_destinations.findMany({ where: { id: { in: ids } } })).map(normalizeDestination);
    case 'nomad_cities':
      return (await prisma.nomad_cities.findMany({ where: { id: { in: ids } } })).map(normalizeDestination);
    case 'rafting_destinations':
      return prisma.rafting_destinations.findMany({ where: { id: { in: ids } } });
    case 'swim_destinations':
      return prisma.swim_destinations.findMany({ where: { id: { in: ids } } });
    case 'museum_destinations':
      return prisma.museum_destinations.findMany({ where: { id: { in: ids } } });
    case 'sail_destinations':
      return prisma.sail_destinations.findMany({ where: { id: { in: ids } } });
    case 'dining_destinations':
      return prisma.dining_destinations.findMany({ where: { id: { in: ids } } });
    default:
      return prisma.ikon_resorts.findMany({ where: { id: { in: ids } } });
  }
}

async function getSingleDestination(table: string, id: string) {
  // For 'all', try each table until we find the destination
  if (table === 'all') {
    const tables = [
      () => prisma.ikon_resorts.findUnique({ where: { id } }),
      () => prisma.surf_spots.findUnique({ where: { id } }),
      () => prisma.golf_courses.findUnique({ where: { id } }),
      () => prisma.cycling_destinations.findUnique({ where: { id } }),
      () => prisma.race_destinations.findUnique({ where: { id } }),
      () => prisma.triathlon_destinations.findUnique({ where: { id } }),
      () => prisma.festival_destinations.findUnique({ where: { id } }),
      () => prisma.skatepark_destinations.findUnique({ where: { id } }),
      () => prisma.conference_destinations.findUnique({ where: { id } }),
      () => prisma.nomad_cities.findUnique({ where: { id } }),
      () => prisma.rafting_destinations.findUnique({ where: { id } }),
      () => prisma.swim_destinations.findUnique({ where: { id } }),
      () => prisma.museum_destinations.findUnique({ where: { id } }),
      () => prisma.dining_destinations.findUnique({ where: { id } }),
    ];
    
    for (const query of tables) {
      const result = await query();
      if (result) return normalizeDestination(result);
    }
    return null;
  }
  
  switch (table) {
    case 'ikon_resorts':
      return prisma.ikon_resorts.findUnique({ where: { id } });
    case 'surf_spots':
      return prisma.surf_spots.findUnique({ where: { id } });
    case 'golf_courses':
      return prisma.golf_courses.findUnique({ where: { id } });
    case 'cycling_destinations':
      return prisma.cycling_destinations.findUnique({ where: { id } }).then(r => r ? normalizeDestination(r) : null);
    case 'race_destinations':
      return prisma.race_destinations.findUnique({ where: { id } }).then(r => r ? normalizeDestination(r) : null);
    case 'triathlon_destinations':
      return prisma.triathlon_destinations.findUnique({ where: { id } }).then(r => r ? normalizeDestination(r) : null);
    case 'festival_destinations':
      return prisma.festival_destinations.findUnique({ where: { id } }).then(r => r ? normalizeDestination(r) : null);
    case 'skatepark_destinations':
      return prisma.skatepark_destinations.findUnique({ where: { id } }).then(r => r ? normalizeDestination(r) : null);
    case 'conference_destinations':
      return prisma.conference_destinations.findUnique({ where: { id } }).then(r => r ? normalizeDestination(r) : null);
    case 'nomad_cities':
      return prisma.nomad_cities.findUnique({ where: { id } }).then(r => r ? normalizeDestination(r) : null);
    case 'rafting_destinations':
      return prisma.rafting_destinations.findUnique({ where: { id } });
    case 'swim_destinations':
      return prisma.swim_destinations.findUnique({ where: { id } });
    case 'museum_destinations':
      return prisma.museum_destinations.findUnique({ where: { id } });
    case 'sail_destinations':
      return prisma.sail_destinations.findUnique({ where: { id } });
    case 'dining_destinations':
      return prisma.dining_destinations.findUnique({ where: { id } });
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
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get trip (scoped to user) to determine activity
    const trip = await prisma.trips.findFirst({
      where: { id, userId: user.id },
      select: { activity: true }
    });
    if (!trip) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const activity = trip.activity || 'snowboard';
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
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { resortId } = body;

    if (!resortId) {
      return NextResponse.json({ error: 'Missing resortId' }, { status: 400 });
    }

    // Get trip (scoped to user) to determine activity
    const trip = await prisma.trips.findFirst({
      where: { id, userId: user.id },
      select: { activity: true }
    });
    if (!trip) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const activity = trip.activity || 'snowboard';
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
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify trip ownership
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

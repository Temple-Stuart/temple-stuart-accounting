import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

// Helper to normalize destinations from different tables
function normalizeDestination(dest: any, source: string) {
  return {
    id: dest.id,
    name: dest.name,
    city: dest.city || dest.region || null,
    country: dest.country,
    latitude: dest.latitude,
    longitude: dest.longitude,
    nomadScore: dest.nomadScore || dest.nomadCommunity || dest.startupScene || 5,
    source,
  };
}

async function getAllDestinations() {
  const [
    resorts,
    surfSpots,
    golfCourses,
    cycling,
    races,
    triathlon,
    festivals,
    skateparks,
    conferences,
    nomadCities,
    rafting,
    swim,
    museums,
    sail,
    dining,
  ] = await Promise.all([
    prisma.ikon_resorts.findMany(),
    prisma.surf_spots.findMany(),
    prisma.golf_courses.findMany(),
    prisma.cycling_destinations.findMany(),
    prisma.race_destinations.findMany(),
    prisma.triathlon_destinations.findMany(),
    prisma.festival_destinations.findMany(),
    prisma.skatepark_destinations.findMany(),
    prisma.conference_destinations.findMany(),
    prisma.nomad_cities.findMany(),
    prisma.rafting_destinations.findMany(),
    prisma.swim_destinations.findMany(),
    prisma.museum_destinations.findMany(),
    prisma.dining_destinations.findMany(),
    prisma.sail_destinations.findMany(),
  ]);

  const all = [
    ...resorts.map(d => normalizeDestination(d, 'ikon_resorts')),
    ...surfSpots.map(d => normalizeDestination(d, 'surf_spots')),
    ...golfCourses.map(d => normalizeDestination(d, 'golf_courses')),
    ...cycling.map(d => normalizeDestination(d, 'cycling_destinations')),
    ...races.map(d => normalizeDestination(d, 'race_destinations')),
    ...triathlon.map(d => normalizeDestination(d, 'triathlon_destinations')),
    ...festivals.map(d => normalizeDestination(d, 'festival_destinations')),
    ...skateparks.map(d => normalizeDestination(d, 'skatepark_destinations')),
    ...conferences.map(d => normalizeDestination(d, 'conference_destinations')),
    ...nomadCities.map(d => normalizeDestination(d, 'nomad_cities')),
    ...rafting.map(d => normalizeDestination(d, 'rafting_destinations')),
    ...swim.map(d => normalizeDestination(d, 'swim_destinations')),
    ...museums.map(d => normalizeDestination(d, 'museum_destinations')),
    ...dining.map(d => normalizeDestination(d, 'dining_destinations')),
    ...sail.map(d => normalizeDestination(d, 'sail_destinations')),
  ];

  // Remove duplicates by name (keep first occurrence)
  const seen = new Set<string>();
  const unique = all.filter(d => {
    const key = d.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by nomadScore descending
  return unique.sort((a, b) => (b.nomadScore || 0) - (a.nomadScore || 0));
}

export async function GET(request: NextRequest) {
  try {
    const activity = request.nextUrl.searchParams.get('activity');
    
    if (!activity) {
      return NextResponse.json({ error: 'Activity required' }, { status: 400 });
    }

    const table = ACTIVITY_TABLE_MAP[activity];
    if (!table) {
      return NextResponse.json({ error: 'Unknown activity', activity }, { status: 400 });
    }

    // Handle consolidated "all" destinations for Work activities
    if (table === 'all') {
      const destinations = await getAllDestinations();
      return NextResponse.json({ destinations, table: 'all', activity, count: destinations.length });
    }

    let destinations: any[] = [];

    switch (table) {
      case 'ikon_resorts':
        destinations = await prisma.ikon_resorts.findMany({ orderBy: { name: 'asc' } });
        break;
      case 'surf_spots':
        destinations = await prisma.surf_spots.findMany({ orderBy: { nomadScore: 'desc' } });
        break;
      case 'golf_courses':
        destinations = await prisma.golf_courses.findMany({ orderBy: { nomadScore: 'desc' } });
        break;
      case 'cycling_destinations':
        destinations = await prisma.cycling_destinations.findMany({ orderBy: { nomadScore: 'desc' } });
        break;
      case 'race_destinations':
        destinations = await prisma.race_destinations.findMany({ orderBy: { nomadScore: 'desc' } });
        break;
      case 'triathlon_destinations':
        destinations = await prisma.triathlon_destinations.findMany({ orderBy: { nomadScore: 'desc' } });
        break;
      case 'festival_destinations':
        destinations = await prisma.festival_destinations.findMany({ orderBy: { nomadScore: 'desc' } });
        break;
      case 'skatepark_destinations':
        destinations = await prisma.skatepark_destinations.findMany({ orderBy: { nomadScore: 'desc' } });
        break;
      case 'conference_destinations':
        destinations = await prisma.conference_destinations.findMany({ orderBy: { startupScene: 'desc' } });
        break;
      case 'nomad_cities':
        destinations = await prisma.nomad_cities.findMany({ orderBy: { nomadCommunity: 'desc' } });
        break;
      case 'rafting_destinations':
        destinations = await prisma.rafting_destinations.findMany({ orderBy: { nomadScore: 'desc' } });
        break;
      case 'swim_destinations':
        destinations = await prisma.swim_destinations.findMany({ orderBy: { nomadScore: 'desc' } });
        break;
      case 'museum_destinations':
        destinations = await prisma.museum_destinations.findMany({ orderBy: { nomadScore: 'desc' } });
        break;
      case 'sail_destinations':
        destinations = await prisma.sail_destinations.findMany({ orderBy: { name: 'asc' } });
        break;
      case 'dining_destinations':
        destinations = await prisma.dining_destinations.findMany({ orderBy: { nomadScore: 'desc' } });
        break;
    }

    return NextResponse.json({ destinations, table, activity, count: destinations.length });
  } catch (error) {
    console.error('Get destinations error:', error);
    return NextResponse.json({ error: 'Failed to fetch destinations' }, { status: 500 });
  }
}

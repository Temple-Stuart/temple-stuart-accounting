import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ACTIVITY_TABLE_MAP: Record<string, string> = {
  // Mountain
  snowboard: 'ikon_resorts',
  mtb: 'ikon_resorts',
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
  // Work (consolidated)
  bizdev: 'all',
  content: 'all',
  education: 'all',
  party: 'all',
};

// Helper to normalize and group destinations
function groupDestinations(resorts: any[], countryField = 'country', regionField = 'region') {
  const grouped: Record<string, Record<string, any[]>> = {};
  for (const resort of resorts) {
    const country = resort[countryField] || 'Other';
    const region = resort[regionField] || 'General';
    if (!grouped[country]) grouped[country] = {};
    if (!grouped[country][region]) grouped[country][region] = [];
    grouped[country][region].push(resort);
  }
  return grouped;
}

// Get name from various field names across tables
function getNameField(d: any): string {
  return d.name || d.parkName || d.raceName || d.eventName || d.festivalName || d.city || 'Unknown';
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
  ]);

  // Normalize all to common format
  const normalize = (d: any, source: string) => ({
    id: d.id,
    name: getNameField(d),
    country: d.country || 'Unknown',
    region: d.region || d.city || d.state || 'General',
    latitude: d.latitude,
    longitude: d.longitude,
    nomadScore: d.nomadScore || d.nomadCommunity || d.startupScene || 5,
    source,
  });

  const all = [
    ...resorts.map(d => normalize(d, 'ikon_resorts')),
    ...surfSpots.map(d => normalize(d, 'surf_spots')),
    ...golfCourses.map(d => normalize(d, 'golf_courses')),
    ...cycling.map(d => normalize(d, 'cycling_destinations')),
    ...races.map(d => normalize(d, 'race_destinations')),
    ...triathlon.map(d => normalize(d, 'triathlon_destinations')),
    ...festivals.map(d => normalize(d, 'festival_destinations')),
    ...skateparks.map(d => normalize(d, 'skatepark_destinations')),
    ...conferences.map(d => normalize(d, 'conference_destinations')),
    ...nomadCities.map(d => normalize(d, 'nomad_cities')),
    ...rafting.map(d => normalize(d, 'rafting_destinations')),
    ...swim.map(d => normalize(d, 'swim_destinations')),
    ...museums.map(d => normalize(d, 'museum_destinations')),
    ...dining.map(d => normalize(d, 'dining_destinations')),
  ];

  // Remove duplicates by name (filter out undefined names too)
  const seen = new Set<string>();
  const unique = all.filter(d => {
    if (!d.name) return false;
    const key = d.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
}

export async function GET(request: NextRequest) {
  try {
    const activity = request.nextUrl.searchParams.get('activity') || 'snowboard';
    const table = ACTIVITY_TABLE_MAP[activity] || 'ikon_resorts';

    let resorts: any[] = [];
    let grouped: Record<string, Record<string, any[]>> = {};

    // Handle consolidated "all" for Work activities
    if (table === 'all') {
      resorts = await getAllDestinations();
      grouped = groupDestinations(resorts);
      return NextResponse.json({ resorts, grouped, table: 'all', activity });
    }

    switch (table) {
      case 'ikon_resorts':
        resorts = await prisma.ikon_resorts.findMany({
          orderBy: [{ country: 'asc' }, { region: 'asc' }, { name: 'asc' }]
        });
        grouped = groupDestinations(resorts);
        break;

      case 'surf_spots':
        resorts = await prisma.surf_spots.findMany({
          orderBy: [{ country: 'asc' }, { region: 'asc' }, { name: 'asc' }]
        });
        grouped = groupDestinations(resorts);
        break;

      case 'golf_courses':
        resorts = await prisma.golf_courses.findMany({
          orderBy: [{ country: 'asc' }, { name: 'asc' }]
        });
        grouped = groupDestinations(resorts, 'country', 'city');
        break;

      case 'cycling_destinations':
        resorts = await prisma.cycling_destinations.findMany({
          orderBy: [{ country: 'asc' }]
        });
        // Cycling uses city as name
        resorts = resorts.map(r => ({ ...r, name: r.city }));
        grouped = groupDestinations(resorts, 'country', 'region');
        break;

      case 'race_destinations':
        resorts = await prisma.race_destinations.findMany({
          orderBy: [{ country: 'asc' }]
        });
        // Race uses raceName as name
        resorts = resorts.map(r => ({ ...r, name: r.raceName }));
        grouped = groupDestinations(resorts, 'country', 'city');
        break;

      case 'triathlon_destinations':
        resorts = await prisma.triathlon_destinations.findMany({
          orderBy: [{ country: 'asc' }]
        });
        // Triathlon uses eventName as name
        resorts = resorts.map(r => ({ ...r, name: r.eventName }));
        grouped = groupDestinations(resorts, 'country', 'city');
        break;

      case 'festival_destinations':
        resorts = await prisma.festival_destinations.findMany({
          orderBy: [{ country: 'asc' }]
        });
        // Festival uses festivalName as name
        resorts = resorts.map(r => ({ ...r, name: r.festivalName }));
        grouped = groupDestinations(resorts, 'country', 'city');
        break;

      case 'skatepark_destinations':
        resorts = await prisma.skatepark_destinations.findMany({
          orderBy: [{ country: 'asc' }]
        });
        // Skatepark uses parkName as name
        resorts = resorts.map(r => ({ ...r, name: r.parkName }));
        grouped = groupDestinations(resorts, 'country', 'city');
        break;

      case 'conference_destinations':
        resorts = await prisma.conference_destinations.findMany({
          orderBy: [{ country: 'asc' }]
        });
        // Conference uses city as name
        resorts = resorts.map(r => ({ ...r, name: r.city }));
        grouped = groupDestinations(resorts, 'country', 'city');
        break;

      case 'nomad_cities':
        resorts = await prisma.nomad_cities.findMany({
          orderBy: [{ country: 'asc' }]
        });
        // Nomad uses city as name
        resorts = resorts.map(r => ({ ...r, name: r.city }));
        grouped = groupDestinations(resorts, 'country', 'region');
        break;

      case 'rafting_destinations':
        resorts = await prisma.rafting_destinations.findMany({
          orderBy: [{ country: 'asc' }, { region: 'asc' }, { name: 'asc' }]
        });
        grouped = groupDestinations(resorts);
        break;

      case 'swim_destinations':
        resorts = await prisma.swim_destinations.findMany({
          orderBy: [{ country: 'asc' }, { region: 'asc' }, { name: 'asc' }]
        });
        grouped = groupDestinations(resorts);
        break;

      case 'museum_destinations':
        resorts = await prisma.museum_destinations.findMany({
          orderBy: [{ country: 'asc' }, { city: 'asc' }, { name: 'asc' }]
        });
        grouped = groupDestinations(resorts, 'country', 'city');
        break;

      case 'dining_destinations':
        resorts = await prisma.dining_destinations.findMany({
          orderBy: [{ country: 'asc' }, { city: 'asc' }, { name: 'asc' }]
        });
        grouped = groupDestinations(resorts, 'country', 'city');
        break;

      default:
        resorts = await prisma.ikon_resorts.findMany({
          orderBy: [{ country: 'asc' }, { region: 'asc' }, { name: 'asc' }]
        });
        grouped = groupDestinations(resorts);
    }

    return NextResponse.json({ resorts, grouped, table, activity });
  } catch (error) {
    console.error('Get resorts error:', error);
    return NextResponse.json({ error: 'Failed to fetch resorts' }, { status: 500 });
  }
}

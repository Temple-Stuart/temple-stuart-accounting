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
};

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

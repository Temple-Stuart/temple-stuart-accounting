import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

export async function GET(request: NextRequest) {
  try {
    const activity = request.nextUrl.searchParams.get('activity') || 'snowboard';
    const table = ACTIVITY_TABLE_MAP[activity] || 'ikon_resorts';

    let resorts: any[] = [];
    let grouped: Record<string, Record<string, any[]>> = {};

    switch (table) {
      case 'ikon_resorts':
        resorts = await prisma.ikon_resorts.findMany({
          orderBy: [{ country: 'asc' }, { region: 'asc' }, { name: 'asc' }]
        });
        // Group by country/region
        for (const resort of resorts) {
          if (!grouped[resort.country]) grouped[resort.country] = {};
          if (!grouped[resort.country][resort.region]) grouped[resort.country][resort.region] = [];
          grouped[resort.country][resort.region].push(resort);
        }
        break;

      case 'surf_spots':
        resorts = await prisma.surf_spots.findMany({
          orderBy: [{ country: 'asc' }, { name: 'asc' }]
        });
        for (const spot of resorts) {
          const region = spot.region || 'Other';
          if (!grouped[spot.country]) grouped[spot.country] = {};
          if (!grouped[spot.country][region]) grouped[spot.country][region] = [];
          grouped[spot.country][region].push({ ...spot, verticalDrop: spot.waveConsistency, avgSnowfall: spot.nomadScore });
        }
        break;

      case 'golf_courses':
        resorts = await prisma.golf_courses.findMany({
          orderBy: [{ country: 'asc' }, { name: 'asc' }]
        });
        for (const course of resorts) {
          const region = course.city || 'Other';
          if (!grouped[course.country]) grouped[course.country] = {};
          if (!grouped[course.country][region]) grouped[course.country][region] = [];
          grouped[course.country][region].push({ ...course, verticalDrop: course.greenFee, avgSnowfall: course.sceneryRating });
        }
        break;

      case 'cycling_destinations':
        resorts = await prisma.cycling_destinations.findMany({
          orderBy: [{ country: 'asc' }, { city: 'asc' }]
        });
        for (const dest of resorts) {
          if (!grouped[dest.country]) grouped[dest.country] = {};
          if (!grouped[dest.country]['All']) grouped[dest.country]['All'] = [];
          grouped[dest.country]['All'].push({ ...dest, name: dest.city, region: 'Cycling', verticalDrop: dest.routeVariety, avgSnowfall: dest.nomadScore });
        }
        break;

      case 'race_destinations':
        resorts = await prisma.race_destinations.findMany({
          orderBy: [{ country: 'asc' }, { raceName: 'asc' }]
        });
        for (const race of resorts) {
          if (!grouped[race.country]) grouped[race.country] = {};
          if (!grouped[race.country]['Races']) grouped[race.country]['Races'] = [];
          grouped[race.country]['Races'].push({ ...race, name: race.raceName, region: race.raceType, verticalDrop: race.entryFee, avgSnowfall: race.sceneryRating });
        }
        break;

      case 'triathlon_destinations':
        resorts = await prisma.triathlon_destinations.findMany({
          orderBy: [{ country: 'asc' }, { eventName: 'asc' }]
        });
        for (const tri of resorts) {
          if (!grouped[tri.country]) grouped[tri.country] = {};
          if (!grouped[tri.country][tri.distance]) grouped[tri.country][tri.distance] = [];
          grouped[tri.country][tri.distance].push({ ...tri, name: tri.eventName, region: tri.distance, verticalDrop: tri.entryFee, avgSnowfall: tri.courseRating });
        }
        break;

      case 'festival_destinations':
        resorts = await prisma.festival_destinations.findMany({
          orderBy: [{ country: 'asc' }, { festivalName: 'asc' }]
        });
        for (const fest of resorts) {
          if (!grouped[fest.country]) grouped[fest.country] = {};
          if (!grouped[fest.country][fest.genre]) grouped[fest.country][fest.genre] = [];
          grouped[fest.country][fest.genre].push({ ...fest, name: fest.festivalName, region: fest.genre, verticalDrop: fest.ticketCost, avgSnowfall: fest.attendeeCount });
        }
        break;

      case 'skatepark_destinations':
        resorts = await prisma.skatepark_destinations.findMany({
          orderBy: [{ country: 'asc' }, { parkName: 'asc' }]
        });
        for (const park of resorts) {
          if (!grouped[park.country]) grouped[park.country] = {};
          if (!grouped[park.country]['Parks']) grouped[park.country]['Parks'] = [];
          grouped[park.country]['Parks'].push({ ...park, name: park.parkName, region: park.parkSize, verticalDrop: park.parkRating, avgSnowfall: park.streetSpots });
        }
        break;

      case 'conference_destinations':
        resorts = await prisma.conference_destinations.findMany({
          orderBy: [{ country: 'asc' }, { city: 'asc' }]
        });
        for (const conf of resorts) {
          if (!grouped[conf.country]) grouped[conf.country] = {};
          if (!grouped[conf.country]['Cities']) grouped[conf.country]['Cities'] = [];
          grouped[conf.country]['Cities'].push({ ...conf, name: conf.city, region: 'Conference', verticalDrop: conf.startupScene, avgSnowfall: conf.fintechFocus });
        }
        break;

      case 'nomad_cities':
        resorts = await prisma.nomad_cities.findMany({
          orderBy: [{ country: 'asc' }, { city: 'asc' }]
        });
        for (const city of resorts) {
          const region = city.region || 'Other';
          if (!grouped[city.country]) grouped[city.country] = {};
          if (!grouped[city.country][region]) grouped[city.country][region] = [];
          grouped[city.country][region].push({ ...city, name: city.city, verticalDrop: city.nomadCommunity, avgSnowfall: city.wifiSpeed });
        }
        break;
    }

    return NextResponse.json({ resorts, grouped });
  } catch (error) {
    console.error('Get resorts error:', error);
    return NextResponse.json({ error: 'Failed to fetch resorts' }, { status: 500 });
  }
}

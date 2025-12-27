import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const RESORT_COORDS: Record<string, { lat: number; lng: number }> = {
  'Arapahoe Basin': { lat: 39.6425, lng: -105.8719 },
  'Aspen Snowmass': { lat: 39.2084, lng: -106.9490 },
  'Aspen Highlands': { lat: 39.1861, lng: -106.8556 },
  'Aspen Mountain': { lat: 39.1875, lng: -106.8186 },
  'Buttermilk': { lat: 39.2069, lng: -106.8681 },
  'Breckenridge': { lat: 39.4817, lng: -106.0667 },
  'Copper Mountain': { lat: 39.5022, lng: -106.1497 },
  'Crested Butte': { lat: 38.8986, lng: -106.9650 },
  'Eldora': { lat: 39.9372, lng: -105.5828 },
  'Keystone': { lat: 39.6069, lng: -105.9428 },
  'Loveland': { lat: 39.6797, lng: -105.8978 },
  'Monarch Mountain': { lat: 38.5125, lng: -106.3319 },
  'Steamboat': { lat: 40.4572, lng: -106.8045 },
  'Winter Park': { lat: 39.8869, lng: -105.7625 },
  'Alta': { lat: 40.5883, lng: -111.6386 },
  'Brighton': { lat: 40.5981, lng: -111.5831 },
  'Deer Valley': { lat: 40.6375, lng: -111.4783 },
  'Park City': { lat: 40.6514, lng: -111.5080 },
  'Snowbird': { lat: 40.5830, lng: -111.6508 },
  'Solitude': { lat: 40.6197, lng: -111.5919 },
  'Big Bear Mountain Resort': { lat: 34.2369, lng: -116.8911 },
  'Heavenly': { lat: 38.9353, lng: -119.9400 },
  'June Mountain': { lat: 37.7678, lng: -119.0906 },
  'Mammoth Mountain': { lat: 37.6308, lng: -119.0326 },
  'Northstar': { lat: 39.2746, lng: -120.1210 },
  'Palisades Tahoe': { lat: 39.1969, lng: -120.2358 },
  'Sugar Bowl': { lat: 39.3044, lng: -120.3361 },
  'Big Sky': { lat: 45.2858, lng: -111.4017 },
  'Jackson Hole': { lat: 43.5875, lng: -110.8278 },
  'Whitefish Mountain Resort': { lat: 48.4819, lng: -114.3539 },
  'Crystal Mountain': { lat: 46.9283, lng: -121.5047 },
  'Mt Baker': { lat: 48.8622, lng: -121.6694 },
  'The Summit at Snoqualmie': { lat: 47.4206, lng: -121.4139 },
  'Cannon Mountain': { lat: 44.1567, lng: -71.7008 },
  'Killington': { lat: 43.6225, lng: -72.7967 },
  'Loon Mountain': { lat: 44.0361, lng: -71.6219 },
  'Stowe': { lat: 44.5303, lng: -72.7814 },
  'Stratton': { lat: 43.1136, lng: -72.9086 },
  'Sugarbush': { lat: 44.1356, lng: -72.8992 },
  'Sugarloaf': { lat: 45.0314, lng: -70.3133 },
  'Sunday River': { lat: 44.4733, lng: -70.8567 },
  'Taos Ski Valley': { lat: 36.5958, lng: -105.4542 },
  'Ski Santa Fe': { lat: 35.7958, lng: -105.8003 },
  'Seven Springs': { lat: 40.0217, lng: -79.2978 },
  'Whistler Blackcomb': { lat: 50.1163, lng: -122.9574 },
  'Lake Louise': { lat: 51.4254, lng: -116.1773 },
  'Sunshine Village': { lat: 51.0781, lng: -115.7600 },
  'Mt Norquay': { lat: 51.2047, lng: -115.6058 },
  'Revelstoke': { lat: 50.9579, lng: -118.1647 },
  'Fernie': { lat: 49.4622, lng: -115.0872 },
  'Kicking Horse': { lat: 51.2975, lng: -117.0483 },
  'Panorama': { lat: 50.4606, lng: -116.2397 },
  'RED Mountain': { lat: 49.1039, lng: -117.8228 },
  'SilverStar': { lat: 50.3611, lng: -119.0592 },
  'Sun Peaks': { lat: 50.8833, lng: -119.8856 },
  'Tremblant': { lat: 46.2094, lng: -74.5850 },
  'Blue Mountain': { lat: 44.5011, lng: -80.3161 },
  'Chamonix': { lat: 45.9237, lng: 6.8694 },
  'Zermatt': { lat: 46.0207, lng: 7.7491 },
  'St. Moritz': { lat: 46.4908, lng: 9.8355 },
  'Davos Klosters': { lat: 46.8003, lng: 9.8361 },
  'St. Anton': { lat: 47.1297, lng: 10.2683 },
  'Kitzbühel': { lat: 47.4500, lng: 12.3917 },
  'Ischgl': { lat: 47.0167, lng: 10.2833 },
  'Dolomiti Superski': { lat: 46.5350, lng: 11.8475 },
  'Grandvalira Resorts Andorra': { lat: 42.5536, lng: 1.7358 },
  'Niseko United': { lat: 42.8048, lng: 140.6874 },
  'Hakuba Valley': { lat: 36.6983, lng: 137.8317 },
  'Rusutsu': { lat: 42.7500, lng: 140.9000 },
  'Furano': { lat: 43.3394, lng: 142.3831 },
  'Lotte Arai': { lat: 36.9347, lng: 138.1994 },
  'Mt Buller': { lat: -37.1458, lng: 146.4386 },
  'Thredbo': { lat: -36.5028, lng: 148.3047 },
  'Perisher': { lat: -36.3836, lng: 148.4097 },
  'Coronet Peak': { lat: -45.0831, lng: 168.7283 },
  'The Remarkables': { lat: -45.0328, lng: 168.8181 },
  'Mt Hutt': { lat: -43.4833, lng: 171.5333 },
  'Valle Nevado': { lat: -33.3550, lng: -70.2561 },
  'Portillo': { lat: -32.8333, lng: -70.1333 },
};

export async function POST(request: NextRequest) {
  try {
    let updatedCount = 0;
    let notFoundResorts: string[] = [];
    const resorts = await prisma.ikon_resorts.findMany();
    
    for (const resort of resorts) {
      const coords = RESORT_COORDS[resort.name];
      if (coords) {
        await prisma.ikon_resorts.update({
          where: { id: resort.id },
          data: { latitude: coords.lat, longitude: coords.lng },
        });
        updatedCount++;
      } else {
        notFoundResorts.push(resort.name);
      }
    }
    
    return NextResponse.json({
      success: true,
      updatedCount,
      totalResorts: resorts.length,
      notFoundResorts,
    });
  } catch (error) {
    console.error('Error updating resort coordinates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update coordinates' },
      { status: 500 }
    );
  }
}

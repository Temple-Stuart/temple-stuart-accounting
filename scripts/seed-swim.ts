import { prisma } from '../src/lib/prisma';

const SWIM_DESTINATIONS = [
  // Mediterranean
  { name: 'Santorini Cliffs', country: 'Greece', region: 'Cyclades', cliffHeight: 12, waterDepth: 15, difficulty: 'intermediate', bestMonths: 'May-Oct', nomadScore: 8, monthlyRent: 1200, lat: 36.3932, lng: 25.4615 },
  { name: 'Blue Lagoon Malta', country: 'Malta', region: 'Comino', cliffHeight: 8, waterDepth: 12, difficulty: 'beginner', bestMonths: 'Apr-Nov', nomadScore: 9, monthlyRent: 1000, lat: 36.0531, lng: 14.3247 },
  { name: 'Dubrovnik Walls', country: 'Croatia', region: 'Dalmatia', cliffHeight: 10, waterDepth: 10, difficulty: 'intermediate', bestMonths: 'Jun-Sep', nomadScore: 8, monthlyRent: 1100, lat: 42.6507, lng: 18.0944 },
  { name: 'Amalfi Coast', country: 'Italy', region: 'Campania', cliffHeight: 15, waterDepth: 20, difficulty: 'expert', bestMonths: 'Jun-Sep', nomadScore: 7, monthlyRent: 1400, lat: 40.6333, lng: 14.6029 },
  { name: 'Ibiza Es Vedrà', country: 'Spain', region: 'Balearic', cliffHeight: 6, waterDepth: 8, difficulty: 'beginner', bestMonths: 'May-Oct', nomadScore: 8, monthlyRent: 1800, lat: 38.8683, lng: 1.2006 },
  { name: 'Zakynthos Shipwreck', country: 'Greece', region: 'Ionian', cliffHeight: 20, waterDepth: 25, difficulty: 'expert', bestMonths: 'May-Oct', nomadScore: 7, monthlyRent: 800, lat: 37.8597, lng: 20.6244 },
  // Caribbean
  { name: 'Rick\'s Cafe Jamaica', country: 'Jamaica', region: 'Negril', cliffHeight: 12, waterDepth: 15, difficulty: 'intermediate', bestMonths: 'Year-round', nomadScore: 7, monthlyRent: 900, lat: 18.2644, lng: -78.3561 },
  { name: 'Aruba Natural Pool', country: 'Aruba', region: 'Arikok', cliffHeight: 5, waterDepth: 8, difficulty: 'beginner', bestMonths: 'Year-round', nomadScore: 7, monthlyRent: 1500, lat: 12.4706, lng: -69.9619 },
  { name: 'Cenotes Tulum', country: 'Mexico', region: 'Quintana Roo', cliffHeight: 8, waterDepth: 30, difficulty: 'beginner', bestMonths: 'Nov-Apr', nomadScore: 10, monthlyRent: 700, lat: 20.2119, lng: -87.4654 },
  { name: 'Puerto Rico La Zanja', country: 'Puerto Rico', region: 'Cabo Rojo', cliffHeight: 10, waterDepth: 12, difficulty: 'intermediate', bestMonths: 'Year-round', nomadScore: 8, monthlyRent: 1200, lat: 18.0933, lng: -67.1619 },
  // Southeast Asia
  { name: 'Phi Phi Island', country: 'Thailand', region: 'Krabi', cliffHeight: 10, waterDepth: 15, difficulty: 'intermediate', bestMonths: 'Nov-Apr', nomadScore: 10, monthlyRent: 500, lat: 7.7407, lng: 98.7784 },
  { name: 'Nusa Penida', country: 'Indonesia', region: 'Bali', cliffHeight: 15, waterDepth: 20, difficulty: 'intermediate', bestMonths: 'Apr-Nov', nomadScore: 10, monthlyRent: 600, lat: -8.7275, lng: 115.5444 },
  { name: 'El Nido Palawan', country: 'Philippines', region: 'Palawan', cliffHeight: 8, waterDepth: 12, difficulty: 'beginner', bestMonths: 'Nov-May', nomadScore: 9, monthlyRent: 500, lat: 11.1784, lng: 119.3928 },
  { name: 'Halong Bay', country: 'Vietnam', region: 'Quang Ninh', cliffHeight: 6, waterDepth: 10, difficulty: 'beginner', bestMonths: 'Mar-May', nomadScore: 8, monthlyRent: 400, lat: 20.9101, lng: 107.1839 },
  // Pacific
  { name: 'Samoa To Sua Trench', country: 'Samoa', region: 'Upolu', cliffHeight: 30, waterDepth: 35, difficulty: 'expert', bestMonths: 'May-Oct', nomadScore: 6, monthlyRent: 700, lat: -14.0500, lng: -171.4500 },
  { name: 'Kawasan Falls', country: 'Philippines', region: 'Cebu', cliffHeight: 12, waterDepth: 15, difficulty: 'intermediate', bestMonths: 'Year-round', nomadScore: 9, monthlyRent: 400, lat: 9.8083, lng: 123.3892 },
  { name: 'Waimea Bay Hawaii', country: 'USA', region: 'Oahu', cliffHeight: 8, waterDepth: 12, difficulty: 'intermediate', bestMonths: 'May-Sep', nomadScore: 7, monthlyRent: 2500, lat: 21.6411, lng: -158.0647 },
  // Americas
  { name: 'Havasu Falls', country: 'USA', region: 'Arizona', cliffHeight: 10, waterDepth: 12, difficulty: 'intermediate', bestMonths: 'Mar-Nov', nomadScore: 5, monthlyRent: 1500, lat: 36.2552, lng: -112.6979 },
  { name: 'Acapulco La Quebrada', country: 'Mexico', region: 'Guerrero', cliffHeight: 35, waterDepth: 4, difficulty: 'expert', bestMonths: 'Year-round', nomadScore: 7, monthlyRent: 600, lat: 16.8494, lng: -99.9164 },
  { name: 'Ik Kil Cenote', country: 'Mexico', region: 'Yucatan', cliffHeight: 26, waterDepth: 40, difficulty: 'intermediate', bestMonths: 'Year-round', nomadScore: 9, monthlyRent: 600, lat: 20.6572, lng: -88.1467 },
  { name: 'Rio Celeste', country: 'Costa Rica', region: 'Alajuela', cliffHeight: 5, waterDepth: 8, difficulty: 'beginner', bestMonths: 'Dec-Apr', nomadScore: 9, monthlyRent: 800, lat: 10.6100, lng: -85.0289 },
  // Europe Other
  { name: 'Stari Most Mostar', country: 'Bosnia', region: 'Herzegovina', cliffHeight: 24, waterDepth: 6, difficulty: 'expert', bestMonths: 'Jun-Sep', nomadScore: 8, monthlyRent: 500, lat: 43.3372, lng: 17.8150 },
  { name: 'Pont d\'Arc France', country: 'France', region: 'Ardèche', cliffHeight: 8, waterDepth: 10, difficulty: 'beginner', bestMonths: 'Jun-Sep', nomadScore: 7, monthlyRent: 900, lat: 44.3906, lng: 4.3894 },
  { name: 'Lake Bled Slovenia', country: 'Slovenia', region: 'Gorenjska', cliffHeight: 6, waterDepth: 30, difficulty: 'beginner', bestMonths: 'Jun-Sep', nomadScore: 9, monthlyRent: 800, lat: 46.3625, lng: 14.0936 },
  { name: 'Cinque Terre', country: 'Italy', region: 'Liguria', cliffHeight: 10, waterDepth: 12, difficulty: 'intermediate', bestMonths: 'May-Sep', nomadScore: 7, monthlyRent: 1200, lat: 44.1461, lng: 9.6439 },
  // Oceania
  { name: 'Abel Tasman NZ', country: 'New Zealand', region: 'South Island', cliffHeight: 8, waterDepth: 10, difficulty: 'beginner', bestMonths: 'Dec-Mar', nomadScore: 7, monthlyRent: 1400, lat: -40.8256, lng: 173.0150 },
  { name: 'Ormiston Gorge', country: 'Australia', region: 'NT', cliffHeight: 10, waterDepth: 12, difficulty: 'intermediate', bestMonths: 'Apr-Oct', nomadScore: 5, monthlyRent: 1200, lat: -23.6306, lng: 132.7256 },
  // Africa/Middle East
  { name: 'Blue Hole Dahab', country: 'Egypt', region: 'Sinai', cliffHeight: 5, waterDepth: 100, difficulty: 'beginner', bestMonths: 'Year-round', nomadScore: 9, monthlyRent: 400, lat: 28.5722, lng: 34.5408 },
  { name: 'Silfra Iceland', country: 'Iceland', region: 'Thingvellir', cliffHeight: 3, waterDepth: 18, difficulty: 'beginner', bestMonths: 'Jun-Aug', nomadScore: 6, monthlyRent: 2000, lat: 64.2558, lng: -21.1178 },
  { name: 'Storms River Mouth', country: 'South Africa', region: 'Eastern Cape', cliffHeight: 8, waterDepth: 10, difficulty: 'intermediate', bestMonths: 'Oct-Apr', nomadScore: 7, monthlyRent: 600, lat: -33.9694, lng: 23.8972 },
  // Portugal
  { name: 'Cascais Coast', country: 'Portugal', region: 'Lisbon', cliffHeight: 6, waterDepth: 8, difficulty: 'beginner', bestMonths: 'Jun-Sep', nomadScore: 10, monthlyRent: 1200, lat: 38.6979, lng: -9.4215 },
  { name: 'Madeira Natural Pools', country: 'Portugal', region: 'Madeira', cliffHeight: 4, waterDepth: 6, difficulty: 'beginner', bestMonths: 'May-Oct', nomadScore: 9, monthlyRent: 900, lat: 32.8500, lng: -17.1000 },
  { name: 'Azores Hot Springs', country: 'Portugal', region: 'Azores', cliffHeight: 5, waterDepth: 8, difficulty: 'beginner', bestMonths: 'Jun-Sep', nomadScore: 8, monthlyRent: 700, lat: 37.7833, lng: -25.5333 },
];

async function main() {
  console.log('Seeding swim/cliff jump destinations...');
  
  for (const dest of SWIM_DESTINATIONS) {
    await prisma.swim_destinations.create({
      data: {
        name: dest.name,
        country: dest.country,
        region: dest.region,
        cliffHeight: dest.cliffHeight,
        waterDepth: dest.waterDepth,
        difficulty: dest.difficulty,
        bestMonths: dest.bestMonths,
        nomadScore: dest.nomadScore,
        monthlyRent: dest.monthlyRent,
        latitude: dest.lat,
        longitude: dest.lng,
      }
    });
    console.log(`✓ ${dest.name}`);
  }
  
  console.log(`\nSeeded ${SWIM_DESTINATIONS.length} swim destinations`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

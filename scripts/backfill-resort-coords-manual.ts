import { prisma } from '../src/lib/prisma';

// Manual coordinates for ski resorts (from Google Maps / official sources)
const RESORT_COORDS: Record<string, { lat: number; lng: number }> = {
  'Alta Ski Area': { lat: 40.5884, lng: -111.6386 },
  'Alyeska Resort': { lat: 60.9606, lng: -149.0981 },
  'Arai Mountain Resort': { lat: 37.0311, lng: 138.2289 },
  'Big Sky Resort': { lat: 45.2857, lng: -111.4016 },
  'Blue Mountain Resort': { lat: 40.9317, lng: -75.5156 },
  'Boyne Mountain': { lat: 45.1639, lng: -84.9381 },
  'Camelback Resort': { lat: 41.0520, lng: -75.3579 },
  'Chamonix Mont-Blanc Valley': { lat: 45.9237, lng: 6.8694 },
  'Coronet Peak, The Remarkables, Mt Hutt': { lat: -45.0867, lng: 168.7183 },
  'Crystal Mountain Resort': { lat: 46.9282, lng: -121.5045 },
  'Cypress Mountain': { lat: 49.3965, lng: -123.2046 },
  'Deer Valley Resort': { lat: 40.6374, lng: -111.4783 },
  'Eldora Mountain Resort': { lat: 39.9372, lng: -105.5828 },
  'Furano Ski Resort': { lat: 43.3319, lng: 142.3525 },
  'Jackson Hole Mountain Resort': { lat: 43.5875, lng: -110.8278 },
  'Killington - Pico': { lat: 43.6045, lng: -72.8201 },
  'Le Massif de Charlevoix': { lat: 47.2817, lng: -70.5833 },
  'Megève Ski Area': { lat: 45.8567, lng: 6.6175 },
  'Mona Yongpyong': { lat: 37.6439, lng: 128.6797 },
  'Mountain Creek': { lat: 41.1812, lng: -74.5101 },
  'Mt. Bachelor': { lat: 43.9792, lng: -121.6889 },
  'Palisades Tahoe': { lat: 39.1969, lng: -120.2358 },
  'Revelstoke Mountain Resort': { lat: 50.9581, lng: -118.1639 },
  'Rusutsu Resort': { lat: 42.7450, lng: 140.8950 },
  'Schweitzer': { lat: 48.3678, lng: -116.6228 },
  'Sherburne, Smugglers Notch': { lat: 44.5857, lng: -72.7815 },
  'Ski Big 3': { lat: 51.4254, lng: -116.1773 },
  'Ski Santa Fe': { lat: 35.7956, lng: -105.8022 },
  'Snowbasin': { lat: 41.2161, lng: -111.8569 },
  'Snowshoe': { lat: 38.4128, lng: -79.9942 },
  'Solitude': { lat: 40.6199, lng: -111.5919 },
  'Sugarbush': { lat: 44.1364, lng: -72.9031 },
  'Telluride': { lat: 37.9364, lng: -107.8125 },
  'Val d\'Isère': { lat: 45.4481, lng: 6.9769 },
  'Verbier 4 Vallées': { lat: 46.0967, lng: 7.2286 },
  'Winter Park Resort': { lat: 39.8841, lng: -105.7628 },
  'Windham Mountain': { lat: 42.2964, lng: -74.2579 },
  'Zermatt Matterhorn': { lat: 46.0207, lng: 7.7491 },
  'Zao Onsen': { lat: 38.1667, lng: 140.3833 },
  'Lotte Arai Resort': { lat: 37.0311, lng: 138.2289 },
  'SkiBig3': { lat: 51.4254, lng: -116.1773 },
};

async function main() {
  const resorts = await prisma.ikon_resorts.findMany({
    where: {
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' }
  });

  console.log(`Found ${resorts.length} resorts without coordinates\n`);

  let updated = 0;
  let notFound = 0;

  for (const resort of resorts) {
    const coords = RESORT_COORDS[resort.name];
    
    if (coords) {
      await prisma.ikon_resorts.update({
        where: { id: resort.id },
        data: { 
          latitude: coords.lat, 
          longitude: coords.lng 
        }
      });
      console.log(`✓ ${resort.name}: ${coords.lat}, ${coords.lng}`);
      updated++;
    } else {
      console.log(`✗ ${resort.name} - not in lookup table`);
      notFound++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Not found: ${notFound}`);
  
  // Show what's still missing
  if (notFound > 0) {
    console.log(`\nStill missing (add to RESORT_COORDS):`);
    const stillMissing = await prisma.ikon_resorts.findMany({
      where: { latitude: null },
      select: { name: true }
    });
    stillMissing.forEach(r => console.log(`  '${r.name}': { lat: 0, lng: 0 },`));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

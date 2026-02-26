import { prisma } from '../src/lib/prisma';

const REMAINING_COORDS: Record<string, { lat: number; lng: number }> = {
  'Sierra-at-Tahoe': { lat: 38.7994, lng: -120.0800 },
  'Snow Valley': { lat: 34.2253, lng: -117.0364 },
  'Sun Valley': { lat: 43.6970, lng: -114.3514 },
  'Solitude Mountain Resort': { lat: 40.6199, lng: -111.5919 },
  'The Highlands': { lat: 39.1822, lng: -106.8628 },
  'Sugarbush Resort': { lat: 44.1364, lng: -72.9031 },
  'Snowshoe Mountain': { lat: 38.4128, lng: -79.9942 },
  'Sun Peaks Resort': { lat: 50.8836, lng: -119.8864 },
  "Valle d'Aosta": { lat: 45.7372, lng: 7.3206 },
  'Shiga Kogen Mountain Resort': { lat: 36.6833, lng: 138.5167 },
  'Mt.T': { lat: 35.4500, lng: 138.7500 }, // Mt. Tanigawa, Japan
  'Myoko Suginohara Ski Resort': { lat: 36.9167, lng: 138.1833 },
  'Nekoma Mountain': { lat: 37.6833, lng: 140.0667 },
  'Zao Onsen Ski Resort': { lat: 38.1667, lng: 140.3833 },
  'Yunding Snow Park': { lat: 40.9667, lng: 115.4667 },
};

async function main() {
  let updated = 0;

  for (const [name, coords] of Object.entries(REMAINING_COORDS)) {
    const result = await prisma.ikon_resorts.updateMany({
      where: { name },
      data: { latitude: coords.lat, longitude: coords.lng }
    });
    
    if (result.count > 0) {
      console.log(`✓ ${name}: ${coords.lat}, ${coords.lng}`);
      updated++;
    } else {
      console.log(`✗ ${name} - not found in DB`);
    }
  }

  console.log(`\nUpdated: ${updated}`);
  
  // Final check
  const stillMissing = await prisma.ikon_resorts.findMany({
    where: { latitude: null },
    select: { name: true }
  });
  
  if (stillMissing.length > 0) {
    console.log(`\nStill missing:`);
    stillMissing.forEach(r => console.log(`  - ${r.name}`));
  } else {
    console.log(`\n✅ All resorts now have coordinates!`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

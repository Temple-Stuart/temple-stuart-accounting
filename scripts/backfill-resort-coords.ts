import { prisma } from '../src/lib/prisma';

async function geocode(name: string, country?: string): Promise<{ lat: number; lng: number } | null> {
  // Add "ski resort" to help with accuracy
  const searchQuery = country 
    ? `${name} ski resort, ${country}`
    : `${name} ski resort`;
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
      { headers: { 'User-Agent': 'TempleStuartOS/1.0 (alex@templestuart.com)' } }
    );
    
    if (!response.ok) {
      console.log(`  HTTP error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (data && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    console.error(`  Geocoding error:`, error);
    return null;
  }
}

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
      country: true,
      state: true,
      region: true,
    },
    orderBy: { name: 'asc' }
  });

  console.log(`Found ${resorts.length} resorts without coordinates\n`);

  let updated = 0;
  let failed = 0;

  for (const resort of resorts) {
    console.log(`Geocoding: ${resort.name} (${resort.country})`);
    
    // Try with country first
    let coords = await geocode(resort.name, resort.country);
    
    // If that fails, try just the name
    if (!coords) {
      console.log(`  Retrying without country...`);
      await new Promise(r => setTimeout(r, 1100)); // Rate limit
      coords = await geocode(resort.name);
    }
    
    if (coords) {
      await prisma.ikon_resorts.update({
        where: { id: resort.id },
        data: { 
          latitude: coords.lat, 
          longitude: coords.lng 
        }
      });
      console.log(`  ✓ ${coords.lat}, ${coords.lng}`);
      updated++;
    } else {
      console.log(`  ✗ Could not geocode`);
      failed++;
    }
    
    // Rate limit - Nominatim requires max 1 req/sec
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

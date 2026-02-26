// Run with: npx ts-node scripts/backfill-trip-coordinates.ts

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load .env.local file
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

async function backfillCoordinates() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY not set');
    process.exit(1);
  }

  console.log('API Key found, starting coordinate backfill...');

  // Get all committed trips without coordinates
  const trips = await prisma.trips.findMany({
    where: {
      status: 'committed',
      latitude: null,
      destination: { not: null }
    }
  });

  console.log(`Found ${trips.length} trips without coordinates`);

  for (const trip of trips) {
    if (!trip.destination) continue;
    
    try {
      console.log(`Fetching coordinates for: ${trip.destination}`);
      
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(trip.destination)}&key=${apiKey}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      const firstResult = searchData.results?.[0];
      if (firstResult?.geometry?.location) {
        const { lat, lng } = firstResult.geometry.location;
        
        await prisma.trips.update({
          where: { id: trip.id },
          data: { 
            latitude: lat,
            longitude: lng
          }
        });
        
        console.log(`  ✓ Updated ${trip.destination}: ${lat}, ${lng}`);
      } else {
        console.log(`  ✗ No coordinates found for ${trip.destination}`);
      }
      
      // Rate limit - wait 200ms between requests
      await new Promise(r => setTimeout(r, 200));
      
    } catch (err) {
      console.error(`  ✗ Error for ${trip.destination}:`, err);
    }
  }

  console.log('Done!');
  await prisma.$disconnect();
}

backfillCoordinates();

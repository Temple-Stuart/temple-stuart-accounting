// Run with: npx ts-node scripts/backfill-trip-photos.ts

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load .env.local file (where the Google key is)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

async function backfillPhotos() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY not set');
    process.exit(1);
  }

  console.log('API Key found, starting backfill...');

  // Get all committed trips without photos
  const trips = await prisma.trips.findMany({
    where: {
      status: 'committed',
      destinationPhoto: null,
      destination: { not: null }
    }
  });

  console.log(`Found ${trips.length} trips without photos`);

  for (const trip of trips) {
    if (!trip.destination) continue;
    
    try {
      console.log(`Fetching photo for: ${trip.destination}`);
      
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(trip.destination)}&key=${apiKey}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (searchData.results?.[0]?.photos?.[0]?.photo_reference) {
        const photoRef = searchData.results[0].photos[0].photo_reference;
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`;
        
        await prisma.trips.update({
          where: { id: trip.id },
          data: { destinationPhoto: photoUrl }
        });
        
        console.log(`  ✓ Updated ${trip.destination}`);
      } else {
        console.log(`  ✗ No photo found for ${trip.destination}`);
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

backfillPhotos();

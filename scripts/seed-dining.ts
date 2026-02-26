import { prisma } from '../src/lib/prisma';

const DINING_DESTINATIONS = [
  // USA
  { name: 'Los Angeles', city: 'Los Angeles', country: 'USA', cuisineType: 'Diverse', priceLevel: 3, nomadScore: 8, wifiSpeed: 150, lat: 34.0522, lng: -118.2437 },
  { name: 'New York City', city: 'New York', country: 'USA', cuisineType: 'International', priceLevel: 4, nomadScore: 9, wifiSpeed: 200, lat: 40.7128, lng: -74.0060 },
  { name: 'San Francisco', city: 'San Francisco', country: 'USA', cuisineType: 'Farm-to-Table', priceLevel: 4, nomadScore: 9, wifiSpeed: 180, lat: 37.7749, lng: -122.4194 },
  { name: 'Chicago', city: 'Chicago', country: 'USA', cuisineType: 'American', priceLevel: 3, nomadScore: 7, wifiSpeed: 150, lat: 41.8781, lng: -87.6298 },
  { name: 'Austin', city: 'Austin', country: 'USA', cuisineType: 'BBQ/Tex-Mex', priceLevel: 2, nomadScore: 9, wifiSpeed: 140, lat: 30.2672, lng: -97.7431 },
  { name: 'Miami', city: 'Miami', country: 'USA', cuisineType: 'Latin-Fusion', priceLevel: 3, nomadScore: 8, wifiSpeed: 130, lat: 25.7617, lng: -80.1918 },
  // Europe
  { name: 'Paris', city: 'Paris', country: 'France', cuisineType: 'French', priceLevel: 4, michelinStars: 3, nomadScore: 8, wifiSpeed: 120, lat: 48.8566, lng: 2.3522 },
  { name: 'Barcelona', city: 'Barcelona', country: 'Spain', cuisineType: 'Mediterranean', priceLevel: 3, nomadScore: 9, wifiSpeed: 130, lat: 41.3851, lng: 2.1734 },
  { name: 'Rome', city: 'Rome', country: 'Italy', cuisineType: 'Italian', priceLevel: 3, nomadScore: 7, wifiSpeed: 100, lat: 41.9028, lng: 12.4964 },
  { name: 'Lisbon', city: 'Lisbon', country: 'Portugal', cuisineType: 'Portuguese', priceLevel: 2, nomadScore: 10, wifiSpeed: 140, lat: 38.7223, lng: -9.1393 },
  { name: 'Copenhagen', city: 'Copenhagen', country: 'Denmark', cuisineType: 'Nordic', priceLevel: 4, michelinStars: 3, nomadScore: 8, wifiSpeed: 150, lat: 55.6761, lng: 12.5683 },
  { name: 'London', city: 'London', country: 'UK', cuisineType: 'International', priceLevel: 4, nomadScore: 8, wifiSpeed: 140, lat: 51.5074, lng: -0.1278 },
  // Asia
  { name: 'Tokyo', city: 'Tokyo', country: 'Japan', cuisineType: 'Japanese', priceLevel: 3, michelinStars: 3, nomadScore: 8, wifiSpeed: 200, lat: 35.6762, lng: 139.6503 },
  { name: 'Bangkok', city: 'Bangkok', country: 'Thailand', cuisineType: 'Thai', priceLevel: 1, nomadScore: 10, wifiSpeed: 80, lat: 13.7563, lng: 100.5018 },
  { name: 'Singapore', city: 'Singapore', country: 'Singapore', cuisineType: 'Hawker', priceLevel: 2, nomadScore: 9, wifiSpeed: 200, lat: 1.3521, lng: 103.8198 },
  { name: 'Hong Kong', city: 'Hong Kong', country: 'China', cuisineType: 'Cantonese', priceLevel: 3, nomadScore: 8, wifiSpeed: 180, lat: 22.3193, lng: 114.1694 },
  { name: 'Seoul', city: 'Seoul', country: 'South Korea', cuisineType: 'Korean', priceLevel: 2, nomadScore: 9, wifiSpeed: 250, lat: 37.5665, lng: 126.9780 },
  // Mexico/LATAM
  { name: 'Mexico City', city: 'Mexico City', country: 'Mexico', cuisineType: 'Mexican', priceLevel: 2, nomadScore: 10, wifiSpeed: 80, lat: 19.4326, lng: -99.1332 },
  { name: 'Buenos Aires', city: 'Buenos Aires', country: 'Argentina', cuisineType: 'Steakhouse', priceLevel: 2, nomadScore: 9, wifiSpeed: 60, lat: -34.6037, lng: -58.3816 },
  { name: 'Lima', city: 'Lima', country: 'Peru', cuisineType: 'Peruvian', priceLevel: 2, nomadScore: 8, wifiSpeed: 50, lat: -12.0464, lng: -77.0428 },
];

async function main() {
  console.log('Seeding dining destinations...');
  
  for (const dest of DINING_DESTINATIONS) {
    await prisma.dining_destinations.create({
      data: {
        name: dest.name,
        city: dest.city,
        country: dest.country,
        cuisineType: dest.cuisineType,
        priceLevel: dest.priceLevel,
        michelinStars: dest.michelinStars || null,
        nomadScore: dest.nomadScore,
        wifiSpeed: dest.wifiSpeed,
        latitude: dest.lat,
        longitude: dest.lng,
      }
    });
    console.log(`✓ ${dest.name}`);
  }
  
  console.log(`\nSeeded ${DINING_DESTINATIONS.length} dining destinations`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

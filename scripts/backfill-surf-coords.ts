import { prisma } from '../src/lib/prisma';

// Popular surf destinations with coordinates
const SURF_COORDS: Record<string, { lat: number; lng: number }> = {
  // Indonesia
  'Bali': { lat: -8.4095, lng: 115.1889 },
  'Uluwatu': { lat: -8.8291, lng: 115.0849 },
  'Canggu': { lat: -8.6478, lng: 115.1385 },
  'Mentawai Islands': { lat: -2.0833, lng: 99.5000 },
  'Lombok': { lat: -8.6500, lng: 116.3248 },
  'Sumbawa': { lat: -8.5000, lng: 117.4167 },
  'Sumatra': { lat: 0.5897, lng: 101.3431 },
  'Nias': { lat: 1.1000, lng: 97.5500 },
  
  // Central America / Caribbean
  'Costa Rica': { lat: 9.7489, lng: -83.7534 },
  'Tamarindo': { lat: 10.2997, lng: -85.8372 },
  'Santa Teresa': { lat: 9.6397, lng: -85.1697 },
  'Nicaragua': { lat: 11.4333, lng: -85.8667 },
  'Panama': { lat: 8.5380, lng: -80.7821 },
  'Puerto Rico': { lat: 18.2208, lng: -66.5901 },
  'Barbados': { lat: 13.1939, lng: -59.5432 },
  
  // Mexico
  'Puerto Escondido': { lat: 15.8720, lng: -97.0767 },
  'Sayulita': { lat: 20.8682, lng: -105.4408 },
  'Baja California': { lat: 28.0000, lng: -114.0000 },
  'Todos Santos': { lat: 23.4500, lng: -110.2167 },
  
  // USA
  'Hawaii': { lat: 21.3069, lng: -157.8583 },
  'Oahu': { lat: 21.4389, lng: -158.0001 },
  'Maui': { lat: 20.7984, lng: -156.3319 },
  'Pipeline': { lat: 21.6650, lng: -158.0536 },
  'California': { lat: 36.7783, lng: -119.4179 },
  'San Diego': { lat: 32.7157, lng: -117.1611 },
  'Santa Cruz': { lat: 36.9741, lng: -122.0308 },
  'Huntington Beach': { lat: 33.6595, lng: -117.9988 },
  'Malibu': { lat: 34.0259, lng: -118.7798 },
  
  // Portugal
  'Portugal': { lat: 39.3999, lng: -8.2245 },
  'Nazaré': { lat: 39.6017, lng: -9.0714 },
  'Peniche': { lat: 39.3558, lng: -9.3811 },
  'Ericeira': { lat: 38.9631, lng: -9.4153 },
  'Lagos': { lat: 37.1028, lng: -8.6733 },
  'Sagres': { lat: 37.0086, lng: -8.9403 },
  
  // Spain
  'Spain': { lat: 40.4637, lng: -3.7492 },
  'Canary Islands': { lat: 28.2916, lng: -16.6291 },
  'Fuerteventura': { lat: 28.3587, lng: -14.0537 },
  'Lanzarote': { lat: 29.0469, lng: -13.5899 },
  'San Sebastian': { lat: 43.3183, lng: -1.9812 },
  'Basque Country': { lat: 43.2630, lng: -2.9350 },
  
  // France
  'France': { lat: 46.2276, lng: 2.2137 },
  'Hossegor': { lat: 43.6677, lng: -1.3981 },
  'Biarritz': { lat: 43.4832, lng: -1.5586 },
  'Lacanau': { lat: 44.9778, lng: -1.1964 },
  
  // Australia
  'Australia': { lat: -25.2744, lng: 133.7751 },
  'Gold Coast': { lat: -28.0167, lng: 153.4000 },
  'Byron Bay': { lat: -28.6474, lng: 153.6020 },
  'Sydney': { lat: -33.8688, lng: 151.2093 },
  'Margaret River': { lat: -33.9536, lng: 115.0753 },
  'Bells Beach': { lat: -38.3692, lng: 144.2814 },
  'Noosa': { lat: -26.3936, lng: 153.0914 },
  
  // South Africa
  'South Africa': { lat: -30.5595, lng: 22.9375 },
  'Cape Town': { lat: -33.9249, lng: 18.4241 },
  'Jeffreys Bay': { lat: -34.0489, lng: 24.9308 },
  'Durban': { lat: -29.8587, lng: 31.0218 },
  
  // Morocco
  'Morocco': { lat: 31.7917, lng: -7.0926 },
  'Taghazout': { lat: 30.5444, lng: -9.7083 },
  'Agadir': { lat: 30.4278, lng: -9.5981 },
  'Essaouira': { lat: 31.5085, lng: -9.7595 },
  
  // Philippines
  'Philippines': { lat: 12.8797, lng: 121.7740 },
  'Siargao': { lat: 9.8482, lng: 126.0458 },
  'La Union': { lat: 16.6159, lng: 120.3209 },
  
  // Sri Lanka
  'Sri Lanka': { lat: 7.8731, lng: 80.7718 },
  'Arugam Bay': { lat: 6.8406, lng: 81.8361 },
  'Weligama': { lat: 5.9726, lng: 80.4297 },
  'Hikkaduwa': { lat: 6.1395, lng: 80.1014 },
  
  // Maldives
  'Maldives': { lat: 3.2028, lng: 73.2207 },
  
  // Fiji
  'Fiji': { lat: -17.7134, lng: 178.0650 },
  'Cloudbreak': { lat: -17.8697, lng: 177.1883 },
  
  // Tahiti
  'Tahiti': { lat: -17.6509, lng: -149.4260 },
  'Teahupo\'o': { lat: -17.8667, lng: -149.2667 },
  
  // Brazil
  'Brazil': { lat: -14.2350, lng: -51.9253 },
  'Florianópolis': { lat: -27.5954, lng: -48.5480 },
  'Fernando de Noronha': { lat: -3.8544, lng: -32.4297 },
  
  // Peru
  'Peru': { lat: -9.1900, lng: -75.0152 },
  'Chicama': { lat: -7.8417, lng: -79.4417 },
  'Máncora': { lat: -4.1039, lng: -81.0456 },
  
  // Chile
  'Chile': { lat: -35.6751, lng: -71.5430 },
  'Pichilemu': { lat: -34.3872, lng: -72.0036 },
  
  // Japan
  'Japan': { lat: 36.2048, lng: 138.2529 },
  'Chiba': { lat: 35.6073, lng: 140.1063 },
  'Miyazaki': { lat: 31.9111, lng: 131.4239 },
  
  // New Zealand
  'New Zealand': { lat: -40.9006, lng: 174.8860 },
  'Raglan': { lat: -37.8000, lng: 174.8833 },
  
  // Senegal
  'Senegal': { lat: 14.4974, lng: -14.4524 },
  'Dakar': { lat: 14.7167, lng: -17.4677 },
  
  // El Salvador
  'El Salvador': { lat: 13.7942, lng: -88.8965 },
  'El Tunco': { lat: 13.4947, lng: -89.3833 },
};

async function main() {
  const spots = await prisma.surf_spots.findMany({
    where: { latitude: null },
    select: { id: true, name: true, country: true, region: true }
  });

  console.log(`Found ${spots.length} surf spots without coordinates\n`);

  let updated = 0;
  let notFound = 0;

  for (const spot of spots) {
    // Try exact name match first
    let coords = SURF_COORDS[spot.name];
    
    // Try region
    if (!coords && spot.region) {
      coords = SURF_COORDS[spot.region];
    }
    
    // Try country
    if (!coords) {
      coords = SURF_COORDS[spot.country];
    }
    
    if (coords) {
      await prisma.surf_spots.update({
        where: { id: spot.id },
        data: { latitude: coords.lat, longitude: coords.lng }
      });
      console.log(`✓ ${spot.name} (${spot.country}): ${coords.lat}, ${coords.lng}`);
      updated++;
    } else {
      console.log(`✗ ${spot.name} (${spot.country}) - not in lookup`);
      notFound++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Not found: ${notFound}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

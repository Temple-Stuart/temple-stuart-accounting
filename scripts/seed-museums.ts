import { prisma } from '../src/lib/prisma';

const MUSEUM_DESTINATIONS = [
  // USA
  { name: 'New York - MoMA & Met', city: 'New York', country: 'USA', museumType: 'Mixed', collectionSize: 'world-class', nomadScore: 9, monthlyRent: 3500, lat: 40.7614, lng: -73.9776 },
  { name: 'Los Angeles - LACMA & Getty', city: 'Los Angeles', country: 'USA', museumType: 'Mixed', collectionSize: 'world-class', nomadScore: 8, monthlyRent: 2800, lat: 34.0639, lng: -118.3592 },
  { name: 'San Francisco - SFMOMA', city: 'San Francisco', country: 'USA', museumType: 'Contemporary', collectionSize: 'large', nomadScore: 9, monthlyRent: 3200, lat: 37.7857, lng: -122.4011 },
  { name: 'Chicago - Art Institute', city: 'Chicago', country: 'USA', museumType: 'Classical', collectionSize: 'world-class', nomadScore: 7, monthlyRent: 2000, lat: 41.8796, lng: -87.6237 },
  { name: 'Washington DC - Smithsonian', city: 'Washington DC', country: 'USA', museumType: 'Mixed', collectionSize: 'world-class', nomadScore: 7, monthlyRent: 2400, lat: 38.8881, lng: -77.0260 },
  // Europe
  { name: 'Paris - Louvre & Musée d\'Orsay', city: 'Paris', country: 'France', museumType: 'Classical', collectionSize: 'world-class', nomadScore: 8, monthlyRent: 2200, lat: 48.8606, lng: 2.3376 },
  { name: 'London - Tate & National Gallery', city: 'London', country: 'UK', museumType: 'Mixed', collectionSize: 'world-class', nomadScore: 8, monthlyRent: 2800, lat: 51.5076, lng: -0.0994 },
  { name: 'Amsterdam - Rijksmuseum & Van Gogh', city: 'Amsterdam', country: 'Netherlands', museumType: 'Classical', collectionSize: 'world-class', nomadScore: 9, monthlyRent: 2000, lat: 52.3600, lng: 4.8852 },
  { name: 'Madrid - Prado & Reina Sofía', city: 'Madrid', country: 'Spain', museumType: 'Classical', collectionSize: 'world-class', nomadScore: 8, monthlyRent: 1400, lat: 40.4138, lng: -3.6921 },
  { name: 'Barcelona - Picasso & MACBA', city: 'Barcelona', country: 'Spain', museumType: 'Mixed', collectionSize: 'large', nomadScore: 9, monthlyRent: 1500, lat: 41.3850, lng: 2.1803 },
  { name: 'Florence - Uffizi', city: 'Florence', country: 'Italy', museumType: 'Classical', collectionSize: 'world-class', nomadScore: 7, monthlyRent: 1200, lat: 43.7687, lng: 11.2553 },
  { name: 'Rome - Vatican Museums', city: 'Rome', country: 'Italy', museumType: 'Classical', collectionSize: 'world-class', nomadScore: 7, monthlyRent: 1400, lat: 41.9065, lng: 12.4536 },
  { name: 'Berlin - Museum Island', city: 'Berlin', country: 'Germany', museumType: 'Mixed', collectionSize: 'world-class', nomadScore: 9, monthlyRent: 1200, lat: 52.5169, lng: 13.4019 },
  { name: 'Vienna - Kunsthistorisches', city: 'Vienna', country: 'Austria', museumType: 'Classical', collectionSize: 'world-class', nomadScore: 8, monthlyRent: 1300, lat: 48.2039, lng: 16.3616 },
  { name: 'Copenhagen - Louisiana', city: 'Copenhagen', country: 'Denmark', museumType: 'Contemporary', collectionSize: 'large', nomadScore: 8, monthlyRent: 2000, lat: 55.9706, lng: 12.5419 },
  { name: 'Lisbon - Berardo & MAAT', city: 'Lisbon', country: 'Portugal', museumType: 'Contemporary', collectionSize: 'large', nomadScore: 10, monthlyRent: 1100, lat: 38.6960, lng: -9.2065 },
  { name: 'Bilbao - Guggenheim', city: 'Bilbao', country: 'Spain', museumType: 'Contemporary', collectionSize: 'large', nomadScore: 7, monthlyRent: 900, lat: 43.2687, lng: -2.9340 },
  // Asia
  { name: 'Tokyo - National & teamLab', city: 'Tokyo', country: 'Japan', museumType: 'Mixed', collectionSize: 'world-class', nomadScore: 8, monthlyRent: 1800, lat: 35.7188, lng: 139.7766 },
  { name: 'Shanghai - Power Station of Art', city: 'Shanghai', country: 'China', museumType: 'Contemporary', collectionSize: 'large', nomadScore: 7, monthlyRent: 1200, lat: 31.1829, lng: 121.4836 },
  { name: 'Hong Kong - M+', city: 'Hong Kong', country: 'China', museumType: 'Contemporary', collectionSize: 'large', nomadScore: 8, monthlyRent: 2500, lat: 22.3033, lng: 114.1599 },
  { name: 'Singapore - National Gallery', city: 'Singapore', country: 'Singapore', museumType: 'Mixed', collectionSize: 'large', nomadScore: 9, monthlyRent: 2200, lat: 1.2903, lng: 103.8515 },
  { name: 'Seoul - Leeum & MMCA', city: 'Seoul', country: 'South Korea', museumType: 'Contemporary', collectionSize: 'large', nomadScore: 9, monthlyRent: 1000, lat: 37.5384, lng: 126.9997 },
  // Middle East
  { name: 'Abu Dhabi - Louvre Abu Dhabi', city: 'Abu Dhabi', country: 'UAE', museumType: 'Mixed', collectionSize: 'large', nomadScore: 6, monthlyRent: 2000, lat: 24.5339, lng: 54.3983 },
  { name: 'Doha - Museum of Islamic Art', city: 'Doha', country: 'Qatar', museumType: 'Classical', collectionSize: 'large', nomadScore: 5, monthlyRent: 1800, lat: 25.2959, lng: 51.5390 },
  // South America
  { name: 'Mexico City - MUNAL & Frida Kahlo', city: 'Mexico City', country: 'Mexico', museumType: 'Mixed', collectionSize: 'large', nomadScore: 10, monthlyRent: 800, lat: 19.4360, lng: -99.1410 },
  { name: 'São Paulo - MASP', city: 'São Paulo', country: 'Brazil', museumType: 'Mixed', collectionSize: 'large', nomadScore: 8, monthlyRent: 700, lat: -23.5614, lng: -46.6558 },
  { name: 'Buenos Aires - MALBA', city: 'Buenos Aires', country: 'Argentina', museumType: 'Contemporary', collectionSize: 'large', nomadScore: 9, monthlyRent: 600, lat: -34.5773, lng: -58.4036 },
  // Australia
  { name: 'Melbourne - NGV', city: 'Melbourne', country: 'Australia', museumType: 'Mixed', collectionSize: 'large', nomadScore: 8, monthlyRent: 1600, lat: -37.8226, lng: 144.9689 },
  { name: 'Sydney - Art Gallery NSW', city: 'Sydney', country: 'Australia', museumType: 'Mixed', collectionSize: 'large', nomadScore: 8, monthlyRent: 2000, lat: -33.8688, lng: 151.2171 },
  // Additional notable
  { name: 'Basel - Kunstmuseum & Beyeler', city: 'Basel', country: 'Switzerland', museumType: 'Mixed', collectionSize: 'world-class', nomadScore: 7, monthlyRent: 1800, lat: 47.5546, lng: 7.5948 },
  { name: 'Athens - Acropolis Museum', city: 'Athens', country: 'Greece', museumType: 'Classical', collectionSize: 'large', nomadScore: 8, monthlyRent: 800, lat: 37.9685, lng: 23.7292 },
  { name: 'St. Petersburg - Hermitage', city: 'St. Petersburg', country: 'Russia', museumType: 'Classical', collectionSize: 'world-class', nomadScore: 6, monthlyRent: 700, lat: 59.9398, lng: 30.3146 },
  { name: 'Cape Town - Zeitz MOCAA', city: 'Cape Town', country: 'South Africa', museumType: 'Contemporary', collectionSize: 'large', nomadScore: 8, monthlyRent: 900, lat: -33.9086, lng: 18.4178 },
];

async function main() {
  console.log('Seeding museum destinations...');
  
  for (const dest of MUSEUM_DESTINATIONS) {
    await prisma.museum_destinations.create({
      data: {
        name: dest.name,
        city: dest.city,
        country: dest.country,
        museumType: dest.museumType,
        collectionSize: dest.collectionSize,
        nomadScore: dest.nomadScore,
        monthlyRent: dest.monthlyRent,
        latitude: dest.lat,
        longitude: dest.lng,
      }
    });
    console.log(`✓ ${dest.name}`);
  }
  
  console.log(`\nSeeded ${MUSEUM_DESTINATIONS.length} museum destinations`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // ═══════════════════════════════════════════════════════════════════
  // CYCLING DESTINATIONS - 33 Cities with Great Routes + Nomad Scene
  // ═══════════════════════════════════════════════════════════════════
  const cyclingDestinations = [
    { city: 'Girona', country: 'Spain', routeVariety: 10, terrainType: 'mountain', roadQuality: 9, bikeCulture: 10, rentalAvail: true, monthlyRent: 900, costIndex: 7, nomadScore: 8, nearestAirport: 'GRO', visaEase: 'Schengen 90d' },
    { city: 'Mallorca', country: 'Spain', routeVariety: 10, terrainType: 'hilly', roadQuality: 10, bikeCulture: 10, rentalAvail: true, monthlyRent: 1200, costIndex: 6, nomadScore: 7, nearestAirport: 'PMI', visaEase: 'Schengen 90d' },
    { city: 'Nice', country: 'France', routeVariety: 10, terrainType: 'mountain', roadQuality: 9, bikeCulture: 9, rentalAvail: true, monthlyRent: 1500, costIndex: 4, nomadScore: 7, nearestAirport: 'NCE', visaEase: 'Schengen 90d' },
    { city: 'Boulder', country: 'USA', routeVariety: 9, terrainType: 'mountain', roadQuality: 9, bikeCulture: 10, rentalAvail: true, monthlyRent: 2000, costIndex: 3, nomadScore: 8, nearestAirport: 'DEN', visaEase: 'ESTA/visa' },
    { city: 'Taipei', country: 'Taiwan', routeVariety: 8, terrainType: 'hilly', roadQuality: 9, bikeCulture: 9, rentalAvail: true, monthlyRent: 800, costIndex: 7, nomadScore: 7, nearestAirport: 'TPE', visaEase: 'visa-free 90d' },
    { city: 'Adelaide', country: 'Australia', routeVariety: 8, terrainType: 'hilly', roadQuality: 9, bikeCulture: 8, rentalAvail: true, monthlyRent: 1200, costIndex: 5, nomadScore: 7, nearestAirport: 'ADL', visaEase: 'e-visa' },
    { city: 'Chiang Mai', country: 'Thailand', routeVariety: 8, terrainType: 'mountain', roadQuality: 7, bikeCulture: 7, rentalAvail: true, monthlyRent: 450, costIndex: 10, nomadScore: 10, nearestAirport: 'CNX', visaEase: 'visa-free 60d' },
    { city: 'Cape Town', country: 'South Africa', routeVariety: 9, terrainType: 'mountain', roadQuality: 8, bikeCulture: 8, rentalAvail: true, monthlyRent: 800, costIndex: 7, nomadScore: 8, nearestAirport: 'CPT', visaEase: 'visa-free 90d' },
    { city: 'Tenerife', country: 'Spain', routeVariety: 9, terrainType: 'mountain', roadQuality: 9, bikeCulture: 9, rentalAvail: true, monthlyRent: 800, costIndex: 7, nomadScore: 8, nearestAirport: 'TFS', visaEase: 'Schengen 90d' },
    { city: 'Bogota', country: 'Colombia', routeVariety: 8, terrainType: 'mountain', roadQuality: 7, bikeCulture: 9, rentalAvail: true, monthlyRent: 600, costIndex: 8, nomadScore: 7, nearestAirport: 'BOG', visaEase: 'visa-free 90d' },
    { city: 'Medellin', country: 'Colombia', routeVariety: 9, terrainType: 'mountain', roadQuality: 7, bikeCulture: 8, rentalAvail: true, monthlyRent: 700, costIndex: 8, nomadScore: 9, nearestAirport: 'MDE', visaEase: 'visa-free 90d' },
    { city: 'Lisbon', country: 'Portugal', routeVariety: 8, terrainType: 'hilly', roadQuality: 8, bikeCulture: 7, rentalAvail: true, monthlyRent: 1200, costIndex: 6, nomadScore: 10, nearestAirport: 'LIS', visaEase: 'Schengen 90d' },
    { city: 'Ljubljana', country: 'Slovenia', routeVariety: 9, terrainType: 'mountain', roadQuality: 9, bikeCulture: 9, rentalAvail: true, monthlyRent: 800, costIndex: 7, nomadScore: 7, nearestAirport: 'LJU', visaEase: 'Schengen 90d' },
    { city: 'Lake Como', country: 'Italy', routeVariety: 10, terrainType: 'mountain', roadQuality: 8, bikeCulture: 9, rentalAvail: true, monthlyRent: 1100, costIndex: 5, nomadScore: 6, nearestAirport: 'MXP', visaEase: 'Schengen 90d' },
    { city: 'Tuscany', country: 'Italy', routeVariety: 9, terrainType: 'hilly', roadQuality: 8, bikeCulture: 9, rentalAvail: true, monthlyRent: 900, costIndex: 6, nomadScore: 6, nearestAirport: 'FLR', visaEase: 'Schengen 90d' },
    { city: 'Queenstown', country: 'New Zealand', routeVariety: 9, terrainType: 'mountain', roadQuality: 9, bikeCulture: 8, rentalAvail: true, monthlyRent: 1500, costIndex: 4, nomadScore: 6, nearestAirport: 'ZQN', visaEase: 'visa-free 90d' },
    { city: 'Bali', country: 'Indonesia', routeVariety: 7, terrainType: 'hilly', roadQuality: 6, bikeCulture: 6, rentalAvail: true, monthlyRent: 600, costIndex: 9, nomadScore: 10, nearestAirport: 'DPS', visaEase: 'VOA 30d' },
    { city: 'Lanzarote', country: 'Spain', routeVariety: 8, terrainType: 'hilly', roadQuality: 9, bikeCulture: 9, rentalAvail: true, monthlyRent: 850, costIndex: 7, nomadScore: 7, nearestAirport: 'ACE', visaEase: 'Schengen 90d' },
    { city: 'Innsbruck', country: 'Austria', routeVariety: 10, terrainType: 'mountain', roadQuality: 10, bikeCulture: 9, rentalAvail: true, monthlyRent: 1100, costIndex: 5, nomadScore: 6, nearestAirport: 'INN', visaEase: 'Schengen 90d' },
    { city: 'Oaxaca', country: 'Mexico', routeVariety: 7, terrainType: 'mountain', roadQuality: 6, bikeCulture: 6, rentalAvail: true, monthlyRent: 600, costIndex: 8, nomadScore: 8, nearestAirport: 'OAX', visaEase: 'visa-free 180d' },
    { city: 'San Luis Potosi', country: 'Mexico', routeVariety: 7, terrainType: 'mountain', roadQuality: 7, bikeCulture: 6, rentalAvail: true, monthlyRent: 500, costIndex: 9, nomadScore: 6, nearestAirport: 'SLP', visaEase: 'visa-free 180d' },
    { city: 'Da Nang', country: 'Vietnam', routeVariety: 8, terrainType: 'hilly', roadQuality: 7, bikeCulture: 7, rentalAvail: true, monthlyRent: 450, costIndex: 9, nomadScore: 9, nearestAirport: 'DAD', visaEase: 'e-visa' },
    { city: 'Algarve', country: 'Portugal', routeVariety: 8, terrainType: 'hilly', roadQuality: 9, bikeCulture: 8, rentalAvail: true, monthlyRent: 900, costIndex: 7, nomadScore: 7, nearestAirport: 'FAO', visaEase: 'Schengen 90d' },
    { city: 'Tarragona', country: 'Spain', routeVariety: 8, terrainType: 'hilly', roadQuality: 9, bikeCulture: 8, rentalAvail: true, monthlyRent: 750, costIndex: 7, nomadScore: 6, nearestAirport: 'REU', visaEase: 'Schengen 90d' },
    { city: 'Annecy', country: 'France', routeVariety: 10, terrainType: 'mountain', roadQuality: 9, bikeCulture: 9, rentalAvail: true, monthlyRent: 1200, costIndex: 5, nomadScore: 6, nearestAirport: 'GVA', visaEase: 'Schengen 90d' },
    { city: 'Gran Canaria', country: 'Spain', routeVariety: 9, terrainType: 'mountain', roadQuality: 9, bikeCulture: 8, rentalAvail: true, monthlyRent: 900, costIndex: 7, nomadScore: 9, nearestAirport: 'LPA', visaEase: 'Schengen 90d' },
    { city: 'Split', country: 'Croatia', routeVariety: 8, terrainType: 'hilly', roadQuality: 8, bikeCulture: 7, rentalAvail: true, monthlyRent: 900, costIndex: 7, nomadScore: 7, nearestAirport: 'SPU', visaEase: 'Schengen 90d' },
    { city: 'Lucca', country: 'Italy', routeVariety: 8, terrainType: 'flat', roadQuality: 8, bikeCulture: 9, rentalAvail: true, monthlyRent: 850, costIndex: 6, nomadScore: 6, nearestAirport: 'PSA', visaEase: 'Schengen 90d' },
    { city: 'Siem Reap', country: 'Cambodia', routeVariety: 6, terrainType: 'flat', roadQuality: 5, bikeCulture: 7, rentalAvail: true, monthlyRent: 400, costIndex: 10, nomadScore: 8, nearestAirport: 'REP', visaEase: 'VOA' },
    { city: 'Phuket', country: 'Thailand', routeVariety: 7, terrainType: 'hilly', roadQuality: 7, bikeCulture: 6, rentalAvail: true, monthlyRent: 700, costIndex: 8, nomadScore: 8, nearestAirport: 'HKT', visaEase: 'visa-free 60d' },
    { city: 'Auckland', country: 'New Zealand', routeVariety: 8, terrainType: 'hilly', roadQuality: 9, bikeCulture: 8, rentalAvail: true, monthlyRent: 1400, costIndex: 4, nomadScore: 7, nearestAirport: 'AKL', visaEase: 'visa-free 90d' },
    { city: 'Sao Paulo', country: 'Brazil', routeVariety: 7, terrainType: 'hilly', roadQuality: 6, bikeCulture: 7, rentalAvail: true, monthlyRent: 800, costIndex: 7, nomadScore: 7, nearestAirport: 'GRU', visaEase: 'visa-free 90d' },
    { city: 'San Sebastian', country: 'Spain', routeVariety: 9, terrainType: 'mountain', roadQuality: 9, bikeCulture: 9, rentalAvail: true, monthlyRent: 1100, costIndex: 5, nomadScore: 7, nearestAirport: 'EAS', visaEase: 'Schengen 90d' },
  ];

  for (const dest of cyclingDestinations) {
    await prisma.cycling_destinations.create({ data: dest });
  }
  console.log(`✓ Seeded ${cyclingDestinations.length} cycling destinations`);

  // ═══════════════════════════════════════════════════════════════════
  // RACE DESTINATIONS - 33 Marathons & Halfs in Nomad Hubs
  // ═══════════════════════════════════════════════════════════════════
  const raceDestinations = [
    { raceName: 'Lisbon Marathon', city: 'Lisbon', country: 'Portugal', raceType: 'marathon', typicalMonth: 'October', entryFee: 80, fieldSize: 15000, courseType: 'flat', sceneryRating: 9, monthlyRent: 1200, costIndex: 6, nomadScore: 10, nearestAirport: 'LIS', visaEase: 'Schengen 90d' },
    { raceName: 'Bali Marathon', city: 'Gianyar', country: 'Indonesia', raceType: 'marathon', typicalMonth: 'August', entryFee: 100, fieldSize: 8000, courseType: 'hilly', sceneryRating: 10, monthlyRent: 600, costIndex: 9, nomadScore: 10, nearestAirport: 'DPS', visaEase: 'VOA 30d' },
    { raceName: 'Mexico City Marathon', city: 'Mexico City', country: 'Mexico', raceType: 'marathon', typicalMonth: 'August', entryFee: 50, fieldSize: 35000, courseType: 'flat', sceneryRating: 8, monthlyRent: 900, costIndex: 7, nomadScore: 10, nearestAirport: 'MEX', visaEase: 'visa-free 180d' },
    { raceName: 'Cape Town Marathon', city: 'Cape Town', country: 'South Africa', raceType: 'marathon', typicalMonth: 'October', entryFee: 60, fieldSize: 12000, courseType: 'hilly', sceneryRating: 10, monthlyRent: 800, costIndex: 7, nomadScore: 8, nearestAirport: 'CPT', visaEase: 'visa-free 90d' },
    { raceName: 'Medellin Marathon', city: 'Medellin', country: 'Colombia', raceType: 'marathon', typicalMonth: 'September', entryFee: 40, fieldSize: 8000, courseType: 'hilly', sceneryRating: 8, monthlyRent: 700, costIndex: 8, nomadScore: 9, nearestAirport: 'MDE', visaEase: 'visa-free 90d' },
    { raceName: 'Bangkok Marathon', city: 'Bangkok', country: 'Thailand', raceType: 'marathon', typicalMonth: 'November', entryFee: 50, fieldSize: 30000, courseType: 'flat', sceneryRating: 7, monthlyRent: 600, costIndex: 9, nomadScore: 9, nearestAirport: 'BKK', visaEase: 'visa-free 60d' },
    { raceName: 'Barcelona Half', city: 'Barcelona', country: 'Spain', raceType: 'half', typicalMonth: 'February', entryFee: 45, fieldSize: 20000, courseType: 'flat', sceneryRating: 9, monthlyRent: 1400, costIndex: 5, nomadScore: 9, nearestAirport: 'BCN', visaEase: 'Schengen 90d' },
    { raceName: 'Chiang Mai Marathon', city: 'Chiang Mai', country: 'Thailand', raceType: 'marathon', typicalMonth: 'December', entryFee: 45, fieldSize: 6000, courseType: 'hilly', sceneryRating: 9, monthlyRent: 450, costIndex: 10, nomadScore: 10, nearestAirport: 'CNX', visaEase: 'visa-free 60d' },
    { raceName: 'Da Nang Marathon', city: 'Da Nang', country: 'Vietnam', raceType: 'marathon', typicalMonth: 'August', entryFee: 60, fieldSize: 10000, courseType: 'flat', sceneryRating: 9, monthlyRent: 450, costIndex: 9, nomadScore: 9, nearestAirport: 'DAD', visaEase: 'e-visa' },
    { raceName: 'Buenos Aires Half', city: 'Buenos Aires', country: 'Argentina', raceType: 'half', typicalMonth: 'September', entryFee: 30, fieldSize: 20000, courseType: 'flat', sceneryRating: 8, monthlyRent: 600, costIndex: 8, nomadScore: 8, nearestAirport: 'EZE', visaEase: 'visa-free 90d' },
    { raceName: 'Taipei Marathon', city: 'Taipei', country: 'Taiwan', raceType: 'marathon', typicalMonth: 'December', entryFee: 40, fieldSize: 28000, courseType: 'flat', sceneryRating: 8, monthlyRent: 800, costIndex: 7, nomadScore: 7, nearestAirport: 'TPE', visaEase: 'visa-free 90d' },
    { raceName: 'Berlin Marathon', city: 'Berlin', country: 'Germany', raceType: 'marathon', typicalMonth: 'September', entryFee: 150, fieldSize: 45000, courseType: 'flat', sceneryRating: 9, monthlyRent: 1300, costIndex: 5, nomadScore: 9, nearestAirport: 'BER', visaEase: 'Schengen 90d' },
    { raceName: 'Porto Marathon', city: 'Porto', country: 'Portugal', raceType: 'marathon', typicalMonth: 'November', entryFee: 50, fieldSize: 12000, courseType: 'hilly', sceneryRating: 9, monthlyRent: 900, costIndex: 7, nomadScore: 8, nearestAirport: 'OPO', visaEase: 'Schengen 90d' },
    { raceName: 'Phuket Marathon', city: 'Phuket', country: 'Thailand', raceType: 'marathon', typicalMonth: 'June', entryFee: 55, fieldSize: 8000, courseType: 'hilly', sceneryRating: 9, monthlyRent: 700, costIndex: 8, nomadScore: 8, nearestAirport: 'HKT', visaEase: 'visa-free 60d' },
    { raceName: 'Tbilisi Marathon', city: 'Tbilisi', country: 'Georgia', raceType: 'marathon', typicalMonth: 'October', entryFee: 40, fieldSize: 5000, courseType: 'hilly', sceneryRating: 8, monthlyRent: 500, costIndex: 9, nomadScore: 9, nearestAirport: 'TBS', visaEase: 'visa-free 365d' },
    { raceName: 'Valencia Marathon', city: 'Valencia', country: 'Spain', raceType: 'marathon', typicalMonth: 'December', entryFee: 70, fieldSize: 30000, courseType: 'flat', sceneryRating: 8, monthlyRent: 900, costIndex: 7, nomadScore: 8, nearestAirport: 'VLC', visaEase: 'Schengen 90d' },
    { raceName: 'Kuala Lumpur Marathon', city: 'Kuala Lumpur', country: 'Malaysia', raceType: 'marathon', typicalMonth: 'May', entryFee: 50, fieldSize: 35000, courseType: 'flat', sceneryRating: 7, monthlyRent: 600, costIndex: 8, nomadScore: 8, nearestAirport: 'KUL', visaEase: 'visa-free 90d' },
    { raceName: 'Split Half', city: 'Split', country: 'Croatia', raceType: 'half', typicalMonth: 'February', entryFee: 35, fieldSize: 4000, courseType: 'flat', sceneryRating: 9, monthlyRent: 900, costIndex: 7, nomadScore: 7, nearestAirport: 'SPU', visaEase: 'Schengen 90d' },
    { raceName: 'Seoul Marathon', city: 'Seoul', country: 'South Korea', raceType: 'marathon', typicalMonth: 'March', entryFee: 80, fieldSize: 35000, courseType: 'flat', sceneryRating: 8, monthlyRent: 1000, costIndex: 6, nomadScore: 7, nearestAirport: 'ICN', visaEase: 'visa-free 90d' },
    { raceName: 'Athens Marathon', city: 'Athens', country: 'Greece', raceType: 'marathon', typicalMonth: 'November', entryFee: 80, fieldSize: 18000, courseType: 'hilly', sceneryRating: 10, monthlyRent: 700, costIndex: 7, nomadScore: 7, nearestAirport: 'ATH', visaEase: 'Schengen 90d' },
    { raceName: 'Singapore Marathon', city: 'Singapore', country: 'Singapore', raceType: 'marathon', typicalMonth: 'December', entryFee: 100, fieldSize: 50000, courseType: 'flat', sceneryRating: 8, monthlyRent: 2500, costIndex: 2, nomadScore: 8, nearestAirport: 'SIN', visaEase: 'visa-free 90d' },
    { raceName: 'Cancun Marathon', city: 'Cancun', country: 'Mexico', raceType: 'marathon', typicalMonth: 'December', entryFee: 80, fieldSize: 8000, courseType: 'flat', sceneryRating: 9, monthlyRent: 1000, costIndex: 7, nomadScore: 7, nearestAirport: 'CUN', visaEase: 'visa-free 180d' },
    { raceName: 'Hanoi Marathon', city: 'Hanoi', country: 'Vietnam', raceType: 'marathon', typicalMonth: 'March', entryFee: 50, fieldSize: 8000, courseType: 'flat', sceneryRating: 8, monthlyRent: 450, costIndex: 9, nomadScore: 7, nearestAirport: 'HAN', visaEase: 'e-visa' },
    { raceName: 'Dubai Marathon', city: 'Dubai', country: 'UAE', raceType: 'marathon', typicalMonth: 'January', entryFee: 100, fieldSize: 30000, courseType: 'flat', sceneryRating: 8, monthlyRent: 2000, costIndex: 3, nomadScore: 8, nearestAirport: 'DXB', visaEase: 'VOA 30d' },
    { raceName: 'Sevilla Marathon', city: 'Seville', country: 'Spain', raceType: 'marathon', typicalMonth: 'February', entryFee: 55, fieldSize: 12000, courseType: 'flat', sceneryRating: 9, monthlyRent: 800, costIndex: 7, nomadScore: 7, nearestAirport: 'SVQ', visaEase: 'Schengen 90d' },
    { raceName: 'Bogota Half', city: 'Bogota', country: 'Colombia', raceType: 'half', typicalMonth: 'July', entryFee: 30, fieldSize: 45000, courseType: 'flat', sceneryRating: 7, monthlyRent: 600, costIndex: 8, nomadScore: 7, nearestAirport: 'BOG', visaEase: 'visa-free 90d' },
    { raceName: 'Rio Marathon', city: 'Rio de Janeiro', country: 'Brazil', raceType: 'marathon', typicalMonth: 'June', entryFee: 80, fieldSize: 30000, courseType: 'hilly', sceneryRating: 10, monthlyRent: 800, costIndex: 7, nomadScore: 7, nearestAirport: 'GIG', visaEase: 'visa-free 90d' },
    { raceName: 'Las Palmas Marathon', city: 'Las Palmas', country: 'Spain', raceType: 'marathon', typicalMonth: 'January', entryFee: 40, fieldSize: 6000, courseType: 'flat', sceneryRating: 8, monthlyRent: 900, costIndex: 7, nomadScore: 9, nearestAirport: 'LPA', visaEase: 'Schengen 90d' },
    { raceName: 'Istanbul Marathon', city: 'Istanbul', country: 'Turkey', raceType: 'marathon', typicalMonth: 'November', entryFee: 60, fieldSize: 40000, courseType: 'hilly', sceneryRating: 10, monthlyRent: 600, costIndex: 8, nomadScore: 7, nearestAirport: 'IST', visaEase: 'e-visa' },
    { raceName: 'Sofia Marathon', city: 'Sofia', country: 'Bulgaria', raceType: 'marathon', typicalMonth: 'October', entryFee: 35, fieldSize: 4000, courseType: 'flat', sceneryRating: 7, monthlyRent: 550, costIndex: 9, nomadScore: 7, nearestAirport: 'SOF', visaEase: 'Schengen 90d' },
    { raceName: 'Tel Aviv Marathon', city: 'Tel Aviv', country: 'Israel', raceType: 'marathon', typicalMonth: 'February', entryFee: 90, fieldSize: 40000, courseType: 'flat', sceneryRating: 8, monthlyRent: 1800, costIndex: 4, nomadScore: 8, nearestAirport: 'TLV', visaEase: 'visa-free 90d' },
    { raceName: 'Angkor Wat Half', city: 'Siem Reap', country: 'Cambodia', raceType: 'half', typicalMonth: 'December', entryFee: 80, fieldSize: 9000, courseType: 'flat', sceneryRating: 10, monthlyRent: 400, costIndex: 10, nomadScore: 8, nearestAirport: 'REP', visaEase: 'VOA' },
    { raceName: 'Queenstown Marathon', city: 'Queenstown', country: 'New Zealand', raceType: 'marathon', typicalMonth: 'November', entryFee: 120, fieldSize: 10000, courseType: 'hilly', sceneryRating: 10, monthlyRent: 1500, costIndex: 4, nomadScore: 6, nearestAirport: 'ZQN', visaEase: 'visa-free 90d' },
  ];

  for (const race of raceDestinations) {
    await prisma.race_destinations.create({ data: race });
  }
  console.log(`✓ Seeded ${raceDestinations.length} race destinations`);

  // ═══════════════════════════════════════════════════════════════════
  // TRIATHLON DESTINATIONS - 33 Ironman/70.3/Olympic Events
  // ═══════════════════════════════════════════════════════════════════
  const triathlonDestinations = [
    { eventName: 'Ironman 70.3 Vietnam', city: 'Da Nang', country: 'Vietnam', distance: '70.3', typicalMonth: 'May', entryFee: 350, swimVenue: 'ocean', courseRating: 9, monthlyRent: 450, costIndex: 9, nomadScore: 9, nearestAirport: 'DAD', visaEase: 'e-visa' },
    { eventName: 'Ironman 70.3 Thailand', city: 'Phuket', country: 'Thailand', distance: '70.3', typicalMonth: 'November', entryFee: 400, swimVenue: 'ocean', courseRating: 9, monthlyRent: 700, costIndex: 8, nomadScore: 8, nearestAirport: 'HKT', visaEase: 'visa-free 60d' },
    { eventName: 'Ironman Cozumel', city: 'Cozumel', country: 'Mexico', distance: '140.6', typicalMonth: 'November', entryFee: 850, swimVenue: 'ocean', courseRating: 9, monthlyRent: 800, costIndex: 7, nomadScore: 7, nearestAirport: 'CZM', visaEase: 'visa-free 180d' },
    { eventName: 'Ironman 70.3 Portugal', city: 'Cascais', country: 'Portugal', distance: '70.3', typicalMonth: 'September', entryFee: 400, swimVenue: 'ocean', courseRating: 9, monthlyRent: 1200, costIndex: 6, nomadScore: 9, nearestAirport: 'LIS', visaEase: 'Schengen 90d' },
    { eventName: 'Ironman South Africa', city: 'Port Elizabeth', country: 'South Africa', distance: '140.6', typicalMonth: 'April', entryFee: 650, swimVenue: 'ocean', courseRating: 8, monthlyRent: 500, costIndex: 8, nomadScore: 6, nearestAirport: 'PLZ', visaEase: 'visa-free 90d' },
    { eventName: 'Challenge Roth', city: 'Roth', country: 'Germany', distance: '140.6', typicalMonth: 'July', entryFee: 500, swimVenue: 'lake', courseRating: 10, monthlyRent: 900, costIndex: 6, nomadScore: 6, nearestAirport: 'NUE', visaEase: 'Schengen 90d' },
    { eventName: 'Ironman 70.3 Barcelona', city: 'Barcelona', country: 'Spain', distance: '70.3', typicalMonth: 'May', entryFee: 450, swimVenue: 'ocean', courseRating: 9, monthlyRent: 1400, costIndex: 5, nomadScore: 9, nearestAirport: 'BCN', visaEase: 'Schengen 90d' },
    { eventName: 'Ironman 70.3 Colombiana', city: 'Cartagena', country: 'Colombia', distance: '70.3', typicalMonth: 'March', entryFee: 380, swimVenue: 'ocean', courseRating: 8, monthlyRent: 700, costIndex: 8, nomadScore: 7, nearestAirport: 'CTG', visaEase: 'visa-free 90d' },
    { eventName: 'Ironman Malaysia', city: 'Langkawi', country: 'Malaysia', distance: '140.6', typicalMonth: 'November', entryFee: 700, swimVenue: 'ocean', courseRating: 8, monthlyRent: 500, costIndex: 9, nomadScore: 7, nearestAirport: 'LGK', visaEase: 'visa-free 90d' },
    { eventName: 'Ironman 70.3 Taiwan', city: 'Taitung', country: 'Taiwan', distance: '70.3', typicalMonth: 'April', entryFee: 350, swimVenue: 'ocean', courseRating: 8, monthlyRent: 600, costIndex: 8, nomadScore: 7, nearestAirport: 'TTT', visaEase: 'visa-free 90d' },
    { eventName: 'Ironman 70.3 Buenos Aires', city: 'Buenos Aires', country: 'Argentina', distance: '70.3', typicalMonth: 'December', entryFee: 350, swimVenue: 'river', courseRating: 7, monthlyRent: 600, costIndex: 8, nomadScore: 8, nearestAirport: 'EZE', visaEase: 'visa-free 90d' },
    { eventName: 'Challenge Gran Canaria', city: 'Las Palmas', country: 'Spain', distance: '140.6', typicalMonth: 'April', entryFee: 500, swimVenue: 'ocean', courseRating: 9, monthlyRent: 900, costIndex: 7, nomadScore: 9, nearestAirport: 'LPA', visaEase: 'Schengen 90d' },
    { eventName: 'Ironman 70.3 Dubai', city: 'Dubai', country: 'UAE', distance: '70.3', typicalMonth: 'February', entryFee: 450, swimVenue: 'ocean', courseRating: 8, monthlyRent: 2000, costIndex: 3, nomadScore: 8, nearestAirport: 'DXB', visaEase: 'VOA 30d' },
    { eventName: 'Olympic Tri Bali', city: 'Sanur', country: 'Indonesia', distance: 'olympic', typicalMonth: 'September', entryFee: 150, swimVenue: 'ocean', courseRating: 8, monthlyRent: 600, costIndex: 9, nomadScore: 10, nearestAirport: 'DPS', visaEase: 'VOA 30d' },
    { eventName: 'Ironman 70.3 Cebu', city: 'Cebu', country: 'Philippines', distance: '70.3', typicalMonth: 'August', entryFee: 350, swimVenue: 'ocean', courseRating: 8, monthlyRent: 450, costIndex: 9, nomadScore: 7, nearestAirport: 'CEB', visaEase: 'visa-free 30d' },
    { eventName: 'Olympic Tri Chiang Mai', city: 'Chiang Mai', country: 'Thailand', distance: 'olympic', typicalMonth: 'January', entryFee: 80, swimVenue: 'lake', courseRating: 8, monthlyRent: 450, costIndex: 10, nomadScore: 10, nearestAirport: 'CNX', visaEase: 'visa-free 60d' },
    { eventName: 'Ironman 70.3 Marbella', city: 'Marbella', country: 'Spain', distance: '70.3', typicalMonth: 'April', entryFee: 420, swimVenue: 'ocean', courseRating: 9, monthlyRent: 1100, costIndex: 6, nomadScore: 7, nearestAirport: 'AGP', visaEase: 'Schengen 90d' },
    { eventName: 'Ironman Brazil', city: 'Florianopolis', country: 'Brazil', distance: '140.6', typicalMonth: 'May', entryFee: 700, swimVenue: 'ocean', courseRating: 9, monthlyRent: 700, costIndex: 7, nomadScore: 7, nearestAirport: 'FLN', visaEase: 'visa-free 90d' },
    { eventName: 'Olympic Tri Singapore', city: 'Singapore', country: 'Singapore', distance: 'olympic', typicalMonth: 'March', entryFee: 180, swimVenue: 'ocean', courseRating: 8, monthlyRent: 2500, costIndex: 2, nomadScore: 8, nearestAirport: 'SIN', visaEase: 'visa-free 90d' },
    { eventName: 'Ironman 70.3 Turkey', city: 'Antalya', country: 'Turkey', distance: '70.3', typicalMonth: 'October', entryFee: 380, swimVenue: 'ocean', courseRating: 8, monthlyRent: 500, costIndex: 9, nomadScore: 7, nearestAirport: 'AYT', visaEase: 'e-visa' },
    { eventName: 'Challenge Cancun', city: 'Cancun', country: 'Mexico', distance: '70.3', typicalMonth: 'November', entryFee: 400, swimVenue: 'ocean', courseRating: 9, monthlyRent: 1000, costIndex: 7, nomadScore: 7, nearestAirport: 'CUN', visaEase: 'visa-free 180d' },
    { eventName: 'Ironman 70.3 Gdynia', city: 'Gdansk', country: 'Poland', distance: '70.3', typicalMonth: 'August', entryFee: 350, swimVenue: 'ocean', courseRating: 8, monthlyRent: 700, costIndex: 8, nomadScore: 7, nearestAirport: 'GDN', visaEase: 'Schengen 90d' },
    { eventName: 'Ironman 70.3 Taupo', city: 'Taupo', country: 'New Zealand', distance: '70.3', typicalMonth: 'December', entryFee: 400, swimVenue: 'lake', courseRating: 10, monthlyRent: 1200, costIndex: 5, nomadScore: 6, nearestAirport: 'AKL', visaEase: 'visa-free 90d' },
    { eventName: 'Ironman Israel', city: 'Tiberias', country: 'Israel', distance: '140.6', typicalMonth: 'November', entryFee: 750, swimVenue: 'lake', courseRating: 8, monthlyRent: 1500, costIndex: 4, nomadScore: 7, nearestAirport: 'TLV', visaEase: 'visa-free 90d' },
    { eventName: 'Olympic Tri Cape Town', city: 'Cape Town', country: 'South Africa', distance: 'olympic', typicalMonth: 'January', entryFee: 100, swimVenue: 'ocean', courseRating: 9, monthlyRent: 800, costIndex: 7, nomadScore: 8, nearestAirport: 'CPT', visaEase: 'visa-free 90d' },
    { eventName: 'Ironman 70.3 Sunshine Coast', city: 'Mooloolaba', country: 'Australia', distance: '70.3', typicalMonth: 'September', entryFee: 500, swimVenue: 'ocean', courseRating: 9, monthlyRent: 1400, costIndex: 4, nomadScore: 7, nearestAirport: 'MCY', visaEase: 'e-visa' },
    { eventName: 'Challenge Almere', city: 'Almere', country: 'Netherlands', distance: '140.6', typicalMonth: 'September', entryFee: 550, swimVenue: 'lake', courseRating: 8, monthlyRent: 1300, costIndex: 5, nomadScore: 7, nearestAirport: 'AMS', visaEase: 'Schengen 90d' },
    { eventName: 'Ironman 70.3 Puerto Rico', city: 'San Juan', country: 'Puerto Rico', distance: '70.3', typicalMonth: 'March', entryFee: 400, swimVenue: 'ocean', courseRating: 8, monthlyRent: 1300, costIndex: 5, nomadScore: 7, nearestAirport: 'SJU', visaEase: 'US territory' },
    { eventName: 'Olympic Tri Lisbon', city: 'Lisbon', country: 'Portugal', distance: 'olympic', typicalMonth: 'June', entryFee: 90, swimVenue: 'river', courseRating: 8, monthlyRent: 1200, costIndex: 6, nomadScore: 10, nearestAirport: 'LIS', visaEase: 'Schengen 90d' },
    { eventName: 'Ironman 70.3 Sri Lanka', city: 'Colombo', country: 'Sri Lanka', distance: '70.3', typicalMonth: 'February', entryFee: 350, swimVenue: 'ocean', courseRating: 8, monthlyRent: 500, costIndex: 9, nomadScore: 8, nearestAirport: 'CMB', visaEase: 'e-visa' },
    { eventName: 'Challenge Samarkand', city: 'Samarkand', country: 'Uzbekistan', distance: '70.3', typicalMonth: 'September', entryFee: 300, swimVenue: 'lake', courseRating: 8, monthlyRent: 400, costIndex: 10, nomadScore: 6, nearestAirport: 'SKD', visaEase: 'e-visa' },
    { eventName: 'Ironman 70.3 Koper', city: 'Koper', country: 'Slovenia', distance: '70.3', typicalMonth: 'June', entryFee: 380, swimVenue: 'ocean', courseRating: 8, monthlyRent: 800, costIndex: 7, nomadScore: 7, nearestAirport: 'LJU', visaEase: 'Schengen 90d' },
    { eventName: 'Olympic Tri Oaxaca', city: 'Oaxaca', country: 'Mexico', distance: 'olympic', typicalMonth: 'October', entryFee: 60, swimVenue: 'lake', courseRating: 7, monthlyRent: 600, costIndex: 8, nomadScore: 8, nearestAirport: 'OAX', visaEase: 'visa-free 180d' },
  ];

  for (const tri of triathlonDestinations) {
    await prisma.triathlon_destinations.create({ data: tri });
  }
  console.log(`✓ Seeded ${triathlonDestinations.length} triathlon destinations`);

  console.log('\n✅ Part 2 seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

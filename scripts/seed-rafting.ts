import { prisma } from '../src/lib/prisma';

const RAFTING_DESTINATIONS = [
  // USA
  { name: 'Grand Canyon', river: 'Colorado River', country: 'USA', region: 'Arizona', classRating: 'III-V', seasonMonths: 'Apr-Oct', tripLength: 'multi-day', nomadScore: 5, monthlyRent: 1500, lat: 36.0544, lng: -112.1401 },
  { name: 'New River Gorge', river: 'New River', country: 'USA', region: 'West Virginia', classRating: 'III-V', seasonMonths: 'Mar-Nov', tripLength: 'full-day', nomadScore: 6, monthlyRent: 800, lat: 38.0659, lng: -81.0848 },
  { name: 'Gauley River', river: 'Gauley River', country: 'USA', region: 'West Virginia', classRating: 'IV-V', seasonMonths: 'Sep-Oct', tripLength: 'full-day', nomadScore: 6, monthlyRent: 800, lat: 38.2292, lng: -80.8639 },
  { name: 'Salmon River', river: 'Salmon River', country: 'USA', region: 'Idaho', classRating: 'III-IV', seasonMonths: 'Jun-Sep', tripLength: 'multi-day', nomadScore: 5, monthlyRent: 1000, lat: 45.1783, lng: -114.0433 },
  { name: 'Arkansas River', river: 'Arkansas River', country: 'USA', region: 'Colorado', classRating: 'II-V', seasonMonths: 'May-Sep', tripLength: 'half-day', nomadScore: 7, monthlyRent: 1400, lat: 38.8339, lng: -105.7636 },
  { name: 'Ocoee River', river: 'Ocoee River', country: 'USA', region: 'Tennessee', classRating: 'III-IV', seasonMonths: 'Mar-Nov', tripLength: 'half-day', nomadScore: 6, monthlyRent: 900, lat: 35.0956, lng: -84.5106 },
  // Central/South America
  { name: 'Pacuare River', river: 'Pacuare River', country: 'Costa Rica', region: 'Limon', classRating: 'III-IV', seasonMonths: 'Year-round', tripLength: 'multi-day', nomadScore: 9, monthlyRent: 800, lat: 9.8167, lng: -83.5333 },
  { name: 'Futaleufú', river: 'Futaleufú River', country: 'Chile', region: 'Los Lagos', classRating: 'IV-V', seasonMonths: 'Dec-Mar', tripLength: 'multi-day', nomadScore: 6, monthlyRent: 600, lat: -43.1833, lng: -72.4000 },
  { name: 'Urubamba River', river: 'Urubamba River', country: 'Peru', region: 'Cusco', classRating: 'II-IV', seasonMonths: 'May-Nov', tripLength: 'full-day', nomadScore: 8, monthlyRent: 500, lat: -13.3067, lng: -72.1292 },
  { name: 'Bio Bio River', river: 'Bio Bio River', country: 'Chile', region: 'Bio Bio', classRating: 'IV-V', seasonMonths: 'Nov-Mar', tripLength: 'multi-day', nomadScore: 6, monthlyRent: 500, lat: -38.0000, lng: -71.5000 },
  // Europe
  { name: 'Soča Valley', river: 'Soča River', country: 'Slovenia', region: 'Primorska', classRating: 'II-IV', seasonMonths: 'Apr-Oct', tripLength: 'half-day', nomadScore: 9, monthlyRent: 800, lat: 46.2500, lng: 13.5833 },
  { name: 'Verdon Gorge', river: 'Verdon River', country: 'France', region: 'Provence', classRating: 'II-III', seasonMonths: 'Apr-Oct', tripLength: 'half-day', nomadScore: 7, monthlyRent: 1000, lat: 43.7667, lng: 6.3333 },
  { name: 'Tara Canyon', river: 'Tara River', country: 'Montenegro', region: 'Durmitor', classRating: 'III-IV', seasonMonths: 'May-Oct', tripLength: 'full-day', nomadScore: 8, monthlyRent: 500, lat: 43.1500, lng: 19.3167 },
  { name: 'Noce River', river: 'Noce River', country: 'Italy', region: 'Trentino', classRating: 'II-IV', seasonMonths: 'May-Sep', tripLength: 'half-day', nomadScore: 7, monthlyRent: 1100, lat: 46.3500, lng: 10.8667 },
  { name: 'Sjoa River', river: 'Sjoa River', country: 'Norway', region: 'Oppland', classRating: 'III-V', seasonMonths: 'Jun-Aug', tripLength: 'full-day', nomadScore: 6, monthlyRent: 1800, lat: 61.6500, lng: 9.3500 },
  // Asia
  { name: 'Sun Kosi', river: 'Sun Kosi River', country: 'Nepal', region: 'Bagmati', classRating: 'III-V', seasonMonths: 'Oct-Dec', tripLength: 'multi-day', nomadScore: 9, monthlyRent: 400, lat: 27.7000, lng: 85.3167 },
  { name: 'Ganges Rishikesh', river: 'Ganges River', country: 'India', region: 'Uttarakhand', classRating: 'III-IV', seasonMonths: 'Sep-Jun', tripLength: 'half-day', nomadScore: 8, monthlyRent: 300, lat: 30.0869, lng: 78.2676 },
  { name: 'Ayung River', river: 'Ayung River', country: 'Indonesia', region: 'Bali', classRating: 'II-III', seasonMonths: 'Year-round', tripLength: 'half-day', nomadScore: 10, monthlyRent: 600, lat: -8.4150, lng: 115.1892 },
  { name: 'Mae Taeng', river: 'Mae Taeng River', country: 'Thailand', region: 'Chiang Mai', classRating: 'III-IV', seasonMonths: 'Jul-Feb', tripLength: 'half-day', nomadScore: 10, monthlyRent: 400, lat: 19.1167, lng: 98.9333 },
  { name: 'Yoshino River', river: 'Yoshino River', country: 'Japan', region: 'Tokushima', classRating: 'II-IV', seasonMonths: 'Apr-Nov', tripLength: 'half-day', nomadScore: 7, monthlyRent: 1200, lat: 33.8667, lng: 133.7500 },
  // Oceania
  { name: 'Kaituna River', river: 'Kaituna River', country: 'New Zealand', region: 'Bay of Plenty', classRating: 'III-V', seasonMonths: 'Year-round', tripLength: 'half-day', nomadScore: 7, monthlyRent: 1400, lat: -38.0333, lng: 176.3000 },
  { name: 'Shotover River', river: 'Shotover River', country: 'New Zealand', region: 'Otago', classRating: 'III-V', seasonMonths: 'Year-round', tripLength: 'half-day', nomadScore: 7, monthlyRent: 1600, lat: -44.9833, lng: 168.6500 },
  { name: 'Tully River', river: 'Tully River', country: 'Australia', region: 'Queensland', classRating: 'III-IV', seasonMonths: 'Year-round', tripLength: 'full-day', nomadScore: 7, monthlyRent: 1200, lat: -17.9333, lng: 145.9333 },
  { name: 'Nymboida River', river: 'Nymboida River', country: 'Australia', region: 'NSW', classRating: 'III-IV', seasonMonths: 'Year-round', tripLength: 'full-day', nomadScore: 7, monthlyRent: 1100, lat: -30.0167, lng: 152.6833 },
  // Africa
  { name: 'Zambezi Victoria Falls', river: 'Zambezi River', country: 'Zambia', region: 'Livingstone', classRating: 'IV-V', seasonMonths: 'Aug-Dec', tripLength: 'full-day', nomadScore: 7, monthlyRent: 600, lat: -17.9244, lng: 25.8572 },
  { name: 'Nile Jinja', river: 'White Nile', country: 'Uganda', region: 'Jinja', classRating: 'III-V', seasonMonths: 'Year-round', tripLength: 'full-day', nomadScore: 8, monthlyRent: 400, lat: 0.4478, lng: 33.2028 },
  { name: 'Orange River', river: 'Orange River', country: 'South Africa', region: 'Northern Cape', classRating: 'II-III', seasonMonths: 'Year-round', tripLength: 'multi-day', nomadScore: 7, monthlyRent: 600, lat: -28.7500, lng: 17.6333 },
  // Canada
  { name: 'Ottawa River', river: 'Ottawa River', country: 'Canada', region: 'Ontario', classRating: 'III-V', seasonMonths: 'May-Sep', tripLength: 'full-day', nomadScore: 7, monthlyRent: 1500, lat: 45.6333, lng: -77.1000 },
  { name: 'Kicking Horse', river: 'Kicking Horse River', country: 'Canada', region: 'BC', classRating: 'III-IV', seasonMonths: 'Jun-Sep', tripLength: 'half-day', nomadScore: 6, monthlyRent: 1400, lat: 51.2978, lng: -116.9708 },
  { name: 'Nahanni River', river: 'South Nahanni', country: 'Canada', region: 'NWT', classRating: 'III-IV', seasonMonths: 'Jun-Aug', tripLength: 'multi-day', nomadScore: 4, monthlyRent: 1800, lat: 61.0500, lng: -124.1000 },
  // Additional
  { name: 'Cetina River', river: 'Cetina River', country: 'Croatia', region: 'Dalmatia', classRating: 'II-III', seasonMonths: 'Apr-Oct', tripLength: 'half-day', nomadScore: 8, monthlyRent: 900, lat: 43.4333, lng: 16.7500 },
  { name: 'Neretva River', river: 'Neretva River', country: 'Bosnia', region: 'Herzegovina', classRating: 'III-IV', seasonMonths: 'Apr-Oct', tripLength: 'half-day', nomadScore: 8, monthlyRent: 500, lat: 43.3333, lng: 17.8000 },
  { name: 'Mekong River', river: 'Mekong River', country: 'Laos', region: 'Luang Prabang', classRating: 'II-III', seasonMonths: 'Nov-Apr', tripLength: 'multi-day', nomadScore: 9, monthlyRent: 400, lat: 19.8833, lng: 102.1333 },
];

async function main() {
  console.log('Seeding rafting destinations...');
  
  for (const dest of RAFTING_DESTINATIONS) {
    await prisma.rafting_destinations.create({
      data: {
        name: dest.name,
        river: dest.river,
        country: dest.country,
        region: dest.region,
        classRating: dest.classRating,
        seasonMonths: dest.seasonMonths,
        tripLength: dest.tripLength,
        nomadScore: dest.nomadScore,
        monthlyRent: dest.monthlyRent,
        latitude: dest.lat,
        longitude: dest.lng,
      }
    });
    console.log(`✓ ${dest.name}`);
  }
  
  console.log(`\nSeeded ${RAFTING_DESTINATIONS.length} rafting destinations`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

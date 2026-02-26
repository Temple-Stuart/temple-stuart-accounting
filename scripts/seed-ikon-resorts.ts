import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ikonResorts = [
  // USA - West
  { name: 'Palisades Tahoe', region: 'West', country: 'USA', state: 'CA', nearestAirport: 'RNO', verticalDrop: 2840, avgSnowfall: 400 },
  { name: 'Sierra-at-Tahoe', region: 'West', country: 'USA', state: 'CA', nearestAirport: 'RNO', verticalDrop: 2212, avgSnowfall: 480 },
  { name: 'Mammoth Mountain', region: 'West', country: 'USA', state: 'CA', nearestAirport: 'MMH', verticalDrop: 3100, avgSnowfall: 400 },
  { name: 'June Mountain', region: 'West', country: 'USA', state: 'CA', nearestAirport: 'MMH', verticalDrop: 2590, avgSnowfall: 250 },
  { name: 'Big Bear Mountain Resort', region: 'West', country: 'USA', state: 'CA', nearestAirport: 'ONT', verticalDrop: 1665, avgSnowfall: 100 },
  { name: 'Snow Valley', region: 'West', country: 'USA', state: 'CA', nearestAirport: 'ONT', verticalDrop: 1141, avgSnowfall: 80 },
  
  // USA - Pacific NW
  { name: 'Sun Valley', region: 'Pacific NW', country: 'USA', state: 'ID', nearestAirport: 'SUN', verticalDrop: 3400, avgSnowfall: 220 },
  { name: 'Alyeska Resort', region: 'Pacific NW', country: 'USA', state: 'AK', nearestAirport: 'ANC', verticalDrop: 2500, avgSnowfall: 669 },
  { name: 'Crystal Mountain Resort', region: 'Pacific NW', country: 'USA', state: 'WA', nearestAirport: 'SEA', verticalDrop: 3100, avgSnowfall: 486 },
  { name: 'The Summit at Snoqualmie', region: 'Pacific NW', country: 'USA', state: 'WA', nearestAirport: 'SEA', verticalDrop: 2280, avgSnowfall: 432 },
  { name: 'Mt. Bachelor', region: 'Pacific NW', country: 'USA', state: 'OR', nearestAirport: 'RDM', verticalDrop: 3365, avgSnowfall: 462 },
  { name: 'Schweitzer', region: 'Pacific NW', country: 'USA', state: 'ID', nearestAirport: 'SFF', verticalDrop: 2900, avgSnowfall: 300 },
  
  // USA - Rockies
  { name: 'Aspen Snowmass', region: 'Rockies', country: 'USA', state: 'CO', nearestAirport: 'ASE', verticalDrop: 4406, avgSnowfall: 300 },
  { name: 'Steamboat', region: 'Rockies', country: 'USA', state: 'CO', nearestAirport: 'HDN', verticalDrop: 3668, avgSnowfall: 349 },
  { name: 'Winter Park Resort', region: 'Rockies', country: 'USA', state: 'CO', nearestAirport: 'DEN', verticalDrop: 3060, avgSnowfall: 326 },
  { name: 'Copper Mountain', region: 'Rockies', country: 'USA', state: 'CO', nearestAirport: 'DEN', verticalDrop: 2738, avgSnowfall: 305 },
  { name: 'Arapahoe Basin', region: 'Rockies', country: 'USA', state: 'CO', nearestAirport: 'DEN', verticalDrop: 2530, avgSnowfall: 350 },
  { name: 'Eldora Mountain Resort', region: 'Rockies', country: 'USA', state: 'CO', nearestAirport: 'DEN', verticalDrop: 1600, avgSnowfall: 300 },
  { name: 'Jackson Hole Mountain Resort', region: 'Rockies', country: 'USA', state: 'WY', nearestAirport: 'JAC', verticalDrop: 4139, avgSnowfall: 459 },
  { name: 'Big Sky Resort', region: 'Rockies', country: 'USA', state: 'MT', nearestAirport: 'BZN', verticalDrop: 4350, avgSnowfall: 400 },
  { name: 'Taos Ski Valley', region: 'Rockies', country: 'USA', state: 'NM', nearestAirport: 'ABQ', verticalDrop: 3281, avgSnowfall: 305 },
  { name: 'Deer Valley Resort', region: 'Rockies', country: 'USA', state: 'UT', nearestAirport: 'SLC', verticalDrop: 3000, avgSnowfall: 300 },
  { name: 'Solitude Mountain Resort', region: 'Rockies', country: 'USA', state: 'UT', nearestAirport: 'SLC', verticalDrop: 2494, avgSnowfall: 500 },
  { name: 'Brighton', region: 'Rockies', country: 'USA', state: 'UT', nearestAirport: 'SLC', verticalDrop: 1875, avgSnowfall: 500 },
  { name: 'Alta Ski Area', region: 'Rockies', country: 'USA', state: 'UT', nearestAirport: 'SLC', verticalDrop: 2538, avgSnowfall: 547 },
  { name: 'Snowbird', region: 'Rockies', country: 'USA', state: 'UT', nearestAirport: 'SLC', verticalDrop: 3240, avgSnowfall: 500 },
  { name: 'Snowbasin', region: 'Rockies', country: 'USA', state: 'UT', nearestAirport: 'SLC', verticalDrop: 2959, avgSnowfall: 300 },
  
  // USA - Midwest
  { name: 'The Highlands', region: 'Midwest', country: 'USA', state: 'MI', nearestAirport: 'TVC', verticalDrop: 500, avgSnowfall: 180 },
  { name: 'Boyne Mountain', region: 'Midwest', country: 'USA', state: 'MI', nearestAirport: 'TVC', verticalDrop: 500, avgSnowfall: 180 },
  
  // USA - East
  { name: 'Stratton', region: 'East', country: 'USA', state: 'VT', nearestAirport: 'ALB', verticalDrop: 2003, avgSnowfall: 180 },
  { name: 'Sugarbush Resort', region: 'East', country: 'USA', state: 'VT', nearestAirport: 'BTV', verticalDrop: 2600, avgSnowfall: 250 },
  { name: 'Killington - Pico', region: 'East', country: 'USA', state: 'VT', nearestAirport: 'BTV', verticalDrop: 3050, avgSnowfall: 250 },
  { name: 'Snowshoe Mountain', region: 'East', country: 'USA', state: 'WV', nearestAirport: 'CKB', verticalDrop: 1500, avgSnowfall: 180 },
  { name: 'Sunday River', region: 'East', country: 'USA', state: 'ME', nearestAirport: 'PWM', verticalDrop: 2340, avgSnowfall: 167 },
  { name: 'Sugarloaf', region: 'East', country: 'USA', state: 'ME', nearestAirport: 'PWM', verticalDrop: 2820, avgSnowfall: 200 },
  { name: 'Loon Mountain', region: 'East', country: 'USA', state: 'NH', nearestAirport: 'MHT', verticalDrop: 2100, avgSnowfall: 130 },
  { name: 'Camelback Resort', region: 'East', country: 'USA', state: 'PA', nearestAirport: 'ABE', verticalDrop: 800, avgSnowfall: 50 },
  { name: 'Blue Mountain Resort', region: 'East', country: 'USA', state: 'PA', nearestAirport: 'ABE', verticalDrop: 1082, avgSnowfall: 50 },
  
  // Canada - West
  { name: 'SkiBig3', region: 'West', country: 'Canada', state: 'AB', nearestAirport: 'YYC', verticalDrop: 4133, avgSnowfall: 360 },
  { name: 'Revelstoke Mountain Resort', region: 'West', country: 'Canada', state: 'BC', nearestAirport: 'YLW', verticalDrop: 5620, avgSnowfall: 472 },
  { name: 'Cypress Mountain', region: 'West', country: 'Canada', state: 'BC', nearestAirport: 'YVR', verticalDrop: 1750, avgSnowfall: 400 },
  { name: 'RED Mountain', region: 'West', country: 'Canada', state: 'BC', nearestAirport: 'YXS', verticalDrop: 2919, avgSnowfall: 300 },
  { name: 'Panorama', region: 'West', country: 'Canada', state: 'BC', nearestAirport: 'YXC', verticalDrop: 4265, avgSnowfall: 200 },
  { name: 'Sun Peaks Resort', region: 'West', country: 'Canada', state: 'BC', nearestAirport: 'YKA', verticalDrop: 2894, avgSnowfall: 236 },
  
  // Canada - East
  { name: 'Tremblant', region: 'East', country: 'Canada', state: 'QC', nearestAirport: 'YUL', verticalDrop: 2116, avgSnowfall: 160 },
  { name: 'Le Massif de Charlevoix', region: 'East', country: 'Canada', state: 'QC', nearestAirport: 'YQB', verticalDrop: 2526, avgSnowfall: 275 },
  { name: 'Blue Mountain', region: 'East', country: 'Canada', state: 'ON', nearestAirport: 'YYZ', verticalDrop: 720, avgSnowfall: 140 },
  
  // South America
  { name: 'Valle Nevado', region: 'South America', country: 'Chile', state: null, nearestAirport: 'SCL', verticalDrop: 2700, avgSnowfall: 280 },
  
  // Europe
  { name: 'Grandvalira Resorts Andorra', region: 'Europe', country: 'Andorra', state: null, nearestAirport: 'BCN', verticalDrop: 3012, avgSnowfall: 200 },
  { name: 'Kitzbühel', region: 'Europe', country: 'Austria', state: null, nearestAirport: 'SZG', verticalDrop: 4495, avgSnowfall: 170 },
  { name: 'Ischgl', region: 'Europe', country: 'Austria', state: null, nearestAirport: 'INN', verticalDrop: 4265, avgSnowfall: 150 },
  { name: 'Chamonix Mont-Blanc Valley', region: 'Europe', country: 'France', state: null, nearestAirport: 'GVA', verticalDrop: 9209, avgSnowfall: 320 },
  { name: 'Megève Ski Area', region: 'Europe', country: 'France', state: null, nearestAirport: 'GVA', verticalDrop: 3307, avgSnowfall: 200 },
  { name: 'Dolomiti Superski', region: 'Europe', country: 'Italy', state: null, nearestAirport: 'VCE', verticalDrop: 4757, avgSnowfall: 150 },
  { name: "Valle d'Aosta", region: 'Europe', country: 'Italy', state: null, nearestAirport: 'TRN', verticalDrop: 4200, avgSnowfall: 200 },
  { name: 'Zermatt Matterhorn', region: 'Europe', country: 'Switzerland', state: null, nearestAirport: 'GVA', verticalDrop: 7217, avgSnowfall: 250 },
  { name: 'St. Moritz', region: 'Europe', country: 'Switzerland', state: null, nearestAirport: 'ZRH', verticalDrop: 4393, avgSnowfall: 170 },
  
  // Oceania
  { name: 'Thredbo', region: 'Oceania', country: 'Australia', state: 'NSW', nearestAirport: 'SYD', verticalDrop: 2037, avgSnowfall: 79 },
  { name: 'Mt Buller', region: 'Oceania', country: 'Australia', state: 'VIC', nearestAirport: 'MEL', verticalDrop: 1300, avgSnowfall: 79 },
  { name: 'Coronet Peak, The Remarkables, Mt Hutt', region: 'Oceania', country: 'New Zealand', state: null, nearestAirport: 'ZQN', verticalDrop: 2300, avgSnowfall: 150 },
  
  // Asia - Japan
  { name: 'Niseko United', region: 'Asia', country: 'Japan', state: null, nearestAirport: 'CTS', verticalDrop: 3438, avgSnowfall: 590 },
  { name: 'Arai Mountain Resort', region: 'Asia', country: 'Japan', state: null, nearestAirport: 'KIJ', verticalDrop: 3117, avgSnowfall: 450 },
  { name: 'Shiga Kogen Mountain Resort', region: 'Asia', country: 'Japan', state: null, nearestAirport: 'NRT', verticalDrop: 2976, avgSnowfall: 400 },
  { name: 'Mt.T', region: 'Asia', country: 'Japan', state: null, nearestAirport: 'CTS', verticalDrop: 1200, avgSnowfall: 350 },
  { name: 'Myoko Suginohara Ski Resort', region: 'Asia', country: 'Japan', state: null, nearestAirport: 'KIJ', verticalDrop: 4232, avgSnowfall: 500 },
  { name: 'APPI Resort', region: 'Asia', country: 'Japan', state: null, nearestAirport: 'HNA', verticalDrop: 2756, avgSnowfall: 300 },
  { name: 'Furano Ski Resort', region: 'Asia', country: 'Japan', state: null, nearestAirport: 'CTS', verticalDrop: 3117, avgSnowfall: 400 },
  { name: 'Nekoma Mountain', region: 'Asia', country: 'Japan', state: null, nearestAirport: 'FKS', verticalDrop: 2625, avgSnowfall: 350 },
  { name: 'Zao Onsen Ski Resort', region: 'Asia', country: 'Japan', state: null, nearestAirport: 'GAJ', verticalDrop: 2854, avgSnowfall: 450 },
  
  // Asia - Other
  { name: 'Yunding Snow Park', region: 'Asia', country: 'China', state: null, nearestAirport: 'PEK', verticalDrop: 1640, avgSnowfall: 100 },
  { name: 'Mona Yongpyong', region: 'Asia', country: 'South Korea', state: null, nearestAirport: 'YNY', verticalDrop: 2477, avgSnowfall: 250 },
];

async function main() {
  console.log('Seeding Ikon resorts...');
  
  for (const resort of ikonResorts) {
    await prisma.ikon_resorts.upsert({
      where: { name: resort.name },
      update: resort,
      create: resort,
    });
    console.log(`  ✓ ${resort.name}`);
  }
  
  console.log(`\nSeeded ${ikonResorts.length} resorts.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

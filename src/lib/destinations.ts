export type DestinationType = 'city' | 'ski' | 'festival' | 'conference' | 'event' | 'experience';
export type FestivalCategory = 'music' | 'art' | 'fintech' | 'tech' | 'film' | 'food' | 'cultural';

export interface Destination {
  name: string;
  type: DestinationType;
  country: string;
  region: string;
  nearestCity?: string;
  when?: string;
  season?: string;
  category?: FestivalCategory;
  description?: string;
  lat?: number;
  lng?: number;
}

const southeastAsia: Destination[] = [
  { name: 'Bangkok', type: 'city', country: 'Thailand', region: 'Southeast Asia', lat: 13.7563, lng: 100.5018 },
  { name: 'Chiang Mai', type: 'city', country: 'Thailand', region: 'Southeast Asia', lat: 18.7883, lng: 98.9853 },
  { name: 'Phuket', type: 'city', country: 'Thailand', region: 'Southeast Asia', lat: 7.8804, lng: 98.3923 },
  { name: 'Songkran Festival', type: 'festival', country: 'Thailand', region: 'Southeast Asia', category: 'cultural', when: 'April', nearestCity: 'Bangkok', description: "Thai New Year water festival — the world's biggest water fight" },
  { name: 'Full Moon Party', type: 'event', country: 'Thailand', region: 'Southeast Asia', category: 'music', when: 'Monthly', nearestCity: 'Koh Phangan', description: 'Legendary monthly beach rave on Haad Rin beach' },
  { name: 'Loi Krathong', type: 'festival', country: 'Thailand', region: 'Southeast Asia', category: 'cultural', when: 'November', nearestCity: 'Chiang Mai', description: 'Festival of lights — thousands of floating lanterns released into the sky' },
  { name: 'Tomorrowland Thailand', type: 'festival', country: 'Thailand', region: 'Southeast Asia', category: 'music', when: 'December', nearestCity: 'Pattaya', description: 'First-ever Tomorrowland in Asia — massive EDM festival debut' },
  { name: 'Wonderfruit', type: 'festival', country: 'Thailand', region: 'Southeast Asia', category: 'music', when: 'December', nearestCity: 'Pattaya', description: 'Art, music, and sustainability festival in The Fields at Siam Country Club' },
  { name: 'Bali (Canggu)', type: 'city', country: 'Indonesia', region: 'Southeast Asia', lat: -8.6478, lng: 115.1385 },
  { name: 'Jakarta', type: 'city', country: 'Indonesia', region: 'Southeast Asia', lat: -6.2088, lng: 106.8456 },
  { name: 'Yogyakarta', type: 'city', country: 'Indonesia', region: 'Southeast Asia', lat: -7.7956, lng: 110.3695 },
  { name: 'Nyepi (Day of Silence)', type: 'festival', country: 'Indonesia', region: 'Southeast Asia', category: 'cultural', when: 'March', nearestCity: 'Bali (Canggu)', description: 'Balinese New Year — entire island shuts down, no lights, no travel' },
  { name: 'Borobudur Temple', type: 'experience', country: 'Indonesia', region: 'Southeast Asia', nearestCity: 'Yogyakarta', description: "World's largest Buddhist temple — sunrise over volcanic landscape" },
  { name: 'Komodo National Park', type: 'experience', country: 'Indonesia', region: 'Southeast Asia', description: 'See Komodo dragons in the wild, world-class diving at Pink Beach' },
  { name: 'Ho Chi Minh City', type: 'city', country: 'Vietnam', region: 'Southeast Asia', lat: 10.8231, lng: 106.6297 },
  { name: 'Da Nang', type: 'city', country: 'Vietnam', region: 'Southeast Asia', lat: 16.0544, lng: 108.2022 },
  { name: 'Hanoi', type: 'city', country: 'Vietnam', region: 'Southeast Asia', lat: 21.0285, lng: 105.8542 },
  { name: 'Ha Long Bay', type: 'experience', country: 'Vietnam', region: 'Southeast Asia', nearestCity: 'Hanoi', description: 'UNESCO World Heritage — 1,600+ limestone islands and caves by boat' },
  { name: 'Manila', type: 'city', country: 'Philippines', region: 'Southeast Asia', lat: 14.5995, lng: 120.9842 },
  { name: 'Cebu', type: 'city', country: 'Philippines', region: 'Southeast Asia', lat: 10.3157, lng: 123.8854 },
  { name: 'Siargao', type: 'city', country: 'Philippines', region: 'Southeast Asia', lat: 9.8482, lng: 126.0458 },
  { name: 'Sinulog Festival', type: 'festival', country: 'Philippines', region: 'Southeast Asia', category: 'cultural', when: 'January', nearestCity: 'Cebu', description: 'Massive street dance festival honoring the Santo Nino — 2M+ attendees' },
  { name: 'Kuala Lumpur', type: 'city', country: 'Malaysia', region: 'Southeast Asia', lat: 3.1390, lng: 101.6869 },
  { name: 'Penang', type: 'city', country: 'Malaysia', region: 'Southeast Asia', lat: 5.4141, lng: 100.3288 },
  { name: 'Phnom Penh', type: 'city', country: 'Cambodia', region: 'Southeast Asia', lat: 11.5564, lng: 104.9282 },
  { name: 'Siem Reap', type: 'city', country: 'Cambodia', region: 'Southeast Asia', lat: 13.3671, lng: 103.8448 },
  { name: 'Angkor Wat', type: 'experience', country: 'Cambodia', region: 'Southeast Asia', nearestCity: 'Siem Reap', description: "World's largest religious monument — sunrise over ancient temple complex" },
  { name: 'Singapore', type: 'city', country: 'Singapore', region: 'Southeast Asia', lat: 1.3521, lng: 103.8198 },
  { name: 'Singapore FinTech Festival', type: 'conference', country: 'Singapore', region: 'Southeast Asia', category: 'fintech', when: 'November', nearestCity: 'Singapore', description: "World's largest fintech event — 60,000+ attendees from 130+ countries" },
  { name: 'Gardens by the Bay', type: 'experience', country: 'Singapore', region: 'Southeast Asia', nearestCity: 'Singapore', description: 'Futuristic Supertree Grove light show — iconic Singapore landmark' },
];

const latinAmerica: Destination[] = [
  { name: 'Mexico City', type: 'city', country: 'Mexico', region: 'Latin America', lat: 19.4326, lng: -99.1332 },
  { name: 'Oaxaca', type: 'city', country: 'Mexico', region: 'Latin America', lat: 17.0732, lng: -96.7266 },
  { name: 'Playa del Carmen', type: 'city', country: 'Mexico', region: 'Latin America', lat: 20.6296, lng: -87.0739 },
  { name: 'Day of the Dead', type: 'festival', country: 'Mexico', region: 'Latin America', category: 'cultural', when: 'October 31 - November 2', nearestCity: 'Oaxaca', description: 'UNESCO Intangible Heritage — celebrate the dead with altars, parades, marigolds' },
  { name: 'Chichen Itza', type: 'experience', country: 'Mexico', region: 'Latin America', nearestCity: 'Playa del Carmen', description: 'New Seven Wonders of the World — Mayan pyramid with equinox light show' },
  { name: 'Medellin', type: 'city', country: 'Colombia', region: 'Latin America', lat: 6.2476, lng: -75.5658 },
  { name: 'Bogota', type: 'city', country: 'Colombia', region: 'Latin America', lat: 4.7110, lng: -74.0721 },
  { name: 'Cartagena', type: 'city', country: 'Colombia', region: 'Latin America', lat: 10.3910, lng: -75.5364 },
  { name: 'Feria de las Flores', type: 'festival', country: 'Colombia', region: 'Latin America', category: 'cultural', when: 'August', nearestCity: 'Medellin', description: 'Festival of Flowers — massive flower parades, concerts, and silleteros' },
  { name: 'Buenos Aires', type: 'city', country: 'Argentina', region: 'Latin America', lat: -34.6037, lng: -58.3816 },
  { name: 'Mendoza', type: 'city', country: 'Argentina', region: 'Latin America', lat: -32.8895, lng: -68.8458 },
  { name: 'Bariloche', type: 'city', country: 'Argentina', region: 'Latin America', lat: -41.1335, lng: -71.3103 },
  { name: 'Cerro Catedral', type: 'ski', country: 'Argentina', region: 'Latin America', season: 'Jun-Oct', nearestCity: 'Bariloche', description: "South America's largest ski resort — 120km of runs in the Andes" },
  { name: 'Las Lenas', type: 'ski', country: 'Argentina', region: 'Latin America', season: 'Jun-Oct', nearestCity: 'Mendoza', description: 'Expert terrain with some of the longest vertical drops in South America' },
  { name: 'Lollapalooza Argentina', type: 'festival', country: 'Argentina', region: 'Latin America', category: 'music', when: 'March', nearestCity: 'Buenos Aires', description: 'South American edition of the iconic Chicago music festival' },
  { name: 'Iguazu Falls', type: 'experience', country: 'Argentina', region: 'Latin America', description: 'New Seven Natural Wonders — 275 waterfalls spanning 2.7km on the Brazil border' },
  { name: 'Sao Paulo', type: 'city', country: 'Brazil', region: 'Latin America', lat: -23.5505, lng: -46.6333 },
  { name: 'Rio de Janeiro', type: 'city', country: 'Brazil', region: 'Latin America', lat: -22.9068, lng: -43.1729 },
  { name: 'Florianopolis', type: 'city', country: 'Brazil', region: 'Latin America', lat: -27.5954, lng: -48.5480 },
  { name: 'Carnival (Rio)', type: 'festival', country: 'Brazil', region: 'Latin America', category: 'cultural', when: 'February-March', nearestCity: 'Rio de Janeiro', description: "World's largest carnival — 2M+ people per day, samba parades at the Sambodromo" },
  { name: 'Rock in Rio', type: 'festival', country: 'Brazil', region: 'Latin America', category: 'music', when: 'September', nearestCity: 'Rio de Janeiro', description: "One of the world's largest music festivals — 700K+ attendees over 7 days" },
  { name: 'Christ the Redeemer', type: 'experience', country: 'Brazil', region: 'Latin America', nearestCity: 'Rio de Janeiro', description: 'New Seven Wonders of the World — iconic statue overlooking Rio' },
  { name: 'San Jose', type: 'city', country: 'Costa Rica', region: 'Latin America', lat: 9.9281, lng: -84.0907 },
  { name: 'Tamarindo', type: 'city', country: 'Costa Rica', region: 'Latin America', lat: 10.2996, lng: -85.8372 },
  { name: 'Santa Teresa', type: 'city', country: 'Costa Rica', region: 'Latin America', lat: 9.6413, lng: -85.1688 },
  { name: 'Envision Festival', type: 'festival', country: 'Costa Rica', region: 'Latin America', category: 'music', when: 'February', nearestCity: 'Uvita', description: 'Transformational arts and music festival in the jungle' },
  { name: 'Santiago', type: 'city', country: 'Chile', region: 'Latin America', lat: -33.4489, lng: -70.6693 },
  { name: 'Valle Nevado', type: 'ski', country: 'Chile', region: 'Latin America', season: 'Jun-Oct', nearestCity: 'Santiago', description: 'Largest ski area in South America — 1 hour from Santiago, 40+ runs' },
  { name: 'Portillo', type: 'ski', country: 'Chile', region: 'Latin America', season: 'Jun-Oct', nearestCity: 'Santiago', description: "South America's first ski resort — legendary Andes powder, only 450 guests at a time" },
  { name: 'Atacama Desert Stargazing', type: 'experience', country: 'Chile', region: 'Latin America', nearestCity: 'San Pedro de Atacama', description: "Clearest skies on Earth — world's best astronomical observation site" },
];

const europe: Destination[] = [
  { name: 'Lisbon', type: 'city', country: 'Portugal', region: 'Europe', lat: 38.7223, lng: -9.1393 },
  { name: 'Porto', type: 'city', country: 'Portugal', region: 'Europe', lat: 41.1579, lng: -8.6291 },
  { name: 'Web Summit', type: 'conference', country: 'Portugal', region: 'Europe', category: 'tech', when: 'November', nearestCity: 'Lisbon', description: "World's largest tech conference — 70,000+ attendees" },
  { name: 'Money 20/20 Europe', type: 'conference', country: 'Portugal', region: 'Europe', category: 'fintech', when: 'June', nearestCity: 'Lisbon', description: "Europe's largest fintech and payments conference" },
  { name: 'Barcelona', type: 'city', country: 'Spain', region: 'Europe', lat: 41.3851, lng: 2.1734 },
  { name: 'Madrid', type: 'city', country: 'Spain', region: 'Europe', lat: 40.4168, lng: -3.7038 },
  { name: 'Baqueira-Beret', type: 'ski', country: 'Spain', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Barcelona', description: "Spain's top ski resort in the Pyrenees — 167km of runs" },
  { name: 'Sierra Nevada', type: 'ski', country: 'Spain', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Granada', description: "Europe's most southern ski resort — ski morning, beach afternoon" },
  { name: 'Primavera Sound', type: 'festival', country: 'Spain', region: 'Europe', category: 'music', when: 'May-June', nearestCity: 'Barcelona', description: 'Premier indie/alternative festival — gender-equal lineup pioneer' },
  { name: 'La Tomatina', type: 'festival', country: 'Spain', region: 'Europe', category: 'cultural', when: 'August', nearestCity: 'Valencia', description: "World's largest tomato fight — 150,000 tomatoes thrown in one hour" },
  { name: 'Running of the Bulls', type: 'festival', country: 'Spain', region: 'Europe', category: 'cultural', when: 'July', nearestCity: 'Pamplona', description: 'Legendary festival with bull runs through narrow streets — since 1591' },
  { name: 'La Sagrada Familia', type: 'experience', country: 'Spain', region: 'Europe', nearestCity: 'Barcelona', description: "Gaudi's unfinished masterpiece — finally completing after 144 years" },
  { name: 'Paris', type: 'city', country: 'France', region: 'Europe', lat: 48.8566, lng: 2.3522 },
  { name: 'Lyon', type: 'city', country: 'France', region: 'Europe', lat: 45.7640, lng: 4.8357 },
  { name: 'Nice', type: 'city', country: 'France', region: 'Europe', lat: 43.7102, lng: 7.2620 },
  { name: 'Chamonix-Mont-Blanc', type: 'ski', country: 'France', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Geneva', description: 'Home of the first Winter Olympics — legendary off-piste' },
  { name: 'Les 3 Vallees', type: 'ski', country: 'France', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Lyon', description: "World's largest linked ski area — 600km of pistes across 3 valleys" },
  { name: 'Cannes Film Festival', type: 'festival', country: 'France', region: 'Europe', category: 'film', when: 'May', nearestCity: 'Nice', description: "World's most prestigious film festival — the Palme d'Or" },
  { name: 'Eiffel Tower & Louvre', type: 'experience', country: 'France', region: 'Europe', nearestCity: 'Paris', description: "Two of the world's most visited landmarks" },
  { name: 'Zurich', type: 'city', country: 'Switzerland', region: 'Europe', lat: 47.3769, lng: 8.5417 },
  { name: 'Geneva', type: 'city', country: 'Switzerland', region: 'Europe', lat: 46.2044, lng: 6.1432 },
  { name: 'Zermatt (Matterhorn)', type: 'ski', country: 'Switzerland', region: 'Europe', season: 'Nov-May', description: 'Year-round skiing beneath the Matterhorn — 360km of pistes' },
  { name: 'Verbier', type: 'ski', country: 'Switzerland', region: 'Europe', season: 'Nov-Apr', description: 'World-famous freeride capital — expert terrain, legendary apres-ski' },
  { name: 'St. Moritz', type: 'ski', country: 'Switzerland', region: 'Europe', season: 'Nov-Apr', description: 'Birthplace of alpine winter tourism — hosted 2 Winter Olympics' },
  { name: 'Art Basel', type: 'festival', country: 'Switzerland', region: 'Europe', category: 'art', when: 'June', nearestCity: 'Basel', description: "World's premier modern & contemporary art fair — 200+ galleries" },
  { name: 'Jungfrau Railway', type: 'experience', country: 'Switzerland', region: 'Europe', nearestCity: 'Interlaken', description: 'Train to the Top of Europe (3,454m) — highest railway station in Europe' },
  { name: 'Vienna', type: 'city', country: 'Austria', region: 'Europe', lat: 48.2082, lng: 16.3738 },
  { name: 'Salzburg', type: 'city', country: 'Austria', region: 'Europe', lat: 47.8095, lng: 13.0550 },
  { name: 'Innsbruck', type: 'city', country: 'Austria', region: 'Europe', lat: 47.2692, lng: 11.4041 },
  { name: 'Ischgl', type: 'ski', country: 'Austria', region: 'Europe', season: 'Nov-May', description: '#1 rated ski resort in the world — 239km of slopes plus legendary apres-ski' },
  { name: 'Kitzbuhel', type: 'ski', country: 'Austria', region: 'Europe', season: 'Oct-May', description: 'Home of the Hahnenkamm — most famous downhill race in skiing' },
  { name: 'St. Anton am Arlberg', type: 'ski', country: 'Austria', region: 'Europe', season: 'Dec-Apr', description: 'Birthplace of alpine skiing — 300km of runs, epic off-piste' },
  { name: 'Salzburg Festival', type: 'festival', country: 'Austria', region: 'Europe', category: 'art', when: 'July-August', nearestCity: 'Salzburg', description: "World's most prestigious classical music and opera festival since 1920" },
  { name: 'Rome', type: 'city', country: 'Italy', region: 'Europe', lat: 41.9028, lng: 12.4964 },
  { name: 'Milan', type: 'city', country: 'Italy', region: 'Europe', lat: 45.4642, lng: 9.1900 },
  { name: 'Florence', type: 'city', country: 'Italy', region: 'Europe', lat: 43.7696, lng: 11.2558 },
  { name: "Cortina d'Ampezzo", type: 'ski', country: 'Italy', region: 'Europe', season: 'Dec-Apr', description: 'Queen of the Dolomites — hosting 2026 Winter Olympics' },
  { name: 'Venice Biennale', type: 'festival', country: 'Italy', region: 'Europe', category: 'art', when: 'May-November', nearestCity: 'Venice', description: "World's oldest and most important contemporary art exhibition since 1895" },
  { name: 'Venice Film Festival', type: 'festival', country: 'Italy', region: 'Europe', category: 'film', when: 'September', nearestCity: 'Venice', description: "World's oldest film festival — the Golden Lion on the Lido" },
  { name: 'Amalfi Coast', type: 'experience', country: 'Italy', region: 'Europe', nearestCity: 'Naples', description: 'UNESCO World Heritage coastline — dramatic cliffs, colorful villages' },
  { name: 'Berlin', type: 'city', country: 'Germany', region: 'Europe', lat: 52.5200, lng: 13.4050 },
  { name: 'Munich', type: 'city', country: 'Germany', region: 'Europe', lat: 48.1351, lng: 11.5820 },
  { name: 'Oktoberfest', type: 'festival', country: 'Germany', region: 'Europe', category: 'cultural', when: 'September-October', nearestCity: 'Munich', description: "World's largest beer festival — 6M+ visitors over 16 days" },
  { name: 'Berlinale', type: 'festival', country: 'Germany', region: 'Europe', category: 'film', when: 'February', nearestCity: 'Berlin', description: "One of the world's top three film festivals — the Golden Bear" },
  { name: 'London', type: 'city', country: 'United Kingdom', region: 'Europe', lat: 51.5074, lng: -0.1278 },
  { name: 'Edinburgh', type: 'city', country: 'United Kingdom', region: 'Europe', lat: 55.9533, lng: -3.1883 },
  { name: 'Edinburgh Fringe', type: 'festival', country: 'United Kingdom', region: 'Europe', category: 'art', when: 'August', nearestCity: 'Edinburgh', description: "World's largest arts festival — 3,000+ shows across 300+ venues" },
  { name: 'Notting Hill Carnival', type: 'festival', country: 'United Kingdom', region: 'Europe', category: 'cultural', when: 'August', nearestCity: 'London', description: "Europe's largest street festival — Caribbean culture, 2M+ people" },
  { name: 'Innovate Finance Global Summit', type: 'conference', country: 'United Kingdom', region: 'Europe', category: 'fintech', when: 'April', nearestCity: 'London', description: "Europe's leading fintech conference — at the Guildhall" },
  { name: 'Amsterdam', type: 'city', country: 'Netherlands', region: 'Europe', lat: 52.3676, lng: 4.9041 },
  { name: 'Amsterdam Dance Event (ADE)', type: 'festival', country: 'Netherlands', region: 'Europe', category: 'music', when: 'October', nearestCity: 'Amsterdam', description: "World's biggest club festival — 2,500+ artists across 200+ venues" },
  { name: "King's Day", type: 'festival', country: 'Netherlands', region: 'Europe', category: 'cultural', when: 'April 27', nearestCity: 'Amsterdam', description: 'National holiday — entire country turns orange, canals become dance floors' },
  { name: 'Keukenhof Gardens', type: 'experience', country: 'Netherlands', region: 'Europe', when: 'March-May', nearestCity: 'Amsterdam', description: "World's largest flower garden — 7 million tulips in bloom" },
  { name: 'Brussels', type: 'city', country: 'Belgium', region: 'Europe', lat: 50.8503, lng: 4.3517 },
  { name: 'Tomorrowland', type: 'festival', country: 'Belgium', region: 'Europe', category: 'music', when: 'July', nearestCity: 'Boom', description: "World's most famous EDM festival — 400K attendees, fantasy-themed stages" },
  { name: 'Split', type: 'city', country: 'Croatia', region: 'Europe', lat: 43.5081, lng: 16.4402 },
  { name: 'Dubrovnik', type: 'city', country: 'Croatia', region: 'Europe', lat: 42.6507, lng: 18.0944 },
  { name: 'Ultra Europe', type: 'festival', country: 'Croatia', region: 'Europe', category: 'music', when: 'July', nearestCity: 'Split', description: 'European edition of Ultra — EDM on the Dalmatian coast' },
  { name: 'Plitvice Lakes', type: 'experience', country: 'Croatia', region: 'Europe', description: 'UNESCO World Heritage — 16 cascading lakes connected by waterfalls' },
  { name: 'Athens', type: 'city', country: 'Greece', region: 'Europe', lat: 37.9838, lng: 23.7275 },
  { name: 'Santorini Sunset', type: 'experience', country: 'Greece', region: 'Europe', description: 'Watch the sunset from Oia — one of the most photographed views on Earth' },
  { name: 'Tbilisi', type: 'city', country: 'Georgia', region: 'Europe', lat: 41.7151, lng: 44.8271 },
  { name: 'Gudauri', type: 'ski', country: 'Georgia', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Tbilisi', description: 'Best value ski resort in Europe — 57km of runs, 2 hours from Tbilisi' },
  { name: 'Istanbul', type: 'city', country: 'Turkey', region: 'Europe', lat: 41.0082, lng: 28.9784 },
  { name: 'Cappadocia Hot Air Balloons', type: 'experience', country: 'Turkey', region: 'Europe', nearestCity: 'Kayseri', description: 'Hundreds of balloons rising over fairy chimneys at sunrise' },
  { name: 'Erciyes', type: 'ski', country: 'Turkey', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Kayseri', description: 'Modern resort on an extinct volcano — 150km of runs, incredibly cheap' },
  { name: 'Prague', type: 'city', country: 'Czech Republic', region: 'Europe', lat: 50.0755, lng: 14.4378 },
  { name: 'Budapest', type: 'city', country: 'Hungary', region: 'Europe', lat: 47.4979, lng: 19.0402 },
  { name: 'Sziget Festival', type: 'festival', country: 'Hungary', region: 'Europe', category: 'music', when: 'August', nearestCity: 'Budapest', description: 'Island of Freedom — week-long festival on Obuda Island, 500K+ attendees' },
  { name: 'Budapest Thermal Baths', type: 'experience', country: 'Hungary', region: 'Europe', nearestCity: 'Budapest', description: "City of Spas — historic thermal baths including Szechenyi (Europe's largest)" },
  { name: 'Oslo', type: 'city', country: 'Norway', region: 'Europe', lat: 59.9139, lng: 10.7522 },
  { name: 'Tromso', type: 'city', country: 'Norway', region: 'Europe', lat: 69.6492, lng: 18.9553 },
  { name: 'Hemsedal', type: 'ski', country: 'Norway', region: 'Europe', season: 'Nov-May', nearestCity: 'Oslo', description: "Scandinavia's Alps — Norway's most popular resort" },
  { name: 'Northern Lights from Tromso', type: 'experience', country: 'Norway', region: 'Europe', when: 'Sep-Mar', nearestCity: 'Tromso', description: 'Best place on Earth to see the Aurora Borealis — 69 N latitude' },
  { name: 'Norwegian Fjords', type: 'experience', country: 'Norway', region: 'Europe', nearestCity: 'Bergen', description: 'UNESCO World Heritage fjords — dramatic waterfalls and cliffs' },
  { name: 'Stockholm', type: 'city', country: 'Sweden', region: 'Europe', lat: 59.3293, lng: 18.0686 },
  { name: 'Are', type: 'ski', country: 'Sweden', region: 'Europe', season: 'Nov-May', nearestCity: 'Stockholm', description: "Sweden's premier resort — hosted Alpine World Ski Championships" },
  { name: 'Reykjavik', type: 'city', country: 'Iceland', region: 'Europe', lat: 64.1466, lng: -21.9426 },
  { name: 'Blue Lagoon', type: 'experience', country: 'Iceland', region: 'Europe', nearestCity: 'Reykjavik', description: 'Geothermal spa in a lava field — milky blue waters at 37-39 C' },
  { name: 'Golden Circle', type: 'experience', country: 'Iceland', region: 'Europe', nearestCity: 'Reykjavik', description: "Geysers, waterfalls, and tectonic plates — Iceland's essential day trip" },
  { name: 'Tallinn', type: 'city', country: 'Estonia', region: 'Europe', lat: 59.4370, lng: 24.7536 },
];

const eastAsia: Destination[] = [
  { name: 'Tokyo', type: 'city', country: 'Japan', region: 'East Asia', lat: 35.6762, lng: 139.6503 },
  { name: 'Osaka', type: 'city', country: 'Japan', region: 'East Asia', lat: 34.6937, lng: 135.5023 },
  { name: 'Kyoto', type: 'city', country: 'Japan', region: 'East Asia', lat: 35.0116, lng: 135.7681 },
  { name: 'Niseko', type: 'ski', country: 'Japan', region: 'East Asia', season: 'Dec-Apr', nearestCity: 'Sapporo', description: "World's best powder — 15+ meters of annual snowfall, legendary tree runs" },
  { name: 'Hakuba', type: 'ski', country: 'Japan', region: 'East Asia', season: 'Dec-Mar', nearestCity: 'Tokyo', description: 'Host of 1998 Winter Olympics — 10 resorts, incredible snow, 3hrs from Tokyo' },
  { name: 'Fuji Rock Festival', type: 'festival', country: 'Japan', region: 'East Asia', category: 'music', when: 'July', nearestCity: 'Tokyo', description: "Japan's largest outdoor music festival — in the mountains of Niigata" },
  { name: 'Cherry Blossom Season', type: 'experience', country: 'Japan', region: 'East Asia', when: 'March-April', nearestCity: 'Tokyo', description: 'Sakura season — millions gather for hanami (flower viewing) across Japan' },
  { name: 'Fushimi Inari Shrine', type: 'experience', country: 'Japan', region: 'East Asia', nearestCity: 'Kyoto', description: "10,000 vermilion torii gates winding up a mountain — Kyoto's most iconic sight" },
  { name: 'FIN/SUM (FinTech Summit)', type: 'conference', country: 'Japan', region: 'East Asia', category: 'fintech', when: 'March', nearestCity: 'Tokyo', description: "Japan's largest fintech conference — co-hosted by Japan FSA and Nikkei" },
  { name: 'Seoul', type: 'city', country: 'South Korea', region: 'East Asia', lat: 37.5665, lng: 126.9780 },
  { name: 'Busan', type: 'city', country: 'South Korea', region: 'East Asia', lat: 35.1796, lng: 129.0756 },
  { name: 'Yongpyong', type: 'ski', country: 'South Korea', region: 'East Asia', season: 'Nov-Mar', nearestCity: 'Seoul', description: "Korea's largest resort — hosted 2018 Winter Olympics alpine events" },
  { name: 'Busan International Film Festival', type: 'festival', country: 'South Korea', region: 'East Asia', category: 'film', when: 'October', nearestCity: 'Busan', description: "Asia's most prestigious film festival — the Asian Cannes" },
  { name: 'Seoul Lantern Festival', type: 'festival', country: 'South Korea', region: 'East Asia', category: 'cultural', when: 'November', nearestCity: 'Seoul', description: 'Thousands of illuminated lanterns along the Cheonggyecheon stream' },
  { name: 'Taipei', type: 'city', country: 'Taiwan', region: 'East Asia', lat: 25.0330, lng: 121.5654 },
  { name: 'Pingxi Sky Lantern Festival', type: 'festival', country: 'Taiwan', region: 'East Asia', category: 'cultural', when: 'February', nearestCity: 'Taipei', description: "Thousands of paper lanterns released into the night sky — one of the world's most magical sights" },
];

const middleEastAfrica: Destination[] = [
  { name: 'Dubai', type: 'city', country: 'UAE', region: 'Middle East & Africa', lat: 25.2048, lng: 55.2708 },
  { name: 'Abu Dhabi', type: 'city', country: 'UAE', region: 'Middle East & Africa', lat: 24.4539, lng: 54.3773 },
  { name: 'Dubai FinTech Summit', type: 'conference', country: 'UAE', region: 'Middle East & Africa', category: 'fintech', when: 'May', nearestCity: 'Dubai', description: "MENA's premier fintech event — at Dubai International Financial Centre" },
  { name: 'Burj Khalifa', type: 'experience', country: 'UAE', region: 'Middle East & Africa', nearestCity: 'Dubai', description: "World's tallest building (828m) — observation deck at 555m above the desert" },
  { name: 'Cape Town', type: 'city', country: 'South Africa', region: 'Middle East & Africa', lat: -33.9249, lng: 18.4241 },
  { name: 'Johannesburg', type: 'city', country: 'South Africa', region: 'Middle East & Africa', lat: -26.2041, lng: 28.0473 },
  { name: 'Table Mountain', type: 'experience', country: 'South Africa', region: 'Middle East & Africa', nearestCity: 'Cape Town', description: 'New Seven Natural Wonders — cable car to the flat summit overlooking the Atlantic' },
  { name: 'Kruger National Park Safari', type: 'experience', country: 'South Africa', region: 'Middle East & Africa', nearestCity: 'Johannesburg', description: "Big Five safari — one of Africa's largest game reserves" },
  { name: 'Marrakech', type: 'city', country: 'Morocco', region: 'Middle East & Africa', lat: 31.6295, lng: -7.9811 },
  { name: 'Essaouira', type: 'city', country: 'Morocco', region: 'Middle East & Africa', lat: 31.5085, lng: -9.7595 },
  { name: 'Oukaimeden', type: 'ski', country: 'Morocco', region: 'Middle East & Africa', season: 'Dec-Mar', nearestCity: 'Marrakech', description: "Africa's highest ski resort — ski the Atlas Mountains, 1 hour from Marrakech" },
  { name: 'Sahara Desert Camp', type: 'experience', country: 'Morocco', region: 'Middle East & Africa', nearestCity: 'Marrakech', description: 'Overnight in luxury Sahara camp — camel trek, dunes, Milky Way' },
  { name: 'Nairobi', type: 'city', country: 'Kenya', region: 'Middle East & Africa', lat: -1.2921, lng: 36.8219 },
  { name: 'Great Wildebeest Migration', type: 'experience', country: 'Kenya', region: 'Middle East & Africa', when: 'July-October', nearestCity: 'Nairobi', description: "Two million animals crossing the Mara River — nature's greatest spectacle" },
  { name: 'Cairo', type: 'city', country: 'Egypt', region: 'Middle East & Africa', lat: 30.0444, lng: 31.2357 },
  { name: 'Pyramids of Giza', type: 'experience', country: 'Egypt', region: 'Middle East & Africa', nearestCity: 'Cairo', description: 'Last surviving Ancient Wonder of the World — 4,500 years old' },
  { name: 'Mount Kilimanjaro', type: 'experience', country: 'Tanzania', region: 'Middle East & Africa', description: "Africa's highest peak (5,895m) — the world's tallest free-standing mountain" },
];

const northAmerica: Destination[] = [
  { name: 'Los Angeles', type: 'city', country: 'USA', region: 'North America', lat: 34.0522, lng: -118.2437 },
  { name: 'Miami', type: 'city', country: 'USA', region: 'North America', lat: 25.7617, lng: -80.1918 },
  { name: 'Austin', type: 'city', country: 'USA', region: 'North America', lat: 30.2672, lng: -97.7431 },
  { name: 'New York City', type: 'city', country: 'USA', region: 'North America', lat: 40.7128, lng: -74.0060 },
  { name: 'Aspen Snowmass', type: 'ski', country: 'USA', region: 'North America', season: 'Nov-Apr', nearestCity: 'Denver', description: '4 mountains, 5,500+ acres — the most famous ski town in America' },
  { name: 'Vail', type: 'ski', country: 'USA', region: 'North America', season: 'Nov-Apr', nearestCity: 'Denver', description: 'Largest single-mountain ski area in the US — 5,317 acres, legendary back bowls' },
  { name: 'Park City / Deer Valley', type: 'ski', country: 'USA', region: 'North America', season: 'Nov-Apr', nearestCity: 'Salt Lake City', description: 'Host of 2002 Olympics — 7,300+ acres combined, world-class Utah powder' },
  { name: 'Jackson Hole', type: 'ski', country: 'USA', region: 'North America', season: 'Dec-Apr', nearestCity: 'Jackson', description: "Expert's paradise — 4,139ft vertical, Corbet's Couloir, Grand Teton backdrop" },
  { name: 'Mammoth Mountain', type: 'ski', country: 'USA', region: 'North America', season: 'Nov-Jun', nearestCity: 'Los Angeles', description: "California's highest resort — 400\" annual snowfall, open until June" },
  { name: 'Coachella', type: 'festival', country: 'USA', region: 'North America', category: 'music', when: 'April (2 weekends)', nearestCity: 'Los Angeles', description: "World's most recognized music and culture festival — the desert's fashion runway" },
  { name: 'SXSW', type: 'conference', country: 'USA', region: 'North America', category: 'tech', when: 'March', nearestCity: 'Austin', description: 'Music + Film + Interactive mega-conference — where tech meets culture' },
  { name: 'Ultra Music Festival', type: 'festival', country: 'USA', region: 'North America', category: 'music', when: 'March', nearestCity: 'Miami', description: 'Premier EDM festival at Bayfront Park — kicks off the global festival season' },
  { name: 'Lollapalooza', type: 'festival', country: 'USA', region: 'North America', category: 'music', when: 'August', nearestCity: 'Chicago', description: '8 stages in Grant Park — rock, hip-hop, EDM, alternative across 4 days' },
  { name: 'Burning Man', type: 'festival', country: 'USA', region: 'North America', category: 'art', when: 'August-September', nearestCity: 'Reno', description: 'Radical self-expression in the Nevada desert — art, community, temporary city of 70K' },
  { name: 'Art Basel Miami Beach', type: 'festival', country: 'USA', region: 'North America', category: 'art', when: 'December', nearestCity: 'Miami', description: "Americas edition of the world's premier art fair — art, parties, Design District" },
  { name: 'Money 20/20 USA', type: 'conference', country: 'USA', region: 'North America', category: 'fintech', when: 'October', nearestCity: 'Las Vegas', description: "World's largest fintech and payments event — 13,000+ attendees in Vegas" },
  { name: 'Grand Canyon', type: 'experience', country: 'USA', region: 'North America', description: "One of the world's great natural wonders — 277 miles long, 1 mile deep" },
  { name: 'Toronto', type: 'city', country: 'Canada', region: 'North America', lat: 43.6532, lng: -79.3832 },
  { name: 'Vancouver', type: 'city', country: 'Canada', region: 'North America', lat: 49.2827, lng: -123.1207 },
  { name: 'Montreal', type: 'city', country: 'Canada', region: 'North America', lat: 45.5017, lng: -73.5673 },
  { name: 'Whistler Blackcomb', type: 'ski', country: 'Canada', region: 'North America', season: 'Nov-May', nearestCity: 'Vancouver', description: 'Largest ski resort in North America — 8,171 acres, hosted 2010 Winter Olympics' },
  { name: 'Lake Louise', type: 'ski', country: 'Canada', region: 'North America', season: 'Nov-May', nearestCity: 'Calgary', description: 'Stunning Rocky Mountain setting — turquoise lake below, 4,200 acres of terrain' },
  { name: 'Montreal Jazz Festival', type: 'festival', country: 'Canada', region: 'North America', category: 'music', when: 'June-July', nearestCity: 'Montreal', description: "World's largest jazz festival — 3,000+ artists, many free outdoor concerts" },
  { name: 'TIFF', type: 'festival', country: 'Canada', region: 'North America', category: 'film', when: 'September', nearestCity: 'Toronto', description: "North America's most important film festival — Oscar predictor, 480K+ attendees" },
  { name: 'Niagara Falls', type: 'experience', country: 'Canada', region: 'North America', nearestCity: 'Toronto', description: "One of the world's most powerful waterfalls — boat rides into the mist" },
  { name: 'Banff & the Canadian Rockies', type: 'experience', country: 'Canada', region: 'North America', nearestCity: 'Calgary', description: "UNESCO World Heritage — turquoise lakes, glaciers, and elk in Canada's most beautiful park" },
];

const oceania: Destination[] = [
  { name: 'Sydney', type: 'city', country: 'Australia', region: 'Oceania', lat: -33.8688, lng: 151.2093 },
  { name: 'Melbourne', type: 'city', country: 'Australia', region: 'Oceania', lat: -37.8136, lng: 144.9631 },
  { name: 'Byron Bay', type: 'city', country: 'Australia', region: 'Oceania', lat: -28.6474, lng: 153.6020 },
  { name: 'Thredbo', type: 'ski', country: 'Australia', region: 'Oceania', season: 'Jun-Oct', nearestCity: 'Sydney', description: "Australia's best resort — highest vertical drop in the country" },
  { name: 'Vivid Sydney', type: 'festival', country: 'Australia', region: 'Oceania', category: 'art', when: 'May-June', nearestCity: 'Sydney', description: 'Light, music, and ideas festival — the Sydney Opera House illuminated' },
  { name: 'Great Barrier Reef', type: 'experience', country: 'Australia', region: 'Oceania', description: "World's largest coral reef system — snorkel/dive 2,900+ individual reefs" },
  { name: 'Uluru (Ayers Rock)', type: 'experience', country: 'Australia', region: 'Oceania', description: 'Sacred Aboriginal site — massive sandstone monolith glowing red at sunset' },
  { name: 'Auckland', type: 'city', country: 'New Zealand', region: 'Oceania', lat: -36.8485, lng: 174.7633 },
  { name: 'Queenstown', type: 'city', country: 'New Zealand', region: 'Oceania', lat: -45.0312, lng: 168.6626 },
  { name: 'The Remarkables', type: 'ski', country: 'New Zealand', region: 'Oceania', season: 'Jun-Oct', nearestCity: 'Queenstown', description: 'Stunning mountain range above Queenstown — adventure capital meets ski terrain' },
  { name: 'Milford Sound', type: 'experience', country: 'New Zealand', region: 'Oceania', nearestCity: 'Queenstown', description: 'Eighth Wonder of the World (Kipling) — fiord with waterfalls, dolphins, and seals' },
  { name: 'Hobbiton', type: 'experience', country: 'New Zealand', region: 'Oceania', nearestCity: 'Auckland', description: 'Lord of the Rings movie set — the Shire brought to life on a working farm' },
];

const southAsia: Destination[] = [
  { name: 'Mumbai', type: 'city', country: 'India', region: 'South Asia', lat: 19.0760, lng: 72.8777 },
  { name: 'Goa', type: 'city', country: 'India', region: 'South Asia', lat: 15.2993, lng: 74.1240 },
  { name: 'Bangalore', type: 'city', country: 'India', region: 'South Asia', lat: 12.9716, lng: 77.5946 },
  { name: 'Gulmarg', type: 'ski', country: 'India', region: 'South Asia', season: 'Dec-Mar', nearestCity: 'Srinagar', description: "World's highest gondola ski lift (3,980m) — Himalayan powder, mind-blowing views" },
  { name: 'Holi Festival', type: 'festival', country: 'India', region: 'South Asia', category: 'cultural', when: 'March', nearestCity: 'Delhi', description: "Festival of Colors — millions throw colored powder in one of humanity's most joyous celebrations" },
  { name: 'Diwali', type: 'festival', country: 'India', region: 'South Asia', category: 'cultural', when: 'October-November', nearestCity: 'Delhi', description: 'Festival of Lights — entire country illuminated with lamps, fireworks, and sweets' },
  { name: 'Sunburn Festival', type: 'festival', country: 'India', region: 'South Asia', category: 'music', when: 'December', nearestCity: 'Goa', description: "Asia's largest electronic music festival — beach stages in Goa" },
  { name: 'Global Fintech Fest', type: 'conference', country: 'India', region: 'South Asia', category: 'fintech', when: 'August', nearestCity: 'Mumbai', description: "One of world's largest fintech conferences — India's booming digital payments ecosystem" },
  { name: 'Taj Mahal', type: 'experience', country: 'India', region: 'South Asia', nearestCity: 'Delhi', description: 'New Seven Wonders of the World — white marble mausoleum, symbol of eternal love' },
];

export const ALL_DESTINATIONS: Destination[] = [
  ...southeastAsia, ...latinAmerica, ...europe, ...eastAsia,
  ...middleEastAfrica, ...northAmerica, ...oceania, ...southAsia,
];

export const getDestinationsByCountry = (country: string) =>
  ALL_DESTINATIONS.filter(d => d.country === country);
export const getDestinationsByRegion = (region: string) =>
  ALL_DESTINATIONS.filter(d => d.region === region);
export const getDestinationsByType = (type: DestinationType) =>
  ALL_DESTINATIONS.filter(d => d.type === type);
export const getCities = () => getDestinationsByType('city');
export const getSkiResorts = () => getDestinationsByType('ski');
export const getFestivals = () =>
  ALL_DESTINATIONS.filter(d => d.type === 'festival' || d.type === 'conference' || d.type === 'event');
export const getExperiences = () => getDestinationsByType('experience');

export const getEventsNearCity = (cityName: string, country: string) => {
  return ALL_DESTINATIONS.filter(d =>
    d.country === country &&
    (d.type === 'festival' || d.type === 'conference' || d.type === 'event' || d.type === 'experience' || d.type === 'ski') &&
    (d.nearestCity === cityName || !d.nearestCity)
  );
};

export const searchDestinations = (query: string): Destination[] => {
  const q = query.toLowerCase();
  const results = ALL_DESTINATIONS.filter(d =>
    d.name.toLowerCase().includes(q) ||
    d.country.toLowerCase().includes(q) ||
    d.region.toLowerCase().includes(q) ||
    (d.description && d.description.toLowerCase().includes(q))
  );
  // Sort: cities first, then ski, then events/festivals/experiences
  const typeOrder: Record<string, number> = { city: 0, ski: 1, festival: 2, conference: 2, event: 2, experience: 3 };
  return results.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));
};

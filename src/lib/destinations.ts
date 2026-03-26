// =============================================================================
// TEMPLE STUART — GLOBAL DESTINATIONS DATABASE
// Single source of truth for the Travel module destination picker
// =============================================================================
//
// DATA STRUCTURE:
// - Destinations are grouped by REGION → COUNTRY
// - Each country has: cities (top 3), ski resorts (top 3 if they exist),
//   festivals, conferences, events, and bucket list experiences
// - Events/festivals include approximate dates and category tags
// - Bucket list items are "once in a lifetime" globally recognized experiences
//
// USAGE:
// When a user selects a destination + dates, the app filters this data to show
// what's available at that location during their travel window.
//
// MAINTENANCE:
// - Cities and ski resorts are relatively static — update annually
// - Festivals/events have dates that change yearly — update each November
//   for the following year
// - This file was compiled March 2026
// =============================================================================

export type DestinationType = 'city' | 'ski' | 'festival' | 'conference' | 'event' | 'experience';
export type FestivalCategory = 'music' | 'art' | 'fintech' | 'tech' | 'film' | 'food' | 'cultural';

export interface Destination {
  name: string;
  type: DestinationType;
  country: string;
  region: string;
  /** Nearest major city (for ski resorts, festivals held outside cities) */
  nearestCity?: string;
  /** Approximate month(s) — e.g. "July", "Dec-Mar", "April (2 weekends)" */
  when?: string;
  /** Season for ski resorts */
  season?: string;
  category?: FestivalCategory;
  /** One-line description */
  description?: string;
  /** Approximate latitude for map placement */
  lat?: number;
  /** Approximate longitude for map placement */
  lng?: number;
}

// =============================================================================
// SOUTHEAST ASIA
// =============================================================================

const southeastAsia: Destination[] = [
  // THAILAND
  { name: 'Bangkok', type: 'city', country: 'Thailand', region: 'Southeast Asia', lat: 13.7563, lng: 100.5018 },
  { name: 'Chiang Mai', type: 'city', country: 'Thailand', region: 'Southeast Asia', lat: 18.7883, lng: 98.9853 },
  { name: 'Phuket', type: 'city', country: 'Thailand', region: 'Southeast Asia', lat: 7.8804, lng: 98.3923 },
  { name: 'Songkran Festival', type: 'festival', country: 'Thailand', region: 'Southeast Asia', category: 'cultural', when: 'April', nearestCity: 'Bangkok', description: 'Thai New Year water festival — the world\'s biggest water fight' },
  { name: 'Full Moon Party', type: 'event', country: 'Thailand', region: 'Southeast Asia', category: 'music', when: 'Monthly', nearestCity: 'Koh Phangan', description: 'Legendary monthly beach rave on Haad Rin beach' },
  { name: 'Loi Krathong', type: 'festival', country: 'Thailand', region: 'Southeast Asia', category: 'cultural', when: 'November', nearestCity: 'Chiang Mai', description: 'Festival of lights — thousands of floating lanterns released into the sky' },
  { name: 'Tomorrowland Thailand', type: 'festival', country: 'Thailand', region: 'Southeast Asia', category: 'music', when: 'December', nearestCity: 'Pattaya', description: 'First-ever Tomorrowland in Asia — massive EDM festival debut' },
  { name: 'Wonderfruit', type: 'festival', country: 'Thailand', region: 'Southeast Asia', category: 'music', when: 'December', nearestCity: 'Pattaya', description: 'Art, music, and sustainability festival in The Fields at Siam Country Club' },

  // INDONESIA
  { name: 'Bali (Canggu)', type: 'city', country: 'Indonesia', region: 'Southeast Asia', lat: -8.6478, lng: 115.1385 },
  { name: 'Jakarta', type: 'city', country: 'Indonesia', region: 'Southeast Asia', lat: -6.2088, lng: 106.8456 },
  { name: 'Yogyakarta', type: 'city', country: 'Indonesia', region: 'Southeast Asia', lat: -7.7956, lng: 110.3695 },
  { name: 'Nyepi (Day of Silence)', type: 'festival', country: 'Indonesia', region: 'Southeast Asia', category: 'cultural', when: 'March', nearestCity: 'Bali (Canggu)', description: 'Balinese New Year — entire island shuts down, no lights, no travel' },
  { name: 'Ubud Writers & Readers Festival', type: 'festival', country: 'Indonesia', region: 'Southeast Asia', category: 'art', when: 'October', nearestCity: 'Bali (Canggu)', description: 'Southeast Asia\'s largest literary festival in the heart of Ubud' },
  { name: 'Borobudur Temple', type: 'experience', country: 'Indonesia', region: 'Southeast Asia', nearestCity: 'Yogyakarta', description: 'World\'s largest Buddhist temple — sunrise over volcanic landscape' },
  { name: 'Komodo National Park', type: 'experience', country: 'Indonesia', region: 'Southeast Asia', description: 'See Komodo dragons in the wild, world-class diving at Pink Beach' },
  { name: 'Mount Bromo Sunrise', type: 'experience', country: 'Indonesia', region: 'Southeast Asia', nearestCity: 'Surabaya', description: 'Sunrise over an active volcano crater in the Sea of Sand' },

  // VIETNAM
  { name: 'Ho Chi Minh City', type: 'city', country: 'Vietnam', region: 'Southeast Asia', lat: 10.8231, lng: 106.6297 },
  { name: 'Da Nang', type: 'city', country: 'Vietnam', region: 'Southeast Asia', lat: 16.0544, lng: 108.2022 },
  { name: 'Hanoi', type: 'city', country: 'Vietnam', region: 'Southeast Asia', lat: 21.0285, lng: 105.8542 },
  { name: 'Ha Long Bay', type: 'experience', country: 'Vietnam', region: 'Southeast Asia', nearestCity: 'Hanoi', description: 'UNESCO World Heritage — 1,600+ limestone islands and caves by boat' },
  { name: 'Hoi An Lantern Festival', type: 'festival', country: 'Vietnam', region: 'Southeast Asia', category: 'cultural', when: 'Monthly (14th lunar)', nearestCity: 'Da Nang', description: 'Ancient town lit by thousands of silk lanterns on the full moon' },

  // PHILIPPINES
  { name: 'Manila', type: 'city', country: 'Philippines', region: 'Southeast Asia', lat: 14.5995, lng: 120.9842 },
  { name: 'Cebu', type: 'city', country: 'Philippines', region: 'Southeast Asia', lat: 10.3157, lng: 123.8854 },
  { name: 'Siargao', type: 'city', country: 'Philippines', region: 'Southeast Asia', lat: 9.8482, lng: 126.0458 },
  { name: 'Sinulog Festival', type: 'festival', country: 'Philippines', region: 'Southeast Asia', category: 'cultural', when: 'January', nearestCity: 'Cebu', description: 'Massive street dance festival honoring the Santo Niño — 2M+ attendees' },
  { name: 'El Nido & Palawan', type: 'experience', country: 'Philippines', region: 'Southeast Asia', description: 'Hidden lagoons, limestone cliffs, and the world\'s clearest waters' },

  // MALAYSIA
  { name: 'Kuala Lumpur', type: 'city', country: 'Malaysia', region: 'Southeast Asia', lat: 3.1390, lng: 101.6869 },
  { name: 'Penang', type: 'city', country: 'Malaysia', region: 'Southeast Asia', lat: 5.4141, lng: 100.3288 },
  { name: 'Langkawi', type: 'city', country: 'Malaysia', region: 'Southeast Asia', lat: 6.3500, lng: 99.8000 },
  { name: 'George Town Festival', type: 'festival', country: 'Malaysia', region: 'Southeast Asia', category: 'art', when: 'June-July', nearestCity: 'Penang', description: 'Month-long arts festival in UNESCO heritage George Town' },

  // CAMBODIA
  { name: 'Phnom Penh', type: 'city', country: 'Cambodia', region: 'Southeast Asia', lat: 11.5564, lng: 104.9282 },
  { name: 'Siem Reap', type: 'city', country: 'Cambodia', region: 'Southeast Asia', lat: 13.3671, lng: 103.8448 },
  { name: 'Kampot', type: 'city', country: 'Cambodia', region: 'Southeast Asia', lat: 10.5944, lng: 104.1640 },
  { name: 'Angkor Wat', type: 'experience', country: 'Cambodia', region: 'Southeast Asia', nearestCity: 'Siem Reap', description: 'World\'s largest religious monument — sunrise over ancient temple complex' },

  // SINGAPORE
  { name: 'Singapore', type: 'city', country: 'Singapore', region: 'Southeast Asia', lat: 1.3521, lng: 103.8198 },
  { name: 'Singapore FinTech Festival', type: 'conference', country: 'Singapore', region: 'Southeast Asia', category: 'fintech', when: 'November', nearestCity: 'Singapore', description: 'World\'s largest fintech event — 60,000+ attendees from 130+ countries' },
  { name: 'Formula 1 Singapore Grand Prix', type: 'event', country: 'Singapore', region: 'Southeast Asia', category: 'cultural', when: 'September-October', nearestCity: 'Singapore', description: 'Only F1 night race — cars racing through illuminated city streets' },
  { name: 'Gardens by the Bay', type: 'experience', country: 'Singapore', region: 'Southeast Asia', nearestCity: 'Singapore', description: 'Futuristic Supertree Grove light show — iconic Singapore landmark' },
];

// =============================================================================
// LATIN AMERICA
// =============================================================================

const latinAmerica: Destination[] = [
  // MEXICO
  { name: 'Mexico City', type: 'city', country: 'Mexico', region: 'Latin America', lat: 19.4326, lng: -99.1332 },
  { name: 'Oaxaca', type: 'city', country: 'Mexico', region: 'Latin America', lat: 17.0732, lng: -96.7266 },
  { name: 'Playa del Carmen', type: 'city', country: 'Mexico', region: 'Latin America', lat: 20.6296, lng: -87.0739 },
  { name: 'Day of the Dead (Día de Muertos)', type: 'festival', country: 'Mexico', region: 'Latin America', category: 'cultural', when: 'October 31 - November 2', nearestCity: 'Oaxaca', description: 'UNESCO Intangible Heritage — celebrate the dead with altars, parades, marigolds' },
  { name: 'Chichén Itzá', type: 'experience', country: 'Mexico', region: 'Latin America', nearestCity: 'Playa del Carmen', description: 'New Seven Wonders of the World — Mayan pyramid with equinox light show' },
  { name: 'INCmty', type: 'conference', country: 'Mexico', region: 'Latin America', category: 'fintech', when: 'November', nearestCity: 'Monterrey', description: 'Latin America\'s largest entrepreneurship and innovation festival' },

  // COLOMBIA
  { name: 'Medellín', type: 'city', country: 'Colombia', region: 'Latin America', lat: 6.2476, lng: -75.5658 },
  { name: 'Bogotá', type: 'city', country: 'Colombia', region: 'Latin America', lat: 4.7110, lng: -74.0721 },
  { name: 'Cartagena', type: 'city', country: 'Colombia', region: 'Latin America', lat: 10.3910, lng: -75.5364 },
  { name: 'Feria de las Flores', type: 'festival', country: 'Colombia', region: 'Latin America', category: 'cultural', when: 'August', nearestCity: 'Medellín', description: 'Festival of Flowers — massive flower parades, concerts, and silleteros' },
  { name: 'Carnaval de Barranquilla', type: 'festival', country: 'Colombia', region: 'Latin America', category: 'cultural', when: 'February', nearestCity: 'Barranquilla', description: 'UNESCO Heritage — second largest carnival in the world after Rio' },
  { name: 'Colombia Fintech', type: 'conference', country: 'Colombia', region: 'Latin America', category: 'fintech', when: 'September', nearestCity: 'Bogotá', description: 'Colombia\'s premier fintech and financial innovation conference' },

  // ARGENTINA
  { name: 'Buenos Aires', type: 'city', country: 'Argentina', region: 'Latin America', lat: -34.6037, lng: -58.3816 },
  { name: 'Mendoza', type: 'city', country: 'Argentina', region: 'Latin America', lat: -32.8895, lng: -68.8458 },
  { name: 'Bariloche', type: 'city', country: 'Argentina', region: 'Latin America', lat: -41.1335, lng: -71.3103 },
  { name: 'Cerro Catedral', type: 'ski', country: 'Argentina', region: 'Latin America', season: 'Jun-Oct', nearestCity: 'Bariloche', description: 'South America\'s largest ski resort — 120km of runs in the Andes' },
  { name: 'Las Leñas', type: 'ski', country: 'Argentina', region: 'Latin America', season: 'Jun-Oct', nearestCity: 'Mendoza', description: 'Expert terrain with some of the longest vertical drops in South America' },
  { name: 'Chapelco', type: 'ski', country: 'Argentina', region: 'Latin America', season: 'Jun-Oct', nearestCity: 'San Martín de los Andes', description: 'Family-friendly resort with stunning Patagonian lake views' },
  { name: 'Lollapalooza Argentina', type: 'festival', country: 'Argentina', region: 'Latin America', category: 'music', when: 'March', nearestCity: 'Buenos Aires', description: 'South American edition of the iconic Chicago music festival' },
  { name: 'Iguazú Falls', type: 'experience', country: 'Argentina', region: 'Latin America', description: 'New Seven Natural Wonders — 275 waterfalls spanning 2.7km on the Brazil border' },

  // BRAZIL
  { name: 'São Paulo', type: 'city', country: 'Brazil', region: 'Latin America', lat: -23.5505, lng: -46.6333 },
  { name: 'Rio de Janeiro', type: 'city', country: 'Brazil', region: 'Latin America', lat: -22.9068, lng: -43.1729 },
  { name: 'Florianópolis', type: 'city', country: 'Brazil', region: 'Latin America', lat: -27.5954, lng: -48.5480 },
  { name: 'Carnival (Rio)', type: 'festival', country: 'Brazil', region: 'Latin America', category: 'cultural', when: 'February-March', nearestCity: 'Rio de Janeiro', description: 'World\'s largest carnival — 2M+ people per day, samba parades at the Sambódromo' },
  { name: 'Rock in Rio', type: 'festival', country: 'Brazil', region: 'Latin America', category: 'music', when: 'September', nearestCity: 'Rio de Janeiro', description: 'One of the world\'s largest music festivals — 700K+ attendees over 7 days' },
  { name: 'Lollapalooza Brazil', type: 'festival', country: 'Brazil', region: 'Latin America', category: 'music', when: 'March', nearestCity: 'São Paulo', description: 'Major multi-genre festival in Autódromo de Interlagos' },
  { name: 'Christ the Redeemer', type: 'experience', country: 'Brazil', region: 'Latin America', nearestCity: 'Rio de Janeiro', description: 'New Seven Wonders of the World — iconic statue overlooking Rio' },

  // COSTA RICA
  { name: 'San José', type: 'city', country: 'Costa Rica', region: 'Latin America', lat: 9.9281, lng: -84.0907 },
  { name: 'Tamarindo', type: 'city', country: 'Costa Rica', region: 'Latin America', lat: 10.2996, lng: -85.8372 },
  { name: 'Santa Teresa', type: 'city', country: 'Costa Rica', region: 'Latin America', lat: 9.6413, lng: -85.1688 },
  { name: 'Envision Festival', type: 'festival', country: 'Costa Rica', region: 'Latin America', category: 'music', when: 'February', nearestCity: 'Uvita', description: 'Transformational arts and music festival in the jungle — yoga, music, permaculture' },

  // CHILE
  { name: 'Santiago', type: 'city', country: 'Chile', region: 'Latin America', lat: -33.4489, lng: -70.6693 },
  { name: 'Valparaíso', type: 'city', country: 'Chile', region: 'Latin America', lat: -33.0472, lng: -71.6127 },
  { name: 'Valle Nevado', type: 'ski', country: 'Chile', region: 'Latin America', season: 'Jun-Oct', nearestCity: 'Santiago', description: 'Largest ski area in South America — 1 hour from Santiago, 40+ runs' },
  { name: 'Portillo', type: 'ski', country: 'Chile', region: 'Latin America', season: 'Jun-Oct', nearestCity: 'Santiago', description: 'South America\'s first ski resort — legendary Andes powder, only 450 guests at a time' },
  { name: 'Lollapalooza Chile', type: 'festival', country: 'Chile', region: 'Latin America', category: 'music', when: 'March', nearestCity: 'Santiago', description: 'Chilean edition of Lollapalooza — largest music festival in South America' },
  { name: 'Atacama Desert Stargazing', type: 'experience', country: 'Chile', region: 'Latin America', nearestCity: 'San Pedro de Atacama', description: 'Clearest skies on Earth — world\'s best astronomical observation site' },
];

// =============================================================================
// EUROPE
// =============================================================================

const europe: Destination[] = [
  // PORTUGAL
  { name: 'Lisbon', type: 'city', country: 'Portugal', region: 'Europe', lat: 38.7223, lng: -9.1393 },
  { name: 'Porto', type: 'city', country: 'Portugal', region: 'Europe', lat: 41.1579, lng: -8.6291 },
  { name: 'Lagos', type: 'city', country: 'Portugal', region: 'Europe', lat: 37.1028, lng: -8.6732 },
  { name: 'NOS Alive', type: 'festival', country: 'Portugal', region: 'Europe', category: 'music', when: 'July', nearestCity: 'Lisbon', description: 'Major Lisbon rock/indie festival on the Tagus riverfront' },
  { name: 'Web Summit', type: 'conference', country: 'Portugal', region: 'Europe', category: 'tech', when: 'November', nearestCity: 'Lisbon', description: 'World\'s largest tech conference — 70,000+ attendees, strong fintech track' },
  { name: 'Money 20/20 Europe', type: 'conference', country: 'Portugal', region: 'Europe', category: 'fintech', when: 'June', nearestCity: 'Lisbon', description: 'Europe\'s largest fintech and payments conference' },
  { name: 'Serra da Estrela', type: 'ski', country: 'Portugal', region: 'Europe', season: 'Dec-Mar', nearestCity: 'Covilhã', description: 'Portugal\'s only ski resort — small but unique, mainland Portugal\'s highest point' },

  // SPAIN
  { name: 'Barcelona', type: 'city', country: 'Spain', region: 'Europe', lat: 41.3851, lng: 2.1734 },
  { name: 'Madrid', type: 'city', country: 'Spain', region: 'Europe', lat: 40.4168, lng: -3.7038 },
  { name: 'Tenerife', type: 'city', country: 'Spain', region: 'Europe', lat: 28.2916, lng: -16.6291 },
  { name: 'Baqueira-Beret', type: 'ski', country: 'Spain', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Barcelona', description: 'Spain\'s top ski resort in the Pyrenees — 167km of runs, Spanish royal family favorite' },
  { name: 'Sierra Nevada', type: 'ski', country: 'Spain', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Granada', description: 'Europe\'s most southern ski resort — ski in the morning, beach in the afternoon' },
  { name: 'Formigal', type: 'ski', country: 'Spain', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Zaragoza', description: 'Largest ski area in the Spanish Pyrenees — 176km of slopes' },
  { name: 'Primavera Sound', type: 'festival', country: 'Spain', region: 'Europe', category: 'music', when: 'May-June', nearestCity: 'Barcelona', description: 'Premier indie/alternative festival — first major festival to achieve gender-equal lineup' },
  { name: 'Sónar', type: 'festival', country: 'Spain', region: 'Europe', category: 'music', when: 'June', nearestCity: 'Barcelona', description: 'Electronic and experimental music + digital arts festival since 1994' },
  { name: 'La Tomatina', type: 'festival', country: 'Spain', region: 'Europe', category: 'cultural', when: 'August', nearestCity: 'Valencia', description: 'World\'s largest tomato fight — 150,000 tomatoes thrown in one hour' },
  { name: 'Running of the Bulls (San Fermín)', type: 'festival', country: 'Spain', region: 'Europe', category: 'cultural', when: 'July', nearestCity: 'Pamplona', description: 'Legendary festival with bull runs through narrow streets — since 1591' },
  { name: 'La Sagrada Família', type: 'experience', country: 'Spain', region: 'Europe', nearestCity: 'Barcelona', description: 'Gaudí\'s unfinished masterpiece — finally completing after 144 years of construction' },
  { name: 'South Summit', type: 'conference', country: 'Spain', region: 'Europe', category: 'fintech', when: 'June', nearestCity: 'Madrid', description: 'Major European startup and fintech conference' },

  // FRANCE
  { name: 'Paris', type: 'city', country: 'France', region: 'Europe', lat: 48.8566, lng: 2.3522 },
  { name: 'Lyon', type: 'city', country: 'France', region: 'Europe', lat: 45.7640, lng: 4.8357 },
  { name: 'Nice', type: 'city', country: 'France', region: 'Europe', lat: 43.7102, lng: 7.2620 },
  { name: 'Chamonix-Mont-Blanc', type: 'ski', country: 'France', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Geneva', description: 'Home of the first Winter Olympics — legendary off-piste and the Vallée Blanche' },
  { name: 'Val d\'Isère / Tignes', type: 'ski', country: 'France', region: 'Europe', season: 'Nov-May', nearestCity: 'Lyon', description: '300km of terrain, snow-sure glaciers up to 3,450m — world-class in every way' },
  { name: 'Les 3 Vallées (Courchevel/Méribel)', type: 'ski', country: 'France', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Lyon', description: 'World\'s largest linked ski area — 600km of pistes across 3 valleys' },
  { name: 'Cannes Film Festival', type: 'festival', country: 'France', region: 'Europe', category: 'film', when: 'May', nearestCity: 'Nice', description: 'World\'s most prestigious film festival — the Palme d\'Or on the French Riviera' },
  { name: 'Fête de la Musique', type: 'festival', country: 'France', region: 'Europe', category: 'music', when: 'June 21', nearestCity: 'Paris', description: 'Free live music on every street corner — celebrated across all of France' },
  { name: 'Paris FinTech Forum', type: 'conference', country: 'France', region: 'Europe', category: 'fintech', when: 'January', nearestCity: 'Paris', description: 'Premier European fintech conference at the former Paris stock exchange' },
  { name: 'Eiffel Tower & Louvre', type: 'experience', country: 'France', region: 'Europe', nearestCity: 'Paris', description: 'Two of the world\'s most visited landmarks — iconic Paris experiences' },
  { name: 'Mont Saint-Michel', type: 'experience', country: 'France', region: 'Europe', description: 'Medieval abbey on a tidal island — UNESCO World Heritage, looks like a fairy tale' },

  // SWITZERLAND
  { name: 'Zurich', type: 'city', country: 'Switzerland', region: 'Europe', lat: 47.3769, lng: 8.5417 },
  { name: 'Geneva', type: 'city', country: 'Switzerland', region: 'Europe', lat: 46.2044, lng: 6.1432 },
  { name: 'Bern', type: 'city', country: 'Switzerland', region: 'Europe', lat: 46.9480, lng: 7.4474 },
  { name: 'Zermatt (Matterhorn)', type: 'ski', country: 'Switzerland', region: 'Europe', season: 'Nov-May', description: 'Year-round skiing beneath the Matterhorn — 360km of pistes, car-free village' },
  { name: 'Verbier', type: 'ski', country: 'Switzerland', region: 'Europe', season: 'Nov-Apr', description: 'World-famous freeride capital — expert terrain, legendary après-ski' },
  { name: 'St. Moritz', type: 'ski', country: 'Switzerland', region: 'Europe', season: 'Nov-Apr', description: 'Birthplace of alpine winter tourism — hosted 2 Winter Olympics, ultra-luxury' },
  { name: 'Montreux Jazz Festival', type: 'festival', country: 'Switzerland', region: 'Europe', category: 'music', when: 'July', nearestCity: 'Montreux', description: 'World\'s most prestigious jazz festival since 1967 — on the shores of Lake Geneva' },
  { name: 'Art Basel', type: 'festival', country: 'Switzerland', region: 'Europe', category: 'art', when: 'June', nearestCity: 'Basel', description: 'World\'s premier modern & contemporary art fair — 200+ galleries from 30+ countries' },
  { name: 'Crypto Valley Conference', type: 'conference', country: 'Switzerland', region: 'Europe', category: 'fintech', when: 'June', nearestCity: 'Zurich', description: 'Annual blockchain/crypto conference in the heart of Crypto Valley (Zug)' },
  { name: 'Jungfrau Railway', type: 'experience', country: 'Switzerland', region: 'Europe', nearestCity: 'Interlaken', description: 'Train to the Top of Europe (3,454m) — highest railway station in Europe' },

  // AUSTRIA
  { name: 'Vienna', type: 'city', country: 'Austria', region: 'Europe', lat: 48.2082, lng: 16.3738 },
  { name: 'Salzburg', type: 'city', country: 'Austria', region: 'Europe', lat: 47.8095, lng: 13.0550 },
  { name: 'Innsbruck', type: 'city', country: 'Austria', region: 'Europe', lat: 47.2692, lng: 11.4041 },
  { name: 'Ischgl', type: 'ski', country: 'Austria', region: 'Europe', season: 'Nov-May', description: '#1 rated ski resort in the world — 239km of slopes plus legendary après-ski' },
  { name: 'Kitzbühel', type: 'ski', country: 'Austria', region: 'Europe', season: 'Oct-May', description: 'Home of the Hahnenkamm — most famous downhill race in skiing, medieval old town' },
  { name: 'St. Anton am Arlberg', type: 'ski', country: 'Austria', region: 'Europe', season: 'Dec-Apr', description: 'Birthplace of alpine skiing — 300km of runs, epic off-piste terrain' },
  { name: 'Salzburg Festival', type: 'festival', country: 'Austria', region: 'Europe', category: 'art', when: 'July-August', nearestCity: 'Salzburg', description: 'World\'s most prestigious classical music and opera festival since 1920' },
  { name: 'Vienna Philharmonic New Year\'s Concert', type: 'event', country: 'Austria', region: 'Europe', category: 'music', when: 'January 1', nearestCity: 'Vienna', description: 'Most watched concert on Earth — broadcast to 90+ countries from the Musikverein' },

  // ITALY
  { name: 'Rome', type: 'city', country: 'Italy', region: 'Europe', lat: 41.9028, lng: 12.4964 },
  { name: 'Milan', type: 'city', country: 'Italy', region: 'Europe', lat: 45.4642, lng: 9.1900 },
  { name: 'Florence', type: 'city', country: 'Italy', region: 'Europe', lat: 43.7696, lng: 11.2558 },
  { name: 'Cortina d\'Ampezzo', type: 'ski', country: 'Italy', region: 'Europe', season: 'Dec-Apr', description: 'Queen of the Dolomites — hosting 2026 Winter Olympics, UNESCO World Heritage peaks' },
  { name: 'Madonna di Campiglio', type: 'ski', country: 'Italy', region: 'Europe', season: 'Dec-Apr', description: 'Italy\'s most glamorous resort — 150km of pistes beneath stunning Brenta Dolomites' },
  { name: 'Val Gardena (Dolomiti Superski)', type: 'ski', country: 'Italy', region: 'Europe', season: 'Dec-Apr', description: 'Part of the world\'s largest ski carousel — 1,200km of linked Dolomite runs' },
  { name: 'Venice Biennale', type: 'festival', country: 'Italy', region: 'Europe', category: 'art', when: 'May-November (odd years: art / even years: architecture)', nearestCity: 'Venice', description: 'World\'s oldest and most important contemporary art exhibition since 1895' },
  { name: 'Venice Film Festival', type: 'festival', country: 'Italy', region: 'Europe', category: 'film', when: 'September', nearestCity: 'Venice', description: 'World\'s oldest film festival — the Golden Lion on the Lido' },
  { name: 'Salone del Mobile', type: 'event', country: 'Italy', region: 'Europe', category: 'art', when: 'April', nearestCity: 'Milan', description: 'World\'s largest furniture and design fair — the design world\'s Super Bowl' },
  { name: 'Colosseum & Roman Forum', type: 'experience', country: 'Italy', region: 'Europe', nearestCity: 'Rome', description: 'Walk through 2,000 years of history — the ancient heart of the Roman Empire' },
  { name: 'Amalfi Coast', type: 'experience', country: 'Italy', region: 'Europe', nearestCity: 'Naples', description: 'UNESCO World Heritage coastline — dramatic cliffs, colorful villages, limoncello' },

  // GERMANY
  { name: 'Berlin', type: 'city', country: 'Germany', region: 'Europe', lat: 52.5200, lng: 13.4050 },
  { name: 'Munich', type: 'city', country: 'Germany', region: 'Europe', lat: 48.1351, lng: 11.5820 },
  { name: 'Hamburg', type: 'city', country: 'Germany', region: 'Europe', lat: 53.5511, lng: 9.9937 },
  { name: 'Garmisch-Partenkirchen', type: 'ski', country: 'Germany', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Munich', description: 'Germany\'s top resort — hosted 1936 Olympics, access to Zugspitze (Germany\'s highest peak)' },
  { name: 'Oktoberfest', type: 'festival', country: 'Germany', region: 'Europe', category: 'cultural', when: 'September-October', nearestCity: 'Munich', description: 'World\'s largest beer festival — 6M+ visitors over 16 days' },
  { name: 'Berlinale', type: 'festival', country: 'Germany', region: 'Europe', category: 'film', when: 'February', nearestCity: 'Berlin', description: 'One of the world\'s top three film festivals — the Golden Bear' },
  { name: 'documenta', type: 'festival', country: 'Germany', region: 'Europe', category: 'art', when: 'June-September (every 5 years)', nearestCity: 'Kassel', description: 'Most important contemporary art exhibition — held every 5 years since 1955' },

  // UK
  { name: 'London', type: 'city', country: 'United Kingdom', region: 'Europe', lat: 51.5074, lng: -0.1278 },
  { name: 'Edinburgh', type: 'city', country: 'United Kingdom', region: 'Europe', lat: 55.9533, lng: -3.1883 },
  { name: 'Manchester', type: 'city', country: 'United Kingdom', region: 'Europe', lat: 53.4808, lng: -2.2426 },
  { name: 'Glastonbury', type: 'festival', country: 'United Kingdom', region: 'Europe', category: 'music', when: 'June (fallow year 2026 — returns 2027)', nearestCity: 'Bristol', description: 'World\'s most iconic music festival — 200K+ on Worthy Farm (on break in 2026)' },
  { name: 'Edinburgh Fringe', type: 'festival', country: 'United Kingdom', region: 'Europe', category: 'art', when: 'August', nearestCity: 'Edinburgh', description: 'World\'s largest arts festival — 3,000+ shows across 300+ venues over 25 days' },
  { name: 'Notting Hill Carnival', type: 'festival', country: 'United Kingdom', region: 'Europe', category: 'cultural', when: 'August', nearestCity: 'London', description: 'Europe\'s largest street festival — Caribbean culture, sound systems, 2M+ people' },
  { name: 'Innovate Finance Global Summit', type: 'conference', country: 'United Kingdom', region: 'Europe', category: 'fintech', when: 'April', nearestCity: 'London', description: 'Europe\'s leading fintech conference — at the Guildhall in the City of London' },
  { name: 'Finastra Universe', type: 'conference', country: 'United Kingdom', region: 'Europe', category: 'fintech', when: 'May', nearestCity: 'London', description: 'Global fintech and open finance summit' },
  { name: 'Stonehenge', type: 'experience', country: 'United Kingdom', region: 'Europe', description: 'Neolithic monument — 5,000 years old, summer solstice gathering' },

  // NETHERLANDS
  { name: 'Amsterdam', type: 'city', country: 'Netherlands', region: 'Europe', lat: 52.3676, lng: 4.9041 },
  { name: 'Rotterdam', type: 'city', country: 'Netherlands', region: 'Europe', lat: 51.9244, lng: 4.4777 },
  { name: 'Amsterdam Dance Event (ADE)', type: 'festival', country: 'Netherlands', region: 'Europe', category: 'music', when: 'October', nearestCity: 'Amsterdam', description: 'World\'s biggest club festival — 2,500+ artists across 200+ venues in 5 days' },
  { name: 'King\'s Day', type: 'festival', country: 'Netherlands', region: 'Europe', category: 'cultural', when: 'April 27', nearestCity: 'Amsterdam', description: 'National holiday — entire country turns orange, canals become dance floors' },
  { name: 'Keukenhof Gardens', type: 'experience', country: 'Netherlands', region: 'Europe', when: 'March-May', nearestCity: 'Amsterdam', description: 'World\'s largest flower garden — 7 million tulips in bloom' },

  // BELGIUM
  { name: 'Brussels', type: 'city', country: 'Belgium', region: 'Europe', lat: 50.8503, lng: 4.3517 },
  { name: 'Antwerp', type: 'city', country: 'Belgium', region: 'Europe', lat: 51.2194, lng: 4.4025 },
  { name: 'Tomorrowland', type: 'festival', country: 'Belgium', region: 'Europe', category: 'music', when: 'July', nearestCity: 'Boom', description: 'World\'s most famous EDM festival — 400K attendees, fantasy-themed mega-stages' },

  // CROATIA
  { name: 'Zagreb', type: 'city', country: 'Croatia', region: 'Europe', lat: 45.8150, lng: 15.9819 },
  { name: 'Split', type: 'city', country: 'Croatia', region: 'Europe', lat: 43.5081, lng: 16.4402 },
  { name: 'Dubrovnik', type: 'city', country: 'Croatia', region: 'Europe', lat: 42.6507, lng: 18.0944 },
  { name: 'Ultra Europe', type: 'festival', country: 'Croatia', region: 'Europe', category: 'music', when: 'July', nearestCity: 'Split', description: 'European edition of Ultra — EDM on the Dalmatian coast' },
  { name: 'Plitvice Lakes', type: 'experience', country: 'Croatia', region: 'Europe', description: 'UNESCO World Heritage — 16 cascading lakes connected by waterfalls in primeval forest' },

  // GREECE
  { name: 'Athens', type: 'city', country: 'Greece', region: 'Europe', lat: 37.9838, lng: 23.7275 },
  { name: 'Thessaloniki', type: 'city', country: 'Greece', region: 'Europe', lat: 40.6401, lng: 22.9444 },
  { name: 'Crete', type: 'city', country: 'Greece', region: 'Europe', lat: 35.2401, lng: 24.8093 },
  { name: 'Santorini Sunset', type: 'experience', country: 'Greece', region: 'Europe', description: 'Watch the sunset from Oia — one of the most photographed views on Earth' },
  { name: 'Acropolis & Parthenon', type: 'experience', country: 'Greece', region: 'Europe', nearestCity: 'Athens', description: '2,500-year-old citadel — the symbol of Western civilization' },

  // GEORGIA
  { name: 'Tbilisi', type: 'city', country: 'Georgia', region: 'Europe', lat: 41.7151, lng: 44.8271 },
  { name: 'Batumi', type: 'city', country: 'Georgia', region: 'Europe', lat: 41.6168, lng: 41.6367 },
  { name: 'Gudauri', type: 'ski', country: 'Georgia', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Tbilisi', description: 'Best value ski resort in Europe — 57km of runs, 2 hours from Tbilisi, heliskiing available' },
  { name: 'Bakuriani', type: 'ski', country: 'Georgia', region: 'Europe', season: 'Dec-Mar', nearestCity: 'Tbilisi', description: 'Family-friendly resort — hosted 2023 Freestyle World Championships' },

  // TURKEY
  { name: 'Istanbul', type: 'city', country: 'Turkey', region: 'Europe', lat: 41.0082, lng: 28.9784 },
  { name: 'Antalya', type: 'city', country: 'Turkey', region: 'Europe', lat: 36.8969, lng: 30.7133 },
  { name: 'Bodrum', type: 'city', country: 'Turkey', region: 'Europe', lat: 37.0344, lng: 27.4305 },
  { name: 'Erciyes', type: 'ski', country: 'Turkey', region: 'Europe', season: 'Dec-Apr', nearestCity: 'Kayseri', description: 'Modern resort on an extinct volcano — 150km of runs, incredibly cheap, higher than Val Thorens' },
  { name: 'Uludağ', type: 'ski', country: 'Turkey', region: 'Europe', season: 'Dec-Mar', nearestCity: 'Bursa', description: 'Turkey\'s most popular resort — easy access from Istanbul' },
  { name: 'Cappadocia Hot Air Balloons', type: 'experience', country: 'Turkey', region: 'Europe', nearestCity: 'Kayseri', description: 'Hundreds of balloons rising over fairy chimneys at sunrise — utterly surreal' },
  { name: 'Istanbul FinTech Week', type: 'conference', country: 'Turkey', region: 'Europe', category: 'fintech', when: 'September', nearestCity: 'Istanbul', description: 'Turkey\'s leading fintech conference — bridging Europe and MENA' },

  // ESTONIA
  { name: 'Tallinn', type: 'city', country: 'Estonia', region: 'Europe', lat: 59.4370, lng: 24.7536 },
  { name: 'Tartu', type: 'city', country: 'Estonia', region: 'Europe', lat: 58.3780, lng: 26.7290 },
  { name: 'Latitude59', type: 'conference', country: 'Estonia', region: 'Europe', category: 'tech', when: 'May', nearestCity: 'Tallinn', description: 'Estonia\'s flagship startup and tech conference — e-residency hub' },

  // CZECH REPUBLIC
  { name: 'Prague', type: 'city', country: 'Czech Republic', region: 'Europe', lat: 50.0755, lng: 14.4378 },
  { name: 'Brno', type: 'city', country: 'Czech Republic', region: 'Europe', lat: 49.1951, lng: 16.6068 },

  // HUNGARY
  { name: 'Budapest', type: 'city', country: 'Hungary', region: 'Europe', lat: 47.4979, lng: 19.0402 },
  { name: 'Sziget Festival', type: 'festival', country: 'Hungary', region: 'Europe', category: 'music', when: 'August', nearestCity: 'Budapest', description: 'Island of Freedom — week-long festival on Óbuda Island, 500K+ attendees' },
  { name: 'Budapest Thermal Baths', type: 'experience', country: 'Hungary', region: 'Europe', nearestCity: 'Budapest', description: 'City of Spas — historic thermal baths including Széchenyi (Europe\'s largest)' },

  // NORWAY
  { name: 'Oslo', type: 'city', country: 'Norway', region: 'Europe', lat: 59.9139, lng: 10.7522 },
  { name: 'Bergen', type: 'city', country: 'Norway', region: 'Europe', lat: 60.3913, lng: 5.3221 },
  { name: 'Tromsø', type: 'city', country: 'Norway', region: 'Europe', lat: 69.6492, lng: 18.9553 },
  { name: 'Hemsedal', type: 'ski', country: 'Norway', region: 'Europe', season: 'Nov-May', nearestCity: 'Oslo', description: 'Scandinavia\'s Alps — Norway\'s most popular resort, reliable snow' },
  { name: 'Trysil', type: 'ski', country: 'Norway', region: 'Europe', season: 'Nov-Apr', nearestCity: 'Oslo', description: 'Norway\'s largest ski resort — 71 slopes, great for families' },
  { name: 'Northern Lights from Tromsø', type: 'experience', country: 'Norway', region: 'Europe', when: 'Sep-Mar', nearestCity: 'Tromsø', description: 'Best place on Earth to see the Aurora Borealis — 69°N latitude' },
  { name: 'Norwegian Fjords', type: 'experience', country: 'Norway', region: 'Europe', nearestCity: 'Bergen', description: 'UNESCO World Heritage fjords — dramatic waterfalls and cliffs from the water' },

  // SWEDEN
  { name: 'Stockholm', type: 'city', country: 'Sweden', region: 'Europe', lat: 59.3293, lng: 18.0686 },
  { name: 'Åre', type: 'ski', country: 'Sweden', region: 'Europe', season: 'Nov-May', nearestCity: 'Stockholm', description: 'Sweden\'s premier resort — hosted Alpine World Ski Championships, vibrant après scene' },
  { name: 'Stockholm FinTech Week', type: 'conference', country: 'Sweden', region: 'Europe', category: 'fintech', when: 'February', nearestCity: 'Stockholm', description: 'Nordic fintech hub conference — home of Klarna, iZettle, Trustly' },
  { name: 'ICEHOTEL', type: 'experience', country: 'Sweden', region: 'Europe', when: 'Dec-Apr', nearestCity: 'Kiruna', description: 'Sleep in a hotel made entirely of ice — rebuilt every winter since 1989' },

  // ICELAND
  { name: 'Reykjavik', type: 'city', country: 'Iceland', region: 'Europe', lat: 64.1466, lng: -21.9426 },
  { name: 'Iceland Airwaves', type: 'festival', country: 'Iceland', region: 'Europe', category: 'music', when: 'November', nearestCity: 'Reykjavik', description: 'Indie music festival in the world\'s northernmost capital — intimate venue shows' },
  { name: 'Blue Lagoon', type: 'experience', country: 'Iceland', region: 'Europe', nearestCity: 'Reykjavik', description: 'Geothermal spa in a lava field — milky blue waters at 37-39°C' },
  { name: 'Golden Circle', type: 'experience', country: 'Iceland', region: 'Europe', nearestCity: 'Reykjavik', description: 'Geysers, waterfalls, and tectonic plates — Iceland\'s essential day trip' },
];

// =============================================================================
// EAST ASIA
// =============================================================================

const eastAsia: Destination[] = [
  // JAPAN
  { name: 'Tokyo', type: 'city', country: 'Japan', region: 'East Asia', lat: 35.6762, lng: 139.6503 },
  { name: 'Osaka', type: 'city', country: 'Japan', region: 'East Asia', lat: 34.6937, lng: 135.5023 },
  { name: 'Kyoto', type: 'city', country: 'Japan', region: 'East Asia', lat: 35.0116, lng: 135.7681 },
  { name: 'Niseko', type: 'ski', country: 'Japan', region: 'East Asia', season: 'Dec-Apr', nearestCity: 'Sapporo', description: 'World\'s best powder — 15+ meters of annual snowfall, legendary tree runs' },
  { name: 'Hakuba', type: 'ski', country: 'Japan', region: 'East Asia', season: 'Dec-Mar', nearestCity: 'Tokyo', description: 'Host of 1998 Winter Olympics — 10 resorts, incredible snow, 3hrs from Tokyo' },
  { name: 'Furano', type: 'ski', country: 'Japan', region: 'East Asia', season: 'Dec-Mar', nearestCity: 'Sapporo', description: 'Hokkaido powder without the crowds — pristine off-piste, lavender fields in summer' },
  { name: 'Fuji Rock Festival', type: 'festival', country: 'Japan', region: 'East Asia', category: 'music', when: 'July', nearestCity: 'Tokyo', description: 'Japan\'s largest outdoor music festival — in the mountains of Niigata' },
  { name: 'Cherry Blossom Season', type: 'experience', country: 'Japan', region: 'East Asia', when: 'March-April', nearestCity: 'Tokyo', description: 'Sakura season — millions gather for hanami (flower viewing) across Japan' },
  { name: 'Fushimi Inari Shrine', type: 'experience', country: 'Japan', region: 'East Asia', nearestCity: 'Kyoto', description: '10,000 vermilion torii gates winding up a mountain — Kyoto\'s most iconic sight' },
  { name: 'FIN/SUM (FinTech Summit)', type: 'conference', country: 'Japan', region: 'East Asia', category: 'fintech', when: 'March', nearestCity: 'Tokyo', description: 'Japan\'s largest fintech conference — co-hosted by Japan FSA and Nikkei' },

  // SOUTH KOREA
  { name: 'Seoul', type: 'city', country: 'South Korea', region: 'East Asia', lat: 37.5665, lng: 126.9780 },
  { name: 'Busan', type: 'city', country: 'South Korea', region: 'East Asia', lat: 35.1796, lng: 129.0756 },
  { name: 'Jeju', type: 'city', country: 'South Korea', region: 'East Asia', lat: 33.4996, lng: 126.5312 },
  { name: 'Yongpyong', type: 'ski', country: 'South Korea', region: 'East Asia', season: 'Nov-Mar', nearestCity: 'Seoul', description: 'Korea\'s largest and oldest resort — hosted 2018 Winter Olympics alpine events' },
  { name: 'Phoenix Park', type: 'ski', country: 'South Korea', region: 'East Asia', season: 'Nov-Mar', nearestCity: 'Seoul', description: 'Popular Seoul getaway resort — 2018 Olympic freestyle/snowboard venue' },
  { name: 'Busan International Film Festival', type: 'festival', country: 'South Korea', region: 'East Asia', category: 'film', when: 'October', nearestCity: 'Busan', description: 'Asia\'s most prestigious film festival — the Asian Cannes' },
  { name: 'Korea Fintech Week', type: 'conference', country: 'South Korea', region: 'East Asia', category: 'fintech', when: 'September', nearestCity: 'Seoul', description: 'Korea\'s official government-backed fintech event' },
  { name: 'Seoul Lantern Festival', type: 'festival', country: 'South Korea', region: 'East Asia', category: 'cultural', when: 'November', nearestCity: 'Seoul', description: 'Thousands of illuminated lanterns along the Cheonggyecheon stream' },

  // TAIWAN
  { name: 'Taipei', type: 'city', country: 'Taiwan', region: 'East Asia', lat: 25.0330, lng: 121.5654 },
  { name: 'Kaohsiung', type: 'city', country: 'Taiwan', region: 'East Asia', lat: 22.6273, lng: 120.3014 },
  { name: 'Taichung', type: 'city', country: 'Taiwan', region: 'East Asia', lat: 24.1477, lng: 120.6736 },
  { name: 'Pingxi Sky Lantern Festival', type: 'festival', country: 'Taiwan', region: 'East Asia', category: 'cultural', when: 'February', nearestCity: 'Taipei', description: 'Thousands of paper lanterns released into the night sky — one of the world\'s most magical sights' },
];

// =============================================================================
// MIDDLE EAST & AFRICA
// =============================================================================

const middleEastAfrica: Destination[] = [
  // UAE
  { name: 'Dubai', type: 'city', country: 'UAE', region: 'Middle East & Africa', lat: 25.2048, lng: 55.2708 },
  { name: 'Abu Dhabi', type: 'city', country: 'UAE', region: 'Middle East & Africa', lat: 24.4539, lng: 54.3773 },
  { name: 'Dubai FinTech Summit', type: 'conference', country: 'UAE', region: 'Middle East & Africa', category: 'fintech', when: 'May', nearestCity: 'Dubai', description: 'MENA\'s premier fintech event — at Dubai International Financial Centre' },
  { name: 'Abu Dhabi F1 Grand Prix', type: 'event', country: 'UAE', region: 'Middle East & Africa', category: 'cultural', when: 'December', nearestCity: 'Abu Dhabi', description: 'Season finale F1 race at Yas Marina — twilight race under the lights' },
  { name: 'Burj Khalifa', type: 'experience', country: 'UAE', region: 'Middle East & Africa', nearestCity: 'Dubai', description: 'World\'s tallest building (828m) — observation deck at 555m above the desert' },
  { name: 'Ski Dubai', type: 'ski', country: 'UAE', region: 'Middle East & Africa', season: 'Year-round', nearestCity: 'Dubai', description: 'Indoor ski resort in a shopping mall — 22,500 sqm of snow in the desert' },

  // SOUTH AFRICA
  { name: 'Cape Town', type: 'city', country: 'South Africa', region: 'Middle East & Africa', lat: -33.9249, lng: 18.4241 },
  { name: 'Johannesburg', type: 'city', country: 'South Africa', region: 'Middle East & Africa', lat: -26.2041, lng: 28.0473 },
  { name: 'Durban', type: 'city', country: 'South Africa', region: 'Middle East & Africa', lat: -29.8587, lng: 31.0218 },
  { name: 'Cape Town International Jazz Festival', type: 'festival', country: 'South Africa', region: 'Middle East & Africa', category: 'music', when: 'March', nearestCity: 'Cape Town', description: 'Africa\'s grandest gathering of jazz — 40+ artists over 2 days' },
  { name: 'Table Mountain', type: 'experience', country: 'South Africa', region: 'Middle East & Africa', nearestCity: 'Cape Town', description: 'New Seven Natural Wonders — cable car to the flat summit overlooking the Atlantic' },
  { name: 'Kruger National Park Safari', type: 'experience', country: 'South Africa', region: 'Middle East & Africa', nearestCity: 'Johannesburg', description: 'Big Five safari — one of Africa\'s largest game reserves' },

  // MOROCCO
  { name: 'Marrakech', type: 'city', country: 'Morocco', region: 'Middle East & Africa', lat: 31.6295, lng: -7.9811 },
  { name: 'Essaouira', type: 'city', country: 'Morocco', region: 'Middle East & Africa', lat: 31.5085, lng: -9.7595 },
  { name: 'Casablanca', type: 'city', country: 'Morocco', region: 'Middle East & Africa', lat: 33.5731, lng: -7.5898 },
  { name: 'Oukaimeden', type: 'ski', country: 'Morocco', region: 'Middle East & Africa', season: 'Dec-Mar', nearestCity: 'Marrakech', description: 'Africa\'s highest ski resort — ski the Atlas Mountains, 1 hour from Marrakech' },
  { name: 'Gnaoua World Music Festival', type: 'festival', country: 'Morocco', region: 'Middle East & Africa', category: 'music', when: 'June', nearestCity: 'Essaouira', description: 'Gnaoua trance music meets world music — free beachside performances' },
  { name: 'Sahara Desert Camp', type: 'experience', country: 'Morocco', region: 'Middle East & Africa', nearestCity: 'Marrakech', description: 'Overnight in luxury Sahara camp — camel trek, dunes, Milky Way with zero light pollution' },
  { name: 'Jemaa el-Fnaa', type: 'experience', country: 'Morocco', region: 'Middle East & Africa', nearestCity: 'Marrakech', description: 'UNESCO World Heritage square — snake charmers, storytellers, food stalls after dark' },

  // KENYA
  { name: 'Nairobi', type: 'city', country: 'Kenya', region: 'Middle East & Africa', lat: -1.2921, lng: 36.8219 },
  { name: 'Mombasa', type: 'city', country: 'Kenya', region: 'Middle East & Africa', lat: -4.0435, lng: 39.6682 },
  { name: 'Great Wildebeest Migration', type: 'experience', country: 'Kenya', region: 'Middle East & Africa', when: 'July-October', nearestCity: 'Nairobi', description: 'Two million animals crossing the Mara River — nature\'s greatest spectacle' },

  // EGYPT
  { name: 'Cairo', type: 'city', country: 'Egypt', region: 'Middle East & Africa', lat: 30.0444, lng: 31.2357 },
  { name: 'Pyramids of Giza', type: 'experience', country: 'Egypt', region: 'Middle East & Africa', nearestCity: 'Cairo', description: 'Last surviving Ancient Wonder of the World — 4,500 years old' },

  // TANZANIA
  { name: 'Mount Kilimanjaro', type: 'experience', country: 'Tanzania', region: 'Middle East & Africa', description: 'Africa\'s highest peak (5,895m) — the world\'s tallest free-standing mountain' },
];

// =============================================================================
// NORTH AMERICA
// =============================================================================

const northAmerica: Destination[] = [
  // USA
  { name: 'Los Angeles', type: 'city', country: 'USA', region: 'North America', lat: 34.0522, lng: -118.2437 },
  { name: 'Miami', type: 'city', country: 'USA', region: 'North America', lat: 25.7617, lng: -80.1918 },
  { name: 'Austin', type: 'city', country: 'USA', region: 'North America', lat: 30.2672, lng: -97.7431 },
  { name: 'New York City', type: 'city', country: 'USA', region: 'North America', lat: 40.7128, lng: -74.0060 },
  { name: 'Aspen Snowmass', type: 'ski', country: 'USA', region: 'North America', season: 'Nov-Apr', nearestCity: 'Denver', description: '4 mountains, 5,500+ acres — the most famous ski town in America' },
  { name: 'Vail', type: 'ski', country: 'USA', region: 'North America', season: 'Nov-Apr', nearestCity: 'Denver', description: 'Largest single-mountain ski area in the US — 5,317 acres, legendary back bowls' },
  { name: 'Park City / Deer Valley', type: 'ski', country: 'USA', region: 'North America', season: 'Nov-Apr', nearestCity: 'Salt Lake City', description: 'Host of 2002 Olympics — 7,300+ acres combined, world-class Utah powder' },
  { name: 'Jackson Hole', type: 'ski', country: 'USA', region: 'North America', season: 'Dec-Apr', nearestCity: 'Jackson', description: 'Expert\'s paradise — 4,139ft vertical, Corbet\'s Couloir, Grand Teton backdrop' },
  { name: 'Mammoth Mountain', type: 'ski', country: 'USA', region: 'North America', season: 'Nov-Jun', nearestCity: 'Los Angeles', description: 'California\'s highest resort — 400" annual snowfall, open until June, 5hrs from LA' },
  { name: 'Coachella', type: 'festival', country: 'USA', region: 'North America', category: 'music', when: 'April (2 weekends)', nearestCity: 'Los Angeles', description: 'World\'s most recognized music and culture festival — the desert\'s fashion runway' },
  { name: 'SXSW', type: 'conference', country: 'USA', region: 'North America', category: 'tech', when: 'March', nearestCity: 'Austin', description: 'Music + Film + Interactive mega-conference — where tech meets culture' },
  { name: 'Ultra Music Festival', type: 'festival', country: 'USA', region: 'North America', category: 'music', when: 'March', nearestCity: 'Miami', description: 'Premier EDM festival at Bayfront Park — kicks off the global festival season' },
  { name: 'Lollapalooza', type: 'festival', country: 'USA', region: 'North America', category: 'music', when: 'August', nearestCity: 'Chicago', description: '8 stages in Grant Park — rock, hip-hop, EDM, alternative across 4 days' },
  { name: 'Austin City Limits', type: 'festival', country: 'USA', region: 'North America', category: 'music', when: 'October', nearestCity: 'Austin', description: '2 weekends in Zilker Park — family-friendly, genre-spanning, inspired by the TV show' },
  { name: 'Burning Man', type: 'festival', country: 'USA', region: 'North America', category: 'art', when: 'August-September', nearestCity: 'Reno', description: 'Radical self-expression in the Nevada desert — art, community, temporary city of 70K' },
  { name: 'Art Basel Miami Beach', type: 'festival', country: 'USA', region: 'North America', category: 'art', when: 'December', nearestCity: 'Miami', description: 'Americas edition of the world\'s premier art fair — art, parties, Design District' },
  { name: 'Money 20/20 USA', type: 'conference', country: 'USA', region: 'North America', category: 'fintech', when: 'October', nearestCity: 'Las Vegas', description: 'World\'s largest fintech and payments event — 13,000+ attendees in Vegas' },
  { name: 'Finovate', type: 'conference', country: 'USA', region: 'North America', category: 'fintech', when: 'September (Fall) / March (Spring)', nearestCity: 'New York City', description: 'Fintech demo day — 7-minute live product demos, no slides allowed' },
  { name: 'Grand Canyon', type: 'experience', country: 'USA', region: 'North America', description: 'One of the world\'s great natural wonders — 277 miles long, 1 mile deep' },
  { name: 'New Year\'s Eve in Times Square', type: 'experience', country: 'USA', region: 'North America', when: 'December 31', nearestCity: 'New York City', description: 'The ball drop watched by 1 billion people worldwide' },

  // CANADA
  { name: 'Toronto', type: 'city', country: 'Canada', region: 'North America', lat: 43.6532, lng: -79.3832 },
  { name: 'Vancouver', type: 'city', country: 'Canada', region: 'North America', lat: 49.2827, lng: -123.1207 },
  { name: 'Montreal', type: 'city', country: 'Canada', region: 'North America', lat: 45.5017, lng: -73.5673 },
  { name: 'Whistler Blackcomb', type: 'ski', country: 'Canada', region: 'North America', season: 'Nov-May', nearestCity: 'Vancouver', description: 'Largest ski resort in North America — 8,171 acres, hosted 2010 Winter Olympics' },
  { name: 'Lake Louise', type: 'ski', country: 'Canada', region: 'North America', season: 'Nov-May', nearestCity: 'Calgary', description: 'Stunning Rocky Mountain setting — turquoise lake below, 4,200 acres of terrain' },
  { name: 'Mont-Tremblant', type: 'ski', country: 'Canada', region: 'North America', season: 'Nov-Apr', nearestCity: 'Montreal', description: 'Eastern Canada\'s premier resort — colorful European-style village, great après' },
  { name: 'Montreal Jazz Festival', type: 'festival', country: 'Canada', region: 'North America', category: 'music', when: 'June-July', nearestCity: 'Montreal', description: 'World\'s largest jazz festival — 3,000+ artists, many free outdoor concerts' },
  { name: 'Toronto International Film Festival (TIFF)', type: 'festival', country: 'Canada', region: 'North America', category: 'film', when: 'September', nearestCity: 'Toronto', description: 'North America\'s most important film festival — Oscar predictor, 480K+ attendees' },
  { name: 'Collision Conference', type: 'conference', country: 'Canada', region: 'North America', category: 'tech', when: 'June', nearestCity: 'Toronto', description: 'North America in the Web Summit family — 40,000+ attendees, strong fintech track' },
  { name: 'Niagara Falls', type: 'experience', country: 'Canada', region: 'North America', nearestCity: 'Toronto', description: 'One of the world\'s most powerful waterfalls — boat rides into the mist' },
  { name: 'Banff & the Canadian Rockies', type: 'experience', country: 'Canada', region: 'North America', nearestCity: 'Calgary', description: 'UNESCO World Heritage — turquoise lakes, glaciers, and elk in Canada\'s most beautiful park' },
];

// =============================================================================
// OCEANIA
// =============================================================================

const oceania: Destination[] = [
  // AUSTRALIA
  { name: 'Sydney', type: 'city', country: 'Australia', region: 'Oceania', lat: -33.8688, lng: 151.2093 },
  { name: 'Melbourne', type: 'city', country: 'Australia', region: 'Oceania', lat: -37.8136, lng: 144.9631 },
  { name: 'Byron Bay', type: 'city', country: 'Australia', region: 'Oceania', lat: -28.6474, lng: 153.6020 },
  { name: 'Thredbo', type: 'ski', country: 'Australia', region: 'Oceania', season: 'Jun-Oct', nearestCity: 'Sydney', description: 'Australia\'s best resort — highest vertical drop in the country, vibrant village' },
  { name: 'Perisher', type: 'ski', country: 'Australia', region: 'Oceania', season: 'Jun-Oct', nearestCity: 'Sydney', description: 'Australia\'s largest resort — 1,245 hectares across 4 linked resort areas' },
  { name: 'Vivid Sydney', type: 'festival', country: 'Australia', region: 'Oceania', category: 'art', when: 'May-June', nearestCity: 'Sydney', description: 'Light, music, and ideas festival — the Sydney Opera House illuminated with projections' },
  { name: 'Splendour in the Grass', type: 'festival', country: 'Australia', region: 'Oceania', category: 'music', when: 'July', nearestCity: 'Byron Bay', description: 'Australia\'s premier music festival — 3 days of diverse music near Byron Bay' },
  { name: 'Great Barrier Reef', type: 'experience', country: 'Australia', region: 'Oceania', description: 'World\'s largest coral reef system — snorkel/dive 2,900+ individual reefs' },
  { name: 'Sydney Opera House', type: 'experience', country: 'Australia', region: 'Oceania', nearestCity: 'Sydney', description: 'UNESCO World Heritage — one of the most iconic buildings of the 20th century' },
  { name: 'Uluru (Ayers Rock)', type: 'experience', country: 'Australia', region: 'Oceania', description: 'Sacred Aboriginal site — massive sandstone monolith glowing red at sunset in the outback' },

  // NEW ZEALAND
  { name: 'Auckland', type: 'city', country: 'New Zealand', region: 'Oceania', lat: -36.8485, lng: 174.7633 },
  { name: 'Wellington', type: 'city', country: 'New Zealand', region: 'Oceania', lat: -41.2865, lng: 174.7762 },
  { name: 'Queenstown', type: 'city', country: 'New Zealand', region: 'Oceania', lat: -45.0312, lng: 168.6626 },
  { name: 'The Remarkables', type: 'ski', country: 'New Zealand', region: 'Oceania', season: 'Jun-Oct', nearestCity: 'Queenstown', description: 'Stunning mountain range above Queenstown — adventure capital meets ski terrain' },
  { name: 'Cardrona', type: 'ski', country: 'New Zealand', region: 'Oceania', season: 'Jun-Oct', nearestCity: 'Queenstown', description: 'NZ\'s most popular resort — great parks, 6,000ft summit, family-friendly' },
  { name: 'Milford Sound', type: 'experience', country: 'New Zealand', region: 'Oceania', nearestCity: 'Queenstown', description: 'Eighth Wonder of the World (Kipling) — fiord with waterfalls, dolphins, and seals' },
  { name: 'Hobbiton', type: 'experience', country: 'New Zealand', region: 'Oceania', nearestCity: 'Auckland', description: 'Lord of the Rings movie set — the Shire brought to life on a working farm' },
];

// =============================================================================
// SOUTH ASIA / INDIA
// =============================================================================

const southAsia: Destination[] = [
  { name: 'Mumbai', type: 'city', country: 'India', region: 'South Asia', lat: 19.0760, lng: 72.8777 },
  { name: 'Goa', type: 'city', country: 'India', region: 'South Asia', lat: 15.2993, lng: 74.1240 },
  { name: 'Bangalore', type: 'city', country: 'India', region: 'South Asia', lat: 12.9716, lng: 77.5946 },
  { name: 'Gulmarg', type: 'ski', country: 'India', region: 'South Asia', season: 'Dec-Mar', nearestCity: 'Srinagar', description: 'World\'s highest gondola ski lift (3,980m) — Himalayan powder, mind-blowing views' },
  { name: 'Auli', type: 'ski', country: 'India', region: 'South Asia', season: 'Dec-Mar', nearestCity: 'Delhi', description: 'Skiing with Nanda Devi views — one of India\'s premier winter sports destinations' },
  { name: 'Holi Festival', type: 'festival', country: 'India', region: 'South Asia', category: 'cultural', when: 'March', nearestCity: 'Delhi', description: 'Festival of Colors — millions throw colored powder in one of humanity\'s most joyous celebrations' },
  { name: 'Diwali', type: 'festival', country: 'India', region: 'South Asia', category: 'cultural', when: 'October-November', nearestCity: 'Delhi', description: 'Festival of Lights — entire country illuminated with lamps, fireworks, and sweets' },
  { name: 'Sunburn Festival', type: 'festival', country: 'India', region: 'South Asia', category: 'music', when: 'December', nearestCity: 'Goa', description: 'Asia\'s largest electronic music festival — beach stages in Goa' },
  { name: 'Global Fintech Fest', type: 'conference', country: 'India', region: 'South Asia', category: 'fintech', when: 'August', nearestCity: 'Mumbai', description: 'One of world\'s largest fintech conferences — India\'s booming digital payments ecosystem' },
  { name: 'Taj Mahal', type: 'experience', country: 'India', region: 'South Asia', nearestCity: 'Delhi', description: 'New Seven Wonders of the World — white marble mausoleum, symbol of eternal love' },
];

// =============================================================================
// COMBINED EXPORT
// =============================================================================

export const ALL_DESTINATIONS: Destination[] = [
  ...southeastAsia,
  ...latinAmerica,
  ...europe,
  ...eastAsia,
  ...middleEastAfrica,
  ...northAmerica,
  ...oceania,
  ...southAsia,
];

// Helper functions for filtering
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

/** Find what's happening at/near a destination during specific dates */
export const getEventsNearCity = (cityName: string, country: string) => {
  return ALL_DESTINATIONS.filter(d =>
    d.country === country &&
    (d.type === 'festival' || d.type === 'conference' || d.type === 'event' || d.type === 'experience' || d.type === 'ski') &&
    (d.nearestCity === cityName || !d.nearestCity)
  );
};

/** Search across all destinations by name */
export const searchDestinations = (query: string, limit: number = 12) => {
  const q = query.toLowerCase();
  const results = ALL_DESTINATIONS.filter(d =>
    d.name.toLowerCase().includes(q) ||
    d.country.toLowerCase().includes(q) ||
    d.region.toLowerCase().includes(q) ||
    (d.description && d.description.toLowerCase().includes(q))
  );
  return results.slice(0, limit);
};

// =============================================================================
// STATS
// =============================================================================
// Cities: ~95 across 35+ countries
// Ski Resorts: ~45 across 20 countries
// Festivals: ~50+ music, art, cultural, film
// Conferences: ~20+ fintech/tech
// Bucket List Experiences: ~40+
// TOTAL ENTRIES: ~250+
// =============================================================================

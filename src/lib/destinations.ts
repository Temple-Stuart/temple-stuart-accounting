// ═══════════════════════════════════════════════════════════════
// Destinations Database — cities, ski resorts, festivals & events
// ═══════════════════════════════════════════════════════════════

export type DestinationType = 'city' | 'ski' | 'festival';

export interface Destination {
  name: string;
  country: string;
  type: DestinationType;
  region?: string;
  tags?: string[];
}

// ─── Cities ──────────────────────────────────────────────────

const CITIES: Destination[] = [
  { name: 'Bali', country: 'Indonesia', type: 'city', region: 'Asia', tags: ['surf', 'beach', 'culture'] },
  { name: 'Bangkok', country: 'Thailand', type: 'city', region: 'Asia', tags: ['food', 'culture', 'nightlife'] },
  { name: 'Barcelona', country: 'Spain', type: 'city', region: 'Europe', tags: ['beach', 'culture', 'food'] },
  { name: 'Berlin', country: 'Germany', type: 'city', region: 'Europe', tags: ['nightlife', 'culture', 'tech'] },
  { name: 'Bogotá', country: 'Colombia', type: 'city', region: 'South America', tags: ['culture', 'food', 'nightlife'] },
  { name: 'Buenos Aires', country: 'Argentina', type: 'city', region: 'South America', tags: ['food', 'culture', 'nightlife'] },
  { name: 'Cape Town', country: 'South Africa', type: 'city', region: 'Africa', tags: ['surf', 'adventure', 'wine'] },
  { name: 'Cartagena', country: 'Colombia', type: 'city', region: 'South America', tags: ['beach', 'culture', 'food'] },
  { name: 'Chiang Mai', country: 'Thailand', type: 'city', region: 'Asia', tags: ['digital nomad', 'food', 'culture'] },
  { name: 'Copenhagen', country: 'Denmark', type: 'city', region: 'Europe', tags: ['food', 'design', 'cycling'] },
  { name: 'Da Nang', country: 'Vietnam', type: 'city', region: 'Asia', tags: ['beach', 'surf', 'food'] },
  { name: 'Dubai', country: 'UAE', type: 'city', region: 'Middle East', tags: ['luxury', 'adventure', 'shopping'] },
  { name: 'Dublin', country: 'Ireland', type: 'city', region: 'Europe', tags: ['culture', 'nightlife', 'food'] },
  { name: 'Florence', country: 'Italy', type: 'city', region: 'Europe', tags: ['food', 'culture', 'wine'] },
  { name: 'Havana', country: 'Cuba', type: 'city', region: 'Caribbean', tags: ['culture', 'music', 'beach'] },
  { name: 'Ho Chi Minh City', country: 'Vietnam', type: 'city', region: 'Asia', tags: ['food', 'culture', 'nightlife'] },
  { name: 'Honolulu', country: 'USA', type: 'city', region: 'North America', tags: ['surf', 'beach', 'hiking'] },
  { name: 'Istanbul', country: 'Turkey', type: 'city', region: 'Europe', tags: ['culture', 'food', 'history'] },
  { name: 'Lisbon', country: 'Portugal', type: 'city', region: 'Europe', tags: ['surf', 'food', 'nightlife'] },
  { name: 'London', country: 'UK', type: 'city', region: 'Europe', tags: ['culture', 'food', 'business'] },
  { name: 'Los Angeles', country: 'USA', type: 'city', region: 'North America', tags: ['beach', 'surf', 'food'] },
  { name: 'Marrakech', country: 'Morocco', type: 'city', region: 'Africa', tags: ['culture', 'food', 'adventure'] },
  { name: 'Medellín', country: 'Colombia', type: 'city', region: 'South America', tags: ['digital nomad', 'nightlife', 'culture'] },
  { name: 'Melbourne', country: 'Australia', type: 'city', region: 'Oceania', tags: ['food', 'surf', 'culture'] },
  { name: 'Mexico City', country: 'Mexico', type: 'city', region: 'North America', tags: ['food', 'culture', 'nightlife'] },
  { name: 'Miami', country: 'USA', type: 'city', region: 'North America', tags: ['beach', 'nightlife', 'food'] },
  { name: 'Montreal', country: 'Canada', type: 'city', region: 'North America', tags: ['food', 'culture', 'festivals'] },
  { name: 'Mykonos', country: 'Greece', type: 'city', region: 'Europe', tags: ['beach', 'nightlife', 'luxury'] },
  { name: 'Nairobi', country: 'Kenya', type: 'city', region: 'Africa', tags: ['safari', 'adventure', 'culture'] },
  { name: 'New York', country: 'USA', type: 'city', region: 'North America', tags: ['food', 'culture', 'business'] },
  { name: 'Nice', country: 'France', type: 'city', region: 'Europe', tags: ['beach', 'food', 'culture'] },
  { name: 'Nosara', country: 'Costa Rica', type: 'city', region: 'Central America', tags: ['surf', 'yoga', 'beach'] },
  { name: 'Oaxaca', country: 'Mexico', type: 'city', region: 'North America', tags: ['food', 'culture', 'mezcal'] },
  { name: 'Paris', country: 'France', type: 'city', region: 'Europe', tags: ['food', 'culture', 'fashion'] },
  { name: 'Porto', country: 'Portugal', type: 'city', region: 'Europe', tags: ['wine', 'food', 'surf'] },
  { name: 'Prague', country: 'Czech Republic', type: 'city', region: 'Europe', tags: ['nightlife', 'culture', 'food'] },
  { name: 'Queenstown', country: 'New Zealand', type: 'city', region: 'Oceania', tags: ['adventure', 'ski', 'hiking'] },
  { name: 'Reykjavik', country: 'Iceland', type: 'city', region: 'Europe', tags: ['adventure', 'nature', 'culture'] },
  { name: 'Rio de Janeiro', country: 'Brazil', type: 'city', region: 'South America', tags: ['beach', 'surf', 'nightlife'] },
  { name: 'Rome', country: 'Italy', type: 'city', region: 'Europe', tags: ['food', 'culture', 'history'] },
  { name: 'San Francisco', country: 'USA', type: 'city', region: 'North America', tags: ['tech', 'food', 'culture'] },
  { name: 'San Juan', country: 'Puerto Rico', type: 'city', region: 'Caribbean', tags: ['beach', 'surf', 'nightlife'] },
  { name: 'San Sebastián', country: 'Spain', type: 'city', region: 'Europe', tags: ['food', 'surf', 'culture'] },
  { name: 'Santiago', country: 'Chile', type: 'city', region: 'South America', tags: ['wine', 'food', 'culture'] },
  { name: 'Seoul', country: 'South Korea', type: 'city', region: 'Asia', tags: ['food', 'culture', 'tech'] },
  { name: 'Singapore', country: 'Singapore', type: 'city', region: 'Asia', tags: ['food', 'business', 'culture'] },
  { name: 'Split', country: 'Croatia', type: 'city', region: 'Europe', tags: ['beach', 'sailing', 'culture'] },
  { name: 'Sydney', country: 'Australia', type: 'city', region: 'Oceania', tags: ['surf', 'food', 'beach'] },
  { name: 'Taghazout', country: 'Morocco', type: 'city', region: 'Africa', tags: ['surf', 'yoga', 'beach'] },
  { name: 'Tenerife', country: 'Spain', type: 'city', region: 'Europe', tags: ['surf', 'hiking', 'beach'] },
  { name: 'Tokyo', country: 'Japan', type: 'city', region: 'Asia', tags: ['food', 'culture', 'tech'] },
  { name: 'Toronto', country: 'Canada', type: 'city', region: 'North America', tags: ['food', 'culture', 'business'] },
  { name: 'Tulum', country: 'Mexico', type: 'city', region: 'North America', tags: ['beach', 'yoga', 'nightlife'] },
  { name: 'Vancouver', country: 'Canada', type: 'city', region: 'North America', tags: ['ski', 'hiking', 'food'] },
  { name: 'Vienna', country: 'Austria', type: 'city', region: 'Europe', tags: ['culture', 'food', 'music'] },
  { name: 'Zanzibar', country: 'Tanzania', type: 'city', region: 'Africa', tags: ['beach', 'diving', 'culture'] },
  { name: 'Zürich', country: 'Switzerland', type: 'city', region: 'Europe', tags: ['finance', 'culture', 'ski'] },
];

// ─── Ski Resorts ─────────────────────────────────────────────

const SKI_RESORTS: Destination[] = [
  { name: 'Aspen', country: 'USA', type: 'ski', region: 'North America', tags: ['luxury', 'powder'] },
  { name: 'Big Sky', country: 'USA', type: 'ski', region: 'North America', tags: ['powder', 'uncrowded'] },
  { name: 'Chamonix', country: 'France', type: 'ski', region: 'Europe', tags: ['backcountry', 'expert'] },
  { name: 'Cortina d\'Ampezzo', country: 'Italy', type: 'ski', region: 'Europe', tags: ['dolomites', 'luxury'] },
  { name: 'Courchevel', country: 'France', type: 'ski', region: 'Europe', tags: ['luxury', 'family'] },
  { name: 'Hakuba', country: 'Japan', type: 'ski', region: 'Asia', tags: ['powder', 'culture'] },
  { name: 'Jackson Hole', country: 'USA', type: 'ski', region: 'North America', tags: ['expert', 'backcountry'] },
  { name: 'Kitzbühel', country: 'Austria', type: 'ski', region: 'Europe', tags: ['racing', 'tradition'] },
  { name: 'Mammoth Mountain', country: 'USA', type: 'ski', region: 'North America', tags: ['park', 'powder'] },
  { name: 'Niseko', country: 'Japan', type: 'ski', region: 'Asia', tags: ['powder', 'food'] },
  { name: 'Park City', country: 'USA', type: 'ski', region: 'North America', tags: ['family', 'terrain'] },
  { name: 'Portillo', country: 'Chile', type: 'ski', region: 'South America', tags: ['heli-skiing', 'summer ski'] },
  { name: 'St. Anton', country: 'Austria', type: 'ski', region: 'Europe', tags: ['freeride', 'après-ski'] },
  { name: 'St. Moritz', country: 'Switzerland', type: 'ski', region: 'Europe', tags: ['luxury', 'glacier'] },
  { name: 'Steamboat Springs', country: 'USA', type: 'ski', region: 'North America', tags: ['champagne powder', 'family'] },
  { name: 'Telluride', country: 'USA', type: 'ski', region: 'North America', tags: ['scenic', 'expert'] },
  { name: 'Val d\'Isère', country: 'France', type: 'ski', region: 'Europe', tags: ['expert', 'après-ski'] },
  { name: 'Verbier', country: 'Switzerland', type: 'ski', region: 'Europe', tags: ['freeride', 'expert'] },
  { name: 'Whistler', country: 'Canada', type: 'ski', region: 'North America', tags: ['terrain', 'village'] },
  { name: 'Zermatt', country: 'Switzerland', type: 'ski', region: 'Europe', tags: ['glacier', 'scenic'] },
];

// ─── Festivals & Events ─────────────────────────────────────

const FESTIVALS: Destination[] = [
  { name: 'Burning Man', country: 'USA', type: 'festival', region: 'North America', tags: ['art', 'community'] },
  { name: 'Carnival (Rio)', country: 'Brazil', type: 'festival', region: 'South America', tags: ['music', 'dance'] },
  { name: 'Coachella', country: 'USA', type: 'festival', region: 'North America', tags: ['music', 'art'] },
  { name: 'Day of the Dead (Oaxaca)', country: 'Mexico', type: 'festival', region: 'North America', tags: ['culture', 'tradition'] },
  { name: 'F1 Monaco Grand Prix', country: 'Monaco', type: 'festival', region: 'Europe', tags: ['racing', 'luxury'] },
  { name: 'Full Moon Party', country: 'Thailand', type: 'festival', region: 'Asia', tags: ['beach', 'party'] },
  { name: 'Glastonbury', country: 'UK', type: 'festival', region: 'Europe', tags: ['music', 'culture'] },
  { name: 'Holi Festival', country: 'India', type: 'festival', region: 'Asia', tags: ['culture', 'color'] },
  { name: 'La Tomatina', country: 'Spain', type: 'festival', region: 'Europe', tags: ['food', 'party'] },
  { name: 'Lollapalooza', country: 'USA', type: 'festival', region: 'North America', tags: ['music', 'culture'] },
  { name: 'Mardi Gras', country: 'USA', type: 'festival', region: 'North America', tags: ['music', 'party'] },
  { name: 'Oktoberfest', country: 'Germany', type: 'festival', region: 'Europe', tags: ['beer', 'culture'] },
  { name: 'Primavera Sound', country: 'Spain', type: 'festival', region: 'Europe', tags: ['music', 'indie'] },
  { name: 'Running of the Bulls', country: 'Spain', type: 'festival', region: 'Europe', tags: ['adventure', 'tradition'] },
  { name: 'Songkran', country: 'Thailand', type: 'festival', region: 'Asia', tags: ['water', 'culture'] },
  { name: 'Sonar', country: 'Spain', type: 'festival', region: 'Europe', tags: ['electronic', 'tech'] },
  { name: 'Tomorrowland', country: 'Belgium', type: 'festival', region: 'Europe', tags: ['electronic', 'music'] },
  { name: 'Ultra Music Festival', country: 'USA', type: 'festival', region: 'North America', tags: ['electronic', 'party'] },
];

// ─── Combined & Exports ─────────────────────────────────────

export const ALL_DESTINATIONS: Destination[] = [...CITIES, ...SKI_RESORTS, ...FESTIVALS];

export function searchDestinations(query: string, limit = 12): Destination[] {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();

  const scored = ALL_DESTINATIONS
    .map(d => {
      const nameLower = d.name.toLowerCase();
      const countryLower = d.country.toLowerCase();
      let score = 0;

      // Exact start of name — highest priority
      if (nameLower.startsWith(q)) score = 100;
      // Start of a word in name
      else if (nameLower.includes(' ' + q)) score = 80;
      // Substring in name
      else if (nameLower.includes(q)) score = 60;
      // Country match
      else if (countryLower.startsWith(q)) score = 40;
      else if (countryLower.includes(q)) score = 30;
      // Tag match
      else if (d.tags?.some(t => t.includes(q))) score = 20;
      else return null;

      // Boost: cities first, then ski, then festivals
      if (d.type === 'city') score += 3;
      else if (d.type === 'ski') score += 2;
      else score += 1;

      return { dest: d, score };
    })
    .filter(Boolean) as { dest: Destination; score: number }[];

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.dest);
}

export function getCities(): Destination[] {
  return CITIES;
}

export function getSkiResorts(): Destination[] {
  return SKI_RESORTS;
}

export function getFestivals(): Destination[] {
  return FESTIVALS;
}

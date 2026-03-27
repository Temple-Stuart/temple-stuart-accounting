// ─── Unified Travel Chart of Accounts ────────────────────────────────────────
// Single source of truth for all travel categories across the app:
// scanner, budget table, calendar legend, bookkeeping COA codes.

import { ACTIVITY_SEARCH_EXPANSIONS } from './activities';

export interface COACategory {
  label: string;
  color: string;
  bg: string;          // Tailwind bg class for calendar
  dot: string;         // Tailwind dot class for calendar
  badge: string;       // Tailwind badge class for calendar
  coaPersonal: string | null;
  coaBusiness: string | null;
  alwaysScan: boolean;
  googlePlacesType: string | null; // Google Places API type filter (lodging, restaurant, cafe, etc.)
  scanQueries: string[];
  interestSlugs?: string[];
  defaultFrequency: string; // per_night, per_visit, per_day, total
  vendorApi: string;        // which vendor API to use when committing
  optionType: string;       // optionType sent to vendor-commit
  multiDay: boolean;        // whether this category spans multiple days
}

export const TRAVEL_COA: Record<string, COACategory> = {
  flights: {
    label: 'Flights',
    color: '#9b59b6',
    bg: 'bg-purple-100', dot: 'bg-purple-400', badge: 'bg-purple-400',
    coaPersonal: 'P-9100', coaBusiness: 'B-9100',
    alwaysScan: false,
    googlePlacesType: null,
    scanQueries: [],
    defaultFrequency: 'total',
    vendorApi: 'flights', optionType: 'flight', multiDay: false,
  },
  accommodation: {
    label: 'Accommodation',
    color: '#3498db',
    bg: 'bg-blue-100', dot: 'bg-blue-400', badge: 'bg-blue-400',
    coaPersonal: 'P-9200', coaBusiness: 'B-9200',
    alwaysScan: true,
    googlePlacesType: 'lodging',
    scanQueries: ['hotel', 'hostel', 'guesthouse', 'boutique hotel', 'resort'],
    defaultFrequency: 'per_night',
    vendorApi: 'lodging', optionType: 'lodging', multiDay: true,
  },
  brunch_coffee: {
    label: 'Brunch & Coffee',
    color: '#f39c12',
    bg: 'bg-amber-100', dot: 'bg-amber-400', badge: 'bg-amber-400',
    coaPersonal: 'P-9310', coaBusiness: 'B-9310',
    alwaysScan: true,
    googlePlacesType: 'cafe',
    scanQueries: ['brunch', 'breakfast cafe', 'coffee shop', 'bakery', 'specialty coffee'],
    defaultFrequency: 'per_visit',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  dinner: {
    label: 'Dinner',
    color: '#e74c3c',
    bg: 'bg-red-100', dot: 'bg-red-400', badge: 'bg-red-400',
    coaPersonal: 'P-9320', coaBusiness: 'B-9320',
    alwaysScan: true,
    googlePlacesType: 'restaurant',
    scanQueries: ['dinner restaurant', 'fine dining', 'local restaurant', 'street food', 'seafood restaurant'],
    defaultFrequency: 'per_visit',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  business_meals: {
    label: 'Business Meals',
    color: '#8b4513',
    bg: 'bg-amber-100', dot: 'bg-amber-700', badge: 'bg-amber-700',
    coaPersonal: null, coaBusiness: 'B-9330',
    alwaysScan: false,
    googlePlacesType: 'restaurant',
    scanQueries: ['private dining', 'business lunch restaurant', 'upscale restaurant'],
    defaultFrequency: 'per_visit',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  sports_fitness: {
    label: 'Sports & Fitness',
    color: '#2ecc71',
    bg: 'bg-green-100', dot: 'bg-green-500', badge: 'bg-green-500',
    coaPersonal: 'P-9410', coaBusiness: null,
    alwaysScan: false,
    googlePlacesType: null,
    scanQueries: [],
    interestSlugs: ['surf', 'ski', 'snowboard', 'hike', 'bike', 'climb', 'dive', 'snorkel', 'kayak', 'yoga', 'skate', 'paraglide'],
    defaultFrequency: 'per_visit',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  arts_culture: {
    label: 'Arts & Culture',
    color: '#e67e22',
    bg: 'bg-orange-100', dot: 'bg-orange-400', badge: 'bg-orange-400',
    coaPersonal: 'P-9420', coaBusiness: null,
    alwaysScan: false,
    googlePlacesType: null,
    scanQueries: [],
    interestSlugs: ['art_museums', 'history_museums', 'temples', 'unesco_sites', 'street_art', 'architecture', 'photography', 'pottery', 'craft_workshop', 'cooking_class', 'food_tour', 'wine_tasting', 'coffee_tour', 'zoos', 'aquariums'],
    defaultFrequency: 'per_visit',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  nightlife: {
    label: 'Nightlife & Entertainment',
    color: '#ff69b4',
    bg: 'bg-pink-100', dot: 'bg-pink-400', badge: 'bg-pink-400',
    coaPersonal: 'P-9430', coaBusiness: null,
    alwaysScan: false,
    googlePlacesType: 'bar',
    scanQueries: [],
    interestSlugs: ['clubs', 'rooftop_bars', 'live_music', 'jazz', 'comedy', 'dinner_shows'],
    defaultFrequency: 'per_visit',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  festivals: {
    label: 'Festivals & Events',
    color: '#ff4500',
    bg: 'bg-orange-100', dot: 'bg-orange-500', badge: 'bg-orange-500',
    coaPersonal: 'P-9440', coaBusiness: null,
    alwaysScan: false,
    googlePlacesType: null,
    scanQueries: [],
    interestSlugs: ['music', 'art', 'film', 'sports', 'food___wine', 'cultural', 'fashion'],
    defaultFrequency: 'per_visit',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  conferences: {
    label: 'Conferences & Summits',
    color: '#1a1a2e',
    bg: 'bg-slate-100', dot: 'bg-slate-700', badge: 'bg-slate-700',
    coaPersonal: null, coaBusiness: 'B-9500',
    alwaysScan: false,
    googlePlacesType: null,
    scanQueries: [],
    interestSlugs: ['fintech', 'tech', 'startup', 'business', 'marketing', 'crypto', 'accounting'],
    defaultFrequency: 'per_visit',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  coworking: {
    label: 'Coworking',
    color: '#4a90d9',
    bg: 'bg-indigo-100', dot: 'bg-indigo-400', badge: 'bg-indigo-400',
    coaPersonal: 'P-9510', coaBusiness: 'B-9510',
    alwaysScan: false,
    googlePlacesType: null,
    scanQueries: [],
    interestSlugs: ['day_pass', 'weekly_desk', 'nomad_community'],
    defaultFrequency: 'per_day',
    vendorApi: 'activities', optionType: 'activity', multiDay: true,
  },
  ground_transport: {
    label: 'Ground Transport',
    color: '#f0ad4e',
    bg: 'bg-yellow-100', dot: 'bg-yellow-500', badge: 'bg-yellow-500',
    coaPersonal: 'P-9600', coaBusiness: 'B-9600',
    alwaysScan: false,
    googlePlacesType: null,
    scanQueries: ['airport transfer', 'taxi service', 'car rental', 'motorbike rental'],
    defaultFrequency: 'per_day',
    vendorApi: 'vehicles', optionType: 'vehicle', multiDay: true,
  },
  wellness: {
    label: 'Wellness & Spa',
    color: '#1abc9c',
    bg: 'bg-teal-100', dot: 'bg-teal-400', badge: 'bg-teal-400',
    coaPersonal: 'P-9700', coaBusiness: null,
    alwaysScan: false,
    googlePlacesType: 'spa',
    scanQueries: ['spa', 'massage', 'wellness retreat', 'hot springs'],
    defaultFrequency: 'per_visit',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  shopping: {
    label: 'Shopping & Supplies',
    color: '#95a5a6',
    bg: 'bg-gray-100', dot: 'bg-gray-400', badge: 'bg-gray-400',
    coaPersonal: 'P-9800', coaBusiness: 'B-9800',
    alwaysScan: false,
    googlePlacesType: null,
    scanQueries: ['shopping mall', 'market', 'convenience store', 'pharmacy'],
    defaultFrequency: 'total',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  bucket_list: {
    label: 'Bucket List',
    color: '#9b59b6',
    bg: 'bg-violet-100', dot: 'bg-violet-400', badge: 'bg-violet-400',
    coaPersonal: 'P-9450', coaBusiness: null,
    alwaysScan: false,
    googlePlacesType: null,
    scanQueries: [],
    interestSlugs: ['safari', 'northern_lights', 'cherry_blossoms', 'hot_air_balloon', 'volcano', 'carnival'],
    defaultFrequency: 'per_visit',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  communication: {
    label: 'Communication',
    color: '#3498db',
    bg: 'bg-sky-100', dot: 'bg-sky-400', badge: 'bg-sky-400',
    coaPersonal: 'P-9810', coaBusiness: 'B-9810',
    alwaysScan: false,
    googlePlacesType: null,
    scanQueries: [],
    defaultFrequency: 'total',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
  insurance_fees: {
    label: 'Insurance & Fees',
    color: '#7f8c8d',
    bg: 'bg-gray-100', dot: 'bg-gray-500', badge: 'bg-gray-500',
    coaPersonal: 'P-9820', coaBusiness: 'B-9820',
    alwaysScan: false,
    googlePlacesType: null,
    scanQueries: [],
    defaultFrequency: 'total',
    vendorApi: 'activities', optionType: 'activity', multiDay: false,
  },
};

// ─── Derived Lookups ─────────────────────────────────────────────────────────

/** Map any interest slug to its COA category key */
export function interestToCOA(slug: string): string {
  for (const [key, cat] of Object.entries(TRAVEL_COA)) {
    if (cat.interestSlugs?.includes(slug)) return key;
  }
  return 'arts_culture'; // default fallback
}

/** Get all scan queries for a COA category, expanding active user interests.
 *  Falls back to generating queries from the category label if no specific
 *  queries or interest expansions are available. */
export function getCOAScanQueries(coaKey: string, userInterests: string[]): string[] {
  const cat = TRAVEL_COA[coaKey];
  if (!cat) return [];

  const queries = [...(cat.scanQueries || [])];

  if (cat.interestSlugs) {
    const activeInCategory = userInterests.filter(s => cat.interestSlugs!.includes(s));
    for (const slug of activeInCategory) {
      const expansion = ACTIVITY_SEARCH_EXPANSIONS[slug];
      if (expansion) {
        for (const e of expansion) {
          for (const q of e.queries) {
            if (!queries.includes(q)) queries.push(q);
          }
        }
      }
    }
  }

  // Fallback: generate a generic query from the category label
  if (queries.length === 0) {
    queries.push(cat.label.toLowerCase());
  }

  return queries;
}

/** Which COA categories should be scanned based on trip type.
 *  User interests still drive which ACTIVITY_SEARCH_EXPANSIONS queries
 *  get added within each category, but they don't gate whether a
 *  category is searched at all. */
export function getActiveScanCategories(userInterests: string[], tripType: string): string[] {
  const active: string[] = [];

  for (const [key, cat] of Object.entries(TRAVEL_COA)) {
    // Skip flights — handled by Duffel/manual
    if (key === 'flights') continue;
    // Skip communication and insurance — no scannable results
    if (key === 'communication' || key === 'insurance_fees') continue;
    // Skip business meals unless business/mixed trip
    if (key === 'business_meals' && tripType !== 'business' && tripType !== 'mixed') continue;
    // Everything else gets scanned
    active.push(key);
  }

  return active;
}

// ─── COA Code Lookup (for budget table) ──────────────────────────────────────

/** Map a COA code (P-9200, B-9510, etc.) to its display label */
export function coaCodeToLabel(code: string): string {
  for (const cat of Object.values(TRAVEL_COA)) {
    if (cat.coaPersonal === code || cat.coaBusiness === code) return cat.label;
  }
  // Legacy codes
  const LEGACY: Record<string, string> = {
    'P-7100': 'Flights', 'P-7200': 'Accommodation', 'P-7300': 'Ground Transport',
    'P-7400': 'Arts & Culture', 'P-7500': 'Shopping & Supplies', 'P-7600': 'Ground Transport',
    'P-7700': 'Dinner', 'P-7800': 'Insurance & Fees', 'P-8220': 'Coworking',
    'P-9910': 'Flights', 'P-9920': 'Accommodation', 'P-9930': 'Ground Transport',
    'P-9940': 'Ground Transport', 'P-9960': 'Arts & Culture',
    // Old merged categories
    'P-9300': 'Ground Transport', 'B-9300': 'Ground Transport',
    'P-9350': 'Shopping & Supplies', 'B-9350': 'Shopping & Supplies',
    'P-9400': 'Arts & Culture', 'B-9400': 'Arts & Culture',
    'P-9450': 'Bucket List',
    'P-9500': 'Dinner', 'B-9500': 'Conferences & Summits',
    'P-9800': 'Shopping & Supplies', 'B-9800': 'Shopping & Supplies',
    'P-9900': 'Insurance & Fees', 'B-9900': 'Insurance & Fees',
    'P-9950': 'Insurance & Fees', 'B-9950': 'Insurance & Fees',
  };
  return LEGACY[code] || code;
}

// ─── Calendar Source Config (derived from COA) ───────────────────────────────

/** Build TRIP_SOURCE_CONFIG for CalendarGrid from TRAVEL_COA.
 *  Returns both COA keys and backward-compat aliases for event matching. */
export function buildCalendarSourceConfig(): Record<string, { label: string; icon: string; bg: string; dot: string; badge: string }> {
  const config: Record<string, { label: string; icon: string; bg: string; dot: string; badge: string }> = {};

  // Backward-compat aliases: map old event source keys to COA categories
  const ALIASES: Record<string, string> = {
    flight: 'flights', lodging: 'accommodation', brunchCoffee: 'brunch_coffee',
    activities: 'sports_fitness', activity: 'sports_fitness',
    transfer: 'ground_transport', vehicle: 'ground_transport',
    toiletries: 'shopping',
  };

  // Icon mapping
  const ICONS: Record<string, string> = {
    flights: '✈️', accommodation: '🏨', brunch_coffee: '☕', dinner: '🍽️',
    business_meals: '💼', sports_fitness: '🏄', arts_culture: '🎨',
    nightlife: '🌙', festivals: '🎪', conferences: '🏛️', coworking: '💻',
    ground_transport: '🚗', wellness: '🧘', shopping: '🛒',
    bucket_list: '🌋', communication: '📱', insurance_fees: '🛡️',
  };

  // Add primary COA entries
  for (const [coaKey, cat] of Object.entries(TRAVEL_COA)) {
    const icon = ICONS[coaKey] || '';
    config[coaKey] = { label: cat.label, icon, bg: cat.bg, dot: cat.dot, badge: cat.badge };
  }

  // Add backward-compat aliases (point to same visual config, won't appear in legend twice)
  for (const [alias, coaKey] of Object.entries(ALIASES)) {
    if (!config[alias] && config[coaKey]) {
      config[alias] = config[coaKey];
    }
  }

  return config;
}

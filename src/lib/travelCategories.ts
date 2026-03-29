// ─── Travel Category Registry — Single Source of Truth ─────────────────────
// Every component reads from this file for category metadata:
// calendar colors, section grouping, COA codes, display labels.

export interface TravelCategory {
  key: string;
  label: string;
  section: 'lodging' | 'dining' | 'activities';
  coaCode: string;
  calendarColor: string;
}

const TRAVEL_CATEGORIES: Record<string, TravelCategory> = {
  accommodation:  { key: 'accommodation',  label: 'Accommodation',      section: 'lodging',    coaCode: '9100', calendarColor: '#60A5FA' },
  brunch_coffee:  { key: 'brunch_coffee',  label: 'Brunch & Coffee',    section: 'dining',     coaCode: '9310', calendarColor: '#F59E0B' },
  dinner:         { key: 'dinner',         label: 'Dinner',             section: 'dining',     coaCode: '9320', calendarColor: '#F59E0B' },
  arts_culture:   { key: 'arts_culture',   label: 'Activities',         section: 'activities', coaCode: '9420', calendarColor: '#8B5CF6' },
  sports_fitness: { key: 'sports_fitness', label: 'Sports & Fitness',   section: 'activities', coaCode: '9410', calendarColor: '#10B981' },
  nightlife:      { key: 'nightlife',      label: 'Activities',         section: 'activities', coaCode: '9430', calendarColor: '#8B5CF6' },
  festivals:      { key: 'festivals',      label: 'Activities',         section: 'activities', coaCode: '9440', calendarColor: '#8B5CF6' },
  bucket_list:    { key: 'bucket_list',    label: 'Activities',         section: 'activities', coaCode: '9450', calendarColor: '#8B5CF6' },
  wellness:       { key: 'wellness',       label: 'Activities',         section: 'activities', coaCode: '9700', calendarColor: '#8B5CF6' },
  shopping:       { key: 'shopping',       label: 'Activities',         section: 'activities', coaCode: '9800', calendarColor: '#8B5CF6' },
  transport:      { key: 'transport',      label: 'Transport',          section: 'activities', coaCode: '9200', calendarColor: '#64748B' },
};

// Legacy camelCase aliases → canonical underscore keys
const ALIASES: Record<string, string> = {
  brunchCoffee: 'brunch_coffee',
  artsCulture: 'arts_culture',
  sportsFitness: 'sports_fitness',
  bucketList: 'bucket_list',
  groundTransport: 'transport',
  ground_transport: 'transport',
  // Common legacy keys from older committed items
  food: 'dinner',
  coffee: 'brunch_coffee',
  meals: 'dinner',
  meals_dining: 'dinner',
  restaurant: 'dinner',
  dining: 'dinner',
  cafe: 'brunch_coffee',
  business_meals: 'dinner',
  toiletries: 'shopping',
  activities: 'arts_culture',
  activity: 'arts_culture',
  lodging: 'accommodation',
  flight: 'accommodation', // flights handled separately but alias for safety
  vehicle: 'transport',
  transfer: 'transport',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolve(key: string): string {
  return ALIASES[key] || key;
}

export function getCategoryByKey(key: string): TravelCategory | undefined {
  return TRAVEL_CATEGORIES[resolve(key)];
}

export function getCOACode(key: string): string {
  return TRAVEL_CATEGORIES[resolve(key)]?.coaCode || '9950';
}

export function getSection(key: string): 'lodging' | 'dining' | 'activities' {
  return TRAVEL_CATEGORIES[resolve(key)]?.section || 'activities';
}

export function getCalendarColor(key: string): string {
  return TRAVEL_CATEGORIES[resolve(key)]?.calendarColor || '#8B5CF6';
}

export function getCalendarLabel(key: string): string {
  return TRAVEL_CATEGORIES[resolve(key)]?.label || 'Activities';
}

/** All category keys that belong to dining */
export function getDiningCategoryKeys(): Set<string> {
  const keys = new Set<string>();
  for (const [k, cat] of Object.entries(TRAVEL_CATEGORIES)) {
    if (cat.section === 'dining') keys.add(k);
  }
  // Also add known aliases that resolve to dining
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (TRAVEL_CATEGORIES[canonical]?.section === 'dining') keys.add(alias);
  }
  return keys;
}

/** Category keys to exclude from the "Activities" section (flights, lodging, dining) */
export function getExcludeFromActivitiesKeys(): Set<string> {
  const keys = new Set<string>(['flight']);
  for (const [k, cat] of Object.entries(TRAVEL_CATEGORIES)) {
    if (cat.section === 'lodging' || cat.section === 'dining') keys.add(k);
  }
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    const cat = TRAVEL_CATEGORIES[canonical];
    if (cat?.section === 'lodging' || cat?.section === 'dining') keys.add(alias);
  }
  return keys;
}

// ─── Calendar Source Config ─────────────────────────────────────────────────

// Consolidated legend labels — groups sub-categories under unified labels
// Only these appear in the calendar legend:
//   Flights, Accommodation, Dining, Activities, Sports & Fitness
const LEGEND_GROUPS: Record<string, {
  label: string;
  color: string;
  bg: string;
  dot: string;
  badge: string;
}> = {
  flights:        { label: 'Flights',          color: '#9b59b6', bg: 'bg-purple-100', dot: 'bg-purple-400', badge: 'bg-purple-400' },
  accommodation:  { label: 'Accommodation',    color: '#60A5FA', bg: 'bg-blue-100',   dot: 'bg-blue-400',   badge: 'bg-blue-400' },
  dining:         { label: 'Dining',           color: '#F59E0B', bg: 'bg-amber-100',  dot: 'bg-amber-400',  badge: 'bg-amber-400' },
  activities:     { label: 'Activities',       color: '#8B5CF6', bg: 'bg-violet-100', dot: 'bg-violet-400', badge: 'bg-violet-400' },
  sports_fitness: { label: 'Sports & Fitness', color: '#10B981', bg: 'bg-green-100',  dot: 'bg-green-500',  badge: 'bg-green-500' },
};

// Map every possible event source key to its legend group
function legendGroupFor(source: string): string {
  if (source === 'flights' || source === 'flight') return 'flights';
  const cat = TRAVEL_CATEGORIES[resolve(source)];
  if (!cat) return 'activities';
  if (cat.section === 'lodging') return 'accommodation';
  if (cat.section === 'dining') return 'dining';
  if (cat.key === 'sports_fitness') return 'sports_fitness';
  return 'activities';
}

/** Build source config for CalendarGrid. Each event source key maps to its
 *  visual style. Legend deduplication uses the label field. */
export function buildCalendarSourceConfig(): Record<string, { label: string; icon: string; bg: string; dot: string; badge: string }> {
  const config: Record<string, { label: string; icon: string; bg: string; dot: string; badge: string }> = {};

  // Add the five legend group entries
  for (const [key, group] of Object.entries(LEGEND_GROUPS)) {
    config[key] = { label: group.label, icon: '', bg: group.bg, dot: group.dot, badge: group.badge };
  }

  // Map every TRAVEL_CATEGORIES key to its legend group's visuals
  for (const [catKey] of Object.entries(TRAVEL_CATEGORIES)) {
    if (!config[catKey]) {
      const groupKey = legendGroupFor(catKey);
      const group = LEGEND_GROUPS[groupKey];
      config[catKey] = { label: group.label, icon: '', bg: group.bg, dot: group.dot, badge: group.badge };
    }
  }

  // Map every alias to its legend group's visuals
  for (const [alias] of Object.entries(ALIASES)) {
    if (!config[alias]) {
      const groupKey = legendGroupFor(alias);
      const group = LEGEND_GROUPS[groupKey];
      config[alias] = { label: group.label, icon: '', bg: group.bg, dot: group.dot, badge: group.badge };
    }
  }

  // Additional backward-compat event source keys
  const extraAliases: Record<string, string> = {
    lodging: 'accommodation',
    flight: 'flights',
    brunchCoffee: 'dining',
    activity: 'activities',
    transfer: 'activities',
    vehicle: 'activities',
  };
  for (const [alias, groupKey] of Object.entries(extraAliases)) {
    if (!config[alias]) {
      const group = LEGEND_GROUPS[groupKey] || LEGEND_GROUPS['activities'];
      config[alias] = { label: group.label, icon: '', bg: group.bg, dot: group.dot, badge: group.badge };
    }
  }

  return config;
}

export { TRAVEL_CATEGORIES };

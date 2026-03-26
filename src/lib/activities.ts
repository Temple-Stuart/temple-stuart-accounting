// Canonical travel interests — single source of truth for all interest/activity references.
// Aligned with the 8 filter chips in the search bar and destination database categories.

// ─── New Category-Aligned Interests ──────────────────────────────────────────

export const TRAVEL_INTERESTS: Record<string, string[]> = {
  'Active & Outdoors': [
    'Surf', 'Ski', 'Snowboard', 'Hike', 'Bike', 'Climb', 'Dive', 'Snorkel', 'Kayak', 'Yoga', 'Skate', 'Paraglide',
  ],
  'Festivals & Events': [
    'Music', 'Art', 'Film', 'Sports', 'Food & Wine', 'Cultural', 'Fashion',
  ],
  'Conferences & Summits': [
    'Fintech', 'Tech', 'Startup', 'Business', 'Marketing', 'Crypto', 'Accounting',
  ],
  'Nightlife': [
    'Clubs', 'Rooftop Bars', 'Live Music', 'Jazz', 'Comedy', 'Dinner Shows',
  ],
  'Food & Craft': [
    'Cooking Class', 'Food Tour', 'Wine Tasting', 'Coffee Tour', 'Craft Workshop', 'Pottery', 'Photography',
  ],
  'Coworking': [
    'Day Pass', 'Weekly Desk', 'Nomad Community',
  ],
  'Culture & Discovery': [
    'Art Museums', 'History Museums', 'Temples', 'UNESCO Sites', 'Zoos', 'Aquariums', 'Street Art', 'Architecture',
  ],
  'Bucket List': [
    'Northern Lights', 'Cherry Blossoms', 'Safari', 'Hot Air Balloon', 'Volcano', 'Carnival',
  ],
};

// All category names (matches filter chip labels in search bar)
export const INTEREST_CATEGORIES = Object.keys(TRAVEL_INTERESTS);

// Flat list of all interest values (lowercase slug form)
export const ALL_INTEREST_VALUES: string[] = Object.values(TRAVEL_INTERESTS).flat();

// ─── Backward-Compatible Exports ─────────────────────────────────────────────
// Used by: TripProfileCard, TripPlannerAI, ai-assistant API route

export interface Activity {
  value: string;
  label: string;
}

export interface ActivityGroup {
  label: string;
  activities: Activity[];
}

// Derive ACTIVITY_GROUPS from TRAVEL_INTERESTS for backward compat
export const ACTIVITY_GROUPS: ActivityGroup[] = Object.entries(TRAVEL_INTERESTS).map(
  ([label, items]) => ({
    label,
    activities: items.map(item => ({
      value: item.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      label: item,
    })),
  })
);

// Flat list of all activities
export const ALL_ACTIVITIES: Activity[] = ACTIVITY_GROUPS.flatMap(g => g.activities);

// Quick lookup: value -> label
export const ACTIVITY_LABELS: Record<string, string> = Object.fromEntries(
  ALL_ACTIVITIES.map(a => [a.value, a.label])
);

// ─── Scanner Search Expansions ───────────────────────────────────────────────
// Maps interest values to search queries for the trip scanner/AI assistant.

export const ACTIVITY_SEARCH_EXPANSIONS: Record<string, { category: string; queries: string[] }[]> = {
  surf: [{ category: 'activities', queries: ['surf lessons surf rental surf school'] }],
  ski: [{ category: 'activities', queries: ['ski rental ski school ski pass'] }],
  snowboard: [{ category: 'activities', queries: ['snowboard rental snowboard school'] }],
  hike: [{ category: 'activities', queries: ['hiking trails guided hike nature walk'] }],
  bike: [{ category: 'activities', queries: ['bike rental cycling tour bike shop'] }],
  climb: [{ category: 'activities', queries: ['rock climbing gym climbing wall bouldering'] }],
  dive: [{ category: 'activities', queries: ['scuba diving dive center dive shop'] }],
  snorkel: [{ category: 'activities', queries: ['snorkel tour snorkel rental reef'] }],
  kayak: [{ category: 'activities', queries: ['kayak rental kayak tour paddle'] }],
  yoga: [{ category: 'wellness', queries: ['yoga studio yoga retreat yoga class'] }],
  skate: [{ category: 'activities', queries: ['skatepark skate shop'] }],
  paraglide: [{ category: 'activities', queries: ['paragliding tandem paraglide flight'] }],
  music: [{ category: 'nightlife', queries: ['music festival concert venue live music'] }],
  art: [{ category: 'activities', queries: ['art festival art gallery exhibition'] }],
  film: [{ category: 'activities', queries: ['film festival cinema screening'] }],
  food___wine: [{ category: 'activities', queries: ['food festival wine festival tasting'] }],
  cultural: [{ category: 'activities', queries: ['cultural festival heritage celebration'] }],
  fintech: [{ category: 'coworking', queries: ['fintech conference summit'] }],
  tech: [{ category: 'coworking', queries: ['tech conference summit startup event'] }],
  startup: [{ category: 'coworking', queries: ['startup conference pitch event'] }],
  clubs: [{ category: 'nightlife', queries: ['nightclub dance club DJ'] }],
  rooftop_bars: [{ category: 'nightlife', queries: ['rooftop bar cocktail bar lounge'] }],
  live_music: [{ category: 'nightlife', queries: ['live music venue concert bar'] }],
  jazz: [{ category: 'nightlife', queries: ['jazz club jazz bar live jazz'] }],
  comedy: [{ category: 'nightlife', queries: ['comedy club stand-up comedy show'] }],
  cooking_class: [{ category: 'activities', queries: ['cooking class culinary workshop'] }],
  food_tour: [{ category: 'activities', queries: ['food tour street food market tour'] }],
  wine_tasting: [{ category: 'activities', queries: ['wine tasting vineyard winery tour'] }],
  coffee_tour: [{ category: 'activities', queries: ['coffee tour roastery barista'] }],
  day_pass: [{ category: 'coworking', queries: ['coworking day pass hot desk'] }],
  weekly_desk: [{ category: 'coworking', queries: ['coworking weekly desk shared office'] }],
  nomad_community: [{ category: 'coworking', queries: ['digital nomad community coliving'] }],
  art_museums: [{ category: 'activities', queries: ['art museum gallery'] }],
  history_museums: [{ category: 'activities', queries: ['history museum heritage center'] }],
  temples: [{ category: 'activities', queries: ['temple shrine monastery'] }],
  unesco_sites: [{ category: 'activities', queries: ['UNESCO world heritage site'] }],
  safari: [{ category: 'activities', queries: ['safari tour wildlife reserve game drive'] }],
  hot_air_balloon: [{ category: 'activities', queries: ['hot air balloon ride flight'] }],
  carnival: [{ category: 'nightlife', queries: ['carnival parade festival celebration'] }],
};

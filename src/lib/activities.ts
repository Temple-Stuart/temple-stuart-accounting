// Canonical activities list — single source of truth for all activity/interest references.
// Used by: trip creation, profile cards, scanner query expansion.

export interface Activity {
  value: string;
  label: string;
}

export interface ActivityGroup {
  label: string;
  activities: Activity[];
}

export const ACTIVITY_GROUPS: ActivityGroup[] = [
  {
    label: 'Snow & Mountain',
    activities: [
      { value: 'snowboard', label: 'Snowboard' },
      { value: 'ski', label: 'Ski' },
      { value: 'backcountry', label: 'Backcountry' },
      { value: 'mtb', label: 'Mountain Bike' },
      { value: 'hike', label: 'Hiking' },
      { value: 'camp', label: 'Camping' },
      { value: 'climb', label: 'Rock Climbing' },
    ]
  },
  {
    label: 'Water Sports',
    activities: [
      { value: 'surf', label: 'Surf' },
      { value: 'kitesurf', label: 'Kitesurf' },
      { value: 'windsurf', label: 'Windsurf' },
      { value: 'wakeboard', label: 'Wakeboard' },
      { value: 'sail', label: 'Sailing' },
      { value: 'kayak', label: 'Kayak' },
      { value: 'scuba', label: 'Scuba Dive' },
      { value: 'fish', label: 'Fishing' },
    ]
  },
  {
    label: 'Endurance & Fitness',
    activities: [
      { value: 'roadbike', label: 'Road Cycling' },
      { value: 'gravel', label: 'Gravel Bike' },
      { value: 'run', label: 'Running' },
      { value: 'trail', label: 'Trail Running' },
      { value: 'triathlon', label: 'Triathlon' },
      { value: 'yoga', label: 'Yoga Retreat' },
    ]
  },
  {
    label: 'Motorsports & Action',
    activities: [
      { value: 'moto', label: 'Motorcycle' },
      { value: 'atv', label: 'ATV/UTV' },
      { value: 'skydive', label: 'Skydiving' },
      { value: 'paraglide', label: 'Paragliding' },
    ]
  },
  {
    label: 'Urban & Lifestyle',
    activities: [
      { value: 'golf', label: 'Golf' },
      { value: 'tennis', label: 'Tennis' },
      { value: 'skate', label: 'Skateboard' },
      { value: 'foodtour', label: 'Food Tour' },
      { value: 'winetour', label: 'Wine Tour' },
    ]
  },
  {
    label: 'Culture & Events',
    activities: [
      { value: 'festival', label: 'Festival' },
      { value: 'concert', label: 'Concert' },
      { value: 'conference', label: 'Conference' },
      { value: 'wedding', label: 'Wedding' },
    ]
  },
  {
    label: 'Business & Work',
    activities: [
      { value: 'nomad', label: 'Remote Work' },
      { value: 'coworking', label: 'Coworking' },
      { value: 'retreat', label: 'Team Retreat' },
    ]
  },
  {
    label: 'Wildlife & Nature',
    activities: [
      { value: 'safari', label: 'Safari' },
      { value: 'nationalpark', label: 'National Park' },
      { value: 'beach', label: 'Beach' },
    ]
  },
];

// Flat list of all activity values
export const ALL_ACTIVITIES: Activity[] = ACTIVITY_GROUPS.flatMap(g => g.activities);

// Quick lookup: value -> label
export const ACTIVITY_LABELS: Record<string, string> = Object.fromEntries(
  ALL_ACTIVITIES.map(a => [a.value, a.label])
);

// Maps activities to scanner category search query expansions.
// When a participant selects an interest, these additional search terms
// get merged into the scanner's queries for the relevant category.
export const ACTIVITY_SEARCH_EXPANSIONS: Record<string, { category: string; queries: string[] }[]> = {
  surf: [{ category: 'activities', queries: ['surf lessons surf rental surf school'] }],
  kitesurf: [{ category: 'activities', queries: ['kitesurf lessons kite school'] }],
  windsurf: [{ category: 'activities', queries: ['windsurf rental windsurf school'] }],
  ski: [{ category: 'activities', queries: ['ski rental ski school ski pass'] }],
  snowboard: [{ category: 'activities', queries: ['snowboard rental snowboard school'] }],
  scuba: [{ category: 'activities', queries: ['scuba diving dive center dive shop'] }],
  yoga: [{ category: 'wellness', queries: ['yoga studio yoga retreat yoga class'] }],
  mtb: [{ category: 'activities', queries: ['mountain bike rental MTB trails bike shop'] }],
  roadbike: [{ category: 'activities', queries: ['road bike rental cycling tour bike shop'] }],
  gravel: [{ category: 'activities', queries: ['gravel bike rental bike shop cycling'] }],
  golf: [{ category: 'activities', queries: ['golf course golf club tee time'] }],
  tennis: [{ category: 'activities', queries: ['tennis court tennis club'] }],
  skate: [{ category: 'activities', queries: ['skatepark skate shop'] }],
  foodtour: [{ category: 'activities', queries: ['food tour cooking class food market'] }],
  winetour: [{ category: 'activities', queries: ['wine tour vineyard winery tasting'] }],
  hike: [{ category: 'activities', queries: ['hiking trails guided hike nature walk'] }],
  climb: [{ category: 'activities', queries: ['rock climbing gym climbing wall bouldering'] }],
  kayak: [{ category: 'activities', queries: ['kayak rental kayak tour paddle'] }],
  sail: [{ category: 'activities', queries: ['sailing charter boat rental sailing tour'] }],
  fish: [{ category: 'activities', queries: ['fishing charter deep sea fishing fishing tour'] }],
  moto: [{ category: 'motoRental', queries: ['motorcycle rental motorbike hire'] }],
  run: [{ category: 'activities', queries: ['running track running group park run'] }],
  trail: [{ category: 'activities', queries: ['trail running trails nature park'] }],
  triathlon: [{ category: 'activities', queries: ['triathlon swimming pool open water swim'] }],
  festival: [{ category: 'nightlife', queries: ['music festival event venue concert hall'] }],
  concert: [{ category: 'nightlife', queries: ['concert venue live music'] }],
  safari: [{ category: 'activities', queries: ['safari tour wildlife reserve game drive'] }],
  nationalpark: [{ category: 'activities', queries: ['national park nature reserve guided tour'] }],
  skydive: [{ category: 'activities', queries: ['skydiving tandem skydive drop zone'] }],
  paraglide: [{ category: 'activities', queries: ['paragliding tandem paraglide flight'] }],
  conference: [{ category: 'coworking', queries: ['conference venue event space meeting room'] }],
  nomad: [{ category: 'coworking', queries: ['coworking space digital nomad cafe'] }],
  coworking: [{ category: 'coworking', queries: ['coworking space shared office'] }],
};

/**
 * EVENTS-01 (Alex, 2026-10-30) — THE EXPERIENCES LEAF.
 *
 * The marquee events a guest books a trip around, one row per event EDITION,
 * every row dated from the event's OWN calendar with the day it was checked.
 * THIS FILE IS DATA AND PURE FUNCTIONS: no fetch, no env, no clock, no React
 * (the plans.ts rule). Zero imports: server- and client-safe.
 *
 * THE SHAPE. Every row is exactly { id, category, series, name, venue, city,
 * country, countryCode, start, end, windowKind, status, sourceKind, sourceName,
 * sourceUrl, checkedOn, notes }:
 *   · start/end are 'YYYY-MM-DD' strings, both set or both null — every date
 *     comparison in the system is a STRING compare on that shape, never a Date;
 *   · windowKind — 'fixed' (the dates are the event), 'window' (the event runs
 *     on some days inside the window), 'swell' (a one-day event called inside
 *     the window on a swell);
 *   · status — 'announced' (the organizer or a report gives the dates),
 *     'conflict' (two reports disagree; the window shown covers both),
 *     'not_announced' (no dates yet — start and end are null, said so);
 *   · sourceKind — 'official' (the event's or the venue's own page) or
 *     'secondary' (a report, not yet confirmed by the organizer); sourceName and
 *     sourceUrl name it, so every date is one click from its proof;
 *   · checkedOn — the day the source was read;
 *   · venue or city "—" (VENUE_NOT_FIXED) means not fixed, and is allowed ONLY
 *     while the row is not_announced.
 *   WASHERE-01 (2026-10-31): `featured` left the row — Alex's own stop is the trip
 *   log's (src/lib/wasHere.ts), which names an event here by id; the experiences
 *   are the reader's filter and nothing in them is Alex's.
 *
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts,
 * which adds the one check only it can see — the landing mounts the section
 * once and the front door computes the day). It refuses by name: a duplicate
 * id; a category not in EXPERIENCE_CATEGORIES; an empty name, venue, city,
 * country or sourceName; a "—" venue or city on a row that is not
 * not_announced; a countryCode not two upper-case letters; a sourceUrl not
 * https; a checkedOn not 'YYYY-MM-DD'; start and end not both ISO dates with
 * start ≤ end or both null; 'announced' or 'conflict' with null dates, or
 * 'not_announced' with dates; windowKind 'swell' on a row that is not
 * announced; two rows sharing (category, name, start); a row whose keys are not
 * exactly the seventeen above.
 *
 * NOT `event.ts`, NOT EVENT_CATEGORIES: EVENT-01's calendar leaf owns those
 * (src/lib/calendar/manualEvent.ts). THE ROWS BELOW ARE TRANSCRIBED FROM THE
 * EVENTS-01 RULING VERBATIM — no row added, dropped, re-dated or re-worded; a
 * change to a row is a new checkedOn and its own ruling.
 */

export type ExperienceCategoryId =
  | 'surfing' | 'snowboarding' | 'skate' | 'golf' | 'f1' | 'moto' | 'tennis' | 'fighting' | 'music_art';

export interface ExperienceCategory {
  id: ExperienceCategoryId;
  /** The chip and the heading. */
  label: string;
}

/** The nine categories, in the ruled order — the chips read in this order. */
export const EXPERIENCE_CATEGORIES: readonly ExperienceCategory[] = [
  // EVENTS-01b (2026-10-30): the labels read Surf · Snow; the ids and the order are the
  // URL values and the law's list and do not change. The FIRST entry is the section's
  // default category (ExperiencesSection.tsx DEFAULT_INTO), so reordering this list is a
  // conscious change — experiences01.test.ts pins it.
  { id: 'surfing', label: 'Surf' },
  { id: 'snowboarding', label: 'Snow' },
  { id: 'skate', label: 'Skate' },
  { id: 'golf', label: 'Golf' },
  { id: 'f1', label: 'F1' },
  { id: 'moto', label: 'Moto' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'fighting', label: 'Fighting' },
  { id: 'music_art', label: 'Music & art' },
];

export type ExperienceWindowKind = 'fixed' | 'window' | 'swell';
export type ExperienceStatus = 'announced' | 'conflict' | 'not_announced';
export type ExperienceSourceKind = 'official' | 'secondary';

export interface Experience {
  id: string;
  category: ExperienceCategoryId;
  series: string | null;
  name: string;
  venue: string;
  city: string;
  country: string;
  /** ISO-2, upper case. */
  countryCode: string;
  start: string | null;
  end: string | null;
  windowKind: ExperienceWindowKind;
  status: ExperienceStatus;
  sourceKind: ExperienceSourceKind;
  sourceName: string;
  sourceUrl: string;
  checkedOn: string;
  notes: string | null;
}

/** The leaf's "not fixed" value for venue and city — allowed only while a row is not_announced. */
export const VENUE_NOT_FIXED = '—';

/** The seventeen keys every row carries, in the ruled order. */
export const EXPERIENCE_FIELDS = [
  'id', 'category', 'series', 'name', 'venue', 'city', 'country', 'countryCode', 'start', 'end',
  'windowKind', 'status', 'sourceKind', 'sourceName', 'sourceUrl', 'checkedOn', 'notes',
] as const;

const CHECKED = '2026-10-30';
const F1_SERIES = '2027 FIA Formula One World Championship';
const F1_URL = 'https://www.formula1.com/en/racing/2027';
const WSL_2027_SOURCE = 'Surfing New Zealand (the 2027 schedule comes later this year)';
const WSL_2027_URL = 'https://surfingnz.co.nz/latest/new-zealand-pro-secures-place-on-wsl-2027-championship-tour-schedule/';

export const EXPERIENCES: readonly Experience[] = [
  // ── surfing ──
  { id: 'philippines-pro-2026', category: 'surfing', series: 'WSL Championship Tour', name: 'Philippines Pro presented by the Philippine Sports Commission', venue: 'Cloud 9', city: 'General Luna, Siargao', country: 'Philippines', countryCode: 'PH', start: '2026-10-30', end: '2026-11-10', windowKind: 'window', status: 'conflict', sourceKind: 'secondary', sourceName: 'Daily Tribune (WSL announcement)', sourceUrl: 'https://tribune.net.ph/2026/07/20/philippines-to-host-first-world-surf-league-championship-tour', checkedOn: CHECKED, notes: 'A Championship Tour stop from 2026; the WSL announcement gives Oct 31 – Nov 10 and two late reports give Oct 30 – Nov 8' },
  { id: 'pipe-masters-2026', category: 'surfing', series: 'WSL Championship Tour', name: 'Pipe Masters', venue: 'Banzai Pipeline', city: 'Haleiwa, O\'ahu', country: 'USA', countryCode: 'US', start: '2026-12-08', end: '2026-12-20', windowKind: 'window', status: 'announced', sourceKind: 'secondary', sourceName: 'Freesurf Magazine', sourceUrl: 'https://freesurfmagazine.com/pipe-masters-returns-as-world-title-decider-in-2026/', checkedOn: CHECKED, notes: 'The world title is decided here from 2026' },
  { id: 'nazare-big-wave-2026-27', category: 'surfing', series: 'WSL Big Wave', name: 'TUDOR Nazaré Big Wave Challenge', venue: 'Praia do Norte', city: 'Nazaré', country: 'Portugal', countryCode: 'PT', start: '2026-11-01', end: '2027-03-31', windowKind: 'swell', status: 'announced', sourceKind: 'secondary', sourceName: 'The Inertia', sourceUrl: 'https://www.theinertia.com/surf/nazare-big-wave-challenge-returns-winter-new-format/', checkedOn: CHECKED, notes: 'A one-day event called on a swell inside the window: Yellow Alert up to 72 hours out, Green Alert within 24 hours' },
  { id: 'us-open-of-surfing-2027', category: 'surfing', series: 'WSL', name: 'Lexus US Open of Surfing presented by Pacifico', venue: 'Huntington Beach Pier', city: 'Huntington Beach', country: 'USA', countryCode: 'US', start: null, end: null, windowKind: 'fixed', status: 'not_announced', sourceKind: 'official', sourceName: 'Surf City USA', sourceUrl: 'https://www.surfcityusa.com/events/annual-events-festivals/us-open-of-surfing/', checkedOn: CHECKED, notes: 'Last ran Jul 25 – Aug 2, 2026; free, no tickets' },
  { id: 'tahiti-pro-2027', category: 'surfing', series: 'WSL Championship Tour', name: 'Tahiti Pro', venue: 'Teahupo\'o', city: 'Taiarapu-Ouest, Tahiti', country: 'French Polynesia', countryCode: 'PF', start: null, end: null, windowKind: 'fixed', status: 'not_announced', sourceKind: 'official', sourceName: WSL_2027_SOURCE, sourceUrl: WSL_2027_URL, checkedOn: CHECKED, notes: 'The 2027 Championship Tour schedule is not published' },
  { id: 'rip-curl-pro-bells-2027', category: 'surfing', series: 'WSL Championship Tour', name: 'Rip Curl Pro Bells Beach', venue: 'Bells Beach', city: 'Torquay, Victoria', country: 'Australia', countryCode: 'AU', start: null, end: null, windowKind: 'fixed', status: 'not_announced', sourceKind: 'official', sourceName: WSL_2027_SOURCE, sourceUrl: WSL_2027_URL, checkedOn: CHECKED, notes: 'The 2027 Championship Tour schedule is not published' },
  // ── snowboarding ──
  { id: 'x-games-aspen-2027', category: 'snowboarding', series: 'X Games', name: 'MoonPay X Games Aspen 2027', venue: 'Buttermilk, Aspen Snowmass', city: 'Aspen', country: 'USA', countryCode: 'US', start: '2027-01-29', end: '2027-01-31', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Aspen Snowmass', sourceUrl: 'https://www.aspensnowmass.com/visit/events/x-games-aspen', checkedOn: CHECKED, notes: 'Winter opener; free before 5 PM' },
  { id: 'x-games-calgary-2027', category: 'snowboarding', series: 'X Games', name: 'MoonPay X Games Calgary 2027', venue: 'WinSport\'s Canada Olympic Park', city: 'Calgary', country: 'Canada', countryCode: 'CA', start: '2027-02-19', end: '2027-02-21', windowKind: 'fixed', status: 'announced', sourceKind: 'secondary', sourceName: 'SnowBrains (press release)', sourceUrl: 'https://snowbrains.com/x-games-league-winter-season-2027-schedule/', checkedOn: CHECKED, notes: 'First X Games in Canada' },
  { id: 'x-games-ruka-2027', category: 'snowboarding', series: 'X Games', name: 'MoonPay X Games Ruka 2027', venue: 'Ruka Ski Resort', city: 'Kuusamo', country: 'Finland', countryCode: 'FI', start: '2027-04-09', end: '2027-04-11', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'X Games', sourceUrl: 'https://www.xgames.com/?p=6602', checkedOn: CHECKED, notes: 'Winter finale' },
  { id: 'natural-selection-revelstoke-2027', category: 'snowboarding', series: 'Natural Selection Tour', name: '2027 YETI Natural Selection Revelstoke', venue: 'Montana Bowl, Revelstoke Mountain Resort', city: 'Revelstoke', country: 'Canada', countryCode: 'CA', start: '2027-03-08', end: '2027-03-14', windowKind: 'window', status: 'announced', sourceKind: 'official', sourceName: 'Revelstoke Mountain Resort', sourceUrl: 'https://www.revelstokemountainresort.com/event/natural-selection-tour', checkedOn: CHECKED, notes: 'Two live days chosen inside the window' },
  { id: 'kings-queens-corbets-2027', category: 'snowboarding', series: null, name: 'Kings and Queens of Corbet\'s', venue: 'Corbet\'s Couloir, Jackson Hole Mountain Resort', city: 'Teton Village', country: 'USA', countryCode: 'US', start: '2027-02-06', end: '2027-02-13', windowKind: 'window', status: 'announced', sourceKind: 'official', sourceName: 'Jackson Hole Mountain Resort', sourceUrl: 'https://www.jacksonhole.com/events/2027-kings-and-queens', checkedOn: CHECKED, notes: 'Held on one day inside a weather window' },
  // ── skate ──
  { id: 'sls-tokyo-2026', category: 'skate', series: 'Street League Skateboarding', name: 'SLS Tokyo', venue: 'Ariake Arena', city: 'Tokyo', country: 'Japan', countryCode: 'JP', start: '2026-11-14', end: '2026-11-14', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Street League Skateboarding', sourceUrl: 'https://www.streetleague.com/tokyo2026', checkedOn: CHECKED, notes: null },
  { id: 'sls-super-crown-2026', category: 'skate', series: 'Street League Skateboarding', name: 'SLS Super Crown World Championship 2026', venue: 'Ginásio do Ibirapuera', city: 'São Paulo', country: 'Brazil', countryCode: 'BR', start: '2026-12-12', end: '2026-12-13', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Street League Skateboarding', sourceUrl: 'https://streetleague.com/news/', checkedOn: CHECKED, notes: null },
  { id: 'x-games-summer-2027', category: 'skate', series: 'X Games', name: 'X Games summer 2027', venue: VENUE_NOT_FIXED, city: VENUE_NOT_FIXED, country: 'USA', countryCode: 'US', start: null, end: null, windowKind: 'fixed', status: 'not_announced', sourceKind: 'official', sourceName: 'X Games', sourceUrl: 'https://xgames.com/', checkedOn: CHECKED, notes: '2026 ran Sacramento, Chiba and New Orleans' },
  { id: 'world-skate-championships-next', category: 'skate', series: 'World Skate', name: 'World Skate Street and Park World Championships', venue: VENUE_NOT_FIXED, city: VENUE_NOT_FIXED, country: 'Paraguay', countryCode: 'PY', start: null, end: null, windowKind: 'fixed', status: 'not_announced', sourceKind: 'official', sourceName: 'World Skate', sourceUrl: 'https://www.worldskate.org/events/upcoming-events.html?category=9', checkedOn: CHECKED, notes: 'Last: World Skate Games, Asunción, Oct 2–18, 2026' },
  // ── golf ──
  { id: 'masters-2027', category: 'golf', series: null, name: 'The Masters Tournament', venue: 'Augusta National Golf Club', city: 'Augusta', country: 'USA', countryCode: 'US', start: '2027-04-08', end: '2027-04-11', windowKind: 'fixed', status: 'announced', sourceKind: 'secondary', sourceName: 'Golf Digest (citing Augusta National)', sourceUrl: 'https://www.golfdigest.com/story/masters-2027-augusta-national-lottery-tickets-faq-price-application-window', checkedOn: CHECKED, notes: 'Practice rounds Apr 5–7; the 2027 ticket lottery has closed' },
  { id: 'ryder-cup-2027', category: 'golf', series: null, name: 'The 2027 Ryder Cup', venue: 'The Golf Course at Adare Manor', city: 'Adare, County Limerick', country: 'Ireland', countryCode: 'IE', start: '2027-09-17', end: '2027-09-19', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Ryder Cup', sourceUrl: 'https://www.rydercup.com/news-media/dates-announced-for-the-2027-ryder-cup', checkedOn: CHECKED, notes: 'Event week Sep 13–19; 2029 at Hazeltine National, Minnesota' },
  { id: 'the-open-2027', category: 'golf', series: null, name: 'The 155th Open', venue: 'The Old Course', city: 'St Andrews', country: 'United Kingdom', countryCode: 'GB', start: '2027-07-11', end: '2027-07-18', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'The R&A', sourceUrl: 'https://www.theopen.com/latest/final-qualifying-venues-2027-confirmed', checkedOn: CHECKED, notes: '2028: Royal Lytham & St Annes, Jul 30 – Aug 6' },
  { id: 'pga-championship-2027', category: 'golf', series: null, name: '109th PGA Championship', venue: 'Fields Ranch East, PGA Frisco', city: 'Frisco', country: 'USA', countryCode: 'US', start: '2027-05-17', end: '2027-05-23', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'PGA of America', sourceUrl: 'https://www.pgamediacenter.com/events/2027-pga-championship', checkedOn: CHECKED, notes: 'Event week; 2028 at The Olympic Club, San Francisco' },
  { id: 'us-open-golf-2027', category: 'golf', series: null, name: '2027 U.S. Open Championship', venue: 'Pebble Beach Golf Links', city: 'Pebble Beach', country: 'USA', countryCode: 'US', start: '2027-06-17', end: '2027-06-20', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Pebble Beach Resorts (host venue)', sourceUrl: 'https://www.pebblebeach.com/events/us-open-championship/', checkedOn: CHECKED, notes: 'Event week Jun 14–20' },
  // ── f1 — the 2027 FIA Formula One World Championship, twenty-four rounds ──
  { id: 'f1-2027-r01', category: 'f1', series: F1_SERIES, name: 'Bahrain Grand Prix', venue: 'Bahrain International Circuit', city: 'Sakhir', country: 'Bahrain', countryCode: 'BH', start: '2027-03-12', end: '2027-03-14', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Sprint weekend; circuit names from secondary sources' },
  { id: 'f1-2027-r02', category: 'f1', series: F1_SERIES, name: 'Saudi Arabian Grand Prix', venue: 'Jeddah Corniche Circuit', city: 'Jeddah', country: 'Saudi Arabia', countryCode: 'SA', start: '2027-03-19', end: '2027-03-21', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r03', category: 'f1', series: F1_SERIES, name: 'Australian Grand Prix', venue: 'Albert Park Circuit', city: 'Melbourne', country: 'Australia', countryCode: 'AU', start: '2027-04-02', end: '2027-04-04', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Sprint weekend' },
  { id: 'f1-2027-r04', category: 'f1', series: F1_SERIES, name: 'Japanese Grand Prix', venue: 'Suzuka Circuit', city: 'Suzuka', country: 'Japan', countryCode: 'JP', start: '2027-04-09', end: '2027-04-11', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Sprint weekend' },
  { id: 'f1-2027-r05', category: 'f1', series: F1_SERIES, name: 'Chinese Grand Prix', venue: 'Shanghai International Circuit', city: 'Shanghai', country: 'China', countryCode: 'CN', start: '2027-04-16', end: '2027-04-18', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r06', category: 'f1', series: F1_SERIES, name: 'Miami Grand Prix', venue: 'Miami International Autodrome', city: 'Miami', country: 'USA', countryCode: 'US', start: '2027-04-30', end: '2027-05-02', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r07', category: 'f1', series: F1_SERIES, name: 'Canadian Grand Prix', venue: 'Circuit Gilles-Villeneuve', city: 'Montréal', country: 'Canada', countryCode: 'CA', start: '2027-05-21', end: '2027-05-23', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Sprint weekend' },
  { id: 'f1-2027-r08', category: 'f1', series: F1_SERIES, name: 'Monaco Grand Prix', venue: 'Circuit de Monaco', city: 'Monaco', country: 'Monaco', countryCode: 'MC', start: '2027-06-04', end: '2027-06-06', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Sprint weekend' },
  { id: 'f1-2027-r09', category: 'f1', series: F1_SERIES, name: 'Portuguese Grand Prix', venue: 'Autódromo Internacional do Algarve', city: 'Portimão', country: 'Portugal', countryCode: 'PT', start: '2027-06-18', end: '2027-06-20', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Returns after 2021' },
  { id: 'f1-2027-r10', category: 'f1', series: F1_SERIES, name: 'British Grand Prix', venue: 'Silverstone Circuit', city: 'Silverstone', country: 'United Kingdom', countryCode: 'GB', start: '2027-07-02', end: '2027-07-04', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Sprint weekend' },
  { id: 'f1-2027-r11', category: 'f1', series: F1_SERIES, name: 'Austrian Grand Prix', venue: 'Red Bull Ring', city: 'Spielberg', country: 'Austria', countryCode: 'AT', start: '2027-07-09', end: '2027-07-11', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r12', category: 'f1', series: F1_SERIES, name: 'Belgian Grand Prix', venue: 'Circuit de Spa-Francorchamps', city: 'Stavelot', country: 'Belgium', countryCode: 'BE', start: '2027-07-23', end: '2027-07-25', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r13', category: 'f1', series: F1_SERIES, name: 'Hungarian Grand Prix', venue: 'Hungaroring', city: 'Budapest', country: 'Hungary', countryCode: 'HU', start: '2027-07-30', end: '2027-08-01', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r14', category: 'f1', series: F1_SERIES, name: 'Italian Grand Prix', venue: 'Autodromo Nazionale Monza', city: 'Monza', country: 'Italy', countryCode: 'IT', start: '2027-09-03', end: '2027-09-05', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Sprint weekend' },
  { id: 'f1-2027-r15', category: 'f1', series: F1_SERIES, name: 'Spanish Grand Prix', venue: 'MADRING', city: 'Madrid', country: 'Spain', countryCode: 'ES', start: '2027-09-10', end: '2027-09-12', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r16', category: 'f1', series: F1_SERIES, name: 'Azerbaijan Grand Prix', venue: 'Baku City Circuit', city: 'Baku', country: 'Azerbaijan', countryCode: 'AZ', start: '2027-09-24', end: '2027-09-26', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r17', category: 'f1', series: F1_SERIES, name: 'Turkish Grand Prix', venue: 'Istanbul Park', city: 'Istanbul', country: 'Türkiye', countryCode: 'TR', start: '2027-10-01', end: '2027-10-03', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Subject to FIA circuit homologation' },
  { id: 'f1-2027-r18', category: 'f1', series: F1_SERIES, name: 'Singapore Grand Prix', venue: 'Marina Bay Street Circuit', city: 'Singapore', country: 'Singapore', countryCode: 'SG', start: '2027-10-08', end: '2027-10-10', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r19', category: 'f1', series: F1_SERIES, name: 'United States Grand Prix', venue: 'Circuit of The Americas', city: 'Austin', country: 'USA', countryCode: 'US', start: '2027-10-22', end: '2027-10-24', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r20', category: 'f1', series: F1_SERIES, name: 'Mexico City Grand Prix', venue: 'Autódromo Hermanos Rodríguez', city: 'Mexico City', country: 'Mexico', countryCode: 'MX', start: '2027-10-29', end: '2027-10-31', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r21', category: 'f1', series: F1_SERIES, name: 'São Paulo Grand Prix', venue: 'Autódromo José Carlos Pace', city: 'São Paulo', country: 'Brazil', countryCode: 'BR', start: '2027-11-05', end: '2027-11-07', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Sprint weekend' },
  { id: 'f1-2027-r22', category: 'f1', series: F1_SERIES, name: 'Las Vegas Grand Prix', venue: 'Las Vegas Strip Circuit', city: 'Las Vegas', country: 'USA', countryCode: 'US', start: '2027-11-18', end: '2027-11-20', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: null },
  { id: 'f1-2027-r23', category: 'f1', series: F1_SERIES, name: 'Qatar Grand Prix', venue: 'Lusail International Circuit', city: 'Lusail', country: 'Qatar', countryCode: 'QA', start: '2027-12-03', end: '2027-12-05', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Sprint weekend' },
  { id: 'f1-2027-r24', category: 'f1', series: F1_SERIES, name: 'Abu Dhabi Grand Prix', venue: 'Yas Marina Circuit', city: 'Abu Dhabi', country: 'United Arab Emirates', countryCode: 'AE', start: '2027-12-10', end: '2027-12-12', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Formula 1', sourceUrl: F1_URL, checkedOn: CHECKED, notes: 'Sprint weekend; season finale' },
  // ── moto ──
  { id: 'daytona-supercross-2027', category: 'moto', series: 'Monster Energy AMA Supercross', name: 'DAYTONA Supercross (Round 9)', venue: 'Daytona International Speedway', city: 'Daytona Beach', country: 'USA', countryCode: 'US', start: '2027-03-06', end: '2027-03-06', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Supercross Live', sourceUrl: 'https://www.supercrosslive.com/tickets', checkedOn: CHECKED, notes: 'The 2027 season runs 17 rounds, Jan 9 – May 15' },
  { id: 'motocross-of-nations-2027', category: 'moto', series: null, name: '2027 Monster Energy FIM Motocross of Nations', venue: 'TT Circuit Assen', city: 'Assen', country: 'Netherlands', countryCode: 'NL', start: '2027-10-10', end: '2027-10-10', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'FIM (provisional calendar)', sourceUrl: 'https://www.fim-moto.com/en/news/news-detail/article/provisional-2027-fim-motorcross-world-championship-calendar-announced', checkedOn: CHECKED, notes: 'Provisional; the race weekend is Oct 9–10' },
  { id: 'red-bull-romaniacs-2027', category: 'moto', series: null, name: 'Red Bull Romaniacs, Edition 24', venue: 'Sibiu', city: 'Sibiu', country: 'Romania', countryCode: 'RO', start: '2027-07-27', end: '2027-07-31', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Red Bull Romaniacs', sourceUrl: 'https://www.redbullromaniacs.com/for-competitors', checkedOn: CHECKED, notes: null },
  { id: 'erzbergrodeo-2027', category: 'moto', series: null, name: 'Red Bull Erzbergrodeo, 31st edition', venue: 'Erzberg mine', city: 'Eisenerz', country: 'Austria', countryCode: 'AT', start: '2027-05-27', end: '2027-05-30', windowKind: 'fixed', status: 'announced', sourceKind: 'secondary', sourceName: '1000PS (quoting the organizer)', sourceUrl: 'https://www.1000ps.de/businessnews-id-3014725-red-bull-erzbergrodeo-2027-termin-und-datum-stehen-fest', checkedOn: CHECKED, notes: 'The organizer\'s own site showed no dates when checked' },
  // ── tennis ──
  { id: 'australian-open-2027', category: 'tennis', series: 'Grand Slam', name: 'Australian Open 2027', venue: 'Melbourne Park', city: 'Melbourne', country: 'Australia', countryCode: 'AU', start: '2027-01-17', end: '2027-01-31', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Australian Open', sourceUrl: 'https://ausopen.com/node/261931', checkedOn: CHECKED, notes: 'Opening week Jan 11–16' },
  { id: 'roland-garros-2027', category: 'tennis', series: 'Grand Slam', name: 'Roland-Garros 2027', venue: 'Stade Roland-Garros', city: 'Paris', country: 'France', countryCode: 'FR', start: '2027-05-23', end: '2027-06-06', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Roland-Garros (FFT)', sourceUrl: 'https://travel.rolandgarros.com/en/category/our-offers', checkedOn: CHECKED, notes: 'Qualifying May 17–21' },
  { id: 'wimbledon-2027', category: 'tennis', series: 'Grand Slam', name: 'The Championships, Wimbledon 2027', venue: 'All England Lawn Tennis Club', city: 'London', country: 'United Kingdom', countryCode: 'GB', start: '2027-06-28', end: '2027-07-11', windowKind: 'fixed', status: 'announced', sourceKind: 'secondary', sourceName: 'LTA', sourceUrl: 'https://www.lta.org.uk/fan-zone/wimbledon-championships/news/preview-player-list-draw-order-of-play-scores-and-how-to-watch', checkedOn: CHECKED, notes: 'wimbledon.com\'s dates page did not render when checked; qualifying Jun 22–25' },
  { id: 'us-open-tennis-2027', category: 'tennis', series: 'Grand Slam', name: 'US Open 2027', venue: 'USTA Billie Jean King National Tennis Center', city: 'New York', country: 'USA', countryCode: 'US', start: null, end: null, windowKind: 'fixed', status: 'not_announced', sourceKind: 'secondary', sourceName: 'ATP Tour calendar', sourceUrl: 'https://www.atptour.com/-/media/files/calendar-pdfs/2026/2027-atp-tour-calendar-14-january-2026.pdf', checkedOn: CHECKED, notes: 'The ATP calendar lists a start of Aug 29, 2027; the USTA has not published the dates' },
  { id: 'indian-wells-2027', category: 'tennis', series: null, name: 'BNP Paribas Open 2027', venue: 'Indian Wells Tennis Garden', city: 'Indian Wells', country: 'USA', countryCode: 'US', start: '2027-03-03', end: '2027-03-14', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'BNP Paribas Open', sourceUrl: 'https://bnpparibasopen.com/news/2027-single-session-tickets', checkedOn: CHECKED, notes: 'Qualifying from Feb 28' },
  // ── fighting ──
  { id: 'ufc-fn-2026-10-31', category: 'fighting', series: 'UFC', name: 'UFC Fight Night: Moicano vs Nolan', venue: 'Meta APEX', city: 'Las Vegas', country: 'USA', countryCode: 'US', start: '2026-10-31', end: '2026-10-31', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'UFC', sourceUrl: 'https://www.ufc.com/event/ufc-fight-night-october-31-2026', checkedOn: CHECKED, notes: null },
  { id: 'ufc-fn-2026-11-07', category: 'fighting', series: 'UFC', name: 'UFC Fight Night: Bonfim vs Brady', venue: 'Meta APEX', city: 'Las Vegas', country: 'USA', countryCode: 'US', start: '2026-11-07', end: '2026-11-07', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'UFC', sourceUrl: 'https://www.ufc.com/event/ufc-fight-night-october-31-2026', checkedOn: CHECKED, notes: 'Listed as the next event on the Oct 31 page' },
  { id: 'ufc-334', category: 'fighting', series: 'UFC', name: 'UFC 334: Gane vs Hokit', venue: 'Madison Square Garden', city: 'New York', country: 'USA', countryCode: 'US', start: '2026-11-14', end: '2026-11-14', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'UFC', sourceUrl: 'https://www.ufc.com/event/ufc-334', checkedOn: CHECKED, notes: null },
  { id: 'ufc-fn-2026-11-21', category: 'fighting', series: 'UFC', name: 'UFC Fight Night: Procházka vs Stirling', venue: 'ABHA Arena', city: 'Doha', country: 'Qatar', countryCode: 'QA', start: '2026-11-21', end: '2026-11-21', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'UFC', sourceUrl: 'https://www.ufc.com/event/ufc-334', checkedOn: CHECKED, notes: 'Listed as the next event on the UFC 334 page' },
  { id: 'ufc-335', category: 'fighting', series: 'UFC', name: 'UFC 335: Oliveira vs Lopes', venue: 'T-Mobile Arena', city: 'Las Vegas', country: 'USA', countryCode: 'US', start: '2026-12-12', end: '2026-12-12', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'UFC', sourceUrl: 'https://www.ufc.com/event/ufc-335', checkedOn: CHECKED, notes: null },
  { id: 'ufc-fn-2027-01-16', category: 'fighting', series: 'UFC', name: 'UFC Fight Night, Dallas', venue: 'American Airlines Center (reported)', city: 'Dallas', country: 'USA', countryCode: 'US', start: '2027-01-16', end: '2027-01-16', windowKind: 'fixed', status: 'announced', sourceKind: 'secondary', sourceName: 'UFC (the date, on the UFC 335 page); Cageside Press (the venue)', sourceUrl: 'https://www.ufc.com/event/ufc-335', checkedOn: CHECKED, notes: 'The date is the UFC\'s; the venue is reported' },
  { id: 'one-fight-night-50', category: 'fighting', series: 'ONE Championship', name: 'ONE Fight Night 50', venue: 'Lumpinee Boxing Stadium', city: 'Bangkok', country: 'Thailand', countryCode: 'TH', start: '2026-12-18', end: '2026-12-18', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'ONE Championship', sourceUrl: 'https://www.onefc.com/events/onefightnight50', checkedOn: CHECKED, notes: null },
  { id: 'one-qatar-2027', category: 'fighting', series: 'ONE Championship', name: 'ONE Championship Qatar', venue: 'Aspire Dome', city: 'Doha', country: 'Qatar', countryCode: 'QA', start: '2027-03-26', end: '2027-03-26', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'ONE Championship (press release)', sourceUrl: 'https://www.onefc.com/press-releases/one-championship-and-visit-qatar-renew-landmark-three-year-partnership/', checkedOn: CHECKED, notes: null },
  { id: 'glory-rivals-2026', category: 'fighting', series: 'GLORY Kickboxing', name: 'GLORY Rivals', venue: 'Maaspoort', city: 'Den Bosch', country: 'Netherlands', countryCode: 'NL', start: '2026-11-28', end: '2026-11-28', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'GLORY Kickboxing', sourceUrl: 'https://glorykickboxing.com/news/glory-ringfight-promotions-collaborate-on-glory-rivals', checkedOn: CHECKED, notes: null },
  { id: 'glory-collision-10', category: 'fighting', series: 'GLORY Kickboxing', name: 'GLORY COLLISION 10', venue: 'GelreDome', city: 'Arnhem', country: 'Netherlands', countryCode: 'NL', start: '2026-12-12', end: '2026-12-12', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'GLORY Kickboxing', sourceUrl: 'https://glorykickboxing.com/news/kromah-vs-plazibat-headlines-collision-10-on-december-12', checkedOn: CHECKED, notes: null },
  { id: 'rizin-nye-2026', category: 'fighting', series: 'RIZIN', name: 'RIZIN NYE in Nagoya', venue: 'Vantelin Dome Nagoya', city: 'Nagoya', country: 'Japan', countryCode: 'JP', start: '2026-12-31', end: '2026-12-31', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'RIZIN', sourceUrl: 'https://www.rizin.tv/products/rizin-nye-in-nagoya', checkedOn: CHECKED, notes: 'In Nagoya this year, not Saitama' },
  // ── music_art ──
  { id: 'tomorrowland-2027', category: 'music_art', series: 'Tomorrowland', name: 'Tomorrowland 2027', venue: 'De Schorre', city: 'Boom', country: 'Belgium', countryCode: 'BE', start: null, end: null, windowKind: 'fixed', status: 'not_announced', sourceKind: 'official', sourceName: 'Tomorrowland', sourceUrl: 'https://www.tomorrowland.com', checkedOn: CHECKED, notes: 'The 2026 dates were announced Dec 4, 2025' },
  { id: 'tomorrowland-winter-2027', category: 'music_art', series: 'Tomorrowland', name: 'Tomorrowland Winter 2027', venue: 'Alpe d\'Huez', city: 'Huez', country: 'France', countryCode: 'FR', start: '2027-03-20', end: '2027-03-27', windowKind: 'fixed', status: 'announced', sourceKind: 'secondary', sourceName: 'DJ Mag', sourceUrl: 'https://djmag.com/news/tomorrowland-winter-2027-dates-and-ticket-sales-announced', checkedOn: CHECKED, notes: 'Tickets opened Oct 2026' },
  { id: 'coachella-2027-w1', category: 'music_art', series: 'Coachella', name: 'Coachella 2027, weekend one', venue: 'Empire Polo Club', city: 'Indio', country: 'USA', countryCode: 'US', start: '2027-04-09', end: '2027-04-11', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Coachella', sourceUrl: 'https://coachella.com/2027-advance-sale', checkedOn: CHECKED, notes: null },
  { id: 'coachella-2027-w2', category: 'music_art', series: 'Coachella', name: 'Coachella 2027, weekend two', venue: 'Empire Polo Club', city: 'Indio', country: 'USA', countryCode: 'US', start: '2027-04-16', end: '2027-04-18', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Coachella', sourceUrl: 'https://coachella.com/2027-advance-sale', checkedOn: CHECKED, notes: null },
  { id: 'burning-man-2027', category: 'music_art', series: null, name: 'Burning Man — Black Rock City 2027', venue: 'Black Rock Desert', city: 'Gerlach', country: 'USA', countryCode: 'US', start: '2027-08-29', end: '2027-09-06', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Burning Man', sourceUrl: 'https://burningman.org/event/brc/', checkedOn: CHECKED, notes: null },
  { id: 'art-basel-miami-beach-2026', category: 'music_art', series: 'Art Basel', name: 'Art Basel Miami Beach', venue: 'Miami Beach Convention Center', city: 'Miami Beach', country: 'USA', countryCode: 'US', start: '2026-12-04', end: '2026-12-06', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Art Basel', sourceUrl: 'https://www.artbasel.com/miami-beach/zero-10', checkedOn: CHECKED, notes: null },
  { id: 'art-basel-qatar-2027', category: 'music_art', series: 'Art Basel', name: 'Art Basel Qatar', venue: 'Msheireb Downtown Doha', city: 'Doha', country: 'Qatar', countryCode: 'QA', start: '2027-01-28', end: '2027-01-30', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Art Basel (press release)', sourceUrl: 'https://d2u3kfwd92fzu7.cloudfront.net/Press_Release_ABQ27_Artistic_Director_Announcement_EN-1.pdf', checkedOn: CHECKED, notes: 'Preview Jan 26–27' },
  { id: 'art-basel-hong-kong-2027', category: 'music_art', series: 'Art Basel', name: 'Art Basel Hong Kong', venue: 'Hong Kong Convention and Exhibition Centre', city: 'Hong Kong', country: 'Hong Kong', countryCode: 'HK', start: '2027-03-25', end: '2027-03-27', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Art Basel', sourceUrl: 'https://artbasel.com/hong-kong/at-the-show', checkedOn: CHECKED, notes: null },
  { id: 'art-basel-basel-2027', category: 'music_art', series: 'Art Basel', name: 'Art Basel', venue: 'Messe Basel', city: 'Basel', country: 'Switzerland', countryCode: 'CH', start: '2027-06-17', end: '2027-06-20', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Art Basel', sourceUrl: 'https://www.artbasel.com/Basel?lang=en', checkedOn: CHECKED, notes: null },
  { id: 'art-basel-paris-2027', category: 'music_art', series: 'Art Basel', name: 'Art Basel Paris', venue: 'Grand Palais', city: 'Paris', country: 'France', countryCode: 'FR', start: '2027-10-22', end: '2027-10-24', windowKind: 'fixed', status: 'announced', sourceKind: 'official', sourceName: 'Art Basel', sourceUrl: 'https://artbasel.com/paris/galeries', checkedOn: CHECKED, notes: 'The 2027 venue is not stated on the page; 2026 was the Grand Palais' },
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' with a month 01–12 and a day 01–31 — a string check, never a Date. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

export function isExperienceCategoryId(value: unknown): value is ExperienceCategoryId {
  return typeof value === 'string' && EXPERIENCE_CATEGORIES.some((c) => c.id === value);
}

/** The category's label, or a loud failure — never a guessed word. */
export function experienceCategoryLabel(id: ExperienceCategoryId): string {
  const found = EXPERIENCE_CATEGORIES.find((c) => c.id === id);
  if (!found) throw new ExperiencesLawError(`experiences: "${id}" is not a category`);
  return found.label;
}

export class ExperiencesLawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExperiencesLawError';
  }
}

/** THE LAW. Throws on the first violation; returns the violations list when asked not to throw. `rows` is injectable for tests. */
export function experiencesLaw(opts: { throwOnFail?: boolean; rows?: readonly Experience[] } = {}): string[] {
  const violations: string[] = [];
  const rows = opts.rows ?? EXPERIENCES;
  const ids = new Set<string>();
  const editions = new Set<string>();
  const wantKeys = [...EXPERIENCE_FIELDS].sort().join(',');
  for (const row of rows) {
    const who = row.id || '(no id)';
    const keys = Object.keys(row).sort().join(',');
    if (keys !== wantKeys) violations.push(`${who}: keys are [${Object.keys(row).join(', ')}] — a row carries exactly the seventeen ruled fields`);
    if (ids.has(row.id)) violations.push(`${who}: duplicate id`);
    ids.add(row.id);
    if (!isExperienceCategoryId(row.category)) violations.push(`${who}: category "${row.category}" is not in EXPERIENCE_CATEGORIES`);
    for (const [field, value] of Object.entries({ name: row.name, venue: row.venue, city: row.city, country: row.country, sourceName: row.sourceName })) {
      if (typeof value !== 'string' || value.trim() === '') violations.push(`${who}: empty ${field}`);
    }
    for (const [field, value] of Object.entries({ venue: row.venue, city: row.city })) {
      if (value === VENUE_NOT_FIXED && row.status !== 'not_announced') violations.push(`${who}: ${field} is "${VENUE_NOT_FIXED}" on a row whose status is ${row.status} — not fixed is allowed only while not_announced`);
    }
    if (!/^[A-Z]{2}$/.test(row.countryCode)) violations.push(`${who}: countryCode "${row.countryCode}" is not two upper-case letters (ISO-2)`);
    if (typeof row.sourceUrl !== 'string' || !row.sourceUrl.startsWith('https://')) violations.push(`${who}: sourceUrl "${row.sourceUrl}" does not start with https://`);
    if (!isIsoDate(row.checkedOn)) violations.push(`${who}: checkedOn "${row.checkedOn}" is not YYYY-MM-DD`);
    const dated = row.start !== null || row.end !== null;
    if (dated) {
      if (!isIsoDate(row.start) || !isIsoDate(row.end)) violations.push(`${who}: start "${row.start}" and end "${row.end}" are not both YYYY-MM-DD (or both null)`);
      else if (row.start > row.end) violations.push(`${who}: start ${row.start} is after end ${row.end}`);
    }
    if ((row.status === 'announced' || row.status === 'conflict') && !dated) violations.push(`${who}: status ${row.status} with null dates — an announced or conflicting edition carries its window`);
    if (row.status === 'not_announced' && dated) violations.push(`${who}: status not_announced with dates ${row.start} – ${row.end} — a dated edition is announced or in conflict`);
    if (row.windowKind === 'swell' && row.status !== 'announced') violations.push(`${who}: windowKind swell on a row whose status is ${row.status} — a swell call needs an announced window`);
    const edition = `${row.category} · ${row.name} · ${row.start ?? 'null'}`;
    if (editions.has(edition)) violations.push(`${who}: shares (category, name, start) "${edition}" with another row`);
    editions.add(edition);
  }
  if (violations.length && opts.throwOnFail !== false) throw new ExperiencesLawError(`EXPERIENCES LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

experiencesLaw();

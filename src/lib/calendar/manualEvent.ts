/**
 * EVENT-01 — A HAND-ENTERED CALENDAR EVENT. Pure: no database, no clock, no
 * vendor. The route supplies the user and the store; everything that decides
 * what the row CONTAINS is here, so a test can check it without a database.
 *
 * WHY IT EXISTS. DAY-01's audit found /api/calendar is GET-only — no form, no
 * route, no programmatic path writes a calendar_event by hand. Every event on
 * the calendar arrives from a trip commit, an agenda item or a budget-module
 * row, so the founder could plan a trip but not a Tuesday.
 *
 * WHAT IT NEVER DOES. It never defaults a cost, a time or a category. A field
 * the user did not choose is NULL, and null renders blank in DAY-01's day view
 * and is counted out of the day's total. An empty box is not a zero.
 *
 * ONEOFF-01: the calendar authors nothing, and POST is gone from the route.
 * This builder now serves ONE verb — PATCH, the correction of a row that
 * already exists — and the category census below is untouched: it describes
 * what the existing writers put in the column, which is what those rows hold.
 */

import { MANUAL_EVENT_SOURCE } from './sources';

/**
 * THE CATEGORY CENSUS (EVENT-01 STEP 0.3) — every (category, icon, color) the
 * existing writers put in calendar_events, gathered so a hand-entered event
 * chooses from what the grid already renders and never invents a palette.
 *
 *   trip        ✈️ cyan     trips/[id]/commit/route.ts:192
 *   lodging     🏨 cyan  ┐
 *   flight      ✈️ cyan  │
 *   transfer    🚕 cyan  ├ trips/[id]/vendor-commit/route.ts:404-407 (the option
 *   vehicle     🏍️ cyan  │  types; the row's category is 'trip', the ICON varies)
 *   activity    🎯 cyan  ┘
 *   home        🏠 orange  home/[id]/route.ts:87
 *   shopping    🛒 pink    shopping/[id]/route.ts:84 · shopping/commit/route.ts:85
 *   personal    👤 purple ┐
 *   auto        🚗 gray   ├ budget/[module]/[id]/route.ts:22-27 (MODULE_MARK)
 *   growth      📚 blue   │
 *   health      💪 green  ┘
 *   build       🧱 blue   ┐
 *   fitness     💪 green  │
 *   trading     📊 purple ├ agenda/[id]/route.ts:73-80 (categoryIcons/categoryColors)
 *   community   🤝 orange │
 *   vehicle     🚗 gray   ┘  (agenda's 'vehicle' is a CATEGORY; the trip option
 *                            type 🏍️ is only an ICON on a row whose category is
 *                            'trip', so the census keys 'vehicle' to agenda's 🚗)
 *
 * lodging / transfer / activity are in the list as CHOICES — their icons are
 * already on the grid (vendor-commit writes them into `icon`), and their rows'
 * category is 'trip'. Nothing else writes them as a category, which is why the
 * build law checks only the other direction: every category another writer puts
 * in the column must be here.
 *
 * A NOTE ON `color`: nothing reads calendar_events.color. The grid colours a
 * tile by SOURCE (HubCalendar HUB_GRID_CONFIG), and DAY-01's day view shows the
 * row's own ICON falling back to the source's. The column is written anyway,
 * with the census value, so a hand-entered row is indistinguishable in shape
 * from every other row rather than carrying a null nobody chose.
 */
export interface EventCategory {
  readonly category: string;
  readonly icon: string;
  readonly color: string;
  /** Where the repo already writes this trio. */
  readonly evidence: string;
}

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  { category: 'trip',      icon: '✈️', color: 'cyan',   evidence: 'src/app/api/trips/[id]/commit/route.ts:192' },
  { category: 'lodging',   icon: '🏨', color: 'cyan',   evidence: 'src/app/api/trips/[id]/vendor-commit/route.ts:405' },
  { category: 'transfer',  icon: '🚕', color: 'cyan',   evidence: 'src/app/api/trips/[id]/vendor-commit/route.ts:405' },
  { category: 'activity',  icon: '🎯', color: 'cyan',   evidence: 'src/app/api/trips/[id]/vendor-commit/route.ts:405' },
  { category: 'home',      icon: '🏠', color: 'orange', evidence: 'src/app/api/home/[id]/route.ts:87' },
  { category: 'shopping',  icon: '🛒', color: 'pink',   evidence: 'src/app/api/shopping/commit/route.ts:85' },
  { category: 'personal',  icon: '👤', color: 'purple', evidence: 'src/app/api/budget/[module]/[id]/route.ts:23' },
  { category: 'auto',      icon: '🚗', color: 'gray',   evidence: 'src/app/api/budget/[module]/[id]/route.ts:24' },
  { category: 'growth',    icon: '📚', color: 'blue',   evidence: 'src/app/api/budget/[module]/[id]/route.ts:25' },
  { category: 'health',    icon: '💪', color: 'green',  evidence: 'src/app/api/budget/[module]/[id]/route.ts:26' },
  { category: 'build',     icon: '🧱', color: 'blue',   evidence: 'src/app/api/agenda/[id]/route.ts:74' },
  { category: 'fitness',   icon: '💪', color: 'green',  evidence: 'src/app/api/agenda/[id]/route.ts:74' },
  { category: 'trading',   icon: '📊', color: 'purple', evidence: 'src/app/api/agenda/[id]/route.ts:74' },
  { category: 'community', icon: '🤝', color: 'orange', evidence: 'src/app/api/agenda/[id]/route.ts:75' },
  { category: 'vehicle',   icon: '🚗', color: 'gray',   evidence: 'src/app/api/agenda/[id]/route.ts:75' },
] as const;

const BY_CATEGORY = new Map(EVENT_CATEGORIES.map((c) => [c.category, c]));

/** The census entry for a category, or null when it is not one the app writes. */
export function categoryOf(name: string | null | undefined): EventCategory | null {
  return name ? BY_CATEGORY.get(name) ?? null : null;
}

/** The form's input. Everything optional is genuinely optional — see the header. */
export interface ManualEventInput {
  title: string;
  /** ISO 'YYYY-MM-DD'. */
  date: string;
  /** 'HH:MM', or null/absent for an untimed event (DAY-01 groups those at the top). */
  startTime?: string | null;
  endTime?: string | null;
  /** One of EVENT_CATEGORIES. */
  category: string;
  /** Dollars. Absent means NO COST RECORDED — never 0. */
  cost?: number | null;
  location?: string | null;
  /** Four digits, from the user's chart. Absent when there is no chart to pick from. */
  coaCode?: string | null;
  /** EVENT-01 STEP 4: entered by hand, because the app adds no geocoder here. */
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
}

/** The row the writer hands the store — the calendar_events column set it fills. */
export interface ManualEventRow {
  user_id: string;
  source: string;
  source_id: null;
  title: string;
  description: string | null;
  category: string;
  icon: string;
  color: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  coa_code: string | null;
  budget_amount: number | null;
  is_recurring: false;
  recurrence_rule: null;
}

export type BuildResult =
  | { ok: true; row: ManualEventRow }
  | { ok: false; reason: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** chart_of_accounts.code holds FOUR DIGITS — the entity letter renders, it is never stored (src/lib/coa/scheme.ts:6-8). */
const COA_CODE = /^\d{4}$/;

function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** A number the user typed, or null when the box was empty. NEVER 0 for empty. */
function optionalNumber(v: unknown): number | null | 'bad' {
  if (v === null || v === undefined || v === '') return null;
  if (!num(v)) return 'bad';
  return v;
}

/**
 * Validate and build. `userId` comes from the route. Returns the refusal's
 * reason rather than throwing, so the route can answer 400 with words the
 * person can act on.
 */
export function buildManualEvent(input: ManualEventInput, userId: string): BuildResult {
  const title = (input?.title ?? '').trim();
  if (!title) return { ok: false, reason: 'A title is required.' };
  if (title.length > 255) return { ok: false, reason: 'A title is at most 255 characters.' };

  if (!ISO_DATE.test(input?.date ?? '')) return { ok: false, reason: 'A date (YYYY-MM-DD) is required.' };
  if (Number.isNaN(new Date(`${input.date}T00:00:00.000Z`).getTime())) return { ok: false, reason: 'The date is not a real date.' };

  const cat = categoryOf(input?.category);
  if (!cat) {
    return { ok: false, reason: `Category must be one the calendar already renders: ${EVENT_CATEGORIES.map((c) => c.category).join(', ')}.` };
  }

  // Times are optional and independent of each other only in one direction: an
  // end without a start has nothing to end, and the day view would group it
  // with the untimed events while printing a finish — so it is refused.
  const start = input.startTime ?? null;
  const end = input.endTime ?? null;
  if (start !== null && start !== '' && !HHMM.test(start)) return { ok: false, reason: 'The start time must be HH:MM (24-hour).' };
  if (end !== null && end !== '' && !HHMM.test(end)) return { ok: false, reason: 'The end time must be HH:MM (24-hour).' };
  const startTime = start === '' ? null : start;
  const endTime = end === '' ? null : end;
  if (endTime !== null && startTime === null) return { ok: false, reason: 'An end time needs a start time.' };
  if (startTime !== null && endTime !== null && endTime <= startTime) {
    return { ok: false, reason: 'The end time is not after the start time.' };
  }

  const cost = optionalNumber(input.cost);
  if (cost === 'bad') return { ok: false, reason: 'The expected cost must be a number — leave it empty if there is none.' };
  if (cost !== null && cost < 0) return { ok: false, reason: 'The expected cost cannot be negative.' };

  const coaRaw = (input.coaCode ?? '').trim();
  if (coaRaw && !COA_CODE.test(coaRaw)) {
    return { ok: false, reason: 'An account code is four digits — the entity letter is how it renders, not how it is stored.' };
  }

  // Coordinates are all-or-nothing: half a pair is not a place, and DAY-01's
  // map would list it under "no location set" anyway.
  const lat = optionalNumber(input.latitude);
  const lon = optionalNumber(input.longitude);
  if (lat === 'bad' || lon === 'bad') return { ok: false, reason: 'Latitude and longitude must be numbers — leave both empty if you do not have them.' };
  if ((lat === null) !== (lon === null)) return { ok: false, reason: 'Enter both latitude and longitude, or neither.' };
  if (lat !== null && (lat < -90 || lat > 90)) return { ok: false, reason: 'Latitude is between -90 and 90.' };
  if (lon !== null && (lon < -180 || lon > 180)) return { ok: false, reason: 'Longitude is between -180 and 180.' };

  const location = (input.location ?? '').trim();
  if (location.length > 255) return { ok: false, reason: 'A location is at most 255 characters.' };

  return {
    ok: true,
    row: {
      user_id: userId,
      source: MANUAL_EVENT_SOURCE,
      // A manual event is nobody else's record — it points at no other row.
      source_id: null,
      title,
      description: (input.description ?? '').trim() || null,
      category: cat.category,
      icon: cat.icon,
      color: cat.color,
      start_date: input.date,
      start_time: startTime,
      end_time: endTime,
      location: location || null,
      latitude: lat,
      longitude: lon,
      coa_code: coaRaw || null,
      budget_amount: cost,
      // EVENT-02: the recurrence columns exist (is_recurring, recurrence_rule)
      // and are deliberately NOT used here. A recurring hand-entered event is
      // its own ruling — every reader would have to expand occurrences, which
      // nothing on this path does today.
      is_recurring: false,
      recurrence_rule: null,
    },
  };
}

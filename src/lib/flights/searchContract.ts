/**
 * searchContract — THE ROUTE FORWARDS THE CONTRACT (FLIGHT-01, 2026-09-22).
 *
 * The subset of the vendor's FlightSearchFilters and FlightSort the screen
 * exposes, validated to the vendor's documented values (docs.liteapi.travel,
 * POST /flights/rates: maxStops -1|0|1|2; cabinClass the four classes;
 * cabinClassMatch 'exactly'|'at_least'; the booleans; HH:MM windows; sortBy
 * price|duration|departure|arrival|stops; sortOrder asc|desc). Every key not
 * listed is refused BY NAME; a bad value is refused by name; an absent key is
 * not sent, so the vendor's own default applies — no default is invented here.
 * Pure: the search route calls these between its two guards, so a refusal
 * never consumes a daily-cap slot.
 */

import type { FlightSearchFilters, FlightSort } from '@/lib/liteapiFlightsClient';

export const FILTER_CABIN_CLASSES = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] as const;
export const FILTER_KEYS = ['cabinClass', 'cabinClassMatch', 'maxStops', 'refundableOnly', 'changeableOnly', 'includesCheckedBag', 'departureTimeAfter', 'departureTimeBefore'] as const;
export const SORT_BY = ['price', 'duration', 'departure', 'arrival', 'stops'] as const;
export const SORT_ORDER = ['asc', 'desc'] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseFilters(raw: unknown): { filters: FlightSearchFilters } | { error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { error: 'filters must be an object' };
  const input = raw as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!(FILTER_KEYS as readonly string[]).includes(key)) return { error: `filters.${key} is not a supported filter (supported: ${FILTER_KEYS.join(', ')})` };
  }
  const filters: FlightSearchFilters = {};
  if (input.cabinClass !== undefined) {
    const c = typeof input.cabinClass === 'string' ? input.cabinClass.trim().toUpperCase() : '';
    if (!(FILTER_CABIN_CLASSES as readonly string[]).includes(c)) return { error: `filters.cabinClass must be one of ${FILTER_CABIN_CLASSES.join(', ')}` };
    filters.cabinClass = c;
  }
  if (input.cabinClassMatch !== undefined) {
    if (input.cabinClassMatch !== 'exactly' && input.cabinClassMatch !== 'at_least') return { error: "filters.cabinClassMatch must be 'exactly' or 'at_least'" };
    filters.cabinClassMatch = input.cabinClassMatch;
  }
  if (input.maxStops !== undefined) {
    if (![-1, 0, 1, 2].includes(input.maxStops as number)) return { error: 'filters.maxStops must be -1, 0, 1 or 2' };
    filters.maxStops = input.maxStops as number;
  }
  for (const key of ['refundableOnly', 'changeableOnly', 'includesCheckedBag'] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'boolean') return { error: `filters.${key} must be true or false` };
      filters[key] = input[key] as boolean;
    }
  }
  for (const key of ['departureTimeAfter', 'departureTimeBefore'] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'string' || !HHMM.test(input[key] as string)) return { error: `filters.${key} must be HH:MM (24-hour)` };
      filters[key] = input[key] as string;
    }
  }
  return { filters };
}

export function parseSort(raw: unknown): { sort: FlightSort } | { error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { error: 'sort must be an object' };
  const input = raw as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (key !== 'sortBy' && key !== 'sortOrder') return { error: `sort.${key} is not a supported sort field (supported: sortBy, sortOrder)` };
  }
  if (!(SORT_BY as readonly unknown[]).includes(input.sortBy)) return { error: `sort.sortBy must be one of ${SORT_BY.join(', ')}` };
  const sort: FlightSort = { sortBy: input.sortBy as FlightSort['sortBy'] };
  if (input.sortOrder !== undefined) {
    if (!(SORT_ORDER as readonly unknown[]).includes(input.sortOrder)) return { error: "sort.sortOrder must be 'asc' or 'desc'" };
    sort.sortOrder = input.sortOrder as FlightSort['sortOrder'];
  }
  return { sort };
}

/**
 * ONEOFF-01 — THE ROUTINE'S INPUT, VALIDATED IN ONE PLACE. Pure: no request, no
 * database, no NextResponse, so a test can check every refusal without a route.
 *
 * WHY IT EXISTS. Two step writers (POST /api/operations/routines/[id]/steps and
 * PATCH /api/operations/routines/steps/[stepId]) each held their own copy of the
 * LINES-01 amount rule, and ONEOFF-01 adds a third writer of lines — the create
 * route, which now takes a routine's lines WITH the routine so a one-off is
 * authored whole. Three copies of one rule would drift; this is the one.
 *
 * WHAT IT NEVER DOES. A blank amount is null, never 0. Half a coordinate pair is
 * refused, never completed. Nothing is defaulted.
 */

/** A refusal the route turns into a 400, naming the field. */
export interface InputRefusal { field: string; message: string }

/** A trimmed string, or null when the value is not a non-empty string. */
export function trimNullable(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * LINES-01: the line's own amount. Blank → null, never 0. A non-negative decimal
 * with at most two places, kept as the string Prisma's Decimal takes.
 */
export function parseBudgetAmountOrNull(v: unknown): { value: string | null } | { error: InputRefusal } {
  if (v === undefined || v === null || v === '') return { value: null };
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return { error: { field: 'budget_amount', message: 'must be a non-negative amount with at most 2 decimals' } };
  }
  return { value: s };
}

/** A line as the create route writes it — the columns a step row takes. */
export interface ParsedLine {
  activity: string;
  budget_amount: string | null;
  coa_code: string | null;
}

/**
 * One line authored with a routine: an activity (required), and its own amount
 * and account (each optional, each blank → null). The code is trimmed and
 * length-checked here and validated against the ENTITY'S chart by the same
 * picker the routine uses (CoaSelect), so a code never arrives typed.
 */
export function parseLineInput(raw: unknown, index = 0): { value: ParsedLine } | { error: InputRefusal } {
  const at = `lines[${index}]`;
  if (!raw || typeof raw !== 'object') return { error: { field: at, message: 'a line is an object' } };
  const o = raw as Record<string, unknown>;
  const activity = trimNullable(o.activity);
  if (!activity) return { error: { field: `${at}.activity`, message: 'activity is required' } };
  if (activity.length > 200) return { error: { field: `${at}.activity`, message: 'activity exceeds 200 characters' } };
  const amount = parseBudgetAmountOrNull(o.budget_amount);
  if ('error' in amount) return { error: { field: `${at}.budget_amount`, message: amount.error.message } };
  const coaCode = trimNullable(o.coa_code);
  if (coaCode && coaCode.length > 50) return { error: { field: `${at}.coa_code`, message: 'coa_code exceeds 50 characters' } };
  return { value: { activity, budget_amount: amount.value, coa_code: coaCode } };
}

/** The lines of a routine, in order. Absent or empty → none (a stepless routine). */
export function parseLinesInput(raw: unknown): { value: ParsedLine[] } | { error: InputRefusal } {
  if (raw === undefined || raw === null) return { value: [] };
  if (!Array.isArray(raw)) return { error: { field: 'lines', message: 'lines is an array' } };
  const out: ParsedLine[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const r = parseLineInput(raw[i], i);
    if ('error' in r) return r;
    out.push(r.value);
  }
  return { value: out };
}

/** The routine's place as stored: location text and a coordinate pair, or nulls. */
export interface ParsedPlace {
  location: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** A number the user typed or picked, or null when the box was empty. NEVER 0 for empty. */
function optionalNumber(v: unknown): number | null | 'bad' {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN;
  return Number.isFinite(n) ? n : 'bad';
}

/**
 * GEO-01's rule, kept: coordinates are all-or-nothing — half a pair is not a
 * place — and each half is in range. The location text saves on its own.
 */
export function parsePlaceInput(raw: { location?: unknown; latitude?: unknown; longitude?: unknown }): { value: ParsedPlace } | { error: InputRefusal } {
  const location = trimNullable(raw.location);
  if (location && location.length > 255) return { error: { field: 'location', message: 'a location is at most 255 characters' } };
  const lat = optionalNumber(raw.latitude);
  const lon = optionalNumber(raw.longitude);
  if (lat === 'bad' || lon === 'bad') return { error: { field: 'latitude', message: 'latitude and longitude must be numbers — leave both empty if you do not have them' } };
  if ((lat === null) !== (lon === null)) return { error: { field: 'longitude', message: 'enter both latitude and longitude, or neither' } };
  if (lat !== null && (lat < -90 || lat > 90)) return { error: { field: 'latitude', message: 'latitude is between -90 and 90' } };
  if (lon !== null && (lon < -180 || lon > 180)) return { error: { field: 'longitude', message: 'longitude is between -180 and 180' } };
  return { value: { location, latitude: lat, longitude: lon } };
}

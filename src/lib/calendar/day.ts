/**
 * DAY-01 STEP 2/3/4 — THE DAY, BUILT. Pure: no fetch, no clock, no React, so a
 * test can check the ordering, the totals and the coverage counts without a
 * browser.
 *
 * THE RULE THAT SHAPES EVERY FUNCTION HERE: a number the app does not have is
 * NOT zero. A missing budget_amount is blank AND is counted OUT of the day's
 * total, so the total always arrives with the coverage that earned it
 * ("$340 planned across 5 of 8 events"). A missing coordinate does not drop the
 * event — it lists under the map. A task with no cost shows no cost.
 */

/** One event as the day view needs it. A subset of the grid's CalendarEvent. */
export interface DayEventInput {
  id: string;
  source: string;
  title: string;
  icon?: string | null;
  startDate: string;
  endDate?: string | null;
  /** "HH:MM", or null/undefined for an untimed (all-day) event. */
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  /** Dollars. NULL/undefined means "no amount recorded" — never 0. */
  budgetAmount?: number | null;
  coaCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** One row of the day, in reading order. */
export interface DayRow {
  id: string;
  source: string;
  title: string;
  icon: string | null;
  /** "HH:MM" or null when the event carries no time. */
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  /** Dollars, or null — and null RENDERS BLANK, never "$0". */
  expected: number | null;
  coaCode: string | null;
  /** Present only when BOTH coordinates are stored. */
  pin: { lat: number; lon: number } | null;
  /** True when the event has no time THAT APPLIES TO THIS DAY — it groups at the top. */
  untimed: boolean;
  /**
   * How this row meets the day being viewed. A multi-day stay carries ONE
   * start_time (check-in, on its first day) and ONE end_time (check-out, on its
   * last) — so on a middle night neither is this day's time, and printing them
   * would tell the reader the hotel starts and ends today. It does not.
   */
  span: 'single' | 'starts' | 'continues' | 'ends';
}

/** A total, and how much of the day it actually covers. */
export interface CoveredTotal {
  /** The sum over the rows that carried an amount. */
  total: number;
  /** How many rows carried one. */
  covered: number;
  /** How many rows there are in total. */
  of: number;
}

const HHMM = /^(\d{1,2}):(\d{2})/;

/** "HH:MM" → minutes past midnight, or null when it is not a time. */
export function minutesOf(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = HHMM.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** A finite number, or null. `0` is a real amount; `null` is the absence of one. */
function amount(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** A stored coordinate pair, or null when either half is missing. */
function pinOf(e: DayEventInput): { lat: number; lon: number } | null {
  const lat = amount(e.latitude);
  const lon = amount(e.longitude);
  if (lat === null || lon === null) return null;
  // 0,0 is in the Atlantic and is what an empty Decimal column reads as when
  // something wrote a zero. It is not a place anyone plans a day at, so it is
  // treated as "no location set" rather than dropped silently or plotted.
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

/**
 * The day's rows, in reading order: UNTIMED FIRST (grouped as "no time set"),
 * then timed events by start time, ties broken by title so the order is stable.
 */
export function buildDay(events: readonly DayEventInput[], dayKey?: string): DayRow[] {
  const rows: DayRow[] = events.map((e) => {
    const first = (e.startDate || '').slice(0, 10);
    const last = (e.endDate || e.startDate || '').slice(0, 10);
    const multi = !!last && last !== first;
    // With no dayKey the row is judged on its own (the leaf's tests do this);
    // with one, a spanning row is placed against the day being read.
    const onFirst = !dayKey || dayKey === first;
    const onLast = !dayKey || dayKey === last;
    const span: DayRow['span'] = !multi ? 'single' : onFirst ? 'starts' : onLast ? 'ends' : 'continues';

    // Check-in belongs to the first day, check-out to the last. On a middle day
    // neither is today's time, so the row shows none and reads as all-day —
    // which is exactly how the grid draws it.
    const startRaw = span === 'single' || span === 'starts' ? e.startTime : null;
    const endRaw = span === 'single' || span === 'ends' ? e.endTime : null;
    const start = minutesOf(startRaw);
    return {
      id: e.id,
      source: e.source,
      title: e.title,
      icon: e.icon ?? null,
      startTime: start === null ? null : (startRaw as string).slice(0, 5),
      endTime: minutesOf(endRaw) === null ? null : (endRaw as string).slice(0, 5),
      location: e.location ?? null,
      expected: amount(e.budgetAmount),
      coaCode: e.coaCode ?? null,
      pin: pinOf(e),
      untimed: start === null,
      span,
    };
  });
  return rows.sort((a, b) => {
    if (a.untimed !== b.untimed) return a.untimed ? -1 : 1;
    const am = minutesOf(a.startTime);
    const bm = minutesOf(b.startTime);
    if (am !== null && bm !== null && am !== bm) return am - bm;
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
  });
}

/**
 * The day's expected total AND its coverage. Rows with no amount are excluded
 * from the sum and counted, so the screen can say how complete the number is.
 * A total is never rendered without this — that is a build law.
 */
export function expectedTotal(rows: readonly { expected: number | null }[]): CoveredTotal {
  let total = 0;
  let covered = 0;
  for (const r of rows) {
    if (r.expected === null) continue;
    total += r.expected;
    covered += 1;
  }
  return { total: Math.round(total * 100) / 100, covered, of: rows.length };
}

/** "$340 planned across 5 of 8 events" — the total and its coverage, one line. */
export function coverageLine(t: CoveredTotal, noun = 'event', verb = 'planned'): string {
  const money = `$${t.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const plural = t.of === 1 ? noun : `${noun}s`;
  return `${money} ${verb} across ${t.covered} of ${t.of} ${plural}`;
}

/** The day's pinned rows in route order (time order), and the ones with no place. */
export function mapSplit(rows: readonly DayRow[]): { pinned: DayRow[]; unplaced: DayRow[] } {
  const pinned: DayRow[] = [];
  const unplaced: DayRow[] = [];
  // `rows` arrives from buildDay, which is already in time order — route order
  // IS time order, so nothing re-sorts here.
  for (const r of rows) (r.pin ? pinned : unplaced).push(r);
  return { pinned, unplaced };
}

/**
 * Project a day's pins into a unit square for the small map, preserving their
 * relative geometry. Longitude is x, latitude is y (north up). A single pin, or
 * pins that share a coordinate, land in the middle rather than dividing by zero.
 *
 * NO PROVIDER, NO TILES, NO GEOCODING — this plots only what is stored.
 */
export function projectPins(pins: readonly { lat: number; lon: number }[]): { x: number; y: number }[] {
  if (pins.length === 0) return [];
  const lats = pins.map((p) => p.lat);
  const lons = pins.map((p) => p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const spanLat = maxLat - minLat;
  const spanLon = maxLon - minLon;
  return pins.map((p) => ({
    x: spanLon === 0 ? 0.5 : (p.lon - minLon) / spanLon,
    y: spanLat === 0 ? 0.5 : 1 - (p.lat - minLat) / spanLat,
  }));
}

// ── STEP 4 — THE DAY'S PLAN AND ITS TASKS ──────────────────────────────────
// daily_plans.tasks is an untyped Json column written by Tasks
// (src/app/api/ops/daily-plan/route.ts:168, the only writer). Its shape today is
// { id, text, priority, completed, order } — NO cost field, on any task, ever.
// The ruling says "a task carrying a cost shows it", so a cost is read when one
// is present and nothing is shown when it is not. Nothing here writes.

/** One task of the day, as the read surface needs it. */
export interface DayTask {
  id: string;
  text: string;
  completed: boolean;
  /** Dollars, when the stored task carries one. Null is the normal case today. */
  cost: number | null;
}

/**
 * Read the day's tasks out of the Json column. A row that is not an object, or
 * carries no text, is skipped — it is not a task, and inventing one would be
 * fabricating the day.
 */
export function readTasks(raw: unknown): DayTask[] {
  if (!Array.isArray(raw)) return [];
  const out: DayTask[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const text = typeof o.text === 'string' ? o.text : null;
    if (!text) continue;
    // The writer's shape has no cost. If one is ever added under any of these
    // names it shows; until then every task's cost is null and is counted out
    // of the tasks total, exactly like an event with no budget_amount.
    const cost = amount(o.cost as number | undefined) ?? amount(o.amount as number | undefined) ?? amount(o.budget_amount as number | undefined);
    out.push({
      id: typeof o.id === 'string' ? o.id : text,
      text,
      completed: o.completed === true,
      cost,
    });
  }
  const order = (t: unknown): number => {
    const o = (t ?? {}) as Record<string, unknown>;
    return typeof o.order === 'number' ? o.order : Number.MAX_SAFE_INTEGER;
  };
  const rawArr = raw as unknown[];
  return out.sort((a, b) => {
    const ai = rawArr.findIndex((r) => (r as Record<string, unknown>)?.text === a.text);
    const bi = rawArr.findIndex((r) => (r as Record<string, unknown>)?.text === b.text);
    return order(rawArr[ai]) - order(rawArr[bi]);
  });
}

/** The tasks' own total and coverage — reported BESIDE the events', never merged. */
export function tasksTotal(tasks: readonly DayTask[]): CoveredTotal {
  return expectedTotal(tasks.map((t) => ({ expected: t.cost })));
}

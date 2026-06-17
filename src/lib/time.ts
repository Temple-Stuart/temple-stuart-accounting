/**
 * lib/time.ts — the SINGLE canonical zone↔UTC-instant converter (PR-tz-2).
 *
 * The one place the platform converts between an IANA-zoned wall-clock and a true UTC
 * instant. Native `Intl` only — no library. The DST-correct offset math is lifted verbatim
 * from `lib/operations/rruleHelpers.ts` (`getTimezoneOffsetMs`, whose sign was fixed in
 * PR-Ops-5.7). DST is handled because `Intl.DateTimeFormat` is evaluated per-instant — never
 * a hardcoded offset.
 *
 * Direction is ALWAYS explicit and a bad zone FAILS LOUD: an empty/non-string zone throws
 * (Intl would silently fall back to the system zone for ''), and a genuinely-invalid IANA
 * name makes Intl throw RangeError. There is no UTC/hardcoded-zone default anywhere.
 *
 * Future dedup: `rruleHelpers` still keeps its own private copy of the offset math. Once
 * this module is proven in production, point rruleHelpers at it. NOT refactored here — that
 * path is load-bearing (the PR-Ops-5.7 fix) and out of this PR's scope.
 *
 * Known limit (matches rruleHelpers exactly): the offset is sampled at the "floating"
 * instant, so a wall-clock that lands inside a DST transition gap/overlap can be off by an
 * hour. Acceptable for flight/itinerary times; not a regression vs the existing pattern.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/** Empty/non-string zone → throw. (Intl silently uses the system zone for '' — must fail loud.) */
function assertZone(ianaZone: string): void {
  if (typeof ianaZone !== 'string' || ianaZone.trim() === '') {
    throw new Error(`lib/time: ianaZone must be a non-empty IANA name, got ${JSON.stringify(ianaZone)}`);
  }
}

/**
 * Milliseconds offset between UTC and `ianaZone` at `instant`. Positive when the zone is
 * BEHIND UTC (America/Los_Angeles → +25_200_000 in PDT, +28_800_000 in PST). DST-correct —
 * `Intl` is applied at this specific instant. Lifted from rruleHelpers.getTimezoneOffsetMs.
 */
function zoneOffsetMs(instant: Date, ianaZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const h = get('hour');
  const tzAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), h === 24 ? 0 : h, get('minute'), get('second'));
  return instant.getTime() - tzAsUtc;
}

/**
 * A wall-clock — `date` 'YYYY-MM-DD' + `time` 'HH:MM' — in `ianaZone` → the true UTC instant.
 * Throws on a bad zone or a malformed date/time (no fallback).
 */
export function zonedToInstant(date: string, time: string, ianaZone: string): Date {
  assertZone(ianaZone);
  const dm = DATE_RE.exec(date);
  if (!dm) throw new Error(`zonedToInstant: date must be 'YYYY-MM-DD', got ${JSON.stringify(date)}`);
  const tm = TIME_RE.exec(time);
  if (!tm) throw new Error(`zonedToInstant: time must be 'HH:MM', got ${JSON.stringify(time)}`);

  const y = Number(dm[1]), mo = Number(dm[2]), d = Number(dm[3]);
  const hh = Number(tm[1]), mm = Number(tm[2]);

  // Place the wall-clock components in UTC (a "floating" instant), then shift by the zone's
  // offset at that point to get the true instant. (Intl below throws for an invalid IANA name.)
  const floatingMs = Date.UTC(y, mo - 1, d, hh, mm, 0);
  const instant = new Date(floatingMs + zoneOffsetMs(new Date(floatingMs), ianaZone));
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`zonedToInstant: invalid result from ${date} ${time} ${ianaZone}`);
  }
  return instant;
}

/**
 * A UTC `instant` → its wall-clock { date 'YYYY-MM-DD', time 'HH:MM' } in `targetZone`.
 * The inverse of zonedToInstant — for tz-3/tz-4 display. Throws on a bad zone or instant.
 */
export function instantToZoned(instant: Date, targetZone: string): { date: string; time: string } {
  assertZone(targetZone);
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new Error(`instantToZoned: instant must be a valid Date, got ${String(instant)}`);
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: targetZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  let hour = get('hour');
  if (hour === '24') hour = '00'; // Intl (hour12:false) can render midnight as '24'
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`,
  };
}

/**
 * CAL-02 (2026-09-27) — A BOOKING CAN BE TAKEN TO ANY CALENDAR APP.
 *
 * The ONE builder of RFC 5545 text (iCalendar). Pure: no import, no clock, no
 * network, no write — it turns the owner's own calendar_events rows into one
 * VCALENDAR with one VEVENT per row, and the two export routes
 * (/api/reservations/[id]/ics, /api/trips/[id]/ics) serve what it returns.
 *
 * EACH VEVENT, FROM THE ROW ONLY:
 *   · UID      — the calendar row's id @templestuart.com (stable across exports,
 *                so a re-import updates the event instead of adding a second);
 *   · DTSTAMP  — the row's updated_at, in UTC (RFC 5545 §3.8.7.2) — NEVER now().
 *                A row with no updated_at gets NO VEVENT and is named in the file
 *                (X-TEMPLESTUART-EXCLUDED), because no stamp can be stated for it;
 *   · DTSTART / DTEND — the row's STATED INSTANT in UTC "Z" form when start_at /
 *                end_at exist (§3.3.5 form #2). Otherwise the row is exported by its
 *                DAYS (VALUE=DATE, §3.3.4): DTEND is the day AFTER end_date, because
 *                an all-day DTEND is non-inclusive (§3.6.1) while the grid draws
 *                end_date inclusive (CalendarGrid.tsx eventsByDateKey). An end before
 *                its start, or no end, writes no DTEND — never an invented one;
 *   · SUMMARY  — the row's title (a cancelled row already reads "Cancelled: …");
 *   · STATUS:CANCELLED — for a row whose status is 'cancelled'; no other STATUS is
 *                asserted;
 *   · DESCRIPTION — only for a row that carries clocks but no instant (a flight
 *                segment: the vendor states local clocks with no zone and nothing
 *                resolves an airport to one) — its stated clocks, in words, and why
 *                the event carries days only. A floating DATE-TIME (§3.3.5 form #1)
 *                is NOT used: it would show the departure clock in the viewer's zone
 *                and span departure-local to arrival-local — an invented duration.
 *
 * TEXT is escaped per §3.3.11 (backslash, semicolon, comma, newline); every line
 * is folded at 75 octets (§3.1) without splitting a UTF-8 character; lines end
 * CRLF.
 */

/** The row, as the export routes select it from calendar_events. */
export interface IcsRow {
  id: string;
  title: string;
  status: string | null;
  /** @db.Date — the day, at UTC midnight. */
  start_date: Date;
  end_date: Date | null;
  /** @db.Time — the clock, on 1970-01-01 UTC. */
  start_time: Date | null;
  end_time: Date | null;
  /** @db.Timestamptz — the stated UTC instant, or null. */
  start_at: Date | null;
  end_at: Date | null;
  updated_at: Date | null;
}

export const ICS_WORDS = {
  prodId: '-//Temple Stuart//Bookings//EN',
  uidDomain: 'templestuart.com',
  noStamp: 'no updated_at on the row — no DTSTAMP can be stated for it, and none is invented',
  daysOnly: 'local times as stated; no time zone is stated, so this event carries its days only',
  departs: 'Departs',
  arrives: 'arrives',
  noArrival: 'no arrival time stated',
} as const;

export interface IcsBuilt {
  /** The whole VCALENDAR, CRLF line endings, folded. */
  text: string;
  /** How many VEVENTs it holds — RFC 5545 §3.6 requires at least one component, so 0 is not a calendar. */
  events: number;
  /** The rows left out, each with its reason (also written into the file). */
  excluded: { id: string; reason: string }[];
}

/** §3.3.11: backslash, semicolon, comma and newline are escaped in a TEXT value. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** UTF-8 octets of one code point. */
function octetsOf(ch: string): number {
  const cp = ch.codePointAt(0) as number;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/**
 * §3.1: a content line longer than 75 octets is split, each continuation starting
 * with one space (which counts toward its own 75). Never inside a UTF-8 character.
 */
export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let used = 0;
  let limit = 75;
  for (const ch of line) {
    const n = octetsOf(ch);
    if (used + n > limit) {
      parts.push(current);
      current = '';
      used = 0;
      limit = 74;
    }
    current += ch;
    used += n;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** "YYYYMMDDTHHMMSSZ" — the instant in UTC. */
function utcStamp(at: Date): string {
  return at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** "YYYY-MM-DD" of a @db.Date value (UTC midnight). */
function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/** "YYYYMMDD". */
function dateValue(key: string): string {
  return key.replace(/-/g, '');
}

/** The day after a "YYYY-MM-DD" — an all-day DTEND is non-inclusive. Calendar days, not a clock. */
function dayAfter(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** "HH:MM" of a @db.Time value. */
function clockOf(t: Date): string {
  return t.toISOString().slice(11, 16);
}

/** The event's time lines — the stated instant, else its days (and the stated clocks in words). */
function whenLines(row: IcsRow): string[] {
  if (row.start_at !== null) {
    const lines = [`DTSTART:${utcStamp(row.start_at)}`];
    if (row.end_at !== null && row.end_at.getTime() > row.start_at.getTime()) lines.push(`DTEND:${utcStamp(row.end_at)}`);
    return lines;
  }
  const start = dayKey(row.start_date);
  const lines = [`DTSTART;VALUE=DATE:${dateValue(start)}`];
  const end = row.end_date === null ? null : dayKey(row.end_date);
  if (end !== null && end >= start) lines.push(`DTEND;VALUE=DATE:${dateValue(dayAfter(end))}`);
  if (row.start_time !== null || row.end_time !== null) {
    const departs = `${ICS_WORDS.departs} ${start}${row.start_time !== null ? ` ${clockOf(row.start_time)}` : ''}`;
    const arrives = row.end_time !== null ? `${ICS_WORDS.arrives} ${end ?? start} ${clockOf(row.end_time)}` : ICS_WORDS.noArrival;
    lines.push(`DESCRIPTION:${escapeIcsText(`${departs} · ${arrives} — ${ICS_WORDS.daysOnly}`)}`);
  }
  return lines;
}

/** The VCALENDAR for these rows, in the order given. */
export function buildIcs(rows: readonly IcsRow[]): IcsBuilt {
  const excluded: IcsBuilt['excluded'] = [];
  const events: string[] = [];
  for (const row of rows) {
    if (row.updated_at === null) {
      excluded.push({ id: row.id, reason: ICS_WORDS.noStamp });
      continue;
    }
    events.push(
      'BEGIN:VEVENT',
      `UID:${row.id}@${ICS_WORDS.uidDomain}`,
      `DTSTAMP:${utcStamp(row.updated_at)}`,
      ...whenLines(row),
      `SUMMARY:${escapeIcsText(row.title)}`,
      ...(row.status === 'cancelled' ? ['STATUS:CANCELLED'] : []),
      'END:VEVENT',
    );
  }
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${ICS_WORDS.prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...excluded.map((e) => `X-TEMPLESTUART-EXCLUDED:${escapeIcsText(`${e.id} — ${e.reason}`)}`),
    ...events,
    'END:VCALENDAR',
  ];
  return { text: `${lines.map(foldIcsLine).join('\r\n')}\r\n`, events: rows.length - excluded.length, excluded };
}

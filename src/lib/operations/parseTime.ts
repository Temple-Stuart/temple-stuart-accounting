import { NextResponse } from 'next/server';

/**
 * Parse an HH:MM time string into a JS Date with a 1970-01-01 anchor
 * (Prisma @db.Time round-trip expects a Date; the date part is ignored).
 * Returns { value: null, error: null } for null/empty input.
 * Returns { value: null, error: 400-response } for invalid format.
 */
export function parseTimeOrNull(
  v: unknown,
  field: string
): { value: Date | null; error: NextResponse | null } {
  if (v === null || v === undefined || v === '') return { value: null, error: null };
  if (typeof v !== 'string') {
    return {
      value: null,
      error: NextResponse.json(
        { error: 'Validation', field, message: 'must be string HH:MM or null' },
        { status: 400 }
      ),
    };
  }
  const match = /^(\d{2}):(\d{2})$/.exec(v);
  if (!match) {
    return {
      value: null,
      error: NextResponse.json(
        { error: 'Validation', field, message: 'must match HH:MM' },
        { status: 400 }
      ),
    };
  }
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return {
      value: null,
      error: NextResponse.json(
        { error: 'Validation', field, message: 'hour 00-23, minute 00-59' },
        { status: 400 }
      ),
    };
  }
  // Prisma @db.Time accepts a Date — 1970-01-01 anchor; Postgres discards the date part.
  const d = new Date(Date.UTC(1970, 0, 1, hh, mm, 0, 0));
  return { value: d, error: null };
}

/**
 * WASHERE-01 (Alex, 2026-10-31) — THE TRIP LOG. Alex's own stops while building
 * this, one row per stop, newest first on the guest landing (WasHereSection.tsx,
 * the MY TRIP act). THIS FILE IS DATA AND PURE FUNCTIONS: no fetch, no env, no
 * clock, no React (the plans.ts rule). Zero imports: server- and client-safe.
 *
 * THE SHAPE. Every row is exactly { id, city, country, countryCode, start, end,
 * experienceId, line, image, writtenOn }:
 *   · start is 'YYYY-MM-DD'; end is 'YYYY-MM-DD' or null — null means still there;
 *   · experienceId names an EXPERIENCES row (src/lib/experiences.ts) when the stop
 *     was around an event, else null — the section draws that event's own block
 *     through the words module, never a retyped date;
 *   · line is Alex's words for the stop, typed once, here;
 *   · image is { src, alt, credit } or null — src a file under public/was-here/
 *     (WASHERE-02 adds the photos; the section draws NO placeholder while null);
 *   · writtenOn is the day the entry was written.
 *
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts,
 * which adds what only it can see — every experienceId exists in EXPERIENCES,
 * every image file exists under public/ at ≤ 400 KB, the landing mounts the
 * section once). It refuses by name: a duplicate id; an empty city, country or
 * line; a countryCode not two upper-case letters; start or writtenOn not
 * 'YYYY-MM-DD'; start after writtenOn (an entry is written after the stop began);
 * an end that is set and before start; more than one row with end null (one place
 * at a time); an image whose src is not /was-here/<slug>.jpg|webp or whose alt or
 * credit is empty; a row whose keys are not exactly the ten above.
 */

export interface WasHereImage {
  /** A file under public/: /was-here/<slug>.jpg or .webp, at most 400 KB (the build checks). */
  src: string;
  alt: string;
  credit: string;
}

export interface WasHereRow {
  id: string;
  city: string;
  country: string;
  /** ISO-2, upper case. */
  countryCode: string;
  start: string;
  /** null — still there. */
  end: string | null;
  /** An EXPERIENCES id when the stop was around an event, else null. */
  experienceId: string | null;
  /** Alex's words, typed once. */
  line: string;
  image: WasHereImage | null;
  writtenOn: string;
}

/** The ten keys every row carries, in the ruled order. */
export const WAS_HERE_FIELDS = ['id', 'city', 'country', 'countryCode', 'start', 'end', 'experienceId', 'line', 'image', 'writtenOn'] as const;

/** Where a stop's photo may live: public/was-here/<slug>.jpg or .webp. */
export const WAS_HERE_IMAGE_SRC = /^\/was-here\/[a-z0-9-]+\.(jpg|webp)$/;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const WAS_HERE: readonly WasHereRow[] = [
  { id: 'siargao-2026', city: 'General Luna, Siargao', country: 'Philippines', countryCode: 'PH', start: '2026-10-22', end: null, experienceId: 'philippines-pro-2026', line: 'I landed in Siargao in the middle of the WSL by luck. Don\'t get lucky. Book around it.', image: null, writtenOn: '2026-10-31' },
];

export class WasHereLawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WasHereLawError';
  }
}

/** THE LAW. Throws on the first violation; returns the violations list when asked not to throw. `rows` is injectable for tests. */
export function wasHereLaw(opts: { throwOnFail?: boolean; rows?: readonly WasHereRow[] } = {}): string[] {
  const violations: string[] = [];
  const rows = opts.rows ?? WAS_HERE;
  const ids = new Set<string>();
  const wantKeys = [...WAS_HERE_FIELDS].sort().join(',');
  for (const row of rows) {
    const who = row.id || '(no id)';
    const keys = Object.keys(row).sort().join(',');
    if (keys !== wantKeys) violations.push(`${who}: keys are [${Object.keys(row).join(', ')}] — a row carries exactly the ten ruled fields`);
    if (ids.has(row.id)) violations.push(`${who}: duplicate id`);
    ids.add(row.id);
    for (const [field, value] of Object.entries({ city: row.city, country: row.country, line: row.line })) {
      if (typeof value !== 'string' || value.trim() === '') violations.push(`${who}: empty ${field}`);
    }
    if (!/^[A-Z]{2}$/.test(row.countryCode)) violations.push(`${who}: countryCode "${row.countryCode}" is not two upper-case letters (ISO-2)`);
    for (const [field, value] of Object.entries({ start: row.start, writtenOn: row.writtenOn })) {
      if (typeof value !== 'string' || !ISO_DATE.test(value)) violations.push(`${who}: ${field} "${value}" is not YYYY-MM-DD`);
    }
    if (ISO_DATE.test(row.start) && ISO_DATE.test(row.writtenOn) && row.start > row.writtenOn) violations.push(`${who}: start ${row.start} is after writtenOn ${row.writtenOn} — an entry is written after the stop began`);
    if (row.end !== null) {
      if (typeof row.end !== 'string' || !ISO_DATE.test(row.end)) violations.push(`${who}: end "${row.end}" is not YYYY-MM-DD (or null)`);
      else if (row.end < row.start) violations.push(`${who}: end ${row.end} is before start ${row.start}`);
    }
    if (row.image !== null) {
      if (typeof row.image.src !== 'string' || !WAS_HERE_IMAGE_SRC.test(row.image.src)) violations.push(`${who}: image src "${row.image.src}" is not /was-here/<slug>.jpg or .webp`);
      for (const [field, value] of Object.entries({ alt: row.image.alt, credit: row.image.credit })) {
        if (typeof value !== 'string' || value.trim() === '') violations.push(`${who}: image ${field} is empty`);
      }
    }
  }
  const here = rows.filter((r) => r.end === null);
  if (here.length > 1) violations.push(`${here.length} rows with end null [${here.map((r) => r.id).join(', ')}] — one place at a time`);
  if (violations.length && opts.throwOnFail !== false) throw new WasHereLawError(`WAS HERE LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

wasHereLaw();

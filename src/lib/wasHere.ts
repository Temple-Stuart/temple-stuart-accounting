/**
 * WASHERE-01 (Alex, 2026-10-31) — THE TRIP LOG. Alex's own stops while building
 * this, one row per stop, read top-down in trip order on the guest landing
 * (WasHereSection.tsx, the MY TRIP act; WASHERE-03). THIS FILE IS DATA AND PURE
 * FUNCTIONS: no fetch, no env, no clock, no React (the plans.ts rule). Zero
 * imports: server- and client-safe.
 *
 * THE SHAPE. Every row is exactly { id, city, country, countryCode, start, end,
 * experienceId, line, image, writtenOn, workedFrom, did, learned, events }:
 *   · start is 'YYYY-MM-DD'; end is 'YYYY-MM-DD' or null — null means still there;
 *     a stop's end is the next stop's start (the travel day);
 *   · experienceId names an EXPERIENCES row (src/lib/experiences.ts) when the stop
 *     was around an event, else null — the section draws that event's own block
 *     through the words module, never a retyped date;
 *   · line is Alex's words for the stop, typed once, here — or null while he has
 *     not written them (null renders nothing);
 *   · image is { src, alt, credit } or null — src a file under public/was-here/
 *     (the section draws NO placeholder while null);
 *   · writtenOn is the day the entry was written;
 *   · workedFrom, did, learned (WASHERE-03) — the post: where he worked from, what
 *     he did, what he learned (paragraphs). Each a list of non-empty strings, and
 *     each may be empty — an empty list renders nothing, never an empty eyebrow.
 *     Alex's words, verbatim; six stops carry empty lists until he writes them;
 *   · events (WASHERE-02; trimmed in WASHERE-03 to what a reader would travel for)
 *     — what was on during the stay, each a StopEvent: { name, venue (null when
 *     the page named none), area, start, end, status ('took_place' | 'scheduled' |
 *     'postponed' | 'cancelled' — what the page said), sourceKind, sourceName,
 *     sourceUrl, checkedOn, notes }. Every event overlaps its stay — the near-miss
 *     list and its relation key left in WASHERE-03 (the research record keeps
 *     them). Notes are data, never rendered. The kept rows are the WASHERE-02 DATA
 *     block byte for byte.
 *
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts,
 * which adds what only it can see — every experienceId exists in EXPERIENCES,
 * every image file exists under public/ at ≤ 400 KB, the landing mounts the
 * section once). It refuses by name: a duplicate id; an empty city, country or
 * line (a line is null or says something); a countryCode not two upper-case
 * letters; start or writtenOn not 'YYYY-MM-DD'; start after writtenOn (an entry
 * is written after the stop began); an end that is set and before start; more
 * than one row with end null (one place at a time); an image whose src is not
 * /was-here/<slug>.jpg|webp or whose alt or credit is empty; workedFrom, did or
 * learned not a list, or holding anything but non-empty strings; a row whose keys
 * are not exactly the fourteen above. And per event: an empty name, area or
 * sourceName; a venue that is present and empty; start, end or checkedOn not
 * 'YYYY-MM-DD'; start after end; a sourceUrl not https; a status or sourceKind
 * not one of the named values; an event that does not overlap its stay (overlap =
 * event.end ≥ stay.start and (stay.end is null or event.start ≤ stay.end) — of
 * EVERY event, WASHERE-03); 'took_place' on an event whose end is after the row's
 * writtenOn; two events in one row sharing (name, start); an event whose keys are
 * not exactly the eleven. No clock anywhere.
 */

export interface WasHereImage {
  /** A file under public/: /was-here/<slug>.jpg or .webp, at most 400 KB (the build checks). */
  src: string;
  alt: string;
  credit: string;
}

export type StopEventStatus = 'took_place' | 'scheduled' | 'postponed' | 'cancelled';
export type StopEventSourceKind = 'official' | 'secondary';

/** WASHERE-02: one event on during a stop — what the page read on checkedOn said. Every event overlaps its stay (the law). */
export interface StopEvent {
  name: string;
  /** null when the page named no venue — the pill shows the area instead. */
  venue: string | null;
  area: string;
  start: string;
  end: string;
  status: StopEventStatus;
  sourceKind: StopEventSourceKind;
  sourceName: string;
  sourceUrl: string;
  checkedOn: string;
  /** Data for the reader of this file, never rendered. */
  notes: string | null;
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
  /** Alex's words, typed once — or null while unwritten (renders nothing). */
  line: string | null;
  image: WasHereImage | null;
  writtenOn: string;
  /** WASHERE-03: where he worked from — names, joined on the card. */
  workedFrom: string[];
  /** WASHERE-03: what he did — items, joined on the card. */
  did: string[];
  /** WASHERE-03: what he learned — one paragraph per string. */
  learned: string[];
  /** WASHERE-02: what was on during the stay. */
  events: StopEvent[];
}

/** The fourteen keys every row carries, in the ruled order. */
export const WAS_HERE_FIELDS = ['id', 'city', 'country', 'countryCode', 'start', 'end', 'experienceId', 'line', 'image', 'writtenOn', 'workedFrom', 'did', 'learned', 'events'] as const;
/** The eleven keys every event carries. */
export const STOP_EVENT_FIELDS = ['name', 'venue', 'area', 'start', 'end', 'status', 'sourceKind', 'sourceName', 'sourceUrl', 'checkedOn', 'notes'] as const;
export const STOP_EVENT_STATUSES: readonly StopEventStatus[] = ['took_place', 'scheduled', 'postponed', 'cancelled'];
export const STOP_EVENT_SOURCE_KINDS: readonly StopEventSourceKind[] = ['official', 'secondary'];

/** Where a stop's photo may live: public/was-here/<slug>.jpg or .webp. */
export const WAS_HERE_IMAGE_SRC = /^\/was-here\/[a-z0-9-]+\.(jpg|webp)$/;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHECKED = '2026-10-31';
const WRITTEN = '2026-10-31';

export const WAS_HERE: readonly WasHereRow[] = [
  { id: 'canggu-2026-07', city: 'Canggu, Bali', country: 'Indonesia', countryCode: 'ID', start: '2026-07-01', end: '2026-07-30', experienceId: null, line: null, image: null, writtenOn: WRITTEN,
    workedFrom: ['Zin Cafe & Coworking', 'B Work Bali'],
    did: ['Beachwalk mall', 'a day trip to Uluwatu', 'sunset dinners and drinks at Times Beach Warung', 'Hatch market in Uluwatu', 'mini golf at Shooters', 'Echo Beach for sunsets and surf', 'the G Swing', 'the Gajah Mina statue at Pererenan Beach', 'Finns Beach Club'],
    learned: [
      'I showed up here with zero plan and ended up missing out on so much I wanted to do. Most days I never got around to an activity — I spent them eating brunch and dinner at the coworking.',
      'The correction: better plans.',
    ],
    events: [
      { name: 'Pesta Kesenian Bali XLVIII (Bali Arts Festival)', venue: 'Taman Werdhi Budaya Art Centre', area: 'Denpasar', start: '2026-06-13', end: '2026-07-11', status: 'took_place', sourceKind: 'secondary', sourceName: 'Antara', sourceUrl: 'https://www.antaranews.com/foto/5607117/ribuan-seniman-ramaikan-pawai-pembukaan-pesta-kesenian-bali-2026', checkedOn: CHECKED, notes: 'Closed Jul 11 with 1.8 million visitors per the Antara headline' },
      { name: 'Rip Curl Cup Padang Padang 2026 — women\'s local trials', venue: 'Padang Padang Beach', area: 'Pecatu, Bukit Peninsula', start: '2026-07-21', end: '2026-07-21', status: 'took_place', sourceKind: 'official', sourceName: 'Rip Curl Indonesia', sourceUrl: 'https://www.ripcurl.co.id/blogs/ripcurlcup/taina-izquierdo-and-paris-nalendra-secure-their-spots-in-the-rip-curl-cup-padang-padang-2026-main-event', checkedOn: CHECKED, notes: 'Taina Izquierdo and Paris Nalendra qualified for the main event' },
      { name: 'Rare Angon International Kite Festival 2026', venue: 'Mertasari Beach', area: 'Sanur', start: '2026-07-23', end: '2026-07-26', status: 'took_place', sourceKind: 'secondary', sourceName: 'Antara Bali', sourceUrl: 'https://bali.antaranews.com/tag/festival-rare', checkedOn: CHECKED, notes: 'Kites from 23 countries, per the Antara Bali headline' },
    ] },
  { id: 'danang-2026-08', city: 'Da Nang / Hoi An', country: 'Vietnam', countryCode: 'VN', start: '2026-07-30', end: '2026-08-28', experienceId: null, line: null, image: null, writtenOn: WRITTEN, workedFrom: [], did: [], learned: [], events: [
    { name: 'Hoi An full-moon lantern night', venue: 'Hoi An Ancient Town', area: 'Hoi An', start: '2026-08-26', end: '2026-08-26', status: 'scheduled', sourceKind: 'official', sourceName: 'Hoi An\'s monthly full-moon rule (Da Nang tourism portal)', sourceUrl: 'https://danangfantasticity.com/en/dem-nguoc/dem-ram-pho-co', checkedOn: CHECKED, notes: 'The 14th day of the 7th lunar month; the Gregorian date follows the lunar calendar (VTC News)' },
    { name: 'Hoi An Creative Week 2026', venue: 'Song Hoai Square and the Ancient Town', area: 'Hoi An', start: '2026-08-28', end: '2026-09-02', status: 'took_place', sourceKind: 'official', sourceName: 'Da Nang tourism portal; Tuoi Tre News', sourceUrl: 'https://danangfantasticity.com/en/news/h%e1%bb%99i-an-creative-week-2026-embrace-heritage-inspire-creativity', checkedOn: CHECKED, notes: 'Opened 19:30 on Aug 28; took place per Tuoi Tre (Sep 3)' },
  ] },
  { id: 'bangkok-2026-09', city: 'Bangkok', country: 'Thailand', countryCode: 'TH', start: '2026-08-28', end: '2026-09-25', experienceId: null, line: null, image: null, writtenOn: WRITTEN, workedFrom: [], did: [], learned: [], events: [
    { name: 'Kodaline — Farewell Tour', venue: 'UOB Live, EmSphere', area: 'Bangkok', start: '2026-08-28', end: '2026-08-29', status: 'took_place', sourceKind: 'official', sourceName: 'UOB Live', sourceUrl: 'https://uoblive.asia/event/kodaline---farewell-tour-in-bangkok', checkedOn: CHECKED, notes: 'Setlists for both nights on setlist.fm' },
    { name: 'ONE Fight Night 47: Stamp vs Flores', venue: 'Lumpinee Boxing Stadium', area: 'Bangkok', start: '2026-09-05', end: '2026-09-05', status: 'took_place', sourceKind: 'official', sourceName: 'ONE Championship', sourceUrl: 'https://www.onefc.com/news/stamp-edges-out-flores-in-fiery-main-event-muay-thai-war-at-one-fight-night-47/', checkedOn: CHECKED, notes: 'Stamp Fairtex beat Selina Flores by split decision' },
    { name: 'Post Malone — The BIG ASS Stadium World Tour', venue: 'Rajamangala National Stadium', area: 'Bangkok', start: '2026-09-22', end: '2026-09-22', status: 'postponed', sourceKind: 'secondary', sourceName: 'Time Out Bangkok', sourceUrl: 'https://www.timeout.com/bangkok/news/post-malone-bangkok-concert-postponed-082826', checkedOn: CHECKED, notes: 'Postponed indefinitely by Live Nation Tero on Aug 28; refunds through Oct 31' },
  ] },
  { id: 'phuket-2026-10', city: 'Phuket', country: 'Thailand', countryCode: 'TH', start: '2026-09-25', end: '2026-10-08', experienceId: null, line: null, image: null, writtenOn: WRITTEN, workedFrom: [], did: [], learned: [], events: [] },
  { id: 'chiangmai-2026-10', city: 'Chiang Mai', country: 'Thailand', countryCode: 'TH', start: '2026-10-08', end: '2026-10-21', experienceId: null, line: null, image: null, writtenOn: WRITTEN, workedFrom: [], did: [], learned: [], events: [] },
  { id: 'bangkok-2026-10-21', city: 'Bangkok', country: 'Thailand', countryCode: 'TH', start: '2026-10-21', end: '2026-10-22', experienceId: null, line: null, image: null, writtenOn: WRITTEN, workedFrom: [], did: [], learned: [], events: [] },
  { id: 'siargao-2026', city: 'General Luna, Siargao', country: 'Philippines', countryCode: 'PH', start: '2026-10-22', end: null, experienceId: 'philippines-pro-2026', line: 'I landed in Siargao in the middle of the WSL by luck. Don\'t get lucky. Book around it.', image: null, writtenOn: WRITTEN, workedFrom: [], did: [], learned: [], events: [] },
];

export class WasHereLawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WasHereLawError';
  }
}

const isIso = (value: unknown): value is string => typeof value === 'string' && ISO_DATE.test(value);

/** THE LAW. Throws on the first violation; returns the violations list when asked not to throw. `rows` is injectable for tests. */
export function wasHereLaw(opts: { throwOnFail?: boolean; rows?: readonly WasHereRow[] } = {}): string[] {
  const violations: string[] = [];
  const rows = opts.rows ?? WAS_HERE;
  const ids = new Set<string>();
  const wantKeys = [...WAS_HERE_FIELDS].sort().join(',');
  const wantEventKeys = [...STOP_EVENT_FIELDS].sort().join(',');
  for (const row of rows) {
    const who = row.id || '(no id)';
    const keys = Object.keys(row).sort().join(',');
    if (keys !== wantKeys) violations.push(`${who}: keys are [${Object.keys(row).join(', ')}] — a row carries exactly the fourteen ruled fields`);
    if (ids.has(row.id)) violations.push(`${who}: duplicate id`);
    ids.add(row.id);
    for (const [field, value] of Object.entries({ city: row.city, country: row.country })) {
      if (typeof value !== 'string' || value.trim() === '') violations.push(`${who}: empty ${field}`);
    }
    if (row.line !== null && (typeof row.line !== 'string' || row.line.trim() === '')) violations.push(`${who}: empty line — null means unwritten; a string says something`);
    if (!/^[A-Z]{2}$/.test(row.countryCode)) violations.push(`${who}: countryCode "${row.countryCode}" is not two upper-case letters (ISO-2)`);
    for (const [field, value] of Object.entries({ start: row.start, writtenOn: row.writtenOn })) {
      if (!isIso(value)) violations.push(`${who}: ${field} "${value}" is not YYYY-MM-DD`);
    }
    if (isIso(row.start) && isIso(row.writtenOn) && row.start > row.writtenOn) violations.push(`${who}: start ${row.start} is after writtenOn ${row.writtenOn} — an entry is written after the stop began`);
    if (row.end !== null) {
      if (!isIso(row.end)) violations.push(`${who}: end "${row.end}" is not YYYY-MM-DD (or null)`);
      else if (row.end < row.start) violations.push(`${who}: end ${row.end} is before start ${row.start}`);
    }
    if (row.image !== null) {
      if (typeof row.image.src !== 'string' || !WAS_HERE_IMAGE_SRC.test(row.image.src)) violations.push(`${who}: image src "${row.image.src}" is not /was-here/<slug>.jpg or .webp`);
      for (const [field, value] of Object.entries({ alt: row.image.alt, credit: row.image.credit })) {
        if (typeof value !== 'string' || value.trim() === '') violations.push(`${who}: image ${field} is empty`);
      }
    }
    // WASHERE-03: the post's three lists — each a list, each item a non-empty string; empty lists are allowed.
    for (const [field, list] of Object.entries({ workedFrom: row.workedFrom, did: row.did, learned: row.learned })) {
      if (!Array.isArray(list)) { violations.push(`${who}: ${field} is not a list`); continue; }
      list.forEach((item, i) => {
        if (typeof item !== 'string' || item.trim() === '') violations.push(`${who}: ${field}[${i}] is empty — a list holds non-empty strings`);
      });
    }
    // WASHERE-02: the events — each in shape, each on during the stay (every one, WASHERE-03).
    if (!Array.isArray(row.events)) { violations.push(`${who}: events is not a list`); continue; }
    const editions = new Set<string>();
    for (const ev of row.events) {
      const evWho = `${who} · ${ev.name || '(no name)'}`;
      const evKeys = Object.keys(ev).sort().join(',');
      if (evKeys !== wantEventKeys) violations.push(`${evWho}: keys are [${Object.keys(ev).join(', ')}] — an event carries exactly the eleven ruled fields`);
      for (const [field, value] of Object.entries({ name: ev.name, area: ev.area, sourceName: ev.sourceName })) {
        if (typeof value !== 'string' || value.trim() === '') violations.push(`${evWho}: empty event ${field}`);
      }
      if (ev.venue !== null && (typeof ev.venue !== 'string' || ev.venue.trim() === '')) violations.push(`${evWho}: event venue is present and empty — null when the page named none`);
      for (const [field, value] of Object.entries({ start: ev.start, end: ev.end, checkedOn: ev.checkedOn })) {
        if (!isIso(value)) violations.push(`${evWho}: event ${field} "${value}" is not YYYY-MM-DD`);
      }
      if (isIso(ev.start) && isIso(ev.end) && ev.start > ev.end) violations.push(`${evWho}: event start ${ev.start} is after end ${ev.end}`);
      if (typeof ev.sourceUrl !== 'string' || !ev.sourceUrl.startsWith('https://')) violations.push(`${evWho}: event sourceUrl "${ev.sourceUrl}" does not start with https://`);
      if (!STOP_EVENT_STATUSES.includes(ev.status)) violations.push(`${evWho}: status "${ev.status}" is not took_place | scheduled | postponed | cancelled`);
      if (!STOP_EVENT_SOURCE_KINDS.includes(ev.sourceKind)) violations.push(`${evWho}: sourceKind "${ev.sourceKind}" is not official | secondary`);
      if (isIso(ev.start) && isIso(ev.end) && isIso(row.start) && (row.end === null || isIso(row.end))) {
        const overlaps = ev.end >= row.start && (row.end === null || ev.start <= row.end);
        if (!overlaps) violations.push(`${evWho}: an event (${ev.start} – ${ev.end}) that does not overlap the stay (${row.start} – ${row.end ?? 'now'}) — every event was on during the stop`);
      }
      if (ev.status === 'took_place' && isIso(ev.end) && isIso(row.writtenOn) && ev.end > row.writtenOn) violations.push(`${evWho}: status took_place on an event ending ${ev.end}, after the entry was written on ${row.writtenOn}`);
      const edition = `${ev.name} · ${ev.start}`;
      if (editions.has(edition)) violations.push(`${evWho}: shares (name, start) "${edition}" with another event of this stop`);
      editions.add(edition);
    }
  }
  const here = rows.filter((r) => r.end === null);
  if (here.length > 1) violations.push(`${here.length} rows with end null [${here.map((r) => r.id).join(', ')}] — one place at a time`);
  if (violations.length && opts.throwOnFail !== false) throw new WasHereLawError(`WAS HERE LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

wasHereLaw();

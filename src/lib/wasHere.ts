/**
 * WASHERE-01 (Alex, 2026-10-31) — THE TRIP LOG. Alex's own stops while building
 * this, one row per stop, newest first on the guest landing (WasHereSection.tsx,
 * the MY TRIP act). THIS FILE IS DATA AND PURE FUNCTIONS: no fetch, no env, no
 * clock, no React (the plans.ts rule). Zero imports: server- and client-safe.
 *
 * THE SHAPE. Every row is exactly { id, city, country, countryCode, start, end,
 * experienceId, line, image, writtenOn, events }:
 *   · start is 'YYYY-MM-DD'; end is 'YYYY-MM-DD' or null — null means still there;
 *     a stop's end is the next stop's start (the travel day);
 *   · experienceId names an EXPERIENCES row (src/lib/experiences.ts) when the stop
 *     was around an event, else null — the section draws that event's own block
 *     through the words module, never a retyped date;
 *   · line is Alex's words for the stop, typed once, here — or null while he has
 *     not written them (WASHERE-02: nothing is typed for him; null renders nothing);
 *   · image is { src, alt, credit } or null — src a file under public/was-here/
 *     (the section draws NO placeholder while null);
 *   · writtenOn is the day the entry was written;
 *   · events (WASHERE-02) — what was on during the stay and what it just missed,
 *     each a StopEvent: { name, venue (null when the page named none), area, start,
 *     end, relation ('during' — it overlaps the stay; 'near_miss' — it does not),
 *     status ('took_place' | 'scheduled' | 'postponed' | 'cancelled' — what the page
 *     said), sourceKind, sourceName, sourceUrl, checkedOn, notes }. Notes are data,
 *     never rendered. The rows and events are the WASHERE-02 DATA block verbatim —
 *     no event added, dropped, re-dated or re-worded.
 *
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts,
 * which adds what only it can see — every experienceId exists in EXPERIENCES,
 * every image file exists under public/ at ≤ 400 KB, the landing mounts the
 * section once). It refuses by name: a duplicate id; an empty city, country or
 * line (a line is null or says something); a countryCode not two upper-case
 * letters; start or writtenOn not 'YYYY-MM-DD'; start after writtenOn (an entry
 * is written after the stop began); an end that is set and before start; more
 * than one row with end null (one place at a time); an image whose src is not
 * /was-here/<slug>.jpg|webp or whose alt or credit is empty; a row whose keys are
 * not exactly the eleven above. And per event (WASHERE-02): an empty name, area or
 * sourceName; a venue that is present and empty; start, end or checkedOn not
 * 'YYYY-MM-DD'; start after end; a sourceUrl not https; a relation, status or
 * sourceKind not one of the named values; 'during' on an event that does not
 * overlap its stay (overlap = event.end ≥ stay.start and (stay.end is null or
 * event.start ≤ stay.end)); 'near_miss' on one that does; 'took_place' on an
 * event whose end is after the row's writtenOn; two events in one row sharing
 * (name, start); an event whose keys are not exactly the twelve. No clock anywhere.
 */

export interface WasHereImage {
  /** A file under public/: /was-here/<slug>.jpg or .webp, at most 400 KB (the build checks). */
  src: string;
  alt: string;
  credit: string;
}

export type StopEventRelation = 'during' | 'near_miss';
export type StopEventStatus = 'took_place' | 'scheduled' | 'postponed' | 'cancelled';
export type StopEventSourceKind = 'official' | 'secondary';

/** WASHERE-02: one event on, or just missed, during a stop — what the page read on checkedOn said. */
export interface StopEvent {
  name: string;
  /** null when the page named no venue — the pill shows the area instead. */
  venue: string | null;
  area: string;
  start: string;
  end: string;
  relation: StopEventRelation;
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
  /** WASHERE-02: what was on during the stay and what it just missed. */
  events: StopEvent[];
}

/** The eleven keys every row carries, in the ruled order. */
export const WAS_HERE_FIELDS = ['id', 'city', 'country', 'countryCode', 'start', 'end', 'experienceId', 'line', 'image', 'writtenOn', 'events'] as const;
/** The twelve keys every event carries. */
export const STOP_EVENT_FIELDS = ['name', 'venue', 'area', 'start', 'end', 'relation', 'status', 'sourceKind', 'sourceName', 'sourceUrl', 'checkedOn', 'notes'] as const;
export const STOP_EVENT_RELATIONS: readonly StopEventRelation[] = ['during', 'near_miss'];
export const STOP_EVENT_STATUSES: readonly StopEventStatus[] = ['took_place', 'scheduled', 'postponed', 'cancelled'];
export const STOP_EVENT_SOURCE_KINDS: readonly StopEventSourceKind[] = ['official', 'secondary'];

/** Where a stop's photo may live: public/was-here/<slug>.jpg or .webp. */
export const WAS_HERE_IMAGE_SRC = /^\/was-here\/[a-z0-9-]+\.(jpg|webp)$/;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHECKED = '2026-10-31';
const WRITTEN = '2026-10-31';

export const WAS_HERE: readonly WasHereRow[] = [
  { id: 'canggu-2026-07', city: 'Canggu, Bali', country: 'Indonesia', countryCode: 'ID', start: '2026-07-01', end: '2026-07-30', experienceId: null, line: null, image: null, writtenOn: WRITTEN, events: [
    { name: 'Pesta Kesenian Bali XLVIII (Bali Arts Festival)', venue: 'Taman Werdhi Budaya Art Centre', area: 'Denpasar', start: '2026-06-13', end: '2026-07-11', relation: 'during', status: 'took_place', sourceKind: 'secondary', sourceName: 'Antara', sourceUrl: 'https://www.antaranews.com/foto/5607117/ribuan-seniman-ramaikan-pawai-pembukaan-pesta-kesenian-bali-2026', checkedOn: CHECKED, notes: 'Closed Jul 11 with 1.8 million visitors per the Antara headline' },
    { name: 'Penglipuran Village Festival XIII', venue: 'Penglipuran Traditional Village', area: 'Bangli', start: '2026-07-09', end: '2026-07-11', relation: 'during', status: 'took_place', sourceKind: 'secondary', sourceName: 'RRI', sourceUrl: 'https://rri.co.id/en/art-and-culture/2556914/panglipuran-festival-and-gebogan-contest-unites-bali-villages', checkedOn: CHECKED, notes: null },
    { name: 'Festival Seni Bali Jani VIII', venue: 'Taman Werdhi Budaya Art Centre', area: 'Denpasar', start: '2026-07-11', end: '2026-07-25', relation: 'during', status: 'took_place', sourceKind: 'secondary', sourceName: 'Antara', sourceUrl: 'https://en.antaranews.com/photo/5652159/modern-theater-competition-at-bali-jani-arts-festival-2026', checkedOn: CHECKED, notes: 'Bali\'s contemporary arts festival' },
    { name: 'Rip Curl Cup Padang Padang 2026 — women\'s local trials', venue: 'Padang Padang Beach', area: 'Pecatu, Bukit Peninsula', start: '2026-07-21', end: '2026-07-21', relation: 'during', status: 'took_place', sourceKind: 'official', sourceName: 'Rip Curl Indonesia', sourceUrl: 'https://www.ripcurl.co.id/blogs/ripcurlcup/taina-izquierdo-and-paris-nalendra-secure-their-spots-in-the-rip-curl-cup-padang-padang-2026-main-event', checkedOn: CHECKED, notes: 'Taina Izquierdo and Paris Nalendra qualified for the main event' },
    { name: 'Rare Angon International Kite Festival 2026', venue: 'Mertasari Beach', area: 'Sanur', start: '2026-07-23', end: '2026-07-26', relation: 'during', status: 'took_place', sourceKind: 'secondary', sourceName: 'Antara Bali', sourceUrl: 'https://bali.antaranews.com/tag/festival-rare', checkedOn: CHECKED, notes: 'Kites from 23 countries, per the Antara Bali headline' },
    { name: 'Lovina Festival 2026', venue: 'Lovina Beach', area: 'Lovina, Buleleng', start: '2026-07-24', end: '2026-07-29', relation: 'during', status: 'took_place', sourceKind: 'secondary', sourceName: 'RRI; Antara Bali', sourceUrl: 'https://rri.co.id/en/art-and-culture/2596752/lovina-festival-2026-highlights-regional-collaboration-and-north-bali-culture', checkedOn: CHECKED, notes: 'North coast; opened Jul 24 per RRI; indonesia.travel lists Jul 24–26, Antara Jul 24–29' },
    { name: 'Mekotek, on Kuningan day', venue: 'Desa Munggu', area: 'Munggu, Mengwi', start: '2026-06-27', end: '2026-06-27', relation: 'near_miss', status: 'scheduled', sourceKind: 'official', sourceName: 'Badung Regency Tourism Office', sourceUrl: 'https://sita.badungkab.go.id/en/events/mekotek-tradition-of-munggu-village-history-meaning-and-festivities', checkedOn: CHECKED, notes: 'The bamboo-pole ritual a few villages from Canggu' },
    { name: 'Rip Curl Cup Padang Padang 2026 — main event', venue: 'Padang Padang Beach', area: 'Pecatu, Bukit Peninsula', start: '2026-08-01', end: '2026-08-31', relation: 'near_miss', status: 'took_place', sourceKind: 'official', sourceName: 'Rip Curl Indonesia', sourceUrl: 'https://www.ripcurl.co.id/blogs/ripcurlcup/lucy-darragh-and-rajo-saputra-win-2026-rip-curl-cup-padang-padang', checkedOn: CHECKED, notes: 'Waiting period Aug 1–31; ran Aug 20 — Rajo Saputra and Lucy Darragh won' },
    { name: 'Ubud Village Jazz Festival 2026', venue: null, area: 'Ubud, Gianyar', start: '2026-08-07', end: '2026-08-08', relation: 'near_miss', status: 'took_place', sourceKind: 'secondary', sourceName: 'RRI', sourceUrl: 'https://rri.co.id/en/lifestyle/2639533/ubud-village-jazz-festival-2026-unites-global-jazz-musicians-in-bali', checkedOn: CHECKED, notes: null },
    { name: 'Your Paradise Bali 2026', venue: 'Tropical Temptation Beach Club, Melasti Beach', area: 'Ungasan, Bukit Peninsula', start: '2026-08-07', end: '2026-08-09', relation: 'near_miss', status: 'scheduled', sourceKind: 'official', sourceName: 'Your Paradise', sourceUrl: 'https://bali.yourparadise.com/', checkedOn: CHECKED, notes: null },
  ] },
  { id: 'danang-2026-08', city: 'Da Nang / Hoi An', country: 'Vietnam', countryCode: 'VN', start: '2026-07-30', end: '2026-08-28', experienceId: null, line: null, image: null, writtenOn: WRITTEN, events: [
    { name: 'Da Nang International Ngoc Linh Ginseng and Medicinal Herbs Festival', venue: 'APEC Park', area: 'Da Nang', start: '2026-08-01', end: '2026-08-03', relation: 'during', status: 'took_place', sourceKind: 'secondary', sourceName: 'VietnamPlus', sourceUrl: 'https://www.vietnamplus.vn/khai-mac-le-hoi-sam-ngoc-linh-va-duoc-lieu-quoc-te-da-nang-2026-post1127624.vnp', checkedOn: CHECKED, notes: 'First edition; opened Aug 1' },
    { name: 'Hoi An full-moon lantern night', venue: 'Hoi An Ancient Town', area: 'Hoi An', start: '2026-08-26', end: '2026-08-26', relation: 'during', status: 'scheduled', sourceKind: 'official', sourceName: 'Hoi An\'s monthly full-moon rule (Da Nang tourism portal)', sourceUrl: 'https://danangfantasticity.com/en/dem-nguoc/dem-ram-pho-co', checkedOn: CHECKED, notes: 'The 14th day of the 7th lunar month; the Gregorian date follows the lunar calendar (VTC News)' },
    { name: 'Hoi An Creative Week 2026', venue: 'Song Hoai Square and the Ancient Town', area: 'Hoi An', start: '2026-08-28', end: '2026-09-02', relation: 'during', status: 'took_place', sourceKind: 'official', sourceName: 'Da Nang tourism portal; Tuoi Tre News', sourceUrl: 'https://danangfantasticity.com/en/news/h%e1%bb%99i-an-creative-week-2026-embrace-heritage-inspire-creativity', checkedOn: CHECKED, notes: 'Opened 19:30 on Aug 28; took place per Tuoi Tre (Sep 3)' },
    { name: 'Enjoy Da Nang Festival 2026', venue: 'An Hai beach area', area: 'Da Nang', start: '2026-07-22', end: '2026-07-26', relation: 'near_miss', status: 'scheduled', sourceKind: 'official', sourceName: 'Da Nang tourism portal', sourceUrl: 'https://danangfantasticity.com/en/news/top-events-and-festivals-in-da-nang-from-mid-2026-to-early-2027', checkedOn: CHECKED, notes: null },
    { name: 'Heineken Pickleball World Cup 2026', venue: 'Tien Son Sports Arena', area: 'Da Nang', start: '2026-08-30', end: '2026-09-06', relation: 'near_miss', status: 'took_place', sourceKind: 'official', sourceName: 'Da Nang tourism portal', sourceUrl: 'https://danangfantasticity.com/heineken-pickleball-world-cup/heineken-pickleball-world-cup-2026-ready-to-kick-off-in-da-nang', checkedOn: CHECKED, notes: 'First edition in Asia; took place per Vietnam News (Sep 3): about 4,000 players from 80 countries' },
  ] },
  { id: 'bangkok-2026-09', city: 'Bangkok', country: 'Thailand', countryCode: 'TH', start: '2026-08-28', end: '2026-09-25', experienceId: null, line: null, image: null, writtenOn: WRITTEN, events: [
    { name: 'Kodaline — Farewell Tour', venue: 'UOB Live, EmSphere', area: 'Bangkok', start: '2026-08-28', end: '2026-08-29', relation: 'during', status: 'took_place', sourceKind: 'official', sourceName: 'UOB Live', sourceUrl: 'https://uoblive.asia/event/kodaline---farewell-tour-in-bangkok', checkedOn: CHECKED, notes: 'Setlists for both nights on setlist.fm' },
    { name: 'ONE Friday Fights 168', venue: 'Lumpinee Boxing Stadium', area: 'Bangkok', start: '2026-08-28', end: '2026-08-28', relation: 'during', status: 'took_place', sourceKind: 'official', sourceName: 'ONE Championship', sourceUrl: 'https://www.onefc.com/news/one-friday-fights-168-main-event-result-wuttikrai-survives-firefight-to-edge-out-mohammad-habibpour/', checkedOn: CHECKED, notes: 'Wuttikrai beat Mohammad Habibpour on points' },
    { name: 'ONE Friday Fights 169', venue: 'Lumpinee Boxing Stadium', area: 'Bangkok', start: '2026-09-04', end: '2026-09-04', relation: 'during', status: 'took_place', sourceKind: 'secondary', sourceName: 'Cageside Press', sourceUrl: 'https://cagesidepress.com/2026/09/04/one-friday-fights-169-the-inner-circle-29-live-stream-and-results/', checkedOn: CHECKED, notes: null },
    { name: 'ONE Fight Night 47: Stamp vs Flores', venue: 'Lumpinee Boxing Stadium', area: 'Bangkok', start: '2026-09-05', end: '2026-09-05', relation: 'during', status: 'took_place', sourceKind: 'official', sourceName: 'ONE Championship', sourceUrl: 'https://www.onefc.com/news/stamp-edges-out-flores-in-fiery-main-event-muay-thai-war-at-one-fight-night-47/', checkedOn: CHECKED, notes: 'Stamp Fairtex beat Selina Flores by split decision' },
    { name: 'ONE Friday Fights 170', venue: 'Lumpinee Boxing Stadium', area: 'Bangkok', start: '2026-09-11', end: '2026-09-11', relation: 'during', status: 'took_place', sourceKind: 'official', sourceName: 'ONE Championship; Cageside Press', sourceUrl: 'https://www.onefc.com/news/full-card-revealed-for-one-friday-fights-170-on-september-11/', checkedOn: CHECKED, notes: null },
    { name: 'ONE Friday Fights 171', venue: 'Lumpinee Boxing Stadium', area: 'Bangkok', start: '2026-09-18', end: '2026-09-18', relation: 'during', status: 'took_place', sourceKind: 'secondary', sourceName: 'Cageside Press', sourceUrl: 'https://cagesidepress.com/2026/09/18/one-friday-fights-171-the-inner-circle-31-live-stream-and-results/', checkedOn: CHECKED, notes: null },
    { name: 'ONE Friday Fights 172', venue: 'Lumpinee Boxing Stadium', area: 'Bangkok', start: '2026-09-25', end: '2026-09-25', relation: 'during', status: 'took_place', sourceKind: 'secondary', sourceName: 'Cageside Press', sourceUrl: 'https://cagesidepress.com/2026/09/25/one-friday-fights-172-the-inner-circle-32-live-stream-and-results/', checkedOn: CHECKED, notes: 'Superlek beat Othman Rhouni' },
    { name: 'Bangkok\'s 28th International Festival of Dance & Music', venue: 'Thailand Cultural Centre', area: 'Bangkok', start: '2026-09-05', end: '2026-10-17', relation: 'during', status: 'scheduled', sourceKind: 'official', sourceName: 'bangkokfestivals.com', sourceUrl: 'https://bangkokfestivals.com/program', checkedOn: CHECKED, notes: 'New York City Opera, the Bolshoi Theatre of Belarus and Deborah Colker Dance Company played inside the stay' },
    { name: 'Post Malone — The BIG ASS Stadium World Tour', venue: 'Rajamangala National Stadium', area: 'Bangkok', start: '2026-09-22', end: '2026-09-22', relation: 'during', status: 'postponed', sourceKind: 'secondary', sourceName: 'Time Out Bangkok', sourceUrl: 'https://www.timeout.com/bangkok/news/post-malone-bangkok-concert-postponed-082826', checkedOn: CHECKED, notes: 'Postponed indefinitely by Live Nation Tero on Aug 28; refunds through Oct 31' },
  ] },
  { id: 'phuket-2026-10', city: 'Phuket', country: 'Thailand', countryCode: 'TH', start: '2026-09-25', end: '2026-10-08', experienceId: null, line: null, image: null, writtenOn: WRITTEN, events: [
    { name: 'Sattha: The Power of Faith', venue: 'Limelight Phuket', area: 'Phuket Town', start: '2026-10-06', end: '2026-10-19', relation: 'during', status: 'scheduled', sourceKind: 'secondary', sourceName: 'TAT Newsroom', sourceUrl: 'https://www.tatnews.org/2026/09/october-event-and-calendar/', checkedOn: CHECKED, notes: 'TAT\'s October calendar; a programme of religious traditions and community activities' },
    { name: 'Phuket Vegetarian Festival 2026', venue: 'Jui Tui Shrine and forty more', area: 'Phuket Town', start: '2026-10-09', end: '2026-10-18', relation: 'near_miss', status: 'scheduled', sourceKind: 'secondary', sourceName: 'TAT Newsroom', sourceUrl: 'https://www.tatnews.org/2026/10/tat-highlights-phuket-vegetarian-festival-2026-as-a-distinctive-cultural-experience/', checkedOn: CHECKED, notes: 'Pole-raising Oct 9 at 17:09; street processions from Oct 11' },
  ] },
  { id: 'chiangmai-2026-10', city: 'Chiang Mai', country: 'Thailand', countryCode: 'TH', start: '2026-10-08', end: '2026-10-21', experienceId: null, line: null, image: null, writtenOn: WRITTEN, events: [
    { name: 'American Fair — Chiang Mai', venue: 'Chiang Mai PAO Park', area: 'Chiang Mai', start: '2026-10-16', end: '2026-10-18', relation: 'during', status: 'scheduled', sourceKind: 'secondary', sourceName: 'TAT Newsroom', sourceUrl: 'https://www.tatnews.org/2026/09/october-event-and-calendar/', checkedOn: CHECKED, notes: null },
    { name: 'Yi Peng and Loy Krathong 2026', venue: null, area: 'Chiang Mai', start: '2026-11-23', end: '2026-11-25', relation: 'near_miss', status: 'scheduled', sourceKind: 'secondary', sourceName: 'Asia Lifestyle Magazine', sourceUrl: 'https://www.asialifestylemagazine.com/loy-krathong-yi-peng-2026/', checkedOn: CHECKED, notes: 'Full moon Nov 24' },
  ] },
  { id: 'bangkok-2026-10-21', city: 'Bangkok', country: 'Thailand', countryCode: 'TH', start: '2026-10-21', end: '2026-10-22', experienceId: null, line: null, image: null, writtenOn: WRITTEN, events: [
    { name: 'The Weeknd — After Hours Til Dawn Stadium Tour', venue: 'Rajamangala National Stadium', area: 'Bangkok', start: '2026-10-11', end: '2026-10-13', relation: 'near_miss', status: 'scheduled', sourceKind: 'secondary', sourceName: 'Time Out Bangkok', sourceUrl: 'https://www.timeout.com/bangkok/news/everything-to-know-about-the-weeknd-tour-092226', checkedOn: CHECKED, notes: 'Oct 11 and 12 sold out' },
    { name: 'Bangkok Art Biennale 2026 — Angels & Mara', venue: 'Wat Arun, Wat Pho, BACC and eight more venues', area: 'Bangkok', start: '2026-10-29', end: '2027-02-28', relation: 'near_miss', status: 'scheduled', sourceKind: 'secondary', sourceName: 'TAT Newsroom', sourceUrl: 'https://www.tatnews.org/2026/10/bangkok-art-biennale-2026-opening-reception-sets-stage-for-citywide-art-festival/', checkedOn: CHECKED, notes: 'Public from Oct 29, through the December stay' },
  ] },
  { id: 'siargao-2026', city: 'General Luna, Siargao', country: 'Philippines', countryCode: 'PH', start: '2026-10-22', end: null, experienceId: 'philippines-pro-2026', line: 'I landed in Siargao in the middle of the WSL by luck. Don\'t get lucky. Book around it.', image: null, writtenOn: WRITTEN, events: [] },
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
    if (keys !== wantKeys) violations.push(`${who}: keys are [${Object.keys(row).join(', ')}] — a row carries exactly the eleven ruled fields`);
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
    // WASHERE-02: the events — each in shape, each on the right side of the stay.
    if (!Array.isArray(row.events)) { violations.push(`${who}: events is not a list`); continue; }
    const editions = new Set<string>();
    for (const ev of row.events) {
      const evWho = `${who} · ${ev.name || '(no name)'}`;
      const evKeys = Object.keys(ev).sort().join(',');
      if (evKeys !== wantEventKeys) violations.push(`${evWho}: keys are [${Object.keys(ev).join(', ')}] — an event carries exactly the twelve ruled fields`);
      for (const [field, value] of Object.entries({ name: ev.name, area: ev.area, sourceName: ev.sourceName })) {
        if (typeof value !== 'string' || value.trim() === '') violations.push(`${evWho}: empty event ${field}`);
      }
      if (ev.venue !== null && (typeof ev.venue !== 'string' || ev.venue.trim() === '')) violations.push(`${evWho}: event venue is present and empty — null when the page named none`);
      for (const [field, value] of Object.entries({ start: ev.start, end: ev.end, checkedOn: ev.checkedOn })) {
        if (!isIso(value)) violations.push(`${evWho}: event ${field} "${value}" is not YYYY-MM-DD`);
      }
      if (isIso(ev.start) && isIso(ev.end) && ev.start > ev.end) violations.push(`${evWho}: event start ${ev.start} is after end ${ev.end}`);
      if (typeof ev.sourceUrl !== 'string' || !ev.sourceUrl.startsWith('https://')) violations.push(`${evWho}: event sourceUrl "${ev.sourceUrl}" does not start with https://`);
      if (!STOP_EVENT_RELATIONS.includes(ev.relation)) violations.push(`${evWho}: relation "${ev.relation}" is not during | near_miss`);
      if (!STOP_EVENT_STATUSES.includes(ev.status)) violations.push(`${evWho}: status "${ev.status}" is not took_place | scheduled | postponed | cancelled`);
      if (!STOP_EVENT_SOURCE_KINDS.includes(ev.sourceKind)) violations.push(`${evWho}: sourceKind "${ev.sourceKind}" is not official | secondary`);
      if (isIso(ev.start) && isIso(ev.end) && isIso(row.start) && (row.end === null || isIso(row.end))) {
        const overlaps = ev.end >= row.start && (row.end === null || ev.start <= row.end);
        if (ev.relation === 'during' && !overlaps) violations.push(`${evWho}: relation during on an event (${ev.start} – ${ev.end}) that does not overlap the stay (${row.start} – ${row.end ?? 'now'})`);
        if (ev.relation === 'near_miss' && overlaps) violations.push(`${evWho}: relation near_miss on an event (${ev.start} – ${ev.end}) that overlaps the stay (${row.start} – ${row.end ?? 'now'})`);
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

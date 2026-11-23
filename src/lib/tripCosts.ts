/**
 * TRIPCARDS-01 (Alex, 2026-11-05) — WHAT EACH STOP COST: where he stayed, the motorbike he
 * rented, and the flight that brought him there — one row per WAS_HERE stop (src/lib/wasHere.ts),
 * booked-ahead stops included. Alex's own figures, from his trip sheet. THIS FILE IS DATA AND PURE
 * FUNCTIONS: no fetch, no env, no clock, no React (the wasHere.ts rule). Zero imports: server- and
 * client-safe — the landing's cards and the stop pages both read it.
 *
 * THE SHAPE. Every row is exactly { stopId, stay, moto, flightIn }; each of the three is one of:
 *   · { kind: 'paid', name, amountCents } — what it was and what he paid, in integer cents;
 *   · { kind: 'none' }    — he had none ("n/a" in his sheet: no motorbike — he took Grab);
 *   · { kind: 'unknown' } — not in his log yet. Never a guess, never $0.
 * Printed by src/lib/tripPostWords.ts through the one money formatter. A name is what the card
 * shows on one line, so it stays short (Alex, 2026-11-05: "Nyoman Motorbike", not "Nyoman
 * Motorbike Rental"); a name too long for the card's width ends in "…" there, never wraps.
 *
 * THE LAW (module scope; re-run at build by scripts/assert-tool-registry.ts, which adds what only
 * it can see — a row for every WAS_HERE stop and none for a stop that isn't one). It refuses by
 * name: an empty or duplicate stopId; a row whose keys are not exactly the four; a line whose kind
 * is not paid | none | unknown; a paid line with an empty name or an amountCents that is not a
 * positive safe integer, or whose keys are not exactly kind, name, amountCents; a none or unknown
 * line carrying anything but its kind.
 *
 * TRIPPOST-02 (Alex, 2026-11-23) — A RENTAL'S DAYS. The stop's page spreads the motorbike over the
 * days he had it, so TRIP_MOTO_DAYS holds them for each rental whose days his log holds: keyed by
 * stop id, exactly { from, to } — the day he got it and the day he returned it, 'YYYY-MM-DD' each.
 * Canggu is the one row: Jul 3 to Jul 30, by his own journal. A rental with no row has no days, and
 * the page says so in words — never a guess. The row shape above does not change (TRIP_COST_FIELDS
 * stays four). The law refuses, by name: a key that is no row's stop; a row whose motorbike is not
 * paid; keys that are not exactly from, to; a date that is not 'YYYY-MM-DD'; a from that is not
 * before its to. The build adds what only it can see: each lies inside its stop's stay.
 */

export type TripCostLine =
  | { kind: 'paid'; name: string; amountCents: number }
  | { kind: 'none' }
  | { kind: 'unknown' };

export interface TripCosts {
  /** A WAS_HERE id. */
  stopId: string;
  stay: TripCostLine;
  moto: TripCostLine;
  flightIn: TripCostLine;
}

/** The four keys every row carries, in the ruled order. */
export const TRIP_COST_FIELDS = ['stopId', 'stay', 'moto', 'flightIn'] as const;
export const TRIP_COST_KINDS = ['paid', 'none', 'unknown'] as const;

const paid = (name: string, amountCents: number): TripCostLine => ({ kind: 'paid', name, amountCents });
const NONE: TripCostLine = { kind: 'none' };
const UNKNOWN: TripCostLine = { kind: 'unknown' };

export const TRIP_COSTS: readonly TripCosts[] = [
  { stopId: 'canggu-2026-07', stay: paid('The Daun', 70814), moto: paid('Nyoman Motorbike (Nmax)', 13179), flightIn: paid('China Air', 83720) },
  { stopId: 'danang-2026-08', stay: paid('Sky Village Đà Nẵng', 98073), moto: NONE, flightIn: paid('Vietjet', 17610) },
  { stopId: 'bangkok-2026-09', stay: paid('Premier Thonglor', 100772), moto: NONE, flightIn: paid('Thai Vietjet', 14990) },
  { stopId: 'phuket-2026-10', stay: paid('Amata Patong', 56961), moto: paid('Joy Motorbike (ADV)', 8000), flightIn: paid('AirAsia', 5881) },
  { stopId: 'chiangmai-2026-10', stay: paid('Hillside Condo 3', 41337), moto: NONE, flightIn: paid('Vietjet', 11179) },
  { stopId: 'bangkok-2026-10-21', stay: paid('Eleven Bangkok Sukhumvit 11', 4398), moto: NONE, flightIn: paid('Vietjet', 4720) },
  { stopId: 'siargao-2026', stay: paid('Rodeo Sun Hotel', 63824), moto: paid('Kook Moto Rental (Fazzio)', 6353), flightIn: paid('Philippine Airlines', 26050) },
  { stopId: 'cebu-2026-11', stay: paid('The Noble Cebu', 21726), moto: UNKNOWN, flightIn: paid('Philippine Airlines', 10405) },
  { stopId: 'uluwatu-2026-11', stay: paid('Bombora Surf Camp', 40016), moto: UNKNOWN, flightIn: paid('Philippine Airlines', 26512) },
  // His sheet repeats Uluwatu's flight on these rows; Uluwatu to Pererenan is on the same island, so the flight in waits for his word.
  { stopId: 'pererenan-2026-12', stay: paid('Anaya Boutique Hotel', 28590), moto: UNKNOWN, flightIn: UNKNOWN },
];

/** TRIPPOST-02: a rental's days — the day he got the motorbike and the day he returned it, 'YYYY-MM-DD' each. */
export interface TripMotoDays {
  from: string;
  to: string;
}

/** TRIPPOST-02: the rentals whose days his log holds, keyed by stop id. Phuket's and Siargao's are his to give. */
export const TRIP_MOTO_DAYS: Readonly<Record<string, TripMotoDays>> = {
  'canggu-2026-07': { from: '2026-07-03', to: '2026-07-30' },
};

export class TripCostsLawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TripCostsLawError';
  }
}

const keysOf = (value: object): string => Object.keys(value).sort().join(',');
const nonEmpty = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (value: unknown): value is string => typeof value === 'string' && ISO_DATE.test(value);

function lineViolations(who: string, field: string, line: unknown): string[] {
  if (line === null || typeof line !== 'object') return [`${who}: ${field} is not a cost line`];
  const l = line as Record<string, unknown>;
  if (!(TRIP_COST_KINDS as readonly unknown[]).includes(l.kind)) return [`${who}: ${field} kind "${String(l.kind)}" is not paid | none | unknown`];
  if (l.kind === 'paid') {
    const out: string[] = [];
    if (keysOf(l) !== 'amountCents,kind,name') out.push(`${who}: ${field} keys are [${Object.keys(l).join(', ')}] — a paid line is exactly kind, name, amountCents`);
    if (!nonEmpty(l.name)) out.push(`${who}: ${field} has an empty name`);
    if (typeof l.amountCents !== 'number' || !Number.isSafeInteger(l.amountCents) || l.amountCents <= 0) out.push(`${who}: ${field} amountCents ${JSON.stringify(l.amountCents)} is not a positive whole number of cents`);
    return out;
  }
  return keysOf(l) === 'kind' ? [] : [`${who}: ${field} is ${String(l.kind)} and carries [${Object.keys(l).join(', ')}] — it carries its kind only`];
}

/**
 * THE LAW. Throws on failure by default; returns the violations list when asked not to throw. `rows` and `motoDays` are injectable
 * for tests (TRIPPOST-02): an injected table of rentals' days is read against the rows in force; the live table is always read
 * against the live rows, which are the rows it describes.
 */
export function tripCostsLaw(opts: { throwOnFail?: boolean; rows?: readonly TripCosts[]; motoDays?: Readonly<Record<string, TripMotoDays>> } = {}): string[] {
  const violations: string[] = [];
  const rows = opts.rows ?? TRIP_COSTS;
  const ids = new Set<string>();
  const wantKeys = [...TRIP_COST_FIELDS].sort().join(',');
  for (const row of rows) {
    const who = nonEmpty(row.stopId) ? row.stopId : '(no stopId)';
    if (!nonEmpty(row.stopId)) violations.push(`${who}: empty stopId`);
    if (keysOf(row) !== wantKeys) violations.push(`${who}: keys are [${Object.keys(row).join(', ')}] — a row carries exactly the four ruled fields`);
    if (ids.has(row.stopId)) violations.push(`${who}: duplicate stopId`);
    ids.add(row.stopId);
    for (const field of ['stay', 'moto', 'flightIn'] as const) violations.push(...lineViolations(who, field, row[field]));
  }

  // TRIPPOST-02 — THE RENTALS' DAYS.
  const motoDays = opts.motoDays ?? TRIP_MOTO_DAYS;
  const motoRows = opts.motoDays === undefined ? TRIP_COSTS : rows;
  for (const [stopId, days] of Object.entries(motoDays)) {
    const who = `${stopId}: TRIP_MOTO_DAYS`;
    const row = motoRows.find((r) => r.stopId === stopId);
    const motoKind: unknown = row === undefined || row.moto === null || typeof row.moto !== 'object' ? undefined : (row.moto as { kind?: unknown }).kind;
    if (row === undefined) violations.push(`${who} holds a rental's days for a stop that is no row's stop — they are keyed by a costs row's stopId`);
    else if (motoKind === undefined) violations.push(`${who} holds a rental's days, but the row's motorbike is not a cost line — only a paid motorbike has days`);
    else if (motoKind !== 'paid') violations.push(`${who} holds a rental's days, but the row's motorbike is ${String(motoKind)} — only a paid motorbike has days`);
    if (days === null || typeof days !== 'object' || keysOf(days) !== 'from,to') {
      violations.push(`${who} keys are [${days !== null && typeof days === 'object' ? Object.keys(days).join(', ') : String(days)}] — a rental's days are exactly from, to`);
      continue;
    }
    if (!isIso(days.from)) violations.push(`${who} from "${String(days.from)}" is not YYYY-MM-DD`);
    if (!isIso(days.to)) violations.push(`${who} to "${String(days.to)}" is not YYYY-MM-DD`);
    if (isIso(days.from) && isIso(days.to) && days.from >= days.to) violations.push(`${who} from ${days.from} is not before its to ${days.to}`);
  }
  if (violations.length && opts.throwOnFail !== false) throw new TripCostsLawError(`TRIP COSTS LAW failed:\n  ${violations.join('\n  ')}`);
  return violations;
}

/** A stop's costs — or null for a stop that has no row (the build refuses that for every WAS_HERE stop). */
export function costsOf(stopId: string): TripCosts | null {
  return TRIP_COSTS.find((c) => c.stopId === stopId) ?? null;
}

/** TRIPPOST-02: a stop's rental days — or null for a stop whose rental's days are not in his log, or that had no rental. */
export function motoDaysOf(stopId: string): TripMotoDays | null {
  const found = Object.entries(TRIP_MOTO_DAYS).find(([id]) => id === stopId);
  return found === undefined ? null : found[1];
}

tripCostsLaw();

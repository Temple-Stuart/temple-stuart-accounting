// BOOK-3: the guest trip — session-only booking records behind the landing's
// "YOUR TRIP SO FAR" strip. GUESTS ONLY: writers fire solely on guest booking
// successes (the flight panel's authed !== true branch; the hotel confirm
// page's no-tripId branch). sessionStorage by ruling — nothing persists
// server-side without an account, and the strip says so. No new APIs; every
// value comes from the booking RESPONSES.
//
// Fail-honest contract: reads validate every row strictly — unparseable or
// mis-shaped storage yields [], never invented rows; a missing amount stays
// null (rendered as a dash), never a guessed number.
//
// HOME-TRAVEL-01 (Alex's brief, 2026-11-12 16:08 Manila: "if someone selects events, they add to a queue table below the search
// bar, so the person who adds them can see them for review to like aid in booking flights and stuff"; the board approved on the
// design canvas at 20:26): THE EVENTS JOIN THE TRIP — one trip, the same key, the same tab session, the same update signal. The
// writers are BOOK-3's guest booking successes, as above, AND, from 2026-11-12, the guest's own presses in the travel section:
// an event row's one button ("Add to trip" / "In your trip") and the trip card's round × — addGuestTripEvent and
// removeGuestTripEvent, below. An event's record holds its catalog id (src/lib/experiences.ts) and nothing else from the
// catalog: its words and dates are read from the leaf when the card renders, so a deploy that corrects a date corrects every
// trip. The entries keep the order they were added in, bookings and events together; each reader takes its own kind.
// (Read for this change, at main ca3fdc7: no flight file calls addGuestTripRecord — the hotel confirm page,
// src/app/booking/confirm/page.tsx, is the one booking writer. When the flight panel's branch left is not verified here.)

export interface GuestTripRecord {
  type: 'flight' | 'hotel';
  /** Route ("LAX → DPS") or hotel name. */
  name: string;
  confirmationCode: string | null;
  amountUsd: number | null;
  currency: string;
  ts: number;
}

/** HOME-TRAVEL-01 (2026-11-12): an event in the guest's trip — its catalog id (EXPERIENCES' `id`), and nothing else from the catalog. */
export interface GuestTripEvent {
  type: 'event';
  id: string;
}

/** HOME-TRAVEL-01: one entry of the stored trip — a booking (BOOK-3's record) or an event — in the order added. */
type GuestTripEntry = GuestTripRecord | GuestTripEvent;

const KEY = 'ts-guest-trip';
/** Same-tab update signal — sessionStorage 'storage' events fire only cross-tab. */
export const GUEST_TRIP_EVENT = 'guest-trip-updated';

function isRecord(r: unknown): r is GuestTripRecord {
  if (typeof r !== 'object' || r === null) return false;
  const x = r as Record<string, unknown>;
  return (
    (x.type === 'flight' || x.type === 'hotel') &&
    typeof x.name === 'string' && x.name.length > 0 &&
    (typeof x.confirmationCode === 'string' || x.confirmationCode === null) &&
    (typeof x.amountUsd === 'number' || x.amountUsd === null) &&
    typeof x.currency === 'string' &&
    typeof x.ts === 'number'
  );
}

/** HOME-TRAVEL-01: an event's entry, validated as strictly as a booking's — its type and a catalog id, and no other key. */
function isEventEntry(r: unknown): r is GuestTripEvent {
  if (typeof r !== 'object' || r === null) return false;
  const x = r as Record<string, unknown>;
  return x.type === 'event' && typeof x.id === 'string' && x.id.length > 0 && Object.keys(x).length === 2;
}

/** HOME-TRAVEL-01: every entry of the stored trip, bookings and events, in the order added — BOOK-3's read, for both kinds. */
function readEntries(): GuestTripEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((r: unknown): r is GuestTripEntry => isRecord(r) || isEventEntry(r)) : [];
  } catch {
    return []; // fail-honest: broken storage renders nothing
  }
}

/** HOME-TRAVEL-01: one write, then the update signal — the entries whole, in their order. */
function writeEntries(next: readonly GuestTripEntry[]): void {
  window.sessionStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(GUEST_TRIP_EVENT));
}

/** The guest's bookings (BOOK-3's records), in the order added. */
export function readGuestTrip(): GuestTripRecord[] {
  return readEntries().filter(isRecord);
}

/**
 * HOME-TRAVEL-01 (2026-11-12): the whole trip in ONE read — its bookings (BOOK-3's records) and its events' catalog ids, each kind in
 * the order added. The trip card and every row's "Add to trip" read this one read (src/components/landing/GuestTripStrip.tsx useGuestTrip).
 */
export function readGuestTripWhole(): { bookings: GuestTripRecord[]; events: string[] } {
  const entries = readEntries();
  return { bookings: entries.filter(isRecord), events: entries.filter(isEventEntry).map((e) => e.id) };
}

export function addGuestTripRecord(rec: GuestTripRecord): void {
  if (typeof window === 'undefined') return;
  try {
    // HOME-TRAVEL-01 (2026-11-12): the entries already stored, events among them, then the booking — until then
    // [...readGuestTrip(), rec], which held bookings only and would have dropped the guest's events.
    writeEntries([...readEntries(), rec]);
  } catch {
    // Storage unavailable (private mode quotas etc.) — the booking itself
    // succeeded; the strip simply won't list it. Never block the booking.
  }
}

/** HOME-TRAVEL-01 (2026-11-12): "Add to trip" — the event's catalog id, appended once; an event already in the trip is not added twice. */
export function addGuestTripEvent(id: string): void {
  const entries = readEntries();
  if (entries.some((e) => isEventEntry(e) && e.id === id)) return;
  writeEntries([...entries, { type: 'event', id }]);
}

/** HOME-TRAVEL-01 (2026-11-12): "In your trip" pressed again, or the trip card's × — the event leaves the trip; every other entry stays, in its order. */
export function removeGuestTripEvent(id: string): void {
  const entries = readEntries();
  if (!entries.some((e) => isEventEntry(e) && e.id === id)) return;
  writeEntries(entries.filter((e) => !(isEventEntry(e) && e.id === id)));
}

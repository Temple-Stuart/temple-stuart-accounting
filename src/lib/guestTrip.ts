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

export interface GuestTripRecord {
  type: 'flight' | 'hotel';
  /** Route ("LAX → DPS") or hotel name. */
  name: string;
  confirmationCode: string | null;
  amountUsd: number | null;
  currency: string;
  ts: number;
}

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

export function readGuestTrip(): GuestTripRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return []; // fail-honest: broken storage renders nothing
  }
}

export function addGuestTripRecord(rec: GuestTripRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const next = [...readGuestTrip(), rec];
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(GUEST_TRIP_EVENT));
  } catch {
    // Storage unavailable (private mode quotas etc.) — the booking itself
    // succeeded; the strip simply won't list it. Never block the booking.
  }
}

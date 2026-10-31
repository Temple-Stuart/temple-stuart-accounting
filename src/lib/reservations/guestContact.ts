/**
 * BOOKINGS-01 (2026-09-27) — WHO A FLIGHT BOOKING'S ROW NAMES AS ITS GUEST CONTACT. PURE.
 *
 * A GUEST flight booking carries the contact the checkout stored for it: the
 * prebook_contacts row the book route read by the vendor's prebookId (SEC-03 —
 * contactEmail is NOT NULL, and the prebook route refused a malformed address
 * before storing it). An ACCOUNT booking carries none: its address is the
 * account's (cancelRecipient, src/lib/reservations/cancellation.ts). Never a
 * default, never another row's address, never the account's email on a guest row.
 */

/** The prebook_contacts row the book route read by prebookId. */
export interface StoredContact {
  contactEmail: string;
}

export function guestEmailOf(isAccount: boolean, contact: StoredContact): string | null {
  return isAccount ? null : contact.contactEmail;
}

/**
 * The bookings law's seeded regressions (BOOKINGS-01, 2026-09-27).
 *
 * The ruling says one thing: ONE LIST SHOWS EVERY BOOKING'S TRUTH, AND A GUEST
 * FLIGHT KEEPS ITS CONTACT. These seeds put back, one at a time, each shape the
 * ruling forbids:
 *
 *   · the guest flight's email comes from a default or lands on an account row, or
 *     another file writes guestEmail (clause 1);
 *   · the row leaf does arithmetic, reads the clock, computes a status or invents an
 *     absent fact (clause 2);
 *   · the list route drops the owner scope, calls a vendor, or writes (clause 3);
 *   · the list view types a word, or the travel tab loses the list (clause 4).
 *
 * Each must fail THE BOOKINGS LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const CONTACT_LEAF = 'src/lib/reservations/guestContact.ts';
const ROW_LEAF = 'src/lib/reservations/bookingRow.ts';
const LIST_ROUTE = 'src/app/api/reservations/route.ts';
const LIST_VIEW = 'src/components/trips/AllBookings.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const UNATTACHED_ROUTE = 'src/app/api/reservations/unattached/route.ts';

const SEEDS: Seed[] = [
  {
    name: 'bookings01-a a guest flight gets a default address (clause 1)',
    file: CONTACT_LEAF,
    find: '  return isAccount ? null : contact.contactEmail;',
    replace: "  return isAccount ? null : contact.contactEmail || 'bookings@templestuart.com';",
    expect: "a guest's email is not the stored contact's, or an account row is not null",
  },
  {
    name: 'bookings01-b an account flight row carries the prebook contact (clause 1)',
    file: CONTACT_LEAF,
    find: '  return isAccount ? null : contact.contactEmail;',
    replace: '  return contact.contactEmail;',
    expect: "a guest's email is not the stored contact's, or an account row is not null",
  },
  {
    name: 'bookings01-c another route writes guestEmail (clause 1)',
    file: UNATTACHED_ROUTE,
    find: '      bookingType: r.bookingType,',
    replace: '      bookingType: r.bookingType,\n      guestEmail: r.guestEmail ?? userEmail,',
    expect: 'writes guestEmail (r.guestEmail ?? userEmail)',
  },
  {
    name: 'bookings01-d the row leaf divides the price (clause 2)',
    file: ROW_LEAF,
    find: "  const padded = digits.padStart(3, '0');",
    replace: "  const padded = String(cents / 100).padStart(3, '0');",
    expect: 'does arithmetic — no amount is converted, summed or divided',
  },
  {
    name: 'bookings01-e the row leaf reads the clock (clause 2)',
    file: ROW_LEAF,
    find: 'export function bookingRowOf(facts: BookingRowFacts): BookingRow {\n  const r = facts.reservation;',
    replace: 'export function bookingRowOf(facts: BookingRowFacts): BookingRow {\n  const r = facts.reservation;\n  void Date.now();',
    expect: 'reads the clock — the row leaf is pure',
  },
  {
    name: 'bookings01-f the row leaf computes a status from the bank (clause 2)',
    file: ROW_LEAF,
    find: '    status: STATUS_WORDS[r.status] ?? r.status,',
    replace: "    status: facts.chargeMatched ? 'paid' : STATUS_WORDS[r.status] ?? r.status,",
    expect: 'it words the recorded status and computes none',
  },
  {
    name: 'bookings01-g an absent confirmation code is filled with the booking id (clause 2)',
    file: ROW_LEAF,
    find: '    confirmation: code.length > 0 ? code : BOOKING_WORDS.notYetStated,',
    replace: '    confirmation: code.length > 0 ? code : r.providerBookingId,',
    expect: "bookingRowOf's confirmation reads",
  },
  {
    name: "bookings01-h the list route drops the owner scope (clause 3)",
    file: LIST_ROUTE,
    find: "    where: { userId: user.id },\n    orderBy: { createdAt: 'desc' },",
    replace: "    where: {},\n    orderBy: { createdAt: 'desc' },",
    expect: "does not read exactly the caller's reservations, newest first",
  },
  {
    name: 'bookings01-i the list route calls the vendor (clause 3)',
    file: LIST_ROUTE,
    find: "import { bookingRowOf } from '@/lib/reservations/bookingRow';",
    replace: "import { bookingRowOf } from '@/lib/reservations/bookingRow';\nimport { getFlightBooking } from '@/lib/liteapiFlightsClient';\nvoid getFlightBooking;",
    expect: 'imports a vendor client or calls the wire',
  },
  {
    name: 'bookings01-j the list route writes (clause 3)',
    file: LIST_ROUTE,
    find: '  const ids = reservations.map((r) => r.id);',
    replace: "  const ids = reservations.map((r) => r.id);\n  await prisma.reservations.updateMany({ where: { userId: user.id }, data: { lastVendorReadAt: null } });",
    expect: 'writes — the list reads only',
  },
  {
    name: 'bookings01-k the list view types a word (clause 4)',
    file: LIST_VIEW,
    find: '<p className="text-sm text-text-faint">{BOOKING_WORDS.none}</p>',
    replace: '<p className="text-sm text-text-faint">No bookings yet</p>',
    expect: 'types a word into its markup',
  },
  {
    name: 'bookings01-l the travel tab loses the list (clause 4)',
    file: LAUNCHER,
    find: '                <AllBookings key={`all-${tripsRefresh}`} />',
    replace: '                null',
    expect: "Bookings section does not mount AllBookings",
  },
];

export default SEEDS;

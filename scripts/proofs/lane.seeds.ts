/**
 * The lane law's seeded regressions (LANE-01, 2026-09-25).
 *
 * The ruling says one thing: A RESERVATION KNOWS WHAT IT IS. These seeds put back,
 * one at a time, each shape that made a paid flight read as a hotel named "liteapi"
 * with no day and a status frozen at pending:
 *
 *   · a PROVIDER_TYPE map returns to a reader (clause 1);
 *   · a name falls through to the provider again (clause 1);
 *   · the leaf reads .provider for the type (clause 1);
 *   · a reader stops going through the leaf (clause 1);
 *   · the column gets a default (clause 2);
 *   · a book route stops writing its lane (clause 2);
 *   · runtime code derives a lane the way the backfill did (clause 3);
 *   · the refresh dates a flight from createdAt (clause 4);
 *   · the refresh defaults a status (clause 4);
 *   · the book route maps the status inline again, beside the leaf (clause 4);
 *   · the refresh moves INSIDE the transaction (clause 4);
 *   · the GET runs unreserved against its cap (clause 4);
 *   · the flights route hardcodes tripId null again (clause 5);
 *   · the retro grows its own implementation (clause 6).
 *
 * Each must fail THE LANE LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const LEAF = 'src/lib/reservations/lane.ts';
const REFRESH = 'src/lib/reservations/refreshFlightReservation.ts';
const FLIGHT_BOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
const HOTEL_BOOK = 'src/app/api/travel/liteapi/book/route.ts';
const UNATTACHED = 'src/app/api/reservations/unattached/route.ts';
const RETRO = 'scripts/lane-01-retro-flights.ts';

const SEEDS: Seed[] = [
  {
    name: 'lane-a a PROVIDER_TYPE map returns to a reader (clause 1)',
    file: UNATTACHED,
    find: "export async function GET() {",
    replace: "const PROVIDER_TYPE: Record<string, string> = { liteapi: 'hotel' };\nvoid PROVIDER_TYPE;\nexport async function GET() {",
    expect: 'carries a PROVIDER_TYPE map',
  },
  {
    name: 'lane-b a name falls through to the provider again (clause 1)',
    file: UNATTACHED,
    find: "      name: reservationIdentity(r).name,",
    replace: "      name: r.hotelName ?? r.provider,",
    expect: 'names a row hotelName ?? provider',
  },
  {
    name: 'lane-c the leaf reads .provider for the type (clause 1)',
    file: LEAF,
    find: "  const stated = typeof row.displayName === 'string' ? row.displayName.trim() : '';",
    replace: "  const stated = typeof row.displayName === 'string' ? row.displayName.trim() : String((row as { provider?: string }).provider ?? '');",
    expect: 'reads .provider',
  },
  {
    name: 'lane-d a reader stops going through the leaf (clause 1)',
    file: UNATTACHED,
    find: "      type: reservationIdentity(r).type,",
    replace: "      type: r.lane,",
    expect: 'reads a row type past the leaf',
  },
  {
    name: 'lane-e the column gets a default (clause 2)',
    file: 'prisma/schema.prisma',
    find: "  lane                     String   @db.VarChar(20)\n",
    replace: "  lane                     String   @default(\"hotel\") @db.VarChar(20)\n",
    expect: 'reservations.lane is not a NOT NULL VarChar(20) with no @default',
  },
  {
    name: 'lane-f a book route stops writing its lane (clause 2)',
    file: HOTEL_BOOK,
    find: "                lane: 'hotel',\n                displayName: resolvedHotelName,",
    replace: "                displayName: resolvedHotelName,",
    expect: 'does not write lane: hotel',
  },
  {
    name: 'lane-g runtime code derives a lane the way the backfill did (clause 3)',
    file: UNATTACHED,
    find: "    const reservations = rows.map((r) => ({",
    replace: "    const derived = rows.map((r) => (r.provider === 'viator' ? 'activity' : r.checkinDate === null ? 'flight' : 'hotel'));\n    void derived;\n    const reservations = rows.map((r) => ({",
    expect: 'derives a lane from a stay date or a provider',
  },
  {
    name: 'lane-h the refresh dates a flight from createdAt (clause 4)',
    file: REFRESH,
    find: "  const departureTime = first.departureTime as string;",
    replace: "  const departureTime = (first.departureTime as string) || (row as { createdAt?: string }).createdAt || '';",
    expect: 'reads createdAt',
  },
  {
    name: 'lane-i the refresh defaults a status (clause 4)',
    file: REFRESH,
    find: "  const mapped = flightProviderStatusToReservation(stated.status);",
    replace: "  const mapped = flightProviderStatusToReservation(stated.status) ?? 'pending';",
    expect: 'defaults a status',
  },
  {
    name: 'lane-j the book route maps the status inline again, beside the leaf (clause 4)',
    file: FLIGHT_BOOK,
    find: "            const status = mapped === null ? 'pending' : mapped;",
    replace: "            const status = mapped === null ? ((parsed.status ?? '').toUpperCase() === 'TICKETED' ? 'confirmed' : 'pending') : mapped;",
    expect: 'still carries an inline status mapping beside the leaf',
  },
  {
    name: 'lane-k the refresh moves INSIDE the transaction client (clause 4)',
    file: FLIGHT_BOOK,
    find: "            calendar: prismaBookingCalendar(prisma),",
    replace: "            calendar: prismaBookingCalendar(prisma as unknown as typeof prisma), // tx",
    expect: 'must write through the top-level client',
  },
  {
    name: 'lane-l the GET runs unreserved against its cap (clause 4)',
    file: FLIGHT_BOOK,
    find: "        await reserveTravelSearch('liteapiflightbookingread');\n",
    replace: "",
    expect: 'not reserved against its daily cap',
  },
  {
    name: 'lane-m the flights route hardcodes tripId null again (clause 5)',
    file: FLIGHT_BOOK,
    find: "                tripId: resolvedTripId,",
    replace: "                tripId: null,",
    expect: 'still hardcodes tripId: null',
  },
  {
    name: 'lane-n the retro grows its own implementation (clause 6)',
    file: RETRO,
    find: "    const outcome = await refreshFlightReservation(",
    replace: "    const outcome = await ((async (_p: unknown, _r: unknown) => ({ fetched: false as const, reason: 'local' }))(",
    expect: 'does not run refreshFlightReservation',
  },
];

export default SEEDS;

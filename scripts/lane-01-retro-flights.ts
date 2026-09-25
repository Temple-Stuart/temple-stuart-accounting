/**
 * LANE-01 (2026-09-25) — THE RETRO. Alex runs this; a session never does.
 *
 *   DATABASE_URL=... LITEAPI_MODE=production LITEAPI_PRODUCTION_KEY=... \
 *     npx tsx scripts/lane-01-retro-flights.ts [--dry-run]
 *
 * Runs the ONE shared function (src/lib/reservations/refreshFlightReservation.ts)
 * over every reservations row with lane = 'flight': one GET
 * /flights/bookings/{bookingId} per row, and from what the vendor STATES —
 *   · the OUTBOUND segment's departureTime → the CAL-01 calendar row on that day
 *     (source='reservation', source_id=reservation.id);
 *   · carrier.marketingName + originCode → destinationCode → displayName;
 *   · the vendor's current status → status, through the book route's own mapping;
 *     an unmapped status is printed by name and changes nothing.
 *
 * IDEMPOTENT BY CONSTRUCTION: the function writes a calendar row only when none is
 * keyed to the reservation, a name only when it differs, a status only when the
 * mapped value differs. A row already carrying its day, its name and its current
 * status prints "unchanged" three times, and a second run changes nothing.
 *
 * NO FALLBACK. A GET that fails, or answers with no segments, leaves the row
 * exactly as it was and prints the named reason. No date from createdAt, no
 * default name, no default status.
 *
 * THE SAME GUARD DISCIPLINE AS THE BOOK ROUTE: every GET reserves the durable
 * daily cap 'liteapiflightbookingread' (travelSearchQuota.ts) first; a cap
 * refusal stops the run and says so. The vendor documents no cost for this GET,
 * so it is treated as metered.
 *
 * This is how FH-269-920QSVHH gets its day, its name, and stops reading "pending".
 *
 * --dry-run: calls the vendor and prints what WOULD change, writes nothing.
 */
import { readFileSync } from 'node:fs';

// ── Minimal .env loader (the probe scripts' idiom): .env.local then .env, no overrides.
function loadEnvFile(path: string): void {
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); } catch { return; }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set — this script reads and writes reservations and calendar_events, and does nothing without it.');
    process.exit(2);
  }
  // Imported AFTER the env is loaded: the prisma client and the LiteAPI client read
  // their configuration at import/first-call time.
  const { prisma } = await import('../src/lib/prisma');
  const { getFlightBooking } = await import('../src/lib/liteapiFlightsClient');
  const { refreshFlightReservation } = await import('../src/lib/reservations/refreshFlightReservation');
  const { prismaBookingCalendar } = await import('../src/lib/calendar/prismaBookingCalendar');
  const { reserveTravelSearch, TravelSearchQuotaError } = await import('../src/lib/travelSearchQuota');

  const rows = await prisma.reservations.findMany({
    where: { lane: 'flight' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, userId: true, lane: true, providerBookingId: true, providerConfirmationCode: true, status: true, displayName: true, createdAt: true },
  });
  console.log(`LANE-01 retro — ${rows.length} flight reservation(s)${dryRun ? ' (DRY RUN: nothing will be written)' : ''}\n`);

  const calendar = prismaBookingCalendar(prisma);
  let changed = 0; let untouched = 0; let failed = 0;
  for (const row of rows) {
    const head = `${row.id} · ${row.providerConfirmationCode ?? row.providerBookingId} · booked ${row.createdAt.toISOString().slice(0, 10)} · status ${row.status} · name ${row.displayName ?? '(none)'}`;
    try {
      await reserveTravelSearch('liteapiflightbookingread');
    } catch (err) {
      if (err instanceof TravelSearchQuotaError) {
        console.error(`\n✖ the daily cap for liteapiflightbookingread is spent — stopping before ${row.id}; re-run tomorrow or raise TRAVEL_SEARCH_DAILY_CAP_LITEAPIFLIGHTBOOKINGREAD.`);
        process.exit(1);
      }
      throw err;
    }
    const writes: string[] = [];
    const outcome = await refreshFlightReservation(
      {
        fetchBooking: async (bookingId) => (await getFlightBooking(bookingId)).details,
        calendar: dryRun
          ? { find: calendar.find, insert: async (r) => { writes.push(`calendar row on ${r.startDate.toISOString().slice(0, 10)} "${r.title}"`); } }
          : calendar,
        writeReservation: async (id, patch) => {
          writes.push(`reservation ${Object.entries(patch).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}`);
          if (!dryRun) await prisma.reservations.update({ where: { id }, data: patch });
        },
      },
      row,
    );
    if (!outcome.fetched) {
      failed += 1;
      console.log(`✖ ${head}\n    LEFT AS IS — ${outcome.reason}`);
      continue;
    }
    const lines = [
      `calendar: ${outcome.calendar}${outcome.day ? ` (${outcome.day})` : ''}${outcome.calendarReason ? ` — ${outcome.calendarReason}` : ''}`,
      `name: ${outcome.name}${outcome.nameValue ? ` "${outcome.nameValue}"` : ''}`,
      `status: ${outcome.status} (vendor ${outcome.providerStatus ?? 'absent'} → ${outcome.statusValue})`,
    ];
    const touched = outcome.calendar === 'inserted' || outcome.name === 'set' || outcome.status === 'set';
    if (touched) changed += 1; else untouched += 1;
    console.log(`${touched ? '✔ CHANGED ' : '· unchanged'} ${head}\n    ${lines.join('\n    ')}${writes.length ? `\n    ${dryRun ? 'would write' : 'wrote'}: ${writes.join('; ')}` : ''}`);
  }
  console.log(`\n${changed} changed · ${untouched} already correct · ${failed} left as is (named above)`);
  await prisma.$disconnect();
}

void main();

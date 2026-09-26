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
 *     an unmapped status is printed by name and changes nothing. SEC-03
 *     (2026-09-25): CANCELLED_WITH_CHARGES is mapped ('cancelled') and is no
 *     longer reported as unmapped; CREATED and the two PENDING statuses still are.
 *
 * IDEMPOTENT BY CONSTRUCTION: the function writes a calendar row only when none is
 * keyed to the reservation, a name only when it differs, a status only when the
 * mapped value differs. A row already carrying its day, its name and its current
 * status prints "unchanged" three times, and a second run changes nothing.
 *
 * NO FALLBACK. A GET that fails leaves the row exactly as it was and prints the
 * named reason; an answer with no OUTBOUND segment gets no day and no name (named)
 * and its status still goes through the apply leaf (STATUS-01b). No date from
 * createdAt, no default name, no default status.
 *
 * THE SAME GUARD DISCIPLINE AS THE BOOK ROUTE: every GET reserves the durable
 * daily cap 'liteapiflightbookingread' (travelSearchQuota.ts) first; a cap
 * refusal stops the run and says so. The vendor documents no cost for this GET,
 * so it is treated as metered.
 *
 * This is how FH-269-920QSVHH gets its day, its name, and stops reading "pending".
 *
 * --dry-run: calls the vendor and prints what WOULD change, writes nothing.
 *
 * STATUS-01 (2026-09-26): the function now hands the status to the one apply leaf
 * (src/lib/reservations/applyVendorState.ts), which also writes the PNR,
 * ticketedAt, ticketLimitTime and lastVendorReadAt the GET states, marks the day
 * and moves the commission of a vendor-cancelled flight, and may owe a 'ticketed'
 * email whose marker rides its write — so this retro sends the one attempt after
 * the write (never on a dry run). The ports gained cancelCommission and the
 * calendar's markCancelled; nothing else here changed. The whole-fleet retro is
 * scripts/status-01-retro-reservations.ts.
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
  const { sendLifecycleEmail } = await import('../src/lib/reservations/lifecycleSend');
  const { actorOfReadSource } = await import('../src/lib/reservations/auditTrail');

  const rows = await prisma.reservations.findMany({
    where: { lane: 'flight' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, userId: true, lane: true, providerBookingId: true, providerConfirmationCode: true, status: true, displayName: true, createdAt: true,
      // STATUS-01: the apply leaf's columns, and the email's.
      ticketedAt: true, ticketLimitTime: true, cancelIntentAt: true, ticketedEmailSentAt: true, confirmationEmailSentAt: true,
      bookingType: true, guestEmail: true, checkinDate: true, checkoutDate: true,
    },
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
        fetchBooking: async (bookingId) => {
          const read = await getFlightBooking(bookingId);
          return { ...read.details, readAt: read.answer.arrived };
        },
        calendar: dryRun
          ? {
              find: calendar.find,
              insert: async (r) => { writes.push(`calendar row on ${r.startDate.toISOString().slice(0, 10)} "${r.title}"`); },
              markCancelled: async (_source, sourceId) => { writes.push(`calendar rows for ${sourceId} marked cancelled`); return 0; },
            }
          : calendar,
        writeReservation: async (id, patch) => {
          writes.push(`reservation ${Object.entries(patch).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}`);
          if (!dryRun) await prisma.reservations.update({ where: { id }, data: patch });
        },
        cancelCommission: async (reservationId) => {
          if (dryRun) { writes.push('commission_ledger estimated → cancelled'); return 0; }
          return (await prisma.commission_ledger.updateMany({ where: { reservationId, status: 'estimated' }, data: { status: 'cancelled' } })).count;
        },
        log: (line) => console.log(`    ${line}`),
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
    const touched = outcome.calendar === 'inserted' || outcome.name === 'set' || outcome.status === 'set' || outcome.changes.length > 0;
    if (touched) changed += 1; else untouched += 1;
    console.log(`${touched ? '✔ CHANGED ' : '· unchanged'} ${head}\n    ${lines.join('\n    ')}${writes.length ? `\n    ${dryRun ? 'would write' : 'wrote'}: ${writes.join('; ')}` : ''}`);
    // STATUS-01: the emails the apply leaf owes — their markers are already written; one attempt each, never on a dry run.
    for (const request of outcome.emails) {
      if (dryRun) { console.log(`    would email: ${request.kind}`); continue; }
      // AUDIT-01: the retro is ours — system_automation under the booking's owner.
      const sent = await sendLifecycleEmail(row, request, actorOfReadSource('retro', row.userId));
      console.log(`    email ${request.kind}: ${sent.sent ? `sent ${sent.id}` : `NOT sent (${sent.error})`}`);
    }
  }
  console.log(`\n${changed} changed · ${untouched} already correct · ${failed} left as is (named above)`);
  await prisma.$disconnect();
}

void main();

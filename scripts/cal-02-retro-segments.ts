/**
 * CAL-02 (2026-09-27) — THE RETRO. Alex runs this; a session never does.
 *
 *   DATABASE_URL=... npx tsx scripts/cal-02-retro-segments.ts [--dry-run]
 *
 * NO VENDOR CALL. For every reservations row with lane = 'flight', this reads the
 * LATEST booking read ALREADY LANDED (STATUS-01: arrivals, provider 'liteapi',
 * resource 'booking_read', their_id read:<bookingId>, the row's own owner, newest
 * `arrived` first), parses it with the flight client's own pure parser
 * (parseFlightBookingDetails — the same mapping the vendor read applies FROM THE
 * TABLE), and hands its segments to the ONE segment writer
 * (src/lib/calendar/bookingEvent.ts writeFlightSegmentRows) in the vendor's order:
 *   · one row per segment the read states a departureTime for, keyed
 *     `<reservation id>:seg:<index>`, OUTBOUND and INBOUND;
 *   · the pre-CAL-02 row under the bare reservation id is RE-KEYED in place to the
 *     first segment that earns a row (segment 0 whenever it states a departure) and
 *     updated to that segment — never duplicated, never deleted;
 *   · a reservation already cancelled has every row marked (mark, never delete).
 *
 * A reservation with NO landed read is printed by name and LEFT AS IS — its old
 * row (if any) stays until a vendor read lands (the webhook, the cron, or
 * scripts/status-01-retro-reservations.ts), and nothing is guessed in its place.
 *
 * IDEMPOTENT: a segment whose key is already there is left alone, and a bare row
 * is re-keyed once; a second run prints "unchanged" for every row.
 *
 * --dry-run: reads, and prints what WOULD be written; writes nothing.
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
    console.error('DATABASE_URL is not set — this script reads reservations and arrivals and writes calendar_events, and does nothing without it.');
    process.exit(2);
  }
  // Imported AFTER the env is loaded: the prisma client reads its configuration at import.
  const { prisma } = await import('../src/lib/prisma');
  const { parseFlightBookingDetails } = await import('../src/lib/liteapiFlightsClient');
  const { BOOKING_READ, LITEAPI, bookingReadTheirId } = await import('../src/lib/arrivals/liteapiBooking');
  const { flightSegmentsCalendarDecision, writeFlightSegmentRows } = await import('../src/lib/calendar/bookingEvent');
  const { prismaBookingCalendar } = await import('../src/lib/calendar/prismaBookingCalendar');

  const rows = await prisma.reservations.findMany({
    where: { lane: 'flight' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, userId: true, providerBookingId: true, providerConfirmationCode: true, status: true, displayName: true, createdAt: true },
  });
  console.log(`CAL-02 retro — ${rows.length} flight reservation(s)${dryRun ? ' (DRY RUN: nothing will be written)' : ''}\n`);

  const live = prismaBookingCalendar(prisma);
  let changed = 0; let untouched = 0; let leftAsIs = 0;
  for (const row of rows) {
    const head = `${row.id} · ${row.providerConfirmationCode ?? row.providerBookingId} · booked ${row.createdAt.toISOString().slice(0, 10)} · status ${row.status} · name ${row.displayName ?? '(none)'}`;
    // The LATEST landed read — the row's own owner (a guest row's reads carry user_id null).
    const read = await prisma.arrivals.findFirst({
      where: { provider: LITEAPI, resource: BOOKING_READ, their_id: bookingReadTheirId(row.providerBookingId), user_id: row.userId },
      orderBy: { arrived: 'desc' },
      select: { id: true, arrived: true, payload: true },
    });
    if (read === null || read.payload === null || typeof read.payload !== 'object' || Array.isArray(read.payload)) {
      leftAsIs += 1;
      console.log(`✖ ${head}\n    LEFT AS IS — no booking read has landed for ${row.providerBookingId}; nothing is guessed in its place`);
      continue;
    }
    const segments = parseFlightBookingDetails(read.payload as Record<string, unknown>).segments;
    const writes: string[] = [];
    const port = dryRun
      ? {
          find: live.find,
          insert: async (r: { sourceId: string; startDate: Date; title: string }) => { writes.push(`insert ${r.sourceId} on ${r.startDate.toISOString().slice(0, 10)} "${r.title}"`); },
          rekey: async (source: string, from: string, r: { sourceId: string; title: string }) => {
            if (!(await live.find(source, from))) return 0;
            writes.push(`re-key ${from} → ${r.sourceId} "${r.title}"`);
            return 1;
          },
          markCancelled: async (_source: string, key: string) => { writes.push(`mark every row of ${key} cancelled`); return 0; },
        }
      : live;
    const out = await writeFlightSegmentRows(port, {
      reservationId: row.id,
      reservationCancelled: row.status === 'cancelled',
      decisions: flightSegmentsCalendarDecision({ reservationId: row.id, userId: row.userId, segments }),
    });
    const touched = out.legacy === 'rekeyed' || out.segments.some((s) => s.landed === 'inserted' || s.landed === 'rekeyed') || (out.marked ?? 0) > 0;
    if (touched) changed += 1; else untouched += 1;
    const lines = out.segments.map((s) => `segment ${s.index}: ${s.landed}${s.sourceId ? ` ${s.sourceId}` : ''}${s.day ? ` (${s.day})` : ''}${s.reason ? ` — ${s.reason}` : ''}`);
    lines.push(`the bare-key row: ${out.legacy}${out.marked !== null ? ` · marked cancelled ${out.marked}` : ''} · read ${read.id} landed ${read.arrived === null ? '(no arrival instant recorded)' : read.arrived.toISOString()}`);
    console.log(`${touched ? '✔ CHANGED ' : '· unchanged'} ${head}\n    ${lines.join('\n    ')}${writes.length ? `\n    would write: ${writes.join('; ')}` : ''}`);
  }
  console.log(`\n${changed} changed · ${untouched} already correct · ${leftAsIs} left as is (no landed read, named above)`);
  await prisma.$disconnect();
}

void main();

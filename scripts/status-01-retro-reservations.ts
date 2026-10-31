/**
 * STATUS-01 (2026-09-26) — THE RETRO. Alex runs this; a session never does.
 *
 *   DATABASE_URL=... LITEAPI_MODE=production LITEAPI_PRODUCTION_KEY=... \
 *     npx tsx scripts/status-01-retro-reservations.ts [--dry-run]
 *
 * Runs the ONE read leaf (src/lib/reservations/vendorRead.ts) over EVERY
 * reservations row: one GET per LiteAPI row — a hotel's GET /bookings/{id}, a
 * flight's GET /flights/bookings/{id} — landed, then applied through the one apply
 * leaf (src/lib/reservations/applyVendorState.ts):
 *   · the vendor's current status, through the lane's leaf, by name; an unlisted
 *     word is printed and changes nothing; CANCEL-01's cancel_pending guard holds;
 *   · a hotel's confirmation number that arrived late, a flight's PNR — when ours
 *     is null; ticketedAt and ticketLimitTime when the airline states them;
 *   · a vendor-cancelled row: cancelIntentAt cleared, the day marked, the
 *     'estimated' commission moved — and NO money_events, the GET states no figures;
 *   · lastVendorReadAt — when the answer arrived;
 *   · COMM-01 (2026-09-26): a checked-out hotel's commission LOCKED — the vendor's
 *     stated `commission` on the read after checkout moves the 'estimated' ledger
 *     row to 'confirmed' with its figures, the read instant and the read's arrival;
 *     printed per row. A second run finds it already locked and changes nothing.
 *   · the 'hotel_confirmation_arrived' / 'ticketed' email owed by a change, one
 *     attempt each after the write (its marker rode the write).
 * A flight also gets LANE-01's day and name (refreshFlightReservation runs inside).
 * A row of another provider (viator) has no LiteAPI read: printed and skipped.
 *
 * IDEMPOTENT BY CONSTRUCTION: the apply leaf writes a fact only when the vendor
 * states it and ours differs (or is null); a row already carrying the vendor's
 * current truth prints "unchanged" and a second run changes nothing — the read
 * stamp moves, nothing else.
 *
 * NO FALLBACK. A GET that fails leaves the row exactly as it was and prints the
 * named reason ('read_failed'). Nothing unstated is invented.
 *
 * THE SAME GUARD DISCIPLINE AS THE ROUTES: every GET reserves the durable daily
 * cap 'liteapi' first; a cap refusal stops the run and says so (re-run tomorrow
 * or raise TRAVEL_SEARCH_DAILY_CAP_LITEAPI).
 *
 * --dry-run: calls the vendor and prints what WOULD change, lands nothing, writes
 * nothing, sends nothing.
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
    console.error('DATABASE_URL is not set — this script reads and writes reservations, calendar_events, commission_ledger and the arrivals store, and does nothing without it.');
    process.exit(2);
  }
  // Imported AFTER the env is loaded: the prisma client and the LiteAPI clients read
  // their configuration at import/first-call time.
  const { prisma } = await import('../src/lib/prisma');
  const { readAndApplyReservation, VENDOR_READ_SELECT } = await import('../src/lib/reservations/vendorRead');

  const rows = await prisma.reservations.findMany({
    orderBy: { createdAt: 'asc' },
    select: VENDOR_READ_SELECT,
  });
  console.log(`STATUS-01 retro — ${rows.length} reservation(s)${dryRun ? ' (DRY RUN: nothing will be landed, written or sent)' : ''}\n`);

  let changed = 0; let untouched = 0; let failed = 0; let skipped = 0;
  for (const row of rows) {
    const head = `${row.id} · ${row.lane} · ${row.providerConfirmationCode ?? row.providerBookingId} · booked ${row.createdAt.toISOString().slice(0, 10)} · status ${row.status} · name ${row.displayName ?? '(none)'}`;
    if (row.provider !== 'liteapi') {
      skipped += 1;
      console.log(`· skipped   ${head}\n    provider ${row.provider} — no LiteAPI read`);
      continue;
    }
    const out = await readAndApplyReservation(row, { source: 'retro', dryRun, log: (line) => console.log(`    ${line}`) });
    if (out.outcome === 'read_failed') {
      failed += 1;
      console.log(`✖ ${head}\n    LEFT AS IS — ${out.reason}`);
      if (out.kind === 'quota') {
        console.error(`\n✖ the daily cap for liteapi is spent — stopping; re-run tomorrow or raise TRAVEL_SEARCH_DAILY_CAP_LITEAPI.`);
        process.exit(1);
      }
      continue;
    }
    const lines = [
      `status: ${out.status} (vendor ${out.providerStatus ?? 'absent'} → ${out.statusValue})`,
      ...(out.flight ? [`calendar: ${out.flight.calendar}${out.flight.day ? ` (${out.flight.day})` : ''}`, `name: ${out.flight.name}`] : []),
      `read at: ${out.readAt.toISOString()}`,
      // COMM-01: what the lock did (a dry run: would do).
      `commission: ${out.commissionLock.outcome === 'locked' ? `${dryRun ? 'would lock' : 'LOCKED'} at ${out.commissionLock.cents} cents` : out.commissionLock.outcome === 'already_locked' ? `already locked (${out.commissionLock.cents} cents stated)` : out.commissionLock.outcome.replace('_', ' ')}`,
    ];
    if (out.changes.length) lines.push(`${dryRun ? 'would change' : 'changed'}: ${out.changes.join('; ')}`);
    if (dryRun && out.wouldWrite) lines.push(`would write: ${Object.entries(out.wouldWrite).map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString() : JSON.stringify(v)}`).join(', ')}`);
    for (const owed of out.emailsOwed) {
      const sent = out.emails.find((e) => e.kind === owed.kind);
      lines.push(dryRun ? `would email: ${owed.kind}` : `email ${owed.kind}: ${sent ? (sent.sent ? `sent ${sent.id}` : `NOT sent (${sent.error})`) : 'not attempted'}`);
    }
    const touched = out.outcome === 'applied';
    if (touched) changed += 1; else untouched += 1;
    console.log(`${touched ? '✔ CHANGED ' : '· unchanged'} ${head}\n    ${lines.join('\n    ')}`);
  }
  console.log(`\n${changed} changed · ${untouched} already current · ${failed} left as is (named above) · ${skipped} skipped (no LiteAPI read)`);
  await prisma.$disconnect();
}

void main();

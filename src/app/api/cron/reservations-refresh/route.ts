/**
 * STATUS-01 (2026-09-26) — THE SCHEDULED REFRESH: EVERY NON-FINAL RESERVATION IS RE-READ.
 *
 * The auto-categorize cron's pattern exactly (src/app/api/cron/auto-categorize/route.ts):
 * `authorization` must be `Bearer <CRON_SECRET>`; CRON_SECRET unset → 500 'Cron not
 * configured' by name; wrong → 401. Vercel invokes a cron by GET (vercel.json); POST
 * is kept for a manual run with the same header. Registered hourly in vercel.json.
 *
 * WHICH ROWS. The LiteAPI rows whose vendor state can still change:
 *   · status IN ('pending', 'cancel_pending') — waiting on a final word;
 *   · lane 'flight', status 'confirmed', ticketedAt NULL — confirmed, not yet ticketed;
 *   · lane 'hotel', status 'confirmed', providerConfirmationCode NULL — the hotel's
 *     own confirmation number arrives later ("Nuitee performs a manual process").
 * Oldest lastVendorReadAt first, NULL (never read) first, then by createdAt. A
 * cancelled or failed row is final and is never re-read here (the ruling's
 * "non-final rows"); a row of another provider has no LiteAPI read.
 *
 * THE BOUND: BATCH rows per run. The read is metered under the shared 'liteapi'
 * daily cap (DEFAULT 1000/day, TRAVEL_SEARCH_DAILY_CAP_LITEAPI): 20 × 24 hourly runs
 * = 480 reads/day at the ceiling, under half the default cap, leaving the rest for
 * searches — and a cap refusal stops the batch by name, never bypasses it. A row
 * not reached this hour is the oldest-read next hour.
 *
 * One GET each through the one read leaf (src/lib/reservations/vendorRead.ts): the
 * answer lands, the apply leaf writes what changed, the emails owed go out after
 * the commit. Reported as ONE log line and the response body: read / changed /
 * unchanged / failed, with every failure named.
 */
import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { readAndApplyReservation, VENDOR_READ_SELECT, type VendorReadOutcome } from '@/lib/reservations/vendorRead';

export const dynamic = 'force-dynamic';

/** Rows per run — see the header for the arithmetic against the 'liteapi' daily cap. */
const BATCH = 20;

async function run(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rows = await prisma.reservations.findMany({
      where: {
        provider: 'liteapi',
        OR: [
          { status: { in: ['pending', 'cancel_pending'] } },
          { lane: 'flight', status: 'confirmed', ticketedAt: null },
          { lane: 'hotel', status: 'confirmed', providerConfirmationCode: null },
        ],
      },
      orderBy: [{ lastVendorReadAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      take: BATCH,
      select: VENDOR_READ_SELECT,
    });

    const perRow: Array<{ id: string; lane: string; outcome: VendorReadOutcome['outcome']; detail: string }> = [];
    let read = 0; let changed = 0; let unchanged = 0; let failed = 0; let stopped: string | null = null;
    for (const row of rows) {
      const out = await readAndApplyReservation(row, { source: 'cron' });
      if (out.outcome === 'read_failed') {
        failed += 1;
        perRow.push({ id: row.id, lane: row.lane, outcome: out.outcome, detail: out.reason });
        if (out.kind === 'quota') { stopped = out.reason; break; }
        continue;
      }
      read += 1;
      if (out.outcome === 'applied') changed += 1; else unchanged += 1;
      perRow.push({ id: row.id, lane: row.lane, outcome: out.outcome, detail: out.changes.length ? out.changes.join('; ') : `vendor ${out.providerStatus ?? 'no status'} — nothing changed` });
    }
    const summary = { batch: BATCH, selected: rows.length, read, changed, unchanged, failed, stopped };
    console.log(`[CRON reservations-refresh] ${rows.length} selected (batch ${BATCH}) — ${read} read, ${changed} changed, ${unchanged} unchanged, ${failed} failed${stopped ? ` — STOPPED: ${stopped}` : ''}${perRow.length ? ` :: ${perRow.map((r) => `${r.id} ${r.outcome}${r.outcome === 'read_failed' ? ` (${r.detail})` : ''}`).join(' | ')}` : ''}`);
    return NextResponse.json({ ...summary, rows: perRow });
  } catch (error) {
    return failClosedResponse('Cron reservations-refresh', 'Reservations refresh failed', error);
  }
}

export async function GET(request: NextRequest) { return run(request); }
export async function POST(request: NextRequest) { return run(request); }

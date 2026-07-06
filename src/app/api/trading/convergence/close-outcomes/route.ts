import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { prisma } from '@/lib/prisma';
import { closeSnapshotOutcomes } from '@/lib/convergence/outcome-tracker';

// TT candle WebSocket + market-metrics can take a while for many tickers
export const maxDuration = 120;

/**
 * EDGE-5: outcome-closer trigger. Admin fires it manually (v1) and reads the
 * returned run summary — that JSON is the v1 surface, no dashboard.
 *
 * Idempotent: only snapshots with outcome = null AND horizon passed are
 * closed; re-running when nothing qualifies closes nothing.
 */
export async function POST() {
  try {
    // EDGE-5 security: auth FIRST. This route spends the shared firm
    // TastyTrade account (candles + market-metrics), so it is gated to the
    // admin/owner via the same requireAdmin used by /api/trading/convergence —
    // 401 for guests, 403 for non-admins BEFORE any DB read or TT call. Not in
    // PUBLIC_PATHS, so the signed-cookie middleware also runs in front of it.
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;

    const user = await prisma.users.findFirst({
      where: { email: { equals: adminResult, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // User-scoped: closes only this admin's snapshots (WHERE userId = ...)
    const summary = await closeSnapshotOutcomes(user.id);
    return NextResponse.json(summary);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[OutcomeCloser] run failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

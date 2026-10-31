import { NextResponse } from 'next/server';
import { flightsLane } from '@/lib/flightsLane';

// GET /api/travel/flights/lane — tells the PUBLIC flight search surface which
// provider rail to drive (PR-FL-6a). PublicFlightSearch is a client component
// deep in a client tree, so the server-resolved FLIGHTS_LANE env reaches it
// through this one-field read. PUBLIC + unguarded BY DESIGN: a static config
// read — zero provider calls, zero DB, zero user data — so there is nothing to
// rate-limit or cap (the guards exist to bound paid calls; this has none).
// A misconfigured env (flightsLane throws) surfaces as a declared 500 — the
// client shows a loud config error, it never guesses a lane.

// The lane must be read at REQUEST time, not frozen into a build-time static
// shell — an env flip must take effect on the next deploy/restart, always.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ lane: flightsLane() });
  } catch (err) {
    console.error('[flights lane] resolution failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Flight search is misconfigured.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { viatorAffiliateUrl } from '@/config/affiliates';

// VIATOR-URL-FIX: read-time re-map for PERSISTED recommendations — stored
// rows carry whatever URL shape the scan-time code produced (pre-fix rows:
// the broken hand-built /tours/{code} template; post-fix rows: the API's real
// productUrl). Every VIATOR rec (identified by its viatorProductCode — no
// other provider is touched) is re-routed through the ONE shared builder
// here, at read time in the render path: post-fix URLs pass through with our
// params ensured; stale constructed URLs pass through unchanged (nothing
// better is code-only recoverable — the real productUrl was never persisted;
// they heal on re-scan, declared). CODE-ONLY: no DB writes, no migration.
function remapViatorRec(rec: unknown): unknown {
  if (typeof rec !== 'object' || rec === null) return rec;
  const r = rec as { viatorProductCode?: unknown; website?: unknown; bookingUrl?: unknown };
  if (typeof r.viatorProductCode !== 'string' || r.viatorProductCode === '') return rec;
  const stored =
    (typeof r.bookingUrl === 'string' && r.bookingUrl) ||
    (typeof r.website === 'string' && r.website) ||
    null;
  const url = viatorAffiliateUrl(stored, r.viatorProductCode);
  return { ...r, website: url, bookingUrl: url };
}

// GET — Load saved scanner results for this trip
// Auth: trip owner OR confirmed participant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Check: trip owner OR confirmed participant
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) {
      const participant = await prisma.trip_participants.findFirst({
        where: { tripId: id, email: { equals: userEmail, mode: 'insensitive' }, rsvpStatus: 'confirmed' },
      });
      if (!participant) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const results = await prisma.trip_scanner_results.findMany({
      where: { tripId: id },
      orderBy: { category: 'asc' },
    });

    // VIATOR-URL-FIX: re-map each row's viator recs at read time (see
    // remapViatorRec above). Rows whose recommendations JSON is not an array
    // pass through untouched.
    const remapped = results.map((row) =>
      Array.isArray(row.recommendations)
        ? { ...row, recommendations: (row.recommendations as unknown[]).map(remapViatorRec) }
        : row
    );

    return NextResponse.json({ results: remapped });
  } catch (error) {
    console.error('Scanner results GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch scanner results' }, { status: 500 });
  }
}

// DELETE — Clear scanner results for a specific category
// Auth: trip owner only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found or not authorized' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const destination = searchParams.get('destination');

    if (category && destination) {
      await prisma.trip_scanner_results.deleteMany({
        where: { tripId: id, category, destination },
      });
    } else {
      await prisma.trip_scanner_results.deleteMany({
        where: { tripId: id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Scanner results DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete scanner results' }, { status: 500 });
  }
}

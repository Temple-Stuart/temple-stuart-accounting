import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// DELETE /api/trips/[id]/budget-line — remove ONE manual/unlinked budget line.
//
// This is for budget_line_items rows that did NOT come from a vendor commit (no
// linked trip_itinerary / calendar_events). It deletes exactly that single row and
// cascades NOTHING. Vendor-linked lines use DELETE /vendor-commit instead, which does
// the atomic cross-table cleanup — so this route hard-guards on `itineraryId: null`:
// a linked line never matches, so it can never be orphaned through here.
//
// Ownership: 401 without a session; the trip must be the session user's (mirrors
// DELETE /vendor-commit); and the delete is scoped to { id, tripId, userId } so a user
// can only ever remove their OWN line on their OWN trip. Body: { budgetLineId }.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ownership gate: the trip must belong to the session user.
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const { budgetLineId } = await request.json();
    if (!budgetLineId || typeof budgetLineId !== 'string') {
      return NextResponse.json({ error: 'budgetLineId is required' }, { status: 400 });
    }

    // Delete ONLY the one unlinked row, scoped to this user + trip. The
    // `itineraryId: null` filter guarantees a vendor-linked line is never removed here
    // (it would leave its trip_itinerary / calendar_events orphaned) — those go through
    // DELETE /vendor-commit. A non-match (wrong owner/trip/id, or a linked line) → 404.
    const result = await prisma.budget_line_items.deleteMany({
      where: { id: budgetLineId, tripId: id, userId: user.id, itineraryId: null },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error('Error deleting budget line:', error);
    return NextResponse.json({ error: 'Failed to delete budget line' }, { status: 500 });
  }
}

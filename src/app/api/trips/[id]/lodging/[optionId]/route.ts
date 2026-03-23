import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const { id, optionId } = await params;

    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const body = await request.json();

    // Handle vote
    if (body.action === 'vote_up') {
      await prisma.trip_lodging_options.update({ where: { id: optionId }, data: { votes_up: { increment: 1 } } });
      return NextResponse.json({ success: true });
    }
    if (body.action === 'vote_down') {
      await prisma.trip_lodging_options.update({ where: { id: optionId }, data: { votes_down: { increment: 1 } } });
      return NextResponse.json({ success: true });
    }

    // Handle select (lock in this option)
    if (body.action === 'select') {
      // Deselect all others first
      await prisma.trip_lodging_options.updateMany({ where: { trip_id: id }, data: { is_selected: false } });
      await prisma.trip_lodging_options.update({ where: { id: optionId }, data: { is_selected: true } });
      return NextResponse.json({ success: true });
    }

    // Handle deselect
    if (body.action === 'deselect') {
      await prisma.trip_lodging_options.update({ where: { id: optionId }, data: { is_selected: false } });
      return NextResponse.json({ success: true });
    }

    // Handle general update
    const { title, location, price_per_night, total_price, taxes_estimate, per_person, notes } = body;
    await prisma.trip_lodging_options.update({
      where: { id: optionId },
      data: {
        ...(title !== undefined && { title }),
        ...(location !== undefined && { location }),
        ...(price_per_night !== undefined && { price_per_night }),
        ...(total_price !== undefined && { total_price }),
        ...(taxes_estimate !== undefined && { taxes_estimate }),
        ...(per_person !== undefined && { per_person }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const { id, optionId } = await params;

    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    await prisma.trip_lodging_options.delete({ where: { id: optionId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

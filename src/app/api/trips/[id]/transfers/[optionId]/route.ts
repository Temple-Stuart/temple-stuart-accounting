import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const { id, optionId } = await params;

    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const body = await request.json();
    
    if (body.action === 'vote_up') {
      await prisma.$queryRaw`UPDATE trip_transfer_options SET votes_up = votes_up + 1, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    if (body.action === 'vote_down') {
      await prisma.$queryRaw`UPDATE trip_transfer_options SET votes_down = votes_down + 1, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    if (body.action === 'select') {
      // Only deselect same direction
      const opt = await prisma.$queryRaw`SELECT direction FROM trip_transfer_options WHERE id = ${optionId}::uuid` as any[];
      if (opt[0]) {
        await prisma.$queryRaw`UPDATE trip_transfer_options SET is_selected = false WHERE trip_id = ${id} AND direction = ${opt[0].direction}`;
      }
      await prisma.$queryRaw`UPDATE trip_transfer_options SET is_selected = true, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    if (body.action === 'deselect') {
      await prisma.$queryRaw`UPDATE trip_transfer_options SET is_selected = false, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    
    const { title, vendor, price, per_person, notes } = body;
    await prisma.$queryRaw`
      UPDATE trip_transfer_options SET
        title = COALESCE(${title}, title),
        vendor = COALESCE(${vendor}, vendor),
        price = COALESCE(${price}, price),
        per_person = COALESCE(${per_person}, per_person),
        notes = COALESCE(${notes}, notes),
        updated_at = NOW()
      WHERE id = ${optionId}::uuid
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const { id, optionId } = await params;

    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    await prisma.$queryRaw`DELETE FROM trip_transfer_options WHERE id = ${optionId}::uuid`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

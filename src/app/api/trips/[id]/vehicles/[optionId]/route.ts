import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const { id, optionId } = await params;
    const body = await request.json();
    
    if (body.action === 'vote_up') {
      await prisma.$queryRaw`UPDATE trip_vehicle_options SET votes_up = votes_up + 1, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    if (body.action === 'vote_down') {
      await prisma.$queryRaw`UPDATE trip_vehicle_options SET votes_down = votes_down + 1, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    if (body.action === 'select') {
      await prisma.$queryRaw`UPDATE trip_vehicle_options SET is_selected = false WHERE trip_id = ${id}`;
      await prisma.$queryRaw`UPDATE trip_vehicle_options SET is_selected = true, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    if (body.action === 'deselect') {
      await prisma.$queryRaw`UPDATE trip_vehicle_options SET is_selected = false, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    
    const { title, vendor, price_per_day, total_price, per_person, notes } = body;
    await prisma.$queryRaw`
      UPDATE trip_vehicle_options SET
        title = COALESCE(${title}, title),
        vendor = COALESCE(${vendor}, vendor),
        price_per_day = COALESCE(${price_per_day}, price_per_day),
        total_price = COALESCE(${total_price}, total_price),
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
    const { optionId } = await params;
    await prisma.$queryRaw`DELETE FROM trip_vehicle_options WHERE id = ${optionId}::uuid`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

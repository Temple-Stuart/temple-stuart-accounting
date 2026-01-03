import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const { optionId } = await params;
    const body = await request.json();
    
    if (body.action === 'vote_up') {
      await prisma.$queryRaw`UPDATE trip_activity_expenses SET votes_up = votes_up + 1, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    if (body.action === 'vote_down') {
      await prisma.$queryRaw`UPDATE trip_activity_expenses SET votes_down = votes_down + 1, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    if (body.action === 'select') {
      await prisma.$queryRaw`UPDATE trip_activity_expenses SET is_selected = true, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    if (body.action === 'deselect') {
      await prisma.$queryRaw`UPDATE trip_activity_expenses SET is_selected = false, updated_at = NOW() WHERE id = ${optionId}::uuid`;
      return NextResponse.json({ success: true });
    }
    
    const { title, vendor, url, price, per_person, notes } = body;
    await prisma.$queryRaw`
      UPDATE trip_activity_expenses SET
        title = COALESCE(${title}, title),
        vendor = COALESCE(${vendor}, vendor),
        url = COALESCE(${url}, url),
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
    const { optionId } = await params;
    await prisma.$queryRaw`DELETE FROM trip_activity_expenses WHERE id = ${optionId}::uuid`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { status } = await request.json();
    
    const updated = await prisma.prospects.update({
      where: { id: params.id },
      data: { status }
    });
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating prospect:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.prospects.delete({
      where: { id: params.id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting prospect:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

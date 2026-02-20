import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

// POST: Delete stock lots (for cleanup)
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { lotIds } = await request.json();

    if (!Array.isArray(lotIds) || lotIds.length === 0) {
      return NextResponse.json({ error: 'No lot IDs provided' }, { status: 400 });
    }

    // Verify lots belong to user
    const lots = await prisma.stock_lots.findMany({
      where: { 
        id: { in: lotIds },
        user_id: user.id
      }
    });

    if (lots.length !== lotIds.length) {
      return NextResponse.json({ 
        error: 'Some lots not found or not owned by user',
        found: lots.length,
        requested: lotIds.length
      }, { status: 400 });
    }

    // Delete dispositions first (foreign key constraint)
    await prisma.lot_dispositions.deleteMany({
      where: { lot_id: { in: lotIds } }
    });

    // Delete the lots
    const result = await prisma.stock_lots.deleteMany({
      where: { id: { in: lotIds } }
    });

    return NextResponse.json({
      success: true,
      deleted: result.count
    });
  } catch (error) {
    console.error('Stock lots delete error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete lots' 
    }, { status: 500 });
  }
}

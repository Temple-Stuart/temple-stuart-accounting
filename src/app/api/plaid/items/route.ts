import { requireTier, getCurrentUser} from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tierGate = requireTier(user.tier, 'plaid');
    if (tierGate) return tierGate;

    const items = await prisma.plaid_items.findMany({
      where: { userId: user.id }
    });
    
    return NextResponse.json(items);
  } catch (error: any) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

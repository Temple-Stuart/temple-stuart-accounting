import { requireTabAccess } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // TAB-SERVER-GATE: tab:books entitlement replaces the 'plaid' tier gate
    const tierGate = await requireTabAccess(user.id, 'tab:books');
    if (tierGate) return tierGate;

    // SEC-01: the only consumer (src/components/dashboard/ImportDataSection.tsx:63-69)
    // reads `item.id` and nothing else. Select exactly that — the row's accessToken
    // is a Plaid secret and must never reach the browser.
    const items = await prisma.plaid_items.findMany({
      where: { userId: user.id },
      select: { id: true },
    });

    // Compile-time proof that no token field is in the response type: a select
    // that re-adds accessToken fails `satisfies` (string is not assignable to never).
    return NextResponse.json(items satisfies ReadonlyArray<{ id: string; accessToken?: never }>);
  } catch (error: unknown) {
    console.error('Error fetching items:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

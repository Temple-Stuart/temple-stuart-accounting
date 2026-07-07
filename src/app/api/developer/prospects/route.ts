import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';

export async function GET() {
  try {
    // SEC-3: prospects is a GLOBAL sales-lead table (contact PII — name, email,
    // phone, pain points) with no per-user column, so every authed user could
    // read every lead. Admin-only. requireAdmin returns 401 (guest) / 403
    // (non-admin) BEFORE any DB read. The client-side 'temple2024' gate on the
    // developer page is cosmetic UX only and was never the security boundary —
    // this server check is.
    const adminGate = await requireAdmin();
    if (adminGate instanceof NextResponse) return adminGate;

    const prospects = await prisma.prospects.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(prospects);
  } catch (error) {
    console.error('Error fetching prospects:', error);
    return NextResponse.json([]);
  }
}

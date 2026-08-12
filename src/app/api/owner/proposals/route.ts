import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';

// OWNER-DASH: the proposals queue read — every submission, newest first
// (the proposals_created_at_idx DESC index's exact shape). Owner-only
// surface; requireAdmin FIRST — the 18-route precedent.

export async function GET() {
  const adminGate = await requireAdmin();
  if (adminGate instanceof NextResponse) return adminGate;

  try {
    const rows = await prisma.proposals.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Owner proposals error:', error);
    return NextResponse.json({ error: 'Failed to load proposals' }, { status: 500 });
  }
}

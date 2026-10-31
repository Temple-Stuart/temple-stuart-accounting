import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';

// OWNER-DASH: the proposals queue read — every submission, newest first
// (the proposals_created_at_idx DESC index's exact shape). Owner-only
// surface; requireAdmin FIRST — the 18-route precedent.
// ADDENDUM (ipHash exclusion): explicit select of every rendered field —
// ip_hash is an abuse-tracing artifact, DB-only, never wire.

export async function GET() {
  const adminGate = await requireAdmin();
  if (adminGate instanceof NextResponse) return adminGate;

  try {
    const rows = await prisma.proposals.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        name: true,
        email: true,
        business: true,
        currentStack: true,
        need: true,
        modules: true,
        startWindow: true,
        budgetRange: true,
        notesFromThem: true,
        hardDeadline: true,
        deadlineDriver: true,
        links: true,
        teamSize: true,
        referralSource: true,
        status: true,
        ownerNotes: true,
      },
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Owner proposals error:', error);
    return NextResponse.json({ error: 'Failed to load proposals' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';

// OWNER-DASH: Alex's triage write — status and/or owner_notes, NOTHING else
// writable (the submission itself is immutable once received; the table's
// only two owner fields are exactly these). updated_at bumps via @updatedAt.
// requireAdmin FIRST — the 18-route precedent.

const patchSchema = z
  .object({
    status: z.enum(['new', 'reviewing', 'sent', 'won', 'lost']).optional(),
    ownerNotes: z.string().max(5000).optional(),
  })
  .refine((d) => d.status !== undefined || d.ownerNotes !== undefined, {
    message: 'Provide status and/or ownerNotes',
  });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminGate = await requireAdmin();
  if (adminGate instanceof NextResponse) return adminGate;

  try {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid patch',
          issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        },
        { status: 400 },
      );
    }
    const d = parsed.data;

    const row = await prisma.proposals.update({
      where: { id },
      data: {
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.ownerNotes !== undefined ? { ownerNotes: d.ownerNotes } : {}),
      },
    });
    return NextResponse.json(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('Owner proposal patch error:', error);
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
  }
}

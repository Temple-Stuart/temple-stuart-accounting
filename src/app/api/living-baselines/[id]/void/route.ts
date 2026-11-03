import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { isValidUuid } from '@/lib/operations/parseUuid';
import {
  BASELINE_JSON_BODY_WORDS, NO_SUCH_BASELINE_WORDS, baselineAlreadyVoidedWords, baselineVoidBodyRule, baselineVoidStateRule,
} from '@/lib/travel/livingBaseline';

/**
 * TRAVEL-02c (Alex, 2026-11-03, ruling C) — POST /api/living-baselines/[id]/void { reason }: the one change a living
 * baseline takes (TRAVEL-02b's void route exactly). The reason is required and never blank (livingBaseline.ts
 * baselineVoidBodyRule — an unknown field is refused by name); the row must be the caller's (another user's, a missing
 * one or an id that is not a UUID is the defensive 404); a baseline is voided ONCE — a second void is a 409 by name,
 * naming the first (baselineVoidStateRule). The write is one updateMany scoped to the caller and to a row not yet
 * voided, so two voids that race write one; the database holds the same rule (the migration's void pair CHECK and
 * FREEZE trigger). Nothing is deleted: a voided baseline stays, marked, and leaves its day free for a live one. Same
 * gate as /api/reservations; no paid call.
 */
const VOID_ANSWER_SELECT = { id: true, voided_at: true, void_reason: true } as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: BASELINE_JSON_BODY_WORDS }, { status: 400 }); }
  const read = baselineVoidBodyRule(body);
  if (!read.ok) return NextResponse.json({ error: read.words, field: read.field }, { status: 400 });

  // living_baselines.id is a UUID: any other id names no row — the same 404, never a database error.
  if (!isValidUuid(id)) return NextResponse.json({ error: NO_SUCH_BASELINE_WORDS }, { status: 404 });
  const row = await prisma.living_baselines.findFirst({ where: { id, user_id: user.id }, select: VOID_ANSWER_SELECT });
  if (!row) return NextResponse.json({ error: NO_SUCH_BASELINE_WORDS }, { status: 404 });
  const state = baselineVoidStateRule(row);
  if (!state.ok) return NextResponse.json({ error: state.words }, { status: 409 });

  const written = await prisma.living_baselines.updateMany({
    where: { id, user_id: user.id, voided_at: null },
    data: { voided_at: new Date(), void_reason: read.reason },
  });
  const after = await prisma.living_baselines.findFirst({ where: { id, user_id: user.id }, select: VOID_ANSWER_SELECT });
  if (!after) throw new Error(`living-baselines void: baseline ${id} was read, then could not be read again — a living baseline is never deleted`);
  // Two voids raced: the other one wrote first — this one is refused by name, naming the void that stands.
  if (written.count === 0) {
    if (after.voided_at === null) throw new Error(`living-baselines void: baseline ${id} was not voided and the void wrote nothing`);
    return NextResponse.json({ error: baselineAlreadyVoidedWords(after.voided_at, after.void_reason as string) }, { status: 409 });
  }
  return NextResponse.json({ baseline: { id: after.id, voided_at: after.voided_at === null ? null : after.voided_at.toISOString(), void_reason: after.void_reason } });
}

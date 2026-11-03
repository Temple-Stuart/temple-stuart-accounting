import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { LIVING_BASELINE_SELECT, livingBaselineRowOf } from '@/lib/operations/stayCosts';
import { BASELINE_JSON_BODY_WORDS, livingBaselineBodyRule, sameDayLiveBaselineWords } from '@/lib/travel/livingBaseline';

/**
 * TRAVEL-02c (Alex, 2026-11-03, ruling C) — /api/living-baselines: the caller's living baselines (TRAVEL-00's
 * decision 9 — one dated baseline table, prisma/schema.prisma living_baselines).
 *
 * GET  → { baselines } — every living baseline of the caller, voided included (voided_at and void_reason say so),
 *        newest effective day first.
 * POST { label, effective_from, monthly_minor, currency } → 201 { baseline }. The body rule (livingBaseline.ts
 *        livingBaselineBodyRule) refuses every field by name, an unknown one too (400): the label trimmed, 1–80
 *        characters; effective_from a DAY; monthly_minor a whole number of hundredths above 0; currency three ISO 4217
 *        capitals. A second LIVE baseline on the same effective_from → 409 by name, naming the one that stands — read
 *        before the write; the migration's partial unique index is the backstop for a race, answered the same.
 *        Nothing is defaulted: no currency, no day.
 *
 * THE GATE (the /api/reservations pattern — TRAVEL-02b's routes exactly): getVerifiedEmail → 401; the users row → 404;
 * the middleware's 307 for a guest comes first. Every query names the caller (user_id = user.id). No paid call, no
 * vendor call. No PUT, no DELETE: a baseline is frozen once kept and voided, never deleted (the migration's triggers) —
 * the void is POST /api/living-baselines/[id]/void.
 */
type BaselineDbRow = {
  id: string; label: string; effective_from: Date; monthly_minor: number; currency: string; voided_at: Date | null; void_reason: string | null; created_at: Date;
};

async function caller() {
  const email = await getVerifiedEmail();
  if (!email) return null;
  return prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
  });
}

export async function GET() {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const rows = await prisma.living_baselines.findMany({
    where: { user_id: user.id },
    orderBy: [{ effective_from: 'desc' }, { created_at: 'desc' }],
    select: LIVING_BASELINE_SELECT,
  });
  return NextResponse.json({ baselines: rows.map(livingBaselineRowOf) });
}

export async function POST(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: BASELINE_JSON_BODY_WORDS }, { status: 400 }); }
  const read = livingBaselineBodyRule(body);
  if (!read.ok) return NextResponse.json({ error: read.words, field: read.field }, { status: 400 });
  const v = read.value;
  const effectiveFrom = new Date(`${v.effective_from}T00:00:00.000Z`);

  // Ruling C: two live baselines never start the same day — refused by name before any write, naming the one that stands.
  const standing = await prisma.living_baselines.findFirst({ where: { user_id: user.id, effective_from: effectiveFrom, voided_at: null }, select: { label: true } });
  if (standing) return NextResponse.json({ error: sameDayLiveBaselineWords(v.effective_from, standing.label), field: 'effective_from' }, { status: 409 });

  let row: BaselineDbRow;
  try {
    row = await prisma.living_baselines.create({
      data: {
        user_id: user.id,
        label: v.label,
        effective_from: effectiveFrom,
        monthly_minor: v.monthly_minor,
        currency: v.currency,
        created_by: user.email,
      },
      select: LIVING_BASELINE_SELECT,
    });
  } catch (error) {
    // The race: another live baseline for the day landed between the read and the write — the partial unique held it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.living_baselines.findFirst({ where: { user_id: user.id, effective_from: effectiveFrom, voided_at: null }, select: { label: true } });
      if (!raced) throw new Error(`living-baselines POST: the partial unique refused ${v.effective_from} and no live baseline starts that day`);
      return NextResponse.json({ error: sameDayLiveBaselineWords(v.effective_from, raced.label), field: 'effective_from' }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ baseline: livingBaselineRowOf(row) }, { status: 201 });
}

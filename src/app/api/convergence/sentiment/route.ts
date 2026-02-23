import { NextResponse } from 'next/server';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { prisma } from '@/lib/prisma';
import { requireTier } from '@/lib/auth-helpers';
import { fetchSentimentBatch } from '@/lib/convergence/sentiment';

export const maxDuration = 60;

export async function POST(req: Request) {
  // AUTH — required (paid xAI API)
  const email = await getVerifiedEmail();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tierGate = requireTier(user.tier, 'ai');
  if (tierGate) return tierGate;

  let body: { symbols?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { symbols } = body;
  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    return NextResponse.json({ error: 'symbols array required' }, { status: 400 });
  }

  // Cap at 20 symbols per request to control costs
  const capped = symbols.slice(0, 20).map(String);

  const results = await fetchSentimentBatch(capped);

  return NextResponse.json({
    sentiment: Object.fromEntries(results),
    symbols_requested: capped.length,
    timestamp: new Date().toISOString(),
  });
}

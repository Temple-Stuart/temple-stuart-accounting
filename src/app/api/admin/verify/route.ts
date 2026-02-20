import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth-helpers';
import { logAuth } from '@/lib/audit-log';

// In-memory brute-force tracking: ip → { count, resetAt }
// Note: resets on cold-start in serverless (Vercel). The timing-safe password check is
// the primary defense. TODO: migrate to Upstash/Redis before multi-tenant production launch.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function getIp(request: Request): string {
  return (request as any).headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

function isLockedOut(ip: string): boolean {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip: string): void {
  const entry = attempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: Date.now() + LOCKOUT_MS });
  } else {
    entry.count++;
  }
}

function clearAttempts(ip: string): void {
  attempts.delete(ip);
}

export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: 'Admin access is not configured' }, { status: 403 });
  }

  const ip = getIp(request);

  // Require valid session before accepting password
  const user = await getCurrentUser();
  if (!user) {
    logAuth('admin_verify_no_session', 'anonymous', ip);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isLockedOut(ip)) {
    logAuth('admin_verify_locked_out', user.email, ip);
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof password !== 'string') {
    return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
  }

  // Timing-safe comparison
  const inputBuf = Buffer.from(password);
  const expectedBuf = Buffer.from(adminPassword);
  // Pad to same length before comparison to avoid length oracle
  const maxLen = Math.max(inputBuf.length, expectedBuf.length);
  const paddedInput = Buffer.concat([inputBuf, Buffer.alloc(maxLen - inputBuf.length)]);
  const paddedExpected = Buffer.concat([expectedBuf, Buffer.alloc(maxLen - expectedBuf.length)]);
  const match = crypto.timingSafeEqual(paddedInput, paddedExpected) && inputBuf.length === expectedBuf.length;

  if (match) {
    clearAttempts(ip);
    logAuth('admin_verify_success', user.email, ip);
    return NextResponse.json({ success: true });
  } else {
    recordAttempt(ip);
    logAuth('admin_verify_failed', user.email, ip);
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }
}

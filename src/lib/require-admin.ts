import { NextResponse } from 'next/server';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * Verify the caller is an authenticated admin (OWNER_EMAIL).
 * Returns the verified email on success, or a 401/403 NextResponse on failure.
 */
export async function requireAdmin(): Promise<string | NextResponse> {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail || userEmail.toLowerCase() !== ownerEmail.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  return userEmail;
}

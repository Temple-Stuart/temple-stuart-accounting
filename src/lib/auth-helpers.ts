import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * Get current authenticated user from cookie.
 * Returns null if not authenticated.
 * Use in API routes: const user = await getCurrentUser();
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userEmail = cookieStore.get('userEmail')?.value;

  if (!userEmail) return null;

  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } }
  });

  return user;
}

/**
 * Require authenticated user — returns user or throws 401-style object.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw { status: 401, message: 'Unauthorized' };
  }
  return user;
}

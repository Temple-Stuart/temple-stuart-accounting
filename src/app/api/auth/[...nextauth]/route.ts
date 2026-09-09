import NextAuth from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { buildAuthOptions } from '@/lib/auth/nextAuthOptions';

// ENV-01: the options live in src/lib/auth/nextAuthOptions.ts — the callback test
// drives next-auth's core with the SAME options, so the redirect_uri host is
// asserted against the app's host on every `npm test`. NEXTAUTH_URL (read by
// next-auth, not by this code) is checked at boot (src/lib/siteUrlGuard.ts).

const prisma = new PrismaClient();

const handler = NextAuth(
  buildAuthOptions({
    prisma,
    setSessionCookie: async (value) => {
      const cookieStore = await cookies();
      cookieStore.set('userEmail', value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    },
  }),
);

export { handler as GET, handler as POST };

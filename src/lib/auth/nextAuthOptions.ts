import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { PrismaClient } from '@prisma/client';
import { signCookie } from '@/lib/cookie-auth';

/**
 * ENV-01 — THE configured NextAuth options, as one function the route and the
 * tests share. The route (src/app/api/auth/[...nextauth]/route.ts) passes the
 * real PrismaClient and next/headers' cookie jar; the callback test
 * (src/lib/__tests__/nextAuthCallback.test.ts) passes fakes and drives
 * next-auth's own core handler with these options to build the GitHub and
 * Google authorize URLs — so the redirect_uri host next-auth derives from
 * NEXTAUTH_URL (utils/detect-origin.js, 4.24.15) is asserted against the app's
 * host on every `npm test`, the way it was not the night the bare-domain value
 * broke sign-in.
 *
 * Providers read their client ids at CALL time (process.env literals — the env
 * law's grep sees them). The session secret is JWT_SECRET (SECRET-01).
 */
export interface AuthOptionDeps {
  prisma: PrismaClient;
  /** Sets the HMAC-signed userEmail cookie the API routes read — the route hands in next/headers' cookies(). */
  setSessionCookie: (value: string) => Promise<void>;
  newId?: () => string;
}

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function buildAuthOptions({ prisma, setSessionCookie, newId = generateId }: AuthOptionDeps): NextAuthOptions {
  return {
    adapter: PrismaAdapter(prisma),
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
      GitHubProvider({
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        issuer: 'https://github.com/login/oauth',
      }),
    ],
    callbacks: {
      async signIn({ user }) {
        if (user.email) {
          const normalizedEmail = user.email.toLowerCase().trim();
          // Check if user exists in our users table (case-insensitive)
          const existingUser = await prisma.users.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
          });
          if (!existingUser) {
            // Create user in our users table — SELL-03b: the provider verified
            // the address, so the account is verified at creation.
            await prisma.users.create({
              data: {
                id: newId(),
                email: normalizedEmail,
                name: user.name || normalizedEmail.split('@')[0],
                password: '',
                updatedAt: new Date(),
                email_verified_at: new Date(),
              },
            });
          } else if (!existingUser.email_verified_at) {
            // SELL-03b: an email-signup that never used its link, now signing in
            // through a provider that verified the same address — verified.
            await prisma.users.update({ where: { id: existingUser.id }, data: { email_verified_at: new Date() } });
          }

          // Set the userEmail cookie for API routes
          await setSessionCookie(signCookie(normalizedEmail));
        }
        return true;
      },
    },
    pages: {
      signIn: '/',
    },
    // LAUNCH-01 SECRET-01: ONE session secret — the same JWT_SECRET middleware's
    // getToken and src/app/page.tsx's decode verify this token with. NEXTAUTH_SECRET
    // is retired — the boot guard (src/instrumentation.ts) refuses to start with it set.
    secret: process.env.JWT_SECRET,
  };
}

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { signCookie } from '@/lib/cookie-auth';

const prisma = new PrismaClient();

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        const normalizedEmail = user.email.toLowerCase().trim();
        // Check if user exists in our users table (case-insensitive)
        const existingUser = await prisma.users.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
        });
        if (!existingUser) {
          // Create user in our users table
          await prisma.users.create({
            data: {
              id: generateId(),
              email: normalizedEmail,
              name: user.name || normalizedEmail.split('@')[0],
              password: '',
              updatedAt: new Date(),
            }
          });
        }

        // Set the userEmail cookie for API routes
        const cookieStore = await cookies();
        cookieStore.set('userEmail', signCookie(normalizedEmail), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }
      return true;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };

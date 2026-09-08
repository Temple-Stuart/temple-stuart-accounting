import type { PrismaClient } from '@prisma/client';
import type { VerifyDb } from './verification';

/**
 * SELL-03b — the Prisma binding of the verify port (src/lib/auth/verification.ts).
 * consume() is ONE transaction: the token's used_at is set only where it is
 * still NULL (a second use finds no row and returns false — single use by
 * the database's own word), and the user's email_verified_at is set where
 * NULL in the same transaction.
 */

type Client = Pick<PrismaClient, 'verification_tokens' | 'users' | '$transaction'>;

export interface TokenStore extends VerifyDb {
  storeToken(row: { userId: string; hash: string; expiresAt: Date }): Promise<void>;
}

export function prismaVerifyDb(client: Client): TokenStore {
  return {
    async findToken(hash) {
      return client.verification_tokens.findUnique({
        where: { token_hash: hash },
        select: { id: true, user_id: true, expires_at: true, used_at: true, user: { select: { email: true, email_verified_at: true } } },
      });
    },
    async consume(tokenId, userId, now) {
      return client.$transaction(async (tx) => {
        const used = await tx.verification_tokens.updateMany({ where: { id: tokenId, used_at: null }, data: { used_at: now } });
        if (used.count !== 1) return false;
        await tx.users.updateMany({ where: { id: userId, email_verified_at: null }, data: { email_verified_at: now } });
        return true;
      });
    },
    async storeToken({ userId, hash, expiresAt }) {
      await client.verification_tokens.create({ data: { user_id: userId, token_hash: hash, expires_at: expiresAt } });
    },
  };
}

/** The signing secret for the link — the app's cookie secret; missing = fail loud, never a default. */
export function verificationSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is required to sign verification links');
  return secret;
}

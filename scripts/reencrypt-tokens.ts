/*
 * ═══════════════════════════════════════════════════════════════════════
 * Temple Stuart — SEC-02 one-time token re-encryption
 *
 * Encrypts every plaintext value of the two stored provider secrets:
 *   plaid_items.accessToken
 *   tastytrade_connections.sessionToken
 * using src/lib/secrets/tokenCipher.ts (AES-256-GCM, key from env).
 *
 * Run ONCE by Alex, locally, against production, with the key set — AFTER the
 * key is in Vercel and BEFORE the ciphertext-only readers deploy:
 *
 *   DATABASE_URL="postgresql://…" \
 *   TOKEN_ENCRYPTION_KEY="<base64 32 bytes>" \
 *   TOKEN_ENCRYPTION_KEY_ID="k1" \
 *   npx tsx scripts/reencrypt-tokens.ts
 *
 * Rules:
 *   - refuses to run if DATABASE_URL, TOKEN_ENCRYPTION_KEY, or
 *     TOKEN_ENCRYPTION_KEY_ID is missing (no defaults, no placeholders);
 *   - ONE transaction: every row of both columns, or none;
 *   - a row is touched only if it is not already ciphertext, so a second run
 *     updates zero rows (idempotent);
 *   - an empty stored value makes encryptToken throw → the whole transaction
 *     rolls back and the row is named, because an empty secret is not a secret.
 * Prints counts before and after. Never prints a token, plaintext or cipher.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from '@prisma/client';
import { encryptToken, isCiphertext } from '../src/lib/secrets/tokenCipher';

const REQUIRED = ['DATABASE_URL', 'TOKEN_ENCRYPTION_KEY', 'TOKEN_ENCRYPTION_KEY_ID'] as const;
for (const name of REQUIRED) {
  if (!process.env[name]) {
    console.error(`reencrypt-tokens: refusing to run — ${name} is not set`);
    process.exit(2);
  }
}

// Fail loud on key problems BEFORE opening a transaction.
encryptToken('preflight');

type Counts = { total: number; plaintext: number; ciphertext: number };
function count(values: string[]): Counts {
  const ciphertext = values.filter((v) => isCiphertext(v)).length;
  return { total: values.length, ciphertext, plaintext: values.length - ciphertext };
}

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$transaction(
    async (tx) => {
      const items = await tx.plaid_items.findMany({ select: { id: true, accessToken: true } });
      const conns = await tx.tastytrade_connections.findMany({ select: { id: true, sessionToken: true } });
      const before = {
        plaid_items: count(items.map((i) => i.accessToken)),
        tastytrade_connections: count(conns.map((c) => c.sessionToken)),
      };

      let updatedItems = 0;
      for (const item of items) {
        if (isCiphertext(item.accessToken)) continue;
        let stored: string;
        try {
          stored = encryptToken(item.accessToken);
        } catch (err) {
          throw new Error(`plaid_items.id=${item.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
        await tx.plaid_items.update({ where: { id: item.id }, data: { accessToken: stored } });
        updatedItems++;
      }

      let updatedConns = 0;
      for (const conn of conns) {
        if (isCiphertext(conn.sessionToken)) continue;
        let stored: string;
        try {
          stored = encryptToken(conn.sessionToken);
        } catch (err) {
          throw new Error(`tastytrade_connections.id=${conn.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
        await tx.tastytrade_connections.update({ where: { id: conn.id }, data: { sessionToken: stored } });
        updatedConns++;
      }

      const itemsAfter = await tx.plaid_items.findMany({ select: { accessToken: true } });
      const connsAfter = await tx.tastytrade_connections.findMany({ select: { sessionToken: true } });
      const after = {
        plaid_items: count(itemsAfter.map((i) => i.accessToken)),
        tastytrade_connections: count(connsAfter.map((c) => c.sessionToken)),
      };
      if (after.plaid_items.plaintext !== 0 || after.tastytrade_connections.plaintext !== 0) {
        throw new Error('post-condition failed: plaintext rows remain after re-encryption');
      }
      return { before, after, updated: { plaid_items: updatedItems, tastytrade_connections: updatedConns } };
    },
    { timeout: 120_000 },
  );

  console.log('reencrypt-tokens: committed');
  console.log('  key id:', process.env.TOKEN_ENCRYPTION_KEY_ID);
  console.log('  before:', JSON.stringify(result.before));
  console.log('  updated:', JSON.stringify(result.updated));
  console.log('  after: ', JSON.stringify(result.after));
  console.log('  idempotent: a second run will update zero rows');
}

main()
  .catch((err) => {
    console.error('reencrypt-tokens: FAILED — transaction rolled back, nothing changed:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
